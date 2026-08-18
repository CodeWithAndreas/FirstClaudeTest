# Standortmanager – Projektstatus

Stand: 2026-08-18. Diese Datei fasst den bisherigen Fortschritt zusammen, damit
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
js/vendor/        Vendorte Drittanbieter-Libs als reine Static Files (kein npm/
                  Build-Schritt fürs Frontend): jspdf.umd.min.js (2.5.2) +
                  jspdf.plugin.autotable.min.js (3.8.4) für den PDF-Bericht
                  auf der Anwesenheiten-Seite. Per <script>-Tag vor main.js
                  eingebunden, daher hängt sich das Plugin an window.jspdf.jsPDF.
server/
  server.js       Express-App: liefert die statischen Dateien UND die REST-API,
                  inkl. Session-Auth, Rollen-/Fachbereichs-Scoping und
                  idempotentem DB-Bootstrap (Tabellen + Rollen-Seed + Admin-Seed)
  package.json    Abhängigkeiten: express, mysql2, dotenv, bcryptjs, express-session
  .env            Echte DB-Zugangsdaten + SESSION_SECRET (NICHT committed, in .gitignore)
  .env.example    Vorlage für .env
```

## Design / Layout

- Top-Navigation: Titel "Standortmanager" + Breadcrumb links, rechts
  Username + Icon "Passwort ändern" + Icon "Abmelden" + Logo
- Linke Sidebar: ein-/ausklappbar (Chevron-Button), 7 Menüpunkte in dieser
  Reihenfolge: **Dashboard, Anwesenheiten, Teilnehmende, Maßnahmen, Gruppen,
  Fachbereiche, Benutzer** – die letzten beiden Punkte sind nur für die Rolle
  Administrator sichtbar (`applyRolePermissions()` in `js/main.js`)
- Routing client-seitig über `location.hash` (`#teilnehmende`, `#massnahmen`, …),
  keine echten Unterseiten/Reloads. Startseite (kein/unbekannter Hash) ist
  `dashboard` (`defaultPage` in `js/main.js`).
- Dashboard-Seite zeigt vier Stat-Karten (Anzahl Teilnehmende, Maßnahmen,
  Gruppen, Fachbereiche), Zahlen werden bei jedem Aufruf der Seite frisch aus
  den bestehenden GET-Endpunkten geladen (`loadDashboardStats()` in
  `js/main.js`, kein eigener API-Endpunkt nötig).
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
| `anwesenheitsstatus` | ID, Bezeichnung, Kurzzeichen                                                        | – |
| `anwesenheit` | ID, TeilnehmerID, Datum, StatusID                                                         | TeilnehmerID → teilnehmer.ID (ON DELETE CASCADE), StatusID → anwesenheitsstatus.ID; UNIQUE(TeilnehmerID, Datum) |
| `benutzer`    | ID, Username (UNIQUE), PasswortHash, Vorname, Nachname, Email, Telefon, ErstelltAm         | – |
| `rolle`       | ID, Bezeichnung (UNIQUE)                                                                   | – |
| `benutzer_rolle` | BenutzerID, RolleID (Composite-PK)                                                       | BenutzerID → benutzer.ID (ON DELETE CASCADE), RolleID → rolle.ID (ON DELETE CASCADE) |
| `benutzer_fachbereich` | BenutzerID, FachbereichID (Composite-PK)                                           | BenutzerID → benutzer.ID (ON DELETE CASCADE), FachbereichID → fachbereich.ID (ON DELETE CASCADE) |

Die vier `benutzer*`-Tabellen existieren in keiner separaten `.sql`-Datei,
sondern werden von `bootstrapDatabase()` in `server/server.js` bei jedem
Serverstart per `CREATE TABLE IF NOT EXISTS` idempotent sichergestellt
(kein Migrationstool im Projekt). Dieselbe Funktion seedet `rolle` mit den
5 festen Rollen (`INSERT IGNORE`) und legt bei leerer `benutzer`-Tabelle
einmalig das Admin-Konto an (Username `admin`, Startpasswort `Admin2026!`,
Rolle Administrator – Konsolenmeldung nur beim erstmaligen Anlegen).

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

