"""Google OAuth 2.0 für den Kalender (nur lesend), direkt über die REST-Endpunkte.

Ablauf: Eltern starten die Anmeldung (`authorization_url`), Google leitet mit einem Code zurück,
der Code wird gegen Tokens getauscht (`exchange_code`). Das Refresh-Token bleibt verschlüsselt
gespeichert; Zugriffstokens holt `access_token` bei Bedarf neu.
"""

import base64
import hashlib
import json
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx2 as httpx
from sqlalchemy.orm import Session

from app.config import get_settings
from app.crypto import DecryptError, decrypt, encrypt
from app.logs import logger
from app.models import CalendarConnection

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
SCOPES = f"openid email {CALENDAR_SCOPE}"
# Zugriffstoken so rechtzeitig erneuern, dass es während eines Abrufs nicht abläuft.
EXPIRY_MARGIN = timedelta(minutes=1)

# Tests setzen hier einen httpx.MockTransport ein.
transport: httpx.BaseTransport | None = None


class GoogleError(Exception):
    """Fehler mit Code für das Frontend, z. B. `calendar.reconnect`."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass
class Tokens:
    access_token: str
    expires_at: datetime
    refresh_token: str | None
    scope: str
    id_token: str | None


def _client() -> httpx.Client:
    return httpx.Client(timeout=15, transport=transport)


def new_pkce() -> tuple[str, str]:
    """PKCE-Paar (Verifier, Challenge nach S256)."""
    verifier = secrets.token_urlsafe(64)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
    return verifier, challenge.rstrip(b"=").decode()


def authorization_url(state: str, code_challenge: str, redirect_uri: str) -> str:
    params = {
        "client_id": get_settings().google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        # Refresh-Token auch bei erneutem Verbinden desselben Kontos.
        "access_type": "offline",
        "prompt": "consent select_account",
    }
    return f"{AUTH_URL}?{urlencode(params)}"


def _token_request(data: dict[str, str], now: datetime) -> Tokens:
    settings = get_settings()
    data = {
        **data,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
    }
    try:
        with _client() as client:
            response = client.post(TOKEN_URL, data=data)
    except httpx.HTTPError as exc:
        logger.warning("Google nicht erreichbar: %s", type(exc).__name__)
        raise GoogleError("calendar.google_unreachable") from exc

    body = (
        response.json()
        if response.headers.get("content-type", "").startswith("application/json")
        else {}
    )
    if response.status_code != 200:
        error = body.get("error", "")
        # Token widerrufen oder abgelaufen, Konto gelöscht, Passwort geändert …
        if error == "invalid_grant":
            raise GoogleError("calendar.reconnect")
        # Nur den Fehlercode loggen, nie Tokens.
        logger.warning("Google-Token-Anfrage fehlgeschlagen: %s %s", response.status_code, error)
        if error in ("invalid_client", "unauthorized_client"):
            raise GoogleError("calendar.client_invalid")
        raise GoogleError("calendar.google_failed")

    return Tokens(
        access_token=body["access_token"],
        expires_at=now + timedelta(seconds=int(body.get("expires_in", 3600))),
        refresh_token=body.get("refresh_token"),
        scope=body.get("scope", ""),
        id_token=body.get("id_token"),
    )


def exchange_code(code: str, code_verifier: str, redirect_uri: str, now: datetime) -> Tokens:
    tokens = _token_request(
        {
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": code_verifier,
            "redirect_uri": redirect_uri,
        },
        now,
    )
    # Auf der Zustimmungsseite lässt sich der Kalenderzugriff einzeln abwählen.
    if CALENDAR_SCOPE not in tokens.scope.split():
        raise GoogleError("calendar.scope_missing")
    if not tokens.refresh_token:
        raise GoogleError("calendar.google_failed")
    return tokens


def id_token_claims(id_token: str | None) -> dict:
    """Inhalt des ID-Tokens.

    Die Signatur muss nicht geprüft werden: Das Token kommt direkt per TLS vom Token-Endpunkt
    (OpenID Connect Core, Abschnitt 3.1.3.7).
    """
    if not id_token:
        raise GoogleError("calendar.google_failed")
    try:
        payload = id_token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    except (IndexError, ValueError) as exc:
        raise GoogleError("calendar.google_failed") from exc
    if not claims.get("sub") or not claims.get("email"):
        raise GoogleError("calendar.google_failed")
    return claims


def store_tokens(connection: CalendarConnection, tokens: Tokens) -> None:
    if tokens.refresh_token:
        connection.refresh_token = encrypt(tokens.refresh_token)
    connection.access_token = encrypt(tokens.access_token)
    connection.access_token_expires_at = tokens.expires_at
    connection.status = "ok"


def access_token(db: Session, connection: CalendarConnection, now: datetime) -> str:
    """Gültiges Zugriffstoken; erneuert es bei Bedarf mit dem Refresh-Token.

    Ist die Verbindung nicht mehr nutzbar, wird sie als „neu verbinden“ markiert
    und `calendar.reconnect` ausgelöst.
    """
    try:
        if (
            connection.access_token
            and connection.access_token_expires_at
            and connection.access_token_expires_at - EXPIRY_MARGIN > now
        ):
            return decrypt(connection.access_token)
        refresh_token = decrypt(connection.refresh_token)
    except DecryptError:
        logger.warning(
            "Kalender-Token von Verbindung %s nicht lesbar (TOKEN_ENCRYPTION_KEY geändert?)",
            connection.id,
        )
        _mark_reconnect(db, connection)
        raise GoogleError("calendar.reconnect") from None

    try:
        tokens = _token_request(
            {"grant_type": "refresh_token", "refresh_token": refresh_token}, now
        )
    except GoogleError as exc:
        if exc.code == "calendar.reconnect":
            logger.info("Kalender-Verbindung %s muss neu verbunden werden", connection.id)
            _mark_reconnect(db, connection)
        raise
    store_tokens(connection, tokens)
    db.commit()
    return tokens.access_token


def _mark_reconnect(db: Session, connection: CalendarConnection) -> None:
    connection.status = "reconnect"
    connection.access_token = None
    connection.access_token_expires_at = None
    db.commit()


def revoke(connection: CalendarConnection) -> None:
    """Zugriff bei Google widerrufen; Fehler sind egal, die Verbindung wird ohnehin gelöscht."""
    try:
        token = decrypt(connection.refresh_token)
        with _client() as client:
            client.post(REVOKE_URL, data={"token": token})
    except (DecryptError, httpx.HTTPError):
        logger.info("Widerruf bei Google für Verbindung %s nicht möglich", connection.id)
