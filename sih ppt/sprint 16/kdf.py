"""kdf.py — Argon2id Vault Master Key Derivation and PHC Verification.

Implements Gate T16.4 per Chronis Bible Parts 5.25, 7.1, and
AI_ML_SPRINT_PLAN_v2 Sprint 16 Day 46.

Resolves Part 7.1 KDF choice to Argon2id (closing the PBKDF2 vs Argon2 open item).
Parameters are specified per RFC 9106 §4 recommended defaults for memory-hard,
side-channel-resistant key derivation from passphrases:
  - Algorithm: Argon2id (version 19 / 0x13)
  - Memory cost: 65,536 KiB (64 MiB)
  - Iterations (time cost): 3 passes
  - Parallelism: 4 lanes
  - Salt length: 16 bytes minimum (random per-vault salt)
  - Key length: 32 bytes (256 bits for AES-256-GCM vault master key)

Hardened Cryptographic Guarantees:
  1. RFC 9106 §5.3 Known-Answer Test (KAT) validation runs fail-closed before any derivation.
  2. In-place memory zeroization of all transient passphrase bytes, derived tags, and keys.
  3. Constant-time digest comparison (hmac.compare_digest) preventing side-channel timing attacks.
  4. Strict parameter bounds checking (RFC 9106 §3.1 memory >= 8*p KiB, t >= 1, p >= 1).
  5. Deterministic derivation and fail-closed security (no silent fallbacks).
"""

from __future__ import annotations

import base64
import ctypes
import hmac
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Union

from cryptography.hazmat.primitives.kdf.argon2 import Argon2id

from isolation import SecureBuffer


# RFC 9106 §5.3 Official Argon2id Test Vector (v=19 / 0x13)
RFC9106_KAT_SECTION_5_3 = {
    "memory_cost": 32,      # 32 KiB
    "time_cost": 3,         # 3 passes
    "parallelism": 4,       # 4 lanes
    "tag_len": 32,          # 32 bytes
    "password": bytes([0x01] * 32),
    "salt": bytes([0x02] * 16),
    "secret": bytes([0x03] * 8),
    "ad": bytes([0x04] * 12),
    "expected_tag": bytes.fromhex(
        "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659"
    ),
}

# RFC 9106 / PHC Standard KDF Vector without Secret or Associated Data
RFC9106_KAT_STANDARD_KDF = {
    "memory_cost": 256,     # 256 KiB
    "time_cost": 2,         # 2 passes
    "parallelism": 2,       # 2 lanes
    "tag_len": 32,          # 32 bytes
    "password": b"password",
    "salt": b"somesalt",
    "expected_tag": bytes.fromhex(
        "6d093c501fd5999645e0ea3bf620d7b8be7fd2db59c20d9fff9539da2bf57037"
    ),
}

_KAT_SELF_TEST_PASSED: bool = False


def zeroize_bytes(buf: Union[bytearray, memoryview, bytes, SecureBuffer, None]) -> None:
    """Explicitly zero out sensitive cryptographic material in memory.

    Overwrites mutable buffers (bytearray, memoryview, SecureBuffer) in-place.
    For non-singleton CPython bytes objects, applies in-place memory wipe via ctypes memset.
    """
    if buf is None:
        return
    if isinstance(buf, SecureBuffer):
        buf.zero()
    elif isinstance(buf, (bytearray, memoryview)):
        for i in range(len(buf)):
            buf[i] = 0
    elif isinstance(buf, bytes):
        # Best-effort memory wiping for CPython bytes objects.
        # Skip empty and single-byte singleton interned objects to protect runtime integrity.
        if len(buf) > 1:
            try:
                offset = ctypes.sizeof(ctypes.c_size_t) * 4
                ctypes.memset(id(buf) + offset, 0, len(buf))
            except Exception:
                pass


