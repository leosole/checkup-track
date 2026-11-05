"""Authenticated encryption for user-supplied provider credentials."""

import os
from base64 import urlsafe_b64encode

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _fernet() -> Fernet:
    key = os.environ.get("CREDENTIAL_ENCRYPTION_KEY", "").strip()
    key_bytes = key.encode("utf-8")
    if len(key_bytes) < 32:
        raise RuntimeError(
            "Credential encryption requires a stable secret of at least 32 bytes."
        )
    derived_key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=b"checkup-track/provider-credential/v1",
    ).derive(key_bytes)
    return Fernet(urlsafe_b64encode(derived_key))


def encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode("utf-8")).decode("ascii")


def decrypt_api_key(encrypted_api_key: str) -> str:
    return _fernet().decrypt(encrypted_api_key.encode("ascii")).decode("utf-8")