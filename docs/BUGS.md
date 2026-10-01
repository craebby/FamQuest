# Bugliste

Fehler und Lücken aus dem Alltag, die noch behoben werden. Erledigtes wandert mit Version nach unten.

## Offen

### 1. „Zu erledigen“ lässt sich nach dem Anlegen nicht mehr bearbeiten

- **Gemeldet:** 2026-10-01 (Stand 1.1.0)
- **Bereich:** Haushalt → „Zu erledigen“
- **Ist:** Ein Eintrag kann nach dem Anlegen nur noch abgehakt oder gelöscht werden. Bei einem
  Tippfehler oder einer Änderung bleibt nur Löschen und neu Anlegen.
- **Soll:** Einträge lassen sich nachträglich bearbeiten.
- **Technik:** `backend/app/api/todos.py` kennt nur `POST`, `PUT/DELETE …/done` und `DELETE`; ein
  Endpunkt zum Ändern fehlt, im Frontend entsprechend der Bearbeiten-Dialog.

### 2. „Heute“: Kacheln „Einkauf“ und „Haushalt“ werden zu groß

- **Gemeldet:** 2026-10-01 (Stand 1.1.0)
- **Bereich:** „Heute“ → Kacheln „Einkauf“ und „Haushalt“
- **Ist:** Mit vielen Einträgen wachsen die beiden Kacheln stark in die Höhe. Für die Woche mit den
  Terminen darunter bleibt wenig Platz.
- **Soll:** Beide Kacheln bleiben kompakt (feste Obergrenze in der Höhe), der Kalender behält
  seinen Platz.
- **Technik:** `ShoppingWidget.tsx` zeigt bis zu 12 Artikel (`WIDGET_MAX_ITEMS`), `ChoresWidget.tsx`
  bis zu 6 Putzplan-Aufgaben (`WIDGET_MAX_CHORES`) plus „Zu erledigen“; die Höhe ist sonst nicht
  begrenzt, die Woche (`WeekBoard.tsx`) bekommt nur den Rest der Bildschirmhöhe.

### 3. „Heute“: Erledigtes aus dem Haushalt bleibt in der Kachel stehen

- **Gemeldet:** 2026-10-01 (Stand 1.1.0)
- **Bereich:** „Heute“ → Kachel „Haushalt“
- **Ist:** Heute erledigte Putzplan-Aufgaben und abgehakte Einträge aus „Zu erledigen“ bleiben bis
  zum Tagesende durchgestrichen in der Kachel stehen und nehmen Platz weg (siehe Nr. 2).
- **Soll:** Erledigtes verschwindet aus der Kachel auf „Heute“.
- **Technik:** `ChoresWidget.tsx` hängt Erledigtes bewusst hinten an, damit ein zweiter Tipp es
  zurücknehmen kann. Fällt das weg, braucht das Zurücknehmen einen anderen Weg (z. B. kurz
  stehen lassen, bis die Leiste „Wer war's?“ verschwindet, oder nur noch in der Ansicht
  „Haushalt“).

## Erledigt

Noch nichts.
