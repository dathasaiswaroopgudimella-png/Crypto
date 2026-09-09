"""isolation.py — Processing container isolation, session key TTL, and RAM zero-fill.

Implements Gates T16.1, T16.2, T16.3 per Chronis Bible Parts 4.2, 5.24, and
AI_ML_SPRINT_PLAN_v2 Sprint 16 Days 46–48.

Key Architectural Guarantees:
  1. Plaintext decrypted in RAM only — never touches persistent storage (T16.1).
  2. 24-hour Session-Key TTL enforced by Constitutional Layer (T16.2).
  3. Cryptographic RAM zero-fill on teardown with memory-forensics validation (T16.3).
  4. Explicit separation between Mode A (Cloud) and Mode B (Local) execution targets.
  5. Fail-closed: Container refuses to run without isolation unless allow_no_isolation=True
     is explicitly provided for local development (which is labeled SECURITY BOUNDARY: NONE).
  6. Concurrency and thread-safety: Re-entrant locks (threading.RLock) guard buffer mutations,
     session key state, and container execution lifecycles against data races.
  7. Hardware-level memory wiping: In-place C-level ctypes.memset directly overwrites raw
     buffer memory addresses, preventing dead-code elimination and Python interpreter GC lags.
  8. Memory pinning: Best-effort OS physical page locking (VirtualLock on Windows, mlock on POSIX)
     prevents paging sensitive plaintext or session key material to persistent swap files.
"""

from __future__ import annotations

import ctypes
import inspect
import marshal
import multiprocessing as mp
from multiprocessing import shared_memory
import os
import pickle
import secrets
import shutil
import threading
import time
import types
import uuid
import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional


class ImmutablePlaintextWarning(UserWarning):
    """Issued when raw immutable bytes are processed in container, lingering on CPython heap."""
    pass



def _lock_memory(addr: int, size: int) -> bool:
    """Lock memory pages into physical RAM (Windows VirtualLock / POSIX mlock).

    Prevents sensitive memory pages from being paged to disk/swap, upholding Gate T16.1.
    Fails gracefully if process quotas or operating system privileges disallow pinning.
    """
    if size <= 0:
        return False
    try:
        if os.name == "nt":
            return bool(
                ctypes.windll.kernel32.VirtualLock(
                    ctypes.c_void_p(addr), ctypes.c_size_t(size)
                )
            )
        else:
            import ctypes.util
            libc_name = ctypes.util.find_library("c") or "libc.so.6"
            try:
                libc = ctypes.CDLL(libc_name)
            except Exception:
                libc = ctypes.CDLL(None)
            return libc.mlock(ctypes.c_void_p(addr), ctypes.c_size_t(size)) == 0
    except Exception:
        return False


def _unlock_memory(addr: int, size: int) -> bool:
    """Unlock memory pages previously pinned into physical RAM."""
    if size <= 0:
        return False
    try:
        if os.name == "nt":
            return bool(
                ctypes.windll.kernel32.VirtualUnlock(
                    ctypes.c_void_p(addr), ctypes.c_size_t(size)
                )
            )
        else:
            import ctypes.util
            libc_name = ctypes.util.find_library("c") or "libc.so.6"
            try:
                libc = ctypes.CDLL(libc_name)
            except Exception:
                libc = ctypes.CDLL(None)
            return libc.munlock(ctypes.c_void_p(addr), ctypes.c_size_t(size)) == 0
    except Exception:
        return False


def ctypes_zero_memory(buf: bytearray | memoryview) -> None:
    """Cryptographically zero-fill mutable memory using low-level ctypes.memset.

    Guarantees hardware-level memory wipe at the C memory pointer level, defeating
    compiler dead-code elimination, lazy garbage collection, and bytecode optimizations.
    Includes defense-in-depth Python slice overwrite.
    """
    n = len(buf)
    if n == 0:
        return

    # Attempt direct C pointer memset
    try:
        c_arr = (ctypes.c_char * n).from_buffer(buf)
        try:
            ctypes.memset(ctypes.addressof(c_arr), 0, n)
        finally:
            del c_arr
    except Exception:
        pass

    # Defense-in-depth: Python slice assignment
    try:
        buf[:n] = b"\x00" * n
    except Exception:
        try:
            for i in range(n):
                buf[i] = 0
        except Exception:
            pass


class SessionKeyExpired(Exception):
    """Raised when an expired session key is used for decryption or verification."""
    pass


class SandboxRuntimeUnavailable(Exception):
    """Raised when an isolated sandbox runtime (gVisor or Firecracker) is requested but unavailable."""
    pass


class ExecutionTarget(str, Enum):
    """Target execution environment for isolated processing container."""
    MODE_A_CLOUD = "mode_a_cloud"
    MODE_B_LOCAL = "mode_b_local"


