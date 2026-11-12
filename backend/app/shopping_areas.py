"""Laden und Bereich eines Artikels auf der Einkaufsliste, wie im Frontend
(`frontend/src/pages/shopping/areas.ts`).

Die Regeln (Stichwörter je Bereich, Symbole) stehen in `area-rules.json` im Frontend; der Server
braucht sie für den Bon und die API. Im Image liegt eine Kopie neben diesem Modul (Dockerfile).
"""

import json
import re
import unicodedata
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Literal

Store = Literal["supermarket", "drugstore", "hardware", "online"]

# Bereiche im Supermarkt in der Reihenfolge des Laufwegs, danach die anderen Läden.
SUPERMARKET_AREAS = (
    "produce",
    "bakery",
    "pantry",
    "sweets",
    "drinks",
    "household",
    "chilled",
    "frozen",
    "other",
)
STORES: tuple[Store, ...] = ("supermarket", "drugstore", "hardware", "online")
AREAS = (*SUPERMARKET_AREAS, "drugstore", "hardware", "online")
FALLBACK_AREA = "other"

ICON_SET = "fluent-emoji-flat"
# Symbol für einen Artikel, den die API ohne bekanntes Symbol einträgt.
DEFAULT_ICONS = {
    "drugstore": f"{ICON_SET}:lotion-bottle",
    "hardware": f"{ICON_SET}:toolbox",
    "online": f"{ICON_SET}:package",
}
DEFAULT_ICON = f"{ICON_SET}:shopping-bags"

_RULE_FILES = (
    Path(__file__).with_name("area-rules.json"),
    Path(__file__).resolve().parents[2] / "frontend/src/pages/shopping/area-rules.json",
)

_FROZEN = re.compile(r" (tk[ -]|tiefkuhl|tiefgekuhlt|gefroren|frozen )")
# Alles außer Buchstaben, Ziffern und Bindestrich trennt Wörter (wie `\p{L}\p{N}-` im Frontend).
_SEPARATORS = re.compile(r"[^\w-]+|_+")


@dataclass(frozen=True)
class _Rules:
    keywords: tuple[tuple[str, str], ...]
    icons: dict[str, str]


@cache
def _rules() -> _Rules:
    for path in _RULE_FILES:
        if path.is_file():
            data = json.loads(path.read_text(encoding="utf-8"))
            keywords = tuple(
                (word, area) for area in AREAS for word in data["keywords"].get(area, [])
            )
            return _Rules(keywords=keywords, icons=data["icons"])
    raise FileNotFoundError("area-rules.json fehlt (siehe Dockerfile)")


def normalize(text: str) -> str:
    """Klein, ohne Umlautpunkte und Akzente, ß als ss (wie `normalize` im Frontend)."""
    decomposed = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c)).replace("ß", "ss")


def _padded(name: str) -> str:
    return f" {_SEPARATORS.sub(' ', normalize(name))} "


def _area_by_name(name: str) -> str | None:
    """Das Stichwort, das am weitesten hinten endet, gewinnt; bei Gleichstand das längere."""
    text = _padded(name)
    best: tuple[int, int, str] | None = None
    for word, area in _rules().keywords:
        short = len(word) <= 3
        start = text.find(word)
        while start != -1:
            end = start + len(word)
            if not (short and text[end] != " ") and (
                best is None or (end, len(word)) > (best[0], best[1])
            ):
                best = (end, len(word), area)
            start = text.find(word, start + 1)
    return best[2] if best else None


def _icon_name(icon: str) -> str | None:
    icon_set, _, name = icon.partition(":")
    return name if icon_set == ICON_SET and name else None


def auto_area(name: str, icon: str) -> str:
    """Bereich nach Stichwörtern im Namen, sonst nach dem Symbol, sonst „Sonstiges“."""
    if _FROZEN.search(_padded(name)):
        return "frozen"
    return _area_by_name(name) or _rules().icons.get(_icon_name(icon) or "") or FALLBACK_AREA


def store_of(area: str) -> Store:
    return "supermarket" if area in SUPERMARKET_AREAS else area  # type: ignore[return-value]


def default_icon(name: str) -> str:
    """Symbol für einen neuen Artikel ohne Symbol (z. B. aus Home Assistant)."""
    return DEFAULT_ICONS.get(auto_area(name, ""), DEFAULT_ICON)


# Namen der Läden und Bereiche für den Bon (wie `shopping.store.*` / `shopping.area.*` im
# Frontend).
LABELS: dict[str, dict[str, str]] = {
    "de": {
        "supermarket": "Supermarkt",
        "drugstore": "Drogerie",
        "hardware": "Baumarkt",
        "online": "Online",
        "produce": "Obst & Gemüse",
        "bakery": "Brot & Backwaren",
        "pantry": "Vorrat",
        "sweets": "Süßes & Snacks",
        "drinks": "Getränke",
        "household": "Haushalt & Tier",
        "chilled": "Kühlung",
        "frozen": "Tiefkühl",
        "other": "Sonstiges",
    },
    "en": {
        "supermarket": "Supermarket",
        "drugstore": "Drugstore",
        "hardware": "DIY store",
        "online": "Online",
        "produce": "Fruit & veg",
        "bakery": "Bread & bakery",
        "pantry": "Cupboard",
        "sweets": "Sweets & snacks",
        "drinks": "Drinks",
        "household": "Household & pets",
        "chilled": "Chilled",
        "frozen": "Frozen",
        "other": "Other",
    },
}
