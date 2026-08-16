# FirstClaudeTest

Webseite (HTML/CSS/JS, kein Build-Tooling) mit einem kleinen Express-Backend
für den Zugriff auf die MySQL-Datenbank `db_fct`.

## Struktur

```
index.html      Einstiegspunkt der Seite
css/style.css   Styles
js/main.js      Skripte
assets/         Bilder und weitere statische Dateien
server/         Express-API (liest/schreibt Fachbereiche in MySQL)
```

## Lokal ausführen

Voraussetzung: Node.js sowie eine erreichbare MySQL-Datenbank `db_fct`.

```
cd server
copy .env.example .env    # Zugangsdaten in .env eintragen
npm install
npm start
```

Der Server liefert die statische Seite und die API zusammen unter
`http://localhost:3000` aus. Die Seite direkt per `file://` zu öffnen
funktioniert für die Fachbereiche-Seite nicht mehr, da diese Daten über
die API lädt.

## API

- `GET /api/fachbereiche` – Liste aller Fachbereiche
- `POST /api/fachbereiche` – Neuen Fachbereich anlegen
  (`BezeichnungLang`, `BezeichnungKurz`, optional `Kennung`)