Abweichung vom Muster bei **Teilnehmende**: Das Maßnahme-Dropdown im
Neuanlage-Formular sowie im Bearbeiten-Dialog zeigt Bezeichnung und VT durch
ein Leerzeichen getrennt (z. B. "Fachinformatiker FR Systemintegration 540"),
umgesetzt über `loadMassnahmeOptionsInto(selectElement, { includeVt: true })`
(optionaler zweiter Parameter, Default `false` = nur Bezeichnung, u. a. für
den Anwesenheiten-Filter verwendet). Die Maßnahme-Spalte in der
Teilnehmende-Tabelle zeigt denselben "Bezeichnung VT"-Text.

API-Routen (alle in `server/server.js`, alle unter `/api/...`):

- `fachbereiche`: GET, POST, PUT `:id`, DELETE `:id`
- `gruppen`: GET, POST, PUT `:id`, DELETE `:id`
- `massnahmen`: GET, POST, PUT `:id`, DELETE `:id`
- `teilnehmer`: GET, POST, PUT `:id`, DELETE `:id` (GET liefert zusätzlich VT,
  GruppeID/-Bezeichnung und FachbereichID/-Bezeichnung der verknüpften
  Maßnahme/Gruppe für die Anwesenheiten-Filter)
- `anwesenheitsstatus`: GET (Kurzzeichen-Liste für die Dropdowns)
- `anwesenheiten`: GET `?monat=YYYY-MM`, PUT (Upsert pro Teilnehmer+Datum;
  `StatusID: null` löscht den Eintrag wieder)
- `login` (POST), `logout` (POST), `me` (GET), `me/passwort` (PUT),
  `rollen` (GET, statische Liste), `benutzer` (GET/POST/PUT/DELETE,
  admin-only)

Alle Routen außer `POST /api/login` verlangen eine aktive Session
(`requireAuth`-Middleware, `app.use("/api", requireAuth)` direkt nach
`login`/`logout`); `fachbereiche` (POST/PUT/DELETE) und alle `benutzer`-Routen
verlangen zusätzlich die Rolle Administrator (`requireRole("Administrator")`).
`gruppen`, `massnahmen`, `teilnehmer` und `anwesenheiten` sind für Nutzer mit
ausschließlich den Rollen Ausbilder/Fachbereichsleiter serverseitig auf deren
zugewiesene Fachbereiche gefiltert (`isRestrictedUser()`/`fachbereichInScope()`
in `server.js`) – sowohl beim Lesen (`WHERE ... IN (?)` bzw. Join-Filter) als
auch beim Schreiben (POST/PUT/DELETE prüfen den Fachbereich des Ziel- **und**
bei PUT auch des Ausgangsdatensatzes, sonst 403). `GET /api/fachbereiche`
bleibt für alle Rollen erreichbar (wird für Dropdowns/Filter auf anderen
Seiten gebraucht), liefert eingeschränkten Nutzern aber nur ihre eigenen
Fachbereiche.

### Login, Rollen und Benutzerverwaltung

Die App verlangt seit dieser Session ein Login für die komplette Anwendung
(kein anonymer Zugriff mehr). Beim Laden prüft `checkSession()` in
`js/main.js` per `GET /api/me`, ob eine Session existiert; ohne Session zeigt
`body.logged-out` (CSS) ausschließlich `#loginScreen`, mit Session wird die
App-Shell eingeblendet und `initializeApp()` bündelt sämtliche zuvor über die
Datei verstreuten initialen `loadX()`-Aufrufe (vorher an Modul-Ebene direkt
bei den jeweiligen Formular-Definitionen, jetzt erst nach erfolgreichem
Login/Session-Check). Ein einmalig installierter `window.fetch`-Wrapper am
Dateianfang schaltet bei jedem `401` (außer beim initialen `/api/me`-Check)
automatisch zurück auf den Login-Screen, ohne dass die ~30 bestehenden
`fetch()`-Aufrufe im Code angepasst werden mussten.

