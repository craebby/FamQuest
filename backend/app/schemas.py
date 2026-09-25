import datetime as dt
import re
from functools import lru_cache
from typing import Annotated, Literal
from zoneinfo import available_timezones

from pydantic import AfterValidator, BaseModel, Field, StringConstraints
from pydantic_core import PydanticCustomError

PASSWORD_MIN_LENGTH = 10
# Rollen und Farben von Familienmitgliedern. Neue Werte lassen sich hier ergänzen;
# die Farbwerte selbst stehen im Frontend (frontend/src/memberColors.ts).
MEMBER_ROLES = ("parent", "child")
MEMBER_COLORS = ("orange", "blue", "purple", "green", "red", "teal", "yellow")
# Tagesabschnitte in zeitlicher Reihenfolge; weitere Werte lassen sich ergänzen.
TIMES_OF_DAY = ("morning", "midday", "afternoon", "evening")
TASK_MAX_POINTS = 1000
# Arten von Punktebuchungen.
POINT_KINDS = ("task_completed", "task_undone", "manual", "reward_redeemed")
MANUAL_MAX_POINTS = 1000
REWARD_MAX_COST = 1000
# Status von Einlösungen; ein Freigabeprozess (requested, approved, rejected) kann folgen.
REDEMPTION_STATUSES = ("redeemed",)
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


def _unique_sorted(values: list[int]) -> list[int]:
    return sorted(set(values))


def _not_zero(value: int) -> int:
    if value == 0:
        raise PydanticCustomError("validation.not_zero", "must not be zero")
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
TaskTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
TaskDescription = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
# Iconify-Name "set:icon"; die Auswahl selbst kommt aus dem Icon-Katalog im Frontend.
IconName = Annotated[str, Field(max_length=100, pattern=r"^[a-z0-9-]+:[a-z0-9-]+$")]
TimeOfDay = Annotated[str, _one_of(TIMES_OF_DAY)]
RewardName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
PointReason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
Weekday = Annotated[int, Field(ge=1, le=7)]


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


class DailyRecurrence(BaseModel):
    kind: Literal["daily"]


class WeeklyRecurrence(BaseModel):
    kind: Literal["weekly"]
    # ISO-Wochentage: 1 = Montag … 7 = Sonntag
    weekdays: Annotated[list[Weekday], Field(min_length=1), AfterValidator(_unique_sorted)]


class OnceRecurrence(BaseModel):
    kind: Literal["once"]
    date: dt.date


# Neue Arten (z. B. alle zwei Wochen, monatlich) kommen hier als weiteres Modell dazu.
Recurrence = Annotated[
    DailyRecurrence | WeeklyRecurrence | OnceRecurrence, Field(discriminator="kind")
]


class TaskIn(BaseModel):
    title: TaskTitle
    icon: IconName
    description: TaskDescription = ""
    points: Annotated[int, Field(ge=0, le=TASK_MAX_POINTS)]
    time_of_day: TimeOfDay | None = None
    color: MemberColor | None = None
    active: bool = True
    recurrence: Recurrence
    member_ids: Annotated[list[int], Field(min_length=1), AfterValidator(_unique_sorted)]


class TaskOut(BaseModel):
    id: int
    title: str
    icon: str
    description: str
    points: int
    time_of_day: str | None
    color: str | None
    active: bool
    recurrence: Recurrence
    member_ids: list[int]


class TodayTaskOut(BaseModel):
    id: int
    title: str
    icon: str
    points: int
    time_of_day: str | None
    color: str | None
    member_ids: list[int]
    # Personen, die die Aufgabe heute schon erledigt haben.
    done_member_ids: list[int]


class MemberPointsOut(BaseModel):
    member_id: int
    # Heute mit Aufgaben verdiente Punkte (Tag in der Zeitzone der Familie).
    today: int
    total: int


class TodayOut(BaseModel):
    date: dt.date
    time_of_day: str
    tasks: list[TodayTaskOut]
    points: list[MemberPointsOut]


class PointBookingIn(BaseModel):
    """Manuelle Gutschrift (positiv) oder Abzug (negativ) durch die Eltern."""

    amount: Annotated[
        int,
        Field(ge=-MANUAL_MAX_POINTS, le=MANUAL_MAX_POINTS),
        AfterValidator(_not_zero),
    ]
    reason: PointReason


class PointTransactionOut(BaseModel):
    id: int
    amount: int
    kind: str
    reason: str | None
    # Icon der Aufgabe (solange sie noch existiert) bzw. der eingelösten Belohnung.
    icon: str | None
    task_date: dt.date | None
    created_at: dt.datetime


class PointHistoryOut(BaseModel):
    total: int
    transactions: list[PointTransactionOut]
    # Es gibt ältere Buchungen; abrufbar mit `before=<id der letzten Buchung>`.
    has_more: bool


class RewardIn(BaseModel):
    member_id: int
    name: RewardName
    icon: IconName
    description: TaskDescription = ""
    cost: Annotated[int, Field(ge=1, le=REWARD_MAX_COST)]
    active: bool = True


class RewardOut(BaseModel):
    id: int
    member_id: int
    name: str
    icon: str
    description: str
    cost: int
    active: bool


class RedemptionOut(BaseModel):
    id: int
    reward_id: int | None
    member_id: int
    status: str
    reward_name: str
    reward_icon: str
    cost: int
    created_at: dt.datetime


class RedemptionHistoryOut(BaseModel):
    redemptions: list[RedemptionOut]
    # Es gibt ältere Einlösungen; abrufbar mit `before=<id der letzten Einlösung>`.
    has_more: bool
