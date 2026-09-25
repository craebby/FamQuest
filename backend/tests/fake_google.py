"""Nachgebautes Google (OAuth-Token-Endpunkt und Kalender-API) für die Tests."""

import base64
import hashlib
import json
from urllib.parse import parse_qs, unquote

import httpx2 as httpx

from app import google

CALLBACK = "/api/calendar/google/callback"
REDIRECT_URI = f"http://testserver{CALLBACK}"


def id_token(sub="google-123", email="mama@gmail.com") -> str:
    def part(data: dict) -> str:
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()

    return f"{part({'alg': 'RS256'})}.{part({'sub': sub, 'email': email})}.signatur"


def timed(event_id: str, start: str, end: str, title: str = "Termin", **extra) -> dict:
    """Termin mit Uhrzeit (Zeitpunkte im RFC-3339-Format mit Offset)."""
    return {
        "id": event_id,
        "iCalUID": f"{event_id}@google.com",
        "status": "confirmed",
        "summary": title,
        "start": {"dateTime": start},
        "end": {"dateTime": end},
        **extra,
    }


def all_day(event_id: str, start: str, end: str, title: str = "Termin", **extra) -> dict:
    """Ganztägiger Termin; `end` ist exklusiv wie bei Google."""
    return {
        "id": event_id,
        "iCalUID": f"{event_id}@google.com",
        "status": "confirmed",
        "summary": title,
        "start": {"date": start},
        "end": {"date": end},
        **extra,
    }


class FakeGoogle:
    """Token-, Revoke- und Kalender-Endpunkte.

    Kalender liegen in `calendars`, ihre Termine in `events`. Jede Änderung über `set_events`
    erhöht die Version des Kalenders; Sync-Tokens sind einfach "sync-<id>-<version>".
    """

    def __init__(self) -> None:
        self.requests: list[tuple[str, dict[str, str]]] = []
        self.api_requests: list[tuple[str, dict[str, str]]] = []
        self.challenges: dict[str, str] = {}
        self.scope = f"openid email {google.CALENDAR_SCOPE}"
        self.account = {"sub": "google-123", "email": "mama@gmail.com"}
        self.refresh_error: str | None = None
        self.refresh_count = 0
        self.calendars: list[dict] = [
            {"id": "mama@gmail.com", "summary": "mama@gmail.com", "primary": True},
            {"id": "familie@group.calendar.google.com", "summary": "Familie"},
        ]
        self.events: dict[str, list[dict]] = {}
        self.versions: dict[str, int] = {}
        # Kalender-Id → (HTTP-Status, Grund), z. B. (403, "rateLimitExceeded").
        self.api_errors: dict[str, tuple[int, str]] = {}
        self.expired_sync_tokens: set[str] = set()
        self.unreachable = False
        self.page_size: int | None = None

    def set_events(self, calendar_id: str, events: list[dict]) -> None:
        self.events[calendar_id] = events
        self.versions[calendar_id] = self.versions.get(calendar_id, 0) + 1

    def sync_token(self, calendar_id: str) -> str:
        return f"sync-{calendar_id}-{self.versions.get(calendar_id, 0)}"

    def api_calls(self, kind: str) -> list[dict[str, str]]:
        """Abrufe einer Art: "list", "window", "initial" oder "changes"."""
        return [params for path, params in self.api_requests if _kind(path, params) == kind]

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.startswith(google.API_URL):
            return self._api(request)
        data = {key: values[0] for key, values in parse_qs(request.content.decode()).items()}
        self.requests.append((url, data))
        if url == google.REVOKE_URL:
            return httpx.Response(200)
        assert url == google.TOKEN_URL
        assert data["client_id"] == "client-id"
        assert data["client_secret"] == "client-secret"

        if data["grant_type"] == "authorization_code":
            if data["code"] != "guter-code":
                return httpx.Response(400, json={"error": "invalid_grant"})
            challenge = base64.urlsafe_b64encode(
                hashlib.sha256(data["code_verifier"].encode()).digest()
            ).rstrip(b"=")
            assert challenge.decode() in self.challenges.values(), "PKCE passt nicht"
            assert data["redirect_uri"] == REDIRECT_URI
            return httpx.Response(
                200,
                json={
                    "access_token": "access-1",
                    "expires_in": 3599,
                    "refresh_token": "refresh-1",
                    "scope": self.scope,
                    "id_token": id_token(**self.account),
                },
            )

        assert data["grant_type"] == "refresh_token"
        assert data["refresh_token"] == "refresh-1"
        if self.refresh_error:
            return httpx.Response(400, json={"error": self.refresh_error})
        self.refresh_count += 1
        return httpx.Response(
            200,
            json={
                "access_token": f"access-refreshed-{self.refresh_count}",
                "expires_in": 3599,
                "scope": self.scope,
            },
        )

    def _api(self, request: httpx.Request) -> httpx.Response:
        if self.unreachable:
            raise httpx.ConnectError("keine Verbindung")
        assert request.headers["Authorization"].startswith("Bearer access-")
        path = request.url.path.removeprefix("/calendar/v3")
        params = dict(request.url.params)
        self.api_requests.append((path, params))

        if path == "/users/me/calendarList":
            return httpx.Response(200, json={"items": self.calendars})

        assert path.startswith("/calendars/") and path.endswith("/events")
        calendar_id = unquote(request.url.raw_path.decode().split("/")[4])
        if calendar_id in self.api_errors:
            status, reason = self.api_errors[calendar_id]
            error = {"code": status, "errors": [{"reason": reason}]}
            return httpx.Response(status, json={"error": error})

        if "syncToken" in params:
            token = params["syncToken"]
            if token in self.expired_sync_tokens:
                return httpx.Response(410, json={"error": {"code": 410}})
            changed = token != self.sync_token(calendar_id)
            items = [{"id": "geaendert"}] if changed else []
            return httpx.Response(
                200, json={"items": items, "nextSyncToken": self.sync_token(calendar_id)}
            )
        if params.get("singleEvents") == "true":
            return self._page(self.events.get(calendar_id, []), params)
        # Erster Abruf ohne Zeitraum: nur für den Sync-Token.
        return httpx.Response(200, json={"nextSyncToken": self.sync_token(calendar_id)})

    def _page(self, items: list[dict], params: dict[str, str]) -> httpx.Response:
        if self.page_size is None:
            return httpx.Response(200, json={"items": items})
        offset = int(params.get("pageToken", "0"))
        body: dict = {"items": items[offset : offset + self.page_size]}
        if offset + self.page_size < len(items):
            body["nextPageToken"] = str(offset + self.page_size)
        return httpx.Response(200, json=body)


def _kind(path: str, params: dict[str, str]) -> str:
    if path == "/users/me/calendarList":
        return "list"
    if "syncToken" in params:
        return "changes"
    return "window" if params.get("singleEvents") == "true" else "initial"