def validate_rfc9106_test_vectors() -> bool:
    """Validate the Argon2id engine against official RFC 9106 Known-Answer Tests (KATs).

    Tests:
      1. RFC 9106 §5.3 official test vector with secret and associated data (AD).
      2. Standard RFC 9106 KDF vector without secret/AD.

    Both tests verify exact bit-for-bit output using constant-time comparison
    (hmac.compare_digest) and fail closed by raising RuntimeError on mismatch.
    """
    # 1. RFC 9106 §5.3 normative test vector
    vec1 = RFC9106_KAT_SECTION_5_3
    kdf1 = Argon2id(
        salt=vec1["salt"],
        length=vec1["tag_len"],
        iterations=vec1["time_cost"],
        lanes=vec1["parallelism"],
        memory_cost=vec1["memory_cost"],
        ad=vec1["ad"],
        secret=vec1["secret"],
    )
    derived1 = kdf1.derive(vec1["password"])
    if not hmac.compare_digest(derived1, vec1["expected_tag"]):
        raise RuntimeError(
            "RFC 9106 §5.3 official KAT vector mismatch! "
            "Argon2id implementation integrity check failed."
        )

    # 2. Standard KDF vector without secret/AD
    vec2 = RFC9106_KAT_STANDARD_KDF
    kdf2 = Argon2id(
        salt=vec2["salt"],
        length=vec2["tag_len"],
        iterations=vec2["time_cost"],
        lanes=vec2["parallelism"],
        memory_cost=vec2["memory_cost"],
        ad=None,
        secret=None,
    )
    derived2 = kdf2.derive(vec2["password"])
    if not hmac.compare_digest(derived2, vec2["expected_tag"]):
        raise RuntimeError(
            "RFC 9106 standard KDF KAT vector mismatch! "
            "Argon2id implementation integrity check failed."
        )

    return True


def ensure_rfc9106_validated() -> None:
    """Ensure RFC 9106 official test vectors have been validated at least once (fail-closed guard)."""
    global _KAT_SELF_TEST_PASSED
    if not _KAT_SELF_TEST_PASSED:
        validate_rfc9106_test_vectors()
        _KAT_SELF_TEST_PASSED = True


@dataclass(frozen=True)
class Argon2Params:
    """Argon2id cryptographic parameter configuration with explicit RFC 9106 rationale."""
    memory_cost: int = 65536      # 64 MiB in KiB
    time_cost: int = 3            # 3 iterations
    parallelism: int = 4          # 4 threads / lanes
    salt_len: int = 16            # 16 bytes salt
    key_len: int = 32             # 32 bytes (256-bit AES key)
    rationale: str = (
        "RFC 9106 §4 recommended parameters for memory-hard KDF resisting GPU/ASIC "
        "brute-force attacks against long-lived vault recovery passphrases: "
        "m=64MiB (65536 KiB), t=3, p=4, tag=32B, salt=16B."
    )

    def __post_init__(self) -> None:
        if self.parallelism < 1 or self.parallelism > 0xFFFFFF:
            raise ValueError(
                f"Parallelism (lanes) must be between 1 and 2^24 - 1, got {self.parallelism}"
            )
        if self.memory_cost < 8 * self.parallelism:
            raise ValueError(
                f"Memory cost ({self.memory_cost} KiB) must be at least 8 * parallelism "
                f"({8 * self.parallelism} KiB) per RFC 9106 §3.1"
            )
        if self.time_cost < 1:
            raise ValueError(f"Time cost (iterations) must be at least 1, got {self.time_cost}")
        if self.salt_len < 16:
            raise ValueError(f"Salt length must be at least 16 bytes per RFC 9106 §4 (got {self.salt_len})")
        if self.key_len < 16:
            raise ValueError(f"Derived key length must be at least 16 bytes (got {self.key_len})")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "algorithm": "Argon2id",
            "version": 19,
            "memory_cost_kib": self.memory_cost,
            "time_cost_iterations": self.time_cost,
            "parallelism_lanes": self.parallelism,
            "salt_len_bytes": self.salt_len,
            "key_len_bytes": self.key_len,
            "rationale": self.rationale,
        }


DEFAULT_PARAMS = Argon2Params()


def _b64encode_nopad(data: Union[bytes, bytearray, memoryview]) -> str:
    """Standard base64 encoding without '=' padding as used in Argon2 PHC format."""
    return base64.b64encode(data).decode("ascii").rstrip("=")


def _b64decode_nopad(data: str) -> bytes:
    """Decode base64 string without '=' padding with strict validation."""
    pad_len = (4 - (len(data) % 4)) % 4
    try:
        return base64.b64decode(data + ("=" * pad_len), validate=True)
    except Exception as exc:
        raise ValueError(f"Invalid base64 payload in PHC string: {exc}") from exc


