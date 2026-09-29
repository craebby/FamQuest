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

*Entscheidung nach dem Prototyp:* „Heute“ wird später die Startseite als echtes Tages-Dashboard (etwas Kalender, Aufgaben, Essensplan, Einkaufsliste, Wetter). Die heutige Familienansicht wandert dann in einen eigenen Aufgabenbereich.

*Umsetzung (Phase 3):* „Heute“ (Symbol Haus) zeigt Uhr und Datum, das Wetter, die nächsten 5 Termine, die heutigen Aufgaben aller Personen als antippbare Symbole (ein Tipp erledigt, wie in der Familienansicht) und klar gekennzeichnete Plätze für Essen und Einkauf. Die Familienansicht heißt jetzt „Aufgaben“ und behält den Stern, damit Kinder ihren gewohnten Weg nicht neu lernen müssen.

**Bilderrahmen** *(Phase 4, entschieden am 2026-09-28)*

Im Leerlauf wird das Display zum digitalen Bilderrahmen.

- Fotoquelle: Eltern laden Fotos im Elternbereich hoch (eigener Bereich „Fotos“, mehrere auf einmal, am Handy aus der Galerie). Der Server verkleinert sie auf höchstens 2560 px an der langen Kante, kodiert sie als WebP neu und entfernt dabei Metadaten; das Aufnahmedatum wird vorher gelesen. Fotos lassen sich ausblenden, ohne sie zu löschen. Alle sichtbaren Fotos gehören der ganzen Familie; Alben und Immich/Nextcloud als Quelle sind Ideen für später (die Fotoquelle nicht so bauen, dass das verbaut wird).
- Start: per Symbol in der Navigationsleiste oder nach einstellbarer Leerlaufzeit. Ob und wann ein Gerät nach Leerlauf startet, gilt je Gerät (wie die Anzeigegröße), damit z. B. das Eltern-Handy keinen Bilderrahmen zeigt. Ein Tipp beendet den Bilderrahmen und führt zu „Heute“, ohne dabei etwas auszulösen.
- Einblendungen: Uhr und Datum, Wetter, nächster Termin, offene Aufgaben; jeweils ein- und ausschaltbar, dazu die Anzeigedauer je Foto. Diese Einstellungen gelten für die ganze Familie.
- Nachtmodus: Zeitfenster in der Zeitzone der Familie, dunkler Bildschirm oder gedimmte Uhr. Ein Browser kann die Hintergrundbeleuchtung nicht abschalten; echtes Abschalten braucht einen Befehl auf dem Display-Rechner (README).
**Essensplanung** *(Phase 5, entschieden am 2026-09-28)*

Einfach anfangen: festlegen, was es in der Woche gibt.

- Mahlzeiten: Standard nur Abendessen; Frühstück, Mittagessen und Snack lassen die Eltern für die ganze Familie zuschalten.
- Gerichte werden eingetippt, nicht vorher verwaltet. Vorschläge kommen aus den bisherigen Gerichten der Familie (zuletzt geplante zuerst) und aus rund 50 gängigen Standardgerichten; das Symbol wird zum Namen gewählt und ist änderbar. Gleicher Name in anderer Schreibweise ist dasselbe Gericht.
- Geplant wird direkt in der Ansicht „Essen“ (Navigationsleiste), bewusst **ohne Eltern-PIN** – eine Ausnahme vom Grundsatz „keine Verwaltung im Alltagsbereich“, weil jeder Erwachsene am Kühlschrank schnell eintragen können soll. Eine PIN lässt sich später nachrüsten.
- Gerichte verwalten (umbenennen, Symbol, eigenes Foto statt Symbol, löschen) geht ebenfalls ohne PIN über den Stift im Eintrage-Dialog.
- „Heute“ wird dabei zum Wochen-Dashboard: Kopf mit Uhr und Wetter klein, die aktuelle Routine der Kinder (sonst „Alles erledigt“), Platz für den Einkauf, darunter über die ganze Breite die nächsten sieben Tage mit Terminen und dem Essen am Tagesende (Symbol + Text). Bereiche lassen sich per Zahnrad ein- und ausschalten, die Anordnung ist fest. Aufgaben der Erwachsenen stehen nur noch unter „Aufgaben“; langfristig sollen sie eigenständiger werden (Putzplan und echte Todos, je Person abschaltbar).
- Später: Wünsche der Kinder, Rezepte (z. B. über Mealie), Verbindung zur Einkaufsliste.

