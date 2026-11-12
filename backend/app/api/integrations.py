"""Schnittstellen im Elternbereich: API-Schlüssel für andere Programme und der Bon-Drucker.

Schlüssel anlegen, löschen und die Druck-Adresse ändern braucht die Eltern-PIN. Drucken selbst
geht wie die Einkaufsliste ohne PIN.
"""

import datetime as dt
from typing import Annotated, Literal

from fastapi import APIRouter, status
from pydantic import AfterValidator, BaseModel, Field, StringConstraints
from pydantic_core import PydanticCustomError
from sqlalchemy import select

from app import printing
from app.api_tokens import create_token
from app.auth import CurrentSession, DbSession, ParentSession, get_family
from app.demo_mode import NotInDemo
from app.errors import ApiError
from app.models import ApiToken, Family

router = APIRouter(tags=["integrations"])

# So viele Schlüssel reichen für Drucker, Home Assistant und ein paar Versuche.
MAX_TOKENS = 20

Scope = Literal["read", "write"]
TokenName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


def _url(value: str) -> str:
    if not value.startswith(("http://", "https://")) or " " in value or len(value) < 10:
        raise PydanticCustomError("validation.invalid_url", "invalid url")
    return value


PrintUrl = Annotated[
    str, StringConstraints(strip_whitespace=True, max_length=300), AfterValidator(_url)
]


class TokenOut(BaseModel):
    id: int
    name: str
    prefix: str
    scope: Scope
    created_at: dt.datetime
    last_used_at: dt.datetime | None


class NewTokenOut(TokenOut):
    # Nur jetzt einmal zu sehen; gespeichert ist nur der Hash.
    token: str


class TokenIn(BaseModel):
    name: TokenName
    scope: Scope = "read"


class PrinterOut(BaseModel):
    url: str | None
    width: int
    # Webseite der Druck-App (z. B. Druckstation am Pi), öffnet sich in der Küchenansicht.
    app_url: str | None


class PrinterIn(BaseModel):
    # None = kein Drucker.
    url: PrintUrl | None
    width: Annotated[int, Field(ge=16, le=80)] = 32
    app_url: PrintUrl | None = None


class PrintIn(BaseModel):
    lang: Literal["de", "en"] | None = None


class PrintedOut(BaseModel):
    items: int


def _out(token: ApiToken) -> TokenOut:
    return TokenOut(
        id=token.id,
        name=token.name,
        prefix=token.prefix,
        scope=token.scope,  # type: ignore[arg-type]
        created_at=token.created_at,
        last_used_at=token.last_used_at,
    )


@router.get("/integrations/tokens")
def list_tokens(_: ParentSession, db: DbSession) -> list[TokenOut]:
    return [_out(token) for token in db.scalars(select(ApiToken).order_by(ApiToken.id))]


@router.post("/integrations/tokens", status_code=status.HTTP_201_CREATED, dependencies=[NotInDemo])
def add_token(body: TokenIn, _: ParentSession, db: DbSession) -> NewTokenOut:
    if len(list(db.scalars(select(ApiToken.id)))) >= MAX_TOKENS:
        raise ApiError(status.HTTP_409_CONFLICT, "api.too_many_tokens")
    token, hashed, prefix = create_token()
    entry = ApiToken(name=body.name, token_hash=hashed, prefix=prefix, scope=body.scope)
    db.add(entry)
    db.commit()
    return NewTokenOut(**_out(entry).model_dump(), token=token)


@router.delete("/integrations/tokens/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_token(token_id: int, _: ParentSession, db: DbSession) -> None:
    token = db.get(ApiToken, token_id)
    if token is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "api.token_not_found")
    db.delete(token)
    db.commit()


def _printer(family: Family) -> PrinterOut:
    return PrinterOut(url=family.print_url, width=family.print_width, app_url=family.print_app_url)


@router.get("/integrations/printer")
def get_printer(_: CurrentSession, db: DbSession) -> PrinterOut:
    """Auch ohne PIN: Die Einkaufsliste zeigt den Drucker-Knopf nur, wenn es einen gibt."""
    return _printer(get_family(db))


@router.put("/integrations/printer", dependencies=[NotInDemo])
def set_printer(body: PrinterIn, _: ParentSession, db: DbSession) -> PrinterOut:
    family = get_family(db)
    family.print_url, family.print_width = body.url, body.width
    family.print_app_url = body.app_url
    db.commit()
    return _printer(family)


@router.post("/shopping/print", dependencies=[NotInDemo])
def print_list(body: PrintIn, _: CurrentSession, db: DbSession) -> PrintedOut:
    """Schickt die offene Einkaufsliste an den Bon-Drucker."""
    return PrintedOut(items=printing.send(db, get_family(db), body.lang))
