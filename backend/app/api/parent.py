from fastapi import APIRouter, status
from pydantic import BaseModel

from app.auth import (
    CurrentSession,
    DbSession,
    ParentSession,
    get_family,
    me_response,
    unlock_parent_area,
)
from app.errors import ApiError
from app.schemas import MeResponse, Pin
from app.security import hash_secret, login_limiter, pin_limiter, verify_secret

router = APIRouter(prefix="/parent", tags=["parent"])


class UnlockRequest(BaseModel):
    pin: str


class PinRequest(BaseModel):
    pin: Pin


class PinResetRequest(BaseModel):
    password: str
    pin: Pin


@router.post("/unlock")
def unlock(body: UnlockRequest, auth_session: CurrentSession, db: DbSession) -> MeResponse:
    family = get_family(db)
    if family.pin_enabled:
        limit_key = f"session:{auth_session.id}"
        if pin_limiter.is_blocked(limit_key):
            raise ApiError(status.HTTP_429_TOO_MANY_REQUESTS, "auth.rate_limited")
        if not verify_secret(family.parent_pin_hash, body.pin):
            pin_limiter.record_failure(limit_key)
            raise ApiError(status.HTTP_403_FORBIDDEN, "pin.wrong")
        pin_limiter.reset(limit_key)
    unlock_parent_area(auth_session)
    db.commit()
    return me_response(db, auth_session)


@router.post("/lock")
def lock(auth_session: CurrentSession, db: DbSession) -> MeResponse:
    auth_session.parent_unlocked_until = None
    db.commit()
    return me_response(db, auth_session)


@router.put("/pin")
def set_pin(body: PinRequest, auth_session: ParentSession, db: DbSession) -> MeResponse:
    """PIN festlegen oder ändern (auch zum Wiedereinschalten)."""
    family = get_family(db)
    family.parent_pin_hash = hash_secret(body.pin)
    family.pin_enabled = True
    db.commit()
    return me_response(db, auth_session)


@router.delete("/pin")
def disable_pin(auth_session: ParentSession, db: DbSession) -> MeResponse:
    family = get_family(db)
    family.parent_pin_hash = None
    family.pin_enabled = False
    db.commit()
    return me_response(db, auth_session)


@router.post("/pin/reset")
def reset_pin(body: PinResetRequest, auth_session: CurrentSession, db: DbSession) -> MeResponse:
    """PIN vergessen: mit dem Passwort des angemeldeten Kontos eine neue PIN setzen."""
    limit_key = f"email:{auth_session.user.email}"
    if login_limiter.is_blocked(limit_key):
        raise ApiError(status.HTTP_429_TOO_MANY_REQUESTS, "auth.rate_limited")
    if not verify_secret(auth_session.user.password_hash, body.password):
        login_limiter.record_failure(limit_key)
        raise ApiError(status.HTTP_403_FORBIDDEN, "auth.invalid_credentials")

    login_limiter.reset(limit_key)
    family = get_family(db)
    family.parent_pin_hash = hash_secret(body.pin)
    family.pin_enabled = True
    unlock_parent_area(auth_session)
    db.commit()
    return me_response(db, auth_session)
