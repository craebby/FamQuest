"""Einkaufsliste: was fehlt, abhaken im Laden oder am Display.

Wie beim Essensplan ohne Eltern-PIN. Jeder Artikel gibt es nur einmal: Er steht auf der Liste oder
wartet als Vorschlag. Abgehakte bleiben bis zum Ende des Tages (Zeitzone der Familie) sichtbar,
damit sich ein falscher Tipp im Laden noch zurücknehmen lässt; danach sind sie von der Liste.

Geordnet wird im Frontend nach Laden und Bereich im Supermarkt (`area`): automatisch nach festen
Regeln, von Hand verschoben steht der Bereich am Artikel. Innerhalb eines Bereichs gilt die von Hand
gesetzte Reihenfolge (`position`), sonst die Zeit des Eintragens.
"""

import datetime as dt
from typing import Annotated, Literal

from fastapi import APIRouter, status
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import ColumnElement, and_, func, or_, select, update
from sqlalchemy.exc import IntegrityError

from app.auth import CurrentSession, DbSession, get_family
from app.errors import ApiError
from app.models import Family, ShoppingItem
from app.schemas import IconName, TypedName
from app.today import family_now

router = APIRouter(prefix="/shopping", tags=["shopping"])

# Menge oder Hinweis; leer = keiner.
Note = Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]

# Bereiche im Supermarkt (in der üblichen Reihenfolge des Laufwegs) und die anderen Läden.
Area = Literal[
    "produce",
    "bakery",
    "pantry",
    "sweets",
    "drinks",
    "household",
    "chilled",
    "frozen",
    "other",
    "drugstore",
    "hardware",
    "online",
]


class ListItemOut(BaseModel):
    id: int
    name: str
    icon: str
    note: str | None
    checked: bool
    # Von Hand gesetzt; None = automatisch.
    area: Area | None
    position: int | None


class ShoppingListOut(BaseModel):
    # Offene in der Reihenfolge des Eintragens, danach die heute abgehakten.
    items: list[ListItemOut]


class ShoppingItemOut(BaseModel):
    """Bekannter Artikel für die Vorschläge."""

    id: int
    name: str
    icon: str
    times_added: int
    on_list: bool


class AddIn(BaseModel):
    name: TypedName
    icon: IconName
    # None lässt die Notiz eines schon offenen Artikels stehen, "" löscht sie.
    note: Note | None = None


class EntryIn(BaseModel):
    """Einen Eintrag auf der Liste ändern, z. B. nach einem Tippfehler."""

    name: TypedName
    icon: IconName
    # "" löscht die Notiz.
    note: Note


class CheckIn(BaseModel):
    checked: bool


class ItemIn(BaseModel):
    name: TypedName
    icon: IconName


class AreaIn(BaseModel):
    # None gibt den Artikel an die automatische Zuordnung zurück.
    area: Area | None


class OrderIn(BaseModel):
    # Artikel eines Bereichs in der gewünschten Reihenfolge.
    ids: Annotated[list[int], Field(max_length=500)]


def _start_of_today(family: Family) -> dt.datetime:
    local = family_now(family)
    return local.replace(hour=0, minute=0, second=0, microsecond=0)


def _visible(family: Family) -> ColumnElement[bool]:
    """Steht auf der Liste: offen oder heute abgehakt."""
    return and_(
        ShoppingItem.on_list,
        or_(
            ShoppingItem.checked_at.is_(None),
            ShoppingItem.checked_at >= _start_of_today(family),
        ),
    )


def _is_visible(family: Family, item: ShoppingItem) -> bool:
    return item.on_list and (item.checked_at is None or item.checked_at >= _start_of_today(family))


def _list_item(item: ShoppingItem) -> ListItemOut:
    return ListItemOut(
        id=item.id,
        name=item.name,
        icon=item.icon,
        note=item.note,
        checked=item.checked_at is not None,
        area=item.area,
        position=item.position,
    )