**Einkaufsliste** *(Phase 6, entschieden am 2026-09-29)*

Eine eigene Liste in FamQuest statt der Anbindung eines fremden Dienstes (Bring! hat keine offizielle Schnittstelle, Google Keep nur für Firmenkonten); so gibt es Symbole für Kinder, die Kachel auf „Heute“ und später die Verbindung zum Essensplan.

- Eine gemeinsame Liste für die Familie, Ansicht „Einkauf“ (Einkaufswagen) in der Navigationsleiste und Kachel „Einkauf“ auf „Heute“. Eintragen und Abhaken **ohne Eltern-PIN**, wie beim Essensplan.
- Artikel werden eingetippt oder als Vorschlag angetippt: zuerst die eigenen (häufig gekaufte zuerst), dann rund 65 Standardartikel mit Symbol. Das Symbol kommt automatisch zum Namen und ist änderbar. Gleicher Name in anderer Schreibweise ist derselbe Artikel; jeder Artikel steht höchstens einmal auf der Liste. Ein Tipp auf einen Vorschlag, der schon auf der Liste steht, nimmt ihn wieder herunter.
- Optional eine Menge oder ein Hinweis („2 ×“, „laktosefrei“), gilt nur für diesen Einkauf.
- Ein Tipp hakt ab, ein weiterer nimmt es zurück. Abgehakte bleiben durchgestrichen sichtbar bis zum Ende des Tages in der Zeitzone der Familie, danach sind sie von der Liste; „Abgehakte entfernen“ räumt sie sofort weg.
- Am Handy im Browser (unterwegs über HTTPS hinter einem Reverse Proxy oder VPN). Die Liste lädt alle 30 Sekunden neu.
- Später: PWA mit Offline-Nutzung im Laden (Version 1.2), mehrere Listen, Sortierung nach Kategorie oder Gang (evtl. mit KI), Zutaten aus dem Essensplan, Export nach Obsidian.

**Symbole für Termine** *(Einschub zu Phase 2, entschieden am 2026-09-28)*

Kinder, die nicht lesen können, erkennen ihre Termine im Kalender sonst nicht. Deshalb bekommen Termine ein Symbol, wenn ein festgelegter Begriff im Titel steht (z. B. „Judo“ → Judoanzug, „Kinderturnen“ → Turnen).

- Die Eltern legen die Begriffe für die ganze Familie im Elternbereich unter „Kalender & Wetter“ fest: je Eintrag ein Symbol und ein oder mehrere Begriffe. Rund 20 Vorschläge (Turnen, Judo, Reiten, Schwimmen, Fußball, Musikschule, Verabredung, Geburtstag, Oma & Opa, Kita, Arzt, Zahnarzt …) lassen sich ankreuzen und danach ändern; eigene Einträge sind jederzeit möglich.
- Verglichen wird ohne Groß-/Kleinschreibung und Akzente, auch als Wortteil („Turnen“ passt zu „Kinderturnen“). Begriffe bis drei Buchstaben zählen nur als ganzes Wort (mit Plural-s), damit „Opa“ nicht in „Europa“ passt. Passen mehrere, gewinnt der längste („Zahnarzt“ vor „Arzt“).
- Ob die Termine einer Person Symbole bekommen, ist ein Schalter an der Person: Standard an bei Kindern, aus bei Erwachsenen; für ältere Kinder einfach ausschalten. Ein Termin bekommt das Symbol, wenn eine seiner Personen es an hat; Familientermine, wenn es bei irgendjemandem an ist.
- Das Symbol erscheint überall, wo Termine stehen: Kalender, Wochen-Dashboard „Heute“, Termindetails und Einblendung im Bilderrahmen. Die Zuordnung macht der Server.

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
| Eltern prüfen | nein | Punkte erst nach Kontrolle durch die Eltern (z. B. „Zimmer aufgeräumt“) |
| Einer für alle | nein | bei mehreren Personen: eine Erledigung gilt für alle |
| Extra | nein | freiwillige Aufgabe außerhalb der Routinen (z. B. Tisch abräumen); eigener Block, Punkte ja, Tagesfortschritt nein |

