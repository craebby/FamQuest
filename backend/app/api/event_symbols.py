"""Symbole für Termine verwalten (Elternbereich); angewandt in api/calendar_week.py."""

import re
from typing import Annotated

from fastapi import APIRouter
from pydantic import AfterValidator, BaseModel, Field, StringConstraints

from app.auth import DbSession, ParentSession, get_family
from app.event_symbols import normalize
from app.schemas import IconName

router = APIRouter(prefix="/calendar", tags=["calendar"])

MAX_SYMBOLS = 100
MAX_TERMS = 20


def _clean_term(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


Term = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=50),
    AfterValidator(_clean_term),
]


def _unique_terms(terms: list[str]) -> list[str]:
    # Gleiche Begriffe in anderer Schreibweise nur einmal, der erste bleibt.
    seen: set[str] = set()
    unique = []
    for term in terms:
        if normalize(term) not in seen:
            seen.add(normalize(term))
            unique.append(term)
    return unique


class EventSymbol(BaseModel):
    icon: IconName
    terms: Annotated[
        list[Term], Field(min_length=1, max_length=MAX_TERMS), AfterValidator(_unique_terms)
    ]


class EventSymbolsIn(BaseModel):
    symbols: Annotated[list[EventSymbol], Field(max_length=MAX_SYMBOLS)]


class EventSymbolsOut(BaseModel):
    symbols: list[EventSymbol]


@router.get("/symbols")
def get_symbols(_: ParentSession, db: DbSession) -> EventSymbolsOut:
    return EventSymbolsOut(symbols=get_family(db).event_symbols or [])


@router.put("/symbols")
def set_symbols(body: EventSymbolsIn, _: ParentSession, db: DbSession) -> EventSymbolsOut:
    """Ersetzt alle Symbole; die Liste wird so gespeichert, wie sie angezeigt wird."""
    family = get_family(db)
    family.event_symbols = [symbol.model_dump() for symbol in body.symbols]
    db.commit()
    return EventSymbolsOut(symbols=family.event_symbols)
