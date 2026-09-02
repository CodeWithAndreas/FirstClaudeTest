# Standortmanager – Projektstatus

Stand: 2026-08-29. Diese Datei fasst den bisherigen Fortschritt zusammen, damit
eine neue Session nahtlos anschließen kann.

**Zuletzt (2026-08-29): Anwesenheiten in Untermenüs „Monatlich"/„Wöchentlich"
aufgeteilt.** Der bisherige einzelne Sidebar-Link **Anwesenheiten** ist jetzt
eine `<details class="sidebar-group" data-group="anwesenheiten">`-Gruppe (exakt
das Muster von Stammdaten/Audit) mit zwei Unterpunkten: **Monatlich**
(`#anwesenheiten-monatlich`) = die bisherige Monatsansicht, unverändert im
Verhalten, und **Wöchentlich** (`#anwesenheiten-woechentlich`) = neue
Wochenansicht (Montag–Sonntag, Navigations-Pfeile springen um je 7 Tage,
Label „KW N · TT.MM.–TT.MM.JJJJ"). **Bewusste Architekturentscheidung:** Beide
Unterpunkte teilen sich **eine** Seite (`page-anwesenheiten`) und **eine**
JS-Implementierung – kein zweites `<section>`, keine Kopie der ~750 Zeilen
Anwesenheiten-Logik. Ein Modul-State `awMode` (`"month"`/`"week"`) schaltet um;
alle Tages-Schleifen laufen jetzt über den generischen Helfer `awPeriodDates()`
(liefert im Monatsmodus alle Monatstage, im Wochenmodus Mo–So als `Date[]`),
`awPeriodRange()` (ISO von/bis) und `awPeriodLabel()`. Neue Helfer
`awStartOfWeek()`, `awDateToIso()`, `awIsoWeekNumber()` (ISO-8601-KW). `showPage()`
mappt beide Routen auf `sectionId = "anwesenheiten"` und ruft `setAwMode()` vor
`ensureAwInitialized()`. `updateAwMonthLabel()` → `updateAwPeriodLabel()` (setzt
zusätzlich den `<h2 id="awPageTitle">`), `changeAwMonth()` → `changeAwPeriod()`.
PDF-Bericht (`buildAwReportHeaderLines`/`buildAwReportFilename`/`drawAwReportPage`)
ist ebenfalls modusabhängig (Kopfzeile „Woche:"/„Monat:", Dateiname `…_KW35_2026`).
**Backend:** `GET /api/anwesenheiten` akzeptiert jetzt zusätzlich zu
`?monat=YYYY-MM` einen freien Bereich `?von=YYYY-MM-DD&bis=YYYY-MM-DD` (nötig,
weil eine KW über eine Monatsgrenze reichen kann); die Abfrage nutzt intern
`Datum BETWEEN ? AND ?`. Das Frontend ruft jetzt immer die von/bis-Form auf;
`?monat=` bleibt aus Kompatibilität erhalten. Rollen-Gating unverändert:
Auditor-only sieht die Gruppe nicht (`applyRolePermissions()`), Auditoren werden
weiterhin auf die Audit-Seiten umgeleitet. Die beiden PDF-Bestätigungsdialoge
(`#pdfConfirmText`/`#pdfVtConfirmText`) sind ebenfalls modusabhängig: neue
Funktion `updateAwPdfConfirmTexts()` (nutzt `awPeriodLabel()`) wird beim Öffnen
jedes Dialogs aufgerufen und formuliert „die angezeigte Woche (KW …)" bzw. „den
angezeigten Monat (…)"; der statische HTML-Text bleibt nur als Vor-JS-Fallback.
Die `<summary>` der Gruppe trägt bewusst `data-page="anwesenheiten"` (nicht
`"anwesenheiten-monatlich"`): sonst bekämen Haupt- **und** Unterpunkt „Monatlich"
gleichzeitig `.active` (blau). Der Alt-Hash `#anwesenheiten` wird in `showPage()`
ohnehin sofort auf `anwesenheiten-monatlich` umgeschrieben, d. h. `activeNavPage`
ist nie `"anwesenheiten"` → der Hauptpunkt bleibt in beiden Untermenü-Zuständen
weiß, die Ein-Klick-Navigation auf die Monatsansicht über den Hauptpunkt bleibt
aber erhalten (Klick setzt Hash `#anwesenheiten`).

Getestet: Backend per curl (von/bis, Monatskompat, Monatsgrenze, 400-Fälle,
Schreib-Roundtrip ohne Datenrest) und Frontend per Playwright (Menügruppe,
beide Modi, KW-Navigation, Alt-Hash-Redirect, PDF-Dialogtexte, Rollen-Sicht
Ausbilder/Bildungsstättenleiter, Haupt-/Unterpunkt-Highlighting inkl.
Stammdaten-Regression) – alles grün gegen den neu gestarteten Server auf
Port 3000.

**Davor:** Der Menüpunkt **Maßnahmetypen** ist jetzt
doch Administrator-only – die vorherige Session-Notiz weiter unten
("unbegründete Annahme, zurückgenommen") wurde durch eine explizite
Nutzeranfrage überholt. Umsetzung 1:1 nach dem `adminOnlyPages`-Muster wie
bei Fachbereiche/Workflows: `"massnahmetypen"` in `adminOnlyPages`
(`js/main.js`), Sidebar-Link + Stammdaten-Stat-Karte über `isAdmin` in
`applyRolePermissions()` ausgeblendet (Karte bekam dafür ihre
`id="stammdatenMassnahmetypenCard"` zurück). Backend: `POST`/`PUT`/`DELETE
/api/massnahmetypen(/:id)` jetzt mit `requireRole("Administrator")`
(vorher bei DELETE nur `isRestrictedUser`-Check). **Bewusst NICHT
angefasst:** `GET /api/massnahmetypen` bleibt für alle authentifizierten
Nutzer offen – das Maßnahmetyp-Dropdown in der Maßnahmen-Anlage/-Bearbeitung
wird von **allen** Rollen benötigt (nicht nur Administrator), ein
Admin-Lock auf GET hätte dieses unabhängige Feature für Nicht-Admins
kaputt gemacht. Per curl verifiziert: GET als Ausbilder weiterhin 200,
POST als Ausbilder jetzt 403. Die Löschen-Schaltfläche in der
Maßnahmetypen-Tabelle wird jetzt unconditional angezeigt (kein
`canDeleteMassnahmenOderTeilnehmer()`-Check mehr nötig, da die gesamte
Seite ohnehin nur für Administratoren sichtbar ist – exakt wie bei
Fachbereiche). Per Playwright verifiziert: Administrator voller Zugriff,
Bildungsstättenleiter/Ausbilder/Lehrgangsorganisation ausgeschlossen
(Sidebar, Stat-Karte, Hash-Redirect).

**Davor:** Neue Stammdaten-Entität
**Maßnahmetyp** (Sidebar-Unterpunkt "Maßnahmetypen" direkt nach "Maßnahmen",
eigene Stammdaten-Stat-Karte) mit den vier angefragten Feldern Bezeichnung,
Beschreibung, Kennung, Kürzel – Seitenaufbau/Formulare 1:1 nach dem
Fachbereich-Muster kopiert (Tabelle + einklappbares Neuanlage-Formular +
Bearbeiten-Dialog), nur Beschreibung zusätzlich als Textarea. `Massnahme`
hat jetzt eine optionale `MassnahmetypID`-Zuordnung (Dropdown „– kein
Maßnahmetyp –“ als leere Standardoption, analog zum bestehenden
Gruppe-Dropdown) in Neuanlage-Formular, Bearbeiten-Dialog und als neue
Tabellenspalte auf der Maßnahmen-Seite. **Bewusste Scoping-Entscheidung zu
Berechtigungen:** Ich hatte zunächst versucht, Maßnahmetyp wie Fachbereich
komplett Administrator-only zu machen (gleiche Grundstruktur: Bezeichnung/
Kürzel/Kennung) – das war aber eine unbegründete Annahme, da die Anfrage
keinerlei Rolleneinschränkung erwähnte. Zurückgenommen zugunsten des
Massnahme-Musters: `GET`/`POST`/`PUT` auf `/api/massnahmetypen` sind für
alle authentifizierten Nutzer offen (keine Fachbereichs-Scoping nötig, da
Maßnahmetyp global und nicht fachbereichsgebunden ist), `DELETE` verlangt
wie beim bestehenden `DELETE /api/massnahmen/:id` eine **uneingeschränkte**
Rolle (`isRestrictedUser(req)` → 403 für Ausbilder/Fachbereichsleiter,
alle anderen Rollen dürfen löschen) – kein Administrator-only-Lock. Ein
gelöschter Maßnahmetyp setzt `MassnahmetypID` bei betroffenen Maßnahmen
per `ON DELETE SET NULL` automatisch auf leer, statt das Löschen zu
blockieren. Da `massnahme` bereits Teil des `schema.sql`-Grundschemas ist
(nicht erst diese Session hinzugekommen), wurde die neue Spalte an
**beiden** Stellen ergänzt: `schema.sql` (Neuinstallation) und als
ALTER-TABLE-Fallback in `bootstrapDatabase()` (bereits laufende
Datenbanken) – exakt das bei `aktivitaet`/`dokument` dokumentierte Muster.

**Steckbrief erweitert:** Neue fünfte Stat-Karte "Maßnahmetyp" im
`steckbrief-meta-grid` neben Fachbereich/Gruppe/Maßnahme/VT
(`GET /api/teilnehmer` liefert jetzt zusätzlich `MassnahmetypBezeichnung`
über einen weiteren `LEFT JOIN massnahmetyp`). **Bewusst NICHT** angefasst:
alle anderen Maßnahme-bezogenen Dropdowns/Filter im Projekt (Teilnehmer-
Anlage/Bearbeiten, Anwesenheiten-Filter, Leistungskontrolle-Filter,
Teilnehmende-Tabelle) – die Anfrage nannte explizit nur "alle Anzeigen und
Fenster zu Maßnahmen" (verstanden als: die Maßnahmen-Verwaltung selbst) und
den Steckbrief als einzige zusätzliche, ausdrücklich genannte Stelle.

**Echter Datenfehler während des Testens verursacht und behoben:** Ein
`curl -d '{"Bezeichnung":"...für..."}'`-Befehl über die Bash-Shell hat den
Umlaut „ü" beim Speichern in der Datenbank irreversibel zum Unicode-
Replacement-Character (U+FFFD) korrumpiert (Encoding-Problem der
Shell-Weiterleitung, nicht des Servers) – sichtbar geworden erst im
Steckbrief-Screenshot einer echten Teilnehmerin ("Elektroniker/in f�r
Betriebstechnik"). Behoben durch erneutes PUT mit dem Payload aus einer
zuvor per Node.js geschriebenen, nachweislich korrekt UTF-8-kodierten
Datei (`--data-binary @datei.json` statt Inline-`-d`). **Lehre für
künftige Tests dieser Session:** Bei curl-Testdaten mit Umlauten/
Sonderzeichen niemals Inline-`-d '...'` über die Bash-Shell verwenden,
sondern den JSON-Body zuerst in eine Datei schreiben und deren korrekte
UTF-8-Bytes verifizieren, bevor sie per `--data-binary @datei` gesendet
wird – sonst droht stille, irreversible Datenkorruption an echten
(nicht nur Test-)Datensätzen. Alle Testdaten (Test-Maßnahmetyp,
Test-Maßnahme, versehentliche Maßnahmetyp-Zuweisung an eine echte
Maßnahme) wurden nach dem Test vollständig entfernt bzw. zurückgesetzt.

**Davor:** Die Maßnahmen-/VT-Zuordnung einer
Leistungskontrolle ist jetzt **nur noch beim Anlegen wählbar** und auf der
Bearbeiten-Seite (`page-leistungskontrollen-detail`) **schreibgeschützt**:
`lkDetailMassnahmenCheckboxes` (die frühere Checkbox-Gruppe mit allen
Maßnahmen zum An-/Abwählen) wurde durch ein einfaches `<p class="form-message"
id="lkDetailMassnahmenListe">` ersetzt, das nur die bei Anlage gewählten
Maßnahmen als Text auflistet (`Bezeichnung (VT)`, kommasepariert – exakt das
gleiche Format wie die "Zugewiesene VTs"-Spalte der Übersichtstabelle). Die
Zuordnung lässt sich dort nicht mehr an-/abwählen; das Label wurde um den
Hinweis "– bei Anlage festgelegt, nicht änderbar" ergänzt, damit klar ist,
warum keine Checkboxen mehr da sind. Der Speichern-Handler auf der
Detailseite sendet weiterhin `MassnahmeIDs` im PUT-Request (das Backend
verlangt laut `readLeistungskontrolleBody()` weiterhin mindestens eine
zugewiesene Maßnahme und würde sonst 400 zurückgeben) – **liest die IDs aber
jetzt aus `currentLkDetail.Massnahmen` statt aus Checkbox-Zustand**, sendet
also unverändert exakt das zurück, was beim Laden der Seite bereits
zugewiesen war. **Bewusst rein UI-seitig**, kein zusätzliches
Backend-`requireRole`/Validierungs-Lock auf `/api/leistungskontrollen/:id`
gegen eine Änderung der `MassnahmeIDs` – die Anfrage bezog sich auf "die
Bearbeiten-Seite", passend zum wiederholten Muster dieser Session
(Menü-/Seiten-Ebene, nicht Backend-Ebene). Per Playwright verifiziert:
0 Checkboxen auf der Detailseite, angezeigter Text stimmt exakt mit der
Anlage-Auswahl überein, bleibt nach dem Ändern eines anderen Felds (Speichern)
unverändert – sowohl auf der Detailseite als auch in der Übersichtstabelle.

**Davor:** Die "Zugewiesene Maßnahmen (VT)"-Auswahl
im **Neuanlage-Formular** von Leistungskontrollen (`page-leistungskontrollen`,
`lkMassnahmenCheckboxes`) ist jetzt ebenfalls einklappbar und durchsuchbar
(gleiches Muster wie zuvor bei der Formular-Auswahl je Arbeitsschritt in
Workflows), da mit vielen VTs zu rechnen ist. Zusätzlich werden bereits
**beendete Maßnahmen dort nicht mehr aufgeführt**: `buildLkMassnahmenCheckboxes()`
hat einen neuen Options-Parameter `{ nurAktive }`, der bei `true` alle
Maßnahmen mit `PlanEnde < heute` herausfiltert (`heutigesDatumIso()`-
Stringvergleich, da die DB-Verbindung `dateStrings: true` nutzt und
`PlanEnde` dadurch als reines `YYYY-MM-DD` vorliegt – lexikographischer
Stringvergleich funktioniert dafür korrekt). **Bewusst nur beim Anlegen,
nicht beim Bearbeiten:** Die Anfrage bezog sich explizit auf "beim Anlegen
einer neuen Leistungskontrolle" – die Maßnahmen-Auswahl auf der
Detail-/Bearbeiten-Seite (`lkDetailMassnahmenCheckboxes`) bleibt bewusst
unverändert (weder einklappbar/durchsuchbar noch nach beendeten Maßnahmen
gefiltert), damit eine bereits vor Jahren zugewiesene, inzwischen beendete
Maßnahme beim Öffnen einer alten Leistungskontrolle nicht plötzlich aus der
Liste verschwindet und stillschweigend mit-abgewählt werden könnte, sobald
gespeichert wird.

**Refactoring zu generischen CSS-/Verhaltens-Klassen:** Die beim
Workflows-Feature eingeführten, dort noch Formular-spezifisch benannten
Klassen `.formular-auswahl-anzahl`/`.formular-auswahl-suche` sowie die
Scroll-Begrenzung (`max-height` + `overflow-y: auto`) wurden zu generischen,
projektweit wiederverwendbaren Klassen `.checkbox-group-anzahl`/
`.checkbox-group-suche`/`.checkbox-group-collapsible .checkbox-group`
verallgemeinert (zweite Verwendung derselben UI-Kombination aus Details-
Element + Live-Anzahl-Badge + Suchfeld + scrollbarer Checkbox-Liste
innerhalb derselben Session – deshalb bewusst nicht noch ein drittes Mal
dupliziert, sondern jetzt gemeinsam genutzt). `.formular-auswahl-details`
bleibt als zusätzliche, rein Formular-spezifische Modifier-Klasse bestehen
(nur für die weiße Summary-Hintergrundfarbe nötig, weil diese eine Instanz
innerhalb des grau hinterlegten `.arbeitsschritt-block` verschachtelt ist –
die neue Maßnahmen-Auswahl bei Leistungskontrolle liegt dagegen direkt auf
weißem Seitenhintergrund und braucht diesen Override nicht). Per Playwright
getestet: Collapsible standardmäßig zu, beendete Testmaßnahme fehlt in der
Liste, Suche filtert korrekt (inkl. Null-Treffer-Fall), Auswahl übersteht
Such-Reset, Anzahl-Badge korrekt, nach Speichern werden Formular/Suchfeld/
Badge zurückgesetzt, Bearbeiten-Seite unverändert (zeigt weiterhin auch
beendete Maßnahmen, bleibt nicht-einklappbar).

**Davor:** Der Menüpunkt **Workflows** ist jetzt
**Administrator-only** statt für die zuvor drei Rollen (Administrator/
Bildungsstättenleiter/Fachbereichsleiter) sichtbar. Umgesetzt durch
**Konvergenz auf das bestehende `adminOnlyPages`-Muster** statt Beibehaltung
der bisherigen eigenen `WORKFLOW_ERLAUBTE_ROLLEN`/`canAccessWorkflows()`-
Konstrukte (die für eine Ein-Rollen-Liste nur unnötige Sonderlogik gewesen
wären): `"workflows"`/`"workflows-detail"` sind jetzt Teil des bereits
vorhandenen `adminOnlyPages`-Arrays (wie `"fachbereiche"`/`"benutzer"`/
`"einstellungen"`/`"systemlogs-dateioperationen"`), der bisherige eigene
Redirect-Guard in `showPage()` sowie `WORKFLOW_ERLAUBTE_ROLLEN`/
`canAccessWorkflows()` wurden komplett entfernt (nicht nur ungenutzt liegen
gelassen), Sidebar-Link/Stammdaten-Karte nutzen jetzt direkt die in
`applyRolePermissions()` ohnehin schon berechnete `isAdmin`-Variable (exakt
das Muster von `stammdatenFachbereicheCard`), und `loadStammdatenStats()`
prüft jetzt `currentUser.roles.includes("Administrator")` direkt statt über
die entfernte Hilfsfunktion. **Weiterhin bewusst nur UI-seitig** – keine
`requireRole()`-Ergänzung auf `/api/workflows/*` (Backend blieb unverändert),
da die Anfrage sich explizit auf den *Menüpunkt* bezog, exakt wie bei den
beiden vorherigen Rollen-Sichtbarkeits-Entscheidungen dieser Session. Getestet
per Playwright: Administrator weiterhin voller Zugriff, die zuvor
zugelassene Bildungsstättenleiter-Rolle jetzt korrekt ausgeschlossen
(Sidebar, Stammdaten-Karte, Hash-Redirect für `#workflows` **und**
`#workflows-detail`), Ausbilder/Lehrgangsorganisation weiterhin
ausgeschlossen.

**Davor:** Die "Zugeordnete Formulare"-Auswahl je
Arbeitsschritt (Workflows-Feature) ist jetzt standardmäßig **eingeklappt**
(natives `<details class="collapsible-form formular-auswahl-details">`,
gleiches "+"/"–"-Muster wie die bestehenden "Neues X"-Formulare) und hat ein
**Suchfeld** (`buildFormularAuswahlBlock()` in `js/main.js`), da mit sehr
vielen Formularen zu rechnen ist. Das Suchfeld filtert die Checkbox-Zeilen
rein client-seitig per `element.style.display` gegen einen Titel-Lowercase-
Vergleich (`row.dataset.titel`, in `buildFormularAuswahl()` gesetzt) – keine
Server-Suche nötig, da `workflowFormulareCache` ohnehin komplett im Speicher
liegt. Bereits angehakte Formulare bleiben beim Filtern **im DOM erhalten**
(nur visuell versteckt, nicht entfernt) – eine Auswahl geht also nie verloren,
nur weil sie gerade nicht zum Suchbegriff passt. Die Summary-Zeile zeigt
zusätzlich eine Live-Anzahl **"(N ausgewählt)"** (`.formular-auswahl-anzahl`,
aktualisiert bei jedem `change`-Event auf der Checkbox-Gruppe), damit die
Auswahl auch im eingeklappten Zustand ohne Aufklappen erkennbar bleibt –
per Playwright verifiziert, dass die Zahl nach dem Neuladen eines
bestehenden Workflows korrekt angezeigt wird, **ohne** das Element
aufzuklappen. Zusätzlich hat die Checkbox-Liste selbst jetzt eine feste
Maximalhöhe mit Scroll (`.arbeitsschritt-formulare { max-height: 220px;
overflow-y: auto; }`), als zweite Abhilfe gegen sehr lange Listen neben der
Suche. **Layout-Detail:** Die `summary` bekam eine explizit weiße
Hintergrundfarbe (`.formular-auswahl-details summary`), weil die
projektweite `.collapsible-form summary`-Farbe (`--color-bg-light`) sonst mit
dem grauen Hintergrund des umgebenden `.arbeitsschritt-block` verschmolzen
und die Pille optisch verschwunden wäre – erster Fall in diesem Projekt, in
dem ein `.collapsible-form` innerhalb eines bereits grau hinterlegten
Containers verschachtelt ist.

**Davor:** Neuer Menüpunkt **Workflows** als
Unterpunkt von Stammdaten (Sidebar + Stammdaten-Stat-Karte, gleiches
Rollen-Gating wie Formulare: nur Administrator, Bildungsstättenleiter und
Fachbereichsleiter – `WORKFLOW_ERLAUBTE_ROLLEN`/`canAccessWorkflows(user)`
in `js/main.js`, 1:1 nach dem `FORMULARE_ERLAUBTE_ROLLEN`-Vorbild, bewusst
als eigene Konstante statt Wiederverwendung der Formulare-Variable – auch
wenn die Rollenliste aktuell identisch ist, könnten beide Features künftig
unabhängig voneinander angepasst werden). **Bewusst wieder rein UI-seitig**
(Sidebar/Karte ausgeblendet + Hash-Redirect in `showPage()` für `workflows`
UND `workflows-detail`), keine Backend-Sperre auf `/api/workflows/*` – exakt
dieselbe Entscheidung wie bei Formulare und zuvor bei Leistungskontrolle/
Lehrgangsorganisation, da die Anfrage wortgleich "soll nur ... zugänglich
sein" lautete.

Löst die ursprünglich zurückgestellte Anfrage ein ("Workflows werden später
implementiert, ebenso Arbeitsschritte") und implementiert **sowohl** Workflows
**als auch** Arbeitsschritte jetzt vollständig, exakt nach der in dieser
Anfrage gegebenen konkreten Spezifikation. Ein Workflow hat eine eigene,
eindeutige, **user-eingegebene** `Kennung` (VARCHAR, `UNIQUE`-Constraint in
der DB, anders als das bestehende, nicht-eindeutige `Kennung`-Feld bei
Fachbereich/Gruppe – bei Verstoß liefert der Server `400 "Kennung ist bereits
vergeben (Workflow oder Arbeitsschritt)"`, `ER_DUP_ENTRY` abgefangen wie beim
Benutzernamen), zusätzlich QM-Kennung/Bezeichnung/Beschreibung und eine
Zuordnung zu einer oder mehreren **Rollen** (`workflow_rolle`, Checkbox-Gruppe
aus `/api/rollen`). **Bewusste Scoping-Entscheidung bei Arbeitsschritten:**
Die ursprüngliche, sehr frühe Anfrage hatte formuliert "Arbeitsschritte können
mehreren Workflows zugewiesen werden" (echte Many-to-many-Wiederverwendung) –
die jetzige, konkrete UI-Spezifikation beschreibt Arbeitsschritte aber
ausschließlich als direkt in der Workflow-Bearbeitung per "+"-Button neu
angelegte, workflow-eigene Listenelemente (keine "bestehenden Arbeitsschritt
auswählen"-Funktion irgendwo angefragt). Da eine Many-to-many-Tabelle ohne
jede Picker-UI zur Wiederverwendung eine nicht erreichbare/unfertige
Fähigkeit gewesen wäre, wurde bewusst die einfachere Variante gebaut:
`arbeitsschritt.WorkflowID` ist ein direkter FK (`ON DELETE CASCADE`), jeder
Arbeitsschritt gehört genau einem Workflow. Falls eine spätere Session
Arbeitsschritt-Wiederverwendung über mehrere Workflows hinweg **mit** einer
entsprechenden Auswahl-UI ergänzen soll, wäre das eine bewusste
Schema-Änderung (Join-Tabelle `workflow_arbeitsschritt` statt der direkten
FK) – nicht einfach nachträglich draufsetzen.

**Arbeitsschritt-Felder:** eigene eindeutige `Kennung` (ebenfalls `UNIQUE` in
der DB, zusätzlich serverseitig auch **innerhalb eines einzelnen Speicher-
Vorgangs** auf Duplikate geprüft, damit zwei gleichzeitig neu angelegte
Arbeitsschritte mit derselben Kennung eine klare Fehlermeldung statt eines
rohen DB-Fehlers liefern), QM-Kennung, Bezeichnung, Beschreibung,
`Reihenfolge` (INT, ergibt sich aus der Position beim Speichern – siehe
unten), `VerantwortungRolleID` (optionales Dropdown aus `/api/rollen`,
FK `ON DELETE SET NULL`, damit ein späteres Löschen einer Rolle – aktuell
ohnehin keine Lösch-Funktion im Projekt vorhanden – nicht an bestehenden
Arbeitsschritten scheitert), Zuordnung zu einem/mehreren/**allen**
Fachbereichen (`arbeitsschritt_fachbereich`, Pflichtfeld – mindestens einer –
mit der bereits für Formulare gebauten "Alle Fachbereiche"-Select-all-
Checkbox aus `buildCheckboxGroup({ selectAllLabel })` wiederverwendet) sowie
Zuordnung zu einem oder mehreren **Formularen** (`arbeitsschritt_formular`,
optional). Formulare werden dabei nicht als reine Checkbox-Liste, sondern als
Checkbox **plus** kleinem Download-Icon-Link (`buildFormularAuswahl()`,
`/api/formulare/:id/datei`) je Zeile dargestellt, wie explizit angefragt
("als Link zum Download des Formulars dargestellt").

**Reihenfolge/Reordering rein DOM-basiert, bewusst ohne Zwischenspeicher-
Array:** Jeder Arbeitsschritt ist ein `.arbeitsschritt-block`-Element im
DOM; die Pfeil-Buttons vertauschen beim Klick direkt den ganzen Block mit
seinem Vorgänger/Nachfolger (`insertBefore`), der "+"-Button hängt einen
neuen leeren Block ans Ende, der Papierkorb-Button entfernt einen Block –
in allen drei Fällen läuft anschließend nur `renumberArbeitsschritte()`
(aktualisiert die sichtbare "Arbeitsschritt N"-Beschriftung). Die tatsächliche
Reihenfolge beim Speichern ergibt sich einfach aus der **DOM-Reihenfolge**
(`container.querySelectorAll(".arbeitsschritt-block")`), nicht aus einem
separat mitgeführten JS-Array – das vermeidet jede State-Sync-Problematik
(insbesondere gehen beim Verschieben keine bereits eingetippten Feldwerte
verloren, da ganze DOM-Knoten bewegt werden, keine Werte kopiert werden).

**Speichern ersetzt Arbeitsschritte komplett (kein Delta-Update):** Sowohl
beim Anlegen als auch beim Bearbeiten eines Workflows sendet das Frontend die
**vollständige** aktuelle Arbeitsschritt-Liste; `PUT /api/workflows/:id`
löscht serverseitig zunächst alle bestehenden Arbeitsschritte des Workflows
(Cascade entfernt automatisch auch deren Fachbereichs-/Formular-Zuordnungen)
und fügt danach die komplette neue Liste frisch ein – exakt das bereits
etablierte Muster bei allen anderen Zuordnungstabellen in diesem Projekt
(`formular_fachbereich`, `leistungskontrolle_massnahme`, …), hier nur einen
Schritt tiefer auf eine echte Tabelle mit eigenen Kind-Datensätzen
angewendet. Folge: Arbeitsschritt-IDs sind über Bearbeitungen hinweg **nicht**
stabil (jeder Speichervorgang vergibt neue IDs) – unproblematisch, da nichts
im Projekt dauerhaft auf eine einzelne Arbeitsschritt-ID von außen verweist.

**Master-Detail-Architektur** (wie angefragt): `page-workflows` (Tabelle +
Header-Button "+ Neuer Workflow") und `page-workflows-detail` (volle
Unterseite, **kein** Dialog – bei der Komplexität der Arbeitsschritt-Liste
mit mehreren verschachtelten Checkbox-Gruppen pro Zeile wäre ein Dialogfenster
zu eng gewesen) sind eine gemeinsame Detailseite für **sowohl** Neuanlage
als auch Bearbeiten, exakt nach dem `leistungskontrollen`/
`leistungskontrollen-detail`-Vorbild (`currentWorkflowId`/`openWorkflowDetail()`/
`loadWorkflowDetailPage()`). **Wichtiger Unterschied zum LK-Vorbild:** Bei
Leistungskontrolle ist `currentLkId === null` kein gültiger Zustand für die
Detailseite (Redirect zurück zur Liste), bei Workflows dagegen **ist**
`currentWorkflowId === null` der reguläre "Neuer Workflow"-Zustand (der
Button in der Kopfzeile navigiert genau dorthin) – dieser Guard wurde bewusst
NICHT übernommen. Titel/Sichtbarkeit des Löschen-Buttons wechseln abhängig
davon, ob ein Workflow geladen ist (`fillWorkflowDetailForm(null)` vs. mit
Daten). Anders als bei Formulare/Leistungskontrolle lädt die Übersichtsseite
ihre Liste **nicht** einmalig beim Login, sondern nach dem etablierten
`ensureLkInitialized()`-Muster bei **jedem** Seitenaufruf neu
(`ensureWorkflowsInitialized()`: Fachbereichs-/Formulare-/Rollen-Caches nur
einmalig, aber `loadWorkflows()` bei jedem Besuch) – nötig, weil Anlegen/
Bearbeiten auf einer **separaten** Unterseite passiert (anders als bei
Formulare, wo Bearbeiten über einen Dialog auf derselben Seite läuft und die
Tabelle danach ohnehin sofort neu lädt); ohne das würde die Liste nach einem
Rücksprung von der Detailseite veraltete Daten zeigen.

**Echter, beim Testen gefundener und behobener CSS-Bug:** Die neuen
Pfeil-/Papierkorb-Icon-Buttons je Arbeitsschritt (`class="icon-btn"`) wurden
zunächst als große blaue Pillen-Buttons dargestellt statt als kleine dezente
Icon-Buttons. Ursache: `.data-form button` (Spezifität 0,1,1) hat Vorrang vor
`.icon-btn` (Spezifität 0,1,0) – dieses Kollisionsproblem war bisher latent,
weil noch nie zuvor ein `.icon-btn` innerhalb eines `.data-form` verschachtelt
war. Fix: `.arbeitsschritt-block-actions button.icon-btn { … }` mit höherer
Spezifität überschreibt `.data-form button` gezielt nur in diesem Kontext.
**Lehre:** Bei Verschachtelung eines bestehenden, bisher nur in einem anderen
Kontext genutzten Buttons/Klasse immer per Screenshot prüfen, ob eine
allgemeinere übergeordnete Regel (hier `.data-form button`) durchschlägt –
nicht nur auf die eigene neue Klasse vertrauen.

Kompletter Workflow (Anlegen inkl. zwei Arbeitsschritten mit "Alle
Fachbereiche" und Formular-Zuordnung, Verschieben per Pfeil in beide
Richtungen, Speichern, Zurück zur Liste, erneutes Öffnen mit Prüfung der
korrekt geladenen/sortierten Arbeitsschritte, Löschen) sowie die
Rollen-Zugriffsbeschränkung (Administrator/Bildungsstättenleiter erlaubt,
Ausbilder-only/Lehrgangsorganisation gesperrt, inkl. Hash-Redirect-Test für
sowohl `#workflows` als auch `#workflows-detail`) wurden per Playwright
getestet. Backend zusätzlich per curl geprüft: doppelte Workflow-Kennung
→ 400, doppelte Arbeitsschritt-Kennung **innerhalb desselben Payloads** → 400,
Update mit reduzierter Arbeitsschritt-Anzahl, Löschen.

**Davor:** Neue eigenständige Seite
**`praesentation.html`** (Feature-Übersicht) – erreichbar über einen Klick
auf das Standortmanager-Logo oben links in der Topbar (`index.html`, war
vorher ein funktionsloser `href="#"`-Link; jetzt `href="praesentation.html"
target="_blank"`, öffnet in einem neuen Tab wie das bestehende
Vorschau-Fenster). Gleiches Architekturmuster wie `dokument-vorschau.html`:
eine eigenständige HTML-Datei außerhalb des SPA-Hash-Routings, lädt
`css/style.css` (für Design-Tokens/Farben/Schrift) plus eine eigene
`css/praesentation.css`, eigenes Script `js/praesentation.js`, eigene
Express-Route `app.get("/praesentation.html", ...)` neben der bestehenden
Route für die Dokumentvorschau. **Bewusst ohne Login-Pflicht** (keine
`requireAuth`, da `/praesentation.html` außerhalb von `/api` liegt und die
Seite ohnehin keine einzige API abfragt – rein statischer Inhalt, unbedenklich
auch ohne Session erreichbar).

Zeigt neun von mir ausgewählte Kernfunktionen als Karten
(`.feature-card`, 3-spaltiges responsives Grid) mit je einem selbst
gezeichneten, farbigen Icon in einem runden Farbkreis (`.feature-icon`,
keine externen Bilddateien – konsistent mit der "kein Build-Tooling,
keine Fremdbilder"-Philosophie des Projekts, gleiche
Inline-SVG-Outline-Technik wie die bestehenden UI-Icons, nur größer
und mit Farbfläche), Titel und Kurzbeschreibung. Ein Klick auf eine Karte
öffnet ein `<dialog class="confirm-dialog wide-dialog feature-dialog">`
(„Unterfenster") mit größerem Icon, Titel und einem längeren, teils mit
Aufzählungen versehenen Erklärungstext – Inhalte kommen aus einem
statischen `FEATURES`-Array in `js/praesentation.js`, keine Datenbank-
Anbindung nötig. Dialog schließt sowohl über einen „Schließen"-Button als
auch per Klick auf den Backdrop. Ausgewählte Features: Teilnehmenden-
verwaltung, Anwesenheitserfassung, Leistungskontrollen & Notenverlauf,
Teilnehmersteckbrief, Formulare, Dokumentenverwaltung, Rollen & Rechte,
Audit-Bereich, Systemlogs. **Lehre direkt angewendet:** Der
„Zurück zur Anwendung"-Link in der Kopfzeile wurde bewusst NICHT als
nacktes `class="btn-secondary"` gesetzt (der mehrfach in dieser Datei
dokumentierte Layout-Bug bei freistehenden `.btn-secondary`/`.btn-primary`
außerhalb von `.dialog-actions`/`.detail-actions`), sondern bekam von
Anfang an eine eigene, vollständige CSS-Klasse `.praes-zurueck` statt
nachträglich einen Wrapper zu brauchen. Per Playwright getestet (Klick aufs
Logo öffnet neuen Tab, alle 9 Karten haben Icon+Titel+Inhalt, Dialog öffnet/
schließt korrekt über Button und Backdrop, „Zurück zur Anwendung" verlinkt
auf `index.html`).

**Davor:** Der Menüpunkt **Formulare** ist jetzt nur
für die Rollen Administrator, Bildungsstättenleiter und Fachbereichsleiter
sichtbar/nutzbar (`FORMULARE_ERLAUBTE_ROLLEN` + `canAccessFormulare(user)`
in `js/main.js`) – für Ausbilder, Lehrgangsorganisation und Auditor ist
sowohl der Sidebar-Link als auch die Stammdaten-Übersichtskarte
(`stammdatenFormulareCard`) ausgeblendet, und eine direkte Hash-Navigation
`#formulare` wird in `showPage()` auf das Dashboard umgeleitet – exakt
dasselbe Muster wie beim bestehenden Ausblenden von „Leistungskontrolle" für
Lehrgangsorganisation. **Bewusst rein UI-seitig, keine Backend-Sperre**:
Die Formulierung der Anfrage ("Der Menüpunkt … soll nur … nutzbar sein")
entspricht wortgleich dem Muster der bereits früher in dieser Session
getroffenen Entscheidung beim Leistungskontrolle/Lehrgangsorganisation-Fall
(dort ebenfalls ausdrücklich nur UI-seitig umgesetzt, Backend-API bewusst
nicht eingeschränkt) – falls zusätzlich eine serverseitige Zugriffssperre
auf `/api/formulare/*` gewünscht ist (z. B. `requireRole("Administrator",
"Bildungsstättenleiter", "Fachbereichsleiter")` analog zu den bestehenden
`requireRole(...)`-Gates), müsste das separat angefragt werden. Zusätzlich
wurden die beiden Stellen angepasst, die `/api/formulare` bisher
unconditional für **jeden** angemeldeten Nutzer aufgerufen haben (sonst hätte
ein ausgeschlossener Nutzer beim Login bzw. auf der Stammdaten-Übersicht
unnötige Fetches gemacht): Der eager-Load in `initializeApp()`
(`loadFormularFormOptions()`/`loadFormulare()`) läuft jetzt nur noch, wenn
`canAccessFormulare(currentUser)` zutrifft (gleiches Muster wie der
bestehende `if (currentUser.roles.includes("Administrator"))`-Block für
Benutzer-Daten direkt darunter), und `loadStammdatenStats()` lässt den
`/api/formulare`-Kennzahl-Fetch für ausgeschlossene Rollen weg (zeigt dort
direkt „–" statt einen Request zu schicken, der ohnehin nichts anzeigen
dürfte). Getestet per Playwright mit vier Rollen-Kombinationen (Administrator,
Bildungsstättenleiter, Ausbilder-only, Lehrgangsorganisation) gegen
vorhandene Testkonten aus einer früheren Session (`VB`/`LO`/`Ausbilder`) –
deren Passwörter wurden dafür kurzzeitig auf `TestPass123!` zurückgesetzt
(sind erkennbar synthetische Testkonten mit `.test`-E-Mail-Adressen, keine
echten Nutzer); falls diese Konten noch gebraucht werden, bitte das Passwort
beachten oder erneut zurücksetzen.

**Davor:** Zwei kleine Nachbesserungen am
Formulare-Feature. **Erstens:** Der Button „Ersetzen" im Bearbeiten-Dialog
steht jetzt in derselben `.dialog-actions`-Zeile wie „Abbrechen"/„Speichern"
(ganz links, analog zum bestehenden Muster bei der Leistungskontrolle-
Detailseite, wo „Löschen" ebenfalls als zusätzlicher Button links von
„Abbrechen"/„Speichern" im selben `.dialog-actions`-Container steht) – der
vorherige eigene `.detail-actions`-Wrapper darüber wurde entfernt.
**Zweitens:** `buildCheckboxGroup()` (die generische Checkbox-Gruppen-
Hilfsfunktion in `js/main.js`, projektweit für Rollen/Fachbereiche/
Maßnahmen-Zuordnungen verwendet) hat jetzt einen optionalen Parameter
`selectAllLabel`; wenn gesetzt, wird eine „Alle …"-Checkbox vor den
einzelnen Einträgen eingefügt (visuell abgesetzt durch eine untere
Trennlinie, `.checkbox-group-select-all` in `css/style.css`), die beim
Anklicken alle Einträge auf denselben Zustand setzt und selbst
`indeterminate` wird, sobald nur ein Teil der Einträge angehakt ist.
`getCheckedValues()` filtert die Select-all-Checkbox über
`dataset.selectAll` heraus, damit sie nie fälschlich als eigener
(nicht-existenter) ID-Wert mit übertragen wird. **Bewusst nur für die
Formular-Fachbereichszuordnung aktiviert** (beide Checkbox-Gruppen: das
Neuanlage-Formular und der Bearbeiten-Dialog, inkl. der Zurücksetzen-Stelle
nach erfolgreichem Speichern) – die Funktion selbst ist zwar jetzt generisch
nutzbar, wurde aber bei den bestehenden Aufrufstellen (Benutzer-Rollen/
-Fachbereiche, Leistungskontrolle-Maßnahmen) nicht angefasst, da nur die
Formular-Fachbereichszuordnung angefragt wurde; bei Bedarf dort einfach
`selectAllLabel: "..."` ergänzen. Beides per Playwright getestet
(Select-all checkt/uncheckt alle Fachbereiche, wird bei Teilauswahl
indeterminate, das Speichern mit „Alle Fachbereiche" aktiviert überträgt
korrekt alle echten Fachbereich-IDs ohne Phantom-Wert, die drei
Dialog-Buttons liegen auf identischer Y-Position).

**Davor:** Der beim Formular-Upload gespeicherte
`Dateiname` (die Spalte, die in der Tabelle angezeigt und als
Download-Dateiname vorgeschlagen wird) wird jetzt serverseitig generiert
statt den Original-Dateinamen der hochgeladenen Datei zu übernehmen: Format
`{Titel} v{Version} {TT.MM.JJJJ}.{Endung}` (`buildFormularDateiname()` in
`server.js`, Datum = Uploadzeitpunkt, Endung aus dem Original-Dateinamen).
Neue Spalte `formular.Version` (INT, Default 1, per ALTER-TABLE-Fallback
wie bei `benutzer.Aktiv` auch für die bereits laufende Datenbank dieser
Session nachgezogen) startet bei 1 und wird nur beim **Ersetzen** der Datei
automatisch hochgezählt – ein reines Bearbeiten der Metadaten (`PUT`) ändert
die Version nicht. Neuer Endpunkt `POST /api/formulare/:id/ersetzen`
(multipart, gleiches manuelles `multer`-Wrapping wie beim Anlegen) lädt die
neue Datei hoch, erhöht `Version`, generiert den neuen `Dateiname` (nutzt
dabei den **bestehenden** Titel aus der DB, nicht den Original-Dateinamen
der neuen Datei) und löscht anschließend die alte Datei von der Platte
(`GespeicherterDateiname`, weiterhin ein UUID-Dateiname – nur der
Anzeige-`Dateiname` trägt Titel/Version/Datum, nicht der tatsächliche
Dateiname auf der Platte). Es wird bewusst **keine** Versionshistorie
geführt – jede vorherige Datei wird beim Ersetzen unwiderruflich gelöscht,
genau wie beim Unternehmens-Logo-Upload; falls künftig eine Historie
gewünscht ist, wäre das eine separate Anfrage. Berechtigungen für den
Ersetzen-Endpunkt entsprechen exakt dem bestehenden `PUT`
(Fachbereichs-Scoping für eingeschränkte Rollen, **kein**
Administrator-Gate) – anders als beim `DELETE`, das Administrator-only
bleibt.

Der neue Button **„Ersetzen"** sitzt im Bearbeiten-Dialog
(`editFormularDialog`, aktuell die einzige Detail-/Bearbeitenansicht dieses
Features – es gibt keine eigene Subpage wie bei Leistungskontrolle) unter
einer schreibgeschützten Anzeige des aktuellen `Dateiname`s, öffnet einen
versteckten `<input type="file">` und lädt bei Dateiauswahl sofort hoch
(kein zusätzlicher Bestätigungsdialog – im Projekt wird für destruktive
Aktionen zwar sonst ein Tipp-Bestätigungsdialog verwendet, aber das war
nicht Teil der Anfrage und der native Datei-Auswahldialog ist bereits ein
bewusster Nutzerschritt). **Layout-Stolperfalle wieder aufgetreten und
sofort behoben:** Der Button wurde zunächst als nacktes `class="btn-secondary"`
direkt in einem `.form-row` platziert – exakt derselbe Bug wie beim
PDF-Bericht-Button im Steckbrief weiter unten in dieser Datei dokumentiert
(`.btn-secondary` liefert außerhalb von `.dialog-actions`/`.detail-actions`
nur Farben, keine Rundung/Padding). Fix: Button in einen
`<div class="detail-actions">`-Wrapper verschoben. **Lehre bestätigt:** Bei
jedem neuen freistehenden Button in diesem Projekt sofort einen der
bestehenden Container (`.dialog-actions`, `.detail-actions`) verwenden,
nicht erst hinterher als Bug entdecken.

Kompletter Workflow (Anlegen → Dateiname zeigt „v1" + heutiges Datum,
Bearbeiten-Dialog öffnen → aktuelle Datei sichtbar, Ersetzen → Version wird
zu „v2", danach nochmal ersetzt → „v3", Tabelle aktualisiert sich, Vorschau
nach dem Ersetzen lädt weiterhin korrekt die neue Datei, alte Datei wird von
der Platte entfernt) wurde per Playwright getestet.

**Davor:** Neuer Menüpunkt **Formulare** als
Unterpunkt von Stammdaten (Sidebar-Link + eigene Stat-Karte auf der
Stammdaten-Übersicht, eager beim Login geladen wie Fachbereich/Gruppe/
Maßnahme – kein Lazy-`ensureXInitialized()`-Gate). Verwaltet hochladbare
Formular-Vorlagen (PDF/Word/Excel) mit eindeutiger DB-ID, QM-Kennung, Titel,
Beschreibung und Zuordnung zu einem oder mehreren Fachbereichen
(Many-to-many über neue Tabelle `formular_fachbereich`, exakt nach dem
`leistungskontrolle_massnahme`-Muster: `attachFachbereicheZuFormularen()`
macht einen einzigen `IN (?)`-Query + JS-seitiges Gruppieren statt
N+1-Queries). **Bewusste Scoping-Entscheidung:** Die Anfrage endete mit dem
Satz "Workflows werden später implementiert, ebenso Arbeitsschritte" –
daraus wurde geschlossen, dass diese Session **nur** die Formulare-Verwaltung
gebaut wird. Workflows und Arbeitsschritte (eigene Entitäten mit Kennung/
QM-Kennung/Bezeichnung/Beschreibung, Many-to-many Arbeitsschritt↔Workflow)
wurden komplett weggelassen – keine Tabellen, keine Felder, **kein**
Workflow-Zuordnungsfeld/-Dropdown auf Formular (ein leeres Stub-Dropdown
ohne Daten wäre ein halbfertiges Feature gewesen). Diese Entscheidung wurde
dem Nutzer vor Beginn der Umsetzung explizit mitgeteilt. **Für eine künftige
Session, die Workflows/Arbeitsschritte nachträgt:** Formular braucht dann
zusätzlich eine Many-to-many-Zuordnung zu Workflow, analog zum bestehenden
Fachbereich-Muster (neue Join-Tabelle `formular_workflow`, gleiches
Checkbox-Group-UI wie bei den Fachbereichen).

Datei-Uploads laufen wie beim Unternehmens-Logo über `multer` mit manuellem
`upload.single("Datei")(req, res, callback)`-Wrapping für saubere
JSON-Fehlermeldungen, hier aber diskbasiert (nicht `memoryStorage`) mit
`crypto.randomUUID()`-Dateinamen (+ Original-Endung) in `server/formulare/`
(neu in `.gitignore`, außerhalb der `express.static`-Allowlist, nur über
eigene, authentifizierte Routen erreichbar – wie alle Uploads in diesem
Projekt). Erlaubt sind bewusst nur PDF/DOC/DOCX/XLS/XLSX
(`FORMULAR_ERLAUBTE_MIMETYPES`, serverseitiger `fileFilter`), 20 MB Limit;
Bildformate/SVG sind hier kein Thema, da es sich um Dokument-Vorlagen und
keine Logos handelt. `PUT /api/formulare/:id` ändert bewusst nur Metadaten
und Fachbereichszuordnung, **kein** Datei-Ersatz (nicht Teil der Anfrage –
zum Austauschen der Datei müsste aktuell das Formular neu angelegt werden).
`DELETE` ist Administrator-only, wie bei anderen kritischen
Löschoperationen im Projekt (z. B. Unternehmens-Logo).

Vorschau/Download nutzen bewusst **keine** zweite Implementierung: Die
bestehende `dokument-vorschau.html`/`js/dokument-vorschau.js` (bisher nur
für Teilnehmer-Dokumente) wurde um einen Query-Parameter `typ=formular|
dokument` erweitert, der nur die API-Basis-URL umschaltet (`/api/formulare`
vs. `/api/dokumente`) – die komplette PDF-/Bild-/DOCX-/XLSX-Rendering-Logik
bleibt eine einzige gemeinsame Implementierung statt einer Kopie.

Kompletter Workflow wurde sowohl per API (curl: Anlegen mit mehreren
Fachbereichen, Liste, Download-/Vorschau-Header, ungültiger Dateityp → 400,
Bearbeiten inkl. Fachbereichs-Reduzierung, Löschen) als auch end-to-end per
Playwright im echten Browser getestet (Formular über das reale Formular
inkl. Datei-Upload anlegen, Tabellenanzeige prüfen, Vorschau öffnet in
neuem Tab und rendert das PDF tatsächlich sichtbar, Bearbeiten-Dialog mit
vorausgefüllten Werten, Download-Link-Attribut, Löschen mit
Bestätigungsdialog) – alle Testdaten wurden danach wieder entfernt.
**Lehre (Testumgebung, kein Projekt-Code):** In dieser Windows/Git-Bash-
Sandbox scheiterte ein `curl -F "Datei=@/tmp/datei.txt"`-Multipart-Upload
beim Lesen der Datei aus `/tmp/`, obwohl dieselbe Datei per `cat` normal
lesbar war – kein Server-Bug, sondern ein Pfad-Eigenheit dieser Umgebung.
Fix: Testdateien für curl-Multipart-Uploads künftig im Scratchpad-Verzeichnis
statt unter `/tmp/` ablegen.

**Davor:** Dieselbe Layout-Korrektur wie beim
PDF-Button auch für die "Zur Aktivität"-Buttons in der Aktivitäten-Liste des
Teilnehmersteckbriefs: statt eines nackten `class="btn-secondary"` jetzt
umschlossen von einem `<div class="detail-actions">`-Wrapper (das bestehende
Muster für Aktionsbuttons in Detailansichten, z. B. "Vorschau"/
"Herunterladen" im Dokument-Detailpanel) – dadurch jetzt korrekt abgerundete
Pillenform statt eckigem, unstyled Button. **Bewusst nicht angefasst:** die
"← Zurück zu ..."-Buttons in den `.subpage-header`-Bereichen – die nutzen
projektweit (auch auf allen älteren Unterseiten wie Aktivitätenverlauf/
Dateiablage, nicht nur meinen neuen) ebenfalls nacktes `class="btn-secondary"`
und sehen dadurch bewusst schlicht/textartig statt als Pillen-Button aus;
das ist ein bestehendes, konsistentes App-weites Muster für Zurück-Links,
keine dieser Session zuzuschreibende Inkonsistenz – nur auf explizite Anfrage
mit-ändern, nicht von mir aus.

**Davor:** Der Button "Bericht als PDF anzeigen" im
Teilnehmersteckbrief nutzt jetzt `class="report-btn"` in einem
`<div class="report-actions">`-Wrapper statt eines nackten
`class="btn-primary"` – das ist das bestehende, auf der Anwesenheiten-Seite
etablierte Muster für PDF-Berichts-Buttons ("PDF-Bericht erstellen"/
"PDF-Bericht je VT erstellen"). **Ursache des ursprünglichen Layout-Bugs:**
`.btn-primary` liefert in `style.css` für sich allein nur Hintergrund-/
Textfarbe – Padding, Rundung (`--radius-lg`) und Fettschrift kommen aus
kontextabhängigen Selektoren wie `.dialog-actions .btn-primary` oder
`.detail-actions .btn-primary`. Ein `.btn-primary`-Button **außerhalb** dieser
Container (wie der PDF-Button, der direkt im Seitenfluss stand) bekommt
dadurch nur die Farben, aber keine der übrigen Button-Eigenschaften – sah
entsprechend unfertig/inkonsistent aus. **Lehre:** `.btn-primary`/
`.btn-secondary` sind in diesem Projekt keine eigenständigen, vollständigen
Button-Klassen, sondern nur Farb-Modifier, die einen umschließenden Container
(`.dialog-actions`, `.detail-actions`) oder eine eigene Basis-Klasse wie
`.report-btn` brauchen, um korrekt auszusehen – bei einem freistehenden
Button immer prüfen, welcher bestehende Container/welche Klasse für diesen
Anwendungsfall (hier: PDF-Bericht-Button) bereits existiert, statt
`.btn-primary` direkt auf ein freistehendes `<button>` zu setzen.

**Davor:** Die sechs Zeilen-Icons auf der
Teilnehmende-Seite (Steckbrief, Aktivitäten, Dateiablage, Notenverlauf,
Bearbeiten, Löschen) haben jetzt zusätzlich zum bestehenden `aria-label`
(nur für Screenreader) ein natives `title`-Attribut mit kurzem Funktionsnamen
(z. B. "Steckbrief", "Notenverlauf") – zeigt den Browser-Standard-Tooltip
beim Hover. Bewusst kurz gehalten (nur die Funktion, nicht zusätzlich der
Name der Zeile wie im `aria-label`), da der Zeilenkontext beim Hovern bereits
sichtbar ist. **Scope:** Nur die Teilnehmende-Tabelle wurde angefasst, wie
angefragt – andere Tabellen im Projekt (Fachbereiche/Gruppen/Maßnahmen/
Dokumente/Benutzer/Leistungskontrollen) haben weiterhin nur `aria-label` ohne
`title`; falls das dort auch gewünscht ist, müsste es separat nachgezogen
werden.

**Davor:** Die Feiertags-/Wochenend-Darstellung aus
dem Teilnehmersteckbrief wurde auf die **Haupt-Anwesenheiten-Seite**
übertragen (`js/main.js`, `buildAwTableRows()`): Die leere Auswahloption
jeder Tages-Dropdown-Zelle zeigt jetzt „F" statt „–", wenn der Tag laut
`skbFeiertageFuerJahr()` ein Feiertag ist (die Steckbrief-Feiertagsfunktionen
sind trotz `skb`-Präfix bewusst generisch gehalten und werden hier
direkt wiederverwendet, keine Kopie) – die Zelle bleibt dabei voll editierbar,
„F" ist nur der Platzhaltertext der leeren Option, ein echter Eintrag hat
weiterhin Vorrang. Neue Hilfsfunktion `loadAwBundesland()` lädt das
Bundesland einmalig beim ersten Aufruf der Seite (`ensureAwInitialized()`-
Gate, gleiches Cache-Verhalten wie `awGruppen`/`awMassnahmen` – bei einer
Bundesland-Änderung in den Einstellungen während einer laufenden Sitzung
zeigt diese Seite die alten Feiertage bis zum nächsten Neuladen). Der
Wochenend-Hintergrund (`.anwesenheiten-table .day-col.weekend`, existierte
hier bereits vorher) wurde auf denselben dunkleren Grauton `#d7dde2`
angeglichen wie im Steckbrief, für ein einheitliches Erscheinungsbild.
**Bewusst nicht angefasst:** der bestehende Anwesenheiten-**PDF**-Bericht
(`generateAwPdfReport()`/`drawAwReportPage()`) – die Anfrage bezog sich
explizit nur auf die Seite selbst, anders als beim Steckbrief, wo PDF und
Bildschirmansicht ausdrücklich beide verlangt waren.

**Davor:** Die Anwesenheits-Monatsmatrix im
Teilnehmersteckbrief zeigt jetzt zusätzlich zu den erfassten Kurzzeichen auch
die berechneten Feiertage (`F`) und hebt Wochenend-Zellen mit hellgrauem
Hintergrund hervor – **identisch sowohl on-screen als auch im PDF-Bericht**.
Gemeinsame Hilfsfunktionen `skbIstWochenende(iso)` und
`skbTageszeichen(iso, recordsByDate, bundesland)` in `js/main.js` kapseln die
Logik einmal und werden von `renderSteckbriefAnwesenheitTabelle()` (Tabelle
on-screen) UND `generateSteckbriefPdf()` (PDF-Bericht) gemeinsam genutzt –
**bewusst keine zweite, duplizierte Implementierung fürs PDF**, um zu
verhindern, dass beide Darstellungen bei künftigen Änderungen auseinanderlaufen.
Priorität pro Zelle: echter Anwesenheits-Eintrag > berechneter Feiertag (`F`)
> leer. Die Wochenend-Hervorhebung ist davon unabhängig und wird zusätzlich
angewendet (ein Feiertag an einem Wochenende zeigt also `F` **und** hat den
grauen Hintergrund). Im PDF läuft die Wochenend-Einfärbung über den
`didParseCell`-Hook von `jspdf-autotable` (etwas dunkleres Grau als das
`alternateRowStyles`-Zebra-Muster, damit es in geraden wie ungeraden Zeilen
gleichermaßen sichtbar bleibt). Für den Test wurde das Bundesland erneut
kurzzeitig auf „Berlin" gesetzt (Feiertage wie Frauentag 8. März nur dort
gesetzlich) und danach zurückgesetzt; die berechneten Feiertage über den
gesamten Teilnahmezeitraum (Juni 2026–Mai 2028) wurden stichprobenartig gegen
bekannte Daten geprüft (Neujahr, Ostern-Familie, 1. Mai, Tag der Deutschen
Einheit, Weihnachten, Frauentag) – alle korrekt.

**Davor:** Die Kopf-Angaben (Geburtsdatum/Startdatum/
Endedatum/E-Mail/Telefon) im Teilnehmersteckbrief stehen jetzt nebeneinander
als Stat-Karten statt als vertikale `dl`-Liste. Dabei aufgefallen und direkt
mitgefixt: Die Standard-`.stat-value`-Schrift (2rem, fett) ist für
Zahlen-Kacheln (Dashboard) gedacht und lief bei Text-Inhalten wie
E-Mail-Adressen oder "IT-Systemelektroniker" über die Kartenränder hinaus –
`.steckbrief-kopf-fields .stat-value` und `.steckbrief-meta-grid .stat-value`
(letztere schon vorher für Fachbereich/Gruppe/Maßnahme/VT im Einsatz, hatte
denselben Bug) haben jetzt eine kleinere, umbrechende Schriftgröße
(1.15rem + `word-break: break-word`). **Lehre:** Das `.stat-card`/
`.stat-value`-Muster ist ursprünglich für kurze Zahlenwerte (Dashboard)
gebaut – bei Wiederverwendung für Textinhalte immer mit echten (auch
längeren) Werten gegenprüfen, nicht nur mit kurzen Testdaten.

**Davor:** Neues, ganz links platziertes Icon in der
Teilnehmende-Tabelle öffnet den **Teilnehmersteckbrief**
(`teilnehmende-steckbrief`, gleiches Subpage-Muster wie Aktivitäten/
Dateiablage/Notenverlauf) – die bislang größte Einzel-Unterseite im Projekt.
Aufbau: Kopf mit Teilnehmerdaten + Fachbereich/Gruppe/Maßnahme/VT
nebeneinander, Trennlinie, Sektion **Anwesenheit** (Fehltage gesamt/
entschuldigt/unentschuldigt + zwei Fehlzeit-Prozentwerte, darunter eine
Monats-Matrix-Tabelle mit Tag-1-bis-31-Spalten und einer Zeile pro
Kalendermonat im Teilnahmezeitraum), Trennlinie, Sektion **Leistung**
(Anzahl/Durchschnittsnote/Trend + dieselbe Notenverlauf-Chart-Funktion wie
auf der Leistungskontrolle-Seite des Teilnehmenden), Trennlinie, Sektion
**Aktivitäten** (Liste mit Button "Zur Aktivität", der über den bestehenden
`pendingAktivitaetId`-Mechanismus direkt zum passenden Eintrag auf der
Aktivitätenverlauf-Unterseite springt), Trennlinie, Button für einen
PDF-Bericht.

**Fehlzeiten-Logik (exakt wie vom Nutzer spezifiziert):** Anwesenheitsstatus-
Kurzzeichen aus der DB sind `A` (Anwesend), `UA` (Fehlt unentschuldigt), `E`
(Fehlt entschuldigt), `K` (Krank mit AU), `U` (Urlaub), `PR` (Praktikum).
Fehltage = `UA`+`E`+`K`; davon entschuldigt = `E`+`K`; unentschuldigt = `UA`;
`U`/`A`/`PR` zählen nicht als Fehlzeit. "Fehlzeit bisher" = Fehltage gesamt ÷
Werktage von Teilnehmer-Startdatum bis `min(heute, Endedatum)`; "Fehlzeit auf
Maßnahme" = Fehltage gesamt ÷ Werktage von Startdatum bis Endedatum (beide
Male dieselbe Fehltage-Zahl im Zähler, nur der Nenner unterscheidet sich).
Werktage = Mo–Fr ohne die gesetzlichen Feiertage des in den
Bildungsstätte-Einstellungen hinterlegten Bundeslands.

**Feiertagsberechnung (`js/main.js`, Präfix `skb`):** Eigene, gegen bekannte
Referenzdaten verifizierte Implementierung (Gauß'sche Osterformel +
Kalenderregeln je Bundesland, kein Vendor-Paket) – deckt alle 9 bundesweiten
Feiertage sowie die länderspezifischen ab: Heilige Drei Könige (BW, BY,
Sachsen-Anhalt), Frauentag (Berlin, Meck-Vorp), Fronleichnam (BW, BY, Hessen,
NRW, Rheinland-Pfalz, Saarland), Mariä Himmelfahrt (**nur Saarland** – Bayern
bewusst ausgenommen, da dort nur kommunal in katholisch geprägten Gemeinden,
nicht landesweit), Weltkindertag (Thüringen), Reformationstag (9 Bundesländer),
Allerheiligen (BW, BY, NRW, Rheinland-Pfalz, Saarland), Buß- und Bettag
(**nur Sachsen**, Mittwoch vor dem 23. November). Osterformel gegen
Ostersonntag 2022–2027 verifiziert, Buß-und-Bettag-Formel gegen 2022–2026 –
Testskript lag temporär im Scratchpad, ist nicht Teil des Projekts.

**Berechtigungen bewusst gelockert:** Damit *alle* Rollen (nicht nur
Administrator) den Steckbrief inkl. PDF-Bericht nutzen können, wurde
`requireRole("Administrator")` bei drei **GET**-Routen entfernt – bei
`GET /api/einstellungen/bildungsstaette`, `GET /api/einstellungen/unternehmen`
und `GET /api/einstellungen/unternehmen/logo` (alle drei werden für Anschrift/
Firmenname/Logo im PDF-Kopf gebraucht). Die zugehörigen PUT/POST/DELETE-Routen
zum **Ändern** dieser Einstellungen bleiben unverändert Administrator-only.
Neuer Endpunkt `GET /api/teilnehmer/:id/anwesenheiten` (alle Anwesenheits-
Datensätze eines Teilnehmenden über die gesamte Historie, nicht nur ein
Monat wie beim bestehenden `/api/anwesenheiten`) ist – wie die anderen
Teilnehmer-Unterressourcen – nach Fachbereich gescoped, keine Rollen-
Einschränkung.

**PDF-Bericht (`generateSteckbriefPdf()`):** Querformat (wie der bestehende
Anwesenheits-PDF-Bericht), öffnet über `doc.output("bloburl")` +
`window.open()` in einem neuen Tab (bewusst **kein** `doc.save()` – das
würde direkt herunterladen statt anzuzeigen, wie explizit gewünscht). Kopf:
Unternehmensname + Logo rechts (als Data-URL eingebettet, `FileReader` auf
den Blob von `GET .../unternehmen/logo`), darunter Bildungsstätte-Name und
Anschrift, Berichtsdatum. Monats-Matrix und Leistungskontroll-/Aktivitäten-
Listen laufen über `doc.autoTable()` (übernimmt automatische Seitenumbrüche
bei langer Teilnahmedauer); die Chart-Grafik wird **bewusst nicht** als Bild
ins PDF eingebettet (kein SVG-zu-PDF-Support im vendorten jsPDF, hätte eine
Canvas-Neuimplementierung oder ein weiteres Vendor-Paket erfordert) – die
Notenentwicklung erscheint im PDF stattdessen als kompakte Tabelle
(Art/Bezeichnung/Datum/Note). **Echter Bug gefunden und behoben:** Die
Trendpfeile (↑↓→) werden von jsPDFs Standard-Helvetica **nicht** unterstützt
(nur Latin-1/WinAnsi, keine beliebigen Unicode-Zeichen – deutsche Umlaute/ß
funktionieren, Pfeile nicht) und erschienen im PDF als Zeichensalat; eigene
PDF-spezifische Label-Map (`SKB_PDF_TREND_LABELS`, ohne Pfeil) behebt das.
**Lehre für künftige PDF-Texte:** Sonderzeichen/Emoji/Pfeile vor dem Einsatz
in `doc.text()` im tatsächlich erzeugten PDF prüfen, nicht nur die HTML-
Darstellung – dieselbe Zeichenkette kann in der einen Umgebung passen und in
der anderen brechen.

**Refactoring:** `renderNotenverlaufChart(daten, selectedId)` (Notenverlauf-
Seite) wurde in eine parametrisierte Kernfunktion `zeichneNotenChart(zielSvg,
zielEmpty, daten, selectedId, onPointClick)` zerlegt; der Steckbrief ruft sie
direkt mit `skbChart`/`skbChartEmpty` und `onPointClick = null` (kein
Klick-Highlighting dort nötig) auf. `renderNotenverlaufChart` selbst ist nur
noch ein dünner Wrapper – Verhalten der bestehenden Notenverlauf-Seite
unverändert, per Playwright regressionsgetestet.

Kompletter Workflow (Icon-Klick, alle vier Sektionen, Navigation zu
Aktivität/Leistungskontrolle, PDF-Erzeugung inkl. Öffnen in neuem Tab, Prüfung
der Fehlzeit-Prozentwerte gegen unabhängig nachgerechnete Referenzwerte für
einen echten Teilnehmenden mit gemischten Anwesenheits-Kurzzeichen) wurde per
Playwright getestet, das erzeugte PDF wurde tatsächlich gelesen und geprüft
(nicht nur "wurde erzeugt"). Für den Test wurde das Bundesland in den
Bildungsstätte-Einstellungen kurzzeitig auf "Berlin" gesetzt und danach
wieder auf leer zurückgesetzt.

**Davor:** Neuer Einstellungen-Bereich **Unternehmen**
(zwischen Bildungsstätte und Datenbank) mit Name/Bezeichnung des Unternehmens
(zwei einfache Textfelder, gleiches Key-Value-Muster in `einstellung` wie bei
Bildungsstätte) sowie einem **Logo-Upload** – der erste Datei-Upload in den
Einstellungen dieses Projekts, eigenes Muster geschaffen: Logo liegt als
einzelne Datei in `server/logo/` (wie `server/uploads/`/`server/logs/` **nicht**
im Git, in `.gitignore` ergänzt, **nicht** über die statische Allowlist
erreichbar, nur über `GET /api/einstellungen/unternehmen/logo`,
Administrator-only). Beim Hochladen wird die vorherige Logodatei automatisch
gelöscht (`POST` mit `multer.memoryStorage()`, Dateiname immer fest `logo<ext>`
– es existiert also **immer nur eine** Logodatei, kein Verlauf). Bewusst
**nur Raster-Bildformate** erlaubt (PNG/JPEG/GIF/WEBP, 5 MB Limit,
`fileFilter` in `server.js`) – **SVG explizit ausgeschlossen**, da ein Browser
eine SVG-Datei bei direkter Navigation (nicht nur als `<img>`) Skripte darin
ausführen kann (Stored-XSS-Risiko bei Datei-Uploads); diese Einschränkung
nicht versehentlich aufheben, ohne das Risiko neu zu bewerten. `DELETE
.../logo` zum Entfernen. Vorschaubild in den Einstellungen nutzt einen
Cache-Busting-Query-Parameter (`?t=Date.now()`), da der Dateiname nach jedem
Upload gleich bleibt und der Browser das alte Bild sonst aus dem Cache zeigen
würde. **Wichtig:** Das Logo wird aktuell **nur** in den Einstellungen
verwaltet – es ersetzt (noch) nicht das Standortmanager-Logo im Seitenkopf
oder auf der Login-Seite; das war nicht Teil der Anfrage.

**Davor:** Neuer, als erste Karte ganz oben platzierter
Einstellungen-Bereich **Bildungsstätte** (Name, Straße, Hausnummer, Postleitzahl,
Ort, Bundesland als Dropdown mit allen 16 Bundesländern, E-Mail, Telefon,
Geschäftsbereich als Dropdown mit fest vorgegebenen Werten Zentrale/West/Ost/
Nord/Süd/MaxQ/IFTP). Alle neun Felder sind bewusst **optional** (kein Feld ist
`required`) und liegen als einzelne Key-Value-Paare in der `einstellung`-Tabelle
(`bildungsstaette_name`, `bildungsstaette_strasse`, … – Konstante
`BILDUNGSSTAETTE_SCHLUESSEL` in `server.js`), analog zum bestehenden Muster
bei `dokumentenpfad`/`log_max_dateigroesse_mb`. Eigener Endpunkt
`GET`/`PUT /api/einstellungen/bildungsstaette` (Administrator-only wie die
anderen Einstellungen-Endpunkte), PUT validiert Bundesland und Geschäftsbereich
serverseitig gegen die feste Werteliste, alle übrigen Felder werden nur
getrimmt, ohne Formatprüfung (auch die E-Mail-Adresse – nur `type="email"` im
Frontend als Browser-Validierung, keine serverseitige Regex, konsistent mit
der Email-Handhabung bei Benutzerkonten).

**Davor:** Menüpunkt/Seitentitel/Breadcrumb heißen jetzt
"Leistungskontrollen" (Plural, analog zu Teilnehmende/Maßnahmen/Gruppen/
Fachbereiche) statt "Leistungskontrolle" – bewusst **nicht** überall umbenannt:
Texte, die sich auf **einen einzelnen** Eintrag beziehen (Button "Neue
Leistungskontrolle", Überschrift "Leistungskontrolle Nr. X" auf der
Detailseite, Fehlermeldungen "Leistungskontrolle konnte nicht … werden",
aria-labels je Zeile), bleiben bewusst im Singular. Neue Leistungskontrollen
bekommen bei der Erstellung außerdem automatisch `Gesamtpunkte = 100` als
Standardwert (`POST /api/leistungskontrollen` in `server.js`, greift nur bei
der Neuanlage – ein späteres bewusstes Leeren des Felds über die Detailseite
bleibt weiterhin möglich).

**Davor:** Der Menüpunkt "Leistungskontrolle" ist für
die Rolle Lehrgangsorganisation (Kürzel "LO") ausgeblendet (`applyRolePermissions()`
in `js/main.js`) und zusätzlich per Redirect in `showPage()` abgesichert (direkte
Hash-Navigation `#leistungskontrollen` landet für diese Rolle auf dem Dashboard) –
rein UI-seitig, die Backend-API wurde bewusst **nicht** eingeschränkt (Lehrgangs-
organisation bleibt eine der drei uneingeschränkten Rollen `UNRESTRICTED_ROLLEN`
in `server.js`, das war explizit nicht Teil der Anfrage). **Stolperfalle beim
Einbauen entdeckt:** Der bestehende generische `operativePages`-Block am Ende von
`applyRolePermissions()` setzt für alle nicht-Auditor-only-Nutzer `display = ""`
auf eine feste Liste von Sidebar-Links – da "leistungskontrollen" ursprünglich
in dieser Liste stand, überschrieb dieser Block meine vorher gesetzte
`display: none`-Regel wieder. Fix: "leistungskontrollen" aus `operativePages`
entfernt und stattdessen in der eigenen, weiter oben stehenden Regel sowohl
`auditOnly` als auch die LO-Rolle geprüft. **Lehre:** Bei rollenabhängiger
Sidebar-Sichtbarkeit immer prüfen, ob ein späterer Block in
`applyRolePermissions()` denselben Link nochmal anfasst (Funktion ist lang und
mehrere generische Listen/Schleifen laufen nacheinander durch) – sonst gewinnt
stillschweigend der zuletzt ausgeführte Codeblock.

**Davor:** Das Notenverlauf-Icon in der Teilnehmende-
Tabelle hat jetzt ein Badge, exakt nach dem bestehenden Muster von
Aktivitäten-/Dokumenten-Badge (`.aktivitaet-badge`/`.dokument-badge`/
`.noten-badge` teilen sich dieselben CSS-Regeln): Grüner Kreis mit Anzahl,
wird zu Blau (`--color-primary`, Klasse `badge-aktuell`), wenn mindestens eine
zugewiesene Leistungskontrolle in den letzten 14 Tagen angelegt wurde (`lk.
ErstelltAm >= NOW() - INTERVAL 14 DAY`) – bewusst dieselbe 14-Tage-Regel wie
bei den anderen beiden Badges, nicht das Durchführungsdatum. Neuer Endpunkt
`GET /api/leistungskontrollen/summary` (1:1 nach dem Vorbild von
`/api/aktivitaeten/summary` und `/api/dokumente/summary` gebaut, inkl.
Fachbereichs-Scoping). **Wichtig bei künftigen neuen `/api/leistungskontrollen/*`-
Routen:** `/summary` muss in `server.js` **vor** der `GET /api/leistungskontrollen/:id`-
Route registriert werden, sonst fängt die `:id`-Route den Request ab (Express
matcht Routen in Registrierungsreihenfolge) – exakt das gleiche Muster wie
bei `/api/dokumente/summary` vor `/api/dokumente/:id`.

**Davor:** Neues drittes Icon (Trend-Symbol) pro Zeile
in der Teilnehmende-Tabelle öffnet die Unterseite **Notenverlauf**
(`teilnehmende-notenverlauf`, gleiches Subpage-Muster wie Aktivitäten/
Dateiablage). Zeigt oben Teilnehmerdaten (Vorname, Nachname, Fachbereich,
Gruppe, VT – kommen direkt aus dem bereits geladenen `person`-Objekt der
Teilnehmende-Tabelle, **kein** eigener Backend-Call dafür nötig) sowie zwei
Stat-Kacheln "Durchschnittsnote" und "Trend". Trend wird über einen simplen
Vergleich erste vs. zweite Hälfte der chronologischen Noten berechnet
(Schwelle 0,3 Notenpunkte; `verbessert`/`stabil`/`verschlechtert`, Farben
Grün/Grau/Orange – bewusst dieselben Statusfarben wie die bestehenden
`.form-message.success`/`.error`-Klassen, keine neuen Farben eingeführt).
Darunter eine **selbstgebaute inline-SVG-Liniengrafik** (kein Chart-Vendor-Lib
hinzugefügt, passend zur "kein Build-Tooling"-Philosophie – siehe
`renderNotenverlaufChart()` in `js/main.js`): Y-Achse bewusst **invertiert**
(Note 1,0 oben, 6,0 unten, da niedrigere Note = besser), X-Achse ordinal mit
fester Punktbreite (90px) in einem horizontal scrollbaren Wrapper (analog zu
`.table-scroll`), Klick/Tastatur-Fokus auf einen Punkt oder eine Zeile der
Liste darunter selektiert denselben Eintrag (`selectNotenverlaufEintrag()`,
State-getrieben, rendert Chart+Liste komplett neu – bei den überschaubaren
Datenmengen hier unproblematisch). Darunter Liste **aller** der Maßnahme des
Teilnehmenden zugewiesenen Leistungskontrollen (auch ohne Note, zeigt dann
„–"), mit eigenem Bearbeiten-Icon je Zeile, das direkt zur bestehenden
Leistungskontrolle-Detailseite navigiert (`openLeistungskontrolleDetail()`,
wiederverwendet – kein Duplikat-Bearbeiten-UI). Bearbeitungsrecht ist
bewusst **nicht** neu auf die Rolle Fachbereichsleiter eingeschränkt worden,
sondern nutzt unverändert das bestehende Fachbereichs-Scoping (Ausbilder UND
Fachbereichsleiter dürfen wie bisher Leistungskontrollen im eigenen
Fachbereich bearbeiten) – das war eine explizite Nutzer-Entscheidung in
dieser Session, keine Owner-Vorgabe.

Backend: Note ist beim Ergebnisse-Erfassen jetzt auf die deutsche Notenskala
1,0–6,0 validiert (`PUT /api/leistungskontrollen/:id/ergebnisse`, Zahlenfeld
statt Freitext in der UI), die Spalte `leistungskontrolle_teilnehmer.Note`
bleibt aber bewusst `VARCHAR(20)` (keine Migration nötig, Wert wird als
String gespeichert). Neuer Endpunkt `GET /api/teilnehmer/:id/leistungskontrollen`
liefert alle über die Maßnahme zugewiesenen Leistungskontrollen inkl. der
individuellen Ergebnis-Felder (LEFT JOIN, Fachbereichs-Scoping wie bei
`/api/aktivitaeten`).

**Echter Bug beim Testen gefunden und behoben:** `Number(null)` ergibt in
JavaScript `0`, nicht `NaN` – dadurch wurden Leistungskontrollen ganz ohne
Note fälschlich als Note „0" in Durchschnitt, Trend und Chart-Punkten gezählt.
Fix: neue Hilfsfunktion `parseNoteWert()`, die explizit auf
`null`/`undefined`/`""` prüft, bevor `Number()` aufgerufen wird – **Lehre für
künftige Auswertungen von optionalen numerischen Datenbank-Feldern:**
`Number.isFinite(Number(x))` reicht als Nullish-Check NICHT aus, `Number(null)`
und `Number("")` sind beide finite Zahlen (0).

**Davor:** Neuer Sidebar-Punkt **Leistungskontrolle**
(eigenständiger, flacher Menüpunkt direkt unterhalb von "Teilnehmende", **nicht**
verschachtelt – bewusste Entscheidung, da eine Verschachtelung von "Teilnehmende"
selbst das bestehende Nutzerverhalten verändert hätte). Verwaltet Klausuren/Tests/
Präsentationen/Projekte/Dokumentationen/Lehrstücke, die einer oder mehreren
Maßnahmen (VTs) zugewiesen werden (Many-to-many über `leistungskontrolle_massnahme`).
Filterleiste (Fachbereich/Gruppe/Maßnahme/VT) ist 1:1 von der Teilnehmende-Filterleiste
kopiert, inkl. eigenem `lkGruppen`/`lkMassnahmen`-Cache – Projekt-Konvention ist,
dass **jede** gefilterte Seite ihren eigenen Cache + eigene `refreshXOptions()`-
Funktionen bekommt (siehe Anwesenheiten mit `awGruppen`/`awMassnahmen`), keine
Wiederverwendung über Seiten hinweg. Klick auf eine Zeile öffnet eine eigene
Detail-Unterseite (`leistungskontrollen-detail`, analog zum Aktivitäten-/Dateiablage-
Muster bei Teilnehmenden) mit vollständigem Bearbeiten-Formular (dort auch
Gesamtpunkte/Löschdatum editierbar, die beim Anlegen bewusst **nicht** verpflichtend
sind), Löschen-Button (nur sichtbar/serverseitig erlaubt, wenn Durchführungsdatum in
der Zukunft liegt **oder** Rolle Administrator) und Button "Ergebnisse eingeben" für
einen Dialog mit einer Zeile pro Teilnehmer/in der zugewiesenen Maßnahmen
(Ergebnispunkte/Note/Korrekturdatum/BesprochenAmDatum). Wichtige Design-Entscheidung:
Die Zwischentabelle `leistungskontrolle_teilnehmer` wird **nicht** beim Anlegen/
Zuweisen eager mit einer Zeile pro Teilnehmer befüllt, sondern der Ergebnisse-
Dialog berechnet die Teilnehmerliste bei jedem Öffnen frisch aus den aktuell
zugewiesenen Maßnahmen (`GET .../ergebnisse` per LEFT JOIN) und das Speichern macht
ein Upsert (`ON DUPLICATE KEY UPDATE`) nur für die tatsächlich angezeigten
Teilnehmer – das hält die Liste auch dann korrekt, wenn nach dem Anlegen der
Leistungskontrolle noch neue Teilnehmende der zugewiesenen Maßnahme hinzukommen.
Neue Tabellen `leistungskontrolle` / `leistungskontrolle_massnahme` /
`leistungskontrolle_teilnehmer` werden – wie `dokument` und `einstellung` – idempotent
per `CREATE TABLE IF NOT EXISTS` in `bootstrapDatabase()` angelegt, **nicht** in
`schema.sql` (Projekt-Konvention: `schema.sql` ist nur das Grundschema für einen
Fresh-Install, alles danach Ergänzte kommt über den Bootstrap). Fachbereichs-Scoping
für eingeschränkte Rollen folgt exakt dem bei Dokumenten/Aktivitäten etablierten
Muster (`isRestrictedUser`/`fachbereichInScope`, geprüft gegen alle zugewiesenen
Maßnahmen). Beim Testen dieser Session wurde ein echter Bug gefunden und behoben:
Nach dem Speichern im Detail-Formular wurde `loadLeistungskontrolleDetailPage()`
aufgerufen, welches am Anfang die Formularmeldung zurücksetzt – dadurch verschwand
die "Gespeichert."-Erfolgsmeldung sofort wieder. Fix: Erfolgsmeldung wird jetzt
**nach** dem Neuladen gesetzt, nicht davor (Lehre für ähnliche Save-und-Neuladen-
Muster: Reihenfolge beachten, wenn die Reload-Funktion dieselbe Message-Node anfasst).
Kompletter Workflow (Anlegen, Filtern, Detail-Bearbeiten, Ergebnisse erfassen,
Löschen mit Bestätigungsdialog) wurde per Playwright end-to-end im Browser getestet
(nicht nur per API) – Playwright war im Projekt nicht vorhanden und wurde nur
temporär im Scratchpad-Verzeichnis installiert, ist nicht Teil des Projekts.
Zwei kleine Nachbesserungen in derselben Session: Im Ergebnisse-Dialog ist das
Korrekturdatum-Feld je Teilnehmer/in standardmäßig mit dem heutigen Datum vorbelegt
(nur wenn noch kein Wert gespeichert ist). Auf der Leistungskontrolle-Detailseite
wird das Löschdatum-Feld, sofern noch leer, mit heutigem Datum plus dem bestehenden
Löschfrist-Offset aus den Einstellungen vorbelegt (`berechneLoeschdatumVorschlag()`,
dieselbe Funktion, die auch beim Dokument-Upload den Löschdatum-Vorschlag berechnet
– hier nur mit dem heutigen Tag statt dem Enddatum des Teilnehmers als Basis).

**Davor:** Neuer Sidebar-Punkt **Systemlogs** (ganz
unten, nur Administrator, aufklappbare Gruppe wie Stammdaten/Audit) mit
Unterpunkt **Dateioperationen**, der Upload/Download/Änderung/Löschung von
Dokumenten in der Dateiablage protokolliert. Das Protokoll ist bewusst eine
reine Textdatei `server/logs/dateioperationen.log` (pipe-getrennt: Zeitstempel
ISO 8601 | Art | Dateiname | Teilnehmer "Nachname, Vorname" | Username) und
**kein** Datenbank-Log – analog zu `server/uploads/` liegt `server/logs/`
außerhalb der `express.static`-Allowlist und ist nicht per HTTP erreichbar,
Zugriff nur über `GET /api/systemlogs/dateioperationen` (Administrator-only,
liest und parst alle `dateioperationen*.log`-Dateien serverseitig). Vor jedem
Log-Eintrag prüft `logDateioperation()` in `server/server.js`, ob die aktuelle
Logdatei die in den Einstellungen (neuer Bereich "Logging",
`log_max_dateigroesse_mb` in `einstellung`, leer → Standardwert 50 MB)
konfigurierte Maximalgröße erreicht hat, und benennt sie in diesem Fall mit
Zeitstempel-Suffix um (`dateioperationen.<ISO-Zeitstempel>.log`) – rotierte
Dateien werden aktuell **nicht** automatisch gelöscht (unbegrenzte
Aufbewahrung, wie ein klassischer Audit-Trail). Logging-Fehler werden
abgefangen (try/catch + `console.error`) und dürfen die eigentliche
Datei-Operation nie zum Scheitern bringen. Bewusst **nicht** mitgeloggt wird
das Öffnen der Dokumentvorschau (`GET /api/dokumente/:id/vorschau`), da das
technisch kein Download ist – nur `GET /api/dokumente/:id/datei` zählt als
Download. `server/logs/` ist wie `server/uploads/` in `.gitignore`.

Davor (gleiche Grund-Session): In der Dateiablage-Detailansicht öffnet ein
neuer "Vorschau"-Button jedes Dokument direkt im Browser in einem neuen Tab
(`dokument-vorschau.html`, bewusst **außerhalb** des SPA-Hash-Routings) statt
es herunterzuladen: PDF/Bilder über den nativen Browser-Viewer, DOCX über
[docx-preview](https://github.com/VolodymyrBaydalka/docxjs), XLSX/XLS über
[SheetJS](https://sheetjs.com) (`js/vendor/xlsx.full.min.js`, bewusst vom
SheetJS-CDN statt aus npm bezogen, da das npm-Paket ungefixte HIGH-severity-
Schwachstellen hat – bei künftiger Aktualisierung nicht einfach wieder
`npm install xlsx`!). Das alte `.doc`-Format zeigt nur einen Hinweistext mit
Download-Fallback, da keine verlässliche freie Bibliothek dafür existiert.
Neue Backend-Route `GET /api/dokumente/:id/vorschau` (wie der bestehende
Download, aber `res.sendFile()` statt `res.download()` für Inline-Anzeige)
musste – wie jede neue statische Datei – der Static-Allowlist in `server.js`
hinzugefügt werden. Details siehe Unterabschnitt "Dokumentvorschau im Browser
(PDF, Bilder, DOCX, XLSX, XLS, DOC-Fallback)".

Davor (gleiche Grund-Session): Die Einstellungen-Seite zeigt unter
"Datenbank" die echten MySQL-Zugangsdaten (Host/Port/Name/User editierbar,
Passwort **nie im Klartext**, nur per Popup änderbar). Da diese Daten in
`server/.env` liegen (nicht in der eigenen DB – Henne-Ei-Problem beim
Verbindungsaufbau), wird vor jedem Schreiben eine echte Testverbindung mit
den neuen Werten aufgebaut – schlägt sie fehl, bleibt `.env` unangetastet.
Automatisches `.env.bak`-Backup vor jeder Änderung. Änderungen wirken erst
nach manuellem Server-Neustart (kein Live-Reconnect, kein Process-Manager im
Projekt). Details siehe Unterabschnitt "Datenbank-Zugangsdaten in den
Einstellungen".

Ebenfalls davor: Neue **Dokumentenverwaltung pro Teilnehmendem** (Datei-Icon
inkl. Anzahl-Badge in der Teilnehmenden-Tabelle → Master-Detail-Unterseite
"Dateiablage", Upload-/Bearbeiten-Dialog, Löschen ausschließlich für
Administrator, Speicherpfad in den Einstellungen konfigurierbar) samt
kritischem Sicherheits-Fix: `express.static` lieferte vorher das **komplette
Repo-Root** aus (inkl. Server-Quellcode im Klartext über HTTP), jetzt
eingeschränkt auf eine explizite Allowlist (`index.html`, `css/`, `js/`,
`assets/`, seit der Dokumentvorschau zusätzlich `dokument-vorschau.html`) –
bei künftigen neuen statischen Assets diese Allowlist erweitern, nicht auf
einen pauschalen Root-Mount zurückfallen. Details siehe Unterabschnitt
"Dokumentenverwaltung pro Teilnehmendem".

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
dokument-vorschau.html
                  Eigenständige zweite HTML-Seite (bewusst außerhalb des
                  SPA-Hash-Routings) für die Dokumentvorschau, per
                  window.open() aus der Dateiablage geöffnet. Eigenes Script
                  js/dokument-vorschau.js + eigenes Stylesheet
                  css/dokument-vorschau.css (zusätzlich zu style.css).
praesentation.html
                  Eigenständige dritte HTML-Seite (ebenfalls außerhalb des
                  SPA-Hash-Routings), Feature-Übersicht der Anwendung, per
                  Klick auf das Logo in der Topbar in neuem Tab geöffnet.
                  Eigenes Script js/praesentation.js + eigenes Stylesheet
                  css/praesentation.css. Keine Login-Pflicht, keine
                  API-Aufrufe (rein statischer Inhalt).
css/style.css     Design (an bfw.de angelehnt: Primärblau #00adee, Navy #003a4d,
                  Akzentorange #ff7800, Font "Istok Web", stark abgerundete Ecken)
css/dokument-vorschau.css
                  Zusatzstyles für dokument-vorschau.html (Layout/Rahmen für
                  iframe/Bild/DOCX/Tabellen-Vorschau)
css/praesentation.css
                  Zusatzstyles für praesentation.html (Feature-Grid, Karten,
                  Detail-Dialog)
js/main.js        Gesamte Client-Logik: Routing, Sidebar, CRUD pro Entität
js/dokument-vorschau.js
                  Logik der Dokumentvorschau-Seite: lädt die Datei über
                  GET /api/dokumente/:id/vorschau und rendert sie je nach
                  Dateiendung (iframe/img/docx-preview/SheetJS/Fallback)
js/praesentation.js
                  Rendert die Feature-Karten aus einem statischen
                  FEATURES-Array und steuert den Detail-Dialog (öffnen,
                  über Button oder Backdrop-Klick schließen)
js/vendor/        Vendorte Drittanbieter-Libs als reine Static Files (kein npm/
                  Build-Schritt fürs Frontend): jspdf.umd.min.js (2.5.2) +
                  jspdf.plugin.autotable.min.js (3.8.4) für den PDF-Bericht
                  auf der Anwesenheiten-Seite (Plugin hängt sich an
                  window.jspdf.jsPDF). Für die Dokumentvorschau zusätzlich
                  jszip.min.js (3.10.1, muss VOR docx-preview.min.js geladen
                  werden) + docx-preview.min.js (0.4.0) + xlsx.full.min.js
                  (SheetJS 0.20.3, bewusst vom SheetJS-CDN statt aus npm
                  bezogen – siehe Unterabschnitt "Dokumentvorschau im
                  Browser"). Alle per <script>-Tag eingebunden, keine davon
                  npm-verwaltet im Frontend.
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
  .env.bak        Automatische Sicherung vor jeder Änderung der DB-Zugangsdaten über
                  die Einstellungen-Seite (server.js writeEnvUpdates()), NICHT im Git
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

Die Seite ist nachträglich (gleiche Session) in drei Kategorien
unterteilt worden (`.settings-section`-Divs mit `<h3>`-Überschrift +
`border-bottom`-Trenner, rein visuelle Gliederung innerhalb desselben
`#einstellungenForm`): **Datenbank**, **Dateiverwaltung** (enthält die
beiden bestehenden Felder Dokumentenpfad/Löschfrist-Offset),
**Benutzerkonten**. Die letzten beiden Kategorien sind noch reine
Platzhalter ("Noch keine Einstellungen in dieser Kategorie.") ohne
Formularfelder – Feld-IDs/-Namen und die Backend-Routen blieben dabei
unverändert, es war eine reine HTML/CSS-Umstrukturierung ohne
JS-/Server-Änderung.

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

### Datenbank-Zugangsdaten in den Einstellungen

Die zuvor als reiner Platzhalter angelegte Kategorie „Datenbank" auf
der Einstellungen-Seite (siehe "Dokumentenverwaltung pro
Teilnehmendem") zeigt jetzt die MySQL-Zugangsdaten (Host/IP, Port,
Datenbankname, Datenbankuser) direkt editierbar an, mit eigenem
`#einstDatenbankForm` und eigenem "Speichern"-Button (die Seite hat
dadurch pro Kategorie mit tatsächlichen Feldern ein eigenständiges
`<form>` statt eines einzigen großen Formulars – nötig, weil
Datenbank-Einstellungen fundamental anders funktionieren als
`dokumentenpfad`/`loeschfrist_offset_jahre`, siehe unten).

**Grundproblem, das das gesamte Design bestimmt:** Die DB-Zugangsdaten
liegen in `server/.env` und werden von `dotenv` einmalig beim
Serverstart geladen, bevor der `mysql2`-Pool erstellt wird – sie
können nicht wie die übrigen Einstellungen in der eigenen
`einstellung`-Tabelle liegen, weil ohne gültige Zugangsdaten gar keine
Verbindung zu dieser Tabelle zustande käme (Henne-Ei-Problem). Deshalb:

- **`GET /api/einstellungen/datenbank`** (`requireRole("Administrator")`)
  liest die aktuellen Werte direkt aus `process.env.DB_HOST` etc. und
  gibt **niemals** `DB_PASSWORD` zurück – auch nicht maskiert, das
  Feld fehlt im Response komplett. Das Passwort-Feld im Formular zeigt
  serverseitig unbefüllt nur eine statische Platzhalter-Anzeige
  (`········`, `disabled`), niemals einen echten Wert – erfüllt die
  Vorgabe "Passwort darf nicht im Klartext dargestellt werden" auf
  Backend- und Frontend-Ebene gleichzeitig.
- **Ändern des Passworts läuft ausschließlich über ein separates
  Popup** (`#einstDbPasswortDialog`, Vorbild: das bestehende
  `resetBenutzerPasswortDialog`-Muster – Neues Passwort + Wiederholung,
  Übereinstimmung wird clientseitig geprüft) und einen eigenen
  Endpunkt `PUT /api/einstellungen/datenbank/passwort` (Body nur
  `{passwort}`), getrennt vom Formular für Host/Port/Name/User
  (`PUT /api/einstellungen/datenbank`).
- **Validierung vor dem Schreiben (kritischer Sicherheitsmechanismus,
  ohne Rückfrage beim Nutzer als offensichtlich richtige Vorgehensweise
  umgesetzt):** Beide PUT-Routen bauen über `testDatenbankVerbindung()`
  eine echte, kurzlebige `mysql2`-Testverbindung mit den **neuen**
  Werten auf (bei der Host/Port/Name/User-Route mit dem unveränderten,
  aktuell aktiven `process.env.DB_PASSWORD` kombiniert; bei der
  Passwort-Route mit dem unveränderten aktuellen Host/Port/Name/User
  kombiniert). Schlägt die Testverbindung fehl, wird **nichts**
  geschrieben, der Endpunkt antwortet mit 400 und einer Fehlermeldung
  aus der zugrundeliegenden MySQL-Fehlermeldung. Verhindert, dass ein
  Tippfehler den Server beim nächsten Neustart komplett lahmlegt.
- **`writeEnvUpdates(updates)`** (neue Hilfsfunktion in `server.js`)
  liest `server/.env`, legt vor jeder Änderung automatisch eine
  Sicherung `server/.env.bak` an (überschrieben bei jedem weiteren
  Schreibvorgang), ersetzt nur die betroffenen `KEY=`-Zeilen (alle
  anderen Zeilen wie `PORT`/`SESSION_SECRET` bleiben unangetastet) und
  schreibt neue Werte grundsätzlich in doppelten Anführungszeichen
  (`quoteEnvWert()`, escaped `\`/`"`) – wichtig, weil ein
  DB-Passwort z. B. ein `#` enthalten könnte, das in `.env`-Dateien
  sonst als Kommentar-Start interpretiert würde. `server/.env.bak`
  wurde ergänzend in `.gitignore` aufgenommen (vorher eine Lücke –
  `server/.env` selbst war zwar schon ausgeschlossen, eine
  `.bak`-Kopie mit Klartext-Zugangsdaten aber nicht automatisch).
- **Kein Live-Reconnect:** Da eine bereits laufende `mysql2`-Pool-
  Verbindung nicht sicher mitten im Betrieb umgeschaltet werden kann
  (insbesondere nicht während der Admin gerade selbst die Anfrage zum
  Ändern stellt) und es in diesem Projekt keinen Process-Manager
  (pm2/nodemon) gibt, der automatisch neu starten würde, bleibt es bei
  der bereits etablierten Konvention dieser Session: Erfolgsmeldung
  weist explizit auf einen nötigen manuellen Server-Neustart hin,
  bevor neue Zugangsdaten wirksam werden.

Getestet (auf der echten, lokalen Entwicklungsdatenbank, mit größter
Vorsicht wegen des Risikos, die eigene laufende Verbindung zu
zerstören): vorherige Sicherheitskopie der `.env` außerhalb des Repos
angelegt; falscher Host/falsches Passwort jeweils korrekt mit 400
abgelehnt, `.env` dabei per MD5-Hash-Vergleich als unverändert
bestätigt, keine `.env.bak` angelegt; erfolgreicher Rundlauf mit den
tatsächlich aktuellen Zugangsdaten (Host/Port/Name/User sowie das
echte Passwort, per Shell-Variable durchgereicht, ohne dass der Wert
je im sichtbaren Kontext auftauchte) inkl. zweimaligem echtem
Server-Neustart zur Bestätigung, dass das neue, angeführungszeichnete
`.env`-Format von `dotenv` korrekt geparst wird und die Verbindung
danach weiterhin funktioniert; Nicht-Admin-Zugriff auf beide Routen
mit 403 bestätigt; Playwright-Screenshot bestätigt, dass das
Passwort-Feld im DOM nur `········` enthält und der Popup-Dialog
korrekt im bestehenden Stil öffnet.

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

### Dokumentvorschau im Browser (PDF, Bilder, DOCX, XLSX, XLS, DOC-Fallback)

Auf Wunsch des Nutzers ergänzt: In der Dateiablage-Detailansicht öffnet ein
neuer "Vorschau"-Button (`#dokDetailVorschau`, neben "Herunterladen" in einem
gemeinsamen `.detail-actions`-Wrapper) das jeweilige Dokument in einem neuen
Browser-Tab (`window.open(...)`), statt es sofort herunterzuladen.

**Neue eigenständige Seite** `dokument-vorschau.html` (bewusst **außerhalb**
des SPA-Hash-Routings von `index.html`/`js/main.js` – ein `window.open()` auf
eine eigene HTML-Datei ist einfacher als ein weiterer Zustand im bestehenden
Router) mit eigenem Script `js/dokument-vorschau.js` und eigenem Stylesheet
`css/dokument-vorschau.css` (zusätzlich zum bestehenden `css/style.css`, für
konsistente Farben/Schrift). Dokument-ID und Original-Dateiname kommen als
Query-Parameter (`?id=...&name=...`) aus dem bereits im Speicher geladenen
`dokument`-Objekt – kein zusätzlicher Metadaten-Endpunkt nötig. Die neue Seite
musste der Static-Allowlist explizit hinzugefügt werden (`app.get(
"/dokument-vorschau.html", ...)` in `server.js`), sonst hätte sie wie jede
neue Datei außerhalb der Allowlist 404 geliefert (siehe Lehre aus dem
Static-Serving-Sicherheitsfix oben).

**Neue Backend-Route** `GET /api/dokumente/:id/vorschau`: 1:1 dieselbe
Auth-/Fachbereichs-Scope-Prüfung wie die bestehende Download-Route
(`resolveDokumentFuerScope`, `isRestrictedUser`/`fachbereichInScope`/
`resolveFachbereichForMassnahme`), aber `res.sendFile()` statt
`res.download()` – liefert die Datei ohne `Content-Disposition: attachment`,
damit sie sich in `<iframe>`/`<img>` einbetten statt zwangsweise
herunterladen lässt. Per curl verifiziert: korrekte `Content-Type`-Header
(`application/pdf`, `image/png`, `application/vnd.openxmlformats-...`, etc.)
ohne Attachment-Disposition, 401 ohne Session-Cookie, 404 bei unbekannter ID.

**Rendering pro Dateityp** (`js/dokument-vorschau.js`, ein `fetch()` auf die
neue Vorschau-Route, dann je nach Dateiendung ausgewertet):

- **PDF**: `Blob` aus der Antwort, `URL.createObjectURL()` als `<iframe>`-Src
  – nutzt den nativen PDF-Betrachter des Browsers.
- **Bilder** (jpg/jpeg/png/gif/webp/svg/bmp): ebenso als Blob-URL in ein
  `<img>`.
- **DOCX**: [docx-preview](https://github.com/VolodymyrBaydalka/docxjs)
  (`docx.renderAsync(buffer, container, undefined, {inWrapper:false,
  ignoreWidth:true})`) rendert die Datei clientseitig zu HTML/CSS.
- **XLSX/XLS**: [SheetJS](https://sheetjs.com) (`XLSX.read` +
  `XLSX.utils.sheet_to_html`), mit Blattauswahl-Dropdown, falls die
  Arbeitsmappe mehr als ein Tabellenblatt enthält.
- **DOC** (altes Binärformat): bewusst **kein** Renderversuch – keine
  verlässliche freie Bibliothek dafür verfügbar. Stattdessen sofortiger
  Hinweistext „Für dieses ältere Word-Format (.doc) ist keine Vorschau
  möglich. Bitte herunterladen.", der Download-Button bleibt trotzdem
  funktionsfähig.
- Alle sonstigen Dateiendungen: generischer Hinweis „Für diesen Dateityp ist
  keine Vorschau verfügbar."

**Neue Vendor-Bibliotheken** in `js/vendor/` (UMD-Bundles wie die
bestehenden `jspdf`/`jspdf-autotable`, kein Build-Tooling im Projekt):
`jszip.min.js`, `docx-preview.min.js`, `xlsx.full.min.js`. Ladereihenfolge in
`dokument-vorschau.html` ist wichtig: `jszip.min.js` **vor**
`docx-preview.min.js`, da dessen UMD-Wrapper intern ein bereits vorhandenes
globales `JSZip` erwartet (`e.JSZip`), sonst schlägt das DOCX-Rendering mit
einem Laufzeitfehler fehl.

**Sicherheitsrelevante Entscheidung bei der Bibliothekswahl:** Das
npm-Paket `xlsx` (SheetJS) enthält zum Zeitpunkt dieser Änderung zwei
HIGH-severity-Schwachstellen ohne verfügbaren npm-Fix (Prototype Pollution
GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9). SheetJS veröffentlicht
gepatchte Versionen ausschließlich über das eigene CDN
(`cdn.sheetjs.com`), nicht über npm. `js/vendor/xlsx.full.min.js` stammt
daher direkt von dort (Version 0.20.3), **nicht** aus einer
`npm install xlsx`-Kopie. **Lehre für künftige Änderungen:** Bei erneuter
Installation/Aktualisierung von `xlsx` nicht einfach `npm install xlsx`
verwenden, sondern zuerst `npm audit` prüfen und im Zweifel wieder die
gepatchte Version direkt vom SheetJS-CDN beziehen. Aus Gründen der bewusst
gewählten Konsistenz (Original-Herkunft nachvollziehbar) wurde außerdem
bewusst die "full"-Variante (statt "mini") gewählt, da sie Codepage-/CFB-
Unterstützung für das alte Binärformat `.xls` mitbringt – ohne sie hätte nur
`.xlsx` funktioniert.

**Layout-Bug beim Testen gefunden und behoben:** Die bestehende, für das
SPA gedachte globale Regel `main, footer { max-width: 1680px; margin: 0
auto; }` in `css/style.css` griff auch auf das `<main id="vorschauInhalt">`
der neuen eigenständigen Seite und ließ es (wegen `margin: auto` als
Flex-Item) auf Inhaltsbreite schrumpfen statt den Flex-Container
auszufüllen – das PDF/Bild/DOCX/Tabelle erschien nur ca. 300px schmal.
Behoben durch explizite Überschreibung (`margin: 0; max-width: none; width:
100%;`) in `css/dokument-vorschau.css`, das nach `style.css` geladen wird.

**Testmethodik-Hinweis:** Playwrights gebündeltes Headless-Chromium zeigt
eingebettete PDF-Blobs in einem `<iframe>` nicht an (kein PDF-Viewer-Plugin
im Headless-Modus), obwohl Netzwerk-Request, Blob-Erzeugung und
Iframe-Einbettung nachweislich korrekt funktionieren (keine
Konsolenfehler, korrekte `iframe.src`/Abmessungen). Die PDF-Vorschau wurde
deshalb zusätzlich mit `chromium.launch({channel: "chrome"})` (echtes,
installiertes Chrome) verifiziert – dort rendert der native PDF-Viewer
korrekt inkl. Seitenzahl und Text. **Lehre für künftige PDF-/Blob-Iframe-
Tests:** Bei unerwartet leeren PDF-Vorschauen im Playwright-Test zuerst mit
`channel: "chrome"` gegentesten, bevor Implementierungsfehler vermutet
werden.

Getestet: curl (Header-Prüfung aller Dateitypen, 401/404), Playwright mit
echtem Chrome (alle 6 Dateitypen einzeln als Screenshot verifiziert:
PDF-Text sichtbar, 1×1-Testbild geladen, DOCX-Text gerendert,
XLSX-/XLS-Tabelle mit Zellwerten sichtbar, DOC-Fallback-Text angezeigt) plus
ein kompletter End-to-End-Durchlauf über die echte UI (Icon → Dateiablage →
Dokument auswählen → "Vorschau"-Button → neuer Tab mit korrektem Inhalt).
Alle für den Test hochgeladenen Testdokumente wurden anschließend wieder
gelöscht.

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
