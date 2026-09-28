"""Einstellungen des Bilderrahmens: Einblendungen und Anzeigedauer, für die ganze Familie."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.models import Family

router = APIRouter(prefix="/frame", tags=["frame"])

# Wie lange ein Foto stehen bleibt, in Sekunden. Eine Minute wirkt ruhig, nicht hektisch.
PhotoSeconds = Literal[15, 30, 60, 120, 300]


class FrameSettings(BaseModel):
    """Standardwerte: ruhiger Rahmen mit Uhr, Wetter und nächstem Termin, ohne Aufgaben."""

    show_clock: bool = True
    show_weather: bool = True
    show_event: bool = True
    show_tasks: bool = False
    photo_seconds: PhotoSeconds = 60


def settings_of(family: Family) -> FrameSettings:
    """Gespeicherte Einstellungen; Ungültiges fällt auf den Standard zurück."""
    stored = family.frame_settings or {}
    values: dict = {}
    for name in FrameSettings.model_fields:
        if name not in stored:
            continue
        try:
            FrameSettings.model_validate({name: stored[name]})
        except ValidationError:
            continue
        values[name] = stored[name]
    return FrameSettings.model_validate(values)


@router.get("/settings")
def get_settings(_: CurrentSession, db: DbSession) -> FrameSettings:
    return settings_of(get_family(db))


@router.put("/settings")
def set_settings(body: FrameSettings, _: ParentSession, db: DbSession) -> FrameSettings:
    family = get_family(db)
    family.frame_settings = body.model_dump()
    db.commit()
    return settings_of(family)
