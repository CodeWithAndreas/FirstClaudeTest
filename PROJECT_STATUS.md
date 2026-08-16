# Standortmanager – Projektstatus

Stand: 2026-08-16. Diese Datei fasst den bisherigen Fortschritt zusammen, damit
eine neue Session nahtlos anschließen kann.

## Überblick

Webanwendung "Standortmanager" für ein Bildungsträger-/BFW-artiges Setting:
statisches Frontend (HTML/CSS/JS, kein Build-Tooling) + Express-Backend, das
gegen eine MySQL-Datenbank (`db_fct`) spricht.

- GitHub: `https://github.com/CodeWithAndreas/FirstClaudeTest`
- Lokaler Pfad: `c:\Users\Andreas\source\github\FirstClaudeTest`

## Struktur

```
index.html       Einziges HTML-Dokument, enthält alle Seiten als <section class="page">
css/style.css     Design (an bfw.de angelehnt: Primärblau #00adee, Navy #003a4d,
                  Akzentorange #ff7800, Font "Istok Web", stark abgerundete Ecken)
js/main.js        Gesamte Client-Logik: Routing, Sidebar, CRUD pro Entität
server/
  server.js       Express-App: liefert die statischen Dateien UND die REST-API
  package.json    Abhängigkeiten: express, mysql2, dotenv
  .env            Echte DB-Zugangsdaten (NICHT committed, in .gitignore)
  .env.example    Vorlage für .env
```

## Design / Layout

- Top-Navigation: Titel "Standortmanager" + Breadcrumb links, Logo rechts
- Linke Sidebar: ein-/ausklappbar (Chevron-Button), 5 Menüpunkte in dieser
  Reihenfolge: **Teilnehmende, Anwesenheiten, Maßnahmen, Gruppen, Fachbereiche**
- Routing client-seitig über `location.hash` (`#teilnehmende`, `#massnahmen`, …),
  keine echten Unterseiten/Reloads
- Tabellen stecken in `.table-scroll` (horizontal scrollbar), Content-Bereich
  `max-width: 1680px`
- Alle Datumsfelder werden in Tabellen als `TT.MM.JJJJ` angezeigt
  (`formatDateDE()` in main.js); die `<input type="date">`-Felder in Formularen
  bleiben technisch bedingt im ISO-Format YYYY-MM-DD

## Datenbank (MySQL, Datenbank `db_fct`)

Verbindung: Host `127.0.0.1`, Port `3306`, User `root`, SSL aktiviert
(Zugangsdaten liegen in `server/.env`, nicht im Repo).

| Tabelle       | Spalten                                                                                   | FKs |
|---------------|--------------------------------------------------------------------------------------------|-----|
| `fachbereich` | ID, BezeichnungLang, BezeichnungKurz, Kennung                                              | – |
| `gruppe`      | ID, Bezeichnung, Kennung, FachbereichID                                                    | FachbereichID → fachbereich.ID |
| `massnahme`   | ID, Bezeichnung, VT, GruppeID, ZertDatum, PlanStart, PlanEnde                               | GruppeID → gruppe.ID |
| `teilnehmer`  | ID, Vorname, Nachname, Geburtsdatum, MassnahmeID, Startdatum, Endedatum, Email, Telefon     | MassnahmeID → massnahme.ID (NOT NULL) |

Es existiert noch **keine** Tabelle/Anbindung für "Anwesenheiten" – die Seite
ist bisher nur ein Platzhalter (siehe unten).

## Fertiggestellte Features (pro Seite gleiches Muster)

Für **Fachbereiche, Gruppen, Maßnahmen, Teilnehmende** ist jeweils identisch
umgesetzt:

1. Tabelle lädt Daten per `fetch` von der jeweiligen API (`GET /api/<entität>`),
   inkl. LEFT JOIN auf die referenzierte Elterntabelle für die Anzeige
   (z. B. Gruppen-Tabelle zeigt den Fachbereichs-Namen).
