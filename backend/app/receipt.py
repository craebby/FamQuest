"""Einkaufsliste für andere Programme: geordnet nach Laden und Bereich wie im Frontend und als
Text für einen Bon-Drucker (feste Zeichenbreite, z. B. 32 Zeichen für 58-mm-Papier)."""

import datetime as dt
import textwrap
from dataclasses import dataclass

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models import Family, ShoppingItem
from app.shopping_areas import AREAS, LABELS, STORES, auto_area, store_of
from app.today import family_now

# Kleinste und größte Breite des Bons in Zeichen.
MIN_WIDTH, MAX_WIDTH = 16, 80
DEFAULT_WIDTH = 32

_WEEKDAYS = {
    "de": ("Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"),
    "en": ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"),
}
_TITLE = {"de": "Einkaufsliste", "en": "Shopping list"}
_COUNT = {"de": ("Artikel", "Artikel"), "en": ("item", "items")}
_EMPTY = {"de": "Alles da.", "en": "Nothing missing."}


@dataclass
class Entry:
    id: int
    name: str
    note: str | None
    recipes: str | None
    checked: bool
    store: str
    area: str
    position: int | None


def language(family: Family, lang: str | None) -> str:
    """Sprache des Bons: gewünscht, sonst die der Familie, sonst Deutsch."""
    for candidate in (lang, family.default_language):
        if candidate in LABELS:
            return candidate
    return "de"


def entries(db: Session, family: Family, *, include_checked: bool = False) -> list[Entry]:
    """Artikel der Liste nach Laden, Bereich im Laufweg und von Hand gesetzter Reihenfolge."""
    start = family_now(family).replace(hour=0, minute=0, second=0, microsecond=0)
    checked = (
        or_(ShoppingItem.checked_at.is_(None), ShoppingItem.checked_at >= start)
        if include_checked
        else ShoppingItem.checked_at.is_(None)
    )
    items = db.scalars(
        select(ShoppingItem)
        .where(and_(ShoppingItem.on_list, checked))
        .order_by(ShoppingItem.added_at, ShoppingItem.id)
    )
    found = []
    for item in items:
        area = item.area if item.area in AREAS else auto_area(item.name, item.icon)
        found.append(
            Entry(
                id=item.id,
                name=item.name,
                note=item.note,
                recipes=item.recipes,
                checked=item.checked_at is not None,
                store=store_of(area),
                area=area,
                position=item.position,
            )
        )

    def rank(entry: Entry) -> tuple[int, int, float]:
        position = entry.position if entry.position is not None else float("inf")
        return STORES.index(entry.store), AREAS.index(entry.area), position  # type: ignore[arg-type]

    # sort ist stabil: Gleichstand behält die Reihenfolge des Eintragens.
    return sorted(found, key=rank)


def _center(text: str, width: int) -> str:
    return text[:width].center(width).rstrip()


def _item_lines(entry: Entry, width: int) -> list[str]:
    box = "[x] " if entry.checked else "[ ] "
    text = entry.name + (f" ({entry.note})" if entry.note else "")
    lines = textwrap.wrap(
        text,
        width=width,
        initial_indent=box,
        subsequent_indent=" " * len(box),
        break_long_words=True,
    )
    return lines or [box.rstrip()]


def receipt_text(
    family: Family,
    items: list[Entry],
    *,
    width: int = DEFAULT_WIDTH,
    lang: str = "de",
    now: dt.datetime | None = None,
) -> str:
    """Bon: Kopf mit Familie und Datum, je Laden eine Überschrift, je Bereich eine Zwischenzeile,
    dann die Artikel mit Kästchen zum Abhaken."""
    width = max(MIN_WIDTH, min(MAX_WIDTH, width))
    labels = LABELS[lang]
    now = now or family_now(family)
    date = f"{_WEEKDAYS[lang][now.weekday()]} {now:%d.%m.%Y}"
    if lang == "en":
        date = f"{_WEEKDAYS[lang][now.weekday()]} {now:%Y-%m-%d}"
    lines = [
        "=" * width,
        _center(family.name, width),
        _center(f"{_TITLE[lang]} - {date}", width),
        "=" * width,
    ]
    if not items:
        lines += ["", _center(_EMPTY[lang], width)]
    store = area = None
    for entry in items:
        if entry.store != store:
            store, area = entry.store, None
            lines += ["", labels[store].upper()[:width]]
        # Andere Läden haben nur einen Bereich; die Zwischenzeile wäre doppelt.
        if entry.area != area and entry.store == "supermarket":
            heading = f"-- {labels[entry.area]} "
            lines.append((heading + "-" * width)[:width])
        area = entry.area
        lines += _item_lines(entry, width)
    one, many = _COUNT[lang]
    open_count = sum(not entry.checked for entry in items)
    lines += ["", "-" * width, f"{open_count} {one if open_count == 1 else many}", ""]
    return "\n".join(lines)