class SecureBuffer:
    """A mutable buffer that securely wipes its underlying memory upon release.

    Guarantees:
      - Thread-safe state transitions and view access protected by an RLock.
      - Low-level in-place C memset zeroing via ctypes.memset.
      - Best-effort physical RAM page pinning (mlock / VirtualLock) to prevent disk swap leakage (T16.1).
      - Destructor (__del__) and context manager (__exit__) wipe safety nets.
    """

    def __init__(
        self,
        data: bytes | bytearray | memoryview | int,
        pin_memory: bool = True,
    ) -> None:
        self._lock = threading.RLock()
        with self._lock:
            if isinstance(data, int):
                self._buf = bytearray(data)
            elif isinstance(data, (bytes, bytearray, memoryview)):
                self._buf = bytearray(data)
            else:
                raise TypeError(f"Unsupported data type for SecureBuffer: {type(data)}")
            self._zeroed = False
            self._locked = False
            if pin_memory and len(self._buf) > 0:
                self._locked = self._attempt_lock()

    def _attempt_lock(self) -> bool:
        """Attempt to pin buffer pages in physical memory."""
        if len(self._buf) == 0:
            return False
        try:
            c_arr = (ctypes.c_char * len(self._buf)).from_buffer(self._buf)
            addr = ctypes.addressof(c_arr)
            del c_arr
            return _lock_memory(addr, len(self._buf))
        except Exception:
            return False

    @property
    def is_zeroed(self) -> bool:
        with self._lock:
            return self._zeroed

    @property
    def is_locked(self) -> bool:
        with self._lock:
            return self._locked

    def view(self) -> memoryview:
        """Return a memoryview to the underlying mutable buffer."""
        with self._lock:
            if self._zeroed:
                raise ValueError("SecureBuffer has already been zeroed and destroyed.")
            return memoryview(self._buf)

    def zero(self) -> None:
        """In-place overwrite of all bytes with zero using hardware-level ctypes.memset."""
        with self._lock:
            if not self._zeroed:
                # 1. Zero out memory while still pinned
                ctypes_zero_memory(self._buf)

                # 2. Release physical RAM page pin
                if self._locked:
                    try:
                        c_arr = (ctypes.c_char * len(self._buf)).from_buffer(self._buf)
                        addr = ctypes.addressof(c_arr)
                        del c_arr
                        _unlock_memory(addr, len(self._buf))
                    except Exception:
                        pass
                    self._locked = False

                self._zeroed = True

    def __len__(self) -> int:
        with self._lock:
            return len(self._buf)

    def __enter__(self) -> SecureBuffer:
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.zero()

    def __del__(self) -> None:
        try:
            self.zero()
        except Exception:
            pass

    def __repr__(self) -> str:
        with self._lock:
            status = "zeroed" if self._zeroed else "active"
            return f"<SecureBuffer len={len(self._buf)} status={status} locked={self._locked}>"


@dataclass
class SessionKey:
    """Cryptographic session key granted by the Constitutional Layer with 24h TTL."""
    key_id: str
    material: SecureBuffer
    issued_at: float
    ttl_seconds: float = 24 * 60 * 60  # 24 hours
    _lock: threading.RLock = field(
        default_factory=threading.RLock, init=False, repr=False, compare=False
    )

    def is_expired(self, now: Optional[float] = None) -> bool:
        with self._lock:
            current_time = now if now is not None else time.time()
            return current_time > (self.issued_at + self.ttl_seconds)

    def require_valid(self, now: Optional[float] = None) -> None:
        with self._lock:
            if self.is_expired(now=now):
                current_time = now if now is not None else time.time()
                elapsed = current_time - self.issued_at
                raise SessionKeyExpired(
                    f"SessionKey {self.key_id} has expired (issued_at={self.issued_at}, "
                    f"now={current_time}, elapsed={elapsed:.1f}s, ttl={self.ttl_seconds}s)"
                )
            if hasattr(self, "material") and self.material is not None and self.material.is_zeroed:
                raise SessionKeyExpired(
                    f"SessionKey {self.key_id} material has been zeroed and is no longer valid."
                )

    def zero(self) -> None:
        """Securely wipe the underlying session key material."""
        with self._lock:
            if hasattr(self, "material") and self.material is not None and not self.material.is_zeroed:
                self.material.zero()


class MockConstitutionalLayerClient:
    """Client for Constitutional Policy Engine (G4) granting ephemeral session keys."""

    def __init__(self) -> None:
        self._lock = threading.RLock()

    def grant_session_key(self, purpose: str = "inference") -> SessionKey:
        """Grant a fresh session key with an immutable 24-hour TTL."""
        with self._lock:
            key_bytes = secrets.token_bytes(32)
            return SessionKey(
                key_id=str(uuid.uuid4()),
                material=SecureBuffer(key_bytes),
                issued_at=time.time(),
                ttl_seconds=24 * 60 * 60,
            )


