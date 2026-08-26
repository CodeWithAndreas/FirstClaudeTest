(function () {
  const FEATURES = [
    {
      titel: "Teilnehmendenverwaltung",
      kurz: "Stammdaten zu Teilnehmenden, Maßnahmen, Gruppen und Fachbereichen zentral verwalten und filtern.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="17" cy="16" r="6"></circle>
        <path d="M6 40c0-7 5-12 11-12s11 5 11 12"></path>
        <circle cx="33" cy="14" r="5"></circle>
        <path d="M27 24c1.5-1 3.5-1.5 6-1.5 5 0 9 4 9 9v3"></path>
      </svg>`,
      inhalt: `
        <p>Alle Teilnehmenden werden zusammen mit ihren Stammdaten – Maßnahme, Gruppe, Fachbereich und VT – an einer Stelle gepflegt. Eine Filterleiste (Fachbereich, Gruppe, Maßnahme, VT, Name) macht auch große Listen schnell durchsuchbar.</p>
        <p>Von jeder Zeile aus geht es mit einem Klick direkt weiter zu:</p>
        <ul>
          <li>dem persönlichen Steckbrief</li>
          <li>dem Aktivitätenverlauf</li>
          <li>der Dateiablage</li>
          <li>dem Notenverlauf</li>
        </ul>
      `,
    },
    {
      titel: "Anwesenheitserfassung",
      kurz: "Tagesgenaue Erfassung mit automatischer Feiertagsberechnung und Wochenend-Kennzeichnung.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="7" y="10" width="34" height="30" rx="4"></rect>
        <line x1="7" y1="19" x2="41" y2="19"></line>
        <line x1="15" y1="5" x2="15" y2="13"></line>
        <line x1="33" y1="5" x2="33" y2="13"></line>
        <polyline points="16 29 21 34 32 23"></polyline>
      </svg>`,
      inhalt: `
        <p>Anwesenheiten werden für jede Maßnahme in einer übersichtlichen Monatsmatrix erfasst – ein Status-Kürzel pro Tag und Teilnehmendem (Anwesend, unentschuldigt/entschuldigt gefehlt, Krank, Urlaub, Praktikum).</p>
        <p>Feiertage werden automatisch nach dem in den Einstellungen hinterlegten Bundesland berechnet und in der Tabelle mit „F" markiert, Wochenenden sind grau hinterlegt – für alle 16 Bundesländer inklusive ihrer jeweiligen Sonderfeiertage.</p>
      `,
    },
    {
      titel: "Leistungskontrollen & Notenverlauf",
      kurz: "Klausuren, Tests und Projekte anlegen, Ergebnisse erfassen und die Notenentwicklung als Diagramm verfolgen.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="41" x2="8" y2="9"></line>
        <line x1="8" y1="41" x2="41" y2="41"></line>
        <polyline points="13 32 21 24 28 29 39 15"></polyline>
        <circle cx="13" cy="32" r="1.6" fill="currentColor" stroke="none"></circle>
        <circle cx="21" cy="24" r="1.6" fill="currentColor" stroke="none"></circle>
        <circle cx="28" cy="29" r="1.6" fill="currentColor" stroke="none"></circle>
        <circle cx="39" cy="15" r="1.6" fill="currentColor" stroke="none"></circle>
      </svg>`,
      inhalt: `
        <p>Leistungskontrollen (Klausuren, Tests, Präsentationen, Projekte, Dokumentationen, Lehrstücke) werden einer oder mehreren Maßnahmen zugewiesen. Für jede Maßnahme lassen sich anschließend Ergebnispunkte, Note, Korrekturdatum und Besprechungstermin je Teilnehmendem erfassen.</p>
        <p>Der Notenverlauf zeigt Durchschnittsnote und Trend auf einen Blick sowie die Entwicklung über die Zeit als Liniendiagramm – auch im persönlichen Teilnehmersteckbrief eingebunden.</p>
      `,
    },
    {
      titel: "Teilnehmersteckbrief",
      kurz: "Kompakte Gesamtübersicht pro Teilnehmendem mit Anwesenheits- und Leistungsstatistik – als PDF exportierbar.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="11" width="38" height="26" rx="4"></rect>
        <circle cx="16" cy="22" r="4.5"></circle>
        <path d="M10 31c1-3 3.5-5 6-5s5 2 6 5"></path>
        <line x1="27" y1="19" x2="37" y2="19"></line>
        <line x1="27" y1="25" x2="37" y2="25"></line>
        <line x1="27" y1="31" x2="34" y2="31"></line>
      </svg>`,
      inhalt: `
        <p>Der Steckbrief fasst alles Wichtige zu einem Teilnehmenden auf einer Seite zusammen: Stammdaten, Fehlzeitenquoten (bisher und auf die gesamte Maßnahme bezogen), die komplette Anwesenheits-Monatsmatrix, die Leistungsstatistik samt Notenverlauf-Diagramm sowie die letzten Aktivitäten.</p>
        <p>Ein Klick genügt, um daraus einen fertig formatierten PDF-Bericht mit Firmenkopf, Bildungsstätten-Anschrift und Datum zu erzeugen.</p>
      `,
    },
    {
      titel: "Formulare (Vorlagenverwaltung)",
      kurz: "Formularvorlagen zentral hochladen, Fachbereichen zuordnen und bei Bedarf versioniert ersetzen.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M13 5h16l8 8v27a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"></path>
        <path d="M29 5v8h8"></path>
        <line x1="15" y1="24" x2="31" y2="24"></line>
        <line x1="15" y1="31" x2="26" y2="31"></line>
      </svg>`,
      inhalt: `
        <p>PDF-, Word- und Excel-Vorlagen lassen sich mit QM-Kennung, Titel, Beschreibung und Zuordnung zu einem oder mehreren Fachbereichen hochladen und im Browser direkt in der Vorschau ansehen.</p>
        <p>Wird eine Vorlage aktualisiert, genügt ein Klick auf „Ersetzen" – die Version wird automatisch hochgezählt und im Dateinamen zusammen mit dem Uploaddatum festgehalten.</p>
      `,
    },
    {
      titel: "Dokumentenverwaltung",
      kurz: "Dateien pro Teilnehmendem sicher ablegen, mit Vorschau für PDF, Bilder, Word und Excel direkt im Browser.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 14a3 3 0 0 1 3-3h9l4 5h17a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V14z"></path>
        <path d="M18 27l4 4 8-8"></path>
      </svg>`,
      inhalt: `
        <p>Jedes Dokument eines Teilnehmenden wird mit Titel, Schlagworten, Dokumentart, Vertraulichkeitskennzeichen und Löschdatum abgelegt – außerhalb des öffentlich erreichbaren Bereichs und nur über die Anwendung zugänglich.</p>
        <p>PDF-Dateien, Bilder, Word- und Excel-Dokumente lassen sich direkt im Browser als Vorschau öffnen, ohne sie vorher herunterladen zu müssen.</p>
      `,
    },
    {
      titel: "Rollen & Rechte",
      kurz: "Feingranulare Zugriffsteuerung über mehrere Rollen, von Ausbilder bis Administrator.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M24 5l15 6v11c0 10-6.5 17-15 21-8.5-4-15-11-15-21V11z"></path>
        <circle cx="21" cy="21" r="4"></circle>
        <path d="M24.5 24.5l6.5 6.5-2.5 2.5-1.5-1.5-1.5 1.5-1.5-1.5"></path>
      </svg>`,
      inhalt: `
        <p>Sechs Rollen – Ausbilder, Fachbereichsleiter, Lehrgangsorganisation, Bildungsstättenleiter, Administrator und Auditor – bestimmen, welche Menüpunkte, Seiten und Aktionen ein Nutzer bzw. eine Nutzerin sieht und ausführen darf.</p>
        <p>Ausbilder und Fachbereichsleiter sehen dabei grundsätzlich nur die Daten ihres eigenen Fachbereichs, während Administrator, Bildungsstättenleiter und Lehrgangsorganisation uneingeschränkten Zugriff haben.</p>
      `,
    },
    {
      titel: "Audit-Bereich",
      kurz: "Eigener Bereich für Auditorinnen und Auditoren mit gebündelten Prüf-Unterlagen.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="6" width="22" height="30" rx="3"></rect>
        <line x1="15" y1="14" x2="25" y2="14"></line>
        <line x1="15" y1="21" x2="25" y2="21"></line>
        <line x1="15" y1="28" x2="20" y2="28"></line>
        <circle cx="33" cy="33" r="7"></circle>
        <line x1="38" y1="38" x2="43" y2="43"></line>
      </svg>`,
      inhalt: `
        <p>Für die Rolle Auditor gibt es einen eigenen, aufklappbaren Bereich mit mehreren thematischen Unterseiten – von Interessentenbetreuung über Maßnahmen bis zu Teilnehmenden – als gebündelter Einstieg in alle prüfungsrelevanten Unterlagen.</p>
        <p>Sichtbar ist der Bereich ausschließlich für die Rollen Auditor und Administrator.</p>
      `,
    },
    {
      titel: "Systemlogs & Nachvollziehbarkeit",
      kurz: "Jede Dateioperation wird protokolliert und bleibt für Administratoren nachvollziehbar.",
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 8h22l8 8v24a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z"></path>
        <path d="M31 8v8h8"></path>
        <line x1="12" y1="24" x2="22" y2="24"></line>
        <line x1="12" y1="30" x2="20" y2="30"></line>
        <circle cx="33" cy="30" r="7"></circle>
        <polyline points="33 26 33 30 36 32"></polyline>
      </svg>`,
      inhalt: `
        <p>Upload, Download, Änderung und Löschung von Dokumenten werden automatisch mit Zeitstempel, Art der Operation, betroffenem Teilnehmenden und ausführendem Benutzer protokolliert.</p>
        <p>Das Protokoll wächst dabei nicht unbegrenzt in einer Datei: Erreicht die aktuelle Logdatei eine konfigurierbare Maximalgröße, wird sie automatisch archiviert – für Administratoren jederzeit einsehbar.</p>
      `,
    },
  ];

  const grid = document.getElementById("featureGrid");
  const dialog = document.getElementById("featureDialog");
  const dialogIcon = document.getElementById("featureDialogIcon");
  const dialogTitel = document.getElementById("featureDialogTitel");
  const dialogInhalt = document.getElementById("featureDialogInhalt");
  const dialogSchliessenBtn = document.getElementById("featureDialogSchliessenBtn");

  FEATURES.forEach((feature) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "feature-card";

    const icon = document.createElement("span");
    icon.className = "feature-icon";
    icon.innerHTML = feature.icon;

    const titel = document.createElement("h3");
    titel.textContent = feature.titel;

    const kurz = document.createElement("p");
    kurz.textContent = feature.kurz;

    const mehr = document.createElement("span");
    mehr.className = "feature-more";
    mehr.textContent = "Mehr erfahren →";

    card.append(icon, titel, kurz, mehr);
    card.addEventListener("click", () => {
      dialogIcon.innerHTML = feature.icon;
      dialogTitel.textContent = feature.titel;
      dialogInhalt.innerHTML = feature.inhalt;
      dialog.showModal();
    });

    grid.appendChild(card);
  });

  dialogSchliessenBtn.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });
})();
