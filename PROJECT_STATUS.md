# Standortmanager – Projektstatus

Stand: 2026-08-22. Diese Datei fasst den bisherigen Fortschritt zusammen, damit
eine neue Session nahtlos anschließen kann.

**Wichtig für eine neue Session:** Neue **Dokumentenverwaltung pro
Teilnehmendem**: neues Datei-Icon in der Teilnehmenden-Tabelle (inkl.
Anzahl-Badge in derselben Farblogik wie das bestehende
Aktivitäten-Badge) öffnet eine Master-Detail-Unterseite "Dateiablage"
(Upload-Dialog mit Titel/Schlagworten/Dokumentart/Vertraulich/Pflicht-
Löschdatum, Bearbeiten-Dialog für Metadaten, Löschen **ausschließlich
für Administrator**). Dateien liegen auf der Festplatte, Speicherpfad
in neuer admin-only **Einstellungen**-Seite konfigurierbar (Default:
`server/uploads/`). Details siehe Unterabschnitt "Dokumentenverwaltung
pro Teilnehmendem" weiter unten.

**Sicherheits-Fix als Teil derselben Änderung (wichtig für zukünftige
Static-Serving-Änderungen):** `express.static` lieferte bis dahin das
**komplette Repo-Root** aus (inkl. `server/server.js`, `schema.sql`,
`package.json` im Klartext über HTTP). Jetzt eingeschränkt auf explizit
`index.html`, `css/`, `js/`, `assets/` – siehe Unterabschnitt
"Dokumentenverwaltung pro Teilnehmendem" für Details und den
Verifikationsweg. Bitte bei künftigen neuen statischen Assets diese
Allowlist erweitern, nicht wieder auf einen pauschalen Root-Mount
zurückfallen.

**Frühere Sessions** (Details jeweils im passenden Unterabschnitt weiter
unten): Sidebar-Umbau "Stammdaten" (Maßnahmen/Gruppen/Fachbereiche als
Unterpunkte + eigene Card-Übersichtsseite) · Rolle Auditor mit
aufklappbarem "Audit"-Bereich (9 Platzhalterseiten) · Wiedervorlage-
Nachrichtenliste auf dem Dashboard · rollenabhängig differenzierte
Löschrechte für Teilnehmende/Maßnahmen/Gruppen.

**Historische Randnotiz zu den Löschrechten (bewusst dokumentiert als
Warnung für zukünftige Änderungen an dieser Stelle):** In einer
früheren Session wurde ein ganz ähnliches Feature bereits einmal
eingebaut, dabei aber zusätzlich die FK `fk_Massnahme_Gruppe1` auf
`ON DELETE SET NULL` umgestellt, damit eine Gruppe trotz zugeordneter
Maßnahmen löschbar blieb. Das führte zu mehreren Folgefehlern (stale
Dropdown-/Filter-Caches auf mehreren Seiten, siehe Git-Historie) und
wurde damals auf ausdrücklichen Wunsch vollständig zurückgebaut. Bei
der jetzigen (zweiten, erfolgreichen) Umsetzung wurde die FK bewusst
**nicht** angetastet (bleibt `RESTRICT`) – genau das war die
Fehlerursache beim ersten Versuch. Eine Gruppe mit noch zugeordneten
Maßnahmen lässt sich also weiterhin grundsätzlich nicht löschen; für
Fachbereichsleiter wird das zusätzlich vorab per eigener
`COUNT`-Abfrage geprüft, um statt eines generischen FK-Fehlers eine
klare 400-Fehlermeldung zu liefern. **Lehre für künftige Änderungen an
diesem Feature:** Die FK auf `SET NULL` umzustellen (oder Maßnahmen
beim Gruppen-Löschen zu "verwaisen") nicht erneut versuchen, ohne die
damaligen Folgefehler zu berücksichtigen. Unverändert bleibt, dass eine
Maßnahme beim Anlegen/Bearbeiten bewusst *ohne* Gruppe gespeichert
werden kann (Dropdown-Option „– keine Gruppe –“) – das ist ein
eigenständiges, gewolltes Formularverhalten.

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
  schema.sql      Grundschema (fachbereich/gruppe/massnahme/teilnehmer/
                  anwesenheit(sstatus)/aktivitaet) zum Einspielen auf einer
                  neuen/leeren MySQL-Instanz, siehe README.md "Setup auf einem
                  neuen PC". Die benutzer*-Tabellen sind bewusst NICHT
                  enthalten, die legt server.js selbst an.
  package.json    Abhängigkeiten: express, mysql2, dotenv, bcryptjs, express-session, multer
  uploads/        Default-Speicherort für hochgeladene Dokumente (konfigurierbar
                  über die Einstellungen-Seite), NICHT im Git (siehe .gitignore),
                  NICHT öffentlich per HTTP erreichbar (siehe Sicherheits-Fix
                  im Abschnitt "Dokumentenverwaltung pro Teilnehmendem")
  .env            Echte DB-Zugangsdaten + SESSION_SECRET (NICHT committed, in .gitignore)
  .env.example    Vorlage für .env
```

## Design / Layout

- Top-Navigation: Titel "Standortmanager" + Breadcrumb links, rechts
  Username + Icon "Passwort ändern" + Icon "Abmelden" + Logo
- Linke Sidebar: ein-/ausklappbar (Chevron-Button), Menüpunkte in dieser
  Reihenfolge: **Dashboard, Anwesenheiten, Teilnehmende, Stammdaten
  (aufklappbar: Maßnahmen, Gruppen, Fachbereiche), Audit (aufklappbar,
  9 Unterpunkte), Benutzer, Einstellungen** – Fachbereiche (nur als
  Unterpunkt von Stammdaten), Benutzer und Einstellungen sind nur für die
  Rolle Administrator sichtbar, Audit nur für Auditor/Administrator,
  Stammdaten und die drei Punkte davor sind für Auditor-only-Nutzer
  komplett ausgeblendet (`applyRolePermissions()` in `js/main.js`, siehe
  Unterabschnitte "Stammdaten-Übersicht", "Audit-Bereich (Rolle Auditor)"
  und "Dokumentenverwaltung pro Teilnehmendem" weiter unten)
- Routing client-seitig über `location.hash` (`#teilnehmende`, `#massnahmen`, …),
  keine echten Unterseiten/Reloads. Startseite (kein/unbekannter Hash) ist
  `dashboard` (`defaultPage` in `js/main.js`).
- Dashboard-Seite zeigt vier Stat-Karten (Anzahl Teilnehmende, Maßnahmen,
  Gruppen, Fachbereiche), Zahlen werden bei jedem Aufruf der Seite frisch aus
  den bestehenden GET-Endpunkten geladen (`loadDashboardStats()` in
  `js/main.js`, kein eigener API-Endpunkt nötig). Darunter ein
  zweispaltiger Bereich (`.master-detail.dashboard-messages` in
  `index.html`/`css/style.css`): links die Wiedervorlagen-Liste (siehe
  eigener Unterabschnitt weiter unten), rechts ein Platzhalter-Panel
  "Nachrichten" für künftige weitere Nachrichtentypen.
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
| `aktivitaet`  | ID, TeilnehmerID, Art, Thema, Bearbeiter, BearbeiterID, Bemerkung, Wiedervorlage, WiedervorlageErledigt, ErstelltAm | TeilnehmerID → teilnehmer.ID (ON DELETE CASCADE); BearbeiterID **ohne** FK (siehe unten) |
| `dokument`    | ID, TeilnehmerID, Titel, Schlagworte, Dokumentart, Vertraulich, Loeschdatum, Dateiname, GespeicherterDateiname, Dateigroesse, MimeType, HochgeladenAm | TeilnehmerID → teilnehmer.ID (ON DELETE CASCADE) |
| `benutzer`    | ID, Username (UNIQUE), PasswortHash, Vorname, Nachname, Email, Telefon, Aktiv, ErstelltAm  | – |
| `rolle`       | ID, Bezeichnung (UNIQUE)                                                                   | – |
| `benutzer_rolle` | BenutzerID, RolleID (Composite-PK)                                                       | BenutzerID → benutzer.ID (ON DELETE CASCADE), RolleID → rolle.ID (ON DELETE CASCADE) |
| `benutzer_fachbereich` | BenutzerID, FachbereichID (Composite-PK)                                           | BenutzerID → benutzer.ID (ON DELETE CASCADE), FachbereichID → fachbereich.ID (ON DELETE CASCADE) |
| `einstellung` | Schluessel (PK), Wert                                                                     | – (App-Infrastruktur, Key-Value-Store, siehe unten) |

