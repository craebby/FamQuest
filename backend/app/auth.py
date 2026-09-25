import hmac
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import ApiError
from app.logs import logger
from app.models import AuthSession, Family, User
from app.schemas import FamilyOut, MeResponse, UserOut
from app.security import new_token, token_hash

SESSION_COOKIE = "famquest_session"
CSRF_HEADER = "X-CSRF-Token"
# Das Wanddisplay soll dauerhaft angemeldet bleiben; jede Nutzung verlängert die Session.
SESSION_LIFETIME = timedelta(days=365)
SESSION_REFRESH_INTERVAL = timedelta(hours=1)
# Wie lange der Elternbereich nach PIN-Eingabe offen bleibt (verlängert sich bei Nutzung).
PARENT_UNLOCK_DURATION = timedelta(minutes=5)
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})

DbSession = Annotated[Session, Depends(get_db)]


def utcnow() -> datetime:
    return datetime.now(UTC)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def get_family(db: Session) -> Family:
    family = db.scalars(select(Family)).one_or_none()
    if family is None:
        raise ApiError(status.HTTP_409_CONFLICT, "setup.required")
    return family


def check_origin(request: Request) -> None:
    """CSRF-Schutz für Requests ohne Session (Setup, Login): nur von der eigenen Seite."""
    origin = request.headers.get("origin")
    host = request.headers.get("host")
    if origin and urlsplit(origin).netloc != host:
        # Häufige Ursache hinter einem Reverse Proxy: Er gibt den Host-Header nicht weiter.
        logger.warning(
            "Anfrage an %s abgelehnt: Origin %s passt nicht zum Host %s "
            "(Reverse Proxy muss den Host-Header weitergeben)",
            request.url.path,
            origin,
            host,
        )
        raise ApiError(status.HTTP_403_FORBIDDEN, "auth.csrf_failed")


def start_session(db: Session, request: Request, response: Response, user: User) -> AuthSession:
    token = new_token()
    now = utcnow()
    auth_session = AuthSession(
        token_hash=token_hash(token),
        user=user,
        csrf_token=new_token(),
        last_seen_at=now,
        expires_at=now + SESSION_LIFETIME,
    )
    db.add(auth_session)
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )
    return auth_session


def end_session(db: Session, response: Response, auth_session: AuthSession) -> None:
    db.delete(auth_session)
    response.delete_cookie(SESSION_COOKIE, path="/")


def current_session(request: Request, db: DbSession) -> AuthSession:
    """Angemeldete Session; bei schreibenden Requests zusätzlich mit CSRF-Prüfung."""
    token = request.cookies.get(SESSION_COOKIE)
    auth_session = (
        db.scalars(select(AuthSession).where(AuthSession.token_hash == token_hash(token))).first()
        if token
        else None
    )
    now = utcnow()
    if auth_session is None or auth_session.expires_at <= now:
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "auth.not_authenticated")

    if request.method not in SAFE_METHODS:
        sent = request.headers.get(CSRF_HEADER, "")
        if not hmac.compare_digest(sent.encode(), auth_session.csrf_token.encode()):
            logger.warning(
                "Anfrage an %s abgelehnt: CSRF-Token fehlt oder falsch", request.url.path
            )
            raise ApiError(status.HTTP_403_FORBIDDEN, "auth.csrf_failed")

    if now - auth_session.last_seen_at >= SESSION_REFRESH_INTERVAL:
        auth_session.last_seen_at = now
        auth_session.expires_at = now + SESSION_LIFETIME
        db.commit()
    return auth_session


CurrentSession = Annotated[AuthSession, Depends(current_session)]


def is_parent_unlocked(auth_session: AuthSession, family: Family) -> bool:
    if not family.pin_enabled:
        return True
    until = auth_session.parent_unlocked_until
    return until is not None and until > utcnow()


def unlock_parent_area(auth_session: AuthSession) -> None:
    auth_session.parent_unlocked_until = utcnow() + PARENT_UNLOCK_DURATION


def parent_session(auth_session: CurrentSession, db: DbSession) -> AuthSession:
    """Session mit entsperrtem Elternbereich; jede Nutzung verlängert die Entsperrung."""
    if not is_parent_unlocked(auth_session, get_family(db)):
        raise ApiError(status.HTTP_403_FORBIDDEN, "parent.locked")
    unlock_parent_area(auth_session)
    db.commit()
    return auth_session


ParentSession = Annotated[AuthSession, Depends(parent_session)]


def me_response(db: Session, auth_session: AuthSession) -> MeResponse:
    family = get_family(db)
    user = auth_session.user
    return MeResponse(
        user=UserOut(email=user.email, role=user.role, language=user.language),
        family=FamilyOut(
            name=family.name,
            default_language=family.default_language,
            timezone=family.timezone,
            pin_enabled=family.pin_enabled,
        ),
        csrf_token=auth_session.csrf_token,
        parent_unlocked=is_parent_unlocked(auth_session, family),
    )