class VaultKeyDerivation:
    """Argon2id Key Derivation Function engine for vault master key derivation."""

    def __init__(self, params: Optional[Argon2Params] = None) -> None:
        self.params = params or DEFAULT_PARAMS
        if self.params.salt_len < 16:
            raise ValueError(f"Salt length must be at least 16 bytes (got {self.params.salt_len})")
        if self.params.key_len < 16:
            raise ValueError(f"Derived key length must be at least 16 bytes (got {self.params.key_len})")
        if self.params.memory_cost < 8 * self.params.parallelism:
            raise ValueError(
                f"Memory cost ({self.params.memory_cost} KiB) must be at least 8 * parallelism "
                f"({8 * self.params.parallelism} KiB) per RFC 9106 §3.1"
            )
        if self.params.time_cost < 1:
            raise ValueError(f"Time cost (iterations) must be at least 1, got {self.params.time_cost}")
        if self.params.parallelism < 1:
            raise ValueError(f"Parallelism must be at least 1, got {self.params.parallelism}")

        # Enforce RFC 9106 test vector self-test validation on initialization (fail-closed)
        ensure_rfc9106_validated()

    @staticmethod
    def validate_test_vectors() -> bool:
        """Expose RFC 9106 test vector validation as an engine method."""
        return validate_rfc9106_test_vectors()

    def generate_salt(self) -> bytes:
        """Generate a cryptographically secure random salt of configured length."""
        return os.urandom(self.params.salt_len)

    def derive_key(
        self,
        passphrase: Union[str, bytes, bytearray, SecureBuffer],
        salt: bytes,
        as_secure_buffer: bool = True,
    ) -> Union[SecureBuffer, bytes]:
        """Derive 256-bit vault master key from passphrase and salt deterministically.

        Ensures in-place zeroization of intermediate passphrase byte buffers
        and temporary key buffers post-derivation.
        """
        if not isinstance(salt, (bytes, bytearray, memoryview)):
            raise TypeError("Salt must be bytes-like")
        if len(salt) < 16:
            raise ValueError(
                f"Salt length must be at least 16 bytes per RFC 9106, got {len(salt)} bytes."
            )

        passphrase_buf: Optional[bytearray] = None
        temp_encoded: Optional[bytes] = None

        try:
            if isinstance(passphrase, SecureBuffer):
                raw_input: Union[bytearray, memoryview] = passphrase.view()
            elif isinstance(passphrase, bytearray):
                passphrase_buf = bytearray(passphrase)
                raw_input = passphrase_buf
            elif isinstance(passphrase, memoryview):
                passphrase_buf = bytearray(passphrase)
                raw_input = passphrase_buf
            elif isinstance(passphrase, str):
                temp_encoded = passphrase.encode("utf-8")
                passphrase_buf = bytearray(temp_encoded)
                raw_input = passphrase_buf
            elif isinstance(passphrase, bytes):
                passphrase_buf = bytearray(passphrase)
                raw_input = passphrase_buf
            else:
                raise TypeError(f"Unsupported passphrase type: {type(passphrase)}")

            kdf = Argon2id(
                salt=bytes(salt) if not isinstance(salt, bytes) else salt,
                length=self.params.key_len,
                iterations=self.params.time_cost,
                lanes=self.params.parallelism,
                memory_cost=self.params.memory_cost,
                ad=None,
                secret=None,
            )

            raw_key = kdf.derive(raw_input)
            if as_secure_buffer:
                buf = SecureBuffer(raw_key)
                zeroize_bytes(raw_key)
                return buf
            return raw_key
        finally:
            if passphrase_buf is not None:
                zeroize_bytes(passphrase_buf)
            if temp_encoded is not None:
                zeroize_bytes(temp_encoded)

    def derive_phc(
        self,
        passphrase: Union[str, bytes, bytearray, SecureBuffer],
        salt: Optional[bytes] = None,
    ) -> str:
        """Derive a standard PHC-formatted string for password verification."""
        if salt is None:
            salt = self.generate_salt()
        elif len(salt) < 16:
            raise ValueError(f"Salt length must be at least 16 bytes, got {len(salt)}")

        key_buf = self.derive_key(passphrase, salt, as_secure_buffer=True)
        assert isinstance(key_buf, SecureBuffer)
        tag_bytes: Optional[bytes] = None
        try:
            tag_bytes = bytes(key_buf.view())
            salt_b64 = _b64encode_nopad(salt)
            tag_b64 = _b64encode_nopad(tag_bytes)

            return (
                f"$argon2id$v=19$m={self.params.memory_cost},t={self.params.time_cost},"
                f"p={self.params.parallelism}${salt_b64}${tag_b64}"
            )
        finally:
            key_buf.zero()
            if tag_bytes is not None:
                zeroize_bytes(tag_bytes)

    def verify_phc(
        self,
        passphrase: Union[str, bytes, bytearray, SecureBuffer],
        phc_string: str,
    ) -> bool:
        """Verify passphrase against a standard PHC-formatted Argon2id hash string.

        Uses constant-time comparison (hmac.compare_digest) and zeroizes all
        intermediate tags and passphrase buffers on completion.
        """
        pattern = r"^\$argon2id\$v=(\d+)\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$"
        match = re.match(pattern, phc_string.strip())
        if not match:
            raise ValueError("Invalid PHC Argon2id string format.")

        version, m, t, p, salt_b64, tag_b64 = match.groups()
        if int(version) != 19:
            raise ValueError(f"Unsupported Argon2id version: {version}")

        memory_cost = int(m)
        time_cost = int(t)
        parallelism = int(p)

        if parallelism < 1 or parallelism > 0xFFFFFF:
            raise ValueError(f"Invalid parallelism lanes in PHC string: {parallelism}")
        if memory_cost < 8 * parallelism:
            raise ValueError(
                f"Invalid memory cost ({memory_cost} KiB) in PHC string: "
                f"must be >= 8 * parallelism ({8 * parallelism} KiB) per RFC 9106 §3.1"
            )
        if time_cost < 1:
            raise ValueError(f"Invalid time cost (iterations) in PHC string: {time_cost}")

        salt = _b64decode_nopad(salt_b64)
        if len(salt) < 16:
            raise ValueError(f"Salt length in PHC string must be at least 16 bytes, got {len(salt)}")

        expected_tag = bytearray(_b64decode_nopad(tag_b64))
        if len(expected_tag) < 16:
            zeroize_bytes(expected_tag)
            raise ValueError(f"Tag length in PHC string must be at least 16 bytes, got {len(expected_tag)}")

        passphrase_buf: Optional[bytearray] = None
        temp_encoded: Optional[bytes] = None
        derived_tag: Optional[bytearray] = None

        try:
            if isinstance(passphrase, SecureBuffer):
                raw_input: Union[bytearray, memoryview] = passphrase.view()
            elif isinstance(passphrase, bytearray):
                passphrase_buf = bytearray(passphrase)
                raw_input = passphrase_buf
            elif isinstance(passphrase, memoryview):
                passphrase_buf = bytearray(passphrase)
                raw_input = passphrase_buf
            elif isinstance(passphrase, str):
                temp_encoded = passphrase.encode("utf-8")
                passphrase_buf = bytearray(temp_encoded)
                raw_input = passphrase_buf
            elif isinstance(passphrase, bytes):
                passphrase_buf = bytearray(passphrase)
                raw_input = passphrase_buf
            else:
                raise TypeError(f"Unsupported passphrase type: {type(passphrase)}")

            kdf = Argon2id(
                salt=salt,
                length=len(expected_tag),
                iterations=time_cost,
                lanes=parallelism,
                memory_cost=memory_cost,
                ad=None,
                secret=None,
            )

            raw_derived = kdf.derive(raw_input)
            derived_tag = bytearray(raw_derived)
            zeroize_bytes(raw_derived)

            # Constant-time comparison to prevent side-channel timing leaks
            return hmac.compare_digest(derived_tag, expected_tag)
        except Exception:
            return False
        finally:
            if derived_tag is not None:
                zeroize_bytes(derived_tag)
            zeroize_bytes(expected_tag)
            if passphrase_buf is not None:
                zeroize_bytes(passphrase_buf)
            if temp_encoded is not None:
                zeroize_bytes(temp_encoded)

    def log_parameters(self) -> Dict[str, Any]:
        """Produce machine-readable configuration metadata for MLflow and audit logging."""
        return self.params.to_dict()