Fünf feste Rollen (Tabelle `rolle`, keine eigene Verwaltungs-UI, nur
Zuweisung über die Benutzer-Seite): Ausbilder, Fachbereichsleiter,
Lehrgangsorganisation, Administrator, Bildungsstättenleiter. Ein Benutzer
kann mehrere Rollen und mehrere Fachbereiche haben. Hat ein Benutzer
mindestens eine der Rollen Administrator/Lehrgangsorganisation/
Bildungsstättenleiter, sieht und bearbeitet er alle Fachbereiche
uneingeschränkt; hat er ausschließlich Ausbilder und/oder
Fachbereichsleiter, ist er auf seine zugewiesenen Fachbereiche beschränkt
(`isRestrictedUser()` in `server.js`). Rollen/Fachbereiche eines Nutzers
werden beim Login einmalig geladen und in der Session gecacht – ändert der
Admin sie während einer aktiven Sitzung, wirkt sich das erst beim nächsten
Login der betroffenen Person aus (bewusster Trade-off gegen DB-Abfragen bei
jedem Request).

Die neue **Benutzer-Seite** (nur für Administrator sichtbar, Sidebar +
`showPage()`-Guard blocken sie sonst auch bei direktem Hash-Aufruf) folgt
1:1 dem Fachbereiche-CRUD-Muster (Tabelle, einklappbares Neuanlage-Formular,
Bearbeiten-`<dialog>`, geteilter Lösch-Dialog über `openDeleteDialog`).
Rollen und Fachbereiche werden je als Checkbox-Gruppe dargestellt
(`.checkbox-group`). Beim Bearbeiten bleibt das Passwortfeld leer; nur bei
Eingabe wird das Passwort geändert, sonst bleibt es unverändert (Contract:
leer = unverändert). Ein Admin kann sich nicht selbst löschen (400).

**Passwort ändern**: Icon in der Kopfzeile öffnet `#changePasswordDialog`
(aktuelles Passwort, neues Passwort, Wiederholung); serverseitige Prüfung
des aktuellen Passworts gegen den eigenen Hash über `PUT /api/me/passwort`,
Mindestlänge 8 Zeichen. **Abmelden**: Icon daneben ruft `POST /api/logout`
und lädt die Seite neu (setzt zuverlässig allen clientseitigen Zustand
zurück, z. B. `awGruppen`/`awMassnahmen`-Caches der Anwesenheiten-Seite).

Passwort-Hashing über `bcryptjs` (reines JS, keine native Kompilierung nötig
unter Windows), Sessions über `express-session` mit In-Memory-Store und
httpOnly-Cookie (`SESSION_SECRET` in `.env`) – bei Serverneustart müssen sich
alle Nutzer neu einloggen, für dieses interne Tool akzeptiert.

### Anwesenheiten-Seite

Kalenderansicht: links Teilnehmer (Vorname, Nachname, VT, Gruppe – die
Gruppen-Spalte zeigt hier bewusst die `Kennung`, nicht die `Bezeichnung`) als
sticky-Spalten, rechts ein Tabellenfeld pro Tag des gewählten Monats mit
`<select>` (Kurzzeichen aus `anwesenheitsstatus`). Änderung im Dropdown
speichert sofort per `PUT /api/anwesenheiten`. Monatsnavigation über
Prev/Next-Buttons. Filterleiste (Fachbereich/Gruppe/Maßnahmebezeichnung/VT/
Name, rein client-seitig auf dem bereits geladenen Teilnehmer-Array) +
Reset-Button, Filter sind beim Laden leer (zeigen alle Teilnehmenden).
Die ersten vier Filter sind kaskadierend: Gruppe zeigt nur Gruppen des
gewählten Fachbereichs, Maßnahmebezeichnung nur (distinct) Bezeichnungen
der Maßnahmen in der gewählten Gruppe/dem gewählten Fachbereich, VT nur
Werte der so eingegrenzten Maßnahmen. Dropdown-Optionen werden aus den beim
Laden gecachten Arrays `awGruppen`/`awMassnahmen` berechnet (keine
Nachlade-Requests bei Filteränderung); Auswahl einer übergeordneten Stufe
setzt nicht mehr passende untergeordnete Filter automatisch zurück. Umgesetzt
in `js/main.js` (Abschnitt "Anwesenheiten" am Dateiende,
`refreshAwGruppeOptions`/`refreshAwMassnahmeOptions`/`refreshAwVtOptions`).

