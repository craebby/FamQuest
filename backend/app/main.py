import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from datetime import timedelta
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api import (
    approvals,
    auth,
    calendar,
    calendar_week,
    demo,
    event_symbols,
    frame,
    health,
    home,
    meals,
    members,
    parent,
    photos,
    points,
    rewards,
    routines,
    setup,
    shopping,
    task_week,
    tasks,
    today,
    weather,
)
from app.calendar_sync import run_periodically
from app.config import Settings, get_settings
from app.demo_mode import block_while_resetting, run_resets
from app.errors import register_error_handlers
from app.logs import configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        tasks = []
        # Läuft auch ohne Google: Schulferien für den Kalender kommen ebenfalls von hier.
        if settings.calendar_sync_minutes > 0:
            interval = timedelta(minutes=settings.calendar_sync_minutes)
            tasks.append(asyncio.create_task(run_periodically(interval)))
        if settings.demo_mode:
            interval = timedelta(minutes=settings.demo_reset_minutes)
            tasks.append(asyncio.create_task(run_resets(settings.demo_mode, interval)))
        yield
        for task in tasks:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(
        title="FamQuest",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )
    register_error_handlers(app)
    if settings.demo_mode:
        app.middleware("http")(block_while_resetting)

    api = APIRouter(prefix="/api")
    for module in (
        health,
        setup,
        auth,
        parent,
        members,
        task_week,
        tasks,
        today,
        points,
        rewards,
        approvals,
        calendar,
        calendar_week,
        event_symbols,
        demo,
        weather,
        home,
        routines,
        photos,
        frame,
        meals,
        shopping,
    ):
        api.include_router(module.router)
    app.include_router(api)

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def api_not_found(path: str) -> JSONResponse:
        return JSONResponse({"code": "common.not_found"}, status_code=404)

    if settings.static_dir is not None:
        _mount_frontend(app, settings.static_dir)

    return app


def _mount_frontend(app: FastAPI, static_dir: Path) -> None:
    """Liefert das gebaute Frontend aus; unbekannte Pfade gehen an index.html (SPA-Routing)."""
    index = static_dir / "index.html"
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        candidate = (static_dir / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(static_dir.resolve()):
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
