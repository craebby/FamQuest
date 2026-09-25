from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, func, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Family(Base):
    """Die eine Familie dieser Installation (keine Mandantenlogik)."""

    __tablename__ = "families"
    # Erzwingt auf Datenbankebene, dass es höchstens eine Familie gibt.
    __table_args__ = (CheckConstraint("singleton", name="singleton"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    singleton: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default=true(), unique=True
    )
    name: Mapped[str] = mapped_column(String(100))
    default_language: Mapped[str] = mapped_column(String(10))
    timezone: Mapped[str] = mapped_column(String(64), server_default="Europe/Berlin")
    parent_pin_hash: Mapped[str | None] = mapped_column(String(255))
    pin_enabled: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    """Login-Konto. E-Mail-Adressen werden kleingeschrieben gespeichert."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20))
    language: Mapped[str | None] = mapped_column(String(10))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthSession(Base):
    """Serverseitige Session. Gespeichert wird nur der Hash des Cookie-Tokens."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    parent_unlocked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(lazy="joined")
