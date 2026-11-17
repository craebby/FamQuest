"""Anmeldung anderer Programme (Bon-Drucker, Home Assistant) per API-Schlüssel.

Der Schlüssel steht im Header `Authorization: Bearer fq_…`. Er ersetzt Session und CSRF-Token,
gilt aber nur unter `/api/v1`. Gespeichert wird nur sein SHA-256-Hash (wie bei Sessions): Ein
zufälliger Schlüssel mit 256 Bit braucht kein langsames Passwort-Hashing.
"""

import datetime as dt
from typing import Annotated

from fastapi import Depends, Request, status
from sqlalchemy import select

from app.auth import DbSession, client_ip, utcnow
from app.errors import ApiError
from app.logs import logger
from app.models import ApiToken
from app.security import RateLimiter, new_token, token_hash

PREFIX = "fq_"
# Die Zeit der letzten Nutzung wird nur alle paar Minuten geschrieben, nicht bei jeder Abfrage.
LAST_USED_INTERVAL = dt.timedelta(minutes=5)

# Falsche Schlüssel je Adresse: 20 in 15 Minuten, dann Pause.
token_limiter = RateLimiter(max_failures=20, window_seconds=15 * 60)


def create_token() -> tuple[str, str, str]:
    """Neuer Schlüssel: (Schlüssel, Hash, sichtbarer Anfang)."""
    token = PREFIX + new_token()
    return token, token_hash(token), token[: len(PREFIX) + 4]


def api_token(request: Request, db: DbSession) -> ApiToken:
    ip = client_ip(request)
    if token_limiter.is_blocked(f"ip:{ip}"):
        raise ApiError(status.HTTP_429_TOO_MANY_REQUESTS, "auth.rate_limited")
    scheme, _, value = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "api.token_missing")
    token = db.scalar(select(ApiToken).where(ApiToken.token_hash == token_hash(value.strip())))
    if token is None:
        token_limiter.record_failure(f"ip:{ip}")
        logger.warning("Unbekannter API-Schlüssel von %s", ip)
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "api.token_invalid")
    now = utcnow()
    if token.last_used_at is None or now - token.last_used_at >= LAST_USED_INTERVAL:
        token.last_used_at = now
        db.commit()
    return token


def write_token(token: Annotated[ApiToken, Depends(api_token)]) -> ApiToken:
    if token.scope != "write":
        raise ApiError(status.HTTP_403_FORBIDDEN, "api.read_only")
    return token


ReadToken = Annotated[ApiToken, Depends(api_token)]
WriteToken = Annotated[ApiToken, Depends(write_token)]
