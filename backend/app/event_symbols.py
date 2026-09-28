"""Symbole für Termine: Begriffe im Titel (z. B. „Judo“) bekommen ein festgelegtes Symbol.

Damit erkennen Kinder, die noch nicht lesen können, ihre Termine im Kalender. Die Regeln legen
die Eltern für die ganze Familie fest; ob die Termine einer Person Symbole bekommen, steht bei
der Person (`FamilyMember.event_symbols`).
"""

import re
import unicodedata

# Kurze Begriffe zählen nur als ganzes Wort (mit Plural-s), sonst steckt „Opa“ in „Europa“.
SHORT_TERM = 3


def normalize(text: str) -> str:
    """Wie im Frontend (icons/catalog.ts): klein, ohne Akzente und Umlaute, ß als ss."""
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return "".join(c for c in decomposed if not unicodedata.combining(c)).replace("ß", "ss")


class SymbolMatcher:
    """Sucht zu einem Titel das Symbol des längsten passenden Begriffs."""

    def __init__(self, rules: list[dict] | None) -> None:
        self._terms: list[tuple[str, re.Pattern[str] | None, str]] = []
        for rule in rules or []:
            for term in rule["terms"]:
                key = normalize(term.strip())
                if not key:
                    continue
                pattern = None
                if len(key) <= SHORT_TERM:
                    pattern = re.compile(rf"(?<!\w){re.escape(key)}s?(?!\w)")
                self._terms.append((key, pattern, rule["icon"]))
        # Längere Begriffe zuerst: „Zahnarzt“ gewinnt vor „Arzt“.
        self._terms.sort(key=lambda entry: -len(entry[0]))

    def icon_for(self, title: str | None) -> str | None:
        if not title or not self._terms:
            return None
        text = normalize(title)
        for key, pattern, icon in self._terms:
            if pattern.search(text) if pattern else key in text:
                return icon
        return None