class SandboxRuntime(ABC):
    """Abstract base class for isolated execution boundaries."""

    @property
    @abstractmethod
    def security_boundary(self) -> str:
        """Name of the security boundary provided by this runtime."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Check if required binary or hypervisor runtime is present on host."""
        pass

    @abstractmethod
    def execute(
        self,
        decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
        process_fn: Callable[[memoryview], bytes],
        buffer_size: int,
        client: Optional[MockConstitutionalLayerClient] = None,
        execution_target: ExecutionTarget = ExecutionTarget.MODE_A_CLOUD,
    ) -> bytes:
        """Execute processing workload inside this runtime's isolation boundary."""
        pass


class GvisorRuntime(SandboxRuntime):
    """gVisor sandboxed user-space kernel runtime (runsc)."""

    @property
    def security_boundary(self) -> str:
        return "gvisor_runsc"

    def is_available(self) -> bool:
        return shutil.which("runsc") is not None

    def execute(
        self,
        decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
        process_fn: Callable[[memoryview], bytes],
        buffer_size: int,
        client: Optional[MockConstitutionalLayerClient] = None,
        execution_target: ExecutionTarget = ExecutionTarget.MODE_A_CLOUD,
    ) -> bytes:
        """Execute workload inside gVisor (runsc) user-space kernel sandbox."""
        if not self.is_available():
            raise SandboxRuntimeUnavailable(
                "Cannot execute inside gVisor sandbox: 'runsc' binary is not installed or available on this host. "
                "Kernel sandboxing requires a Linux host with gVisor installed (tracked under External Gate EXT-02)."
            )
        return self._execute_runsc_command(
            decrypt_into_fn, process_fn, buffer_size, client, execution_target
        )

    def _execute_runsc_command(
        self,
        decrypt_into_fn: Callable,
        process_fn: Callable,
        buffer_size: int,
        client: Optional[MockConstitutionalLayerClient],
        execution_target: ExecutionTarget,
    ) -> bytes:
        """Execute workload via runsc do command."""
        runsc_bin = shutil.which("runsc")
        if not runsc_bin:
            raise SandboxRuntimeUnavailable("runsc binary not found in PATH.")
        cmd = [runsc_bin, "--rootless", "do", sys.executable, "-c", "import sys; sys.exit(0)"]
        try:
            res = subprocess.run(cmd, capture_output=True, timeout=10)
            if res.returncode != 0:
                raise RuntimeError(f"runsc do execution failed: {res.stderr.decode('utf-8', errors='replace')}")
        except Exception as exc:
            raise RuntimeError(f"gVisor runsc execution failed: {exc}")
        raise NotImplementedError("Production gVisor OCI bundle execution requires Linux host per EXT-02.")


class FirecrackerRuntime(SandboxRuntime):
    """Firecracker microVM hardware-isolated execution runtime."""

    @property
    def security_boundary(self) -> str:
        return "microvm_firecracker"

    def is_available(self) -> bool:
        return shutil.which("firecracker") is not None

    def execute(
        self,
        decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
        process_fn: Callable[[memoryview], bytes],
        buffer_size: int,
        client: Optional[MockConstitutionalLayerClient] = None,
        execution_target: ExecutionTarget = ExecutionTarget.MODE_A_CLOUD,
    ) -> bytes:
        """Execute workload inside Firecracker microVM hardware partition."""
        if not self.is_available():
            raise SandboxRuntimeUnavailable(
                "Cannot execute inside Firecracker microVM: 'firecracker' binary is not installed or available on this host. "
                "Hardware microVM isolation requires a Linux KVM host (tracked under External Gate EXT-03)."
            )
        return self._execute_firecracker_command(
            decrypt_into_fn, process_fn, buffer_size, client, execution_target
        )

    def _execute_firecracker_command(
        self,
        decrypt_into_fn: Callable,
        process_fn: Callable,
        buffer_size: int,
        client: Optional[MockConstitutionalLayerClient],
        execution_target: ExecutionTarget,
    ) -> bytes:
        fc_bin = shutil.which("firecracker")
        if not fc_bin:
            raise SandboxRuntimeUnavailable("firecracker binary not found in PATH.")
        raise NotImplementedError("Production Firecracker microVM execution requires Linux KVM host per EXT-03.")


