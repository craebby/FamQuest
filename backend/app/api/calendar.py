from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, BackgroundTasks, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import delete, exists, func, select

from app import google
from app.auth import (
    SESSION_COOKIE,
    CurrentSession,
    DbSession,
    ParentSession,
    get_family,
    unlock_parent_area,
    utcnow,
)
from app.calendar_sync import clear_events, refresh_calendar_list, sync_all
from app.config import get_settings
from app.errors import ApiError
from app.logs import logger
from app.models import AuthSession, Calendar, CalendarConnection, FamilyMember, OAuthState
from app.schemas import FamilyColor
from app.security import new_token, token_hash

router = APIRouter(prefix="/calendar", tags=["calendar"])

# So lange darf die Anmeldung bei Google dauern.
STATE_LIFETIME = timedelta(minutes=10)
# Nach der Rückkehr von Google landen die Eltern wieder hier.
PARENTS_PAGE = "/parents"


class CalendarOut(BaseModel):
    id: int
    name: str
    primary: bool
    selected: bool
    # None = gehört der ganzen Familie (nur relevant, wenn ausgewählt).
    member_id: int | None
    synced_at: datetime | None
    # Fehlercode der letzten Synchronisation, z. B. `calendar.google_unreachable`.
    sync_error: str | None


class ConnectionOut(BaseModel):
    id: int
    provider: str
    account_email: str
    status: Literal["ok", "reconnect"]
    created_at: datetime
    calendars: list[CalendarOut]


class CalendarSettingsOut(BaseModel):
    # False, solange GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET oder TOKEN_ENCRYPTION_KEY fehlen.
    configured: bool
    # Muss in der Google Cloud Console als „Autorisierte Weiterleitungs-URI“ eingetragen sein.
    redirect_uri: str
    family_color: str
    connections: list[ConnectionOut]


class CalendarIn(BaseModel):
    selected: bool
    # None = ganze Familie.
    member_id: int | None = None


class FamilyColorIn(BaseModel):
    color: FamilyColor


class CalendarStatusOut(BaseModel):
    # Mindestens ein Kalender ist ausgewählt; sonst zeigt das Display keinen Kalender an.
    enabled: bool


class ConnectOut(BaseModel):
    url: str


def redirect_uri(request: Request) -> str:
    # Hinter einem Reverse Proxy stimmen Schema und Host dank der Proxy-Header.
    return str(request.url_for("google_callback"))


def settings_out(request: Request, db: DbSession) -> CalendarSettingsOut:
    connections = db.scalars(select(CalendarConnection).order_by(CalendarConnection.id)).all()
    # Hauptkalender zuerst, dann alphabetisch.
    calendars = db.scalars(
        select(Calendar).order_by(Calendar.primary.desc(), func.lower(Calendar.name), Calendar.id)
    ).all()
    return CalendarSettingsOut(
        configured=get_settings().calendar_configured,
        redirect_uri=redirect_uri(request),
        family_color=get_family(db).calendar_color,
        connections=[
            ConnectionOut(
                id=c.id,
                provider=c.provider,
                account_email=c.account_email,
                status=c.status,
                created_at=c.created_at,
                calendars=[
                    CalendarOut(
                        id=calendar.id,
                        name=calendar.name,
                        primary=calendar.primary,
                        selected=calendar.selected,
                        member_id=calendar.member_id,
                        synced_at=calendar.synced_at,
                        sync_error=calendar.sync_error,
                    )
                    for calendar in calendars
                    if calendar.connection_id == c.id
                ],
            )
            for c in connections
        ],
    )


@router.get("/settings")
def calendar_settings(
    request: Request, auth_session: ParentSession, db: DbSession
) -> CalendarSettingsOut:
    return settings_out(request, db)


@router.get("/status")
def calendar_status(_: CurrentSession, db: DbSession) -> CalendarStatusOut:
    return CalendarStatusOut(enabled=bool(db.scalar(select(exists().where(Calendar.selected)))))


@router.put("/calendars/{calendar_id}")
def update_calendar(
    calendar_id: int,
    body: CalendarIn,
    request: Request,
    background: BackgroundTasks,
    auth_session: ParentSession,
    db: DbSession,
) -> CalendarSettingsOut:
    """Kalender anzeigen oder nicht und einer Person oder der Familie zuordnen."""
    calendar = db.get(Calendar, calendar_id)
    if calendar is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "calendar.calendar_not_found")
    if body.member_id is not None and db.get(FamilyMember, body.member_id) is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "member.not_found")

    newly_selected = body.selected and not calendar.selected
    calendar.selected = body.selected
    calendar.member_id = body.member_id
    if not body.selected:
        clear_events(db, calendar)
    db.commit()
    if newly_selected and get_settings().calendar_configured:
        # Termine gleich laden, nicht erst beim nächsten Durchlauf im Hintergrund.
        background.add_task(sync_all)
    return settings_out(request, db)