Die vier `benutzer*`-Tabellen existieren in keiner separaten `.sql`-Datei,
sondern werden von `bootstrapDatabase()` in `server/server.js` bei jedem
Serverstart per `CREATE TABLE IF NOT EXISTS` idempotent sichergestellt
(kein Migrationstool im Projekt). Dieselbe Funktion seedet `rolle` mit den
6 festen Rollen (`INSERT IGNORE`) und legt bei leerer `benutzer`-Tabelle
einmalig das Admin-Konto an (Username `admin`, Startpasswort `Admin2026!`,
Rolle Administrator – Konsolenmeldung nur beim erstmaligen Anlegen). Für
nachträglich ergänzte Spalten auf Bestandstabellen (`benutzer.Aktiv`, sowie
`aktivitaet.BearbeiterID` und `aktivitaet.WiedervorlageErledigt`) prüft
`bootstrapDatabase()` jeweils per `INFORMATION_SCHEMA.COLUMNS`, ob die
Spalte schon existiert, und holt sie sonst per `ALTER TABLE` nach – damit
funktioniert sowohl eine frische als auch eine bereits bestehende Tabelle
ohne manuellen Eingriff. Wichtiger Unterschied bei `aktivitaet` (und seit
dieser Session `dokument`): Diese Tabellen existieren (anders als
`benutzer`) bereits vor dem ersten Serverstart, da sie Teil des
`schema.sql`-Grundschemas sind – neue Spalten (bei `aktivitaet`) bzw. die
komplette neue Tabelle (`dokument`, `CREATE TABLE IF NOT EXISTS` **sowohl**
in `schema.sql` **als auch** in `bootstrapDatabase()`) sind deshalb an
beiden Stellen ergänzt: einmal für Neuinstallationen (`schema.sql`) und
einmal, damit die bereits laufende Datenbank dieser Session sie automatisch
beim nächsten Serverstart bekommt, ohne manuellen SQL-Schritt
(`bootstrapDatabase()`). `aktivitaet.BearbeiterID` hat dabei bewusst
**keine FK-Constraint** auf `benutzer(ID)`, weil `benutzer` zum Zeitpunkt
des `schema.sql`-Einspielens (vor dem allerersten Serverstart) noch gar
nicht existiert; `dokument` hat dieses Problem nicht (referenziert nur
`teilnehmer`, das an beiden Stellen bereits existiert), daher dort
`ON DELETE CASCADE` ganz regulär. `einstellung` ist reine
App-Infrastruktur wie `benutzer`/`rolle` und existiert **nur** in
`bootstrapDatabase()` (nicht in `schema.sql`), mit geseedeten
Default-Werten (`loeschfrist_offset_jahre` = `3`, `dokumentenpfad` = leer).

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

Die Teilnehmende-Seite hat zusätzlich dieselbe Filterleiste wie die
Anwesenheiten-Seite (Fachbereich/Gruppe/Maßnahmebezeichnung/VT/Name +
Reset-Button, kaskadierend: Gruppe nur Gruppen des gewählten Fachbereichs,
Maßnahmebezeichnung/VT entsprechend weiter eingegrenzt). Umgesetzt als
1:1-Kopie des Anwesenheiten-Filtermusters unter eigenem `tn`-Präfix
(`tnFachbereichFilter`/`tnGruppeFilter`/... , `refreshTnGruppeOptions`/
`refreshTnMassnahmeOptions`/`refreshTnVtOptions`, `tnMatchesFilter`,
`applyTnFilters` in `js/main.js`): `loadTeilnehmer()` baut wie
`buildAwTableRows()` alle Zeilen einmalig und merkt sie sich in
`tnRowEntries`; Filteränderungen schalten nur noch `row.style.display` um,
ohne die Tabelle neu aufzubauen. Eigene `tnGruppen`/`tnMassnahmen`-Arrays
(via `loadTnGruppen()`/`loadTnMassnahmen()`) treiben die Kaskade, das
Fachbereich-Dropdown nutzt den bereits vorhandenen generischen Helper
`loadFachbereichOptionsInto()`.

Jede Zeile der Teilnehmenden-Tabelle hat zusätzlich vor dem
Bearbeiten-Icon ein Uhr-Icon (`.row-history-btn`), das zu einer
**Aktivitätenverlauf-Unterseite** führt (`openTeilnehmerAktivitaeten(person)`
in `js/main.js`). Diese Unterseite (`#page-teilnehmende-aktivitaeten`) ist
kein eigener Sidebar-Punkt, sondern wird als "Unterfenster" von
Teilnehmende behandelt: eigener Hash `#teilnehmende-aktivitaeten` (löst
`hashchange` aus, landet also auch in der Browser-Chronik), aber die
Sidebar markiert weiterhin "Teilnehmende" als aktiv und die Breadcrumb
zeigt "Start / Teilnehmende / Aktivitätenverlauf" (Sonderfälle in
`showPage()`). Welcher Teilnehmer gerade angezeigt wird, steht nur im
JS-Zustand (`currentAktivitaetTeilnehmerId`/`currentAktivitaetTeilnehmer`,
aus dem bereits geladenen `tnRowEntries`-Cache übernommen, keine
Zusatzabfrage) – ein direkter Aufruf des Hashes ohne vorherige Auswahl
(z. B. Neuladen der Seite) leitet automatisch zurück zu `#teilnehmende`.

Oben auf der Unterseite: "Zurück zu Teilnehmende"-Button und Name/VT des
Teilnehmenden. Darunter ein **Master-Detail-Layout** (`.master-detail` in
`css/style.css`): links eine schmale, scrollbare Liste (`.aktivitaet-list`)
mit einem Eintrag je Aktivität (Zeitstempel + Art, neueste zuerst – Sortierung
kommt bereits so vom Server) und einem "+ Neue Aktivität"-Button darüber;
rechts ein Detail-Panel, das genau einen von drei Zuständen zeigt
(`showAktivitaetPlaceholder()`/`showAktivitaetDetail()`/`showAktivitaetForm()`
in `js/main.js`, gesteuert über das `hidden`-Attribut, nie mehr als einer
gleichzeitig sichtbar):
1. **Platzhalter** (Default nach dem Laden/Wechsel des Teilnehmenden): Hinweistext.
2. **Detail-Ansicht** (nach Klick auf einen Listeneintrag): reine Anzeige
   von Art, Zeitstempel, Bemerkung und Wiedervorlage der gewählten
   Aktivität; der angeklickte Listeneintrag bekommt `.active`
   (blau hervorgehoben).
3. **Formular** (nach Klick auf "+ Neue Aktivität"): Art-Dropdown
   (Gesprächsprotokoll/Aktennotiz/Kontaktversuch – Liste erstmal fest im
   HTML, keine eigene Verwaltungs-UI/-Tabelle dafür), Info-Block
   (Teilnehmer/VT/aktueller Zeitstempel, wird bei jedem Öffnen neu
   gesetzt), Bemerkungsfeld (`<textarea>`), Wiedervorlage-Datum sowie
   Speichern- und Zurück-Button (Zurück verwirft nur und schaltet auf den
   Platzhalter zurück, ohne zu speichern).

Nach erfolgreichem Speichern wird die Liste neu geladen und die soeben
angelegte Aktivität automatisch in der Detail-Ansicht ausgewählt – so sieht
man sofort das Ergebnis, ohne den neuen Eintrag manuell in der Liste
suchen zu müssen. Erstmal gibt es bewusst kein Bearbeiten/Löschen
einzelner Aktivitäten (nicht gefordert).

Jede Aktivität hat zusätzlich ein **Thema** (Freitext, max. 60 Zeichen,
`<input maxlength="60">` im Formular sowie serverseitige Längenprüfung
in `POST /api/aktivitaeten`) und einen **Bearbeiter**. Der Bearbeiter wird
nicht im Formular abgefragt, sondern serverseitig automatisch aus der
Session gesetzt (`` `${req.session.vorname} ${req.session.nachname}` ``
in `server.js`, dieselben Felder, die auch der Login in der Session
ablegt) – der Client kann ihn also nicht manipulieren. Im
Master-Detail-Layout wird das Thema in der Listenzeile (`.aktivitaet-
list-thema`) sowie in der Detail-Ansicht angezeigt; der Bearbeiter wird
in der Detail-Ansicht mit vollem Vor- und Nachnamen angezeigt, in der
Listenzeile dagegen platzsparend nur als rundes Kürzel-Badge mit den
Initialen (`aktivitaetBearbeiterInitialen()` in `js/main.js`, erster
Buchstabe von Vor- und Nachname). Der volle Name steht als
`title`-Attribut auf dem Badge und erscheint damit als natives
Browser-Tooltip beim Hovern.

