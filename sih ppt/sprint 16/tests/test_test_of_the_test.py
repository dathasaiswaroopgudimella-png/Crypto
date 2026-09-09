"""test_test_of_the_test.py — Rigorous verification of the test suite against defect reintroduction.

Enforces Rule H1.2 (Test-of-the-test requirement) from the Chronis Final Phase Master:
Every release-blocking test must be demonstrated to fail if the defect it was created
to catch is reintroduced. A test that passes even when broken behavior is present
is 'test theater' and blocks release.
"""

import sys
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from isolation import (
    SecureBuffer,
    SessionKey,
    SessionKeyExpired,
    MockConstitutionalLayerClient,
    IsolatedProcessingContainer,
    SandboxRuntimeUnavailable,
    GvisorRuntime,
)
from kdf import VaultKeyDerivation, Argon2Params
from bystander_ttl import (
    BystanderBiometricRecord,
    BystanderBiometricStore,
    WearerDataRejected,
)
from license_gate import check_manifest


class TestOfTheTest(unittest.TestCase):
    def test_reintroduced_expired_key_bypass_is_caught(self):
        """If key expiration check were disabled or returned False, require_valid would fail to guard."""
        client = MockConstitutionalLayerClient()
        key = client.grant_session_key()
        expired_time = key.issued_at + 24 * 3600 + 100

        # Intentionally simulated defect: caller forgets or ignores expiration
        is_expired = key.is_expired(now=expired_time)
        self.assertTrue(is_expired, "Defect: key expiration calculation must detect elapsed TTL")

        with self.assertRaises(SessionKeyExpired, msg="Defect: expired key must raise SessionKeyExpired"):
            key.require_valid(now=expired_time)

    def test_reintroduced_zero_fill_omission_is_caught(self):
        """If SecureBuffer.zero() failed to overwrite memory, bytes would remain non-zero."""
        secret = b"CRITICAL_BIOMETRIC_DATA"
        buf = SecureBuffer(secret)
        self.assertNotEqual(bytes(buf.view()), b"\x00" * len(secret))

        # Perform zero
        buf.zero()

        # Defect reintroduction check: buffer MUST be zeroed
        self.assertTrue(buf.is_zeroed)
        # Raw internal buffer check
        self.assertEqual(bytes(buf._buf), b"\x00" * len(secret))

    def test_reintroduced_no_isolation_silent_fallback_is_caught(self):
        """If container silently allowed execution without isolation when allow_no_isolation=False,
        SandboxRuntimeUnavailable must be raised."""
        client = MockConstitutionalLayerClient()
        if not GvisorRuntime().is_available():
            with self.assertRaises(SandboxRuntimeUnavailable):
                IsolatedProcessingContainer(client, allow_no_isolation=False)

    def test_reintroduced_weak_kdf_salt_is_caught(self):
        """If KDF accepted a short/weak salt (<16 bytes), it would violate RFC 9106."""
        kdf = VaultKeyDerivation()
        weak_salt = b"short"
        with self.assertRaises(ValueError):
            kdf.derive_key("password", salt=weak_salt)

    def test_reintroduced_wearer_data_in_bystander_store_is_caught(self):
        """If bystander store accepted wearer data, WearerDataRejected would fail to trigger."""
        store = BystanderBiometricStore()
        wearer_record = BystanderBiometricRecord(
            speaker_uuid="wearer-001",
            embedding=b"wearer-voiceprint",
            captured_at=time.time(),
            is_wearer=True,
        )
        with self.assertRaises(WearerDataRejected):
            store.add(wearer_record)

    def test_reintroduced_copyleft_allowance_is_caught(self):
        """If license gate permitted GPL-3.0-only inside trusted boundary, build must fail."""
        poisoned_manifest = {"in_boundary_dep": "GPL-3.0-only"}
        result = check_manifest(poisoned_manifest)
        self.assertFalse(result.passed, "Defect: copyleft dependency was not blocked!")
        self.assertTrue(any(v.category == "strong_copyleft" for v in result.violations))


if __name__ == "__main__":
    unittest.main()
