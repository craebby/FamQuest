"""Personen nach Farbe: Zuordnung der Google-Terminfarben je Kalender.

Wer alle Termine in einem Kalender pflegt und die Personen über die Farbe unterscheidet, legt je
Kalender fest, welche Farbe zu welcher Person gehört oder ausgeblendet wird. Termine ohne Farbe
oder ohne Regel gehören weiter der Person des Kalenders. Die Regeln gelten beim Anzeigen, eine
Änderung wirkt also sofort und ohne neuen Abruf.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Calendar, CalendarColorRule

# Die Terminfarben von Google, fest vorgegeben.
COLOR_IDS = tuple(str(number) for number in range(1, 12))


class ColorRules:
    """Regeln aller Kalender; je Anfrage einmal laden."""

    def __init__(self, db: Session) -> None:
        self.by_calendar: dict[int, dict[str, int | None]] = {}
        for rule in db.scalars(select(CalendarColorRule)):
            self.by_calendar.setdefault(rule.calendar_id, {})[rule.color_id] = rule.member_id

    def of(self, calendar_id: int) -> dict[str, int | None]:
        return self.by_calendar.get(calendar_id, {})

    def hidden(self, calendar_id: int, color_id: str | None) -> bool:
        rules = self.of(calendar_id)
        return color_id in rules and rules[color_id] is None

    def member(self, calendar: Calendar, color_id: str | None) -> int | None:
        """Person eines Termins; None = ganze Familie."""
        return self.of(calendar.id).get(color_id) or calendar.member_id

    def choices(self, calendar: Calendar) -> list[int | None]:
        """Wem ein Termin dieses Kalenders per Farbe gehören kann, zuerst die Person des
        Kalenders. Leer, wenn der Kalender keine Personen über Farben unterscheidet."""
        members = sorted({m for m in self.of(calendar.id).values() if m is not None})
        return (
            [calendar.member_id, *(m for m in members if m != calendar.member_id)]
            if members
            else []
        )

    def color_change(
        self, calendar: Calendar, color_id: str | None, member_id: int | None
    ) -> dict[str, str | None]:
        """Feld für Google, damit der Termin der Person gehört; leer, wenn er es schon tut.

        Hat eine Person mehrere Farben, gilt die mit der kleinsten Nummer. Für die Person des
        Kalenders wird die Farbe entfernt.
        """
        if member_id == self.member(calendar, color_id) or member_id not in self.choices(calendar):
            return {}
        if member_id == calendar.member_id:
            return {"colorId": None}
        colors = (color for color, member in self.of(calendar.id).items() if member == member_id)
        return {"colorId": min(colors, key=int)}