Ist eine Aufgabe mehreren Personen zugeordnet, erledigt und punktet jede Person sie getrennt. Mit der Option **„Einer für alle“** (typisch für Haushaltsaufgaben wie „Bad putzen“ bei Mama und Papa) gilt sie dagegen für alle als erledigt, sobald eine zugeordnete Person sie erledigt hat; die anderen Spalten zeigen, wer es war. Punkte und der Anteil an der Woche zählen für diese Person.

**Routinen und Reihenfolge** *(nach dem Praxistest, Phase 3)*

Eine Routine gehört zu einem Kind, einem Tagesabschnitt und bestimmten Wochentagen und besteht aus nummerierten Schritten in fester Reihenfolge (z. B. morgens Mo–Fr: Zähne putzen → anziehen → Brotdose → Kuscheltier; morgens Sa–So nur Zähne putzen → anziehen; abends: 1–5, dazu 6 optional). Mehrere Routinen desselben Kindes und Tagesabschnitts sind Versionen; ihre Wochentage überschneiden sich nie. Schritte sind Aufgaben; ein Schritt kann **optional** sein (Punkte ja, Tagesfortschritt nein). Ist eine Aufgabe für ein Kind Schritt einer Routine, steht sie für dieses Kind genau an den Tagen der Routine an; die Wiederholung der Aufgabe gilt dann nur für andere Personen. Eltern verwalten Routinen im Abschnitt „Routinen“ des Elternbereichs: Kind wählen, je Tagesabschnitt die Versionen mit Wochentagen, Schritte sortieren, optional markieren, herausnehmen, neu anlegen oder vorhandene übernehmen, Versionen für andere Tage („Andere Tage anders“, als Kopie) und Übertragen auf ein Geschwisterkind. Nur Kinder haben Routinen. Später geht der Abschnitt im Abschnitt „Aufgaben“ auf; ein „Urlaubsmodus“ ist als Idee vorgemerkt. Freiwillige Extras stehen in einem eigenen Block danach und zählen nicht zum Tagesfortschritt.

**Aufgaben-Vorlagen**

Beim Anlegen einer Aufgabe können Eltern aus einem Vorlagen-Pool wählen (zweisprachig, gruppiert in „Kinder“ und „Haushalt“ für die Erwachsenen). Eine Vorlage füllt Titel, Icon, Punkte, Tagesabschnitt und Wiederholung vor; alles bleibt änderbar. Beispiele: Zähne putzen morgens/abends (2), Spielzeug aufräumen (3), Tisch abräumen (3), Anziehen (2), Wäsche in den Wäschekorb (1), Sachen für die Kita vorbereiten (2), Bett machen (2), Müll wegbringen (3), beim Aufräumen helfen (5).

**Kontrolle durch die Eltern**

Aufgaben mit „Eltern prüfen“ werden am Display wie gewohnt angetippt, gelten dann aber als *wartet auf Kontrolle* (Sanduhr statt Haken) und bringen noch keine Punkte. Das Zahnrad der Navigationsleiste zeigt, wie viele Erledigungen warten. Im Elternbereich (nach PIN; später auch per PWA am Smartphone) bestätigen Eltern die Erledigung, dann werden die Punkte gebucht, oder lehnen sie ab, dann ist die Aufgabe wieder offen. Auch Erledigungen früherer Tage bleiben prüfbar.

**Icons**

- Etablierte Icon-Library mit vielen alltagsnahen, für Kinder verständlichen Motiven (z. B. Zahnbürste, Bett, Kleidung, Spielzeug, Schultasche, Essen, Dusche, Besen). Keine eigene Icon-Verwaltung.
- Icon-Picker mit Suche auf Deutsch und Englisch („Zahn“ und „tooth“ finden dasselbe Icon) und einer kuratierten Vorauswahl häufiger Kinderaufgaben.
- Icons groß und gut erkennbar darstellen.

**Wiederholung (Phase 1)**

- täglich
- bestimmte Wochentage (Mehrfachauswahl)
- Montag–Freitag (Schnellauswahl)
- einmalig an einem Datum
- flexibel: alle X Tage, ohne festen Wochentag (z. B. „Bad putzen, etwa einmal pro Woche“)

**Flexible Aufgaben:** Die erste Fälligkeit ist ein Startdatum, danach X Tage nach der letzten Erledigung. Ab der Fälligkeit steht die Aufgabe in der Familienansicht, bis sie erledigt ist; überfällige Aufgaben sind deutlich markiert (z. B. „seit 3 Tagen fällig“). Vor der Fälligkeit steht sie klein unter „Demnächst“ und kann schon früher erledigt werden; der Rhythmus beginnt dann ab diesem Tag neu. „Demnächst“-Aufgaben zählen nicht zum Tagesfortschritt.

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