Das Uhr-Icon in der Teilnehmenden-Tabelle trägt zusätzlich ein Badge mit der
Anzahl der Aktivitäten des jeweiligen Teilnehmenden (`.history-btn-wrap` +
`.aktivitaet-badge` in `index.html`/`css/style.css`, `updateAktivitaetBadge()`
in `js/main.js`). Kein Badge, wenn 0 Aktivitäten vorhanden sind; blau
(`.badge-aktuell`), wenn mindestens eine Aktivität jünger als 14 Tage ist,
sonst grün (Default-Badgefarbe = "nichts Aktuelles mehr"). Die Zahlen kommen aus `GET /api/aktivitaeten/summary`
(gruppiert nach `TeilnehmerID`, `HatAktuelle` per
`ErstelltAm >= NOW() - INTERVAL 14 DAY`, mit identischem
Fachbereichs-Scoping wie die übrigen `aktivitaeten`-Routen), einmalig
zusammen mit der Teilnehmerliste geladen (`loadTeilnehmer()`) und beim
Zurückkehren von der Aktivitätenverlauf-Unterseite leichtgewichtig
aktualisiert (`refreshTnAktivitaetBadges()`, per `showPage()`-Hook auf
`targetId === "teilnehmende"` ausgelöst – kein Tabellen-Neuaufbau, nur die
vorhandenen Badge-Elemente werden aktualisiert).

### Wiedervorlage-Nachrichtenliste auf dem Dashboard

