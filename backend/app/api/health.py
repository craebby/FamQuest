from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter()


class HealthStatus(BaseModel):
    status: Literal["ok", "error"]
    database: Literal["ok", "error"]


@router.get("/health")
def health(response: Response, db: Annotated[Session, Depends(get_db)]) -> HealthStatus:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthStatus(status="error", database="error")
    return HealthStatus(status="ok", database="ok")
