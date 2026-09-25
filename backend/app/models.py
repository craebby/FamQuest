import datetime as dt
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    true,
)
from sqlalchemy.dialects.postgresql import ARRAY
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


class FamilyMember(Base):
    """Person im Haushalt, mit oder ohne eigenes Login-Konto."""

    __tablename__ = "family_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    # Erweiterbare Werte (siehe schemas.MEMBER_ROLES), bewusst kein Datenbank-Enum.
    role: Mapped[str] = mapped_column(String(20))
    # Jede Farbe gehört höchstens einer Person.
    color: Mapped[str] = mapped_column(String(20), unique=True)
    # Dateiname im Avatar-Verzeichnis; None = Initiale auf der Personenfarbe.
    avatar: Mapped[str | None] = mapped_column(String(64))
    # Optionale Verknüpfung mit einem Login-Konto (z. B. später für Kinder-Konten).
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), unique=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Task(Base):
    """Aufgabendefinition; wann sie ansteht, legt die zugehörige TaskRecurrence fest."""

    __tablename__ = "tasks"
    __table_args__ = (CheckConstraint("points >= 0", name="points_not_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    # Iconify-Name, z. B. "fluent-emoji-flat:toothbrush".
    icon: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))
    points: Mapped[int]
    # Erweiterbare Werte (siehe schemas.TIMES_OF_DAY); None = jederzeit.
    time_of_day: Mapped[str | None] = mapped_column(String(20))
    # None = Farbe der jeweiligen Person.
    color: Mapped[str | None] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recurrence: Mapped["TaskRecurrence"] = relationship(cascade="all, delete-orphan", lazy="joined")
    assignments: Mapped[list["TaskAssignment"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="TaskAssignment.member_id"
    )


class TaskRecurrence(Base):
    """Wiederholungsregel einer Aufgabe (siehe app.recurrence)."""

    __tablename__ = "task_recurrences"
    __table_args__ = (
        CheckConstraint(
            "(kind <> 'weekly' OR cardinality(weekdays) > 0)"
            " AND (kind <> 'once' OR date IS NOT NULL)",
            name="fields_for_kind",
        ),
    )

    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    # Erweiterbare Werte (siehe schemas.RECURRENCE_KINDS), bewusst kein Datenbank-Enum.
    kind: Mapped[str] = mapped_column(String(20))
    # ISO-Wochentage 1 (Montag) bis 7 (Sonntag), nur bei "weekly".
    weekdays: Mapped[list[int] | None] = mapped_column(ARRAY(SmallInteger))
    # Datum bei "once".
    date: Mapped[dt.date | None] = mapped_column(Date)


class TaskAssignment(Base):
    """Zuordnung Aufgabe ↔ Person; jede Person erledigt und punktet getrennt."""

    __tablename__ = "task_assignments"
    __table_args__ = (UniqueConstraint("task_id", "member_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Der Unique-Constraint (task_id, member_id) dient zugleich als Index für task_id.
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    member_id: Mapped[int] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), index=True
    )