Erster Baustein eines künftigen, allgemeineren Nachrichtensystems
("Jeder User bekommt eine Liste von Nachrichten, z. B. Aktivitäten von
Teilnehmenden, später weitere Nachrichtentypen") – bewusst nur für
diesen einen Nachrichtentyp gebaut, keine vorzeitige Abstraktion für
noch nicht existierende Typen (User-zu-User-Nachrichten,
Aufgabenzuweisung kommen laut Auftrag explizit erst später).

Jede Aktivität mit gesetztem `Wiedervorlage`-Datum landet in der
persönlichen Wiedervorlagen-Liste **ihres Erstellers** – Zuordnung über
die neue Spalte `aktivitaet.BearbeiterID` (zusätzlich zum bisherigen
`Bearbeiter`-Namensstring, der weiterhin nur zur Anzeige dient). Ältere,
vor dieser Session angelegte Aktivitäten haben `BearbeiterID = NULL` und
tauchen deshalb in niemandes Liste auf – akzeptierter Trade-off, kein
rückwirkendes Namens-Matching auf den Bearbeiter-String (wäre bei
Namensgleichheit/-änderung ohnehin unzuverlässig).

Auf dem Dashboard (`renderWiedervorlagenListe()`/
`loadDashboardWiedervorlagen()` in `js/main.js`) zeigt jeder
Listeneintrag Datum, Name/VT des Teilnehmenden und Thema/Art; Termine in
der Vergangenheit werden per `.overdue`-Klasse in der Akzentfarbe
hervorgehoben (`istWiedervorlageUeberfaellig()`, rein clientseitige
Zusatzoptik, keine explizite Anforderung). Klick auf den Eintrag springt
zur bestehenden Teilnehmenden-Aktivitätenverlauf-Unterseite und wählt
dort direkt die passende Aktivität im Detail-Panel aus – dafür wurde
`openTeilnehmerAktivitaeten(person, aktivitaetId)` um einen zweiten,
optionalen Parameter erweitert (Modul-Variable `pendingAktivitaetId`),
den `loadTeilnehmerAktivitaetenPage()` nach dem Laden der Liste einmalig
konsumiert und dann `showAktivitaetDetail()` statt des bisherigen
`showAktivitaetPlaceholder()` aufruft (analog zum bereits bestehenden
Muster nach dem Neuanlegen einer Aktivität). `showAktivitaetDetail()`
zeigt bei einer bereits erledigten Wiedervorlage zusätzlich
`"(erledigt)"` hinter dem Datum, damit der Status auch beim regulären
Ansehen im Aktivitätenverlauf sichtbar bleibt.

Zwei Aktionen pro Listeneintrag (Icons rechts, mit `event.stopPropagation()`
gegen versehentliches Auslösen der Sprung-Navigation):

- **Häkchen-Icon** (`markiereWiedervorlageErledigt()`): setzt
  `WiedervorlageErledigt = 1` sofort per `PUT
  /api/aktivitaeten/:id/erledigt`, **ohne** Bestätigungsdialog – bewusst
  niedrigschwellig wie eine Todo-Checkbox, da keine Daten verloren gehen
  (das Wiedervorlagedatum bleibt in der Aktivität erhalten, der Eintrag
  verschwindet nur aus der offenen Liste).
- **Kalender-Icon** (`openNeuerWiedervorlageterminDialog()`): öffnet
  `#wiedervorlageTerminDialog` (Vorbild: `resetBenutzerPasswortDialog`)
  mit einem vorbefüllten Datumsfeld; Speichern ruft `PUT
  /api/aktivitaeten/:id/wiedervorlage` auf. Das überschreibt **nur das
  Datumsfeld derselben Aktivität** (und setzt `WiedervorlageErledigt`
  zurück auf `false`) – es entsteht bewusst **kein** neuer Eintrag im
  Aktivitätenverlauf, das war eine explizite Vorgabe.

Beide Schreib-Endpunkte sind serverseitig über das normale
Fachbereichs-Scoping abgesichert (siehe oben), die Sichtbarkeit in der
Dashboard-Liste selbst hängt dagegen ausschließlich von `BearbeiterID`
ab, nicht vom Fachbereich – auch ein Administrator sieht dort nur seine
eigenen erstellten Wiedervorlagen, nicht alle im System.

Beim Testen der Umsetzung wurde ein CSS-Kaskaden-Bug gefunden und
behoben: Die wiederverwendete `.aktivitaet-list-item`-Klasse setzt
`flex-direction: column`, was in der neuen `.wiedervorlage-item`-Regel
(gleiche Selektor-Spezifität, aber im Stylesheet weiter oben notiert)
nicht automatisch überschrieben wurde – die Action-Icons landeten
dadurch unter statt neben dem Text. Gelöst über den spezifischeren
Selektor `.aktivitaet-list-item.wiedervorlage-item` statt
`.wiedervorlage-item` allein. **Lehre:** Bei neuen Modifier-Klassen auf
bestehende `.aktivitaet-list-item`-Elemente immer auf CSS-Spezifität vs.
Deklarationsreihenfolge achten, nicht auf "steht weiter unten im File"
verlassen.

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
- `aktivitaeten`: GET `?teilnehmerId=<id>` (neueste zuerst, inkl.
  `WiedervorlageErledigt`), POST (Pflichtfelder `TeilnehmerID`, `Art` aus
  `["Gesprächsprotokoll", "Aktennotiz", "Kontaktversuch"]`; optional
  `Thema`, max. 60 Zeichen, sonst 400; `Bearbeiter` **und** `BearbeiterID`
  werden ausschließlich serverseitig aus der Session gesetzt, ein evtl.
  mitgeschicktes `Bearbeiter`-Feld im Request-Body wird ignoriert; kein
  PUT/DELETE auf die Aktivität selbst, da erstmal nicht gefordert – siehe
  aber die beiden Wiedervorlage-Sub-Routen unten)
- `aktivitaeten/summary`: GET, liefert je Teilnehmer mit mindestens einer
  Aktivität `{TeilnehmerID, Anzahl, HatAktuelle}` für die Badges in der
  Teilnehmenden-Tabelle
- `aktivitaeten/wiedervorlagen`: GET, liefert die offenen Wiedervorlagen
  des eingeloggten Users (`BearbeiterID = req.session.userId`, kein
  Fachbereichs-Filter – siehe Unterabschnitt weiter unten)
- `aktivitaeten/:id/erledigt`: PUT (kein Body), markiert eine Wiedervorlage
  als erledigt
- `aktivitaeten/:id/wiedervorlage`: PUT, Body `{Wiedervorlage: "YYYY-MM-DD"}`,
  überschreibt das Datum in derselben Aktivität und setzt
  `WiedervorlageErledigt` zurück auf `false`
- `login` (POST), `logout` (POST), `me` (GET), `me/passwort` (PUT),
  `rollen` (GET, statische Liste), `benutzer` (GET/POST/PUT/DELETE,
  admin-only), `benutzer/:id/passwort` (PUT, admin-only, setzt nur
  `PasswortHash` ohne Prüfung des aktuellen Passworts, da hier ein
  Administrator das Passwort eines fremden Kontos zurücksetzt statt der
  Nutzer selbst wie bei `me/passwort`), `benutzer/:id/aktiv` (PUT,
  admin-only, Body `{Aktiv: boolean}`, 400 bei Versuch der
  Selbstdeaktivierung)

Alle Routen außer `POST /api/login` verlangen eine aktive Session
(`requireAuth`-Middleware, `app.use("/api", requireAuth)` direkt nach
`login`/`logout`); `fachbereiche` (POST/PUT/DELETE) und alle `benutzer`-Routen
verlangen zusätzlich die Rolle Administrator (`requireRole("Administrator")`).
`gruppen`, `massnahmen`, `teilnehmer`, `anwesenheiten`, `aktivitaeten` und
`aktivitaeten/summary` sind für Nutzer mit ausschließlich den Rollen
Ausbilder/Fachbereichsleiter serverseitig auf deren zugewiesene Fachbereiche gefiltert
(`isRestrictedUser()`/`fachbereichInScope()` in `server.js`) – sowohl beim
Lesen (`WHERE ... IN (?)` bzw. Join-Filter) als
auch beim Schreiben (POST/PUT/DELETE prüfen den Fachbereich des Ziel- **und**
bei PUT auch des Ausgangsdatensatzes, sonst 403). `GET /api/fachbereiche`
bleibt für alle Rollen erreichbar (wird für Dropdowns/Filter auf anderen
Seiten gebraucht), liefert eingeschränkten Nutzern aber nur ihre eigenen
Fachbereiche. Abweichend davon: `GET /api/aktivitaeten/wiedervorlagen`
filtert bewusst **nicht** nach Fachbereich, sondern ausschließlich nach
`BearbeiterID = req.session.userId` (siehe Unterabschnitt
"Wiedervorlage-Nachrichtenliste auf dem Dashboard"); die beiden
Schreib-Endpunkte `aktivitaeten/:id/erledigt` und
`aktivitaeten/:id/wiedervorlage` verwenden dagegen wieder das normale
Fachbereichs-Scoping wie alle anderen `aktivitaeten`-Schreibzugriffe,
**ohne** zusätzliche Beschränkung auf den Ersteller – jeder Nutzer mit
Fachbereichs-Zugriff auf den betroffenen Teilnehmenden darf eine fremde
Wiedervorlage erledigt markieren oder verschieben, auch wenn sie in
seiner eigenen Dashboard-Liste gar nicht auftaucht.

Alle eingeschränkten Nutzer (Ausbilder wie Fachbereichsleiter) haben
innerhalb ihrer zugewiesenen Fachbereiche identisches CRUD auf
`gruppen`, `massnahmen`, `teilnehmer`, `anwesenheiten` und
`aktivitaeten` – **mit Ausnahme des Löschens** von Gruppen/Maßnahmen/
Teilnehmenden, das seit dieser Session rollenabhängig differenziert ist
(siehe Unterabschnitt "Differenzierte Löschrechte" weiter unten).

### Differenzierte Löschrechte (Gruppen/Maßnahmen/Teilnehmende)

- `DELETE /api/teilnehmer/:id` und `DELETE /api/massnahmen/:id` sind für
  restringierte Nutzer (Ausbilder **und** Fachbereichsleiter) komplett
  gesperrt (403 „Keine Berechtigung zum Löschen von …“), unabhängig vom
  Fachbereich. Nur Nutzer mit einer der `UNRESTRICTED_ROLLEN`
  (Administrator, Lehrgangsorganisation, Bildungsstättenleiter) dürfen
  löschen.
- `DELETE /api/gruppen/:id`: Ausbilder ist es komplett untersagt (403,
  Prüfung über `hasRole(req, "Fachbereichsleiter")` in `server.js`).
  Fachbereichsleiter darf eine Gruppe nur löschen, wenn ihr keine
  Maßnahme mehr zugeordnet ist – geprüft per expliziter
  `SELECT COUNT(*) FROM massnahme WHERE GruppeID = ?` **vor** dem
  eigentlichen `DELETE`, damit eine klare 400-Fehlermeldung („Gruppe
  hat noch zugeordnete Maßnahmen und kann nicht gelöscht werden.“)
  statt eines generischen FK-Fehlers kommt. Hat ein Nutzer sowohl
  Ausbilder- als auch Fachbereichsleiter-Rolle, gilt die
  Fachbereichsleiter-Berechtigung (die Rolle schaltet frei, nicht ein).
  Für nicht-restringierte Rollen bleibt das Verhalten unverändert: die
  FK `fk_Massnahme_Gruppe1` ist weiterhin `RESTRICT` (kein
  `ON DELETE`-Zusatz), Löschen einer Gruppe mit noch zugeordneten
  Maßnahmen schlägt also serverseitig so oder so fehl.
- `GET /api/gruppen` liefert dafür zusätzlich `MassnahmenAnzahl` je
  Zeile (Subquery `SELECT COUNT(*) FROM massnahme WHERE GruppeID = g.ID`),
  damit der Client das Lösch-Icon pro Zeile passend ein-/ausblenden kann.
- Clientseitig (`js/main.js`) blenden `canDeleteMassnahmenOderTeilnehmer()`
  und `canDeleteGruppe(gruppe)` (Abschnitt vor `applyRolePermissions()`)
  das jeweilige Lösch-Icon in den drei Tabellen komplett aus, statt es
  nur zu deaktivieren – das Icon erscheint für die betroffenen Rollen gar
  nicht erst im DOM. Die serverseitige Prüfung ist trotzdem die
  eigentliche Absicherung, die clientseitige nur UX (analog zum
  bestehenden Muster bei den Fachbereichs-Berechtigungen).
- Alle Fälle wurden nach der Umsetzung live gegen den laufenden Server
  per curl verifiziert (Ausbilder-Sperre auf allen drei Routen,
  Fachbereichsleiter-Sperre bei Teilnehmenden/Maßnahmen, 400 bei
  Gruppe mit abhängigen Maßnahmen, 403 bei fremdem Fachbereich,
  erfolgreiches Löschen einer eigens angelegten leeren Test-Gruppe als
  Fachbereichsleiter) – mit eigens angelegten und danach wieder
  gelöschten Testbenutzern/-daten, ohne echte Datensätze zu verändern.

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

Sechs feste Rollen (Tabelle `rolle`, keine eigene Verwaltungs-UI, nur
Zuweisung über die Benutzer-Seite): Ausbilder, Fachbereichsleiter,
Lehrgangsorganisation, Administrator, Bildungsstättenleiter, **Auditor**
(seit dieser Session, `ROLLEN_SEED` in `server.js`, wird beim nächsten
Serverstart automatisch geseedet). Ein Benutzer kann mehrere Rollen und
mehrere Fachbereiche haben. Hat ein Benutzer mindestens eine der Rollen
Administrator/Lehrgangsorganisation/Bildungsstättenleiter, sieht und
bearbeitet er alle Fachbereiche uneingeschränkt; hat er ausschließlich
Ausbilder und/oder Fachbereichsleiter, ist er auf seine zugewiesenen
Fachbereiche beschränkt (`isRestrictedUser()` in `server.js`). Auditor ist
bewusst **nicht** in `UNRESTRICTED_ROLLEN` aufgenommen (kein Grund dafür,
solange die Audit-Unterseiten nur Platzhalter sind) und braucht auch keine
Fachbereichs-Zuweisung, da er ohnehin nur den eigenen, von den fachlichen
Seiten komplett getrennten Audit-Bereich sieht (siehe Unterabschnitt
"Audit-Bereich (Rolle Auditor)"). Rollen/Fachbereiche eines Nutzers werden
beim Login einmalig geladen und in der Session gecacht – ändert der Admin
sie während einer aktiven Sitzung, wirkt sich das erst beim nächsten Login
der betroffenen Person aus (bewusster Trade-off gegen DB-Abfragen bei
jedem Request).

Die neue **Benutzer-Seite** (nur für Administrator sichtbar, Sidebar +
`showPage()`-Guard blocken sie sonst auch bei direktem Hash-Aufruf) folgt
1:1 dem Fachbereiche-CRUD-Muster (Tabelle, einklappbares Neuanlage-Formular,
Bearbeiten-`<dialog>`, geteilter Lösch-Dialog über `openDeleteDialog`).
Rollen und Fachbereiche werden je als Checkbox-Gruppe dargestellt
(`.checkbox-group`). Beim Bearbeiten bleibt das Passwortfeld leer; nur bei
Eingabe wird das Passwort geändert, sonst bleibt es unverändert (Contract:
leer = unverändert). Ein Admin kann sich nicht selbst löschen (400).

Zusätzlich zu Bearbeiten/Löschen hat jede Zeile ein drittes Icon
(Schlüssel, `.row-reset-passwort-btn`) zum gezielten Zurücksetzen des
Passworts, ohne den vollständigen Bearbeiten-Dialog mit allen Feldern
öffnen zu müssen. Öffnet `#resetBenutzerPasswortDialog` (nur Neues
Passwort + Wiederholung, Mindestlänge serverseitig 8 Zeichen wie beim
regulären Bearbeiten), sendet `PUT /api/benutzer/:id/passwort` (eigener,
schlanker Endpunkt statt des allgemeinen `PUT /api/benutzer/:id`, da
dieser Username/Vorname/Nachname/Rollen/Fachbereiche im Body erwartet).
Der Endpunkt ist wie alle `benutzer`-Routen `requireRole("Administrator")`
geschützt; da die komplette Benutzer-Seite ohnehin nur für Administrator
sichtbar/erreichbar ist (Sidebar + `showPage()`-Guard, siehe oben), ist
das Icon serverseitig wie clientseitig durchgängig auf die Admin-Rolle
beschränkt.

Ein viertes Icon (Verbotssymbol bzw. Häkchen, `.row-toggle-aktiv-btn`)
erlaubt das zeitweise **Deaktivieren/Aktivieren** eines Benutzerkontos.
Welches Icon/welcher Tooltip angezeigt wird, hängt vom aktuellen
`Aktiv`-Status ab (Verbotssymbol + "Konto deaktivieren", solange das
Konto aktiv ist; Häkchen + "Konto aktivieren", sobald es deaktiviert
ist). Klick öffnet `#toggleBenutzerAktivDialog` – ein generisches
Bestätigungsfenster, dessen Titel/Text/Button-Beschriftung
(„Deaktivieren“ vs. „Aktivieren“) sowie der Zielzustand dynamisch in
`openToggleBenutzerAktivDialog()` (`js/main.js`) je nach aktuellem
Status gesetzt werden, statt zwei separate Dialoge zu pflegen. Bestätigen
sendet `PUT /api/benutzer/:id/aktiv` mit `{Aktiv: boolean}`
(`requireRole("Administrator")`); ein Admin kann den eigenen Account
nicht deaktivieren (400, analog zur bestehenden Selbstlöschsperre),
Selbst-Reaktivieren ist dagegen erlaubt (ohnehin irrelevant, da ein
deaktivierter Account sich nicht mehr einloggen kann). `POST
/api/login` prüft `Aktiv` nach erfolgreicher Passwortprüfung und
verweigert deaktivierten Konten den Login (401 „Dieses Benutzerkonto
wurde deaktiviert.“); eine bereits laufende Session eines währenddessen
deaktivierten Nutzers wird nicht aktiv beendet, das ist derselbe
akzeptierte Trade-off wie bei Rollen-/Fachbereichsänderungen (siehe
"Noch offen" unten). In der Tabelle wird der Username eines
deaktivierten Kontos durchgestrichen dargestellt (Klasse
`.username-deaktiviert` auf der Username-Zelle).

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

### Audit-Bereich (Rolle Auditor)

Auf ausdrücklichen Wunsch als reines Gerüst gebaut: 9 Menüpunkte,
Platzhalterseiten, keine Datenanbindung. Die eigentlichen Audit-Inhalte
sind bewusst nicht Teil dieser Session. Ursprünglich mit 6 Punkten
gestartet (Maßnahmen, Teilnehmer, Anwesenheiten, Lernmaterialien,
Leistungskontrollen, Praktika), in derselben Session um 3 weitere
ergänzt (zunächst als „Interessentenbetreuung“, Teilnehmenden Feedback,
Vermittlung angehängt) – das Muster ist identisch, neue Punkte einfach
nach demselben Schema anhängen (siehe unten). „Interessentenbetreuung“
wurde kurz danach in **„Interessenten Betreuung“** umbenannt (mit
Leerzeichen) und an die **erste Stelle** der Liste verschoben (vor
Maßnahmen) – sowohl im `<ul class="sidebar-subnav">` in `index.html`
als auch im `auditPages`-Array in `js/main.js`, da dessen Reihenfolge
direkt bestimmt, welche Seite `isAuditorOnly()`-Nutzer nach dem Login
automatisch sehen (`auditPages[0]`, siehe unten) – ein reiner Auditor
landet seitdem also auf „Interessenten Betreuung“ statt „Maßnahmen“.
Die interne Seiten-ID (`audit-interessentenbetreuung`, Hash/`<section
id>`) blieb bewusst unverändert, nur der sichtbare Label-/Überschriften-
Text wurde angepasst.

**Sidebar-Gruppe:** Erste aufklappbare Menügruppe im Projekt. Statt neuer
JS-Toggle-Logik wird dafür ein natives `<details class="sidebar-group">`
mit `<summary class="sidebar-link">Audit</summary>` verwendet (`index.html`)
– dasselbe Element, das im Projekt schon für die einklappbaren
Neuanlage-Formulare eingesetzt wird, hier erstmals für die Navigation.
Browser übernehmen Öffnen/Schließen nativ, kein zusätzliches JS nötig.
CSS entfernt den nativen Dreiecks-Marker (`summary::-webkit-details-marker`
+ `summary::marker`) und ersetzt ihn durch ein eigenes Chevron-SVG, das per
`.sidebar-group[open] summary .icon-chevron-audit { transform: rotate(90deg); }`
rotiert. Die Unterpunkte liegen in einem verschachtelten
`<ul class="sidebar-subnav">` mit denselben `.sidebar-link`-Elementen wie
die Top-Level-Links (`navLinks` in `js/main.js` selektiert generisch über
`.sidebar-link[data-page]`, erfasst die Unterpunkte also automatisch mit,
ohne Codeänderung an der Auswahl-/Highlighting-Logik). Bewusst **ohne**
eigenes Icon je Unterpunkt (anders als bei allen anderen Sidebar-Links),
um Platz zu sparen. Im eingeklappten Sidebar-Zustand wird
`.sidebar-subnav` komplett ausgeblendet
(`.sidebar.collapsed .sidebar-subnav { display: none; }`), die Audit-Gruppe
zeigt dort nur noch ihr eigenes Icon wie jeder andere Top-Level-Link.

**Lehre zu langen Menüpunkt-Namen (zweimal in dieser Session gefunden,
jeweils per Playwright-Screenshot):** Erst schnitt „Leistungskontrollen“
im Sidebar-Text ab, behoben durch schmalere Einrückung/Schriftgröße.
Beim Ergänzen von „Interessentenbetreuung“/„Teilnehmenden Feedback“ kam
derselbe Fehler zurück, weil der **aktive** Zustand (`.sidebar-link.active`)
`font-weight: 700` setzt und Fettschrift breiter ist als Normalschrift –
der schmalere Fix reichte dann nicht mehr. Endgültig gelöst durch
Zeilenumbruch statt Nachjustieren von Maßen: `.sidebar-subnav .sidebar-link`
bekam `white-space: normal`, und `.sidebar-subnav .sidebar-link .label`
zusätzlich `min-width: 0` + `overflow-wrap: break-word` (nötig, weil
Flex-Kinder ohne `min-width: 0` nicht unter ihre Inhaltsbreite schrumpfen
– sonst hätte `overflow-wrap` bei einzelnen langen Wörtern wie
„Interessentenbetreuung“ ohne Leerzeichen keine Wirkung gehabt). Damit
brechen beliebig lange künftige Audit-Punkt-Namen automatisch um, auch im
fett-aktiven Zustand – kein erneutes Nachjustieren bei weiteren Ergänzungen
nötig.

**Seiten/Routing:** 9 neue `<section class="page" id="page-audit-...">`
(`audit-massnahmen`, `audit-teilnehmer`, `audit-anwesenheiten`,
`audit-lernmaterialien`, `audit-leistungskontrollen`, `audit-praktika`,
`audit-interessentenbetreuung`, `audit-teilnehmendenfeedback`,
`audit-vermittlung`), jeweils nur `<h2>` (= Auditpunkt-Name) +
„Platzhalterseite – Inhalt folgt.“. Neues Array `auditPages` in
`js/main.js` plus `canAccessAudit(user)` (Rolle Auditor **oder**
Administrator) und `isAuditorOnly(user)` (Rollenliste ist exakt
`["Auditor"]`, keine Zweitrolle). In `showPage()` zwei zusätzliche Guards
nach dem bestehenden `adminOnlyPages`-Muster: fehlt einem Nutzer
`canAccessAudit`, wird eine angeforderte Audit-Seite auf `defaultPage`
umgeleitet (greift auch bei direkter Hash-Manipulation, nicht nur beim
Sidebar-Klick); ist ein Nutzer `isAuditorOnly` und die Zielseite liegt
**nicht** in `auditPages`, wird stattdessen auf `auditPages[0]`
umgeleitet – so landet ein reiner Auditor nach dem Login automatisch auf
dem ersten Eintrag der Liste (aktuell „Interessenten Betreuung“, siehe
oben), obwohl `defaultPage` weiterhin global `"dashboard"` bleibt. Beim Rendern einer Audit-Seite wird zusätzlich
`document.querySelector(".sidebar-group").open = true` gesetzt, damit die
Gruppe beim direkten Ansprung (Login, Reload) automatisch aufgeklappt
ist. `pageLabels` bekam entsprechend neue Einträge im Muster
`"audit-massnahmen": "Audit / Maßnahmen"`, wodurch die Breadcrumb ohne
Sonderfall-Code (anders als bei `teilnehmende-aktivitaeten`) automatisch
„Start / Audit / Maßnahmen“ zeigt. **Neue Audit-Punkte ergänzen:** Eintrag
in `auditPages` + `pageLabels` (`js/main.js`), `<li><a>` in
`.sidebar-subnav` + `<section class="page" id="page-audit-...">`
(`index.html`) – kein weiterer Code nötig, alles andere greift generisch.

**Sichtbarkeit:** `applyRolePermissions()` blendet die Audit-Gruppe
(`.closest("li")` der `.sidebar-group`) ein, wenn `canAccessAudit(user)`
zutrifft, und blendet zusätzlich die fünf Links Dashboard/Anwesenheiten/
Teilnehmende/Maßnahmen/Gruppen komplett aus, wenn `isAuditorOnly(user)`
zutrifft. Fachbereiche/Benutzer waren schon vorher admin-only und bleiben
unverändert. Ein Nutzer mit z. B. Ausbilder **und** Auditor gleichzeitig
verliert also nichts – die Ausblendung der operativen Seiten greift nur,
wenn Auditor die einzige Rolle ist.

Getestet per Playwright (Admin- und Auditor-Login, Screenshots): Admin
sieht alle Seiten inkl. aufklappbarer Audit-Gruppe mit allen 9
Unterpunkten; ein Nutzer mit ausschließlich der Rolle Auditor landet
nach dem Login automatisch auf der jeweils ersten Seite der Liste
(ursprünglich „Audit / Maßnahmen“, nach der Umsortierung „Audit /
Interessenten Betreuung“), sieht sonst nichts in der Sidebar, und ein
Versuch, per direkter Hash-Änderung (`#teilnehmende`) auf eine fremde
Seite zu wechseln, wird von den `showPage()`-Guards zurück auf die
Audit-Seite geleitet. Mit eigens angelegtem und danach wieder gelöschtem
Testbenutzer, ohne echte Daten zu verändern. Nach der Erweiterung um die
3 zusätzlichen Punkte erneut per Screenshot verifiziert, dass alle 9
Einträge (auch im aktiven Zustand) vollständig lesbar sind, siehe Lehre
zu langen Menüpunkt-Namen oben; nach Umbenennung/Umsortierung von
„Interessenten Betreuung“ ebenfalls erneut per Screenshot verifiziert
(erster Listenplatz, korrekte Breadcrumb, korrekter Umbruch).

### Stammdaten-Übersicht

Sidebar-Umbau: Maßnahmen, Gruppen und Fachbereiche waren bisher drei
eigenständige Top-Level-Sidebar-Punkte, sind jetzt als Unterpunkte einer
neuen aufklappbaren Gruppe **„Stammdaten"** zusammengefasst (zwischen
Teilnehmende und Audit). Die eigentlichen CRUD-Seiten dieser drei
Entitäten (Tabelle, Formulare, Dialoge) sind dabei **unverändert** –
nur die Navigation dorthin wurde umgehängt, keine Änderungen an
`server.js` oder den bestehenden `/api/massnahmen`, `/api/gruppen`,
`/api/fachbereiche`-Routen.