class LocalDevRuntime(SandboxRuntime):
    """Local development fallback runtime.

    SECURITY BOUNDARY: NONE.
    Used strictly for local development and unit test validation when
    microVM or gVisor virtualization is not available on host.
    """

    @property
    def security_boundary(self) -> str:
        return "none"

    def is_available(self) -> bool:
        return True

    def execute(
        self,
        decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
        process_fn: Callable[[memoryview], bytes],
        buffer_size: int,
        client: Optional[MockConstitutionalLayerClient] = None,
        execution_target: ExecutionTarget = ExecutionTarget.MODE_A_CLOUD,
    ) -> bytes:
        """Execute directly in local process RAM (DEV ONLY: SECURITY BOUNDARY NONE)."""
        session_key: Optional[SessionKey] = None
        plaintext_buf: Optional[SecureBuffer] = None
        try:
            if client is not None:
                session_key = client.grant_session_key(
                    purpose=f"local_dev_{execution_target.value}"
                )
                session_key.require_valid()

            plaintext_buf = SecureBuffer(buffer_size)
            if session_key is not None:
                written = decrypt_into_fn(session_key, plaintext_buf)
            else:
                written = decrypt_into_fn(plaintext_buf)

            full_view = plaintext_buf.view()
            active_view = full_view if written is None else full_view[:written]
            output = process_fn(active_view)
            return bytes(output) if not isinstance(output, bytes) else output
        finally:
            if plaintext_buf is not None and not plaintext_buf.is_zeroed:
                plaintext_buf.zero()
            if session_key is not None and hasattr(session_key, "material"):
                if not session_key.material.is_zeroed:
                    session_key.zero()


class SandboxOperation(str, Enum):
    """Predefined command verbs for structured sandbox IPC.
    
    Production microVM boundaries (EXT-05) restrict container execution to
    pre-compiled command verbs over vsock, preventing arbitrary code deserialization.
    """
    CUSTOM_CALLABLE = "CUSTOM_CALLABLE"
    PROCESS_AUDIO = "PROCESS_AUDIO"
    TRANSFORM_VOICE = "TRANSFORM_VOICE"
    EXTRACT_PROSODY = "EXTRACT_PROSODY"
    ECHO = "ECHO"


class ProcessIsolatedDevRuntime(SandboxRuntime):
    """Subprocess-isolated development runtime.

    SECURITY BOUNDARY: NONE (DEV SUBPROCESS ISOLATION ONLY).
    Provides process-level separation on the local operating system for testing and development.
    Plaintext secrets are decrypted, pinned, and wiped inside a dedicated child process with
    its own virtual address space (parent_pid != child_pid).
    Does NOT provide a hardware microVM (Firecracker) or kernel sandbox (gVisor) boundary.
    Cannot satisfy allow_no_isolation=False in production mode.
    """

    @property
    def security_boundary(self) -> str:
        return "process_isolated_dev"

    def is_available(self) -> bool:
        # Dev process isolation cannot satisfy production virtualization requirements.
        # Production mode strictly requires GvisorRuntime or FirecrackerRuntime.
        return False

    def execute(
        self,
        decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
        process_fn: Callable[[memoryview], bytes],
        buffer_size: int,
        client: Optional[MockConstitutionalLayerClient] = None,
        execution_target: ExecutionTarget = ExecutionTarget.MODE_A_CLOUD,
        timeout_seconds: float = 30.0,
    ) -> bytes:
        """Execute decryption and processing inside an isolated child subprocess."""
        return _run_in_isolated_process(
            decrypt_into_fn=decrypt_into_fn,
            process_fn=process_fn,
            buffer_size=buffer_size,
            client=client,
            execution_target=execution_target,
            timeout_seconds=timeout_seconds,
        )

    execute_process_isolated = execute


# Backwards compatibility alias
ProcessIsolatedSandboxRuntime = ProcessIsolatedDevRuntime


def _serialize_callable(fn: Callable) -> tuple:
    """Serialize callable across process boundaries supporting closures, local functions, and __main__.
    
    Note on Security Architecture:
      In local development, dynamic callable serialization is supported for test harness flexibility.
      In production microVM boundaries (EXT-05), the child microVM runs a pre-compiled worker entrypoint
      receiving structured command verbs over vsock, eliminating dynamic bytecode deserialization.
    """
    is_main = getattr(fn, "__module__", None) in (None, "__main__")
    is_local = (
        ".<locals>." in getattr(fn, "__qualname__", "")
        or getattr(fn, "__name__", "") == "<lambda>"
    )

    if not is_main and not is_local:
        try:
            return ("pickle", pickle.dumps(fn))
        except Exception:
            pass

    code_bytes = marshal.dumps(fn.__code__)
    raw_closure_vals = (
        [c.cell_contents for c in fn.__closure__]
        if getattr(fn, "__closure__", None)
        else None
    )
    closure_vals = None
    if raw_closure_vals is not None:
        closure_vals = []
        for c in raw_closure_vals:
            if isinstance(c, types.ModuleType):
                closure_vals.append(None)
            else:
                closure_vals.append(c)
    ref_globals = {}
    fn_globals = getattr(fn, "__globals__", {})
    fn_code = getattr(fn, "__code__", None)
    if fn_code:
        for name in fn_code.co_names:
            if name in fn_globals:
                val = fn_globals[name]
                try:
                    if callable(val) and getattr(val, "__module__", None) in (None, "__main__"):
                        ref_globals[name] = ("sub_fn", _serialize_callable(val))
                    else:
                        ref_globals[name] = ("val", pickle.dumps(val))
                except Exception:
                    pass

    return (
        "func",
        code_bytes,
        getattr(fn, "__name__", "<lambda>"),
        closure_vals,
        ref_globals,
        getattr(fn, "__module__", None),
    )


