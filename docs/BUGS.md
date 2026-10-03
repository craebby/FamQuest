# Bugliste

Fehler und Lücken aus dem Alltag, die noch behoben werden. Erledigtes wandert mit Version nach unten.

## Offen

Gerade nichts.

## Erledigt

### 1. „Zu erledigen“ lässt sich nach dem Anlegen nicht mehr bearbeiten

- **Gemeldet:** 2026-10-01 (Stand 1.1.0)
- **Behoben:** 1.1.1
- **Bereich:** Haushalt → „Zu erledigen“
- **War:** Ein Eintrag konnte nach dem Anlegen nur noch abgehakt oder gelöscht werden. Bei einem
  Tippfehler blieb nur Löschen und neu Anlegen.
- **Jetzt:** Der Stift an einem offenen Eintrag macht Text und Symbol direkt in der Zeile änderbar
  (ohne Eltern-PIN). Neuer Endpunkt `PUT /api/todos/{id}`; ein Titel, der schon offen auf der Liste
  steht, wird mit `todo.duplicate` abgelehnt.

### 2. „Heute“: Kacheln „Einkauf“ und „Haushalt“ werden zu groß

- **Gemeldet:** 2026-10-01 (Stand 1.1.0)
- **Behoben:** 1.1.1
- **Bereich:** „Heute“ → Kacheln „Einkauf“ und „Haushalt“
- **War:** Mit vielen Einträgen wuchsen die beiden Kacheln stark in die Höhe (Haushalt bis zu 6
  Zeilen, Einkauf bis zu 12 Artikel plus Knopf) und schoben die Woche mit den Terminen nach unten.
- **Jetzt:** „Haushalt“ zeigt höchstens 2 Einträge, „Einkauf“ höchstens 4 Artikel in 2 Zeilen,
  lange Namen werden abgeschnitten, der Rest steht als „+N weitere“ dabei. „Eintragen“ ist ein „+“
  in der Kopfzeile der Einkauf-Kachel. Beide Kacheln sind damit niedriger als die Routine der
  Kinder.

### 3. „Heute“: Erledigtes aus dem Haushalt bleibt in der Kachel stehen

- **Gemeldet:** 2026-10-01 (Stand 1.1.0)
- **Behoben:** 1.1.1
- **Bereich:** „Heute“ → Kachel „Haushalt“
- **War:** Heute erledigte Putzplan-Aufgaben und abgehakte Einträge aus „Zu erledigen“ blieben bis
  zum Tagesende durchgestrichen in der Kachel stehen.
- **Jetzt:** Erledigtes verschwindet aus der Kachel. Ein versehentlicher Tipp lässt sich über
  „Rückgängig“ in der Leiste „Wer war's?“ zurücknehmen, später in der Ansicht „Haushalt“.

### 4. Öffentliche Demo: Zurücksetzen bricht am Wochenende ab

- **Gemeldet:** 2026-10-03 (Stand 1.1.0), beim Testlauf für 1.1.1 aufgefallen
- **Behoben:** 1.1.1
- **Bereich:** Demo-Modus (`DEMO_MODE`), stündliches Zurücksetzen
- **War:** Samstags und sonntags brach das Zurücksetzen mit `StopIteration` ab, weil Ben in den
  Demodaten keine Morgenroutine fürs Wochenende hat. Die Datenbank war dann schon geleert, die
  Demodaten aber nur zum Teil angelegt.
- **Jetzt:** Kinder ohne Morgenroutine am heutigen Tag werden beim Abhaken der ersten Schritte
  übersprungen (`backend/app/demo.py`).
- **Dazu:** Drei Backend-Tests hingen vom echten Datum ab (Wochenansicht der Routinen, zwei Tests
  zum Kalender-Abgleich) und schlugen ab dem 3. Oktober 2026 fehl; sie legen ihr Datum jetzt selbst
  fest.

### 5. Küchenansicht: Dialoge verrutschen am Tablet, Seite lässt sich verschieben

- **Gemeldet:** 2026-10-03 (Stand 1.2.0), am echten 8-Zoll-Tablet
- **Behoben:** 1.2.1
- **Bereich:** Küchenansicht (`/kitchen`), z. B. „Eintragen“ auf der Einkaufsliste
- **War:** Der Dialog „Was fehlt?“ saß halb außerhalb des Bildschirms, danach war die ganze
  Ansicht verschoben. Ursache: Unsichtbare Hilfstexte für Screenreader auf den hinteren Seiten
  ragten aus dem Wischbereich heraus; der mobile Browser rechnete die Seite dadurch mehr als
  doppelt so breit und hoch wie den Bildschirm (1974 × 1234 statt 853 × 533).
- **Jetzt:** Der Wischbereich hält diese Texte fest (`relative` in `KitchenPage.tsx`); die Seite ist
  wieder genau so groß wie der Bildschirm. Ein End-to-End-Test im Tablet-Format prüft das.
- **Dazu:** Die Kalender-Tests im Frontend hingen von der echten Uhrzeit ab und schlugen seit dem
  3. Oktober nachmittags fehl; sie stellen die Uhr jetzt selbst.
