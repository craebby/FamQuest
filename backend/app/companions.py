"""Begleiter-Tier: Arten, Zubehör, Wachstum.

Das Tier wächst mit den Tagen, an denen das Kind mindestens eine Aufgabe erledigt hat. Verpasste
Tage kosten nichts: es gibt keinen Rückschritt, kein Hungern und keine Strafe. Schon das Baby lernt
Kunststücke, über alle Stufen verteilt, damit jede Stufe etwas Neues bringt.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Companion, TaskCompletion

# Reihenfolge wie in der Auswahl am Display.
SPECIES = (
    "cat",
    "dog",
    "fox",
    "dragon",
    "unicorn",
    "horse",
    "snow_leopard",
    "giraffe",
    "turtle",
    "shark",
    "dolphin",
    "panda",
    "rabbit",
    "penguin",
    "koala",
)

# (Stufe, ab so vielen Pflegetagen)
STAGES = (("egg", 0), ("baby", 2), ("kid", 7), ("grown", 14))

# Kunststücke: (Schlüssel, ab so vielen Pflegetagen). Baby 2, Kind 3, groß 3.
TRICKS = (
    ("spin", 3),
    ("jump", 5),
    ("music", 8),
    ("bubbles", 10),
    ("rainbow", 12),
    ("fireworks", 16),
    ("rocket", 20),
    ("magic", 25),
)

# Zubehör: Schlüssel → (Platz, Punkte). Je Platz trägt das Tier ein Teil.
ITEMS: dict[str, tuple[str, int]] = {
    "ribbon": ("head", 15),
    "cherry_blossom": ("head", 15),
    "billed_cap": ("head", 25),
    "top_hat": ("head", 30),
    "crown": ("head", 60),
    "glasses": ("face", 20),
    "sunglasses": ("face", 25),
    "balloon": ("toy", 15),
    "yo_yo": ("toy", 20),
    "soccer_ball": ("toy", 20),
    "teddy_bear": ("toy", 30),
    "kite": ("toy", 30),
    "sunflower": ("place", 20),
    "rainbow": ("place", 50),
    "ringed_planet": ("place", 60),
    "house": ("place", 80),
}


def care_days(db: Session, companion: Companion) -> int:
    """Tage mit mindestens einer Erledigung seit dem Aussuchen (auch ungeprüfte zählen)."""
    query = select(func.count(func.distinct(TaskCompletion.date))).where(
        TaskCompletion.member_id == companion.member_id,
        TaskCompletion.date >= companion.started_on,
    )
    return db.scalar(query) or 0


def stage_for(days: int) -> tuple[str, int | None]:
    """Stufe und die Pflegetage, ab denen die nächste kommt."""
    current, upcoming = STAGES[0][0], None
    for name, start in STAGES:
        if days >= start:
            current = name
        else:
            upcoming = start
            break
    return current, upcoming


def tricks_for(days: int) -> tuple[list[str], int | None]:
    learned = [name for name, start in TRICKS if days >= start]
    upcoming = next((start for _, start in TRICKS if days < start), None)
    return learned, upcoming
