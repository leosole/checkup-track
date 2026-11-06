"""Google ID-token verification, local JWT issuing, and the API guard.

All protected routes depend on ``get_current_user``, which validates the
``Authorization: Bearer <TOKEN>`` header with a locally signed, stateless
JWT. This keeps the API fully compatible with both the web frontend and
future Android/mobile clients.
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlmodel import Session

from database import BASE_DIR, get_session
from models import ShareGrant, User

logger = logging.getLogger("auth")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
GUEST_TOKEN_SCOPE = "guest"
JWT_SECRET_FILE = BASE_DIR / ".jwt_secret"

_bearer_scheme = HTTPBearer(auto_error=False)


class AuthConfigError(RuntimeError):
    """Raised when Google sign-in is not configured on the server."""


def _jwt_secret() -> str:
    """Resolve the JWT signing secret.

    Priority: ``JWT_SECRET`` env var, then a locally persisted generated
    secret (so sessions survive restarts), then a fresh random secret.
    """
    secret = os.environ.get("JWT_SECRET", "").strip()
    if secret:
        return secret
    try:
        if JWT_SECRET_FILE.exists():
            persisted = JWT_SECRET_FILE.read_text(encoding="utf-8").strip()
            if persisted:
                return persisted
    except OSError:  # pragma: no cover - best effort
        pass
    generated = secrets.token_urlsafe(48)
    try:
        JWT_SECRET_FILE.write_text(generated, encoding="utf-8")
        JWT_SECRET_FILE.chmod(0o600)
    except OSError:  # pragma: no cover - best effort
        logger.warning("Could not persist a JWT secret; using an in-memory secret.")
    logger.warning(
        "JWT_SECRET is not configured; using a generated development secret. "
        "Set JWT_SECRET in the environment for production deployments."
    )
    return generated


def get_google_client_id() -> Optional[str]:
    client_id = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    return client_id or None


def verify_google_id_token(token: str) -> dict:
    """Validate a Google ID token with google-auth and return its claims."""
    client_id = get_google_client_id()
    if not client_id:
        raise AuthConfigError(
            "Google sign-in is not configured on this server. Set GOOGLE_CLIENT_ID."
        )
    claims = google_id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        audience=client_id,
    )
    issuer = claims.get("iss")
    if issuer not in ("https://accounts.google.com", "accounts.google.com"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Google ID token issuer.",
        )
    if not claims.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google ID token is missing a subject.",
        )
    return claims


def create_access_token(user_id: str) -> str:
    """Issue a locally signed, stateless JWT access token."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGORITHM)


def as_utc(value: datetime) -> datetime:
    """Treat naive timestamps (SQLite) as UTC so comparisons never mix zones."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def create_guest_token(share_id: int, expires_at: datetime) -> str:
    """Issue a read-only guest token that dies with the share it belongs to."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": f"share:{share_id}",
        "scope": GUEST_TOKEN_SCOPE,
        "iat": int(now.timestamp()),
        "exp": int(as_utc(expires_at).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=ALGORITHM)


def upsert_user(session: Session, claims: dict) -> User:
    """Create or refresh the local user row from Google claims."""
    user_id = claims["sub"]
    email = claims.get("email", "") or ""
    name = claims.get("name") or email or "Google user"
    user = session.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email, name=name)
    else:
        user.email = email or user.email
        user.name = name
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    """FastAPI dependency: require a valid ``Authorization: Bearer`` JWT."""
    unauthorized_headers = {"WWW-Authenticate": "Bearer"}
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Provide an Authorization: Bearer <TOKEN> header.",
            headers=unauthorized_headers,
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            _jwt_secret(),
            algorithms=[ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Sign in again.",
            headers=unauthorized_headers,
        ) from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers=unauthorized_headers,
        ) from exc

    if payload.get("scope") == GUEST_TOKEN_SCOPE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Guest tokens cannot access account endpoints.",
            headers=unauthorized_headers,
        )

    user_id = payload.get("sub")
    user = session.get(User, str(user_id)) if user_id else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists. Sign in again.",
            headers=unauthorized_headers,
        )
    return user


def get_guest_share(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
    session: Session = Depends(get_session),
) -> ShareGrant:
    """FastAPI dependency: require a valid guest token for a read-only share."""
    unauthorized_headers = {"WWW-Authenticate": "Bearer"}
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This shared view is not signed in. Enter the share code again.",
            headers=unauthorized_headers,
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            _jwt_secret(),
            algorithms=[ALGORITHM],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This shared view has expired.",
            headers=unauthorized_headers,
        ) from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid shared view token.",
            headers=unauthorized_headers,
        ) from exc

    if payload.get("scope") != GUEST_TOKEN_SCOPE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This shared view requires a guest code.",
            headers=unauthorized_headers,
        )

    subject = str(payload.get("sub") or "")
    share_id: Optional[int] = None
    if subject.startswith("share:"):
        try:
            share_id = int(subject.split(":", 1)[1])
        except ValueError:
            share_id = None
    if share_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid shared view token.",
            headers=unauthorized_headers,
        )

    share = session.get(ShareGrant, share_id)
    if share is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This shared view is no longer available.",
            headers=unauthorized_headers,
        )
    if share.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The owner revoked access to this shared view.",
            headers=unauthorized_headers,
        )
    if as_utc(share.expires_at) <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This shared view has expired.",
            headers=unauthorized_headers,
        )
    return share
