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
    Text,
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
    # Farbe der Familie im Kalender (Termine, die allen gehören); siehe schemas.FAMILY_COLORS.
    calendar_color: Mapped[str] = mapped_column(String(20), server_default="pink")
    # Bundesland für Feiertage und Schulferien im Kalender (z. B. "NW"); None = keins gewählt.
    holiday_region: Mapped[str | None] = mapped_column(String(10))
    show_public_holidays: Mapped[bool] = mapped_column(default=False, server_default="false")
    show_school_holidays: Mapped[bool] = mapped_column(default=False, server_default="false")
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
    # Reihenfolge in Familienansicht und Listen (aufsteigend), festgelegt im Elternbereich.
    position: Mapped[int] = mapped_column(server_default="0")
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
    # Punkte erst, nachdem Eltern die Erledigung geprüft haben (z. B. „Zimmer aufgeräumt“).
    needs_approval: Mapped[bool] = mapped_column(default=False, server_default="false")
    # „Einer für alle“: Eine Erledigung durch eine zugeordnete Person gilt für alle.
    shared: Mapped[bool] = mapped_column(default=False, server_default="false")
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
            " AND (kind <> 'once' OR date IS NOT NULL)"
            " AND (kind <> 'flexible' OR (date IS NOT NULL AND interval_days > 0))",
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
    # Datum bei "once"; bei "flexible" die erste Fälligkeit.
    date: Mapped[dt.date | None] = mapped_column(Date)
    # Bei "flexible": fällig so viele Tage nach der letzten Erledigung.
    interval_days: Mapped[int | None] = mapped_column(SmallInteger)


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


