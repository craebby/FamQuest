"""Aufbau der Startseite „Heute“: welche Kacheln in welcher Reihenfolge, für die ganze Familie."""

from typing import Literal

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.errors import ApiError
from app.models import Family

router = APIRouter(prefix="/home", tags=["home"])

TileId = Literal["weather", "events", "tasks", "week", "meals", "shopping"]

# Standardaufbau (so sah die Startseite vor der Einstellung aus); die Woche ist zuschaltbar.
DEFAULT_TILES: list[tuple[TileId, bool]] = [
    ("weather", True),
    ("events", True),
    ("tasks", True),
    ("meals", True),
    ("shopping", True),
    ("week", False),
]


class TileIn(BaseModel):
    id: TileId
    visible: bool


class HomeLayout(BaseModel):
    tiles: list[TileIn] = Field(max_length=len(DEFAULT_TILES))


def layout_of(family: Family) -> HomeLayout:
    """Gespeicherter Aufbau; unbekannte Kacheln fallen weg, fehlende (neue) kommen ans Ende."""
    known = dict(DEFAULT_TILES)
    tiles: list[TileIn] = []
    for item in family.home_layout or []:
        tile_id = item.get("id")
        if tile_id in known and all(tile.id != tile_id for tile in tiles):
            tiles.append(TileIn(id=tile_id, visible=bool(item.get("visible"))))
    for tile_id, visible in DEFAULT_TILES:
        if all(tile.id != tile_id for tile in tiles):
            tiles.append(TileIn(id=tile_id, visible=visible))
    return HomeLayout(tiles=tiles)


@router.get("/layout")
def get_layout(_: CurrentSession, db: DbSession) -> HomeLayout:
    return layout_of(get_family(db))


@router.put("/layout")
def set_layout(body: HomeLayout, _: ParentSession, db: DbSession) -> HomeLayout:
    ids = [tile.id for tile in body.tiles]
    if len(set(ids)) != len(ids):
        raise ApiError(status.HTTP_422_UNPROCESSABLE_CONTENT, "home.invalid_layout")
    family = get_family(db)
    family.home_layout = [tile.model_dump() for tile in body.tiles]
    db.commit()
    return layout_of(family)