**Doppelrolle des „Stammdaten"-Menüpunkts:** Anders als „Audit" (dessen
`<summary>` rein ein Aufklapp-Toggle ohne eigene Seite ist) ist
„Stammdaten" gleichzeitig Aufklapp-Gruppe **und** eigener navigierbarer
Menüpunkt mit eigener Seite. Umgesetzt über ein zusätzliches
`data-page="stammdaten"`-Attribut auf dem `<summary class="sidebar-link">`
(`index.html`) plus einem generischen Klick-Listener in `js/main.js`:
```js
document.querySelectorAll(".sidebar-group summary[data-page]").forEach((summary) => {
  summary.addEventListener("click", () => {
    window.location.hash = summary.dataset.page;
  });
});
```
Das native Aufklappen/Zuklappen von `<details>` bei jedem Klick auf
`<summary>` bleibt dabei unangetastet (kein `preventDefault()`) – es
läuft einfach parallel zur Navigation. Da `showPage()` die Gruppe beim
Rendern jeder ihrer Seiten ohnehin zwangsweise wieder öffnet (siehe
unten), ist ein eventuelles Zuklappen durch den nativen Toggle nie
sichtbar. Audits `<summary>` hat bewusst **kein** `data-page`-Attribut
und bekommt dadurch keinen Klick-Listener – funktioniert weiterhin rein
als Toggle ohne eigene Seite.