- Feste Navigationsleiste links (am Smartphone unten) mit großen, eindeutigen Symbolen: Heute (Haus, seit Phase 3; vorher Stern), Aufgaben (Stern), Belohnungen (Geschenk), Kalender, Essen (Teller), Einkauf (Einkaufswagen), Fotos. Einstellungen (Zahnrad) abgesetzt am Ende
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

**Belohnungen (nur für Kinder)**

Belohnungen gehören jeweils einem Kind, damit Auswahl und Kosten zum Alter passen. Eltern legen sie an: Name, Beschreibung, Icon, Punktkosten, aktiv/inaktiv (Bilder statt Icons vorerst nicht). Dafür gibt es einen vorgegebenen, zweisprachigen Pool, aus dem Eltern je Kind mehrere Belohnungen auf einmal auswählen, gruppiert nach Größe:

- klein (ca. 5–20): Eis, Süßigkeit, 15 Minuten länger fernsehen/spielen/Tablet, eine Geschichte mehr, Lied für die Autofahrt aussuchen, Kuscheltier im Elternbett, Schaumbad
- mittel (ca. 20–50): Lieblingsessen aussuchen, Filmabend mit Popcorn, gemeinsam backen, Spielplatz/Fahrradtour/Bastelprojekt aussuchen, Spiel mit Mama/Papa, Frühstückswunsch
- groß (ca. 50–100+): Kino, Pizza bestellen, Schwimmbad, Zoo, Freizeitpark, Übernachtungsabend, kleines Spielzeug, Tagesausflug, besonderer Familientag, großer Wunsch

Daneben sind eigene Belohnungen mit frei gewähltem Icon möglich.

Belohnungen erscheinen als große Karten:

- Genug Punkte: Button **Einlösen**
- Nicht genug: „Noch 8 Punkte nötig“ mit Fortschrittsanzeige

**Einlösen (Phase 1)**

Antippen von Einlösen und einmal bestätigen. Danach: Punkte abziehen, Buchung erzeugen, Einlösung speichern, visuelles Feedback. Punktestand und Kosten werden serverseitig in einer Transaktion geprüft, der Stand kann nie negativ werden.

Einlösungen haben bereits einen Status (in Phase 1 immer *eingelöst*). Ein späterer Freigabeprozess (*angefragt → genehmigt / abgelehnt*) lässt sich so ohne Umbau ergänzen.

**Faire Verteilung bei Erwachsenen**

Erwachsene bekommen keine Belohnungen. Statt Punkten zeigt ihre Spalte, welchen Anteil der in dieser Woche (Montag–Sonntag, Zeitzone der Familie) von Erwachsenen erledigten Aufgaben sie übernommen haben, z. B. 40 % / 60 % als geteilter Balken in den Personenfarben. Gezählt wird die Anzahl erledigter Aufgaben. Das ist ausdrücklich kein Wettbewerb, sondern soll helfen, die Arbeit fair zu verteilen. Bei nur einem Erwachsenen entfällt die Anzeige.

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

**Wochenübersicht (verschoben)**

Eine Wochenansicht zeigt pro Person und Wochentag, welche Aufgaben anstehen und wie viele erledigt wurden (z. B. Lena: Mo–Fr je 4, Sa–So je 2). Visuell ansprechend, mit Personenfarben, nicht als reine Zahlentabelle.

*Entscheidung nach dem Praxistest (Etappe 8):* Im Elternbereich bringt sie keinen Mehrwert und wurde wieder entfernt. Sie kommt später optional in den eigenen Aufgabenbereich (blättern: was kommt noch, was ist erledigt) und als Widget auf die Startseite „Heute“ (siehe Phase 3).

