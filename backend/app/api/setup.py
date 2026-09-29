from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import exists, select, text

from app.auth import DbSession, check_origin, me_response, start_session
from app.config import get_settings
from app.demo import PIN as DEMO_PIN
from app.errors import ApiError
from app.logs import logger
from app.models import Family, User
from app.schemas import Email, FamilyName, LanguageCode, MeResponse, Password, Pin, Timezone
from app.security import hash_secret

router = APIRouter(prefix="/setup", tags=["setup"])

# Beliebige, feste Zahl für pg_advisory_xact_lock: serialisiert gleichzeitige Setup-Versuche.
_SETUP_LOCK_ID = 7_300_001


class DemoInfo(BaseModel):
    """Öffentliche Demo: Sprache der Beispielfamilie, Eltern-PIN und Abstand der Resets."""

    language: str
    pin: str
    reset_minutes: int


class SetupStatus(BaseModel):
    setup_required: bool
    demo: DemoInfo | None = None


class SetupRequest(BaseModel):
    language: LanguageCode
    family_name: FamilyName
    email: Email
    password: Password
    pin: Pin
    timezone: Timezone = "Europe/Berlin"


def _setup_done(db: DbSession) -> bool:
    return db.scalar(select(exists().select_from(User)))


@router.get("/status")
def setup_status(db: DbSession) -> SetupStatus:
    settings = get_settings()
    demo = None
    if settings.demo_mode:
        demo = DemoInfo(
            language=settings.demo_mode, pin=DEMO_PIN, reset_minutes=settings.demo_reset_minutes
        )
    return SetupStatus(setup_required=not _setup_done(db), demo=demo)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(check_origin)],
)
def run_setup(
    body: SetupRequest, request: Request, response: Response, db: DbSession
) -> MeResponse:
    db.execute(text("SELECT pg_advisory_xact_lock(:id)"), {"id": _SETUP_LOCK_ID})
    # Sperre der Registrierung: Sobald ein Konto existiert, ist das Setup dauerhaft zu.
    if _setup_done(db) or db.scalar(select(exists().select_from(Family))):
        raise ApiError(status.HTTP_409_CONFLICT, "setup.already_done")

    db.add(
        Family(
            name=body.family_name,
            default_language=body.language,
            timezone=body.timezone,
            parent_pin_hash=hash_secret(body.pin),
            pin_enabled=True,
        )
    )
    user = User(email=body.email, password_hash=hash_secret(body.password), role="admin")
    db.add(user)
    auth_session = start_session(db, request, response, user)
    db.commit()
    logger.info("Einrichtung abgeschlossen: Konto %s angelegt, Registrierung gesperrt", user.id)
    return me_response(db, auth_session)
