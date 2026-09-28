# FamQuest

[English](README.md) · **Deutsch**

Self-hosted, zweisprachige (Deutsch/Englisch) Familien-App für ein Touchscreen-Display am Kühlschrank:
**Routinen → Aufgaben → Erledigung → Punkte → Belohnungen.**

Eine Installation gehört genau einer Familie. Alles läuft lokal in Docker, ohne Cloud-Dienste und
ohne externe CDNs. Die vollständige Spezifikation steht in [`docs/SPEC.md`](docs/SPEC.md).

> **Status:** Version 0.x (Alpha). Phase 1 ist funktional komplett: Einrichtung beim ersten Start,
> Anmeldung, Elternbereich mit PIN, Familienmitglieder mit Farbe und Foto, Aufgaben und Routinen mit
> Vorlagen, die Familienansicht zum Abhaken, Punkte mit Tagesfortschritt, Kontrolle durch die
> Eltern, Belohnungen für Kinder, faire Verteilung unter Erwachsenen und Familien-Einstellungen. Der
> Display-Test ist abgeschlossen; der Rest zeigt sich im Alltag. Phase 2 (Google Kalender) ist
> fertig. Phase 3 läuft: „Heute“ ist jetzt ein Tages-Dashboard mit den nächsten Terminen, den
> Aufgaben aller und dem Wetter. Phase 4 hat begonnen: Das Display wird zum Bilderrahmen, per
> Symbol oder nach Leerlauf, mit Uhr, Wetter, nächstem Termin und offenen Aufgaben als
> Einblendungen und mit Nachtmodus (siehe [Roadmap](#roadmap)).

## Features

- Startseite „Heute“: Uhr, Wetter, die nächsten Termine und die Aufgaben aller auf einen Blick
- Familienansicht mit einer Spalte pro Person, Aufgaben mit einem Tipp erledigen
- Routinen (täglich, bestimmte Wochentage, Mo–Fr, einmalig, flexibel „etwa alle X Tage“) und
  Tagesabschnitte
- Routinen in fester Reihenfolge je Person, freiwillige Extra-Aufgaben im eigenen Block
- „Einer für alle“: von einem Erwachsenen erledigt, für alle erledigt
- Punkte als Buchungen, Tagesfortschritt, manuelle Gutschriften
- Belohnungen je Kind aus einer Vorschlagsliste, am Display einlösen
- Kontrolle durch die Eltern für ausgewählte Aufgaben
- Faire Verteilung: Anteil jedes Erwachsenen an den Aufgaben der Woche
- Google Kalender (nur lesend): Wochenansicht am Display, Termine in der Farbe der Person
- Wetter für euren Ort (Open-Meteo, ohne API-Schlüssel)
- Bilderrahmen: hochgeladene Fotos im Vollbild mit Überblendung, per Symbol oder nach Leerlauf,
  auf Wunsch mit Uhr, Wetter, nächstem Termin und offenen Aufgaben, dazu ein Nachtmodus (schwarz
  oder gedimmte Uhr)
- Elternbereich mit Eltern-PIN
- Profilbilder mit Zuschnitt, eine Farbe pro Person
- Deutsch und Englisch, weitere Sprachen über Übersetzungsdateien

## Schnellstart auf einem Docker-Host

Auf dem Host braucht ihr nur Git und Docker mit dem Compose-Plugin. Das Image baut Frontend und
Backend selbst (Multi-Stage-Build), Node.js oder Python sind nicht nötig.

```sh
git clone https://github.com/craebby/FamQuest.git
cd FamQuest
cp .env.example .env
# Zufälliges Datenbank-Passwort erzeugen und in .env eintragen
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
docker compose up -d --build
```

Der erste Build dauert ein paar Minuten. Danach ist die App unter `http://<host>:8080` erreichbar
(Port über `APP_PORT` in `.env` einstellbar). Beim Start des App-Containers laufen die
Datenbank-Migrationen automatisch. Hebt die `.env` gut auf: Sie enthält das Datenbank-Passwort und
wird für ein Restore gebraucht.

Status prüfen:

```sh
docker compose ps                        # beide Dienste sollten "healthy" sein
curl http://localhost:8080/api/health    # {"status":"ok","database":"ok"}
```

Aktualisieren:

```sh
git pull
docker compose up -d --build
```

Unter macOS `sed -i ''` statt `sed -i` verwenden oder die `.env` einfach von Hand bearbeiten.

## Erster Start

Beim ersten Aufruf erscheint die Einrichtung: Sprache, Familienname, E-Mail, Passwort (zweimal)
und die Eltern-PIN. Das erste Konto wird Administrator. Danach ist die Einrichtung dauerhaft gesperrt;
weitere Konten lassen sich nicht über die Oberfläche registrieren.

- Das Display bleibt dauerhaft angemeldet (die Anmeldung verlängert sich bei Nutzung, bis zu einem
  Jahr ohne Nutzung).
- Der Elternbereich (Zahnrad) ist zusätzlich durch die Eltern-PIN geschützt. Nach 2 Minuten ohne
  Eingabe kehrt das Display zur Startseite zurück und sperrt ihn wieder.
- Der Elternbereich hat ein Menü mit acht Bereichen: **Prüfen & Punkte** (mit roter Zahl, wenn
  etwas wartet), **Familie**, **Aufgaben**, **Routinen**, **Belohnungen**, **Fotos**, **Kalender &
  Wetter** und
  **Einstellungen** (Familie, PIN, Gerät, Konto). Am Tablet und am Display steht das Menü links, am
  Handy stehen die vier wichtigsten Bereiche unten, der Rest unter **Mehr**. Jeder Bereich hat eine
  eigene Adresse (z. B. `/parents/routines`), beim Neuladen bleibt man also, wo man war.
- Die PIN lässt sich im Elternbereich ändern oder abschalten. PIN vergessen: Mit dem Passwort des
  Kontos eine neue PIN festlegen.
- Nach 5 falschen Versuchen (Passwort oder PIN) sind weitere Versuche 15 Minuten lang gesperrt.
- Familienname, Sprache der Familie und Zeitzone lassen sich im Elternbereich unter
  „Einstellungen“ ändern. Die Zeitzone bestimmt, wann ein neuer Tag beginnt (Standard: Europe/Berlin).

## Familienmitglieder

Im Elternbereich unter „Familie“ legt ihr alle Personen des Haushalts an: Name, Rolle
(Elternteil oder Kind), Farbe und optional ein Foto. Kinder brauchen kein Konto und kein Passwort.

- Jede Person hat eine eigene Farbe (Orange, Blau, Lila, Grün, Rot, Türkis, Gelb). Vergebene
  Farben sind ausgegraut; es sind daher höchstens sieben Personen möglich.
- **Reihenfolge ändern** legt fest, in welcher Reihenfolge die Personen überall erscheinen
  (Spalten, Filter, Belohnungen): mit Pfeiltasten oder per Ziehen mit der Maus.
- Foto wählen (am Smartphone auch direkt mit der Kamera), im Kreis verschieben und zoomen,
  übernehmen. Ohne Foto zeigt der Avatar die Initiale auf der Personenfarbe.
- Das Bild wird im Browser zugeschnitten und vom Server geprüft (nur JPEG, PNG oder WebP, höchstens
  5 MB), auf 512 × 512 px verkleinert und als WebP neu gespeichert. Metadaten wie GPS-Daten gehen
  dabei verloren. Die Bilder liegen im Volume `uploads` und sind nur mit Anmeldung abrufbar.

## Aufgaben und Routinen

Im Elternbereich unter „Aufgaben“ legt ihr fest, wer was wann erledigt. Eine Aufgabe hat:

- **Symbol**: aus einem mitgelieferten Katalog von gut 200 farbigen Emoji-Symbolen
  ([Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT-Lizenz), sortiert nach
  Kategorien wie Körperpflege, Anziehen, Schule oder Haushalt. Die Suche versteht Deutsch und
  Englisch („Zahn“ und „tooth“ finden dieselbe Zahnbürste). Solange ihr kein Symbol selbst wählt,
  schlägt die App eins passend zum Titel vor.
- **Titel** und optional eine Beschreibung
- **Punkte**: 0 bis 1000
- **Für wen**: eine oder mehrere Personen; jede Person erledigt die Aufgabe und bekommt die Punkte
  für sich. Mit **„Einer für alle“** (ab zwei Personen) gilt sie dagegen für alle als erledigt,
  sobald eine Person sie erledigt hat, etwa „Bad putzen“ bei Mama und Papa. Die anderen Spalten
  zeigen den Avatar der Person, die es war; Punkte und der Anteil an der Woche zählen für sie.
- **Wie oft**: jeden Tag, an bestimmten Wochentagen (mit Schnellauswahl Mo–Fr oder Wochenende),
  einmal an einem Datum oder **flexibel** (siehe unten)
- **Wann**: morgens, mittags, nachmittags, abends, jederzeit oder **Extra**. Die Aufgaben eines
  Tagesabschnitts bilden eine **Routine** in fester Reihenfolge (z. B. morgens: Zähne putzen →
  anziehen → Kuscheltier einpacken); für Kinder stellt ihr sie unter [Routinen](#routinen)
  zusammen. **Extras** sind freiwillig (z. B. Tisch abräumen): Sie stehen
  in einem eigenen Block am Ende, bringen Punkte, zählen aber nicht zum Tagesfortschritt
- **Farbe der Karte**: standardmäßig die Farbe der jeweiligen Person
- **Aktiv**: inaktive Aufgaben bleiben gespeichert, erscheinen aber nicht in der Familienansicht
- **Eltern prüfen**: Punkte gibt es erst, wenn ihr die Erledigung bestätigt habt (siehe
  [Kontrolle durch die Eltern](#kontrolle-durch-die-eltern))

Beim Anlegen füllt **„Aus Vorlagen wählen“** das Formular mit einem Tipp vor. Es gibt zwei
Gruppen: „Kinder“ mit kurzen Alltagsroutinen (morgens Zähne putzen, Anziehen, Frühstücken; nach
Kita oder Schule Rucksack aufhängen, Brotdose ausräumen; abends Spielsachen aufräumen, Schlafanzug,
Zähne putzen, ab ins Bett) plus freiwilligen Extras (Tisch decken, beim Kochen helfen …) und
„Haushalt“ für die Care-Arbeit der Erwachsenen samt Mental Load (Kochen, Spülmaschine, Wäsche,
Einkaufen, Putzen, Post und Rechnungen, Ablage, Technik, Steuererklärung …). Haushaltsvorlagen sind
„Einer für alle“ und meist flexibel mit alltagsnahen Abständen (Müll alle 2 Tage, Bad wöchentlich,
Bettwäsche alle 2 Wochen, Fenster alle 3 Monate, Steuer jährlich). Alles bleibt danach änderbar. Die
Vorlagen stehen in `frontend/src/pools/tasks.ts`, ihre Titel in
`frontend/src/locales/<sprache>/pool.json`.

Die Belohnungs-Vorschläge (`frontend/src/pools/rewards.ts`) enthalten nur, was es nicht ohnehin
gibt, z. B. einen besonderen Frühstückswunsch, Bildschirmzeit, einen Film aussuchen, eine besondere
Aktivität, Geld für die Spardose, etwas aus dem Spielzeugladen. Die Preise gehen von etwa 15–20
Punkten am Tag aus; große Belohnungen (Übernachtungsparty, Ausflug, Freizeitpark, großer Wunsch)
sind zum Sparen über mehrere Wochen gedacht.

**Flexible Aufgaben** haben keinen festen Tag, sondern einen Rhythmus: alle X Tage (Schnellwahl
alle 2 Tage, jede Woche, alle 2 Wochen, jeden Monat) und ein Datum für die erste Fälligkeit. Ab dann
steht die Aufgabe in der Familienansicht, bis sie erledigt ist; ist sie überfällig, zeigt die Karte
einen roten Hinweis mit Wecker („seit 3 Tagen fällig“). Danach ist sie X Tage nach der Erledigung
wieder dran. Vorher steht sie klein unter **„Demnächst“** und kann schon früher erledigt werden,
der Rhythmus beginnt dann ab diesem Tag neu. „Demnächst“ zählt nicht zum Tagesfortschritt.

Die Liste lässt sich mit einem Tipp auf eine Person filtern. Neue Aufgaben sind dann für diese
Person vorausgewählt. Gefiltert auf eine Person zeigt die Liste deren Aufgaben in Blöcken genau wie am
Display. Der Schalter in jeder Zeile setzt eine Aufgabe aktiv oder inaktiv. Wird eine
Person gelöscht, bleiben ihre Aufgaben erhalten; Aufgaben ohne Person sind in der Liste markiert.

Die Symbole sind beim Build ins Frontend eingebettet (nur die Katalog-Symbole, nicht das ganze Set).
Katalog erweitern: Namen aus dem Set `fluent-emoji-flat` (z. B. auf
[icon-sets.iconify.design](https://icon-sets.iconify.design/fluent-emoji-flat/)) in
`frontend/src/icons/categories.json` eintragen und in `frontend/src/locales/<sprache>/icons.json`
Suchbegriffe ergänzen (der erste Begriff ist die Bezeichnung). Symbole, die es im Set nicht gibt
(z. B. einen Schlafanzug), setzt `frontend/src/icons/composed.json` aus Symbolen des Sets zusammen.
Tests prüfen, dass jedes Symbol existiert und in jeder Sprache eindeutig benannt ist.

### Routinen

Im Abschnitt **„Routinen“** des Elternbereichs stellt ihr die Routinen jedes Kindes zusammen: eine
feste Abfolge von Schritten für **morgens**, **nachmittags** und **abends** (**mittags**, sobald es
dort eine Routine gibt). Oben ein Kind antippen; das gewählte Kind ist immer hervorgehoben.

- **Versionen für verschiedene Tage:** Jede Routine hat ihre Wochentage (Mo … So antippen). Mit
  **„Andere Tage anders“** bekommt ein Tagesabschnitt eine weitere Version, z. B. einen kürzeren
  Morgen am Wochenende; sie startet als Kopie der Schritte, ihr nehmt nur heraus, was nicht nötig
  ist. Ein Tag gehört immer zu genau einer Version; Tage ohne Routine stehen darunter.
- **Schritte** sind nummeriert in der Reihenfolge, in der das Kind sie am Display sieht, dazu die
  Anzahl der Schritte und die Sterne. **↑/↓** ändert die Reihenfolge, **✕** nimmt einen Schritt aus
  der Routine (die Aufgabe selbst bleibt), ein Tipp öffnet den Aufgaben-Editor.
- **Optionale Schritte** (z. B. „Kuscheltier einpacken“) bleiben in der Routine und bringen Punkte,
  zählen aber nicht zum Tagesfortschritt; am Display haben sie einen gestrichelten Rand.
- **„Schritt hinzufügen“** legt einen neuen Schritt an (der Editor fragt nur nach Symbol, Titel,
  Punkten usw.; Kind, Tagesabschnitt und Tage bestimmt die Routine) oder übernimmt einen
  vorhandenen, z. B. „Zähne putzen“ aus der Werktags-Version.
- **„Auf anderes Kind übertragen“** kopiert eine Version auf ein Geschwisterkind (gleiche Schritte;
  jedes Kind erledigt und punktet getrennt). An diesen Tagen ersetzt sie dessen bisherige Routine.

Ist eine Aufgabe für ein Kind Schritt einer Routine, steht sie für dieses Kind genau an den Tagen
der Routine an; ihr eigenes „Wie oft?“ gilt nur noch für andere Personen (z. B. einen Erwachsenen
mit derselben Aufgabe). Extras, „Jederzeit“ sowie einmalige und flexible Aufgaben gehören zu keiner
Routine; sie bleiben im Abschnitt „Aufgaben“. Beim Update werden bestehende Aufgaben der Kinder
automatisch zu Routinen: Wochentage mit denselben Schritten werden eine Version, die Reihenfolge
bleibt.

## Heute (Startseite)

Die Startseite ist ein Tages-Dashboard fürs Wanddisplay: oben Familienname, Datum und eine große Uhr,
darunter drei Spalten (auf schmalen Bildschirmen untereinander):

- **Wetter** jetzt (Symbol, Temperatur, Beschreibung), heute Höchst-/Tiefstwert und
  Regenwahrscheinlichkeit (ab 50 % mit Regenschirm), dazu die nächsten zwei Tage. Den Ort legen die
  Eltern im Elternbereich unter **Kalender & Wetter** fest (Name oder Postleitzahl suchen, dann aus
  der Liste wählen).
- **Termine**: die nächsten 5 Termine aus dem Kalender (laufende und kommende, bis zwei Wochen im
  Voraus), jeweils mit „Heute“, „Morgen“ oder Datum, in der Personenfarbe mit Avataren. Darüber ein
  Feiertag oder Ferien von heute. Ein Tipp öffnet die Details, der Pfeil die Wochenansicht.
- **Aufgaben**: eine Zeile pro Person mit Avatar, Fortschrittsbalken, Punkten (Kinder) und den
  heutigen Aufgaben als kleine Symbole mit kurzem Titel, gruppiert wie am Display: morgens,
  nachmittags, abends (jede Routine in ihrer Reihenfolge, der aktuelle Tagesabschnitt
  hinterlegt), dann „Jederzeit“ und die Extras. Erwachsene sehen statt eines Balkens ihren Anteil an der Woche.
  **Ein Tipp** erledigt eine Aufgabe wie in
  der Familienansicht (mit „+2“, Sanduhr bei Kontrolle durch die Eltern, Avatar bei „Einer für
  alle“); nochmal tippen macht es rückgängig. Der Avatar öffnet die Personenansicht, der Pfeil die
  Familienansicht.
- **Essen** und **Einkauf** sind Platzhalter, deutlich als „Kommt bald“ gekennzeichnet (Phasen 5
  und 6).

Ohne Ort oder Kalender zeigen die Kacheln einen kurzen Hinweis mit Knopf zum Elternbereich.

**Startseite anpassen:** Das Zahnrad auf „Heute“ fragt die Eltern-PIN ab und zeigt dann alle
Kacheln als Liste. Jede Kachel lässt sich ein- und ausschalten und mit den Pfeilen nach oben oder
unten schieben; „Standard wiederherstellen“ holt den ursprünglichen Aufbau zurück. Der Aufbau wird
auf dem Server gespeichert und gilt für alle Displays der Familie. Die zuschaltbare Kachel
**Woche** zeigt je Person und Tag einen Ring (voller Ring = alles geschafft); der Pfeil öffnet die
Wochenansicht im Aufgabenbereich.

## Familienansicht

Die Familienansicht („Aufgaben“, Stern) zeigt alle Familienmitglieder nebeneinander, jede Person
mit großem Avatar und ihren heutigen Aufgaben. Niemand muss sich an- oder ummelden: Wem eine Aufgabe
gehört, ergibt sich aus der Spalte.

- **Ein Tipp** auf eine Aufgabenkarte erledigt sie für diese Person (Haken, Einfärbung in der
  Personenfarbe). **Nochmal tippen** macht es rückgängig. Jede Aufgabe kann pro Person und Tag nur
  einmal erledigt sein, auch bei Doppel-Tipps.
- Die Aufgaben sind nach **Tageszeit** als Routinen in der von den Eltern festgelegten Reihenfolge
  gruppiert (Sonnenaufgang, Sonne, Sonne mit Wolke, Mond; dazu „Jederzeit“), danach folgen die
  freiwilligen **Extras** (Bizeps). Der aktuelle Abschnitt ist farbig hervorgehoben. Ist ein Abschnitt komplett
  erledigt, klappt er zu einer Zeile mit Haken zusammen und lässt sich mit einem Tipp wieder öffnen.
  Tageszeiten: morgens bis 11 Uhr, mittags bis 14 Uhr, nachmittags bis 18 Uhr, danach abends.
- Ein Tipp auf den **Avatar** öffnet die Personenansicht mit denselben Aufgaben in groß. Nach einer
  Minute ohne Eingabe kehrt das Display zur Startseite zurück.
- Bei vielen Personen oder schmalem Bildschirm lassen sich die Spalten seitlich wischen. Am
  Smartphone steht eine Person pro Seite, oben eine Avatar-Leiste zum Wechseln.
- Die **Navigationsleiste** (links, am Smartphone unten) führt mit Symbolen zu „Heute“ (Haus), zu
  den Aufgaben (Stern, die Familienansicht), zu den Belohnungen (Geschenk), zum Kalender und zu den
  Einstellungen (Zahnrad, Elternbereich mit PIN). Eine rote
  Zahl am Zahnrad zeigt, wie viele Erledigungen auf die Kontrolle der Eltern warten.

**Tag | Woche:** Der Umschalter oben rechts in der Familienansicht öffnet die **Wochenansicht**
(Montag bis Sonntag, blättern mit den Pfeilen wie im Kalender). Sie zeigt je Tag und Person die
Aufgaben als kleine Symbole in der Reihenfolge der Routine: erledigt in der Personenfarbe mit Haken,
wartet auf Kontrolle mit Sanduhr, kommt noch in Weiß, an vergangenen Tagen nicht erledigt blass,
„Einer für alle“ von jemand anderem erledigt in Grau. Neben jeder Person steht, wie viele
Routine-Aufgaben erledigt sind (Extras zählen nicht mit). Die Woche ist nur zum Anschauen; erledigt
wird heute, in der Tagesansicht oder auf der Startseite. Vergangene Tage zeigen die Aufgaben so, wie
sie jetzt eingerichtet sind (ab ihrem Anlegetag), dazu alles, was tatsächlich erledigt wurde.

Die Oberfläche skaliert ab Tablet-Breite mit der Fensterhöhe: volle Größe bei 1080 px
(Wanddisplay), proportional kleiner auf Laptops mit Skalierung (z. B. 14"-Bildschirm), nie unter
75 %. Am Smartphone bleibt sie in voller Größe. Im Elternbereich unter „Dieses Gerät“ lässt sich
zusätzlich eine **Anzeigegröße** (klein, normal, groß) wählen, die nur auf diesem Gerät gilt, z. B.
kleiner am Tablet und größer am Wanddisplay. Dort steht auch, was der Browser meldet
(Fenstergröße, Skalierung, Grundschrift). Das hilft beim Einrichten eines neuen Displays.

„Heute“ rechnet der Server immer in der Zeitzone der Familie. Die Ansicht lädt sich jede Minute neu,
damit Tageswechsel und Änderungen aus dem Elternbereich ankommen.

## Punkte

Unter jedem Avatar zeigt eine **Sterne-Reihe** den Tagesfortschritt (ein Stern pro Aufgabe, erledigte
leuchten; ab 9 Aufgaben ein Balken). Daneben stehen die **heute verdienten Punkte** (Stern) und der
**Punktestand** (Pokal). Beim Abhaken schwebt kurz „+2 ⭐“ über der Karte. Wer in den
Systemeinstellungen reduzierte Bewegung eingestellt hat, sieht die Anzeige ohne Animation.

Punkte werden nie als Zähler gespeichert, sondern als **Buchungen**; der Punktestand ist ihre Summe.

- Erledigen bucht den Punktwert der Aufgabe, Rückgängig bucht genau diesen Betrag zurück
  (Gegenbuchung), auch wenn der Punktwert inzwischen geändert wurde.
- Pro Aufgabe, Person und Tag gibt es höchstens eine Erledigung (Datenbank-Constraint). Nur die
  Anfrage, die sie tatsächlich anlegt oder löscht, bucht; Doppel-Tipps bringen also keine doppelten
  Punkte.
- Buchungen werden nie geändert oder gelöscht. Wird eine Aufgabe gelöscht, bleiben ihre Buchungen
  mit dem damaligen Titel erhalten. Nur wenn eine Person gelöscht wird, verschwinden auch ihre
  Buchungen.
- Aufgaben mit 0 Punkten erzeugen keine Buchung.

Im Elternbereich zeigt der Abschnitt **„Punkte“** den Stand jeder Person. Ein Tipp auf die Person
öffnet ihre **Buchungshistorie** (neueste zuerst, ältere per „Ältere Buchungen laden“) und ein
Formular, um Punkte mit Begründung **gutzuschreiben oder abzuziehen** (1 bis 1000). Ein Abzug darf
den Punktestand nicht unter 0 drücken.

Erwachsene sammeln keine Punkte (siehe [Faire Verteilung](#faire-verteilung)); ihre Karten zeigen
keine Punktwerte.

## Kontrolle durch die Eltern

Für Aufgaben wie „Zimmer aufräumen“ lässt sich im Editor **„Eltern prüfen“** einschalten. Das Kind
tippt die Karte wie gewohnt an; statt des Hakens erscheint eine **Sanduhr**, und es gibt noch keine
Punkte. Am Zahnrad der Navigationsleiste steht, wie viele Erledigungen warten.

Im Elternbereich (nach PIN) steht dann ganz oben **„Zu prüfen“**:

- **Passt** bestätigt die Erledigung und bucht die Punkte, genau einmal und für den Tag der
  Erledigung. Mehrere Einträge lassen sich mit „Alle bestätigen“ auf einmal bestätigen.
- **Nochmal** lehnt ab: Die Erledigung wird entfernt, die Aufgabe ist wieder offen.

Auch Erledigungen früherer Tage bleiben prüfbar. Macht das Kind die Erledigung vor der Kontrolle
selbst rückgängig, wird nichts gebucht.

## Belohnungen

Belohnungen gibt es **nur für Kinder**, und jedes Kind hat seine eigenen. So passen Auswahl und
Kosten zum Alter. Im Elternbereich unter „Belohnungen“ wählt ihr ein Kind und dann:

- **Aus Vorschlägen wählen**: eine Liste mit gut 30 Belohnungen in drei Größen (klein etwa 5–20,
  mittel 20–50, groß 50–100 Punkte), z. B. Eis, eine Geschichte mehr, 15 Minuten länger
  aufbleiben, Filmabend mit Popcorn, Zoo oder Freizeitpark. Mehrere lassen sich auf einmal
  übernehmen, schon vorhandene sind markiert.
- **Eigene Belohnung**: Name, Symbol (Kategorie „Belohnungen“ im Katalog), Kosten (1 bis 1000),
  Beschreibung.

Kosten und Namen lassen sich danach ändern. Inaktive Belohnungen sind am Display nicht zu sehen.
Darunter steht, was das Kind zuletzt eingelöst hat.

Am Display führt das **Geschenk** in der Navigationsleiste zur Auswahl der Kinder, ein Tipp auf den
Avatar zu ihren Belohnungskarten (die Personenansicht eines Kindes zeigt sie ebenfalls):

- Mit genug Punkten zeigt die Karte **„Einlösen“**, sonst **„Noch 8 Punkte nötig“** mit einem Balken.
- Nach „Einlösen“ fragt eine große Karte mit ✓ und ✗ nach. Bestätigt, bucht der Server die Kosten ab.
  Er prüft Punktestand und Kosten dabei in einer Transaktion, der Stand kann nie negativ werden.
  Danach gibt es eine kurze Feier.

Die Einlösung speichert Name, Symbol und Kosten. Die Historie stimmt also auch, wenn die Belohnung
später geändert oder gelöscht wird. Die Vorschläge stehen in `frontend/src/pools/rewards.ts`.

## Faire Verteilung

Erwachsene bekommen keine Belohnungen. Ihre Spalte zeigt stattdessen, welchen **Anteil** der in
dieser Woche (Montag bis Sonntag, Zeitzone der Familie) von Erwachsenen erledigten Aufgaben sie
übernommen haben, z. B. 40 % und 60 %, als geteilten Balken in den Personenfarben. Die
Personenansicht zeigt zusätzlich alle Anteile mit der Zahl der Aufgaben. Gezählt wird die Anzahl
erledigter Aufgaben, Punktwerte spielen keine Rolle. Das ist bewusst kein Wettbewerb, sondern soll
helfen, die Arbeit fair zu verteilen. Mit nur einem Erwachsenen entfällt die Anzeige.

## Google Kalender

FamQuest zeigt eure Google-Kalender als Woche am Display: eine Spalte pro Tag (Montag bis
Sonntag), Termine in der Farbe der Person, der sie gehören, mit ihrem Avatar. FamQuest liest die
Kalender nur und ändert nichts daran.

**Im Elternbereich unter Kalender:**

- Ein oder mehrere Google-Konten verbinden (Einrichtung siehe unten).
- Alle Kalender des Kontos erscheinen in einer Liste. Die, die am Display zu sehen sein sollen,
  einschalten.
- Je Kalender wählen, wem er **gehört**: einer Person oder der **Familie** (für alles, was alle
  betrifft, z. B. ein gemeinsamer Familienkalender, Müllabfuhr oder Feiertage).
- **Farbe der Familie**: „Familie“ bekommt eine eigene Farbe und ein Haus als Avatar. Rosa und Grau
  sind für die Familie reserviert; Farben, die schon eine Person hat, sind ausgegraut.
- Jeder Kalender zeigt, wann er zuletzt aktualisiert wurde oder was schiefging. **Jetzt
  aktualisieren** holt sofort den neuesten Stand.

**Am Display:** Sobald mindestens ein Kalender eingeschaltet ist, zeigt die Navigationsleiste ein
Kalender-Symbol. Mit den Pfeilen blättert man wochenweise; heute ist hervorgehoben, vergangene
Termine werden blasser. Ein Tipp auf einen Avatar oben zeigt nur die Termine dieser Person (und die
der Familie), ein zweiter Tipp wieder alle. Steht derselbe Termin in mehreren Kalendern (z. B. eine
Einladung an beide Eltern), erscheint er einmal mit allen Avataren. Kann ein Kalender nicht
aktualisiert werden, erscheint über der Woche ein Hinweis; die zuletzt bekannten Termine bleiben
sichtbar. Ganztägige Termine sehen aus wie alle anderen, nur mit „Ganztägig“ statt einer Uhrzeit.
Ein Tipp auf einen Termin zeigt die Details: Datum und Uhrzeit, Personen, Ort, Beschreibung und die
Kalender, aus denen er stammt. Bearbeitet werden Termine im Google Kalender; FamQuest zeigt sie nur
an.

**Feiertage und Ferien:** Ist die Familiensprache Deutsch, gibt es im Elternbereich unter
**Kalender** die Einstellung **Bundesland** mit zwei Schaltern, **Feiertage** und **Schulferien**.
Sie erscheinen dezent in Grau über den Terminen des Tages (🎉 Feiertag, 🏖️ Ferien) und
funktionieren auch ohne Google-Konto. Feiertage werden offline berechnet, Schulferien einmal am Tag
von [OpenHolidays](https://www.openholidaysapi.org) geladen (übertragen wird nur das Bundesland,
keine persönlichen Daten).

## Wetter

Die Startseite zeigt das Wetter für einen Ort. Die Vorhersage kommt von
[Open-Meteo](https://open-meteo.com) (für nicht kommerzielle Nutzung kostenlos, ohne API-Schlüssel).
Die Anfrage stellt der Server, nicht der Browser; übertragen werden nur die Koordinaten des Orts und
die Zeitzone. Vorhersagen werden 15 Minuten zwischengespeichert; ist Open-Meteo nicht erreichbar,
bleibt die letzte Vorhersage bis zu 6 Stunden mit Hinweis stehen. Auch die Ortssuche im
Elternbereich läuft über den Server (Open-Meteo Geocoding). Ohne Ort stellt FamQuest keine
Wetter-Anfragen.

**Synchronisation:** Alle 5 Minuten (`CALENDAR_SYNC_MINUTES`) fragt FamQuest bei Google nach, ob
sich etwas geändert hat (inkrementell per Sync-Token). Nur dann, beim Wochenwechsel oder zur
Sicherheit alle 6 Stunden werden die Termine neu geladen, und zwar für einen Zeitraum von 4 Wochen
vor der aktuellen Woche bis etwa ein halbes Jahr voraus. Serientermine werden als einzelne Termine
gespeichert; ganztägige und mehrtägige Termine werden unterstützt. Ist Google nicht erreichbar oder
bremst die Abrufe, versucht es der nächste Durchlauf einfach wieder.

Weil FamQuest selbst gehostet ist, braucht jede Installation einen eigenen Zugang bei Google.
Das ist einmalig und kostenlos. Voraussetzung ist, dass FamQuest per **HTTPS unter einer Domain**
erreichbar ist (z. B. `https://familie.example.com` über einen Reverse Proxy). Google erlaubt keine
Weiterleitung an eine IP-Adresse oder an `http://`, nur an `http://localhost` zum Entwickeln.

1. In der [Google Cloud Console](https://console.cloud.google.com/) ein neues Projekt anlegen,
   z. B. „FamQuest“.
2. Unter **APIs & Dienste → Bibliothek** die **Google Calendar API** aktivieren.
3. Unter **Google Auth Platform** die App einrichten: Name (z. B. FamQuest) und Support-E-Mail,
   Zielgruppe **Extern**. Unter **Datenzugriff** den Bereich
   `https://www.googleapis.com/auth/calendar.readonly` hinzufügen.

   Startseite, Datenschutzerklärung und Nutzungsbedingungen sind für den eigenen Gebrauch
   optional (Pflicht erst für eine Überprüfung durch Google). Wer sie angeben möchte, kann die
   Projektseiten verwenden: `https://craebby.github.io/FamQuest/`,
   `https://craebby.github.io/FamQuest/privacy-policy.html` und
   `https://craebby.github.io/FamQuest/terms-of-service.html`. Sie beschreiben die Software;
   für eigene Angaben die Dateien aus `docs/` anpassen und selbst veröffentlichen.
4. Unter **Clients** einen neuen OAuth-Client vom Typ **Webanwendung** anlegen. Als
   **Autorisierte Weiterleitungs-URI** eintragen:
   `https://familie.example.com/api/calendar/google/callback` (mit eurer Domain). Die genaue
   Adresse zeigt der Elternbereich unter **Kalender → Einrichtung bei Google**.
5. Client-ID und Clientschlüssel in die `.env` eintragen, dazu einen Schlüssel für die
   Verschlüsselung der Tokens:
   ```sh
   GOOGLE_CLIENT_ID=1234….apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-…
   TOKEN_ENCRYPTION_KEY=…   # openssl rand -base64 32
   ```
   Danach `docker compose up -d`.
6. **Wichtig:** Unter **Zielgruppe** die App **veröffentlichen** („In Produktion“). Im Status
   „Test“ laufen die Zugriffe nach 7 Tagen ab und die Konten müssten jede Woche neu verbunden
   werden. Eine Überprüfung durch Google ist für den eigenen Gebrauch nicht nötig.

Beim Verbinden zeigt Google dann den Hinweis „Google hat diese App nicht überprüft“. Das ist bei
einer selbst gehosteten App normal: **Erweitert → Weiter zu FamQuest** wählen und den
Kalenderzugriff ankreuzen. Mehrere Google-Konten sind möglich, z. B. eins je Elternteil.

Den `TOKEN_ENCRYPTION_KEY` zusammen mit der `.env` sichern. Geht er verloren oder wird er geändert,
zeigt der Elternbereich bei jedem Konto „Neu verbinden“; sonst geht nichts verloren. Ein Konto zu
trennen widerruft den Zugriff auch bei Google.

## Fotos (Bilderrahmen)

Im Elternbereich unter **Fotos** (Symbol Bilderrahmen) ladet ihr die Fotos für den Bilderrahmen
hoch.

- **Fotos hinzufügen** wählt mehrere Fotos auf einmal, am Handy direkt aus der Galerie. Sie gehen
  nacheinander hoch; ein Balken zeigt den Fortschritt. Scheitert ein Foto, steht es mit Grund in
  einer Liste, die anderen kommen trotzdem an.
- Möglich sind JPEG, PNG und WebP bis 25 MB. iPhones wandeln HEIC-Fotos beim Hochladen meist selbst
  in JPEG um.
- Der Server prüft jedes Foto, dreht es richtig herum, verkleinert es auf höchstens 2560 Pixel an
  der langen Kante und speichert es neu als WebP. Dabei fallen Ortsangaben (GPS) und andere
  Metadaten weg; nur das Aufnahmedatum wird vorher übernommen und unter dem Foto angezeigt.
- Mit **Zeigen** blendet ihr ein Foto aus oder wieder ein, ohne es zu löschen. **Löschen** (Mülleimer)
  fragt vorher nach.

Die Fotos liegen im Volume `uploads` (Unterordner `photos`), sind nur mit Anmeldung abrufbar und
werden vom [Backup](#backup-und-restore) mit erfasst.

**Der Bilderrahmen am Display**

- Sobald mindestens ein Foto gezeigt wird, erscheint in der Navigationsleiste das Symbol **Fotos**
  (gerahmtes Bild). Es startet den Bilderrahmen.
- Die Fotos erscheinen im Vollbild in zufälliger Reihenfolge mit weicher Überblendung,
  standardmäßig eines pro Minute. Jedes Foto kommt einmal dran, bevor sich eines wiederholt.
- Fotos, die ungefähr zum Bildschirm passen, füllen ihn aus. Hochformat und stark abweichende
  Formate erscheinen ganz, dahinter dasselbe Foto unscharf statt schwarzer Balken.
- Ein Tipp irgendwohin beendet den Bilderrahmen und führt zu „Heute“. Dieser Tipp hakt nichts ab.
- **Start nach Leerlauf** stellt ihr je Gerät ein: **Einstellungen → Dieses Gerät → Bilderrahmen
  nach Leerlauf** (aus, 1, 5, 10 oder 30 Minuten; standardmäßig aus). Am Küchendisplay einschalten,
  auf den Eltern-Handys aus lassen. Er startet nur aus den Alltagsansichten, nicht im Elternbereich.

**Einblendungen und Anzeigedauer**

Im Elternbereich unter **Fotos** legt die Karte **Bilderrahmen** fest, was unten über den Fotos
erscheint. Die Einstellungen gelten für die ganze Familie und wirken sofort.

- **Uhr und Datum** (unten links, groß), **Wetter** (unten rechts, Symbol und Temperatur) und
  **Nächster Termin** (unter der Uhr, mit dem Avatar der Person, der er gehört) sind standardmäßig an.
- **Offene Aufgaben** ist standardmäßig aus. Eingeschaltet erscheint jede Person, die heute noch
  etwas offen hat, mit ihrem Avatar und den Symbolen dieser Aufgaben (bis zu vier, dann „+n“). So
  sehen auch Kinder auf einen Blick, was noch fehlt. Extras und optionale Routinenschritte zählen
  nicht. Die Einblendungen lassen sich nicht antippen: Ein Tipp führt weiterhin nur zu „Heute“.
- **Jedes Foto zeigen für**: 15 oder 30 Sekunden, 1, 2 oder 5 Minuten (Standard 1 Minute, eher
  ruhig als hektisch).
- Wetter und Termine erscheinen erst, wenn ein Ort bzw. ein Kalender eingerichtet ist.

**Nachtmodus**

Auf derselben Karte sorgt der **Nachtmodus** dafür, dass nachts keine Fotos laufen. Er ist
standardmäßig aus.

- **Von** und **Bis** legen das Zeitfenster in der Zeitzone der Familie fest; es darf über
  Mitternacht gehen (Standard 22:00 bis 06:00). Sind beide Zeiten gleich, greift der Nachtmodus nie.
- **Schwarz**: Der Bildschirm bleibt ganz dunkel. **Gedimmte Uhr**: eine große, dunkelgraue Uhr auf
  Schwarz. Sie wandert alle 5 Minuten ein Stück, damit sie sich nicht einbrennt.
- Nachts gibt es keine Einblendungen, und es werden keine Fotos geladen. Am Morgen laufen die Fotos
  von selbst weiter.
- Ein Tipp führt weiterhin zu „Heute“. Auf Geräten mit **Start nach Leerlauf** kommt der
  Nachtbildschirm nach der Leerlaufzeit zurück; auf Geräten ohne erscheint er nur, wenn der
  Bilderrahmen gestartet wird.

Ein Browser kann die Hintergrundbeleuchtung nicht abschalten: Auch „Schwarz“ leuchtet noch leicht.
Um das Display wirklich auszuschalten, braucht es einen Befehl auf dem Rechner am Display, z. B.
per cron:

```cron
# Wayland (z. B. aktuelles Raspberry Pi OS): um 22:00 aus, um 06:00 an
0 22 * * * WAYLAND_DISPLAY=wayland-1 XDG_RUNTIME_DIR=/run/user/1000 wlr-randr --output HDMI-A-1 --off
0 6  * * * WAYLAND_DISPLAY=wayland-1 XDG_RUNTIME_DIR=/run/user/1000 wlr-randr --output HDMI-A-1 --on

# X11
0 22 * * * DISPLAY=:0 xset dpms force off
0 6  * * * DISPLAY=:0 xset dpms force on
```

Welcher Befehl funktioniert, hängt vom Gerät und vom Desktop ab; `wlr-randr` ohne Argumente zeigt
die Namen der Ausgänge. Auf älterem Raspberry Pi OS ohne KMS-Treiber geht auch
`vcgencmd display_power 0`/`1`.

## Konfiguration

Die Konfiguration erfolgt ausschließlich über Umgebungsvariablen in `.env`. Alle Variablen sind in
[`.env.example`](.env.example) beschrieben.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `POSTGRES_USER` | `famquest` | Datenbank-Benutzer |
| `POSTGRES_PASSWORD` | – (Pflicht) | Datenbank-Passwort |
| `POSTGRES_DB` | `famquest` | Name der Datenbank |
| `APP_PORT` | `8080` | Port auf dem Host |
| `LOG_LEVEL` | `info` | `critical`, `error`, `warning`, `info`, `debug` (zur Fehlersuche) |
| `FORWARDED_ALLOW_IPS` | `127.0.0.1` | Vertrauenswürdige Reverse Proxies |
| `PROXY_NETWORK` | `proxy` | Docker-Netzwerk eures Reverse Proxys (siehe unten) |
| `GOOGLE_CLIENT_ID` | – | OAuth-Client für den [Google Kalender](#google-kalender) |
| `GOOGLE_CLIENT_SECRET` | – | Clientschlüssel dazu |
| `TOKEN_ENCRYPTION_KEY` | – | Verschlüsselt die Google-Tokens in der Datenbank |
| `PUBLIC_URL` | – | Öffentliche Adresse, z. B. `https://familie.example.com`; legt die Google-Weiterleitungs-URI hinter einem Reverse Proxy fest |
| `CALENDAR_SYNC_MINUTES` | `5` | Minuten zwischen zwei Kalender-Synchronisationen im Hintergrund; `0` = aus |

Daten liegen in zwei Docker-Volumes: `db-data` (PostgreSQL) und `uploads` (hochgeladene Bilder).
Wie ihr sie sichert, steht unter [Backup und Restore](#backup-und-restore).

## Backup und Restore

Zu sichern sind die **Datenbank** und die **hochgeladenen Bilder**. Beides geht im laufenden
Betrieb, im Projektordner (dort, wo `docker-compose.yml` liegt):

```sh
mkdir -p backup
# Datenbank (PostgreSQL-Dump im Custom-Format)
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' \
  > backup/famquest-$(date +%F).dump
# Bilder
docker compose exec -T app tar czf - -C /data uploads > backup/uploads-$(date +%F).tar.gz
```

Legt die Dateien zusätzlich außerhalb des Rechners ab (NAS, externe Platte). Die `.env` gehört
ebenfalls dazu, sie liegt aber nicht im Repository.

**Wiederherstellen**, z. B. auf einem neuen Rechner nach `git clone` und `cp .env.example .env`
(mit denselben `POSTGRES_*`-Werten):

```sh
docker compose up -d db
# Datenbank einspielen (vorhandene Tabellen werden ersetzt)
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  < backup/famquest-2026-10-03.dump
# Bilder einspielen
docker compose run --rm -T --no-deps --entrypoint tar app xzf - -C /data \
  < backup/uploads-2026-10-03.tar.gz
docker compose up -d
```

Beim Start bringt die App die Datenbank per Migration auf den neuesten Stand. Ein Backup einer
älteren Version lässt sich also in eine neuere einspielen, nicht umgekehrt.

Beides zusammen erledigt `scripts/backup.sh [ZIELORDNER] [TAGE]` (Standard: `backup/`, Backups
älter als 30 Tage werden gelöscht). Für ein nächtliches Backup per Cronjob:

```
0 3 * * * /pfad/zu/famquest/scripts/backup.sh /mnt/nas/famquest 30
```

Der Benutzer des Cronjobs braucht Zugriff auf Docker (Gruppe `docker`).

## Hinter einem Reverse Proxy

### Proxy als Container in einem Docker-Netzwerk (z. B. Nginx Proxy Manager)

Läuft euer Proxy als Container in einem eigenen Docker-Netzwerk (z. B. `proxy`), diese beiden
Zeilen in die `.env` schreiben:

```sh
COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml
PROXY_NETWORK=proxy
```

Danach `docker compose up -d`. Die App hängt dann in diesem Netzwerk und ist dort als
**`famquest`, Port `8000`** erreichbar. Auf dem Host wird kein Port mehr veröffentlicht, und
`FORWARDED_ALLOW_IPS` ist standardmäßig `*` (nur der Proxy erreicht die App). Im Nginx Proxy
Manager: neuer Proxy Host, Schema `http`, Forward Hostname `famquest`, Forward Port `8000`, dazu ein
SSL-Zertifikat. Nötig ist Docker Compose 2.24 oder neuer.

### Proxy auf dem Host oder einem anderen Rechner

Die App wertet `X-Forwarded-For` und `X-Forwarded-Proto` aus, aber nur von den Adressen in
`FORWARDED_ALLOW_IPS`. Das ist wichtig: Nur wenn die App erkennt, dass sie per HTTPS aufgerufen
wird, bekommt das Session-Cookie das `Secure`-Flag.

Empfohlene Einrichtung, wenn der Proxy auf demselben Host läuft:

```sh
# .env
APP_PORT=127.0.0.1:8080       # App nur für den lokalen Proxy erreichbar
FORWARDED_ALLOW_IPS=*         # vertretbar, weil niemand sonst direkt zugreifen kann
```

Läuft der Proxy auf einem anderen Rechner, dessen IP-Adresse in `FORWARDED_ALLOW_IPS` eintragen.
Hinweis: Durch das Docker-Port-Mapping sieht die App als Absender die Adresse des Docker-Netzwerks
(z. B. `172.18.0.1`), nicht `127.0.0.1`. Der Standardwert `127.0.0.1` gilt daher nur ohne Proxy.

Der Proxy muss den ursprünglichen `Host`-Header weitergeben (Caddy und Traefik tun das
automatisch, bei nginx `proxy_set_header Host $host;`). Setup und Login prüfen damit, dass die
Anfrage von der eigenen Seite kommt.

Fotos für den Bilderrahmen dürfen bis zu 25 MB groß sein. nginx erlaubt standardmäßig nur 1 MB pro
Anfrage; dort daher `client_max_body_size 30m;` setzen (im Nginx Proxy Manager unter „Advanced“).

Die App muss auf einer eigenen (Sub-)Domain laufen, z. B. `familie.example.com`. Ein Unterpfad wie
`example.com/familie` wird nicht unterstützt.

## Fehlersuche

**Anmeldung klappt nicht, obwohl das Passwort stimmen sollte.** Die App protokolliert, warum eine
Anmeldung abgelehnt wurde (`docker compose logs app`), z. B. `Anmeldung fehlgeschlagen: falsches
Passwort für Konto 1` oder `kein Konto mit dieser E-Mail`. Mit `LOG_LEVEL=debug` in der `.env`
(danach `docker compose up -d`) steht dort auch die eingegebene E-Mail-Adresse. Passwörter und PINs
werden nie protokolliert. Gibt ein Reverse Proxy den `Host`-Header nicht weiter, steht das ebenfalls
im Log.

**Google meldet `redirect_uri_mismatch` beim Verbinden.** Die Adresse, die FamQuest an Google
schickt, muss genau der **Autorisierten Weiterleitungs-URI** in der Google Cloud Console
entsprechen (Schema, Domain, Pfad). Der Elternbereich zeigt sie unter **Kalender → Einrichtung bei
Google**, außerdem steht sie im Log (`Weiterleitungs-URI: …`). Hinter einem Reverse Proxy beginnt
sie oft mit `http://` statt `https://`, weil die App den Headern des Proxys nicht vertraut
(`FORWARDED_ALLOW_IPS`, siehe [Hinter einem Reverse Proxy](#hinter-einem-reverse-proxy)). Am
einfachsten: in der `.env` `PUBLIC_URL` setzen, z. B. `PUBLIC_URL=https://familie.example.com`,
danach `docker compose up -d`.

**Passwort vergessen.** Einen Reset per E-Mail gibt es bewusst nicht; stattdessen auf dem Server:

```sh
docker compose exec app python -m app.cli users                             # Konten anzeigen
docker compose exec -it app python -m app.cli reset-password mama@example.org
```

Nach 5 Fehlversuchen ist die Anmeldung 15 Minuten gesperrt; ein Neustart der App
(`docker compose restart app`) hebt die Sperre sofort auf.

## Sprachen

Deutsch ist die Standardsprache. Ohne gespeicherte Auswahl richtet sich die App nach der
Browsersprache.

Übersetzungen liegen in `frontend/src/locales/<sprache>/<bereich>.json` (`common.json` für die
Oberfläche, `icons.json` für die Suchbegriffe der Symbole, `pool.json` für die Vorschläge von
Aufgaben und Belohnungen). So kommt eine neue Sprache hinzu:

1. Den Ordner `frontend/src/locales/de` kopieren, z. B. nach `frontend/src/locales/fr`
2. Alle Texte übersetzen
3. Den Sprachcode in `SUPPORTED_LANGUAGES` in `frontend/src/i18n.ts` ergänzen

Ein Test (`npm test`) prüft, dass jede Sprache genau dieselben Schlüssel hat und kein Text leer ist.
Fehler liefert die API als Codes (z. B. `common.not_found`), das Frontend übersetzt sie unter
`errors.*`.

## Entwicklung

Für die lokale Entwicklung laufen Backend und Frontend direkt auf dem Rechner, nur PostgreSQL läuft in
Docker. Voraussetzungen: [uv](https://docs.astral.sh/uv/), Node.js ≥ 24, Docker.

Einmalig:

```sh
cp .env.example .env
# In .env: POSTGRES_PASSWORD setzen und die Zeilen COMPOSE_FILE und DB_PORT einkommentieren
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
```

Starten (drei Terminals):

```sh
docker compose up -d db                              # PostgreSQL auf 127.0.0.1:5432
cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
cd frontend && npm run dev                           # http://localhost:5173
```

Vite leitet `/api` an das Backend auf Port 8000 weiter. Die API-Dokumentation steht unter
`http://localhost:8000/api/docs`.

Tests und Lint:

```sh
cd backend && uv run pytest                          # braucht die laufende Datenbank
cd backend && uv run ruff check . && uv run ruff format --check .
cd frontend && npm test && npm run lint && npm run typecheck
cd frontend && npm run format                      # Formatierung (Prettier)
docker compose --profile test run --rm --build tests # Backend-Tests im Container
```

End-to-End-Tests der Familienansicht (Playwright, Chromium):

```sh
cd frontend && npx playwright install chromium       # einmalig
cd frontend && npm run e2e                           # braucht die laufende Datenbank
```

`npm run e2e` baut das Frontend, legt eine frische Datenbank `<POSTGRES_DB>_e2e` an und startet die
App auf Port 8001. Getestet werden die Hauptabläufe im Browser: Setup, Kind und Aufgaben anlegen,
abhaken und zurücknehmen, die Personenansicht am Smartphone, Punkte, Belohnungen, Kontrolle durch
die Eltern und flexible Aufgaben.

Die Backend-Tests legen eine eigene Datenbank `<POSTGRES_DB>_test` an und setzen sie bei jedem Lauf
neu auf.

Migrationen:

```sh
cd backend
uv run alembic revision --autogenerate -m "beschreibung"   # neue Migration aus den Modellen
uv run alembic upgrade head                                 # anwenden
```

Ein Test schlägt fehl, wenn Modelle geändert wurden, ohne eine Migration anzulegen.

## Architektur

```
Browser ──► Reverse Proxy (optional) ──► app (FastAPI, Port 8000) ──► db (PostgreSQL 16)
                                           ├─ /api/*   JSON-API
                                           ├─ /*       gebautes React-Frontend
                                           ├─ /data/uploads (Volume)
                                           ├─ Kalender-Sync im Hintergrund ──► Google Calendar API
                                           └─ Wetter bei Bedarf (zwischengespeichert) ──► Open-Meteo
```

| Ordner | Inhalt |
| --- | --- |
| `backend/` | FastAPI, SQLAlchemy 2, Alembic, pytest; Pakete mit uv |
| `frontend/` | React, Vite, TypeScript, Tailwind CSS, react-i18next, TanStack Query, Vitest, Playwright |
| `docs/` | Spezifikation, Checkliste für den Display-Test, Projektseiten (GitHub Pages aus `main` → `/docs`) |
| `scripts/` | Backup-Skript |

Das `Dockerfile` baut zuerst das Frontend und kopiert es dann in das Python-Image. Es entsteht ein
einziges App-Image, das als unprivilegierter Benutzer läuft.

## Roadmap

Aktueller Stand: **0.x Alpha**. Die Versionen nach 1.0 sind ein erster Plan und können sich noch
ändern.

**1.0: Aufgabensystem (Phase 1).** Alles unter [Features](#features). Abgeschlossen; was der
Display-Test ([Checkliste](docs/DISPLAY-TEST.md)) nicht abdeckt, wird jetzt im Alltag erprobt.

- [x] 1. Grundgerüst: Backend, Frontend mit i18n, Docker, Alembic, Healthchecks
- [x] 2. First-Run-Setup, Login/Logout, Sperre der Registrierung, Eltern-PIN
- [x] 3. Familienmitglieder mit Farbe und Profilbild
- [x] 4. Aufgaben und Routinen im Elternbereich
- [x] 5. Familienansicht
- [x] 6. Punkte und Tagesfortschritt
- [x] 7. Belohnungen, Aufgaben-Vorlagen, Kontrolle durch die Eltern, faire Verteilung
- [x] 8. Feinschliff: flexible Aufgaben und „Einer für alle“, Backup/Restore,
  Familien-Einstellungen, Anmeldung abgesichert, Korrekturen aus dem Display-Test (kompakter,
  Reihenfolge der Personen, Anzeigegröße je Gerät). Alles Weitere muss sich erst in der Praxis
  zeigen.

**Google Kalender (Phase 2):** fertig.

- [x] 1. Google-Konto verbinden (OAuth, Tokens verschlüsselt, automatisch erneuert)
- [x] 2. Kalender auswählen und Personen oder „Familie“ zuordnen (mit eigener Farbe)
- [x] 3. Synchronisation im Hintergrund (inkrementell), Serien- und ganztägige Termine,
  Fehlerbehandlung
- [x] 4. Kalenderansicht: Woche mit Terminen in Personenfarbe und Avataren
- [x] 5. Feinschliff: Termindetails per Tipp, ganztägige Termine im gleichen Stil, Feiertage und
  Schulferien je Bundesland, `PUBLIC_URL` für die Google-Weiterleitungs-URI

**In Arbeit: Tages-Dashboard „Heute“ (Phase 3)**

- [x] 1. Aufgaben bekommen einen eigenen Bereich: Die Familienansicht zieht nach „Aufgaben“ (Stern),
  „Heute“ bekommt das Haus
- [x] 2. Wetter: Ort im Elternbereich festlegen, Vorhersage von Open-Meteo
- [x] 3. Startseite „Heute“: Uhr, Wetter, die nächsten 5 Termine, Aufgaben aller als antippbare
  Symbole, Platz für Essen und Einkauf
- [x] 4. Wochenansicht im Aufgabenbereich (was kommt noch, was ist erledigt); Routinen in fester
  Reihenfolge je Person und freiwillige Extra-Aufgaben
- [x] 5. Startseite konfigurierbar: Zahnrad auf „Heute“ (mit Eltern-PIN), Kacheln ein/aus und
  Reihenfolge, gilt für die ganze Familie; Wochen-Widget als optionale Kachel
- [x] 6. Routinenverwaltung: eigener Abschnitt „Routinen“ im Elternbereich, je Kind morgens,
  nachmittags und abends als Blöcke in fester Reihenfolge; geht später im Abschnitt „Aufgaben“ auf
- [x] 7. Elternbereich mit Menü: sieben Bereiche, am Tablet Leiste links, am Handy unten mit
  „Mehr“
- [x] 8. Routinen als eigene Blöcke: je Kind, Tagesabschnitt und Wochentagen (z. B. abgespeckter
  Abend am Wochenende), nummerierte und optionale Schritte, auf ein anderes Kind kopieren
- [ ] 9. Feinschliff am echten Display; alltagsnahe Aufgaben-Vorlagen und Belohnungs-Vorschläge
  (erledigt); das Wochen-Widget der Startseite bleibt vorerst, wie es ist (noch offen, ob es gebraucht
  wird)

**Als Nächstes: Bilderrahmen (Phase 4)**

Das Display wird im Leerlauf zum digitalen Bilderrahmen.

- [x] 1. Fotos verwalten: im Elternbereich mehrere Fotos auf einmal hochladen (am Handy aus der
  Galerie), verkleinert und ohne Metadaten gespeichert, ein- und ausblenden, löschen
- [x] 2. Bilderrahmen: Vollbild mit Überblendung, zufällige Reihenfolge ohne Wiederholung,
  Hochformat mit unscharfem Hintergrund; Start per Symbol in der Navigationsleiste oder nach
  Leerlauf (je Gerät einstellbar), ein Tipp führt zurück zu „Heute“
- [x] 3. Einblendungen: Uhr und Datum, Wetter, nächster Termin, offene Aufgaben, jeweils ein- und
  ausschaltbar; Anzeigedauer je Foto (gilt für die Familie)
- [x] 4. Nachtmodus: Zeitfenster, dunkler Bildschirm oder gedimmte Uhr
- [ ] 5. Feinschliff am echten Display

**1.1: Anpassen**

- Vorlagen bearbeiten: Familien können Aufgaben-Vorlagen und Belohnungs-Vorschläge ändern,
  ergänzen und entfernen (in der Datenbank statt im Code); überarbeitete Beispiel-Vorlagen
- Vorschläge nach Alter: Aufgaben-Vorlagen und Belohnungs-Vorschläge passend zum Alter der Kinder
  (z. B. Geburtsjahr je Kind; bei mehreren Kindern je Kind passende Vorschläge)
- Teenager-Stil: weniger kindliche Darstellung je Person für ältere Kinder
- Icon-Picker: „Beliebt“ nach tatsächlicher Nutzung; beliebte Icons auch in ihrer Kategorie
- Mehr als sieben Personen (mehr Farben)
- About-Seite: Autor, Lizenz, Version und Prüfung auf Updates

**1.2: Unterwegs**

- Installierbare Web-App (PWA) fürs Smartphone der Eltern: Aufgaben prüfen, Punkte buchen und
  Aufgaben anlegen von unterwegs
- Erwachsene legen Aufgaben schnell direkt in der Familienansicht an, ohne Elternbereich

**Später (Phasen 5–6 der Spezifikation)**

| Phase | Inhalt |
| --- | --- |
| 5 | Essensplanung |
| 6 | Einkaufslisten |

**Ideen ohne Version**

- Termine in FamQuest anlegen und bearbeiten (braucht Schreibzugriff auf den Google Kalender statt nur lesend)
- Weitere Kalender: iCal-/ICS-Links und andere Anbieter (z. B. iCloud, Outlook, Nextcloud)
- Bilderrahmen: Fotos aus Immich (oder Nextcloud) statt nur hochgeladener Fotos, Alben
- Urlaubsmodus: Routinen für eine Zeit pausieren (z. B. im Urlaub) oder auf eine abgespeckte Version
  umschalten

- Mehrere Familien auf einer Installation: z. B. legt der erste Admin (oder eine versteckte
  Funktion) befreundete Familien an und berechtigt sich darauf. Aktuell bedient FamQuest bewusst
  genau eine Familie pro Installation.

## Lizenz

Copyright © 2026 Craebby

FamQuest ist freie Software unter der [GNU Affero General Public License](LICENSE), Version 3 oder
(nach eurer Wahl) jeder späteren Version. Kurz gesagt: Ihr dürft FamQuest frei nutzen, verändern und
weitergeben, auch kommerziell. Wer eine veränderte Version weitergibt oder für andere über das Netz
betreibt, muss deren Quellcode unter derselben Lizenz veröffentlichen.

FamQuest wird ohne jede Gewährleistung bereitgestellt; Details stehen im Lizenztext (englisch). Die
mitgelieferten [Fluent-Emoji](https://github.com/microsoft/fluentui-emoji)-Symbole sind © Microsoft,
MIT-Lizenz.