2. Formular zum Neuanlegen ist als natives `<details>`-Element eingeklappt,
   per Klick ausklappbar. Enthält bei Bedarf ein `<select>` für die
   Fremdschlüssel-Auswahl mit leerer Standardoption (vor dem Absenden
   zurücksetzbar).
3. Nach erfolgreichem Speichern (`POST`) wird das Formular geleert und die
   Tabelle neu geladen.
4. Löschen pro Zeile über einen generischen Bestätigungsdialog
   (`openDeleteDialog({name, endpoint, reload})` in main.js): Nutzer muss die
   Bezeichnung/den Namen exakt eintippen, erst dann wird `DELETE` ausgeführt.
5. Bearbeiten pro Zeile über einen vorausgefüllten `<dialog>` mit "Speichern"/
   "Abbrechen"; Bestätigung = Klick auf "Speichern", danach `PUT` + Tabelle
   neu laden.
6. Alle Dialoge sind über `.confirm-dialog` mit `position: fixed; inset: 0;
   margin: auto;` sauber mittig zentriert (Fix, weil das globale
   `* { margin: 0 }`-Reset das Browser-Default sonst überschreibt).

API-Routen (alle in `server/server.js`, alle unter `/api/...`):

- `fachbereiche`: GET, POST, PUT `:id`, DELETE `:id`
- `gruppen`: GET, POST, PUT `:id`, DELETE `:id`
- `massnahmen`: GET, POST, PUT `:id`, DELETE `:id`
- `teilnehmer`: GET, POST, PUT `:id`, DELETE `:id`

## Noch offen / nicht begonnen

- **Anwesenheiten-Seite**: nur Platzhaltertext, keine Datenbankanbindung,
  keine Tabelle in `db_fct` dafür bekannt/angelegt.
- Keine Benutzer-Authentifizierung/Login – die App ist komplett offen.
- Keine serverseitige Bestätigungsprüfung beim Löschen (Client prüft den
  eingegebenen Namen, Server löscht rein anhand der ID).
- Kein automatisiertes Test-Setup.

## Lokale Entwicklungsumgebung – wichtige Hinweise

- Node.js war auf diesem Rechner ursprünglich **nicht** installiert und wurde
  per `winget install --id OpenJS.NodeJS.LTS` nachinstalliert (jetzt: Node 24
  LTS). PHP/Python sind weiterhin nicht nutzbar.
- Git Bash sieht das PATH-Update von winget nicht automatisch; in Bash-Befehlen
  ggf. `export PATH="/c/Program Files/nodejs:$PATH"` voranstellen.
- MySQL Shell (`mysqlsh`) liegt unter
  `C:\Program Files\MySQL\MySQL Shell 8.0\bin\mysqlsh.exe` und wurde für
  Schema-Inspektion/manuelle Prüfungen benutzt, z. B.:
  `mysqlsh --uri="root:<PASSWORT>@127.0.0.1:3306/db_fct" --sql -e "SHOW TABLES;"`
- Server starten:
  ```
  cd server
  npm install   # nur beim ersten Mal / nach Dependency-Änderungen
  npm start
  ```
  Läuft dann unter `http://localhost:3000` (liefert Frontend UND API aus).
  Die Seite direkt per `file://index.html` zu öffnen funktioniert für die
  datengetriebenen Seiten NICHT mehr (fetch-Aufrufe brauchen den Server).

## Empfohlene nächste Schritte

1. Anwesenheiten-Seite nach demselben Muster umsetzen, sobald klar ist,
   welche Tabelle/Spalten dafür in `db_fct` verwendet werden sollen
   (ggf. erst Tabelle per `ALTER`/`CREATE TABLE` anlegen, wie bei
   `Geburtsdatum` bereits vorgemacht).
2. Ggf. Authentifizierung ergänzen, bevor die App außerhalb von localhost
   erreichbar gemacht wird.