**Generische Aufklapp-Logik statt hartkodiertem Element:** Mit einer
zweiten Sidebar-Gruppe reichte die alte, Audit-spezifische
`document.querySelector(".sidebar-group")`-Logik nicht mehr (hätte
immer nur die erste Gruppe im DOM gefunden). Ersetzt durch eine
generische Variante in `showPage()`, die für **jede** `.sidebar-group`
im DOM prüft, ob die aktuelle Zielseite zu ihr gehört (Summary- **und**
alle Subnav-`data-page`-Werte), und nur dann öffnet:
```js
document.querySelectorAll(".sidebar-group").forEach((group) => {
  const pagesInGroup = [...group.querySelectorAll("[data-page]")].map((el) => el.dataset.page);
  if (pagesInGroup.includes(targetId)) {
    group.open = true;
  }
});
```
Damit funktionieren beliebig viele weitere Sidebar-Gruppen in Zukunft
ohne Codeänderung an dieser Stelle. Aus demselben Grund wurde in
`applyRolePermissions()` die bisherige Audit-Selektion auf
`data-group="audit"` präzisiert (neues `data-group`-Attribut auf beiden
`<details>`-Elementen, `index.html`) – vorher ebenfalls über den
mittlerweile mehrdeutigen `.sidebar-group`-Selektor gelöst.

