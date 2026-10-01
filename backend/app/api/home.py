"""Aufbau der Startseite „Heute“: welche Bereiche sichtbar sind und wie die Woche beginnt, für die
ganze Familie.

Die Anordnung ist fest (Kopf mit Wetter, Routine, Haushalt und Einkauf, unten die Woche mit
Terminen und Essen); die gespeicherte Reihenfolge spielt keine Rolle mehr. Die frühere Kachel
„week“ (Ringe je Person) gibt es nicht mehr, gespeicherte Einträge dazu fallen weg.
"""

from typing import Literal

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.errors import ApiError
from app.models import Family

router = APIRouter(prefix="/home", tags=["home"])

# tasks: die aktuelle Routine der Kinder; chores: was im Putzplan gelb oder rot ist.
TileId = Literal["weather", "events", "tasks", "meals", "shopping", "chores"]
# rolling: ab heute sieben Tage; monday: die aktuelle Woche von Montag bis Sonntag.
WeekMode = Literal["rolling", "monday"]

# Standard: alles sichtbar.
DEFAULT_TILES: list[tuple[TileId, bool]] = [
    ("weather", True),
    ("events", True),
    ("tasks", True),
    ("meals", True),
    ("shopping", True),
    ("chores", True),
]


class TileIn(BaseModel):
    id: TileId
    visible: bool


class HomeLayout(BaseModel):
    tiles: list[TileIn] = Field(max_length=len(DEFAULT_TILES))
    week: WeekMode = "rolling"


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
    week = family.home_week if family.home_week in ("rolling", "monday") else "rolling"
    return HomeLayout(tiles=tiles, week=week)


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
    family.home_week = body.week
    db.commit()
    return layout_of(family)