Zusätzlich zu den manuellen Filtern blendet `awMatchesFilter()` Teilnehmende
grundsätzlich aus, deren Gültigkeitszeitraum (`Startdatum`/`Endedatum` aus
`teilnehmer`) den gewählten Monat nicht überschneidet – liegt der Monat
komplett vor `Startdatum` oder komplett nach `Endedatum`, wird die Zeile nicht
angezeigt (Vergleich per ISO-Datumsstrings, da lexikografisch sortierbar).
Da diese Prüfung vom Monat abhängt, wirkt sie automatisch bei jedem
Monatswechsel neu (über den ohnehin bei `changeAwMonth()` ausgelösten
`buildAwTableRows()` → `applyAwFilters()`-Ablauf), ohne eigene Verdrahtung.

**Performance:** Bei größeren Teilnehmerzahlen (z. B. 148 Teilnehmende × 31
Tage = ~4.600 `<select>`-Elemente) darf die Tabelle NICHT bei jeder
Filteränderung/Tastatureingabe neu aufgebaut werden. Deshalb sind Aufbau und
Filterung getrennt: `buildAwTableRows()` erzeugt alle Zeilen für den
kompletten `awTeilnehmer`-Bestand einmalig (bei Monatswechsel/Initial-Load,
da sich die Tagesspalten ändern) und merkt sie sich in `awRowEntries`;
`applyAwFilters()` schaltet bei Filteränderungen (inkl. Namensfeld bei jedem
Tastendruck) nur noch `row.style.display` um, ohne DOM neu zu erzeugen. Ein
per CDP gemessener Vorher/Nachher-Vergleich: Filteränderung vorher = voller
Tabellen-Rebuild, nachher ~1ms ohne Rebuild.

**Performance Teil 2 (globale Navigation):** Die ~4.600 Selects (+ bis zu
7 Options je Select = ~36.000 Zusatzknoten) machten das gesamte Dokument so
groß, dass jeder Klick irgendwo in der App spürbar langsamer wurde (Chrome
muss bei Fokus-/Layout-Berechnungen den kompletten Dokumentbaum
berücksichtigen, auch `display:none`-Teilbäume) – gemessen per CDP:
Seitenwechsel zwischen den anderen Menüpunkten dauerte davor 55–160ms statt
3–14ms, Wechsel zur Anwesenheiten-Seite selbst bis zu 590ms. Behoben durch:

1. **Lazy Init**: `initAnwesenheiten()`/`ensureAwInitialized()` laufen erst
   beim ersten Aufruf von `#anwesenheiten` (Hook in `showPage()`), nicht mehr
   unconditional beim App-Start. Der initiale `handleRouteChange()`-Aufruf
   wurde deshalb ans Dateiende verschoben (sonst TDZ-Fehler, da er sofort bei
   Hash `#anwesenheiten` synchron auf noch nicht deklarierte `const`s der
   Anwesenheiten-Sektion zugreifen würde).
2. **Lazy Options je Zelle**: Beim Zeilenaufbau bekommt jedes `<select>`
   zunächst nur die leere Option plus (falls vorhanden) die aktuell
   gespeicherte Status-Option; die übrigen Status-Optionen werden erst bei
   `mousedown`/`focus` der jeweiligen Zelle nachgeladen
   (`ensureAwSelectOptions` in `js/main.js`).

Ergebnis (CDP-gemessen): Dokumentgröße vor erstem Anwesenheiten-Besuch
4.881 statt 47.082 Elemente, Seitenwechsel 3–14ms statt 55–160ms; nach einem
Besuch bleibt die Anwesenheiten-Tabelle wie gewünscht im DOM (fürs schnelle
Filtern), Dokumentgröße dann 19.564 statt 47.082 Elemente.

Unter der Tabelle zwei Buttons (Abschnitt "PDF-Bericht" in `js/main.js`,
nutzt jsPDF + jspdf-autotable aus `js/vendor/`), beide mit eigenem
Bestätigungsdialog:

- **"PDF-Bericht erstellen"** (`pdfConfirmDialog`): eine Querformat-PDF-Seite
  (A4) mit Kopfzeile aus den aktuell gewählten Filterkriterien
  (Fachbereich/Gruppe/Maßnahmebezeichnung/VT/Name, jeweils "alle" falls leer)
  + Monat/Jahr, gefolgt von derselben Tabelle wie auf dem Bildschirm
  (gefiltert, Tagesspalten für den angezeigten Monat).
- **"PDF-Bericht je VT erstellen"** (`pdfVtConfirmDialog`,
  `generateAwPdfReportByVt`): identischer Aufbau, aber die gefilterten
  Teilnehmenden werden nach VT gruppiert und je VT-Wert auf eine eigene Seite
  gesetzt; die VT-Zeile der Kopfzeile zeigt auf jeder Seite den jeweils
  spezifischen VT-Wert statt "alle". Die Seitenerzeugung selbst
  (`drawAwReportPage`) ist zwischen beiden Berichten geteilt.

Der Dateiname setzt sich aus den aktiven Filterkriterien + Monat + Jahr
zusammen (nicht gesetzte Filter tragen nicht zum Dateinamen bei), z. B.
`Anwesenheiten_Informatik_August_2026.pdf`; der Je-VT-Bericht hängt zusätzlich
`_je-VT` an.

Die Spaltenköpfe Nachname, VT und Gruppe sind klickbar (`.sortable-col` in
`index.html`, `data-sort-key` = Feldname auf `person`-Objekt); ein Klick
sortiert `awRowEntries` auf- (erster Klick) bzw. absteigend (zweiter Klick auf
dieselbe Spalte) per `localeCompare(..., "de", { numeric: true })` und hängt
die Zeilen-DOM-Knoten in der neuen Reihenfolge per `appendChild` wieder ein
(kein Neuaufbau der Zellen, wichtig für die Performance bei vielen
Teilnehmenden). Ein Pfeil-Indikator (`.sort-indicator`, CSS-Klassen
`sort-asc`/`sort-desc`) zeigt Spalte und Richtung. Die aktive Sortierung
(`awSortKey`/`awSortDirection`) bleibt über Monatswechsel hinweg erhalten, da
`applyAwSort()` am Ende von `buildAwTableRows()` erneut aufgerufen wird.

## Noch offen / nicht begonnen

- Keine serverseitige Bestätigungsprüfung beim Löschen (Client prüft den
  eingegebenen Namen, Server löscht rein anhand der ID).
- Kein automatisiertes Test-Setup.
- Rollen-/Fachbereichs-Änderungen an einem Benutzer wirken erst nach dessen
  nächstem Login (Session-Cache, siehe oben) – kein Mechanismus, um aktive
  Sessions bei Rechteänderung sofort zu invalidieren.
- Sessions sind In-Memory (express-session Default) – bei Serverneustart
  müssen sich alle Nutzer neu einloggen; für produktiven Mehr-Instanzen-Betrieb
  wäre ein externer Session-Store (z. B. MySQL/Redis) nötig.
- Keine "Passwort vergessen"-Funktion – ein vergessenes Passwort kann aktuell
  nur ein Administrator über die Benutzer-Seite zurücksetzen.

## Lokale Entwicklungsumgebung – wichtige Hinweise

- Node.js war auf diesem Rechner ursprünglich **nicht** installiert und wurde
  per `winget install --id OpenJS.NodeJS.LTS` nachinstalliert (jetzt: Node 24
  LTS). PHP/Python sind weiterhin nicht nutzbar.
- Weder Git Bash noch neu gestartete PowerShell-Sitzungen sehen das
  PATH-Update von winget zuverlässig; `node`/`npm` ggf. über den vollen Pfad
  `C:\Program Files\nodejs\node.exe` (bzw. `npm.cmd`) aufrufen oder vorher
  `export PATH="/c/Program Files/nodejs:$PATH"` (Bash) /
  `$env:PATH = "C:\Program Files\nodejs;$env:PATH"` (PowerShell) setzen.
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

1. Vor produktivem Einsatz außerhalb von localhost: `SESSION_SECRET` in der
   echten `.env` auf einen starken, zufälligen Wert setzen (ist bereits
   vorbereitet, siehe `.env.example`) und das Admin-Startpasswort
   `Admin2026!` sofort nach dem ersten Login ändern.
