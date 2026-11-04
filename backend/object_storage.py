"""Object storage for lab-report PDFs (Backblaze B2, S3-compatible).

Active when B2_KEY_ID, B2_APPLICATION_KEY and B2_BUCKET_NAME are set;
otherwise falls back to the local storage/pdfs/ directory so the dev
preview keeps working without credentials.

The bucket endpoint is auto-discovered via the B2 native API (S3 endpoints
depend on the account's region and cannot be guessed reliably).
"""
import logging
import os
from pathlib import Path

from env_loader import load_env_files

# B2 credentials come from the environment, so read ``.env.local`` first.
load_env_files()

logger = logging.getLogger("object_storage")

_KEY_ID = os.environ.get("B2_KEY_ID", "").strip()
_APP_KEY = os.environ.get("B2_APPLICATION_KEY", "").strip()
_BUCKET = os.environ.get("B2_BUCKET_NAME", "").strip()
_ENABLED = bool(_KEY_ID and _APP_KEY and _BUCKET)

_S3_CLIENT = None  # lazily created boto3 client


def is_remote_enabled() -> bool:
    return _ENABLED


def _client():
    global _S3_CLIENT
    if _S3_CLIENT is None:
        import boto3
        from botocore.client import Config

        endpoint = _b2_s3_endpoint()
        logger.info("B2 storage active (bucket=%s, endpoint=%s)", _BUCKET, endpoint)
        _S3_CLIENT = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=_KEY_ID,
            aws_secret_access_key=_APP_KEY,
            config=Config(signature_version="s3v4"),
        )
    return _S3_CLIENT


def _b2_s3_endpoint() -> str:
    """Resolve the account's S3 endpoint via the B2 native API (b2_authorize_account)."""
    import base64

    import urllib.request

    auth = base64.b64encode(f"{_KEY_ID}:{_APP_KEY}".encode()).decode()
    req = urllib.request.Request(
        "https://api.backblazeb2.com/b2api/v3/b2_authorize_account",
        headers={"Authorization": "Basic " + auth},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = __import__("json").loads(resp.read().decode())
    return data["apiInfo"]["storageApi"]["s3ApiUrl"]


def upload_pdf(pdf_bytes: bytes, key: str) -> None:
    """Store a PDF. key looks like exams/<uuid>.pdf."""
    if not _ENABLED:
        return  # caller handles the local fallback
    _client().put_object(Bucket=_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")


def download_pdf(key: str) -> bytes:
    """Fetch a stored PDF (raises if not configured — callers check first)."""
    if not _ENABLED:
        raise RuntimeError("Object storage is not configured.")
    resp = _client().get_object(Bucket=_BUCKET, Key=key)
    return resp["Body"].read()


def delete_pdf(key: str) -> None:
    if not _ENABLED:
        return
    _client().delete_object(Bucket=_BUCKET, Key=key)


def local_pdf_path(rel_path: str) -> Path:
    """Local fallback path for storage/pdfs/<name> style relative paths."""
    from database import PDF_DIR

    return PDF_DIR / Path(rel_path).name
