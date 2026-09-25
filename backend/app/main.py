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
    health,
    members,
    parent,
    points,
    rewards,
    setup,
    tasks,
    today,
)
from app.calendar_sync import run_periodically
from app.config import Settings, get_settings
from app.errors import register_error_handlers
from app.logs import configure_logging


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        task = None
        if settings.calendar_configured and settings.calendar_sync_minutes > 0:
            interval = timedelta(minutes=settings.calendar_sync_minutes)
            task = asyncio.create_task(run_periodically(interval))
        yield
        if task is not None:
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

    api = APIRouter(prefix="/api")
    for module in (
        health,
        setup,
        auth,
        parent,
        members,
        tasks,
        today,
        points,
        rewards,
        approvals,
        calendar,
        calendar_week,
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
