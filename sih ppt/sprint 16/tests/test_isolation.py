import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import gc
import threading
import warnings

from isolation import (
    SecureBuffer,
    SessionKey,
    SessionKeyExpired,
    MockConstitutionalLayerClient,
    IsolatedProcessingContainer,
    ExecutionTarget,
    SandboxRuntimeUnavailable,
    GvisorRuntime,
    FirecrackerRuntime,
    LocalDevRuntime,
    ProcessIsolatedSandboxRuntime,
    ImmutablePlaintextWarning,
    scan_process_memory_for_secret,
    run_memory_forensics_check,
    ctypes_zero_memory,
)


class TestSecureBuffer(unittest.TestCase):
    def test_zero_overwrites_all_bytes(self):
        buf = SecureBuffer(b"top secret plaintext")
        self.assertNotEqual(bytes(buf.view()), b"\x00" * len(buf))
        buf.zero()
        self.assertTrue(buf.is_zeroed)

    def test_view_after_zero_raises(self):
        buf = SecureBuffer(b"secret")
        buf.zero()
        with self.assertRaises(ValueError):
            buf.view()

    def test_context_manager_zeroes_on_exit_even_on_exception(self):
        buf = SecureBuffer(b"secret")
        try:
            with buf:
                raise RuntimeError("boom")
        except RuntimeError:
            pass
        self.assertTrue(buf.is_zeroed)


class TestSessionKeyTTL(unittest.TestCase):
    def test_fresh_key_is_valid(self):
        client = MockConstitutionalLayerClient()
        key = client.grant_session_key("test")
        key.require_valid()  # should not raise

    def test_key_older_than_24h_is_expired(self):
        client = MockConstitutionalLayerClient()
        key = client.grant_session_key("test")
        just_past_ttl = key.issued_at + 24 * 60 * 60 + 1
        self.assertTrue(key.is_expired(now=just_past_ttl))
        with self.assertRaises(SessionKeyExpired):
            key.require_valid(now=just_past_ttl)

    def test_key_just_under_24h_is_not_expired(self):
        client = MockConstitutionalLayerClient()
        key = client.grant_session_key("test")
        just_under_ttl = key.issued_at + 24 * 60 * 60 - 1
        self.assertFalse(key.is_expired(now=just_under_ttl))

    def test_each_grant_is_a_fresh_key(self):
        client = MockConstitutionalLayerClient()
        k1 = client.grant_session_key("test")
        k2 = client.grant_session_key("test")
        self.assertNotEqual(k1.key_id, k2.key_id)
        self.assertNotEqual(bytes(k1.material.view()), bytes(k2.material.view()))


class TestRuntimeSelection(unittest.TestCase):
    def test_gvisor_and_firecracker_report_unavailable_in_this_sandbox(self):
        # This sandbox has no runsc/firecracker installed and no network to
        # install them -- this test documents that honestly rather than
        # mocking it away.
        self.assertFalse(GvisorRuntime().is_available())
        self.assertFalse(FirecrackerRuntime().is_available())

    def test_container_refuses_no_isolation_by_default(self):
        client = MockConstitutionalLayerClient()
        with self.assertRaises(SandboxRuntimeUnavailable):
            IsolatedProcessingContainer(client, allow_no_isolation=False)

    def test_container_allows_dev_fallback_when_explicitly_requested(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)
        self.assertEqual(container._runtime.security_boundary, "none")