**Stammdaten-Seite (`#page-stammdaten`):** Drei klickbare Cards im
optischen Muster der Dashboard-Statistikkarten (`.stat-grid`/`.stat-card`
wiederverwendet, neue Modifier-Klasse `.stammdaten-card` nur für
Link-Reset + Hover-Schatten), aber als `<a href="#massnahmen">` (bzw.
`#gruppen`/`#fachbereiche`) statt `<div>` – ein Klick navigiert direkt
zur jeweiligen Seite. Zahlen kommen aus einer neuen `loadStammdatenStats()`
in `js/main.js`, die dieselben `/api/massnahmen`/`/api/gruppen`/
`/api/fachbereiche`-Endpunkte wie das Dashboard aufruft und dadurch
automatisch dasselbe Fachbereichs-Scoping erbt (für Ausbilder/
Fachbereichsleiter zeigt die Karte also automatisch nur ihre eigenen
Zahlen, ohne eigenen Code dafür). Die Lade-Schleife wurde aus
`loadDashboardStats()` in eine gemeinsame Hilfsfunktion `ladeKennzahlen(endpoints)`
extrahiert, die jetzt von beiden Funktionen genutzt wird (Duplikation
vermieden). `pageLabels` für `massnahmen`/`gruppen`/`fachbereiche` zeigen
jetzt `"Stammdaten / …"` in der Breadcrumb statt nur des Seitennamens.

**Sichtbarkeit:** Die „Fachbereiche"-Card auf der Stammdaten-Seite
(`id="stammdatenFachbereicheCard"`) wird in `applyRolePermissions()`
genau wie der zugehörige Sidebar-Unterpunkt nur für Administrator
eingeblendet (unverändertes Verhalten, nur an die neue Position
angepasst). Für Nutzer mit ausschließlich der Rolle Auditor wird die
komplette Stammdaten-Gruppe (`.closest("li")` von
`.sidebar-group[data-group="stammdaten"]`) ausgeblendet, ersetzt die
vorherige Einzelausblendung von `massnahmen`/`gruppen` als Top-Level-
Links (nicht mehr nötig, da beide jetzt Teil der als Ganzes
ausgeblendeten Gruppe sind).

Getestet per Playwright (Admin-, Ausbilder/Fachbereichsleiter- und
Auditor-Login, Screenshots): Admin sieht die neue Sidebar-Struktur und
alle drei Cards mit korrekten Zahlen, Klick auf eine Card navigiert
korrekt zur jeweiligen Seite mit korrekter Breadcrumb; ein Nutzer mit
Ausbilder/Fachbereichsleiter sieht auf der Stammdaten-Seite nur die
Maßnahmen-/Gruppen-Card (keine Fachbereiche-Card) mit bereits
Fachbereichs-gescopten Zahlen; ein reiner Auditor sieht „Stammdaten"
weder in der Sidebar noch erreichbar per direkter Hash-Änderung
(`#stammdaten`, wird auf die aktive Audit-Seite zurückgeleitet). Mit
eigens angelegtem und danach wieder gelöschtem Testbenutzer, ohne echte
Daten zu verändern.

### Dokumentenverwaltung pro Teilnehmendem

Neues Uhr-Icon-ähnliches Datei-Icon (`.row-files-btn`) in der
Teilnehmenden-Tabelle führt zu einer weiteren Master-Detail-Unterseite
`#page-teilnehmende-dateien` ("Dateiablage") – strukturell nach dem
Vorbild der Aktivitätenverlauf-Unterseite (gleicher State-Machine-Ansatz:
`currentDokumentTeilnehmerId`/`currentDokumentTeilnehmer`,
`openTeilnehmerDateien(person)` mit demselben Hash-Sonderfall wie
`openTeilnehmerAktivitaeten`), aber bewusst nur **2 Panel-Zustände**
(Platzhalter/Detail) statt 3 – der Upload läuft über ein separates
`<dialog>` statt über ein drittes Inline-Formular, weil ein
Datei-Upload sich schlecht in ein Inline-Panel einfügt.

**Datenmodell:** neue Tabelle `dokument` (siehe Datenbank-Abschnitt
oben) – `Loeschdatum DATE NOT NULL` ist für **jedes** Dokument Pflicht
(nicht nur vertrauliche), `GespeicherterDateiname` (UUID-basiert, siehe
unten) ist rein intern und wird **nie** an den Client zurückgegeben.

**Upload-Dialog** (`#dokUploadDialog`): natives `<input type="file">`
für die Dateiauswahl (Dateibaum-Navigation kommt automatisch vom
Betriebssystem, kein Custom-UI gebaut), Titel/Schlagworte (Freitext,
analog zum bestehenden "Thema"-Feld bei Aktivitäten)/Dokumentart
(Dropdown, feste Liste: „Eigennachweis Fehlzeit“, „Arbeitsunfähigkeit“,
„Praktikumsvertrag“, „Anwesenheitsnachweis Praktikum“, analog zum
bestehenden `AKTIVITAET_ARTEN`-Array-Muster, hier `DOKUMENT_ARTEN` in
`server.js`)/Vertraulich (Checkbox)/Löschdatum (Date, Pflicht).
**Löschdatum-Vorauswahl:** `teilnehmer.Endedatum` + konfigurierbarer
Jahres-Offset (Default 3, in Einstellungen änderbar), berechnet
clientseitig in `berechneLoeschdatumVorschlag()` bewusst über
`new Date(y, m-1, d)` mit einzeln geparsten Ganzzahlen statt
`new Date(dateString)` – vermeidet die UTC/Local-Zeitzonenfalle bei
direktem ISO-String-Parsing. Der Offset-Wert wird einmalig beim
App-Start für **alle** Rollen geladen (`GET
/api/einstellungen/loeschfrist-offset`, absichtlich ohne
Admin-Beschränkung, siehe Berechtigungen unten). Upload läuft über
`FormData` + `fetch(..., {method:"POST", body: formData})` **ohne**
manuellen `Content-Type`-Header (der Browser setzt die
multipart-Boundary selbst).

**Bearbeiten-Dialog** (`#dokEditDialog`): identische Felder minus
Datei-Input, ändert nur Metadaten (`PUT /api/dokumente/:id`), niemals
die Datei selbst.

**Löschen ist bewusst rollenmäßig anders als bei allen anderen
Entitäten im Projekt:** Nur Administrator darf ein Dokument löschen
(Datei + DB-Zeile) – alle anderen berechtigten Nutzer (Fachbereichs-
Scope) dürfen nur Eigenschaften bearbeiten. Clientseitig
`canDeleteDokument()` (schlichte Admin-Rollenprüfung, kein
Fachbereichs-Anteil wie bei `canDeleteGruppe()`), serverseitig
`requireRole("Administrator")` auf `DELETE /api/dokumente/:id`. Alle
anderen `dokumente`-Routen (GET/POST/PUT sowie der Datei-Download)
folgen dagegen dem normalen Fachbereichs-Scope-Muster
(`isRestrictedUser()`/`fachbereichInScope()`/
`resolveFachbereichForMassnahme()`, über `resolveDokumentFuerScope()`
analog zu `resolveAktivitaetFuerScope()`).

**Datei-Handling:** `multer` (neue Dependency, `diskStorage`,
20 MB Limit, keine Typ-Einschränkung). Zieldateiname auf der Platte =
`crypto.randomUUID() + Dateiendung` (kollisionsfrei, unabhängig vom
Original-Dateinamen), Zielverzeichnis dynamisch aus der neuen
`einstellung`-Tabelle aufgelöst (`resolveUploadVerzeichnis()`, legt das
Verzeichnis bei Bedarf per `fs.mkdirSync(..., {recursive:true})` an).
Ein eigener `MulterError`-Handler (Express-Error-Middleware am
Dateiende, vor `app.listen`) liefert bei zu großen Uploads eine saubere
400-JSON-Antwort statt der Express-Standardfehlerseite.

