import re
from functools import lru_cache
from typing import Annotated
from zoneinfo import available_timezones

from pydantic import AfterValidator, BaseModel, Field, StringConstraints
from pydantic_core import PydanticCustomError

PASSWORD_MIN_LENGTH = 10
# Rollen und Farben von Familienmitgliedern. Neue Werte lassen sich hier ergänzen;
# die Farbwerte selbst stehen im Frontend (frontend/src/memberColors.ts).
MEMBER_ROLES = ("parent", "child")
MEMBER_COLORS = ("orange", "blue", "purple", "green", "red", "teal", "yellow")
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+$")


def _normalize_email(value: str) -> str:
    # Bewusst einfache Prüfung: Adressen wie "mama@familie.local" sollen im LAN erlaubt sein.
    value = value.strip().lower()
    if len(value) > 254 or not _EMAIL_PATTERN.match(value):
        raise PydanticCustomError("validation.invalid_email", "invalid email")
    return value


@lru_cache
def _timezones() -> frozenset[str]:
    return frozenset(available_timezones())


def _check_timezone(value: str) -> str:
    if value not in _timezones():
        raise PydanticCustomError("validation.invalid_timezone", "invalid timezone")
    return value


def _one_of(values: tuple[str, ...]) -> AfterValidator:
    def check(value: str) -> str:
        if value not in values:
            raise PydanticCustomError("validation.invalid_choice", "invalid choice")
        return value

    return AfterValidator(check)


Email = Annotated[str, AfterValidator(_normalize_email)]
Password = Annotated[str, Field(min_length=PASSWORD_MIN_LENGTH, max_length=256)]
Pin = Annotated[str, Field(pattern=r"^\d{4,8}$")]
LanguageCode = Annotated[str, Field(pattern=r"^[a-z]{2}$")]
Timezone = Annotated[str, AfterValidator(_check_timezone)]
FamilyName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
MemberName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
MemberRole = Annotated[str, _one_of(MEMBER_ROLES)]
MemberColor = Annotated[str, _one_of(MEMBER_COLORS)]


class UserOut(BaseModel):
    email: str
    role: str
    language: str | None


class FamilyOut(BaseModel):
    name: str
    default_language: str
    timezone: str
    pin_enabled: bool


class MeResponse(BaseModel):
    user: UserOut
    family: FamilyOut
    csrf_token: str
    parent_unlocked: bool


class MemberIn(BaseModel):
    name: MemberName
    role: MemberRole
    color: MemberColor


class MemberOut(BaseModel):
    id: int
    name: str
    role: str
    color: str
    avatar_url: str | None