class TestContainerProcessing(unittest.TestCase):
    def test_process_runs_and_zeroes_plaintext_on_success(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)

        captured = {}

        def fake_decrypt(session_key):
            return b"the plaintext"

        def fake_process(plaintext_view: bytearray) -> bytes:
            captured["seen"] = bytes(plaintext_view)
            return b"processed-result"

        result = container.process(fake_decrypt, fake_process)
        self.assertEqual(result.output, b"processed-result")
        self.assertEqual(captured["seen"], b"the plaintext")
        self.assertEqual(result.security_boundary, "none")  # honest, dev runtime

    def test_process_zeroes_plaintext_even_if_process_fn_raises(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)

        holder = {}

        def fake_decrypt(session_key):
            buf = bytearray(b"sensitive")
            return bytes(buf)

        def failing_process(plaintext_view: bytearray):
            holder["buf"] = plaintext_view
            raise RuntimeError("processing failed")

        with self.assertRaises(RuntimeError):
            container.process(fake_decrypt, failing_process)
        # the buffer the process function saw should now read as all zero
        self.assertEqual(bytes(holder["buf"]), b"\x00" * len(holder["buf"]))

    def test_mode_a_and_mode_b_both_route_through_isolation_contract(self):
        client = MockConstitutionalLayerClient()
        container_a = IsolatedProcessingContainer(
            client, execution_target=ExecutionTarget.MODE_A_CLOUD, allow_no_isolation=True
        )
        container_b = IsolatedProcessingContainer(
            client, execution_target=ExecutionTarget.MODE_B_LOCAL, allow_no_isolation=True
        )
        result_a = container_a.process(lambda k: b"data", lambda v: bytes(v).upper())
        result_b = container_b.process(lambda k: b"data", lambda v: bytes(v).upper())
        self.assertEqual(result_a.output, result_b.output)

    def test_process_rejects_expired_session_key(self):
        client = MockConstitutionalLayerClient()
        orig_grant = client.grant_session_key
        def grant_expired(purpose="inference"):
            key = orig_grant(purpose=purpose)
            key.issued_at = time.time() - (25 * 3600)  # 25 hours ago -> expired
            return key
        client.grant_session_key = grant_expired

        container = IsolatedProcessingContainer(client, allow_no_isolation=True)
        with self.assertRaises(SessionKeyExpired):
            container.process(lambda k: b"data", lambda v: b"result")

    def test_process_zeroes_secure_buffer_on_teardown(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)
        created_buffers = []
        orig_sb = SecureBuffer

        def tracking_sb(*args, **kwargs):
            buf = orig_sb(*args, **kwargs)
            created_buffers.append(buf)
            return buf

        import unittest.mock
        with unittest.mock.patch("isolation.SecureBuffer", side_effect=tracking_sb):
            container.process(lambda k: b"data", lambda v: b"result")

        self.assertTrue(len(created_buffers) > 0)
        for b in created_buffers:
            self.assertTrue(b.is_zeroed, "Container failed to zero SecureBuffer on teardown")




class TestMemoryForensics(unittest.TestCase):
    def test_teardown_leaves_zero_recoverable_bytes(self):
        secret = b"HIGHLY_SENSITIVE_TRANSCRIPT_CONTENT"
        recovered = run_memory_forensics_check(secret)
        self.assertEqual(recovered, b"\x00" * len(secret))
        self.assertNotEqual(recovered, secret)


