# Standortmanager – Projektstatus

Stand: 2026-08-17. Diese Datei fasst den bisherigen Fortschritt zusammen, damit
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
  server.js       Express-App: liefert die statischen Dateien UND die REST-API
  package.json    Abhängigkeiten: express, mysql2, dotenv
  .env            Echte DB-Zugangsdaten (NICHT committed, in .gitignore)
  .env.example    Vorlage für .env
```

## Design / Layout

- Top-Navigation: Titel "Standortmanager" + Breadcrumb links, Logo rechts
- Linke Sidebar: ein-/ausklappbar (Chevron-Button), 6 Menüpunkte in dieser
  Reihenfolge: **Dashboard, Anwesenheiten, Teilnehmende, Maßnahmen, Gruppen,
  Fachbereiche**
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

- Keine Benutzer-Authentifizierung/Login – die App ist komplett offen.
- Keine serverseitige Bestätigungsprüfung beim Löschen (Client prüft den
  eingegebenen Namen, Server löscht rein anhand der ID).
- Kein automatisiertes Test-Setup.

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

1. Ggf. Authentifizierung ergänzen, bevor die App außerhalb von localhost
   erreichbar gemacht wird.
