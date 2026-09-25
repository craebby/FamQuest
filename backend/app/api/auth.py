from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select

from app.auth import (
    CurrentSession,
    DbSession,
    check_origin,
    client_ip,
    end_session,
    me_response,
    start_session,
)
from app.errors import ApiError
from app.models import User
from app.schemas import Email, MeResponse
from app.security import hash_secret, login_limiter, needs_rehash, verify_secret

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: Email
    password: str


@router.post("/login", dependencies=[Depends(check_origin)])
def login(body: LoginRequest, request: Request, response: Response, db: DbSession) -> MeResponse:
    limit_keys = (f"ip:{client_ip(request)}", f"email:{body.email}")
    if login_limiter.is_blocked(*limit_keys):
        raise ApiError(status.HTTP_429_TOO_MANY_REQUESTS, "auth.rate_limited")

    user = db.scalars(select(User).where(User.email == body.email)).one_or_none()
    if not verify_secret(user.password_hash if user else None, body.password):
        login_limiter.record_failure(*limit_keys)
        raise ApiError(status.HTTP_401_UNAUTHORIZED, "auth.invalid_credentials")

    assert user is not None
    login_limiter.reset(f"email:{body.email}")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_secret(body.password)
    auth_session = start_session(db, request, response, user)
    db.commit()
    return me_response(db, auth_session)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(auth_session: CurrentSession, response: Response, db: DbSession) -> None:
    end_session(db, response, auth_session)
    db.commit()


@router.get("/me")
def me(auth_session: CurrentSession, db: DbSession) -> MeResponse:
    return me_response(db, auth_session)