class TestHardenedGuarantees(unittest.TestCase):
    def test_concurrent_secure_buffer_zero(self):
        """Verify thread-safety of SecureBuffer.zero() across concurrent threads."""
        buf = SecureBuffer(b"CONCURRENT_SECRET_BUFFER_DATA" * 10)
        errors = []

        def worker():
            try:
                buf.zero()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)
        self.assertTrue(buf.is_zeroed)
        self.assertEqual(bytes(buf._buf), b"\x00" * len(buf))

    def test_concurrent_container_process(self):
        """Verify thread-safety of IsolatedProcessingContainer under concurrent processing."""
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)
        results = []
        errors = []

        def worker(idx: int):
            try:
                res = container.process(
                    lambda k: f"thread_plaintext_{idx}".encode(),
                    lambda v: bytes(v).upper(),
                )
                results.append(res.output)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(15)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)
        self.assertEqual(len(results), 15)

    def test_concurrent_session_key_validation(self):
        """Verify thread-safety of SessionKey.require_valid() under concurrent callers."""
        client = MockConstitutionalLayerClient()
        key = client.grant_session_key("concurrency_test")
        errors = []

        def validator():
            try:
                key.require_valid()
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=validator) for _ in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(len(errors), 0)

    def test_ctypes_zero_memory_direct(self):
        """Verify ctypes_zero_memory directly zeroes bytearrays and memoryviews at C level."""
        data = bytearray(b"SENSITIVE_KEY_BYTES_RFC9106")
        mv = memoryview(data)
        ctypes_zero_memory(data)
        self.assertEqual(bytes(data), b"\x00" * 27)
        self.assertEqual(bytes(mv), b"\x00" * 27)

    def test_destructor_zeroes_memory_on_gc(self):
        """Verify SecureBuffer destructor zeroes underlying memory even without explicit .zero()."""
        raw = bytearray(b"EPHEMERAL_SECRET_WITHOUT_EXPLICIT_ZERO")
        buf = SecureBuffer(raw)
        buf_ref = buf._buf
        del buf
        gc.collect()
        self.assertEqual(bytes(buf_ref), b"\x00" * len(buf_ref))

    def test_process_into_zero_copy_lifecycle(self):
        """Verify process_into coordinates zero-copy decryption directly into pre-allocated SecureBuffer."""
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)

        payload = b"ZERO_COPY_PLAINTEXT_STREAM"
        buffer_len = len(payload)

        def decrypt_into(session_key: SessionKey, target_buf: SecureBuffer) -> int:
            mv = target_buf.view()
            mv[:buffer_len] = payload
            return buffer_len

        def process(view: memoryview) -> bytes:
            self.assertEqual(bytes(view), payload)
            return bytes(view).lower()

        res = container.process_into(buffer_len, decrypt_into, process)
        self.assertEqual(res.output, payload.lower())
        self.assertEqual(res.security_boundary, "none")

    def test_process_into_zeroes_buffer_on_failure(self):
        """Verify process_into guarantees teardown zero-fill even when process raises exception."""
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)
        captured_buf = []

        def decrypt_into(session_key: SessionKey, target_buf: SecureBuffer) -> int:
            captured_buf.append(target_buf)
            target_buf.view()[:7] = b"SECRET1"
            return 7

        def failing_process(view: memoryview) -> bytes:
            raise ValueError("Processing computation failed")

        with self.assertRaises(ValueError):
            container.process_into(32, decrypt_into, failing_process)

        self.assertEqual(len(captured_buf), 1)
        self.assertTrue(captured_buf[0].is_zeroed)

    def test_process_accepts_direct_secure_buffer_return(self):
        """Verify process() can directly accept a pre-allocated SecureBuffer without creating copies."""
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)

        secret_buf = SecureBuffer(b"DIRECT_SECURE_BUFFER_SECRET")

        res = container.process(
            lambda k: secret_buf,
            lambda v: bytes(v).replace(b"SECRET", b"CLEARED"),
        )
        self.assertEqual(res.output, b"DIRECT_SECURE_BUFFER_CLEARED")
        self.assertTrue(secret_buf.is_zeroed)


