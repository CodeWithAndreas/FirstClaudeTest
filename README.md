# Standortmanager

Webanwendung (HTML/CSS/JS, kein Build-Tooling) mit Express-Backend für den
Zugriff auf eine MySQL-Datenbank (`db_fct`). Login/Benutzerverwaltung mit
Rollen ist eingebaut (siehe unten).

## Struktur

```
index.html      Einstiegspunkt der Seite
css/style.css   Styles
js/main.js      Client-Logik (Routing, CRUD, Login)
assets/         Bilder und weitere statische Dateien
server/         Express-API + Datenbankzugriff
```

## Setup auf einem neuen PC

**Voraussetzungen:** [Node.js](https://nodejs.org/) (LTS-Version) und ein
erreichbarer MySQL-Server.

### 1. Repository holen

```
git clone https://github.com/CodeWithAndreas/FirstClaudeTest.git
cd FirstClaudeTest
```

### 2. Datenbank anlegen

Eine leere Datenbank `db_fct` in MySQL anlegen und das Grundschema
einspielen:

```
mysql -h 127.0.0.1 -u root -p -e "CREATE DATABASE IF NOT EXISTS db_fct"
mysql -h 127.0.0.1 -u root -p db_fct < server/schema.sql
```

`server/schema.sql` legt die fachlichen Tabellen an (Fachbereiche, Gruppen,
Maßnahmen, Teilnehmende, Anwesenheiten) und befüllt die Anwesenheits-Status
(Anwesend, Krank, …). Die Tabellen für Benutzer/Rollen/Berechtigungen
müssen **nicht** manuell angelegt werden – die erstellt der Server beim
ersten Start automatisch selbst (siehe Schritt 4).

Falls bereits eine bestehende `db_fct`-Datenbank von einem anderen Rechner
übernommen werden soll (z. B. per `mysqldump`), kann Schritt 2 übersprungen
werden – dann reicht es, diesen Dump stattdessen einzuspielen.

### 3. Server konfigurieren

```
cd server
copy .env.example .env      # unter Linux/Mac: cp .env.example .env
npm install
```

In der neu erstellten `server/.env` die Zugangsdaten eintragen
(`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`) sowie einen
eigenen, zufälligen Wert für `SESSION_SECRET` setzen (wird für die
Login-Sitzungen gebraucht).

### 4. Server starten

```
npm start
```

Beim allerersten Start werden automatisch die Tabellen für die
Benutzerverwaltung angelegt und ein Administrator-Konto eingerichtet:

```
Username: admin
Passwort: Admin2026!
```

Die Anwendung läuft danach unter `http://localhost:3000` (liefert Frontend
und API zusammen aus). Direkt per `file://index.html` öffnen funktioniert
nicht, da die Seiten ihre Daten per API laden.

### 5. Einloggen und Passwort ändern

Im Browser `http://localhost:3000` öffnen, mit `admin` / `Admin2026!`
einloggen und das Passwort **sofort** über das Schlüssel-Icon oben rechts
ändern. Danach über die Seite „Benutzer" (nur für Administrator sichtbar)
weitere Konten mit passenden Rollen anlegen.

## Mehr Details

Für die vollständige Feature- und Architektur-Dokumentation (Datenmodell,
Rollen/Berechtigungen, Performance-Hinweise etc.) siehe
[`PROJECT_STATUS.md`](PROJECT_STATUS.md).
