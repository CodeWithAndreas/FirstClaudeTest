# Standortmanager – Projektstatus

Stand: 2026-08-22. Diese Datei fasst den bisherigen Fortschritt zusammen, damit
eine neue Session nahtlos anschließen kann.

**Wichtig für eine neue Session:** Zwei weitere Icons je Zeile auf der
Benutzer-Seite: Passwort zurücksetzen (ohne den vollständigen
Bearbeiten-Dialog zu öffnen) sowie Benutzerkonto aktivieren/deaktivieren
(siehe Abschnitt "Login, Rollen und Benutzerverwaltung" weiter unten).
Für Letzteres wurde die Tabelle `benutzer` um die Spalte `Aktiv`
erweitert – das übernimmt `bootstrapDatabase()` in `server.js` beim
Serverstart automatisch und idempotent, es ist also keine manuelle
DB-Migration nötig.

**Historische Randnotiz (bewusst dokumentiert, damit es nicht erneut
versucht wird):** In einer früheren Session wurden testweise
rollenabhängige Löschrechte für Teilnehmende/Maßnahmen/Gruppen eingebaut
(Ausbilder/Fachbereichsleiter dürfen unterschiedlich viel löschen) samt
Umstellung der FK `fk_Massnahme_Gruppe1` auf `ON DELETE SET NULL`, damit
eine Gruppe trotz zugeordneter Maßnahmen löschbar blieb. Das führte zu
mehreren Folgefehlern (stale Dropdown-/Filter-Caches auf mehreren
Seiten, siehe Git-Historie) und wurde auf ausdrücklichen Wunsch
vollständig zurückgebaut. Der aktuelle, gewollte Zustand: Alle
eingeschränkten Nutzer (Ausbilder wie Fachbereichsleiter) haben
identische CRUD-Rechte innerhalb ihrer Fachbereiche, keine
rollenabhängige Löschrechte-Differenzierung; die FK ist wieder auf den
Standard ohne `ON DELETE`-Klausel (`RESTRICT`), Löschen einer Gruppe mit
noch zugeordneten Maßnahmen schlägt daher bewusst fehl statt sie zu
"verwaisen". Unverändert (schon vor jener Session so) bleibt, dass eine
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
| `aktivitaet`  | ID, TeilnehmerID, Art, Thema, Bearbeiter, Bemerkung, Wiedervorlage, ErstelltAm             | TeilnehmerID → teilnehmer.ID (ON DELETE CASCADE) |
| `benutzer`    | ID, Username (UNIQUE), PasswortHash, Vorname, Nachname, Email, Telefon, Aktiv, ErstelltAm  | – |
| `rolle`       | ID, Bezeichnung (UNIQUE)                                                                   | – |
| `benutzer_rolle` | BenutzerID, RolleID (Composite-PK)                                                       | BenutzerID → benutzer.ID (ON DELETE CASCADE), RolleID → rolle.ID (ON DELETE CASCADE) |
| `benutzer_fachbereich` | BenutzerID, FachbereichID (Composite-PK)                                           | BenutzerID → benutzer.ID (ON DELETE CASCADE), FachbereichID → fachbereich.ID (ON DELETE CASCADE) |

Die vier `benutzer*`-Tabellen existieren in keiner separaten `.sql`-Datei,
sondern werden von `bootstrapDatabase()` in `server/server.js` bei jedem
Serverstart per `CREATE TABLE IF NOT EXISTS` idempotent sichergestellt
(kein Migrationstool im Projekt). Dieselbe Funktion seedet `rolle` mit den
5 festen Rollen (`INSERT IGNORE`) und legt bei leerer `benutzer`-Tabelle
einmalig das Admin-Konto an (Username `admin`, Startpasswort `Admin2026!`,
Rolle Administrator – Konsolenmeldung nur beim erstmaligen Anlegen). Für
nachträglich auf `benutzer` ergänzte Spalten (bisher nur `Aktiv`) prüft
`bootstrapDatabase()` zusätzlich per `INFORMATION_SCHEMA.COLUMNS`, ob die
Spalte schon existiert, und holt sie sonst per `ALTER TABLE` nach – damit
funktioniert sowohl eine frische als auch eine bereits bestehende
`benutzer`-Tabelle ohne manuellen Eingriff.

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
- `aktivitaeten`: GET `?teilnehmerId=<id>` (neueste zuerst), POST (Pflichtfelder
  `TeilnehmerID`, `Art` aus `["Gesprächsprotokoll", "Aktennotiz",
  "Kontaktversuch"]`; optional `Thema`, max. 60 Zeichen, sonst 400;
  `Bearbeiter` wird ausschließlich serverseitig aus der Session gesetzt,
  ein evtl. mitgeschicktes `Bearbeiter`-Feld im Request-Body wird
  ignoriert; kein PUT/DELETE, da erstmal nicht gefordert)
- `aktivitaeten/summary`: GET, liefert je Teilnehmer mit mindestens einer
  Aktivität `{TeilnehmerID, Anzahl, HatAktuelle}` für die Badges in der
  Teilnehmenden-Tabelle
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
Fachbereiche.

Alle eingeschränkten Nutzer (Ausbilder wie Fachbereichsleiter) haben
aktuell identische Rechte innerhalb ihrer zugewiesenen Fachbereiche –
volles CRUD auf `gruppen`, `massnahmen`, `teilnehmer`, `anwesenheiten`
und `aktivitaeten`, keine rollenabhängige Differenzierung zwischen den
beiden Rollen. (In dieser Session war testweise eine feinere
Löschrechte-Unterscheidung zwischen Ausbilder und Fachbereichsleiter
sowie eine `ON DELETE SET NULL`-Umstellung für Maßnahmen eingebaut,
wurde aber wegen mehrerer Folgefehler wieder vollständig zurückgebaut,
siehe Hinweis am Dateianfang.)

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
