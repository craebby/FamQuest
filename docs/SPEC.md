# Family Dashboard – Spezifikation

Stand: 25.09.2026

## 1. Produktvision

Wir bauen eine self-hosted, zweisprachige (Deutsch/Englisch) Familienzentrale für ein großes Touchscreen-Display in der Wohnung. Der Kern ist ein kindgerechtes System aus **Routinen → Aufgaben → Erledigung → Punkte → Belohnungen**.

Diese Spezifikation ersetzt alle früheren Entwürfe. Bei Widersprüchen gilt dieses Dokument.

**Eckpunkte**

- Eine Installation = genau eine Familie. Keine Multi-Tenancy, kein SaaS, keine Subscriptions, kein Cloud-Backend.
- Läuft vollständig lokal in Docker, primär im LAN, optional hinter einem Reverse Proxy aus dem Internet erreichbar.
- Primäres Gerät: Touchscreen im Querformat am Kühlschrank (ca. 15", etwa 1920 × 1080), aber voll responsive.
- Die fertige App soll sich wie eine Familien-App anfühlen, nicht wie Aufgabenverwaltungssoftware.
- Später kommen hinzu: Google Kalender, Familien-Dashboard, Essensplanung, Einkaufsliste (siehe Roadmap).

**Inspiration, keine Kopie**

Wichtigste UX-Referenz ist **Daily** (einfache Bedienung, Familienmitglieder klar sichtbar, große Touchflächen, Tagesorientierung, Wanddisplay-Tauglichkeit). Weitere Referenzen: Yuvomi, Waffled, Tribu, Airzeen, OpenSkyLight. Deren grundlegende UX-Ideen sollen analysiert und kombiniert werden, sofern öffentliche Informationen verfügbar sind. Weder technisch noch visuell kopieren.

## 2. Produktgrundsätze und UX

**Alle nutzen dasselbe Display – ohne Benutzerwechsel.** Kinder und Eltern bedienen die App im Alltag gleich: antippen, fertig. Nur die Verwaltung (Aufgaben anlegen, Einstellungen) liegt getrennt im Elternbereich. Jede UI-Entscheidung im Alltagsbereich muss zwei Tests bestehen:

- *Findet ein 5–7-jähriges Kind, das noch nicht lesen kann, allein zu seinen Aufgaben?*
- *Kommt ein wenig technikaffiner Erwachsener ohne Erklärung zurecht?*

Wenn nicht, wird die UI vereinfacht.

Bei der Wahl zwischen technisch elegant, aber kompliziert und einfach, sofort benutzbar gilt immer: **einfach**. Ziel ist das Gefühl „Ich schaue auf das Display und weiß sofort, was heute zu tun ist.“

**Touch first**

- Große Buttons, große Icons, große Touchflächen (mindestens 48 px, in der Familienansicht deutlich größer)
- Wenig Text, klare Farben, deutliches visuelles Feedback
- Keine wichtigen Aktionen ausschließlich über Hover
- Keine komplizierten Formulare im Alltagsbereich
- Querformat 1920 × 1080 als Hauptziel, aber nicht fest verdrahtet: Desktop, Tablet und Smartphone müssen funktionieren

**Design**

- Modern, freundlich, hell, farbig, hochwertig
- Kindgerecht, aber nicht kitschig und nicht überladen
- Nicht wie eine klassische Business- oder Verwaltungs-App
- Profilbilder und Personenfarben sind überall deutlich erkennbar

**Gamification sparsam**

- Beim Erledigen einer Aufgabe: kurze Animation und „+2 Punkte“
- Tagesfortschritt als Balken oder als Sterne-Reihe
- Nicht überall Animationen: Die App muss auch nach Monaten täglicher Nutzung angenehm bleiben
- Animationen respektieren `prefers-reduced-motion`

**Hauptansicht offen lassen**

Ob die endgültige Startseite ein Dashboard, ein Kalender oder eine Kombination wird, entscheiden wir erst nach dem ersten funktionierenden Prototyp. In Phase 1 ist die Familienansicht (Abschnitt 4) die Hauptansicht.

## 3. Setup, Anmeldung und Familienmitglieder

**First-Run-Setup**

```
Kein Benutzer vorhanden → Setup-Seite → Admin angelegt, Familie initialisiert → Registrierung deaktiviert
```

Beim allerersten Start zeigt die App eine Setup-Seite mit Sprache (vorausgewählt nach Browsersprache), Familienname, E-Mail und Passwort. Der erste Benutzer wird Administrator, die Familie wird angelegt, danach ist jede öffentliche Registrierung serverseitig gesperrt.

**Konten und Familienmitglieder sind getrennt**

- *User* = Login-Konto (E-Mail + Passwort). In Phase 1 gibt es nur den Admin; weitere Eltern-Konten kann der Admin optional anlegen.
- *FamilyMember* = Person im Haushalt, mit oder ohne Login. Kinder haben kein Passwort.
- Ein FamilyMember kann optional mit einem User verknüpft sein. So sind echte Kinder-Konten später möglich, ohne das Modell umzubauen.

**Kein Benutzerwechsel im Alltag**

- Das Wanddisplay bleibt dauerhaft angemeldet (lange, sichere Session).
- Es gibt keine Personenauswahl, kein „Wer bist du?“ und kein Umschalten zwischen Profilen, um Aufgaben zu erledigen. Wem eine Aufgabe gehört, ergibt sich aus der Personenspalte, in der sie steht.
- Nur der Elternbereich (Verwaltung und Einstellungen) ist zusätzlich durch eine Eltern-PIN geschützt, damit ein Kind nicht versehentlich Aufgaben oder Punkte ändert. Die PIN ist in den Einstellungen abschaltbar. Nach kurzer Inaktivität kehrt das Display zur Familienansicht zurück.

**Familienmitglieder**

Jede Person hat Name, Rolle, Farbe und Profilbild. Rollen in Phase 1: *Elternteil* und *Kind*. Rollen sind als erweiterbare Werte angelegt, nicht hart verdrahtet.

**Farben**

- Jede Person hat genau eine eigene Farbe. Vorgaben: Orange, Blau, Lila, Grün, Rot, Türkis, Gelb.
- Bereits vergebene Farben werden bei der Auswahl ausgegraut, damit keine Kollisionen entstehen.
- Die Farbe wird genutzt für Avatar-Ring, Aufgabenkarten, Fortschritt, Punkte, Benutzerkarten und später Kalendertermine.
- Die Farbpalette ist so gewählt, dass Text auf und neben der Farbe ausreichend Kontrast hat (WCAG AA).

**Profilbilder mit Cropper**

1. Foto auswählen (auch direkt von der Kamera am Smartphone)
2. Bild erscheint in einem quadratischen Bereich mit Kreis-Maske
3. Verschieben und zoomen per Touch und Maus
4. Bestätigen: Gespeichert wird ein quadratisches Bild (z. B. 512 × 512 px, WebP oder JPEG)

Im UI wird das Bild überall kreisförmig mit Farbring dargestellt. Ohne Foto zeigt der Avatar die Initiale auf der Personenfarbe.

## 4. Aufgaben, Routinen und Familienansicht

**Aufgabe**

| Feld | Pflicht | Hinweis |
| --- | --- | --- |
| Titel | ja | Freitext der Eltern |
| Icon | ja | aus der Icon-Library |
| Punktwert | ja | ganze Zahl ≥ 0 |
| Zugeordnete Person(en) | ja | eine oder mehrere; je Person eigener Status |
| Wiederholung | ja | siehe unten |
| Tagesabschnitt | nein | Morgen, Mittag, Nachmittag, Abend |
| Beschreibung | nein | in der Familienansicht nicht prominent |
| Farbe | nein | Standard = Personenfarbe |
| Aktiv | ja | inaktive Aufgaben erscheinen nicht mehr |

Ist eine Aufgabe mehreren Personen zugeordnet, erledigt und punktet jede Person sie getrennt.

**Icons**

- Etablierte Icon-Library mit vielen alltagsnahen, für Kinder verständlichen Motiven (z. B. Zahnbürste, Bett, Kleidung, Spielzeug, Schultasche, Essen, Dusche, Besen). Keine eigene Icon-Verwaltung.
- Icon-Picker mit Suche auf Deutsch und Englisch („Zahn“ und „tooth“ finden dasselbe Icon) und einer kuratierten Vorauswahl häufiger Kinderaufgaben.
- Icons groß und gut erkennbar darstellen.

**Wiederholung (Phase 1)**

- täglich
- bestimmte Wochentage (Mehrfachauswahl)
- Montag–Freitag (Schnellauswahl)
- einmalig an einem Datum

Das Modell soll spätere Erweiterungen erlauben (z. B. alle zwei Wochen, monatlich). „Heute“ wird serverseitig in der Zeitzone der Familie berechnet (Standard Europe/Berlin), nicht in UTC.

**Familienansicht (Hauptansicht)**

Alle Familienmitglieder stehen nebeneinander als Spalten, oben jeweils großer Avatar mit Farbring und Tagesfortschritt. Darunter die heutigen Aufgaben dieser Person, gruppiert nach Tagesabschnitt.

- Ein Tipp auf eine Aufgabenkarte erledigt sie sofort für die Person dieser Spalte: Haken, Einfärbung, kurze Animation, „+2 Punkte“
- Erneutes Tippen am selben Tag macht die Erledigung rückgängig (Gegenbuchung)
- Aufgabenkarten: großes Icon, kurzer Titel, Punktwert mit Stern. Das Icon trägt die Bedeutung, der Text ist Zusatz
- Tagesabschnitte mit Symbol (Sonnenaufgang, Sonne, Sonne mit Wolke, Mond); der aktuelle Abschnitt ist hervorgehoben, erledigte Abschnitte klappen zusammen
- Unter jeder Spalte: Fortschritt als Sterne-Reihe (z. B. 3 von 4), heute verdiente Punkte, Gesamtpunkte
- Ein Tipp auf den Avatar öffnet die Personenansicht: dieselben Aufgaben größer, dazu Belohnungen und Punkte dieser Person. Das ist Navigation, kein Profilwechsel; ein Zurück-Symbol führt zur Familienansicht
- Viele Personen oder schmaler Bildschirm: Spalten horizontal wischbar; am Smartphone eine Person pro Seite mit Avatar-Leiste oben

**Navigation ohne Lesen**

- Feste Navigationsleiste links (am Smartphone unten) mit großen, eindeutigen Symbolen: Heute (Stern), Belohnungen (Geschenk), später Kalender, Essen, Einkauf. Einstellungen (Zahnrad) abgesetzt am Ende
- Symbole, Farben und Avatare sind überall gleich; ein Kind lernt die Wege darüber, nicht über Text
- Beschriftungen unter Symbolen sind erlaubt, aber nie die einzige Orientierung
- Aufgabe erledigen: genau ein Tipp von der Startansicht. Belohnung einlösen: über den Avatar oder Geschenk → Avatar → Belohnung → Bestätigen

Keine Verwaltungsfunktionen im Alltagsbereich; Aufgaben anlegen und bearbeiten gehört in den Elternbereich.

## 5. Punkte, Belohnungen und Elternbereich

**Punkte als Transaktionen**

Punkte werden nie als einzelner Zähler gespeichert, sondern als Buchungen. Der Punktestand ist die Summe aller Buchungen einer Person.

| Buchung | Anlass |
| --- | --- |
| +2 | Zähne putzen erledigt |
| +1 | Bett machen erledigt |
| −2 | Zähne putzen rückgängig gemacht |
| −20 | Belohnung „Gaming-Zeit“ eingelöst |
| +5 | Manuelle Gutschrift durch Eltern |

- Jede Buchung verweist auf ihre Quelle (Erledigung, Einlösung oder manuelle Korrektur).
- Buchungen werden nie gelöscht oder geändert; Korrekturen sind Gegenbuchungen.
- Eine Aufgabe kann pro Person und Tag nur einmal Punkte bringen (per Datenbank-Constraint abgesichert, auch bei Doppel-Tipps).

**Belohnungen**

Eltern legen Belohnungen an: Name, Beschreibung, Icon oder Bild, Punktkosten, aktiv/inaktiv. Beispiele: 30 Minuten Gaming (20), Eis (30), Film aussuchen (40), Familienausflug (100).

Belohnungen erscheinen als große Karten:

- Genug Punkte: Button **Einlösen**
- Nicht genug: „Noch 8 Punkte nötig“ mit Fortschrittsanzeige

**Einlösen (Phase 1)**

Antippen von Einlösen und einmal bestätigen. Danach: Punkte abziehen, Buchung erzeugen, Einlösung speichern, visuelles Feedback. Punktestand und Kosten werden serverseitig in einer Transaktion geprüft, der Stand kann nie negativ werden.

Einlösungen haben bereits einen Status (in Phase 1 immer *eingelöst*). Ein späterer Freigabeprozess (*angefragt → genehmigt / abgelehnt*) lässt sich so ohne Umbau ergänzen.

**Elternbereich**

Nur nach Eltern-PIN bzw. Login erreichbar. Eltern können:

- Familienmitglieder anlegen, bearbeiten, Farben und Profilbilder ändern
- Aufgaben erstellen, bearbeiten, Personen zuordnen, Routinen und Punktwerte festlegen, aktivieren/deaktivieren
- Belohnungen verwalten
- Punktestände, Buchungshistorie und erledigte Aufgaben ansehen
- Punkte manuell gutschreiben oder abziehen (mit Begründung)
- Einstellungen: Familienname, Standardsprache, Zeitzone, Eltern-PIN

**Aufgabenübersicht für Eltern**

Tabellarische Übersicht mit Aufgabe (Icon + Titel), Person, Wiederholung, Tagesabschnitt und Punkten, filterbar nach Person. Bearbeiten direkt aus der Liste, ohne lange Formularwege.

**Wochenübersicht**

Eine Wochenansicht zeigt pro Person und Wochentag, welche Aufgaben anstehen und wie viele erledigt wurden (z. B. Lena: Mo–Fr je 4, Sa–So je 2). Visuell ansprechend, mit Personenfarben, nicht als reine Zahlentabelle.

## 6. Mehrsprachigkeit (Deutsch/Englisch) ab Phase 1

Die App ist ab dem ersten Commit zweisprachig: **Deutsch (Standard) und Englisch**. Eine weitere Sprache soll später nur durch eine zusätzliche Übersetzungsdatei möglich sein.

**Grundregeln**

- Keine hartcodierten UI-Texte; alle Texte über Übersetzungsschlüssel mit einer etablierten i18n-Library
- Übersetzungen als Dateien im Repository, z. B. `locales/de/*.json` und `locales/en/*.json`
- Pluralformen korrekt („1 Punkt / 2 Punkte“, „1 point / 2 points“)
- Datum, Uhrzeit, Wochentage und Wochenbeginn über Locale-Formatierung (Intl-API), nie manuell

**Spracheinstellung**

- Setup: Sprache wählbar, vorausgewählt nach Browsersprache
- Die Familie hat eine Standardsprache für das Display
- Jedes Gerät (z. B. das Smartphone eines Elternteils) kann eine eigene Sprache wählen
- Umschalten in den Einstellungen; im Alltagsbereich kein auffälliger Sprachumschalter

**Inhalte der Familie**

- Von Eltern eingegebene Inhalte (Aufgabentitel, Belohnungen, Namen) werden gespeichert wie eingegeben, ohne automatische Übersetzung und ohne mehrsprachige Datenbankfelder in Phase 1
- Vorlagen und Beispielaufgaben/-belohnungen gibt es in beiden Sprachen
- Die Icon-Suche kennt deutsche und englische Suchbegriffe

**Backend und Layout**

- Die API liefert Fehler als Codes; das Frontend übersetzt sie, ebenso Validierungsmeldungen
- Deutsche Texte sind oft deutlich länger: Karten und Buttons brechen um, statt abzuschneiden

**Tests**

- Automatische Prüfung, dass jeder Schlüssel in beiden Sprachen existiert
- Die Familienansicht wird in beiden Sprachen getestet

## 7. Technik

**Architektur und Stack**

Der Stack ist in `CLAUDE.md` festgelegt. Leitlinien: schnell zu einer funktionierenden App, einfache lokale Entwicklung, Docker-tauglich, gute i18n-Unterstützung, klare Trennung von Frontend und Backend. Keine Enterprise-Architektur.

```
Internet / LAN → Reverse Proxy (optional) → Family Dashboard → PostgreSQL
                                                          └→ Upload-Volume
```

**Datenbank**

Direkt **PostgreSQL**, keine SQLite-Zwischenlösung. Schemaänderungen ausschließlich über ein Migrationssystem; Migrationen laufen beim Containerstart automatisch.

**Datenmodell (Startpunkt, darf verbessert werden)**

| Entität | Zweck | Wichtige Felder |
| --- | --- | --- |
| User | Login-Konto | E-Mail, Passwort-Hash, Rolle, Sprache |
| Family | die eine Familie | Name, Standardsprache, Zeitzone, Eltern-PIN-Hash |
| FamilyMember | Person im Haushalt | Name, Rolle, Farbe, Avatar, optional User |
| Task | Aufgabendefinition | Titel, Icon, Beschreibung, Punkte, Tagesabschnitt, aktiv |
| TaskAssignment | Aufgabe ↔ Person | Task, FamilyMember |
| TaskRecurrence | Wiederholungsregel | Typ, Wochentage, Datum |
| TaskCompletion | Erledigung | Task, Person, Datum, Zeitpunkt; eindeutig je Task/Person/Tag |
| PointTransaction | Punktebuchung | Person, Betrag, Grund, Quelle |
| Reward | Belohnung | Name, Beschreibung, Icon/Bild, Kosten, aktiv |
| RewardRedemption | Einlösung | Reward, Person, Status, Zeitpunkt |
| CalendarConnection | Phase 2 | OAuth-Verbindung (noch nicht implementieren) |
| CalendarMapping | Phase 2 | Kalender ↔ Person (noch nicht implementieren) |

Eine Family-Tabelle gibt es trotz Single-Family-Betrieb, damit Einstellungen einen klaren Ort haben. Es gibt aber keine Tenant-Logik.

**Docker**

- `Dockerfile`, `docker-compose.yml` mit App und PostgreSQL, `.env.example`, `README.md`
- Start mit `docker compose up -d`, danach ist die App erreichbar
- Persistente Volumes für PostgreSQL und hochgeladene Bilder
- Healthchecks für App und Datenbank
- Läuft sauber hinter einem Reverse Proxy (Proxy-Header, konfigurierbare Basis-URL)
- Keine Abhängigkeit von externen CDNs zur Laufzeit: Fonts, Icons und Assets werden mitgeliefert

**Sicherheit**

- Passwörter und Eltern-PIN mit modernem Hash (Argon2)
- Sichere Sessions (HttpOnly-, Secure- und SameSite-Cookies), CSRF-Schutz wo relevant
- Rate-Limit für Login und PIN-Eingabe
- Alle Berechtigungen serverseitig prüfen; das Frontend setzt nichts durch
- Setup-Endpunkt ist gesperrt, sobald ein Admin existiert
- Uploads: Größenlimit, nur JPEG/PNG/WebP, Inhalt prüfen statt Endung, serverseitig neu kodieren, zufällige Dateinamen
- Keine Secrets im Repository, keine sensiblen Daten in Logs
- Phase 2: OAuth-Tokens verschlüsselt speichern

**Git**

- Saubere Struktur mit `.gitignore`; `.env` wird nie committet
- Sinnvolle, kleine Commits je Schritt

**Tests**

Keine riesige Suite, aber die Geschäftslogik wird getestet: Setup/Auth und Sperre der Registrierung, Familienmitglieder, Wiederholungsregeln (welche Aufgaben an welchem Tag), Erledigen und Rückgängig, Punktebuchungen, Einlösen inklusive „nicht genug Punkte“, Berechtigungen, i18n-Vollständigkeit.

## 8. Roadmap, Definition of Done und Arbeitsweise

**Phasen (Reihenfolge ist verbindlich)**

| Phase | Inhalt |
| --- | --- |
| 1 | Aufgabensystem: Docker, PostgreSQL, Setup/Admin, Familie, Mitglieder, Farben, Profilbilder mit Cropper, Aufgaben, Icons, Zuordnung, Routinen, Tagesabschnitte, Erledigen, Punkte als Buchungen, Belohnungen und Einlösen, Familienansicht, Elternbereich, Deutsch/Englisch |
| 2 | Google Kalender: OAuth, Kalender abrufen und auswählen, Kalender Personen oder „Familie“ zuordnen, Termine in Personenfarbe anzeigen, Synchronisation, Fehlerbehandlung, Refresh-Tokens |
| 3 | Familien-Dashboard: Tagesübersicht mit Aufgaben, Terminen, Fortschritt und Mitgliedern; Entscheidung Dashboard vs. Kalender als Hauptansicht |
| 4 | Essensplanung: Wochenplan, Mahlzeiten, Rezepte optional |
| 5 | Einkaufsliste: mehrere Listen, Einträge abhaken, später Verbindung zum Essensplan |

Phasen 2–5 werden in Phase 1 nicht implementiert. Die Struktur soll ihre spätere Integration aber nicht verbauen.

**Erster Meilenstein**

```
Setup + Admin → Kind anlegen (Foto + Farbe) → Aufgabe anlegen (Icon, Punkte, Routine)
→ Familienansicht → Aufgabe antippen → Punkte gutgeschrieben
```

**Definition of Done – Phase 1**

- [ ] `docker compose up -d` startet App und PostgreSQL, Migrationen laufen automatisch
- [ ] Beim ersten Start Registrierung möglich, erster Benutzer wird Admin, danach Registrierung gesperrt
- [ ] Familie konfigurierbar (Name, Sprache, Zeitzone, Eltern-PIN)
- [ ] Eltern und Kind anlegbar, je mit eigener Farbe
- [ ] Foto hochladen und per Touch zuschneiden, Avatar erscheint überall
- [ ] Aufgabe mit Icon, Punktwert, Tagesabschnitt und täglicher Routine anlegen und einem Kind zuordnen
- [ ] Familienansicht zeigt alle Personen mit ihren heutigen Aufgaben, ohne Benutzerwechsel; ein Kind findet sie allein über Symbole und Avatare
- [ ] Aufgabe per Touch abhaken und rückgängig machen, Punkte werden gebucht
- [ ] Punktestand und heutiger Fortschritt sichtbar
- [ ] Belohnung anlegen und mit ausreichenden Punkten einlösen; Historie im Elternbereich sichtbar
- [ ] Gesamte Oberfläche auf Deutsch und Englisch, ohne unübersetzte Texte
- [ ] Tests für die Kernlogik laufen grün, README ist aktuell

**Arbeitsweise**

- Iterativ arbeiten, nie alles in einem Schritt
- Vor dem Implementieren: Repository analysieren, vorhandene Dateien berücksichtigen, Plan kurz erklären
- Nach jedem größeren Schritt: Docker bauen, Container starten, Migration ausführen, App testen, Tests ausführen, Fehler beheben, README aktualisieren, committen
- Keine Funktion nur als Mockup darstellen, wenn sie funktionieren soll; echte Platzhalter klar kennzeichnen

**README enthält**

Projektbeschreibung, Features, Voraussetzungen, Installation mit Docker (`git clone`, `cp .env.example .env`, `docker compose up -d`), Konfiguration, Reverse-Proxy-Hinweise, Datenbank und Backup/Restore (PostgreSQL + Upload-Volume), Sprachen und neue Übersetzungen, Entwicklung, Architektur, Roadmap.

**Noch kein Google Kalender, kein Essensplan, keine Einkaufsliste.**