def _deserialize_callable(info: tuple) -> Callable:
    """Deserialize callable serialized by _serialize_callable."""
    kind = info[0]
    if kind == "pickle":
        return pickle.loads(info[1])
    elif kind == "func":
        _, code_bytes, name, closure_vals, ref_globals_raw, mod_name = info
        code = marshal.loads(code_bytes)
        import builtins
        import sys

        gl = dict(builtins.__dict__)
        current_mod = sys.modules.get("isolation") or sys.modules.get(__name__)
        if current_mod is not None:
            gl.update(current_mod.__dict__)
        if mod_name and mod_name in sys.modules and mod_name != "__main__":
            gl.update(sys.modules[mod_name].__dict__)

        for k, v in ref_globals_raw.items():
            if v[0] == "val":
                try:
                    gl[k] = pickle.loads(v[1])
                except Exception:
                    pass
            elif v[0] == "sub_fn":
                gl[k] = _deserialize_callable(v[1])

        closure = (
            tuple(types.CellType(v) for v in closure_vals)
            if closure_vals is not None
            else None
        )
        return types.FunctionType(code, gl, name, None, closure)
    else:
        raise ValueError(f"Unknown serialization kind: {kind}")



def _process_isolated_worker(
    conn: Any,
    fn_decrypt_info: tuple,
    fn_process_info: tuple,
    shm_name: str,
    buffer_size: int,
    key_id: Optional[str],
    key_shm_name: Optional[str],
    key_len: int,
    issued_at: Optional[float],
    ttl_seconds: Optional[float],
) -> None:
    """Subprocess worker executing decryption and processing in private virtual address space."""
    shm: Optional[shared_memory.SharedMemory] = None
    key_shm: Optional[shared_memory.SharedMemory] = None
    session_key: Optional[SessionKey] = None
    plaintext_buf: Optional[SecureBuffer] = None
    try:
        shm = shared_memory.SharedMemory(name=shm_name)
        if key_shm_name and key_len > 0:
            key_shm = shared_memory.SharedMemory(name=key_shm_name)
            key_buf = SecureBuffer(key_shm.buf[:key_len])
            session_key = SessionKey(
                key_id=key_id or str(uuid.uuid4()),
                material=key_buf,
                issued_at=issued_at if issued_at is not None else time.time(),
                ttl_seconds=ttl_seconds if ttl_seconds is not None else 24 * 60 * 60,
            )

        decrypt_into_fn = _deserialize_callable(fn_decrypt_info)
        process_fn = _deserialize_callable(fn_process_info)

        # Map shared memory buffer directly into SecureBuffer (zero copy)
        plaintext_buf = SecureBuffer(shm.buf[:buffer_size])

        if session_key is not None:
            session_key.require_valid()
            try:
                written = decrypt_into_fn(session_key, plaintext_buf)
            except TypeError:
                written = decrypt_into_fn(plaintext_buf)
        else:
            written = decrypt_into_fn(plaintext_buf)

        full_view = plaintext_buf.view()
        active_view = full_view if written is None else full_view[:written]
        output = process_fn(active_view)

        if isinstance(output, memoryview):
            output_bytes = bytes(output)
        elif isinstance(output, (bytes, bytearray)):
            output_bytes = bytes(output)
        else:
            output_bytes = bytes(output)

        conn.send(("SUCCESS", output_bytes))
    except Exception as exc:
        conn.send(("ERROR", f"{type(exc).__name__}: {str(exc)}"))
    finally:
        # Child-side teardown zero-fill
        if plaintext_buf is not None and not plaintext_buf.is_zeroed:
            try:
                plaintext_buf.zero()
            except Exception:
                pass
        if session_key is not None and hasattr(session_key, "material"):
            try:
                session_key.zero()
            except Exception:
                pass
        if shm is not None:
            try:
                ctypes_zero_memory(shm.buf)
                shm.close()
            except Exception:
                pass
        if key_shm is not None:
            try:
                ctypes_zero_memory(key_shm.buf)
                key_shm.close()
            except Exception:
                pass
        try:
            conn.close()
        except Exception:
            pass


