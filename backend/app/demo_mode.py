"""Öffentliche Demo (DEMO_MODE=de|en): Beispielfamilie, regelmäßiges Zurücksetzen, Sperren.

Die Demo legt die Familie aus `app.demo` beim Start an und setzt sie danach zu jedem vollen
Intervall (Standard: zur vollen Stunde) zurück. Während des Zurücksetzens antwortet die API mit
503 `demo.resetting`. Aktionen, die anderen Besuchern schaden könnten (PIN ändern, Bilder hochladen,
Familie umstellen), sind mit `NotInDemo` gesperrt und liefern 403 `demo.disabled`.
"""

import asyncio
import datetime as dt
import hmac
import secrets
import shutil
import threading

from fastapi import Depends, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.errors import ApiError
from app.logs import logger

# Die Anfragen, mit denen die Demo sich selbst anlegt, tragen dieses Geheimnis im Header. Sie
# dürfen auch während des Zurücksetzens und an gesperrten Stellen durch (z. B. Fotos hochladen).
SEED_HEADER = "X-FamQuest-Demo-Seed"
SEED_TOKEN = secrets.token_urlsafe(32)

_resetting = threading.Event()


def is_seed_request(request: Request) -> bool:
    return hmac.compare_digest(request.headers.get(SEED_HEADER, ""), SEED_TOKEN)


def forbid_in_demo(request: Request) -> None:
    if get_settings().demo_mode and not is_seed_request(request):
        raise ApiError(status.HTTP_403_FORBIDDEN, "demo.disabled")


NotInDemo = Depends(forbid_in_demo)


async def block_while_resetting(request: Request, call_next):
    """Middleware: Während die Demo neu angelegt wird, wartet die API kurz (503)."""
    path = request.url.path
    if (
        _resetting.is_set()
        and path.startswith("/api/")
        and path != "/api/health"
        and not is_seed_request(request)
    ):
        return JSONResponse({"code": "demo.resetting"}, status_code=503)
    return await call_next(request)


def reset(language: str) -> None:
    """Alles löschen und die Beispielfamilie neu anlegen, relativ zu jetzt."""
    from app import weather
    from app.calendar_sync import sync_all
    from app.db import Base, engine
    from app.demo import Demo, set_clock
    from app.security import login_limiter, pin_limiter

    _resetting.set()
    try:
        tables = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)
        with engine.begin() as conn:
            conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        upload_dir = get_settings().upload_dir
        for entry in upload_dir.iterdir() if upload_dir.is_dir() else []:
            if entry.is_dir():
                shutil.rmtree(entry, ignore_errors=True)
            else:
                entry.unlink(missing_ok=True)
        login_limiter.clear()
        pin_limiter.clear()
        weather.clear_cache()
        try:
            Demo(language, dt.datetime.now(dt.UTC)).run()
        finally:
            set_clock(None)
    finally:
        _resetting.clear()
    # Schulferien gleich holen statt erst beim nächsten Abgleich im Hintergrund.
    sync_all()


def next_reset(now: dt.datetime, interval: dt.timedelta) -> dt.datetime:
    """Nächster volle Intervall-Zeitpunkt (bei 60 Minuten: nächste volle Stunde)."""
    step = interval.total_seconds()
    return dt.datetime.fromtimestamp((now.timestamp() // step + 1) * step, dt.UTC)


async def run_resets(language: str, interval: dt.timedelta) -> None:
    """Hintergrundschleife im App-Prozess: sofort anlegen, dann zu jedem vollen Intervall."""
    while True:
        try:
            await asyncio.to_thread(reset, language)
            logger.info("Demo zurückgesetzt (%s)", language)
        except Exception:
            logger.exception("Demo konnte nicht zurückgesetzt werden")
        now = dt.datetime.now(dt.UTC)
        await asyncio.sleep((next_reset(now, interval) - now).total_seconds())