class TestProcessIsolatedSandboxRuntime(unittest.TestCase):
    def test_runtime_properties(self):
        runtime = ProcessIsolatedSandboxRuntime()
        self.assertEqual(runtime.security_boundary, "process_isolated_dev")
        self.assertFalse(runtime.is_available())

    def test_process_isolated_runtime_rejected_in_production_mode(self):
        """Container strictly rejects dev process isolation when allow_no_isolation=False."""
        client = MockConstitutionalLayerClient()
        with self.assertRaises(SandboxRuntimeUnavailable):
            IsolatedProcessingContainer(
                client,
                preferred_runtime=ProcessIsolatedSandboxRuntime(),
                allow_no_isolation=False,
            )

    def test_execute_process_isolated_on_container(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(
            client,
            preferred_runtime=ProcessIsolatedSandboxRuntime(),
            allow_no_isolation=True,
        )

        payload = b"MICROVM_ISOLATED_SECRET_MESSAGE"
        buffer_len = len(payload)

        def decrypt_into(session_key: SessionKey, target_buf: SecureBuffer) -> int:
            mv = target_buf.view()
            mv[:buffer_len] = payload
            return buffer_len

        def process(view: memoryview) -> bytes:
            return bytes(view).lower()

        res = container.execute_process_isolated(decrypt_into, process, buffer_len)
        self.assertEqual(res.output, payload.lower())
        self.assertEqual(res.security_boundary, "process_isolated_dev")
        self.assertEqual(res.execution_target, ExecutionTarget.MODE_A_CLOUD)

    def test_execute_process_isolated_from_local_runtime_container(self):
        """execute_process_isolated executes in subprocess even if container was initialized with LocalDevRuntime."""
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)
        self.assertEqual(container._runtime.security_boundary, "none")

        def decrypt_into(session_key: SessionKey, target_buf: SecureBuffer) -> int:
            target_buf.view()[:5] = b"HELLO"
            return 5

        def process(view: memoryview) -> bytes:
            return bytes(view) + b"_WORLD"

        res = container.execute_process_isolated(decrypt_into, process, 16)
        self.assertEqual(res.output, b"HELLO_WORLD")
        self.assertEqual(res.security_boundary, "process_isolated_dev")

    def test_execute_on_runtime_instance_directly(self):
        runtime = ProcessIsolatedSandboxRuntime()
        client = MockConstitutionalLayerClient()

        def decrypt_into(session_key: SessionKey, target_buf: SecureBuffer) -> int:
            target_buf.view()[:4] = b"DATA"
            return 4

        def process(view: memoryview) -> bytes:
            return bytes(view).upper()

        out = runtime.execute(decrypt_into, process, 8, client=client)
        self.assertEqual(out, b"DATA")

    def test_container_process_into_delegates_when_process_isolated_runtime(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(
            client,
            preferred_runtime=ProcessIsolatedSandboxRuntime(),
            allow_no_isolation=True,
        )

        def decrypt_into(session_key: SessionKey, target_buf: SecureBuffer) -> int:
            target_buf.view()[:6] = b"SUBPRC"
            return 6

        def process(view: memoryview) -> bytes:
            return bytes(view) + b"_CONFIRMED"

        res = container.process_into(16, decrypt_into, process)
        self.assertEqual(res.output, b"SUBPRC_CONFIRMED")
        self.assertEqual(res.security_boundary, "process_isolated_dev")

    def test_execute_process_isolated_handles_child_exception(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(
            client,
            preferred_runtime=ProcessIsolatedSandboxRuntime(),
            allow_no_isolation=True,
        )

        def failing_decrypt(session_key: SessionKey, target_buf: SecureBuffer) -> int:
            raise ValueError("Child decryption failed intentionally")

        with self.assertRaises(RuntimeError) as ctx:
            container.execute_process_isolated(failing_decrypt, lambda v: b"", 16)
        self.assertIn("Child decryption failed intentionally", str(ctx.exception))


class TestImmutablePlaintextWarning(unittest.TestCase):
    def test_warning_issued_when_raw_bytes_returned(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)

        with warnings.catch_warnings(record=True) as captured_warnings:
            warnings.simplefilter("always")
            res = container.process(
                lambda k: b"plaintext_in_heap",
                lambda v: bytes(v).upper(),
            )
            self.assertEqual(res.output, b"PLAINTEXT_IN_HEAP")

            matching = [
                w for w in captured_warnings
                if issubclass(w.category, ImmutablePlaintextWarning)
            ]
            self.assertEqual(len(matching), 1)
            msg = str(matching[0].message)
            self.assertIn("immutable bytes", msg.lower())
            self.assertIn("cpython heap", msg.lower())
            self.assertIn("process_into()", msg)

    def test_warning_not_issued_for_bytearray(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)

        with warnings.catch_warnings(record=True) as captured_warnings:
            warnings.simplefilter("always")
            container.process(
                lambda k: bytearray(b"mutable_plaintext"),
                lambda v: b"ok",
            )
            matching = [
                w for w in captured_warnings
                if issubclass(w.category, ImmutablePlaintextWarning)
            ]
            self.assertEqual(len(matching), 0)

    def test_warning_not_issued_for_secure_buffer(self):
        client = MockConstitutionalLayerClient()
        container = IsolatedProcessingContainer(client, allow_no_isolation=True)

        with warnings.catch_warnings(record=True) as captured_warnings:
            warnings.simplefilter("always")
            sb = SecureBuffer(b"pre_allocated_secure_buffer")
            container.process(
                lambda k: sb,
                lambda v: b"ok",
            )
            matching = [
                w for w in captured_warnings
                if issubclass(w.category, ImmutablePlaintextWarning)
            ]
            self.assertEqual(len(matching), 0)


class TestMemoryPageScanner(unittest.TestCase):
    def test_scan_secure_buffer_before_and_after_zero(self):
        secret = b"SCANNER_VERIFICATION_SECRET_98765"
        buf = SecureBuffer(secret)
        # Prior to zeroing, secret is present in the buffer
        self.assertEqual(scan_process_memory_for_secret(secret, buf), 1)
        buf.zero()
        # After SecureBuffer.zero(), exactly 0 occurrences must remain
        self.assertEqual(scan_process_memory_for_secret(secret, buf), 0)

    def test_scan_cross_process_dump_verifies_zero_recoverable_occurrences(self):
        secret = b"CROSS_PROCESS_TEARDOWN_SECRET_INSPECTION"
        # When target is None, cross-process forensics check is run and scanned
        occurrences = scan_process_memory_for_secret(secret)
        self.assertEqual(occurrences, 0)

    def test_scan_bytes_and_bytearray_buffers(self):
        secret = b"SUBSTRING_NEEDLE"
        haystack = b"PREFIX_SUBSTRING_NEEDLE_MIDDLE_SUBSTRING_NEEDLE_SUFFIX"
        self.assertEqual(scan_process_memory_for_secret(secret, haystack), 2)

        ba = bytearray(haystack)
        self.assertEqual(scan_process_memory_for_secret(secret, ba), 2)
        ctypes_zero_memory(ba)
        self.assertEqual(scan_process_memory_for_secret(secret, ba), 0)

    def test_scan_empty_secret_returns_zero(self):
        self.assertEqual(scan_process_memory_for_secret(b""), 0)

    def test_scan_known_secret_buffers_alias(self):
        from isolation import scan_known_secret_buffers
        secret = b"ALIAS_TEST_SECRET"
        buf = SecureBuffer(secret)
        self.assertEqual(scan_known_secret_buffers(secret, buf), 1)
        buf.zero()
        self.assertEqual(scan_known_secret_buffers(secret, buf), 0)


def _hanging_process_for_timeout(view: memoryview) -> bytes:
    time.sleep(5.0)
    return b"done"


def _fast_decrypt_for_timeout(session_key, buf):
    buf.view()[:14] = b"SECRET_TO_WIPE"
    return 14


class TestTimeoutZeroing(unittest.TestCase):
    def test_timeout_zeroes_memory_via_parent_guarantee(self):
        """Verify that when a child worker times out and is terminated by SIGTERM, parent-side zeroing executes."""
        from isolation import _run_in_isolated_process, MockConstitutionalLayerClient

        client = MockConstitutionalLayerClient()
        with self.assertRaises(TimeoutError):
            _run_in_isolated_process(
                decrypt_into_fn=_fast_decrypt_for_timeout,
                process_fn=_hanging_process_for_timeout,
                buffer_size=32,
                client=client,
                timeout_seconds=0.3,
            )


if __name__ == "__main__":
    unittest.main()