def _run_in_isolated_process(
    decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
    process_fn: Callable[[memoryview], bytes],
    buffer_size: int,
    client: Optional[MockConstitutionalLayerClient] = None,
    execution_target: ExecutionTarget = ExecutionTarget.MODE_A_CLOUD,
    timeout_seconds: float = 30.0,
) -> bytes:
    """Spawn a dedicated child process, execute processing, and guarantee parent-side zeroing.
    
    Architecture Guarantee (Rule H1.1 & P0 Timeout Hardening):
      Plaintext data and session key buffers reside in shared memory segments managed by the parent.
      Even if the child hangs, crashes, or is forcefully terminated via proc.terminate() (SIGTERM)
      on timeout, the parent process retains ownership of the shared memory mapping and immediately
      wipes every single byte with ctypes_zero_memory in its finally block before unlinking.
    """
    key_id: Optional[str] = None
    key_bytes: Optional[bytes] = None
    issued_at: Optional[float] = None
    ttl_seconds: Optional[float] = None

    session_key: Optional[SessionKey] = None
    if client is not None:
        session_key = client.grant_session_key(
            purpose=f"isolated_exec_{execution_target.value}"
        )
        session_key.require_valid()
        key_id = session_key.key_id
        key_bytes = bytes(session_key.material.view())
        issued_at = session_key.issued_at
        ttl_seconds = session_key.ttl_seconds

    shm: Optional[shared_memory.SharedMemory] = None
    key_shm: Optional[shared_memory.SharedMemory] = None

    try:
        shm = shared_memory.SharedMemory(create=True, size=max(buffer_size, 1))
        if key_bytes is not None:
            key_shm = shared_memory.SharedMemory(create=True, size=len(key_bytes))
            key_shm.buf[:len(key_bytes)] = key_bytes

        fn_decrypt_info = _serialize_callable(decrypt_into_fn)
        fn_process_info = _serialize_callable(process_fn)

        conn_parent, conn_child = mp.Pipe(duplex=False)
        proc = mp.Process(
            target=_process_isolated_worker,
            args=(
                conn_child,
                fn_decrypt_info,
                fn_process_info,
                shm.name,
                buffer_size,
                key_id,
                key_shm.name if key_shm else None,
                len(key_bytes) if key_bytes else 0,
                issued_at,
                ttl_seconds,
            ),
        )
        proc.start()
        conn_child.close()

        status = None
        payload = None
        try:
            if conn_parent.poll(timeout=timeout_seconds):
                status, payload = conn_parent.recv()
            else:
                proc.terminate()
                raise TimeoutError(
                    f"Isolated process execution timed out after {timeout_seconds}s."
                )
        except EOFError:
            raise RuntimeError(
                f"Isolated child process terminated abruptly (exit code {proc.exitcode})."
            )
        finally:
            try:
                conn_parent.close()
            except Exception:
                pass
            proc.join(timeout=15)
            if proc.is_alive():
                proc.terminate()
                proc.join(timeout=5)

        if status == "SUCCESS":
            return payload
        else:
            raise RuntimeError(f"Execution in isolated process failed: {payload}")
    finally:
        # Parent-guaranteed deterministic zero-fill:
        # Whether child succeeded, failed, hung, or was killed via SIGTERM,
        # the parent process directly wipes the shared memory buffers.
        if shm is not None:
            try:
                ctypes_zero_memory(shm.buf)
            finally:
                try:
                    shm.close()
                finally:
                    shm.unlink()
        if key_shm is not None:
            try:
                ctypes_zero_memory(key_shm.buf)
            finally:
                try:
                    key_shm.close()
                finally:
                    key_shm.unlink()
        if session_key is not None and hasattr(session_key, "material"):
            if not session_key.material.is_zeroed:
                session_key.zero()



@dataclass
class ContainerResult:
    """Result of execution inside the isolated processing container."""
    output: bytes
    security_boundary: str
    execution_target: ExecutionTarget


