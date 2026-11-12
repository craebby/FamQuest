"""Einkaufsliste an einen Bon-Drucker schicken.

FamQuest druckt nicht selbst: Es schickt die Liste per POST (JSON) an eine Adresse, die die Eltern
eintragen, z. B. eine kleine Drucker-App oder einen Webhook in Home Assistant. Die Adresse darf im
Heimnetz liegen; deshalb lässt sie sich nur mit Eltern-PIN ändern und nicht in der Demo.
"""

import httpx2 as httpx
from fastapi import status
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.logs import logger
from app.models import Family
from app.receipt import Entry, entries, language, receipt_text
from app.today import family_now

# Tests setzen hier einen httpx.MockTransport ein.
transport: httpx.BaseTransport | None = None


def _item(entry: Entry) -> dict:
    return {
        "id": entry.id,
        "name": entry.name,
        "note": entry.note,
        "recipes": entry.recipes,
        "store": entry.store,
        "area": entry.area,
    }


def payload(db: Session, family: Family, lang: str | None = None) -> dict:
    """Was an den Drucker geht: fertiger Text und die Artikel zum eigenen Gestalten."""
    lang = language(family, lang)
    items = entries(db, family)
    now = family_now(family)
    return {
        "kind": "shopping_list",
        "family": family.name,
        "date": now.date().isoformat(),
        "language": lang,
        "width": family.print_width,
        "text": receipt_text(family, items, width=family.print_width, lang=lang, now=now),
        "items": [_item(entry) for entry in items],
    }


def send(db: Session, family: Family, lang: str | None = None) -> int:
    """Schickt die offene Liste an den Drucker; antwortet mit der Zahl der Artikel."""
    if not family.print_url:
        raise ApiError(status.HTTP_409_CONFLICT, "print.not_configured")
    body = payload(db, family, lang)
    try:
        with httpx.Client(timeout=15, transport=transport) as client:
            response = client.post(family.print_url, json=body)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Drucken an %s fehlgeschlagen: %s", family.print_url, exc)
        raise ApiError(status.HTTP_502_BAD_GATEWAY, "print.failed") from exc
    return len(body["items"])
