"""Putzplan: Wie dringend ist eine Hausarbeit?

Es gibt keinen festen Termin. Die Uhr läuft ab der letzten Erledigung; ist der Abstand um, ist die
Aufgabe fällig. Verpasstes stapelt sich nicht: Eine Aufgabe ist höchstens einmal fällig, egal wie
lange schon.
"""

import datetime as dt
from dataclasses import dataclass

# Ab diesem Anteil des Abstands springt die Ampel auf Gelb; ab 1 (Abstand um) auf Rot.
SOON_RATIO = 0.7
# Gelb aber frühestens so viele Tage vorher: Bei „alle 9 Monate“ wären 70 % sonst schon ein
# Vierteljahr vor der Fälligkeit „bald dran“.
SOON_MAX_DAYS = 14

# Ampelstufen, von entspannt bis fällig.
LEVELS = ("ok", "soon", "due")


@dataclass(frozen=True)
class ChoreState:
    # Tag, an dem die Aufgabe wieder fällig ist.
    due_date: dt.date
    # Tage bis dahin; 0 = heute fällig, negativ = so viele Tage drüber.
    days_left: int
    # Verstrichener Anteil des Abstands; über 1 heißt überfällig.
    ratio: float
    level: str


def chore_state(last_done: dt.date, interval_days: int, today: dt.date) -> ChoreState:
    """Stand einer Aufgabe, die zuletzt an `last_done` erledigt wurde."""
    # Eine Erledigung „in der Zukunft“ (Uhr verstellt, Zeitzone geändert) zählt wie heute.
    elapsed = max((today - last_done).days, 0)
    ratio = elapsed / interval_days
    days_left = interval_days - elapsed
    soon = ratio >= SOON_RATIO and days_left <= SOON_MAX_DAYS
    level = "due" if ratio >= 1 else "soon" if soon else "ok"
    return ChoreState(
        due_date=last_done + dt.timedelta(days=interval_days),
        days_left=days_left,
        ratio=round(ratio, 3),
        level=level,
    )
