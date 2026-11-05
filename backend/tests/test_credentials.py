import os
import unittest
from unittest.mock import patch

from cryptography.fernet import Fernet

from credentials import decrypt_api_key, encrypt_api_key


class CredentialEncryptionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.encryption_key = Fernet.generate_key().decode("ascii")
        self.environment = patch.dict(
            os.environ,
            {"CREDENTIAL_ENCRYPTION_KEY": self.encryption_key},
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_encrypted_value_round_trips_without_plaintext(self) -> None:
        api_key = "provider-secret-for-test"

        encrypted = encrypt_api_key(api_key)

        self.assertNotEqual(encrypted, api_key)
        self.assertNotIn(api_key, encrypted)
        self.assertEqual(decrypt_api_key(encrypted), api_key)

    def test_missing_encryption_key_fails_closed(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError):
                encrypt_api_key("provider-secret-for-test")

    def test_invalid_encryption_key_fails_closed(self) -> None:
        with patch.dict(os.environ, {"CREDENTIAL_ENCRYPTION_KEY": "invalid"}):
            with self.assertRaises(RuntimeError):
                encrypt_api_key("provider-secret-for-test")


if __name__ == "__main__":
    unittest.main()