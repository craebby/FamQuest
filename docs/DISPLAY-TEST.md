# Test am echten Display

Checkliste für den Praxistest auf dem Touchscreen am Kühlschrank (Hauptziel: Querformat
1920 × 1080). Am besten mit der ganzen Familie durchgehen und Auffälliges direkt notieren.

## Einrichtung des Displays

- [ ] Browser im Kiosk-Modus, z. B. Chromium:
      `chromium --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 http://<server>:8080`
- [ ] Einmal anmelden; die Session bleibt ein Jahr bestehen und verlängert sich bei Nutzung
- [ ] Bildschirmschoner und Energiesparen so einstellen, dass das Display tagsüber an bleibt
- [ ] Browser-Zoom auf 100 %, Systemsprache bzw. Familiensprache stimmt
- [ ] Uhrzeit und Zeitzone des Geräts stimmen (wichtig ist aber die Zeitzone der Familie in der App)

## Alltag: Kinder (Test: kann ein Kind, das nicht lesen kann, es allein?)

- [ ] Findet das Kind seine Spalte über Avatar und Farbe?
- [ ] Erkennt es seine Aufgaben am Symbol, ohne den Text zu lesen?
- [ ] Ein Tipp erledigt, ein zweiter nimmt zurück: versteht es den Haken und das „+2 ⭐“?
- [ ] Sanduhr bei „Eltern prüfen“: versteht es, dass Mama/Papa noch schauen?
- [ ] Geschenk → eigener Avatar → Belohnung → ✓: schafft es das allein?
- [ ] „Noch 8 Punkte nötig“: versteht es den Balken, auch ohne die Zahl zu lesen?
- [ ] Sind alle Touchflächen groß genug, auch für kleine Finger und schnelle Tipps?
- [ ] Doppel-Tipps und Wischen lösen nichts Ungewolltes aus

## Alltag: Erwachsene (Test: ohne Erklärung zurechtkommen?)

- [ ] Eigene Aufgaben finden und abhaken, „Einer für alle“ bei gemeinsamen Aufgaben
- [ ] Flexible Aufgaben: fällig, überfällig (roter Hinweis) und „Demnächst“ sind verständlich
- [ ] Anteil der Woche („40 % diese Woche“) ist verständlich und fühlt sich nicht nach Wettbewerb an
- [ ] Zahl am Zahnrad → PIN → „Zu prüfen“ → „Passt“/„Nochmal“
- [ ] Neue Aufgabe aus einer Vorlage anlegen, Belohnungen für ein Kind aus den Vorschlägen wählen
- [ ] Wochenübersicht: ist auf einen Blick klar, wie die Woche lief?

## Darstellung

- [ ] Alle Spalten passen nebeneinander; bei vielen Personen lässt sich seitlich wischen
- [ ] Schrift aus 1–2 m Entfernung lesbar, Symbole gut erkennbar
- [ ] Farben der Personen gut unterscheidbar, auch bei Tageslicht und abends
- [ ] Keine Animation stört auf Dauer; mit reduzierter Bewegung (Systemeinstellung) ohne Animation
- [ ] Hochformat und Smartphone funktionieren (Avatar-Leiste oben, Navigation unten)

## Robustheit

- [ ] Nach Mitternacht erscheinen die Aufgaben des neuen Tages (spätestens nach einer Minute)
- [ ] Personenansicht und Elternbereich kehren nach Inaktivität zur Familienansicht zurück
- [ ] WLAN kurz trennen: verständliche Meldung, danach läuft alles weiter
- [ ] Server neu starten (`docker compose restart app`): Display erholt sich ohne Neuanmeldung
- [ ] Deutsch und Englisch umschalten (Familiensprache): keine unübersetzten Texte

## Notizen

| Was | Wer/Wann | Idee |
| --- | --- | --- |
|  |  |  |