*Umsetzung (Phase 3, Etappe 4):* Im Aufgabenbereich schaltet „Tag | Woche“ auf eine Wochenansicht: je Tag und Person die Aufgaben als Symbole mit Status (erledigt, wartet auf Kontrolle, kommt noch, nicht erledigt), nur zum Anschauen. Das Wochen-Widget für die Startseite folgt als optionale Kachel mit der konfigurierbaren Startseite (Etappe 5).

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
| Family | die eine Familie | Name, Standardsprache, Zeitzone, Eltern-PIN-Hash; Phase 3: Ort fürs Wetter (Name, Koordinaten); Phase 4: Einstellungen des Bilderrahmens (Einblendungen, Anzeigedauer, Nachtmodus); Phase 5: geplante Mahlzeiten; Symbole für Termine (Symbol + Begriffe) |
| FamilyMember | Person im Haushalt | Name, Rolle, Farbe, Avatar, optional User; Symbole bei Terminen (an/aus) |
| Task | Aufgabendefinition | Titel, Icon, Beschreibung, Punkte, Tagesabschnitt, aktiv, Eltern prüfen, Einer für alle, Extra |
| TaskAssignment | Aufgabe ↔ Person | Task, FamilyMember, Position (Reihenfolge je Person außerhalb von Routinen) |
| Routine | Routine eines Kindes | FamilyMember, Tagesabschnitt, Wochentage (je Kind und Abschnitt ohne Überschneidung) |
| RoutineStep | Schritt einer Routine | Routine, Task, Position, optional |
| TaskRecurrence | Wiederholungsregel | Typ, Wochentage, Datum, Intervall in Tagen (flexibel) |
| TaskCompletion | Erledigung | Task, Person, Datum, Zeitpunkt, geprüft am; eindeutig je Task/Person/Tag |
| PointTransaction | Punktebuchung | Person, Betrag, Grund, Quelle |
| Reward | Belohnung eines Kindes | Person, Name, Beschreibung, Icon, Kosten, aktiv |
| RewardRedemption | Einlösung | Reward, Person, Status, Zeitpunkt |
| CalendarConnection | Phase 2 | OAuth-Verbindung: Konto, Tokens verschlüsselt, Status |
| Calendar | Phase 2 | Kalender eines Kontos: ausgewählt, Person oder Familie (ohne Person), Sync-Stand |
| CalendarEvent | Phase 2 | Termin im geladenen Zeitraum (Serien als Einzeltermine), ganztägig oder mit Uhrzeit |
| Photo | Phase 4 | Foto für den Bilderrahmen: Dateischlüssel, Breite, Höhe, Aufnahmezeit (aus EXIF), sichtbar |
| Dish | Phase 5 | Gericht der Familie: Name (eindeutig ohne Groß-/Kleinschreibung), Symbol, optional eigenes Foto (512 × 512 WebP) |
| MealPlanEntry | Phase 5 | Gericht an einem Tag zu einer Mahlzeit (Frühstück, Mittag, Abend, Snack); höchstens eins je Tag und Mahlzeit |

Eine Family-Tabelle gibt es trotz Single-Family-Betrieb, damit Einstellungen einen klaren Ort haben. Es gibt aber keine Tenant-Logik. (Idee für später, ohne Version: mehrere, z. B. befreundete Familien auf einer Installation, angelegt vom ersten Admin oder über eine versteckte Funktion. Bis dahin nichts einbauen, was das unnötig verbaut.)

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
- Phase 5: Fotos zu Gerichten wie Avatare (bis 5 MB, Inhalt geprüft, 512 × 512 neu kodiert, ohne Metadaten); Abruf nur mit Anmeldung
- Phase 4: Fotos bis 25 MB, nur JPEG/PNG/WebP, serverseitig verkleinert und ohne Metadaten (GPS) neu kodiert; Abruf nur mit Anmeldung
- Phase 3: Externe Dienste (Wetter) fragt nur der Server an, mit so wenig Daten wie möglich (nur Koordinaten und Zeitzone)

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
| 3 | Familien-Dashboard „Heute“ als Startseite: Kalender, Aufgaben, Essensplan, Einkaufsliste, Wetter, Wochen-Widget; Aufgaben in eigenem Bereich mit optionaler Wochenansicht |
| 4 | Bilderrahmen: Fotos hochladen und verwalten, Bilderrahmen im Leerlauf oder per Symbol, Einblendungen (Uhr, Wetter, Termin, Aufgaben), Nachtmodus |
| 5 | Essensplanung: Wochenplan, Mahlzeiten, Rezepte optional |
| 6 | Einkaufsliste: eintragen mit Vorschlägen und Symbolen, abhaken, Kachel auf „Heute“; später mehrere Listen und Verbindung zum Essensplan |

Phasen 2–6 werden in Phase 1 nicht implementiert. Die Struktur soll ihre spätere Integration aber nicht verbauen.

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
