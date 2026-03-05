# WorkHub (work-app)
Info(#): Kurzbeschreibung + Start + Struktur

WorkHub ist eine kleine Local-First Web-App (HTML/CSS/JS), die Aufträge + Sägestücke verwaltet und 3 Sägen mit Vorgängen, Timer, Auto-Zählung und Material-Unterbrechungen abbildet.
Zusätzlich gibt es ein Werkstoff-Handbuch (data/materials.json), aus dem du Werkstoffe direkt in Aufträge übernehmen kannst.

## Start
- Empfohlen: VS Code → Extension „Live Server“ → `index.html` öffnen.
- Hinweis: Wenn du `index.html` als `file://` öffnest, können `fetch()`-Aufrufe (Pages/Seeds/Handbuch-DB) blockiert werden.

## Navigation
- #/auftraege
- #/saegen
- #/handbuch

## Daten
- App-State: localStorage `workhub_state_v1`
- Seeds:
  - `data/orders.seed.json`
  - `data/materials.seed.json`
- Handbuch-DB (unverändert übernommen):
  - `data/materials.json`