def _take_off(item: ShoppingItem) -> None:
    item.on_list, item.note, item.checked_at = False, None, None


def _find(db: DbSession, name: str) -> ShoppingItem | None:
    return db.scalar(select(ShoppingItem).where(func.lower(ShoppingItem.name) == name.lower()))


def _get(db: DbSession, item_id: int) -> ShoppingItem:
    item = db.get(ShoppingItem, item_id)
    if item is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "shopping.not_found")
    return item


@router.get("/list")
def shopping_list(_: CurrentSession, db: DbSession) -> ShoppingListOut:
    family = get_family(db)
    items = db.scalars(
        select(ShoppingItem)
        .where(_visible(family))
        .order_by(
            ShoppingItem.checked_at.is_not(None),
            ShoppingItem.checked_at,
            ShoppingItem.added_at,
            ShoppingItem.id,
        )
    )
    return ShoppingListOut(items=[_list_item(item) for item in items])


@router.post("/list")
def add_to_list(body: AddIn, _: CurrentSession, db: DbSession) -> ListItemOut:
    """Setzt einen Artikel auf die Liste. Ein unbekannter Name legt ihn an; das Symbol gilt für den
    Artikel. Steht er schon offen darauf, ändern sich nur Symbol und Notiz."""
    item = _find(db, body.name)
    if item is None:
        item = ShoppingItem(name=body.name, icon=body.icon, times_added=0)
        db.add(item)
        try:
            db.flush()
        except IntegrityError:
            # Gleichzeitig auf einem anderen Gerät angelegt.
            db.rollback()
            item = _find(db, body.name)
            assert item is not None
    item.icon = body.icon
    if not item.on_list or item.checked_at is not None:
        item.on_list, item.checked_at, item.note = True, None, None
        item.added_at = family_now(get_family(db))
        item.times_added += 1
    if body.note is not None:
        item.note = body.note or None
    db.commit()
    return _list_item(item)


# Vor /list/{item_id}, sonst hielte FastAPI „checked“ für eine ID.
@router.delete("/list/checked", status_code=status.HTTP_204_NO_CONTENT)
def clear_checked(_: CurrentSession, db: DbSession) -> None:
    """Nimmt alle abgehakten Artikel von der Liste."""
    db.execute(
        update(ShoppingItem)
        .where(ShoppingItem.on_list, ShoppingItem.checked_at.is_not(None))
        .values(on_list=False, note=None, checked_at=None)
    )
    db.commit()


@router.put("/list/{item_id}/checked")
def set_checked(item_id: int, body: CheckIn, _: CurrentSession, db: DbSession) -> ListItemOut:
    """Abhaken oder zurücknehmen; nur für Artikel, die (noch) auf der Liste stehen."""
    item = _get(db, item_id)
    family = get_family(db)
    if not _is_visible(family, item):
        raise ApiError(status.HTTP_404_NOT_FOUND, "shopping.not_on_list")
    if body.checked and item.checked_at is None:
        item.checked_at = family_now(family)
    elif not body.checked:
        item.checked_at = None
    db.commit()
    return _list_item(item)