**Kritischer Sicherheits-Fix als Teil dieser Änderung:**
`app.use(express.static(path.join(__dirname, "..")))` lieferte bisher
das **komplette Repo-Root** aus, inkl. `server/server.js`,
`server/schema.sql`, `server/package.json` im Klartext über HTTP
(`server/.env` war durch Express' Default `dotfiles:"ignore"`
geschützt). Ein neuer Upload-Ordner als "Unterordner der Anwendung"
(`server/uploads/`, wie explizit gefordert) hätte ohne Änderung
ebenfalls in diesem öffentlich abrufbaren Baum gelegen – bei teils
vertraulichen, personenbezogenen Dokumenten inakzeptabel. Behoben durch
Ersatz des pauschalen Static-Mounts durch eine explizite Allowlist:
```js
const publicRoot = path.join(__dirname, "..");
app.get(["/", "/index.html"], (req, res) => res.sendFile(path.join(publicRoot, "index.html")));
app.use("/css", express.static(path.join(publicRoot, "css")));
app.use("/js", express.static(path.join(publicRoot, "js")));
app.use("/assets", express.static(path.join(publicRoot, "assets")));
```
Der Upload-Ordner liegt außerhalb dieser Liste und ist damit nicht mehr
öffentlich erreichbar; Zugriff nur noch über die authentifizierte,
Fachbereichs-gescopte Route `GET /api/dokumente/:id/datei`
(`res.download()`). Per curl verifiziert: `GET /server/server.js` und
`GET /server/uploads/<datei>` liefern jetzt 404 (vorher 200 bzw. wäre
es gewesen), `index.html`/`css/`/`js/` weiterhin 200. `server/uploads/`
zusätzlich in `.gitignore` aufgenommen. **Lehre für künftige
Änderungen:** Neue statische Assets müssen der Allowlist explizit
hinzugefügt werden, kein Rückfall auf einen pauschalen Root-Mount.

**Einstellungen-Seite** (`#page-einstellungen`, admin-only wie
Fachbereiche/Benutzer, neuer Top-Level-Sidebar-Link mit Zahnrad-Icon):
einfaches Formular mit zwei Feldern (Dokumentenpfad, leer = Standard-
Unterordner `server/uploads/`; Löschfrist-Offset in Jahren). `GET/PUT
/api/einstellungen` beide `requireRole("Administrator")` (bewusst
restriktiver als ursprünglich im Plan vorgesehen, da der volle
Dateisystempfad nicht jedem eingeloggten Nutzer offenliegen soll);
separat `GET /api/einstellungen/loeschfrist-offset` **ohne**
Rollen-Einschränkung, liefert nur die reine Offset-Zahl für die
Löschdatum-Vorauswahl im Upload-Dialog – so bekommen alle Rollen den
für sie relevanten Wert, ohne dass Nicht-Admins den Dateisystempfad zu
sehen bekommen.

**Zwei CSS-Bugs beim Testen gefunden und behoben** (per
Playwright-Screenshot, wie schon öfter in dieser Session): (1) Die
generische Regel `.form-row input { padding; border; background }`
(gedacht für Text-/Date-/Select-Felder) griff auch für das neue
`Vertraulich`-Checkbox-Feld und blähte es optisch auf, wodurch Checkbox
und Label-Text weit auseinanderrutschten – behoben durch
`.form-row input:not([type="checkbox"])` plus eigene, schlanke Regel
für `input[type="checkbox"]`. (2) Der "Herunterladen"-Link
(`<a class="btn-primary">`) sah wie reiner blauer Linktext statt wie
ein Button aus, da `.btn-primary` nur `background`/`color` setzt und
das Button-Boxmodell (Padding, Radius, `text-decoration`) bisher nur
über `.dialog-actions button` (Element-Selektor, trifft auf `<a>`
nicht) kam – behoben durch eine eigene `a.btn-primary`-Regel, analog
zum bereits früher gelösten `.stammdaten-card`-Link-Problem.

**Bekannter, akzeptierter Trade-off:** Löscht man einen Teilnehmenden,
entfernt die FK `ON DELETE CASCADE` nur die `dokument`-Zeilen aus der
DB, nicht die zugehörigen Dateien auf der Platte (verwaiste Dateien
bleiben liegen). Unkritisch, da der Ordner ohnehin nicht öffentlich
erreichbar ist; nicht behoben, um den Rahmen zu wahren. Ebenfalls
bewusst nicht gebaut: automatische Löschung bei Erreichen des
Löschdatums (nur Datenfeld, kein Cron-Job), Tag-Autocomplete.

**Dokumentanzahl-Badge am Datei-Icon** (nachträglich in derselben
Session ergänzt, ursprünglich bewusst weggelassen, dann explizit
nachgefordert): 1:1 nach dem Vorbild des bestehenden Aktivitäten-Badges
umgesetzt, inkl. identischer Farblogik. Neuer Endpunkt `GET
/api/dokumente/summary` (Fachbereichs-gescoped, `HatAktuelle` = min.
ein Dokument mit `HochgeladenAm` in den letzten 14 Tagen) spiegelt
`GET /api/aktivitaeten/summary` fast wortgleich. Clientseitig
`tnDokumentSummary`-Map + `loadTnDokumentSummary()`/
`updateDokumentBadge()`/`refreshTnDokumentBadges()` als exakte Pendants
zu `tnAktivitaetSummary`/`updateAktivitaetBadge()`/
`refreshTnAktivitaetBadges()`; das Datei-Icon wurde dafür nachträglich
in einen `.history-btn-wrap`-Wrapper eingebettet (vorher nacktes
`<button>`), da dieser Wrapper das `position:relative`-Ankerelement für
das absolut positionierte Badge ist. CSS: `.dokument-badge` teilt sich
Selektor und Farbwerte 1:1 mit `.aktivitaet-badge`/`.badge-aktuell`
(eine gemeinsame Regelgruppe, keine Duplikation) – dadurch garantiert
farblich identisch, wie gefordert. Badge-Refresh läuft über denselben
`showPage()`-Hook wie das Aktivitäten-Badge (bei Rückkehr zur
Teilnehmenden-Tabelle).

Getestet per curl (Upload, Metadaten-Update, Download, Löschen als
Nicht-Admin → 403/als Admin → 204, inkl. Datei-Bereinigung auf der
Platte, sowie der neue `summary`-Endpunkt) und Playwright (Admin- und
Nicht-Admin-Login, Screenshots): kompletter Durchlauf Icon → Upload →
Liste → Detail → Bearbeiten → Einstellungen-Seite; als Nicht-Admin
Bearbeiten-Icon sichtbar, Lösch-Icon nicht; Badge-Farbe/-Zahl per
DOM-Auswertung und vergrößertem Ausschnitt-Screenshot neben dem
bestehenden Aktivitäten-Badge verglichen. Alle selbst angelegten
Testdaten (Dokumente, Dateien) danach wieder entfernt – ein vom Nutzer
selbst während der Session angelegtes echtes Testdokument wurde bewusst
nicht angetastet.

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
- Rollen-/Fachbereichs-Änderungen sowie das Deaktivieren eines Kontos
  wirken erst ab dessen nächstem Login-Versuch (Session-Cache, siehe
  oben) – kein Mechanismus, um aktive Sessions bei Rechteänderung oder
  Deaktivierung sofort zu invalidieren. Ein bereits eingeloggter Nutzer
  bleibt also bis zum nächsten Login bzw. Serverneustart aktiv nutzbar,
  selbst wenn ein Administrator sein Konto zwischenzeitlich deaktiviert.
- Sessions sind In-Memory (express-session Default) – bei Serverneustart
  müssen sich alle Nutzer neu einloggen; für produktiven Mehr-Instanzen-Betrieb
  wäre ein externer Session-Store (z. B. MySQL/Redis) nötig.
- Keine "Passwort vergessen"-Funktion – ein vergessenes Passwort kann aktuell
  nur ein Administrator über die Benutzer-Seite zurücksetzen.
- Das rechte Panel "Nachrichten" auf dem Dashboard ist bisher nur ein
  Platzhalter (siehe "Wiedervorlage-Nachrichtenliste auf dem Dashboard")
  – weitere Nachrichtentypen, User-zu-User-Nachrichten und
  Aufgabenzuweisung sind bewusst noch nicht umgesetzt.
- Die 9 Audit-Unterseiten (siehe "Audit-Bereich (Rolle Auditor)") sind
  reine Platzhalter ohne Inhalt/Datenanbindung – was dort inhaltlich
  angezeigt/geprüft werden soll, ist bewusst noch nicht spezifiziert und
  kommt in einer späteren Session.
- Keine automatische Löschung von Dokumenten bei Erreichen des
  Löschdatums (siehe "Dokumentenverwaltung pro Teilnehmendem") – nur ein
  Datenfeld, kein Cron-Job/Scheduler im Projekt vorhanden.
- Löscht man einen Teilnehmenden, werden zugehörige Dokument-Dateien auf
  der Platte nicht automatisch mitgelöscht (nur die DB-Zeilen per FK
  `ON DELETE CASCADE`) – verwaiste Dateien bleiben liegen, unkritisch
  aber nicht bereinigt.

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
