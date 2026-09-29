from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy import select

from app.auth import DbSession, check_origin, me_response, start_session
from app.config import get_settings
from app.errors import ApiError
from app.models import User
from app.schemas import MeResponse

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/login", dependencies=[Depends(check_origin)])
def demo_login(request: Request, response: Response, db: DbSession) -> MeResponse:
    """Anmeldung per Knopfdruck in der öffentlichen Demo, ohne Passwort.

    Das Passwort der Demo ist zwar bekannt, aber falsche Versuche Fremder würden über die
    Sperre nach Fehlversuchen sonst alle anderen Besucher aussperren.
    """
    if not get_settings().demo_mode:
        raise ApiError(status.HTTP_404_NOT_FOUND, "common.not_found")
    user = db.scalars(select(User).order_by(User.id)).first()
    if user is None:
        raise ApiError(status.HTTP_503_SERVICE_UNAVAILABLE, "demo.resetting")
    auth_session = start_session(db, request, response, user)
    db.commit()
    return me_response(db, auth_session)