class TaskCompletion(Base):
    """Erledigung einer Aufgabe durch eine Person an einem Kalendertag der Familie.

    Rückgängig machen löscht die Zeile; der Unique-Constraint verhindert doppelte Erledigungen
    am selben Tag, auch bei gleichzeitigen Doppel-Tipps. Die Punkte stehen als Buchungen in
    PointTransaction. Bei Aufgaben mit Elternkontrolle ist `approved_at` leer, bis Eltern die
    Erledigung bestätigen; erst dann werden die Punkte gebucht.
    """

    __tablename__ = "task_completions"
    __table_args__ = (UniqueConstraint("task_id", "member_id", "date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    member_id: Mapped[int] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), index=True
    )
    # Kalendertag in der Zeitzone der Familie, nicht in UTC.
    date: Mapped[dt.date] = mapped_column(Date, index=True)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Gutgeschriebene Punkte; Rückgängig bucht genau diesen Betrag zurück, auch wenn sich
    # der Punktwert der Aufgabe inzwischen geändert hat.
    points: Mapped[int] = mapped_column(server_default="0")
    # None = wartet auf Kontrolle durch die Eltern.
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    approved_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    task: Mapped[Task] = relationship(lazy="joined")


class PointTransaction(Base):
    """Punktebuchung. Der Punktestand einer Person ist die Summe ihrer Buchungen.

    Buchungen werden nie geändert; Korrekturen sind Gegenbuchungen. Die Quelle hängt von der
    Art ab (siehe schemas.POINT_KINDS): Aufgabe und Tag bei Erledigungen, das buchende Konto
    bei manuellen Buchungen, die Einlösung bei Belohnungen.
    """

    __tablename__ = "point_transactions"
    __table_args__ = (
        CheckConstraint("amount <> 0", name="amount_not_zero"),
        CheckConstraint(
            "(kind NOT IN ('task_completed', 'task_undone') OR task_date IS NOT NULL)"
            " AND (kind <> 'manual' OR reason IS NOT NULL)"
            " AND (kind <> 'reward_redeemed' OR redemption_id IS NOT NULL)",
            name="source_for_kind",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[int]
    # Erweiterbare Werte, bewusst kein Datenbank-Enum.
    kind: Mapped[str] = mapped_column(String(20))
    # Titel der Aufgabe zum Buchungszeitpunkt bzw. Begründung der Eltern.
    reason: Mapped[str | None] = mapped_column(String(200))
    # Bleibt erhalten, wenn die Aufgabe gelöscht wird.
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))
    # Tag der Erledigung in der Zeitzone der Familie.
    task_date: Mapped[dt.date | None] = mapped_column(Date)
    redemption_id: Mapped[int | None] = mapped_column(
        ForeignKey("reward_redemptions.id", ondelete="CASCADE")
    )
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped[Task | None] = relationship(lazy="joined")
    redemption: Mapped["RewardRedemption | None"] = relationship(lazy="joined")


class Reward(Base):
    """Belohnung eines Kindes; Auswahl und Kosten sind je Kind festgelegt."""

    __tablename__ = "rewards"
    __table_args__ = (CheckConstraint("cost > 0", name="cost_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    member_id: Mapped[int] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(100))
    # Iconify-Name wie bei Aufgaben.
    icon: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500))
    cost: Mapped[int]
    active: Mapped[bool] = mapped_column(default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RewardRedemption(Base):
    """Einlösung einer Belohnung. Name, Icon und Kosten werden kopiert, damit die Historie
    auch nach Änderung oder Löschen der Belohnung stimmt."""

    __tablename__ = "reward_redemptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    reward_id: Mapped[int | None] = mapped_column(ForeignKey("rewards.id", ondelete="SET NULL"))
    member_id: Mapped[int] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), index=True
    )
    # Erweiterbare Werte (siehe schemas.REDEMPTION_STATUSES); in Phase 1 immer "redeemed".
    status: Mapped[str] = mapped_column(String(20))
    reward_name: Mapped[str] = mapped_column(String(100))
    reward_icon: Mapped[str] = mapped_column(String(100))
    cost: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CalendarConnection(Base):
    """Verbindung zu einem Kalenderkonto (Phase 2: Google, nur lesend).

    Die Tokens liegen verschlüsselt in der Datenbank (siehe app.crypto). Ein Konto kann nur einmal
    verbunden sein; erneutes Verbinden ersetzt die Tokens.
    """

    __tablename__ = "calendar_connections"
    __table_args__ = (UniqueConstraint("provider", "account_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # Erweiterbare Werte, bewusst kein Datenbank-Enum; vorerst nur "google".
    provider: Mapped[str] = mapped_column(String(20))
    # Stabile Konto-Id des Anbieters (bei Google `sub`) und die E-Mail zur Anzeige.
    account_id: Mapped[str] = mapped_column(String(255))
    account_email: Mapped[str] = mapped_column(String(254))
    refresh_token: Mapped[str] = mapped_column(Text)
    access_token: Mapped[str | None] = mapped_column(Text)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # "ok" oder "reconnect" (Zugriff widerrufen, Token ungültig); siehe app.google.
    status: Mapped[str] = mapped_column(String(20), server_default="ok")
    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Calendar(Base):
    """Kalender eines verbundenen Kontos.

    Ausgewählte Kalender werden synchronisiert und angezeigt. Sie gehören einer Person
    (`member_id`) oder, ohne Person, der ganzen Familie.
    """

    __tablename__ = "calendars"
    __table_args__ = (UniqueConstraint("connection_id", "external_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    connection_id: Mapped[int] = mapped_column(
        ForeignKey("calendar_connections.id", ondelete="CASCADE")
    )
    # Kalender-Id beim Anbieter, bei Google z. B. die E-Mail-Adresse oder "…@group.calendar…".
    external_id: Mapped[str] = mapped_column(String(1024))
    name: Mapped[str] = mapped_column(String(255))
    # Hauptkalender des Kontos.
    primary: Mapped[bool] = mapped_column(default=False, server_default="false")
    selected: Mapped[bool] = mapped_column(default=False, server_default="false")
    member_id: Mapped[int | None] = mapped_column(
        ForeignKey("family_members.id", ondelete="SET NULL"), index=True
    )
    # Stand der inkrementellen Synchronisation (siehe app.calendar_sync).
    sync_token: Mapped[str | None] = mapped_column(Text)
    # Zeitraum der gespeicherten Termine und wann er zuletzt vollständig geladen wurde.
    window_start: Mapped[dt.date | None] = mapped_column(Date)
    window_loaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Letzte erfolgreiche Synchronisation und ggf. der Fehlercode der letzten fehlgeschlagenen.
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_error: Mapped[str | None] = mapped_column(String(64))

    connection: Mapped[CalendarConnection] = relationship(lazy="joined")


class CalendarEvent(Base):
    """Termin eines ausgewählten Kalenders im geladenen Zeitraum.

    Serientermine liegen als einzelne Vorkommen vor. Ganztägige Termine haben `start_date`
    und `end_date` (exklusiv), alle anderen `start_at` und `end_at`.
    """

    __tablename__ = "calendar_events"
    __table_args__ = (
        UniqueConstraint("calendar_id", "external_id"),
        CheckConstraint(
            "(all_day AND start_date IS NOT NULL AND end_date IS NOT NULL)"
            " OR (NOT all_day AND start_at IS NOT NULL AND end_at IS NOT NULL)",
            name="times_for_kind",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    calendar_id: Mapped[int] = mapped_column(ForeignKey("calendars.id", ondelete="CASCADE"))
    external_id: Mapped[str] = mapped_column(String(1024))
    # Gleicher Termin in mehreren Kalendern (z. B. Einladung an beide Eltern) → eine Anzeige.
    ical_uid: Mapped[str | None] = mapped_column(String(1024))
    # Ohne Titel (z. B. nur „beschäftigt“ freigegeben) zeigt das Frontend einen Platzhalter.
    title: Mapped[str | None] = mapped_column(String(500))
    location: Mapped[str | None] = mapped_column(String(500))
    # Als reiner Text (HTML aus Google wird beim Abruf entfernt).
    description: Mapped[str | None] = mapped_column(Text)
    all_day: Mapped[bool]
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    start_date: Mapped[dt.date | None] = mapped_column(Date)
    end_date: Mapped[dt.date | None] = mapped_column(Date)


class SchoolHoliday(Base):
    """Schulferien eines Bundeslands, geladen von OpenHolidays (siehe app.school_holidays)."""

    __tablename__ = "school_holidays"

    id: Mapped[int] = mapped_column(primary_key=True)
    region: Mapped[str] = mapped_column(String(10), index=True)
    start_date: Mapped[dt.date] = mapped_column(Date)
    # Exklusiv wie bei ganztägigen Terminen.
    end_date: Mapped[dt.date] = mapped_column(Date)
    name_de: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200))
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OAuthState(Base):
    """Offene OAuth-Anmeldung: gehört zu einer Session und gilt nur wenige Minuten."""

    __tablename__ = "oauth_states"

    id: Mapped[int] = mapped_column(primary_key=True)
    state_hash: Mapped[str] = mapped_column(String(64), unique=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("sessions.id", ondelete="CASCADE"), index=True
    )
    # PKCE-Verifier und die Rückleitungs-Adresse, die beim Token-Tausch gleich sein muss.
    code_verifier: Mapped[str] = mapped_column(String(128))
    redirect_uri: Mapped[str] = mapped_column(String(500))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