@router.put("/family-color")
def set_family_color(
    body: FamilyColorIn, request: Request, auth_session: ParentSession, db: DbSession
) -> CalendarSettingsOut:
    get_family(db).calendar_color = body.color
    db.commit()
    return settings_out(request, db)


@router.post("/sync")
def sync_now(request: Request, auth_session: ParentSession, db: DbSession) -> CalendarSettingsOut:
    """„Jetzt aktualisieren“; läuft gerade ein Durchlauf, gilt dessen Ergebnis."""
    if not get_settings().calendar_configured:
        raise ApiError(status.HTTP_409_CONFLICT, "calendar.not_configured")
    sync_all()
    db.expire_all()
    return settings_out(request, db)


@router.post("/google/connect")
def connect_google(request: Request, auth_session: ParentSession, db: DbSession) -> ConnectOut:
    """Startet die Anmeldung bei Google; das Frontend leitet zur gelieferten Adresse weiter."""
    if not get_settings().calendar_configured:
        raise ApiError(status.HTTP_409_CONFLICT, "calendar.not_configured")

    now = utcnow()
    db.execute(delete(OAuthState).where(OAuthState.expires_at <= now))
    state = new_token()
    verifier, challenge = google.new_pkce()
    uri = redirect_uri(request)
    db.add(
        OAuthState(
            state_hash=token_hash(state),
            session_id=auth_session.id,
            code_verifier=verifier,
            redirect_uri=uri,
            expires_at=now + STATE_LIFETIME,
        )
    )
    db.commit()
    return ConnectOut(url=google.authorization_url(state, challenge, uri))


def _back_to_parents(**params: str) -> RedirectResponse:
    return RedirectResponse(
        f"{PARENTS_PAGE}?{urlencode(params)}", status_code=status.HTTP_303_SEE_OTHER
    )


@router.get("/google/callback", name="google_callback")
def google_callback(
    request: Request,
    db: DbSession,
    state: str = "",
    code: str = "",
    error: str = "",
) -> RedirectResponse:
    """Rückkehr von Google (Browser-Weiterleitung, daher Antwort als Redirect statt JSON)."""
    now = utcnow()
    oauth_state = (
        db.scalars(select(OAuthState).where(OAuthState.state_hash == token_hash(state))).first()
        if state
        else None
    )
    # Der state gehört zu genau der Session, die die Anmeldung gestartet hat (Schutz vor CSRF).
    cookie = request.cookies.get(SESSION_COOKIE)
    auth_session = (
        db.scalars(select(AuthSession).where(AuthSession.token_hash == token_hash(cookie))).first()
        if cookie
        else None
    )
    if oauth_state is not None:
        db.delete(oauth_state)
        db.commit()
    if (
        oauth_state is None
        or auth_session is None
        or oauth_state.session_id != auth_session.id
        or oauth_state.expires_at <= now
        or auth_session.expires_at <= now
    ):
        logger.warning("Rückkehr von Google mit ungültigem oder abgelaufenem state")
        return _back_to_parents(calendar_error="calendar.state_invalid")

    if error or not code:
        # z. B. access_denied, wenn auf der Zustimmungsseite abgebrochen wurde.
        logger.info("Google-Anmeldung nicht abgeschlossen: %s", error or "kein Code")
        return _back_to_parents(calendar_error="calendar.access_denied")

    try:
        tokens = google.exchange_code(
            code, oauth_state.code_verifier, oauth_state.redirect_uri, now
        )
        claims = google.id_token_claims(tokens.id_token)
    except google.GoogleError as exc:
        return _back_to_parents(calendar_error=exc.code)

    connection = db.scalars(
        select(CalendarConnection).where(
            CalendarConnection.provider == "google",
            CalendarConnection.account_id == claims["sub"],
        )
    ).first()
    if connection is None:
        connection = CalendarConnection(
            provider="google",
            account_id=claims["sub"],
            created_by_user_id=auth_session.user_id,
        )
        db.add(connection)
    connection.account_email = claims["email"]
    google.store_tokens(connection, tokens)
    # Die Anmeldung bei Google hat etwas gedauert: Elternbereich wieder offen halten.
    unlock_parent_area(auth_session)
    db.commit()
    logger.info("Google-Kalender verbunden (Verbindung %s)", connection.id)
    try:
        # Die Kalender sollen gleich zur Auswahl stehen; sonst kommen sie mit der nächsten
        # Synchronisation.
        refresh_calendar_list(db, connection, tokens.access_token)
    except google.GoogleError:
        db.rollback()
    return _back_to_parents(calendar="connected")


@router.delete("/connections/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def disconnect(connection_id: int, auth_session: ParentSession, db: DbSession) -> None:
    connection = db.get(CalendarConnection, connection_id)
    if connection is None:
        raise ApiError(status.HTTP_404_NOT_FOUND, "calendar.connection_not_found")
    google.revoke(connection)
    db.delete(connection)
    db.commit()