@router.put("/list/{item_id}")
def edit_entry(item_id: int, body: EntryIn, _: CurrentSession, db: DbSession) -> ListItemOut:
    """Name, Symbol und Notiz eines Eintrags ändern (ohne Eltern-PIN).

    Ein Artikel, der nur für diesen Eintrag angelegt wurde (Tippfehler), wird umbenannt. Ein
    gewohnter Artikel bleibt als Vorschlag, wie er ist; stattdessen kommt der Artikel mit dem
    neuen Namen auf die Liste (gibt es ihn schon, der bekannte). Er übernimmt, ob abgehakt.
    Antwortet mit dem Eintrag, der danach auf der Liste steht (womöglich mit anderer ID)."""
    item = _get(db, item_id)
    family = get_family(db)
    if not _is_visible(family, item):
        raise ApiError(status.HTTP_404_NOT_FOUND, "shopping.not_on_list")
    target = _find(db, body.name)
    if target is None and item.times_added <= 1 or target is item:
        item.name = body.name
        target = item
    else:
        if target is None:
            target = ShoppingItem(name=body.name, icon=body.icon, times_added=0)
            db.add(target)
        if not _is_visible(family, target):
            target.on_list, target.added_at = True, item.added_at
            target.times_added += 1
        target.checked_at = item.checked_at
        _take_off(item)
        if item.times_added <= 1:
            # Nur für diesen Eintrag angelegt: kein Tippfehler bleibt als Vorschlag übrig.
            db.delete(item)
        else:
            item.times_added -= 1
    target.icon, target.note = body.icon, body.note or None
    try:
        db.commit()
    except IntegrityError as error:
        # Gleichzeitig auf einem anderen Gerät angelegt.
        raise ApiError(status.HTTP_409_CONFLICT, "shopping.duplicate_name") from error
    return _list_item(target)


@router.delete("/list/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_list(item_id: int, _: CurrentSession, db: DbSession) -> None:
    """Nimmt einen Artikel von der Liste; er bleibt als Vorschlag erhalten."""
    _take_off(_get(db, item_id))
    db.commit()


@router.put("/items/{item_id}/area", status_code=status.HTTP_204_NO_CONTENT)
def set_area(item_id: int, body: AreaIn, _: CurrentSession, db: DbSession) -> None:
    """In einen anderen Laden oder Bereich verschieben; gilt auch beim nächsten Eintragen. Im neuen
    Bereich steht der Artikel zunächst hinten."""
    item = _get(db, item_id)
    if item.area != body.area:
        item.area, item.position = body.area, None
    db.commit()


@router.put("/order", status_code=status.HTTP_204_NO_CONTENT)
def set_order(body: OrderIn, _: CurrentSession, db: DbSession) -> None:
    """Reihenfolge innerhalb eines Bereichs. Was es nicht mehr gibt, wird übergangen."""
    known = {
        item.id: item
        for item in db.scalars(select(ShoppingItem).where(ShoppingItem.id.in_(body.ids)))
    }
    for index, item_id in enumerate(body.ids):
        if item_id in known:
            known[item_id].position = index
    db.commit()


@router.get("/items")
def list_items(_: CurrentSession, db: DbSession) -> list[ShoppingItemOut]:
    """Alle bekannten Artikel, häufig gekaufte zuerst."""
    items = db.scalars(
        select(ShoppingItem).order_by(
            ShoppingItem.times_added.desc(),
            ShoppingItem.added_at.desc().nulls_last(),
            func.lower(ShoppingItem.name),
        )
    )
    return [_item_out(item) for item in items]


def _item_out(item: ShoppingItem) -> ShoppingItemOut:
    return ShoppingItemOut(
        id=item.id,
        name=item.name,
        icon=item.icon,
        times_added=item.times_added,
        # Offen auf der Liste; abgehakte zählen nicht, die lassen sich neu eintragen.
        on_list=item.on_list and item.checked_at is None,
    )


@router.put("/items/{item_id}")
def update_item(item_id: int, body: ItemIn, _: CurrentSession, db: DbSession) -> ShoppingItemOut:
    """Name und Symbol ändern; gilt auch auf der Liste."""
    item = _get(db, item_id)
    other = _find(db, body.name)
    if other is not None and other.id != item.id:
        raise ApiError(status.HTTP_409_CONFLICT, "shopping.duplicate_name")
    item.name, item.icon = body.name, body.icon
    try:
        db.commit()
    except IntegrityError as error:
        raise ApiError(status.HTTP_409_CONFLICT, "shopping.duplicate_name") from error
    return _item_out(item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, _: CurrentSession, db: DbSession) -> None:
    """Löscht einen Artikel ganz, auch von der Liste."""
    db.delete(_get(db, item_id))
    db.commit()