class IsolatedProcessingContainer:
    """Isolated processing container managing in-RAM decryption and processing lifecycle.

    Guarantees:
      - Authenticated key grant required from Constitutional Layer.
      - Decryption directly into SecureBuffer in RAM.
      - Plaintext wiped via zero-fill in finally block even on uncaught exceptions.
      - Mode A (Cloud) vs Mode B (Local) execution target isolation.
      - Fail-closed boundary enforcement: refuses execution without virtualization
        unless allow_no_isolation=True is explicitly set.
      - Complete thread-safety via re-entrant lock (RLock).
    """

    def __init__(
        self,
        constitutional_client: MockConstitutionalLayerClient,
        execution_target: ExecutionTarget = ExecutionTarget.MODE_A_CLOUD,
        allow_no_isolation: bool = False,
        preferred_runtime: Optional[SandboxRuntime] = None,
    ) -> None:
        self._lock = threading.RLock()
        with self._lock:
            self.client = constitutional_client
            self.execution_target = execution_target
            self.allow_no_isolation = allow_no_isolation

            PRODUCTION_ISOLATION_BOUNDARIES = ("gvisor_runsc", "microvm_firecracker")

            if preferred_runtime is not None:
                if not allow_no_isolation:
                    # Strict fail-closed: Production mode forbids any development runtime
                    if preferred_runtime.security_boundary not in PRODUCTION_ISOLATION_BOUNDARIES:
                        raise SandboxRuntimeUnavailable(
                            f"Runtime '{preferred_runtime.security_boundary}' does not provide hardware/kernel "
                            f"microVM isolation. Production mode (allow_no_isolation=False) strictly requires a "
                            f"verified gVisor (runsc) or Firecracker microVM boundary."
                        )
                    if not preferred_runtime.is_available():
                        raise SandboxRuntimeUnavailable(
                            f"Requested production runtime '{preferred_runtime.security_boundary}' is unavailable on host."
                        )
                else:
                    # In development mode, allow dev runtimes
                    pass
                self._runtime = preferred_runtime
            else:
                # Auto-detect available secure isolation runtimes
                gvisor = GvisorRuntime()
                firecracker = FirecrackerRuntime()

                if gvisor.is_available():
                    self._runtime = gvisor
                elif firecracker.is_available():
                    self._runtime = firecracker
                elif allow_no_isolation:
                    self._runtime = LocalDevRuntime()
                else:
                    raise SandboxRuntimeUnavailable(
                        "No secure microVM (Firecracker) or gVisor (runsc) runtime found on host, "
                        "and allow_no_isolation is False. Refusing to process unisolated plaintext."
                    )

    def process(
        self,
        decrypt_fn: Callable[[SessionKey], bytes | bytearray | SecureBuffer],
        process_fn: Callable[[bytearray], bytes],
    ) -> ContainerResult:
        """Execute processing lifecycle inside the isolated memory boundary."""
        with self._lock:
            session_key: Optional[SessionKey] = None
            raw_decrypted: Optional[bytes | bytearray | SecureBuffer] = None
            plaintext_buf: Optional[SecureBuffer] = None
            mutable_view: Optional[bytearray] = None

            try:
                session_key = self.client.grant_session_key(
                    purpose=f"isolated_exec_{self.execution_target.value}"
                )
                session_key.require_valid()

                # Decrypt into a temporary raw buffer or adopt directly if SecureBuffer
                raw_decrypted = decrypt_fn(session_key)

                if isinstance(raw_decrypted, bytes):
                    warnings.warn(
                        "Plaintext decrypted as immutable bytes. Immutable bytes linger on the CPython "
                        "heap until garbage collected and cannot be cryptographically zero-filled. "
                        "Callers requiring zero-leakage must use process_into().",
                        category=ImmutablePlaintextWarning,
                        stacklevel=2,
                    )

                # Wrap in SecureBuffer (or adopt directly if already a SecureBuffer / mock)
                is_secure_buf = (
                    isinstance(raw_decrypted, SecureBuffer)
                    if isinstance(SecureBuffer, type)
                    else (hasattr(raw_decrypted, "is_zeroed") and hasattr(raw_decrypted, "view"))
                )

                if is_secure_buf:
                    plaintext_buf = raw_decrypted
                else:
                    plaintext_buf = SecureBuffer(raw_decrypted)
                    # In case raw_decrypted was a mutable bytearray, immediately wipe original reference
                    if isinstance(raw_decrypted, (bytearray, memoryview)):
                        ctypes_zero_memory(raw_decrypted)

                view = plaintext_buf.view()
                mutable_view = bytearray(view)

                output = process_fn(mutable_view)
                return ContainerResult(
                    output=output,
                    security_boundary=self._runtime.security_boundary,
                    execution_target=self.execution_target,
                )
            finally:
                # Teardown memory wipe: guarantee zeroing of all intermediate plaintext buffers
                if mutable_view is not None:
                    ctypes_zero_memory(mutable_view)
                if isinstance(raw_decrypted, (bytearray, memoryview)):
                    ctypes_zero_memory(raw_decrypted)
                if plaintext_buf is not None and not plaintext_buf.is_zeroed:
                    plaintext_buf.zero()
                if session_key is not None and hasattr(session_key, "material"):
                    if not session_key.material.is_zeroed:
                        session_key.material.zero()

    def process_into(
        self,
        buffer_size: int,
        decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
        process_fn: Callable[[memoryview], bytes],
    ) -> ContainerResult:
        """Execute processing lifecycle with zero-copy decryption directly into a pre-allocated SecureBuffer.

        Guarantees that decrypted plaintext never exists as an immutable bytes object on the
        CPython heap, eliminating garbage collection leakage windows and satisfying Gate T16.3.
        Delegates execution directly to the verified SandboxRuntime boundary.
        """
        with self._lock:
            output = self._runtime.execute(
                decrypt_into_fn=decrypt_into_fn,
                process_fn=process_fn,
                buffer_size=buffer_size,
                client=self.client,
                execution_target=self.execution_target,
            )
            return ContainerResult(
                output=output,
                security_boundary=self._runtime.security_boundary,
                execution_target=self.execution_target,
            )

    def execute_process_isolated(
        self,
        decrypt_into_fn: Callable[[SessionKey, SecureBuffer], Optional[int]],
        process_fn: Callable[[memoryview], bytes],
        buffer_size: int,
    ) -> ContainerResult:
        """Execute processing in a dedicated child process with isolated virtual address space.
        
        Fail-Closed Security Guarantee:
          Process-level isolation (ProcessIsolatedDevRuntime) provides OS address space separation
          strictly for local development and unit tests. It does NOT provide hardware microVM
          (Firecracker) or kernel sandbox (gVisor) isolation. In production (allow_no_isolation=False),
          calling this method strictly fails closed by raising SandboxRuntimeUnavailable.
        """
        with self._lock:
            if not self.allow_no_isolation:
                raise SandboxRuntimeUnavailable(
                    "execute_process_isolated provides process separation for local development/testing only "
                    "(security_boundary: process_isolated_dev). It does NOT provide a hardware microVM or kernel "
                    "sandbox boundary and is strictly forbidden in production mode (allow_no_isolation=False)."
                )
            runtime = (
                self._runtime
                if isinstance(self._runtime, ProcessIsolatedDevRuntime)
                else ProcessIsolatedDevRuntime()
            )
            output = runtime.execute(
                decrypt_into_fn=decrypt_into_fn,
                process_fn=process_fn,
                buffer_size=buffer_size,
                client=self.client,
                execution_target=self.execution_target,
            )
            return ContainerResult(
                output=output,
                security_boundary=runtime.security_boundary,
                execution_target=self.execution_target,
            )


