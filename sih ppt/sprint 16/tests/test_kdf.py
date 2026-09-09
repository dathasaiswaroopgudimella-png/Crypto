import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from kdf import Argon2Params, VaultKeyDerivation, DEFAULT_PARAMS
from isolation import SecureBuffer


class TestVaultKeyDerivation(unittest.TestCase):
    def setUp(self):
        # Use lightweight parameters for unit test speed while validating algorithms
        self.fast_params = Argon2Params(
            memory_cost=1024,
            time_cost=1,
            parallelism=1,
            salt_len=16,
            key_len=32,
            rationale="Test harness parameters for unit test execution speed",
        )
        self.kdf_fast = VaultKeyDerivation(params=self.fast_params)
        self.kdf_default = VaultKeyDerivation(params=DEFAULT_PARAMS)

    def test_pinned_defaults_match_rfc9106(self):
        self.assertEqual(DEFAULT_PARAMS.memory_cost, 65536)
        self.assertEqual(DEFAULT_PARAMS.time_cost, 3)
        self.assertEqual(DEFAULT_PARAMS.parallelism, 4)
        self.assertEqual(DEFAULT_PARAMS.key_len, 32)
        self.assertGreaterEqual(DEFAULT_PARAMS.salt_len, 16)
        self.assertIn("RFC 9106", DEFAULT_PARAMS.rationale)

    def test_deterministic_derivation(self):
        salt = b"0123456789abcdef"
        phrase = "correct horse battery staple"
        key1 = self.kdf_fast.derive_key(phrase, salt, as_secure_buffer=False)
        key2 = self.kdf_fast.derive_key(phrase, salt, as_secure_buffer=False)
        self.assertEqual(key1, key2)

    def test_different_phrases_yield_different_keys(self):
        salt = b"0123456789abcdef"
        key1 = self.kdf_fast.derive_key("passphrase_one", salt, as_secure_buffer=False)
        key2 = self.kdf_fast.derive_key("passphrase_two", salt, as_secure_buffer=False)
        self.assertNotEqual(key1, key2)

    def test_random_salts_yield_different_keys(self):
        salt1 = self.kdf_fast.generate_salt()
        salt2 = self.kdf_fast.generate_salt()
        self.assertNotEqual(salt1, salt2)
        key1 = self.kdf_fast.derive_key("same_passphrase", salt1, as_secure_buffer=False)
        key2 = self.kdf_fast.derive_key("same_passphrase", salt2, as_secure_buffer=False)
        self.assertNotEqual(key1, key2)

    def test_bad_salt_length_rejected(self):
        short_salt = b"too_short"
        with self.assertRaises(ValueError):
            self.kdf_fast.derive_key("passphrase", short_salt)
        with self.assertRaises(ValueError):
            self.kdf_fast.derive_phc("passphrase", salt=short_salt)

    def test_insecure_params_rejected_at_initialization(self):
        with self.assertRaises(ValueError):
            Argon2Params(salt_len=8)
        with self.assertRaises(ValueError):
            Argon2Params(key_len=8)

        # Defense-in-depth: VaultKeyDerivation constructor independently rejects short salt/key
        class InsecureParams:
            salt_len = 8
            key_len = 32
            memory_cost = 65536
            time_cost = 3
            parallelism = 4
            rationale = "Insecure test params"

        with self.assertRaises(ValueError):
            VaultKeyDerivation(params=InsecureParams())  # type: ignore


    def test_phc_format_and_verification(self):
        phrase = "recovery phrase mnemonic words twelve"
        phc = self.kdf_fast.derive_phc(phrase)
        self.assertTrue(phc.startswith("$argon2id$v=19$"))
        self.assertTrue(self.kdf_fast.verify_phc(phrase, phc))

    def test_wrong_phrase_rejected_in_phc(self):
        phrase = "correct recovery phrase"
        phc = self.kdf_fast.derive_phc(phrase)
        self.assertFalse(self.kdf_fast.verify_phc("incorrect recovery phrase", phc))

    def test_secure_buffer_zeroing(self):
        salt = b"0123456789abcdef"
        key_buf = self.kdf_fast.derive_key("secret phrase", salt, as_secure_buffer=True)
        self.assertIsInstance(key_buf, SecureBuffer)
        self.assertFalse(key_buf.is_zeroed)
        self.assertEqual(len(key_buf), 32)
        key_buf.zero()
        self.assertTrue(key_buf.is_zeroed)

    def test_parameter_logging_contains_rationale(self):
        params_dict = self.kdf_default.log_parameters()
        self.assertEqual(params_dict["algorithm"], "Argon2id")
        self.assertEqual(params_dict["memory_cost_kib"], 65536)
        self.assertEqual(params_dict["time_cost_iterations"], 3)
        self.assertEqual(params_dict["parallelism_lanes"], 4)
        self.assertEqual(params_dict["key_len_bytes"], 32)
        self.assertIn("RFC 9106", params_dict["rationale"])


if __name__ == "__main__":
    unittest.main()