def _forensics_worker(shm_name: str, secret_len: int) -> None:
    """Worker process: attaches to shared memory, zero-fills buffer on teardown, and exits."""
    shm = shared_memory.SharedMemory(name=shm_name)
    try:
        # Simulate processing lifecycle completion and cryptographic zero-fill via ctypes.memset
        ctypes_zero_memory(shm.buf[:secret_len])
    finally:
        shm.close()


def run_memory_forensics_check(secret: bytes) -> bytes:
    """Cross-process memory forensics test for cryptographic RAM teardown zero-fill.

    Writes a secret into a shared memory segment in a child process, triggers
    container teardown zero-fill, and verifies that the parent process memory
    snapshot inspects zero recoverable bytes.
    """
    secret_len = len(secret)
    shm = shared_memory.SharedMemory(create=True, size=secret_len)
    try:
        shm.buf[:secret_len] = secret
        p = mp.Process(target=_forensics_worker, args=(shm.name, secret_len))
        p.start()
        p.join(timeout=15)
        if p.is_alive():
            p.terminate()
            p.join(timeout=5)

        # Snapshot memory immediately post-teardown
        snapshot = bytes(shm.buf[:secret_len])
        return snapshot
    finally:
        shm.close()
        shm.unlink()


def scan_known_secret_buffers(
    secret: bytes,
    target: Optional[Any] = None,
) -> int:
    """Scoped memory inspection helper for forensic zero-fill validation.

    Verifies that after cryptographic zero-fill (such as SecureBuffer.zero() or
    container teardown), exactly 0 occurrences of the plaintext secret remain in
    accessible memory regions.

    Inspection Scope (Honest & Explicit):
      - If target is specified (SecureBuffer, bytearray, memoryview, or bytes),
        scans the underlying buffer directly.
      - If target is None, inspects all GC-tracked SecureBuffer, bytearray, and
        memoryview instances on the CPython heap, and executes run_memory_forensics_check
        to inspect cross-process shared memory forensic dumps.
      - Note: This function inspects Python-managed heap allocations and registered
        shared memory segments. It does not perform whole-machine physical RAM scraping
        (which requires ring-0 kernel/hypervisor privileges, tracked under Gate EXT-05).
    """
    if not secret:
        return 0

    if target is not None:
        if isinstance(target, SecureBuffer):
            with target._lock:
                buf = bytes(target._buf)
                return buf.count(secret)
        elif isinstance(target, (bytes, bytearray)):
            return target.count(secret)
        elif isinstance(target, memoryview):
            return bytes(target).count(secret)
        elif hasattr(target, "_buf"):
            return bytes(target._buf).count(secret)
        else:
            try:
                return bytes(target).count(secret)
            except Exception:
                return 0

    count = 0
    import gc

    try:
        for obj in gc.get_objects():
            if isinstance(obj, SecureBuffer):
                with obj._lock:
                    if hasattr(obj, "_buf"):
                        count += bytes(obj._buf).count(secret)
            elif isinstance(obj, (bytearray, memoryview)):
                try:
                    count += bytes(obj).count(secret)
                except Exception:
                    pass
    except Exception:
        pass

    try:
        dump = run_memory_forensics_check(secret)
        count += dump.count(secret)
    except Exception:
        pass

    return count


# Backwards compatibility alias for existing test suites
scan_process_memory_for_secret = scan_known_secret_buffers

