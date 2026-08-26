console.log("Standortmanager geladen");

const nativeFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await nativeFetch(...args);
  if (response.status === 401 && args[0] !== "/api/me") {
    document.body.classList.add("logged-out");
  }
  return response;
};

let currentUser = null;

function formatDateDE(isoDate) {
  if (!isoDate) {
    return "";
  }
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
}

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const breadcrumb = document.getElementById("breadcrumb");
const navLinks = document.querySelectorAll(".sidebar-link[data-page]");
const pages = document.querySelectorAll(".page");
const defaultPage = "dashboard";
const adminOnlyPages = ["fachbereiche", "massnahmetypen", "benutzer", "einstellungen", "systemlogs-dateioperationen", "workflows", "workflows-detail"];
const auditPages = [
  "audit-interessentenbetreuung",
  "audit-massnahmen",
  "audit-teilnehmer",
  "audit-anwesenheiten",
  "audit-lernmaterialien",
  "audit-leistungskontrollen",
  "audit-praktika",
  "audit-teilnehmendenfeedback",
  "audit-vermittlung",
];

const pageLabels = {
  dashboard: "Dashboard",
  teilnehmende: "Teilnehmende",
  "teilnehmende-notenverlauf": "Teilnehmende / Notenverlauf",
  "teilnehmende-steckbrief": "Teilnehmende / Steckbrief",
  leistungskontrollen: "Leistungskontrollen",
  "leistungskontrollen-detail": "Leistungskontrollen / Detail",
  anwesenheiten: "Anwesenheiten",
  stammdaten: "Stammdaten",
  massnahmen: "Stammdaten / Maßnahmen",
  massnahmetypen: "Stammdaten / Maßnahmetypen",
  gruppen: "Stammdaten / Gruppen",
  fachbereiche: "Stammdaten / Fachbereiche",
  formulare: "Stammdaten / Formulare",
  workflows: "Stammdaten / Workflows",
  "workflows-detail": "Stammdaten / Workflows / Detail",
  benutzer: "Benutzer",
  einstellungen: "Einstellungen",
  "audit-massnahmen": "Audit / Maßnahmen",
  "audit-teilnehmer": "Audit / Teilnehmer",
  "audit-anwesenheiten": "Audit / Anwesenheiten",
  "audit-lernmaterialien": "Audit / Lernmaterialien",
  "audit-leistungskontrollen": "Audit / Leistungskontrollen",
  "audit-praktika": "Audit / Praktika",
  "audit-interessentenbetreuung": "Audit / Interessenten Betreuung",
  "audit-teilnehmendenfeedback": "Audit / Teilnehmenden Feedback",
  "audit-vermittlung": "Audit / Vermittlung",
  "systemlogs-dateioperationen": "Systemlogs / Dateioperationen",
};

function canAccessAudit(user) {
  const roles = (user && user.roles) || [];
  return roles.includes("Auditor") || roles.includes("Administrator");
}

function isAuditorOnly(user) {
  const roles = (user && user.roles) || [];
  return roles.length === 1 && roles[0] === "Auditor";
}

const FORMULARE_ERLAUBTE_ROLLEN = ["Administrator", "Bildungsstättenleiter", "Fachbereichsleiter"];

function canAccessFormulare(user) {
  const roles = (user && user.roles) || [];
  return roles.some((r) => FORMULARE_ERLAUBTE_ROLLEN.includes(r));
}

// Login / Header

const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPasswort = document.getElementById("loginPasswort");
const loginFormMessage = document.getElementById("loginFormMessage");
const topbarUsername = document.getElementById("topbarUsername");
const logoutBtn = document.getElementById("logoutBtn");

const dashTeilnehmerCount = document.getElementById("dashTeilnehmerCount");
const dashMassnahmenCount = document.getElementById("dashMassnahmenCount");
const dashGruppenCount = document.getElementById("dashGruppenCount");
const dashFachbereicheCount = document.getElementById("dashFachbereicheCount");
const stammdatenMassnahmenCount = document.getElementById("stammdatenMassnahmenCount");
const stammdatenMassnahmetypenCount = document.getElementById("stammdatenMassnahmetypenCount");
const stammdatenGruppenCount = document.getElementById("stammdatenGruppenCount");
const stammdatenFachbereicheCount = document.getElementById("stammdatenFachbereicheCount");
const stammdatenFormulareCount = document.getElementById("stammdatenFormulareCount");
const stammdatenWorkflowsCount = document.getElementById("stammdatenWorkflowsCount");
const dashWiedervorlagenListe = document.getElementById("dashWiedervorlagenListe");
const wiedervorlageTerminDialog = document.getElementById("wiedervorlageTerminDialog");
const wiedervorlageTerminForm = document.getElementById("wiedervorlageTerminForm");
const wiedervorlageTerminInput = document.getElementById("wiedervorlageTerminInput");
const wiedervorlageTerminMessage = document.getElementById("wiedervorlageTerminMessage");
const wiedervorlageTerminCancelBtn = document.getElementById("wiedervorlageTerminCancelBtn");

sidebarToggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Menü ausklappen" : "Menü einklappen");
});

document.querySelectorAll(".sidebar-group summary[data-page]").forEach((summary) => {
  summary.addEventListener("click", () => {
    window.location.hash = summary.dataset.page;
  });
});

function showPage(pageId) {
  let targetId = document.getElementById(`page-${pageId}`) ? pageId : defaultPage;

  if (adminOnlyPages.includes(targetId) && !(currentUser && currentUser.roles.includes("Administrator"))) {
    targetId = defaultPage;
  }

  if (auditPages.includes(targetId) && !canAccessAudit(currentUser)) {
    targetId = defaultPage;
  }

  if (isAuditorOnly(currentUser) && !auditPages.includes(targetId)) {
    targetId = auditPages[0];
  }

  if (targetId === "teilnehmende-aktivitaeten" && !currentAktivitaetTeilnehmerId) {
    targetId = "teilnehmende";
  }

  if (targetId === "teilnehmende-dateien" && !currentDokumentTeilnehmerId) {
    targetId = "teilnehmende";
  }

  if (targetId === "leistungskontrollen-detail" && !currentLkId) {
    targetId = "leistungskontrollen";
  }

  if (
    (targetId === "leistungskontrollen" || targetId === "leistungskontrollen-detail") &&
    currentUser &&
    currentUser.roles.includes("Lehrgangsorganisation")
  ) {
    targetId = defaultPage;
  }

  if (targetId === "formulare" && !canAccessFormulare(currentUser)) {
    targetId = defaultPage;
  }

  if (targetId === "teilnehmende-notenverlauf" && !currentNotenverlaufTeilnehmerId) {
    targetId = "teilnehmende";
  }

  if (targetId === "teilnehmende-steckbrief" && !currentSteckbriefTeilnehmerId) {
    targetId = "teilnehmende";
  }

  document.querySelectorAll(".sidebar-group").forEach((group) => {
    const pagesInGroup = [...group.querySelectorAll("[data-page]")].map((el) => el.dataset.page);
    if (pagesInGroup.includes(targetId) || (targetId === "workflows-detail" && pagesInGroup.includes("workflows"))) {
      group.open = true;
    }
  });

  pages.forEach((page) => {
    page.classList.toggle("active", page.id === `page-${targetId}`);
  });

  const activeNavPage =
    targetId === "teilnehmende-aktivitaeten" ||
    targetId === "teilnehmende-dateien" ||
    targetId === "teilnehmende-notenverlauf" ||
    targetId === "teilnehmende-steckbrief"
      ? "teilnehmende"
      : targetId === "leistungskontrollen-detail"
      ? "leistungskontrollen"
      : targetId === "workflows-detail"
      ? "workflows"
      : targetId;
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === activeNavPage);
  });

  breadcrumb.textContent =
    targetId === "teilnehmende-aktivitaeten"
      ? "Start / Teilnehmende / Aktivitätenverlauf"
      : targetId === "teilnehmende-dateien"
      ? "Start / Teilnehmende / Dateiablage"
      : `Start / ${pageLabels[targetId]}`;

  if (targetId === "dashboard") {
    loadDashboardStats();
    loadDashboardWiedervorlagen();
  }
  if (targetId === "stammdaten") {
    loadStammdatenStats();
  }
  if (targetId === "anwesenheiten") {
    ensureAwInitialized();
  }
  if (targetId === "teilnehmende" && tnRowEntries.length > 0) {
    refreshTnAktivitaetBadges();
    refreshTnDokumentBadges();
    refreshTnNotenBadges();
  }
  if (targetId === "teilnehmende-aktivitaeten") {
    loadTeilnehmerAktivitaetenPage(currentAktivitaetTeilnehmerId);
  }
  if (targetId === "teilnehmende-dateien") {
    loadTeilnehmerDateienPage(currentDokumentTeilnehmerId);
  }
  if (targetId === "teilnehmende-notenverlauf") {
    loadTeilnehmerNotenverlaufPage(currentNotenverlaufTeilnehmerId);
  }
  if (targetId === "teilnehmende-steckbrief") {
    loadTeilnehmerSteckbriefPage(currentSteckbriefTeilnehmerId);
  }
  if (targetId === "einstellungen") {
    loadEinstellungen();
    loadDatenbankEinstellungen();
    loadLoggingEinstellungen();
    loadBildungsstaetteEinstellungen();
    loadUnternehmenEinstellungen();
  }
  if (targetId === "systemlogs-dateioperationen") {
    loadSystemlogsDateioperationen();
  }
  if (targetId === "leistungskontrollen") {
    ensureLkInitialized();
  }
  if (targetId === "workflows") {
    ensureWorkflowsInitialized();
  }
  if (targetId === "leistungskontrollen-detail") {
    loadLeistungskontrolleDetailPage(currentLkId);
  }
  if (targetId === "workflows-detail") {
    loadWorkflowDetailPage(currentWorkflowId);
  }
}

function handleRouteChange() {
  const pageId = window.location.hash.replace("#", "") || defaultPage;
  showPage(pageId);
}

window.addEventListener("hashchange", handleRouteChange);

// Dashboard

async function ladeKennzahlen(endpoints) {
  await Promise.all(
    endpoints.map(async ([url, element]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Kennzahl konnte nicht geladen werden.");
        }
        const data = await response.json();
        element.textContent = data.length;
      } catch (err) {
        console.error(err);
        element.textContent = "–";
      }
    })
  );
}

async function loadDashboardStats() {
  await ladeKennzahlen([
    ["/api/teilnehmer", dashTeilnehmerCount],
    ["/api/massnahmen", dashMassnahmenCount],
    ["/api/gruppen", dashGruppenCount],
    ["/api/fachbereiche", dashFachbereicheCount],
  ]);
}

async function loadStammdatenStats() {
  const endpoints = [
    ["/api/massnahmen", stammdatenMassnahmenCount],
    ["/api/massnahmetypen", stammdatenMassnahmetypenCount],
    ["/api/gruppen", stammdatenGruppenCount],
    ["/api/fachbereiche", stammdatenFachbereicheCount],
  ];
  if (canAccessFormulare(currentUser)) {
    endpoints.push(["/api/formulare", stammdatenFormulareCount]);
  } else {
    stammdatenFormulareCount.textContent = "–";
  }
  if (currentUser && currentUser.roles.includes("Administrator")) {
    endpoints.push(["/api/workflows", stammdatenWorkflowsCount]);
  } else {
    stammdatenWorkflowsCount.textContent = "–";
  }
  await ladeKennzahlen(endpoints);
}

function istWiedervorlageUeberfaellig(datum) {
  if (!datum) {
    return false;
  }
  return new Date(datum) < new Date(new Date().toDateString());
}

function renderWiedervorlagenListe(wiedervorlagen) {
  dashWiedervorlagenListe.innerHTML = "";

  if (wiedervorlagen.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "aktivitaet-list-empty";
    emptyItem.textContent = "Keine offenen Wiedervorlagen.";
    dashWiedervorlagenListe.appendChild(emptyItem);
    return;
  }

  wiedervorlagen.forEach((wv) => {
    const item = document.createElement("li");
    item.className = "aktivitaet-list-item wiedervorlage-item";
    if (istWiedervorlageUeberfaellig(wv.Wiedervorlage)) {
      item.classList.add("overdue");
    }

    const main = document.createElement("div");
    main.className = "wiedervorlage-item-main";

    const datumSpan = document.createElement("span");
    datumSpan.className = "aktivitaet-list-datum";
    datumSpan.textContent = formatDateDE(wv.Wiedervorlage);

    const nameSpan = document.createElement("span");
    nameSpan.className = "wiedervorlage-item-name";
    nameSpan.textContent = `${wv.Vorname} ${wv.Nachname}${wv.VT ? ` · VT ${wv.VT}` : ""}`;

    const themaSpan = document.createElement("span");
    themaSpan.className = "aktivitaet-list-thema";
    themaSpan.textContent = wv.Thema || wv.Art;

    main.append(datumSpan, nameSpan, themaSpan);
    main.addEventListener("click", () => {
      openTeilnehmerAktivitaeten({ ID: wv.TeilnehmerID, Vorname: wv.Vorname, Nachname: wv.Nachname, VT: wv.VT }, wv.ID);
    });

    const actions = document.createElement("div");
    actions.className = "wiedervorlage-item-actions";

    const erledigtBtn = document.createElement("button");
    erledigtBtn.type = "button";
    erledigtBtn.className = "row-erledigt-btn";
    erledigtBtn.setAttribute("aria-label", "Als erledigt markieren");
    erledigtBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    erledigtBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      markiereWiedervorlageErledigt(wv.ID);
    });

    const terminBtn = document.createElement("button");
    terminBtn.type = "button";
    terminBtn.className = "row-termin-btn";
    terminBtn.setAttribute("aria-label", "Neuen Wiedervorlagetermin setzen");
    terminBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    `;
    terminBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openNeuerWiedervorlageterminDialog(wv);
    });

    actions.append(erledigtBtn, terminBtn);
    item.append(main, actions);
    dashWiedervorlagenListe.appendChild(item);
  });
}

async function loadDashboardWiedervorlagen() {
  dashWiedervorlagenListe.innerHTML = "";
  const loadingItem = document.createElement("li");
  loadingItem.className = "aktivitaet-list-empty";
  loadingItem.textContent = "Lädt…";
  dashWiedervorlagenListe.appendChild(loadingItem);

  try {
    const response = await fetch("/api/aktivitaeten/wiedervorlagen");
    if (!response.ok) {
      throw new Error("Wiedervorlagen konnten nicht geladen werden.");
    }
    renderWiedervorlagenListe(await response.json());
  } catch (err) {
    console.error(err);
    dashWiedervorlagenListe.innerHTML = "";
    const errorItem = document.createElement("li");
    errorItem.className = "aktivitaet-list-empty";
    errorItem.textContent = "Fehler beim Laden der Wiedervorlagen.";
    dashWiedervorlagenListe.appendChild(errorItem);
  }
}

async function markiereWiedervorlageErledigt(id) {
  try {
    const response = await fetch(`/api/aktivitaeten/${id}/erledigt`, { method: "PUT" });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Wiedervorlage konnte nicht als erledigt markiert werden.");
    }
    await loadDashboardWiedervorlagen();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

let wiedervorlageTerminTargetId = null;

function openNeuerWiedervorlageterminDialog(wv) {
  wiedervorlageTerminTargetId = wv.ID;
  wiedervorlageTerminForm.reset();
  wiedervorlageTerminInput.value = wv.Wiedervorlage || "";
  wiedervorlageTerminMessage.textContent = "";
  wiedervorlageTerminMessage.className = "form-message";
  wiedervorlageTerminDialog.showModal();
}

wiedervorlageTerminCancelBtn.addEventListener("click", () => wiedervorlageTerminDialog.close());

wiedervorlageTerminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const response = await fetch(`/api/aktivitaeten/${wiedervorlageTerminTargetId}/wiedervorlage`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Wiedervorlage: wiedervorlageTerminInput.value }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Wiedervorlagetermin konnte nicht gespeichert werden.");
    }
    wiedervorlageTerminDialog.close();
    wiedervorlageTerminTargetId = null;
    await loadDashboardWiedervorlagen();
  } catch (err) {
    wiedervorlageTerminMessage.textContent = err.message;
    wiedervorlageTerminMessage.classList.add("error");
  }
});

// Fachbereiche

const fachbereicheTableBody = document.getElementById("fachbereicheTableBody");
const fachbereichForm = document.getElementById("fachbereichForm");
const fachbereichFormMessage = document.getElementById("fachbereichFormMessage");

async function loadFachbereiche() {
  fachbereicheTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 4;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  fachbereicheTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/fachbereiche");
    if (!response.ok) {
      throw new Error("Fachbereiche konnten nicht geladen werden.");
    }
    const fachbereiche = await response.json();

    fachbereicheTableBody.innerHTML = "";

    if (fachbereiche.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 4;
      emptyCell.textContent = "Noch keine Fachbereiche vorhanden.";
      emptyRow.appendChild(emptyCell);
      fachbereicheTableBody.appendChild(emptyRow);
      return;
    }

    fachbereiche.forEach((fachbereich) => {
      const row = document.createElement("tr");

      const langCell = document.createElement("td");
      langCell.textContent = fachbereich.BezeichnungLang;

      const kurzCell = document.createElement("td");
      kurzCell.textContent = fachbereich.BezeichnungKurz;

      const kennungCell = document.createElement("td");
      kennungCell.textContent = fachbereich.Kennung || "";

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.setAttribute("aria-label", `${fachbereich.BezeichnungLang} bearbeiten`);
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditFachbereichDialog(fachbereich));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.setAttribute("aria-label", `${fachbereich.BezeichnungLang} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: fachbereich.BezeichnungLang,
          endpoint: `/api/fachbereiche/${fachbereich.ID}`,
          reload: loadFachbereiche,
        })
      );

      actionsWrap.append(editBtn, deleteBtn);
      actionsCell.appendChild(actionsWrap);

      row.append(langCell, kurzCell, kennungCell, actionsCell);
      fachbereicheTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    fachbereicheTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 4;
    errorCell.textContent = "Fehler beim Laden der Fachbereiche.";
    errorRow.appendChild(errorCell);
    fachbereicheTableBody.appendChild(errorRow);
  }
}

fachbereichForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(fachbereichForm);
  const payload = {
    BezeichnungLang: formData.get("BezeichnungLang").trim(),
    BezeichnungKurz: formData.get("BezeichnungKurz").trim(),
    Kennung: formData.get("Kennung").trim(),
  };

  fachbereichFormMessage.textContent = "";
  fachbereichFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/fachbereiche", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Fachbereich konnte nicht gespeichert werden.");
    }

    fachbereichForm.reset();
    fachbereichFormMessage.textContent = "Fachbereich gespeichert.";
    fachbereichFormMessage.classList.add("success");
    await loadFachbereiche();
  } catch (err) {
    fachbereichFormMessage.textContent = err.message;
    fachbereichFormMessage.classList.add("error");
  }
});

// Fachbereich bearbeiten

const editFachbereichDialog = document.getElementById("editFachbereichDialog");
const editFachbereichForm = document.getElementById("editFachbereichForm");
const editFachbereichFormMessage = document.getElementById("editFachbereichFormMessage");
const editFachbereichCancelBtn = document.getElementById("editFachbereichCancelBtn");

let editingFachbereichId = null;

function openEditFachbereichDialog(fachbereich) {
  editingFachbereichId = fachbereich.ID;
  editFachbereichForm.elements.BezeichnungLang.value = fachbereich.BezeichnungLang;
  editFachbereichForm.elements.BezeichnungKurz.value = fachbereich.BezeichnungKurz;
  editFachbereichForm.elements.Kennung.value = fachbereich.Kennung || "";
  editFachbereichFormMessage.textContent = "";
  editFachbereichFormMessage.className = "form-message";
  editFachbereichDialog.showModal();
}

editFachbereichCancelBtn.addEventListener("click", () => {
  editFachbereichDialog.close();
});

editFachbereichForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(editFachbereichForm);
  const payload = {
    BezeichnungLang: formData.get("BezeichnungLang").trim(),
    BezeichnungKurz: formData.get("BezeichnungKurz").trim(),
    Kennung: formData.get("Kennung").trim(),
  };

  editFachbereichFormMessage.textContent = "";
  editFachbereichFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/fachbereiche/${editingFachbereichId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Fachbereich konnte nicht aktualisiert werden.");
    }

    editFachbereichDialog.close();
    editingFachbereichId = null;
    await loadFachbereiche();
  } catch (err) {
    editFachbereichFormMessage.textContent = err.message;
    editFachbereichFormMessage.className = "form-message error";
  }
});

// Löschen mit Bestätigung

const deleteDialog = document.getElementById("deleteDialog");
const deleteForm = document.getElementById("deleteForm");
const deleteTargetName = document.getElementById("deleteTargetName");
const deleteConfirmInput = document.getElementById("deleteConfirmInput");
const deleteFormMessage = document.getElementById("deleteFormMessage");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");

let pendingDelete = null;

function openDeleteDialog({ name, endpoint, reload }) {
  pendingDelete = { name, endpoint, reload };
  deleteTargetName.textContent = name;
  deleteConfirmInput.value = "";
  deleteFormMessage.textContent = "";
  deleteFormMessage.className = "form-message";
  deleteDialog.showModal();
  deleteConfirmInput.focus();
}

deleteCancelBtn.addEventListener("click", () => {
  deleteDialog.close();
});

deleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!pendingDelete) {
    return;
  }

  if (deleteConfirmInput.value.trim() !== pendingDelete.name) {
    deleteFormMessage.textContent = "Die eingegebene Bezeichnung stimmt nicht überein.";
    deleteFormMessage.className = "form-message error";
    return;
  }

  try {
    const response = await fetch(pendingDelete.endpoint, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Eintrag konnte nicht gelöscht werden.");
    }

    deleteDialog.close();
    const reload = pendingDelete.reload;
    pendingDelete = null;
    await reload();
  } catch (err) {
    deleteFormMessage.textContent = err.message;
    deleteFormMessage.className = "form-message error";
  }
});

// Formulare

const formulareTableBody = document.getElementById("formulareTableBody");
const formularForm = document.getElementById("formularForm");
const formularFormMessage = document.getElementById("formularFormMessage");
const formFachbereicheCheckboxes = document.getElementById("formFachbereicheCheckboxes");

let formularFachbereicheCache = [];

async function loadFormularFachbereicheCache() {
  try {
    const response = await fetch("/api/fachbereiche");
    if (!response.ok) {
      throw new Error("Fachbereiche konnten nicht geladen werden.");
    }
    formularFachbereicheCache = await response.json();
  } catch (err) {
    console.error(err);
    formularFachbereicheCache = [];
  }
}

async function loadFormularFormOptions() {
  await loadFormularFachbereicheCache();
  buildCheckboxGroup(formFachbereicheCheckboxes, formularFachbereicheCache, {
    labelKey: "BezeichnungLang",
    checkedIds: [],
    selectAllLabel: "Alle Fachbereiche",
  });
}

function canDeleteFormular() {
  return currentUser && currentUser.roles.includes("Administrator");
}

function openFormularVorschau(formular) {
  const url = `/dokument-vorschau.html?id=${formular.ID}&name=${encodeURIComponent(formular.Dateiname)}&typ=formular`;
  window.open(url, "_blank");
}

async function loadFormulare() {
  formulareTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 6;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  formulareTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/formulare");
    if (!response.ok) {
      throw new Error("Formulare konnten nicht geladen werden.");
    }
    const formulare = await response.json();

    formulareTableBody.innerHTML = "";

    if (formulare.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.textContent = "Noch keine Formulare vorhanden.";
      emptyRow.appendChild(emptyCell);
      formulareTableBody.appendChild(emptyRow);
      return;
    }

    formulare.forEach((formular) => {
      const row = document.createElement("tr");

      const nummerCell = document.createElement("td");
      nummerCell.textContent = formular.ID;

      const qmCell = document.createElement("td");
      qmCell.textContent = formular.QMKennung;

      const titelCell = document.createElement("td");
      titelCell.textContent = formular.Titel;

      const fachbereicheCell = document.createElement("td");
      fachbereicheCell.textContent = formular.Fachbereiche.map((f) => f.BezeichnungKurz).join(", ");

      const dateiCell = document.createElement("td");
      dateiCell.textContent = formular.Dateiname;

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const previewBtn = document.createElement("button");
      previewBtn.type = "button";
      previewBtn.className = "row-history-btn";
      previewBtn.title = "Vorschau";
      previewBtn.setAttribute("aria-label", `${formular.Titel} anzeigen`);
      previewBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      previewBtn.addEventListener("click", () => openFormularVorschau(formular));

      const downloadLink = document.createElement("a");
      downloadLink.className = "row-files-btn";
      downloadLink.title = "Herunterladen";
      downloadLink.setAttribute("aria-label", `${formular.Titel} herunterladen`);
      downloadLink.href = `/api/formulare/${formular.ID}/datei`;
      downloadLink.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      `;

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.title = "Bearbeiten";
      editBtn.setAttribute("aria-label", `${formular.Titel} bearbeiten`);
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditFormularDialog(formular));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.title = "Löschen";
      deleteBtn.setAttribute("aria-label", `${formular.Titel} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: formular.Titel,
          endpoint: `/api/formulare/${formular.ID}`,
          reload: loadFormulare,
        })
      );

      actionsWrap.append(previewBtn, downloadLink, editBtn);
      if (canDeleteFormular()) {
        actionsWrap.append(deleteBtn);
      }
      actionsCell.appendChild(actionsWrap);

      row.append(nummerCell, qmCell, titelCell, fachbereicheCell, dateiCell, actionsCell);
      formulareTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    formulareTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 6;
    errorCell.textContent = "Fehler beim Laden der Formulare.";
    errorRow.appendChild(errorCell);
    formulareTableBody.appendChild(errorRow);
  }
}

formularForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  formularFormMessage.textContent = "";
  formularFormMessage.className = "form-message";

  const formData = new FormData(formularForm);
  getCheckedValues(formFachbereicheCheckboxes).forEach((id) => formData.append("FachbereichIDs", id));

  try {
    const response = await fetch("/api/formulare", {
      method: "POST",
      body: formData,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Formular konnte nicht gespeichert werden.");
    }

    formularForm.reset();
    buildCheckboxGroup(formFachbereicheCheckboxes, formularFachbereicheCache, {
      labelKey: "BezeichnungLang",
      checkedIds: [],
      selectAllLabel: "Alle Fachbereiche",
    });
    formularFormMessage.textContent = "Formular gespeichert.";
    formularFormMessage.classList.add("success");
    await loadFormulare();
  } catch (err) {
    formularFormMessage.textContent = err.message;
    formularFormMessage.classList.add("error");
  }
});

// Formular bearbeiten

const editFormularDialog = document.getElementById("editFormularDialog");
const editFormularForm = document.getElementById("editFormularForm");
const editFormularFormMessage = document.getElementById("editFormularFormMessage");
const editFormFachbereicheCheckboxes = document.getElementById("editFormFachbereicheCheckboxes");
const editFormularCancelBtn = document.getElementById("editFormularCancelBtn");
const editFormAktuelleDatei = document.getElementById("editFormAktuelleDatei");
const editFormErsetzenDatei = document.getElementById("editFormErsetzenDatei");
const editFormErsetzenBtn = document.getElementById("editFormErsetzenBtn");

let editingFormularId = null;

function openEditFormularDialog(formular) {
  editingFormularId = formular.ID;
  editFormularForm.elements.QMKennung.value = formular.QMKennung;
  editFormularForm.elements.Titel.value = formular.Titel;
  editFormularForm.elements.Beschreibung.value = formular.Beschreibung;
  buildCheckboxGroup(editFormFachbereicheCheckboxes, formularFachbereicheCache, {
    labelKey: "BezeichnungLang",
    checkedIds: formular.Fachbereiche.map((f) => f.ID),
    selectAllLabel: "Alle Fachbereiche",
  });
  editFormAktuelleDatei.textContent = formular.Dateiname;
  editFormErsetzenDatei.value = "";
  editFormularFormMessage.textContent = "";
  editFormularFormMessage.className = "form-message";
  editFormularDialog.showModal();
}

editFormErsetzenBtn.addEventListener("click", () => {
  editFormErsetzenDatei.click();
});

editFormErsetzenDatei.addEventListener("change", async () => {
  const datei = editFormErsetzenDatei.files[0];
  if (!datei) {
    return;
  }

  editFormularFormMessage.textContent = "";
  editFormularFormMessage.className = "form-message";

  const formData = new FormData();
  formData.append("Datei", datei);

  try {
    const response = await fetch(`/api/formulare/${editingFormularId}/ersetzen`, {
      method: "POST",
      body: formData,
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Formular konnte nicht ersetzt werden.");
    }

    editFormAktuelleDatei.textContent = body.Dateiname;
    editFormularFormMessage.textContent = "Datei ersetzt.";
    editFormularFormMessage.classList.add("success");
    await loadFormulare();
  } catch (err) {
    editFormularFormMessage.textContent = err.message;
    editFormularFormMessage.classList.add("error");
  } finally {
    editFormErsetzenDatei.value = "";
  }
});

editFormularCancelBtn.addEventListener("click", () => {
  editFormularDialog.close();
});

editFormularForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(editFormularForm);
  const payload = {
    QMKennung: formData.get("QMKennung").trim(),
    Titel: formData.get("Titel").trim(),
    Beschreibung: formData.get("Beschreibung").trim(),
    FachbereichIDs: getCheckedValues(editFormFachbereicheCheckboxes),
  };

  editFormularFormMessage.textContent = "";
  editFormularFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/formulare/${editingFormularId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Formular konnte nicht aktualisiert werden.");
    }

    editFormularDialog.close();
    editingFormularId = null;
    await loadFormulare();
  } catch (err) {
    editFormularFormMessage.textContent = err.message;
    editFormularFormMessage.className = "form-message error";
  }
});

// Workflows

const workflowTableBody = document.getElementById("workflowTableBody");
const workflowNeuBtn = document.getElementById("workflowNeuBtn");

const workflowZurueckBtn = document.getElementById("workflowZurueckBtn");
const workflowDetailTitel = document.getElementById("workflowDetailTitel");
const workflowDetailForm = document.getElementById("workflowDetailForm");
const workflowDetailFormMessage = document.getElementById("workflowDetailFormMessage");
const workflowDetailRollenCheckboxes = document.getElementById("workflowDetailRollenCheckboxes");
const workflowArbeitsschritteContainer = document.getElementById("workflowArbeitsschritteContainer");
const workflowArbeitsschrittHinzufuegenBtn = document.getElementById("workflowArbeitsschrittHinzufuegenBtn");
const workflowDetailDeleteBtn = document.getElementById("workflowDetailDeleteBtn");

let workflowFachbereicheCache = [];
let workflowFormulareCache = [];
let workflowRollenCache = [];
let workflowsInitialized = false;
let currentWorkflowId = null;
let currentWorkflowDetail = null;

async function loadWorkflowFachbereicheCache() {
  try {
    const response = await fetch("/api/fachbereiche");
    if (!response.ok) {
      throw new Error("Fachbereiche konnten nicht geladen werden.");
    }
    workflowFachbereicheCache = await response.json();
  } catch (err) {
    console.error(err);
    workflowFachbereicheCache = [];
  }
}

async function loadWorkflowFormulareCache() {
  try {
    const response = await fetch("/api/formulare");
    if (!response.ok) {
      throw new Error("Formulare konnten nicht geladen werden.");
    }
    workflowFormulareCache = await response.json();
  } catch (err) {
    console.error(err);
    workflowFormulareCache = [];
  }
}

async function loadWorkflowRollenCache() {
  try {
    const response = await fetch("/api/rollen");
    if (!response.ok) {
      throw new Error("Rollen konnten nicht geladen werden.");
    }
    workflowRollenCache = await response.json();
  } catch (err) {
    console.error(err);
    workflowRollenCache = [];
  }
}

function canDeleteWorkflow() {
  return currentUser && currentUser.roles.includes("Administrator");
}

function buildFormularAuswahl(container, formulare, checkedIds = []) {
  container.innerHTML = "";
  formulare.forEach((formular) => {
    const row = document.createElement("div");
    row.className = "formular-auswahl-row";
    row.dataset.titel = formular.Titel.toLowerCase();

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = formular.ID;
    checkbox.checked = checkedIds.includes(formular.ID);
    label.appendChild(checkbox);
    label.append(` ${formular.Titel}`);
    row.appendChild(label);

    const downloadLink = document.createElement("a");
    downloadLink.className = "formular-auswahl-download";
    downloadLink.href = `/api/formulare/${formular.ID}/datei`;
    downloadLink.title = "Herunterladen";
    downloadLink.setAttribute("aria-label", `${formular.Titel} herunterladen`);
    downloadLink.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    row.appendChild(downloadLink);

    container.appendChild(row);
  });
}

function buildFormularAuswahlBlock(formulare, checkedIds = []) {
  const details = document.createElement("details");
  details.className = "collapsible-form checkbox-group-collapsible formular-auswahl-details";

  const summary = document.createElement("summary");
  const anzahlSpan = document.createElement("span");
  anzahlSpan.className = "checkbox-group-anzahl";
  summary.append("Zugeordnete Formulare ", anzahlSpan);
  details.appendChild(summary);

  const sucheInput = document.createElement("input");
  sucheInput.type = "text";
  sucheInput.className = "checkbox-group-suche";
  sucheInput.placeholder = "Formular suchen…";
  details.appendChild(sucheInput);

  const container = document.createElement("div");
  container.className = "checkbox-group arbeitsschritt-formulare";
  buildFormularAuswahl(container, formulare, checkedIds);
  details.appendChild(container);

  function aktualisiereAnzahl() {
    const anzahl = getCheckedValues(container).length;
    anzahlSpan.textContent = anzahl > 0 ? `(${anzahl} ausgewählt)` : "";
  }
  aktualisiereAnzahl();
  container.addEventListener("change", aktualisiereAnzahl);

  sucheInput.addEventListener("input", () => {
    const suchbegriff = sucheInput.value.trim().toLowerCase();
    container.querySelectorAll(".formular-auswahl-row").forEach((row) => {
      row.style.display = !suchbegriff || row.dataset.titel.includes(suchbegriff) ? "" : "none";
    });
  });

  return details;
}

function renumberArbeitsschritte() {
  workflowArbeitsschritteContainer.querySelectorAll(".arbeitsschritt-block").forEach((block, index) => {
    block.querySelector(".arbeitsschritt-nummer").textContent = `Arbeitsschritt ${index + 1}`;
  });
}

function buildArbeitsschrittBlock(arbeitsschritt = null) {
  const block = document.createElement("div");
  block.className = "arbeitsschritt-block";

  const header = document.createElement("div");
  header.className = "arbeitsschritt-block-header";

  const nummer = document.createElement("span");
  nummer.className = "arbeitsschritt-nummer";
  header.appendChild(nummer);

  const actions = document.createElement("div");
  actions.className = "arbeitsschritt-block-actions";

  const upBtn = document.createElement("button");
  upBtn.type = "button";
  upBtn.className = "icon-btn";
  upBtn.title = "Nach oben verschieben";
  upBtn.setAttribute("aria-label", "Arbeitsschritt nach oben verschieben");
  upBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="18 15 12 9 6 15"></polyline>
    </svg>
  `;
  upBtn.addEventListener("click", () => {
    const prev = block.previousElementSibling;
    if (prev) {
      workflowArbeitsschritteContainer.insertBefore(block, prev);
      renumberArbeitsschritte();
    }
  });

  const downBtn = document.createElement("button");
  downBtn.type = "button";
  downBtn.className = "icon-btn";
  downBtn.title = "Nach unten verschieben";
  downBtn.setAttribute("aria-label", "Arbeitsschritt nach unten verschieben");
  downBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  downBtn.addEventListener("click", () => {
    const next = block.nextElementSibling;
    if (next) {
      workflowArbeitsschritteContainer.insertBefore(next, block);
      renumberArbeitsschritte();
    }
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "icon-btn";
  removeBtn.title = "Arbeitsschritt entfernen";
  removeBtn.setAttribute("aria-label", "Arbeitsschritt entfernen");
  removeBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
    </svg>
  `;
  removeBtn.addEventListener("click", () => {
    block.remove();
    renumberArbeitsschritte();
  });

  actions.append(upBtn, downBtn, removeBtn);
  header.appendChild(actions);
  block.appendChild(header);

  [
    { feld: "Kennung", label: "Kennung", maxlength: 50 },
    { feld: "QMKennung", label: "QM-Kennung", maxlength: 100 },
    { feld: "Bezeichnung", label: "Bezeichnung", maxlength: 255 },
  ].forEach(({ feld, label, maxlength }) => {
    const row = document.createElement("div");
    row.className = "form-row";
    const labelEl = document.createElement("label");
    labelEl.textContent = label;
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = maxlength;
    input.dataset.field = feld;
    input.required = true;
    if (arbeitsschritt) {
      input.value = arbeitsschritt[feld] || "";
    }
    row.append(labelEl, input);
    block.appendChild(row);
  });

  const beschreibungRow = document.createElement("div");
  beschreibungRow.className = "form-row";
  const beschreibungLabel = document.createElement("label");
  beschreibungLabel.textContent = "Beschreibung";
  const beschreibungInput = document.createElement("textarea");
  beschreibungInput.rows = 3;
  beschreibungInput.dataset.field = "Beschreibung";
  beschreibungInput.required = true;
  if (arbeitsschritt) {
    beschreibungInput.value = arbeitsschritt.Beschreibung || "";
  }
  beschreibungRow.append(beschreibungLabel, beschreibungInput);
  block.appendChild(beschreibungRow);

  const verantwortungRow = document.createElement("div");
  verantwortungRow.className = "form-row";
  const verantwortungLabel = document.createElement("label");
  verantwortungLabel.textContent = "Verantwortung";
  const verantwortungSelect = document.createElement("select");
  verantwortungSelect.dataset.field = "VerantwortungRolleID";
  const leereOption = document.createElement("option");
  leereOption.value = "";
  leereOption.textContent = "– keine –";
  verantwortungSelect.appendChild(leereOption);
  workflowRollenCache.forEach((rolle) => {
    const option = document.createElement("option");
    option.value = rolle.ID;
    option.textContent = rolle.Bezeichnung;
    verantwortungSelect.appendChild(option);
  });
  if (arbeitsschritt && arbeitsschritt.VerantwortungRolleID) {
    verantwortungSelect.value = arbeitsschritt.VerantwortungRolleID;
  }
  verantwortungRow.append(verantwortungLabel, verantwortungSelect);
  block.appendChild(verantwortungRow);

  const fachbereichRow = document.createElement("div");
  fachbereichRow.className = "form-row";
  const fachbereichLabel = document.createElement("label");
  fachbereichLabel.textContent = "Zugewiesene Fachbereiche";
  const fachbereichContainer = document.createElement("div");
  fachbereichContainer.className = "checkbox-group arbeitsschritt-fachbereiche";
  buildCheckboxGroup(fachbereichContainer, workflowFachbereicheCache, {
    labelKey: "BezeichnungLang",
    checkedIds: arbeitsschritt ? arbeitsschritt.Fachbereiche.map((f) => f.ID) : [],
    selectAllLabel: "Alle Fachbereiche",
  });
  fachbereichRow.append(fachbereichLabel, fachbereichContainer);
  block.appendChild(fachbereichRow);

  const formularRow = document.createElement("div");
  formularRow.className = "form-row";
  formularRow.appendChild(
    buildFormularAuswahlBlock(workflowFormulareCache, arbeitsschritt ? arbeitsschritt.Formulare.map((f) => f.ID) : [])
  );
  block.appendChild(formularRow);

  return block;
}

workflowArbeitsschrittHinzufuegenBtn.addEventListener("click", () => {
  workflowArbeitsschritteContainer.appendChild(buildArbeitsschrittBlock(null));
  renumberArbeitsschritte();
});

async function ensureWorkflowsInitialized() {
  if (!workflowsInitialized) {
    workflowsInitialized = true;
    await Promise.all([loadWorkflowFachbereicheCache(), loadWorkflowFormulareCache(), loadWorkflowRollenCache()]);
  }
  await loadWorkflows();
}

function openWorkflowDetail(workflow) {
  currentWorkflowId = workflow ? workflow.ID : null;
  if (window.location.hash === "#workflows-detail") {
    showPage("workflows-detail");
  } else {
    window.location.hash = "workflows-detail";
  }
}

workflowNeuBtn.addEventListener("click", () => openWorkflowDetail(null));

async function loadWorkflows() {
  workflowTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 6;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  workflowTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/workflows");
    if (!response.ok) {
      throw new Error("Workflows konnten nicht geladen werden.");
    }
    const workflows = await response.json();

    workflowTableBody.innerHTML = "";

    if (workflows.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.textContent = "Noch keine Workflows vorhanden.";
      emptyRow.appendChild(emptyCell);
      workflowTableBody.appendChild(emptyRow);
      return;
    }

    workflows.forEach((workflow) => {
      const row = document.createElement("tr");

      const kennungCell = document.createElement("td");
      kennungCell.textContent = workflow.Kennung;

      const qmCell = document.createElement("td");
      qmCell.textContent = workflow.QMKennung;

      const bezeichnungCell = document.createElement("td");
      bezeichnungCell.textContent = workflow.Bezeichnung;

      const rollenCell = document.createElement("td");
      rollenCell.textContent = workflow.Rollen.map((r) => r.Bezeichnung).join(", ");

      const anzahlCell = document.createElement("td");
      anzahlCell.textContent = workflow.ArbeitsschritteAnzahl;

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.title = "Bearbeiten";
      editBtn.setAttribute("aria-label", `Workflow ${workflow.Bezeichnung} bearbeiten`);
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openWorkflowDetail(workflow));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.title = "Löschen";
      deleteBtn.setAttribute("aria-label", `Workflow ${workflow.Bezeichnung} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: workflow.Bezeichnung,
          endpoint: `/api/workflows/${workflow.ID}`,
          reload: loadWorkflows,
        })
      );

      actionsWrap.append(editBtn);
      if (canDeleteWorkflow()) {
        actionsWrap.append(deleteBtn);
      }
      actionsCell.appendChild(actionsWrap);

      row.append(kennungCell, qmCell, bezeichnungCell, rollenCell, anzahlCell, actionsCell);
      workflowTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    workflowTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 6;
    errorCell.textContent = "Fehler beim Laden der Workflows.";
    errorRow.appendChild(errorCell);
    workflowTableBody.appendChild(errorRow);
  }
}

function fillWorkflowDetailForm(detail) {
  workflowDetailTitel.textContent = detail ? "Workflow bearbeiten" : "Neuer Workflow";
  workflowDetailForm.elements.Kennung.value = detail ? detail.Kennung : "";
  workflowDetailForm.elements.QMKennung.value = detail ? detail.QMKennung : "";
  workflowDetailForm.elements.Bezeichnung.value = detail ? detail.Bezeichnung : "";
  workflowDetailForm.elements.Beschreibung.value = detail ? detail.Beschreibung : "";

  buildCheckboxGroup(workflowDetailRollenCheckboxes, workflowRollenCache, {
    labelKey: "Bezeichnung",
    checkedIds: detail ? detail.Rollen.map((r) => r.ID) : [],
  });

  workflowArbeitsschritteContainer.innerHTML = "";
  if (detail) {
    detail.Arbeitsschritte.forEach((arbeitsschritt) => {
      workflowArbeitsschritteContainer.appendChild(buildArbeitsschrittBlock(arbeitsschritt));
    });
  }
  renumberArbeitsschritte();

  workflowDetailDeleteBtn.hidden = !detail || !canDeleteWorkflow();
}

async function loadWorkflowDetailPage(id) {
  workflowDetailFormMessage.textContent = "";
  workflowDetailFormMessage.className = "form-message";
  currentWorkflowDetail = null;

  if (workflowFachbereicheCache.length === 0) {
    await loadWorkflowFachbereicheCache();
  }
  if (workflowFormulareCache.length === 0) {
    await loadWorkflowFormulareCache();
  }
  if (workflowRollenCache.length === 0) {
    await loadWorkflowRollenCache();
  }

  if (!id) {
    fillWorkflowDetailForm(null);
    return;
  }

  try {
    const response = await fetch(`/api/workflows/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Workflow konnte nicht geladen werden.");
    }
    currentWorkflowDetail = await response.json();
    fillWorkflowDetailForm(currentWorkflowDetail);
  } catch (err) {
    console.error(err);
    workflowDetailFormMessage.textContent = err.message;
    workflowDetailFormMessage.className = "form-message error";
  }
}

function collectWorkflowPayload() {
  const kennung = workflowDetailForm.elements.Kennung.value.trim();
  const qmKennung = workflowDetailForm.elements.QMKennung.value.trim();
  const bezeichnung = workflowDetailForm.elements.Bezeichnung.value.trim();
  const beschreibung = workflowDetailForm.elements.Beschreibung.value.trim();
  const rolleIds = getCheckedValues(workflowDetailRollenCheckboxes);

  if (!kennung || !qmKennung || !bezeichnung || !beschreibung || rolleIds.length === 0) {
    workflowDetailFormMessage.textContent =
      "Kennung, QM-Kennung, Bezeichnung, Beschreibung und mindestens eine zugewiesene Rolle sind erforderlich.";
    workflowDetailFormMessage.className = "form-message error";
    return null;
  }

  const arbeitsschritte = [];
  const bloecke = workflowArbeitsschritteContainer.querySelectorAll(".arbeitsschritt-block");

  for (const block of bloecke) {
    const asKennung = block.querySelector('[data-field="Kennung"]').value.trim();
    const asQmKennung = block.querySelector('[data-field="QMKennung"]').value.trim();
    const asBezeichnung = block.querySelector('[data-field="Bezeichnung"]').value.trim();
    const asBeschreibung = block.querySelector('[data-field="Beschreibung"]').value.trim();
    const verantwortungRolleId = block.querySelector('[data-field="VerantwortungRolleID"]').value;
    const fachbereichIds = getCheckedValues(block.querySelector(".arbeitsschritt-fachbereiche"));
    const formularIds = getCheckedValues(block.querySelector(".arbeitsschritt-formulare"));

    if (!asKennung || !asQmKennung || !asBezeichnung || !asBeschreibung || fachbereichIds.length === 0) {
      workflowDetailFormMessage.textContent =
        "Jeder Arbeitsschritt benötigt Kennung, QM-Kennung, Bezeichnung, Beschreibung und mindestens einen zugewiesenen Fachbereich.";
      workflowDetailFormMessage.className = "form-message error";
      return null;
    }

    arbeitsschritte.push({
      Kennung: asKennung,
      QMKennung: asQmKennung,
      Bezeichnung: asBezeichnung,
      Beschreibung: asBeschreibung,
      VerantwortungRolleID: verantwortungRolleId ? Number(verantwortungRolleId) : null,
      FachbereichIDs: fachbereichIds,
      FormularIDs: formularIds,
    });
  }

  if (new Set(arbeitsschritte.map((a) => a.Kennung)).size !== arbeitsschritte.length) {
    workflowDetailFormMessage.textContent = "Jeder Arbeitsschritt benötigt eine eindeutige Kennung.";
    workflowDetailFormMessage.className = "form-message error";
    return null;
  }

  return {
    Kennung: kennung,
    QMKennung: qmKennung,
    Bezeichnung: bezeichnung,
    Beschreibung: beschreibung,
    RolleIDs: rolleIds,
    Arbeitsschritte: arbeitsschritte,
  };
}

workflowZurueckBtn.addEventListener("click", () => {
  window.location.hash = "workflows";
});

workflowDetailForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  workflowDetailFormMessage.textContent = "";
  workflowDetailFormMessage.className = "form-message";

  const payload = collectWorkflowPayload();
  if (!payload) {
    return;
  }

  try {
    const response = await fetch(currentWorkflowId ? `/api/workflows/${currentWorkflowId}` : "/api/workflows", {
      method: currentWorkflowId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Workflow konnte nicht gespeichert werden.");
    }

    currentWorkflowId = body.ID;
    currentWorkflowDetail = body;
    fillWorkflowDetailForm(body);
    workflowDetailFormMessage.textContent = "Gespeichert.";
    workflowDetailFormMessage.classList.add("success");
  } catch (err) {
    workflowDetailFormMessage.textContent = err.message;
    workflowDetailFormMessage.classList.add("error");
  }
});

workflowDetailDeleteBtn.addEventListener("click", () => {
  if (!currentWorkflowDetail) {
    return;
  }
  openDeleteDialog({
    name: currentWorkflowDetail.Bezeichnung,
    endpoint: `/api/workflows/${currentWorkflowDetail.ID}`,
    reload: () => {
      window.location.hash = "workflows";
    },
  });
});

// Gruppen

const gruppenTableBody = document.getElementById("gruppenTableBody");
const gruppeForm = document.getElementById("gruppeForm");
const gruppeFormMessage = document.getElementById("gruppeFormMessage");
const grpFachbereichSelect = document.getElementById("grpFachbereichID");

async function loadFachbereichOptionsInto(selectElement) {
  try {
    const response = await fetch("/api/fachbereiche");
    if (!response.ok) {
      throw new Error("Fachbereiche konnten nicht geladen werden.");
    }
    const fachbereiche = await response.json();

    selectElement.querySelectorAll("option[data-fachbereich]").forEach((option) => option.remove());

    fachbereiche.forEach((fachbereich) => {
      const option = document.createElement("option");
      option.value = fachbereich.ID;
      option.textContent = fachbereich.BezeichnungLang;
      option.dataset.fachbereich = "true";
      selectElement.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadGruppen() {
  gruppenTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 4;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  gruppenTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/gruppen");
    if (!response.ok) {
      throw new Error("Gruppen konnten nicht geladen werden.");
    }
    const gruppen = await response.json();

    gruppenTableBody.innerHTML = "";

    if (gruppen.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 4;
      emptyCell.textContent = "Noch keine Gruppen vorhanden.";
      emptyRow.appendChild(emptyCell);
      gruppenTableBody.appendChild(emptyRow);
      return;
    }

    gruppen.forEach((gruppe) => {
      const row = document.createElement("tr");

      const bezeichnungCell = document.createElement("td");
      bezeichnungCell.textContent = gruppe.Bezeichnung;

      const kennungCell = document.createElement("td");
      kennungCell.textContent = gruppe.Kennung || "";

      const fachbereichCell = document.createElement("td");
      fachbereichCell.textContent = gruppe.FachbereichBezeichnung || "";

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.setAttribute("aria-label", `${gruppe.Bezeichnung} bearbeiten`);
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditGruppeDialog(gruppe));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.setAttribute("aria-label", `${gruppe.Bezeichnung} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: gruppe.Bezeichnung,
          endpoint: `/api/gruppen/${gruppe.ID}`,
          reload: loadGruppen,
        })
      );

      actionsWrap.append(editBtn);
      if (canDeleteGruppe(gruppe)) {
        actionsWrap.append(deleteBtn);
      }
      actionsCell.appendChild(actionsWrap);

      row.append(bezeichnungCell, kennungCell, fachbereichCell, actionsCell);
      gruppenTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    gruppenTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 4;
    errorCell.textContent = "Fehler beim Laden der Gruppen.";
    errorRow.appendChild(errorCell);
    gruppenTableBody.appendChild(errorRow);
  }
}

gruppeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(gruppeForm);
  const payload = {
    Bezeichnung: formData.get("Bezeichnung").trim(),
    Kennung: formData.get("Kennung").trim(),
    FachbereichID: formData.get("FachbereichID"),
  };

  gruppeFormMessage.textContent = "";
  gruppeFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/gruppen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Gruppe konnte nicht gespeichert werden.");
    }

    gruppeForm.reset();
    gruppeFormMessage.textContent = "Gruppe gespeichert.";
    gruppeFormMessage.classList.add("success");
    await loadGruppen();
  } catch (err) {
    gruppeFormMessage.textContent = err.message;
    gruppeFormMessage.classList.add("error");
  }
});

// Gruppe bearbeiten

const editGruppeDialog = document.getElementById("editGruppeDialog");
const editGruppeForm = document.getElementById("editGruppeForm");
const editGruppeFormMessage = document.getElementById("editGruppeFormMessage");
const editGruppeCancelBtn = document.getElementById("editGruppeCancelBtn");
const editGrpFachbereichSelect = document.getElementById("editGrpFachbereichID");

let editingGruppeId = null;

function openEditGruppeDialog(gruppe) {
  editingGruppeId = gruppe.ID;
  editGruppeForm.elements.Bezeichnung.value = gruppe.Bezeichnung;
  editGruppeForm.elements.Kennung.value = gruppe.Kennung || "";
  editGrpFachbereichSelect.value = gruppe.FachbereichID || "";
  editGruppeFormMessage.textContent = "";
  editGruppeFormMessage.className = "form-message";
  editGruppeDialog.showModal();
}

editGruppeCancelBtn.addEventListener("click", () => {
  editGruppeDialog.close();
});

editGruppeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(editGruppeForm);
  const payload = {
    Bezeichnung: formData.get("Bezeichnung").trim(),
    Kennung: formData.get("Kennung").trim(),
    FachbereichID: formData.get("FachbereichID"),
  };

  editGruppeFormMessage.textContent = "";
  editGruppeFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/gruppen/${editingGruppeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Gruppe konnte nicht aktualisiert werden.");
    }

    editGruppeDialog.close();
    editingGruppeId = null;
    await loadGruppen();
  } catch (err) {
    editGruppeFormMessage.textContent = err.message;
    editGruppeFormMessage.className = "form-message error";
  }
});

// Maßnahmetypen

const massnahmetypenTableBody = document.getElementById("massnahmetypenTableBody");
const massnahmetypForm = document.getElementById("massnahmetypForm");
const massnahmetypFormMessage = document.getElementById("massnahmetypFormMessage");

async function loadMassnahmetypOptionsInto(selectElement) {
  try {
    const response = await fetch("/api/massnahmetypen");
    if (!response.ok) {
      throw new Error("Maßnahmetypen konnten nicht geladen werden.");
    }
    const massnahmetypen = await response.json();

    selectElement.querySelectorAll("option[data-massnahmetyp]").forEach((option) => option.remove());

    massnahmetypen.forEach((massnahmetyp) => {
      const option = document.createElement("option");
      option.value = massnahmetyp.ID;
      option.textContent = massnahmetyp.Bezeichnung;
      option.dataset.massnahmetyp = "true";
      selectElement.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadMassnahmetypen() {
  massnahmetypenTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 4;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  massnahmetypenTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/massnahmetypen");
    if (!response.ok) {
      throw new Error("Maßnahmetypen konnten nicht geladen werden.");
    }
    const massnahmetypen = await response.json();

    massnahmetypenTableBody.innerHTML = "";

    if (massnahmetypen.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 4;
      emptyCell.textContent = "Noch keine Maßnahmetypen vorhanden.";
      emptyRow.appendChild(emptyCell);
      massnahmetypenTableBody.appendChild(emptyRow);
      return;
    }

    massnahmetypen.forEach((massnahmetyp) => {
      const row = document.createElement("tr");

      const bezeichnungCell = document.createElement("td");
      bezeichnungCell.textContent = massnahmetyp.Bezeichnung;

      const kuerzelCell = document.createElement("td");
      kuerzelCell.textContent = massnahmetyp.Kuerzel;

      const kennungCell = document.createElement("td");
      kennungCell.textContent = massnahmetyp.Kennung || "";

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.setAttribute("aria-label", `${massnahmetyp.Bezeichnung} bearbeiten`);
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditMassnahmetypDialog(massnahmetyp));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.setAttribute("aria-label", `${massnahmetyp.Bezeichnung} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: massnahmetyp.Bezeichnung,
          endpoint: `/api/massnahmetypen/${massnahmetyp.ID}`,
          reload: loadMassnahmetypen,
        })
      );

      actionsWrap.append(editBtn, deleteBtn);
      actionsCell.appendChild(actionsWrap);

      row.append(bezeichnungCell, kuerzelCell, kennungCell, actionsCell);
      massnahmetypenTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    massnahmetypenTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 4;
    errorCell.textContent = "Fehler beim Laden der Maßnahmetypen.";
    errorRow.appendChild(errorCell);
    massnahmetypenTableBody.appendChild(errorRow);
  }

  loadMassnahmetypOptionsInto(mnMassnahmetypSelect);
  loadMassnahmetypOptionsInto(editMnMassnahmetypSelect);
}

massnahmetypForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(massnahmetypForm);
  const payload = {
    Bezeichnung: formData.get("Bezeichnung").trim(),
    Beschreibung: formData.get("Beschreibung").trim(),
    Kuerzel: formData.get("Kuerzel").trim(),
    Kennung: formData.get("Kennung").trim(),
  };

  massnahmetypFormMessage.textContent = "";
  massnahmetypFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/massnahmetypen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Maßnahmetyp konnte nicht gespeichert werden.");
    }

    massnahmetypForm.reset();
    massnahmetypFormMessage.textContent = "Maßnahmetyp gespeichert.";
    massnahmetypFormMessage.classList.add("success");
    await loadMassnahmetypen();
  } catch (err) {
    massnahmetypFormMessage.textContent = err.message;
    massnahmetypFormMessage.classList.add("error");
  }
});

// Maßnahmetyp bearbeiten

const editMassnahmetypDialog = document.getElementById("editMassnahmetypDialog");
const editMassnahmetypForm = document.getElementById("editMassnahmetypForm");
const editMassnahmetypFormMessage = document.getElementById("editMassnahmetypFormMessage");
const editMassnahmetypCancelBtn = document.getElementById("editMassnahmetypCancelBtn");

let editingMassnahmetypId = null;

function openEditMassnahmetypDialog(massnahmetyp) {
  editingMassnahmetypId = massnahmetyp.ID;
  editMassnahmetypForm.elements.Bezeichnung.value = massnahmetyp.Bezeichnung;
  editMassnahmetypForm.elements.Beschreibung.value = massnahmetyp.Beschreibung || "";
  editMassnahmetypForm.elements.Kuerzel.value = massnahmetyp.Kuerzel;
  editMassnahmetypForm.elements.Kennung.value = massnahmetyp.Kennung || "";
  editMassnahmetypFormMessage.textContent = "";
  editMassnahmetypFormMessage.className = "form-message";
  editMassnahmetypDialog.showModal();
}

editMassnahmetypCancelBtn.addEventListener("click", () => {
  editMassnahmetypDialog.close();
});

editMassnahmetypForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(editMassnahmetypForm);
  const payload = {
    Bezeichnung: formData.get("Bezeichnung").trim(),
    Beschreibung: formData.get("Beschreibung").trim(),
    Kuerzel: formData.get("Kuerzel").trim(),
    Kennung: formData.get("Kennung").trim(),
  };

  editMassnahmetypFormMessage.textContent = "";
  editMassnahmetypFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/massnahmetypen/${editingMassnahmetypId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Maßnahmetyp konnte nicht aktualisiert werden.");
    }

    editMassnahmetypDialog.close();
    editingMassnahmetypId = null;
    await loadMassnahmetypen();
  } catch (err) {
    editMassnahmetypFormMessage.textContent = err.message;
    editMassnahmetypFormMessage.className = "form-message error";
  }
});

// Maßnahmen

const massnahmenTableBody = document.getElementById("massnahmenTableBody");
const massnahmeForm = document.getElementById("massnahmeForm");
const massnahmeFormMessage = document.getElementById("massnahmeFormMessage");
const mnGruppeSelect = document.getElementById("mnGruppeID");
const mnMassnahmetypSelect = document.getElementById("mnMassnahmetypID");

const editMassnahmeDialog = document.getElementById("editMassnahmeDialog");
const editMassnahmeForm = document.getElementById("editMassnahmeForm");
const editMassnahmeFormMessage = document.getElementById("editMassnahmeFormMessage");
const editMassnahmeCancelBtn = document.getElementById("editMassnahmeCancelBtn");
const editMnGruppeSelect = document.getElementById("editMnGruppeID");
const editMnMassnahmetypSelect = document.getElementById("editMnMassnahmetypID");

async function loadGruppeOptionsInto(selectElement) {
  try {
    const response = await fetch("/api/gruppen");
    if (!response.ok) {
      throw new Error("Gruppen konnten nicht geladen werden.");
    }
    const gruppen = await response.json();

    selectElement.querySelectorAll("option[data-gruppe]").forEach((option) => option.remove());

    gruppen.forEach((gruppe) => {
      const option = document.createElement("option");
      option.value = gruppe.ID;
      option.textContent = gruppe.Bezeichnung;
      option.dataset.gruppe = "true";
      selectElement.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadMassnahmen() {
  massnahmenTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 8;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  massnahmenTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/massnahmen");
    if (!response.ok) {
      throw new Error("Maßnahmen konnten nicht geladen werden.");
    }
    const massnahmen = await response.json();

    massnahmenTableBody.innerHTML = "";

    if (massnahmen.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 8;
      emptyCell.textContent = "Noch keine Maßnahmen vorhanden.";
      emptyRow.appendChild(emptyCell);
      massnahmenTableBody.appendChild(emptyRow);
      return;
    }

    massnahmen.forEach((massnahme) => {
      const row = document.createElement("tr");

      const bezeichnungCell = document.createElement("td");
      bezeichnungCell.textContent = massnahme.Bezeichnung;

      const vtCell = document.createElement("td");
      vtCell.textContent = massnahme.VT;

      const gruppeCell = document.createElement("td");
      gruppeCell.textContent = massnahme.GruppeBezeichnung || "";

      const massnahmetypCell = document.createElement("td");
      massnahmetypCell.textContent = massnahme.MassnahmetypBezeichnung || "";

      const zertCell = document.createElement("td");
      zertCell.textContent = formatDateDE(massnahme.ZertDatum);

      const startCell = document.createElement("td");
      startCell.textContent = formatDateDE(massnahme.PlanStart);

      const endeCell = document.createElement("td");
      endeCell.textContent = formatDateDE(massnahme.PlanEnde);

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.setAttribute("aria-label", `${massnahme.Bezeichnung} bearbeiten`);
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditMassnahmeDialog(massnahme));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.setAttribute("aria-label", `${massnahme.Bezeichnung} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: massnahme.Bezeichnung,
          endpoint: `/api/massnahmen/${massnahme.ID}`,
          reload: loadMassnahmen,
        })
      );

      actionsWrap.append(editBtn);
      if (canDeleteMassnahmenOderTeilnehmer()) {
        actionsWrap.append(deleteBtn);
      }
      actionsCell.appendChild(actionsWrap);

      row.append(bezeichnungCell, vtCell, gruppeCell, massnahmetypCell, zertCell, startCell, endeCell, actionsCell);
      massnahmenTableBody.appendChild(row);
    });

    loadMassnahmeOptionsInto(tnMassnahmeSelect, { includeVt: true });
    loadMassnahmeOptionsInto(editTnMassnahmeSelect, { includeVt: true });
  } catch (err) {
    console.error(err);
    massnahmenTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 8;
    errorCell.textContent = "Fehler beim Laden der Maßnahmen.";
    errorRow.appendChild(errorCell);
    massnahmenTableBody.appendChild(errorRow);
  }
}

massnahmeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(massnahmeForm);
  const payload = {
    Bezeichnung: formData.get("Bezeichnung").trim(),
    VT: formData.get("VT").trim(),
    GruppeID: formData.get("GruppeID"),
    MassnahmetypID: formData.get("MassnahmetypID"),
    ZertDatum: formData.get("ZertDatum"),
    PlanStart: formData.get("PlanStart"),
    PlanEnde: formData.get("PlanEnde"),
  };

  massnahmeFormMessage.textContent = "";
  massnahmeFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/massnahmen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Maßnahme konnte nicht gespeichert werden.");
    }

    massnahmeForm.reset();
    massnahmeFormMessage.textContent = "Maßnahme gespeichert.";
    massnahmeFormMessage.classList.add("success");
    await loadMassnahmen();
  } catch (err) {
    massnahmeFormMessage.textContent = err.message;
    massnahmeFormMessage.classList.add("error");
  }
});

let editingMassnahmeId = null;

function openEditMassnahmeDialog(massnahme) {
  editingMassnahmeId = massnahme.ID;
  editMassnahmeForm.elements.Bezeichnung.value = massnahme.Bezeichnung;
  editMassnahmeForm.elements.VT.value = massnahme.VT;
  editMnGruppeSelect.value = massnahme.GruppeID || "";
  editMnMassnahmetypSelect.value = massnahme.MassnahmetypID || "";
  editMassnahmeForm.elements.ZertDatum.value = massnahme.ZertDatum;
  editMassnahmeForm.elements.PlanStart.value = massnahme.PlanStart;
  editMassnahmeForm.elements.PlanEnde.value = massnahme.PlanEnde;
  editMassnahmeFormMessage.textContent = "";
  editMassnahmeFormMessage.className = "form-message";
  editMassnahmeDialog.showModal();
}

editMassnahmeCancelBtn.addEventListener("click", () => {
  editMassnahmeDialog.close();
});

editMassnahmeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(editMassnahmeForm);
  const payload = {
    Bezeichnung: formData.get("Bezeichnung").trim(),
    VT: formData.get("VT").trim(),
    GruppeID: formData.get("GruppeID"),
    MassnahmetypID: formData.get("MassnahmetypID"),
    ZertDatum: formData.get("ZertDatum"),
    PlanStart: formData.get("PlanStart"),
    PlanEnde: formData.get("PlanEnde"),
  };

  editMassnahmeFormMessage.textContent = "";
  editMassnahmeFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/massnahmen/${editingMassnahmeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Maßnahme konnte nicht aktualisiert werden.");
    }

    editMassnahmeDialog.close();
    editingMassnahmeId = null;
    await loadMassnahmen();
  } catch (err) {
    editMassnahmeFormMessage.textContent = err.message;
    editMassnahmeFormMessage.className = "form-message error";
  }
});

// Teilnehmende

const teilnehmerTableBody = document.getElementById("teilnehmerTableBody");
const teilnehmerForm = document.getElementById("teilnehmerForm");
const teilnehmerFormMessage = document.getElementById("teilnehmerFormMessage");
const tnMassnahmeSelect = document.getElementById("tnMassnahmeID");

const editTeilnehmerDialog = document.getElementById("editTeilnehmerDialog");
const editTeilnehmerForm = document.getElementById("editTeilnehmerForm");
const editTeilnehmerFormMessage = document.getElementById("editTeilnehmerFormMessage");
const editTeilnehmerCancelBtn = document.getElementById("editTeilnehmerCancelBtn");
const editTnMassnahmeSelect = document.getElementById("editTnMassnahmeID");

const tnFachbereichFilter = document.getElementById("tnFachbereichFilter");
const tnGruppeFilter = document.getElementById("tnGruppeFilter");
const tnMassnahmeFilter = document.getElementById("tnMassnahmeFilter");
const tnVtFilter = document.getElementById("tnVtFilter");
const tnNameFilter = document.getElementById("tnNameFilter");
const tnResetFilterBtn = document.getElementById("tnResetFilterBtn");

let tnRowEntries = [];
let tnFilterEmptyRow = null;
let tnGruppen = [];
let tnMassnahmen = [];

async function loadTnGruppen() {
  try {
    const response = await fetch("/api/gruppen");
    if (!response.ok) {
      throw new Error("Gruppen konnten nicht geladen werden.");
    }
    tnGruppen = await response.json();
  } catch (err) {
    console.error(err);
    tnGruppen = [];
  }
}

async function loadTnMassnahmen() {
  try {
    const response = await fetch("/api/massnahmen");
    if (!response.ok) {
      throw new Error("Maßnahmen konnten nicht geladen werden.");
    }
    tnMassnahmen = await response.json();
  } catch (err) {
    console.error(err);
    tnMassnahmen = [];
  }
}

async function initTnFilterOptions() {
  await Promise.all([loadTnGruppen(), loadTnMassnahmen()]);
  refreshTnGruppeOptions();
  refreshTnMassnahmeOptions();
  refreshTnVtOptions();
}

function tnMassnahmenForFachbereichUndGruppe() {
  const fachbereichId = tnFachbereichFilter.value;
  const gruppeId = tnGruppeFilter.value;

  return tnMassnahmen.filter((massnahme) => {
    if (gruppeId) {
      return String(massnahme.GruppeID || "") === gruppeId;
    }
    if (fachbereichId) {
      const gruppe = tnGruppen.find((g) => g.ID === massnahme.GruppeID);
      return Boolean(gruppe) && String(gruppe.FachbereichID || "") === fachbereichId;
    }
    return true;
  });
}

function refreshTnGruppeOptions() {
  const fachbereichId = tnFachbereichFilter.value;
  const gruppen = fachbereichId
    ? tnGruppen.filter((g) => String(g.FachbereichID || "") === fachbereichId)
    : tnGruppen;

  const currentValue = tnGruppeFilter.value;
  tnGruppeFilter.querySelectorAll("option[data-gruppe]").forEach((option) => option.remove());

  gruppen
    .slice()
    .sort((a, b) => a.Bezeichnung.localeCompare(b.Bezeichnung, "de"))
    .forEach((gruppe) => {
      const option = document.createElement("option");
      option.value = gruppe.ID;
      option.textContent = gruppe.Bezeichnung;
      option.dataset.gruppe = "true";
      tnGruppeFilter.appendChild(option);
    });

  tnGruppeFilter.value = gruppen.some((g) => String(g.ID) === currentValue) ? currentValue : "";
}

function refreshTnMassnahmeOptions() {
  const bezeichnungen = [...new Set(tnMassnahmenForFachbereichUndGruppe().map((m) => m.Bezeichnung).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "de")
  );

  const currentValue = tnMassnahmeFilter.value;
  tnMassnahmeFilter.querySelectorAll("option[data-massnahme]").forEach((option) => option.remove());

  bezeichnungen.forEach((bezeichnung) => {
    const option = document.createElement("option");
    option.value = bezeichnung;
    option.textContent = bezeichnung;
    option.dataset.massnahme = "true";
    tnMassnahmeFilter.appendChild(option);
  });

  tnMassnahmeFilter.value = bezeichnungen.includes(currentValue) ? currentValue : "";
}

function refreshTnVtOptions() {
  const massnahmeBezeichnung = tnMassnahmeFilter.value;
  const relevant = tnMassnahmenForFachbereichUndGruppe().filter(
    (m) => !massnahmeBezeichnung || m.Bezeichnung === massnahmeBezeichnung
  );
  const vtValues = [...new Set(relevant.map((m) => m.VT).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de", { numeric: true })
  );

  const currentValue = tnVtFilter.value;
  tnVtFilter.querySelectorAll("option[data-vt]").forEach((option) => option.remove());

  vtValues.forEach((vt) => {
    const option = document.createElement("option");
    option.value = vt;
    option.textContent = vt;
    option.dataset.vt = "true";
    tnVtFilter.appendChild(option);
  });

  tnVtFilter.value = vtValues.includes(currentValue) ? currentValue : "";
}

function tnMatchesFilter(person) {
  const fachbereichId = tnFachbereichFilter.value;
  const gruppeId = tnGruppeFilter.value;
  const massnahmeBezeichnung = tnMassnahmeFilter.value;
  const vt = tnVtFilter.value;
  const nameQuery = tnNameFilter.value.trim().toLowerCase();

  if (fachbereichId && String(person.FachbereichID || "") !== fachbereichId) {
    return false;
  }
  if (gruppeId && String(person.GruppeID || "") !== gruppeId) {
    return false;
  }
  if (massnahmeBezeichnung && (person.MassnahmeBezeichnung || "") !== massnahmeBezeichnung) {
    return false;
  }
  if (vt && (person.VT || "") !== vt) {
    return false;
  }
  if (nameQuery) {
    const fullName = `${person.Vorname} ${person.Nachname}`.toLowerCase();
    if (!fullName.includes(nameQuery)) {
      return false;
    }
  }
  return true;
}

function applyTnFilters() {
  let visibleCount = 0;

  tnRowEntries.forEach(({ person, row }) => {
    const visible = tnMatchesFilter(person);
    row.style.display = visible ? "" : "none";
    if (visible) {
      visibleCount++;
    }
  });

  if (tnFilterEmptyRow) {
    tnFilterEmptyRow.style.display = visibleCount === 0 ? "" : "none";
  }
}

tnFachbereichFilter.addEventListener("change", () => {
  refreshTnGruppeOptions();
  refreshTnMassnahmeOptions();
  refreshTnVtOptions();
  applyTnFilters();
});

tnGruppeFilter.addEventListener("change", () => {
  refreshTnMassnahmeOptions();
  refreshTnVtOptions();
  applyTnFilters();
});

tnMassnahmeFilter.addEventListener("change", () => {
  refreshTnVtOptions();
  applyTnFilters();
});

tnVtFilter.addEventListener("change", applyTnFilters);
tnNameFilter.addEventListener("input", applyTnFilters);

tnResetFilterBtn.addEventListener("click", () => {
  tnFachbereichFilter.value = "";
  tnGruppeFilter.value = "";
  tnMassnahmeFilter.value = "";
  tnVtFilter.value = "";
  tnNameFilter.value = "";
  refreshTnGruppeOptions();
  refreshTnMassnahmeOptions();
  refreshTnVtOptions();
  applyTnFilters();
});

async function loadMassnahmeOptionsInto(selectElement, { includeVt = false } = {}) {
  try {
    const response = await fetch("/api/massnahmen");
    if (!response.ok) {
      throw new Error("Maßnahmen konnten nicht geladen werden.");
    }
    const massnahmen = await response.json();

    selectElement.querySelectorAll("option[data-massnahme]").forEach((option) => option.remove());

    massnahmen.forEach((massnahme) => {
      const option = document.createElement("option");
      option.value = massnahme.ID;
      option.textContent = includeVt ? `${massnahme.Bezeichnung} ${massnahme.VT}` : massnahme.Bezeichnung;
      option.dataset.massnahme = "true";
      selectElement.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

let tnAktivitaetSummary = new Map();

async function loadTnAktivitaetSummary() {
  try {
    const response = await fetch("/api/aktivitaeten/summary");
    if (!response.ok) {
      throw new Error("Aktivitäten-Übersicht konnte nicht geladen werden.");
    }
    const rows = await response.json();
    tnAktivitaetSummary = new Map(rows.map((row) => [row.TeilnehmerID, row]));
  } catch (err) {
    console.error(err);
    tnAktivitaetSummary = new Map();
  }
}

function updateAktivitaetBadge(badgeEl, teilnehmerId) {
  const summary = tnAktivitaetSummary.get(teilnehmerId);
  if (!summary || !summary.Anzahl) {
    badgeEl.hidden = true;
    return;
  }
  badgeEl.hidden = false;
  badgeEl.textContent = summary.Anzahl;
  badgeEl.classList.toggle("badge-aktuell", Boolean(summary.HatAktuelle));
}

async function refreshTnAktivitaetBadges() {
  await loadTnAktivitaetSummary();
  tnRowEntries.forEach(({ person, row }) => {
    const badge = row.querySelector(".aktivitaet-badge");
    if (badge) {
      updateAktivitaetBadge(badge, person.ID);
    }
  });
}

let tnDokumentSummary = new Map();

async function loadTnDokumentSummary() {
  try {
    const response = await fetch("/api/dokumente/summary");
    if (!response.ok) {
      throw new Error("Dokumente-Übersicht konnte nicht geladen werden.");
    }
    const rows = await response.json();
    tnDokumentSummary = new Map(rows.map((row) => [row.TeilnehmerID, row]));
  } catch (err) {
    console.error(err);
    tnDokumentSummary = new Map();
  }
}

function updateDokumentBadge(badgeEl, teilnehmerId) {
  const summary = tnDokumentSummary.get(teilnehmerId);
  if (!summary || !summary.Anzahl) {
    badgeEl.hidden = true;
    return;
  }
  badgeEl.hidden = false;
  badgeEl.textContent = summary.Anzahl;
  badgeEl.classList.toggle("badge-aktuell", Boolean(summary.HatAktuelle));
}

async function refreshTnDokumentBadges() {
  await loadTnDokumentSummary();
  tnRowEntries.forEach(({ person, row }) => {
    const badge = row.querySelector(".dokument-badge");
    if (badge) {
      updateDokumentBadge(badge, person.ID);
    }
  });
}

let tnNotenSummary = new Map();

async function loadTnNotenSummary() {
  try {
    const response = await fetch("/api/leistungskontrollen/summary");
    if (!response.ok) {
      throw new Error("Leistungskontrollen-Übersicht konnte nicht geladen werden.");
    }
    const rows = await response.json();
    tnNotenSummary = new Map(rows.map((row) => [row.TeilnehmerID, row]));
  } catch (err) {
    console.error(err);
    tnNotenSummary = new Map();
  }
}

function updateNotenBadge(badgeEl, teilnehmerId) {
  const summary = tnNotenSummary.get(teilnehmerId);
  if (!summary || !summary.Anzahl) {
    badgeEl.hidden = true;
    return;
  }
  badgeEl.hidden = false;
  badgeEl.textContent = summary.Anzahl;
  badgeEl.classList.toggle("badge-aktuell", Boolean(summary.HatAktuelle));
}

async function refreshTnNotenBadges() {
  await loadTnNotenSummary();
  tnRowEntries.forEach(({ person, row }) => {
    const badge = row.querySelector(".noten-badge");
    if (badge) {
      updateNotenBadge(badge, person.ID);
    }
  });
}

async function loadTeilnehmer() {
  teilnehmerTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 9;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  teilnehmerTableBody.appendChild(loadingRow);

  try {
    const [response] = await Promise.all([
      fetch("/api/teilnehmer"),
      loadTnAktivitaetSummary(),
      loadTnDokumentSummary(),
      loadTnNotenSummary(),
    ]);
    if (!response.ok) {
      throw new Error("Teilnehmende konnten nicht geladen werden.");
    }
    const teilnehmer = await response.json();

    teilnehmerTableBody.innerHTML = "";
    tnRowEntries = [];

    if (teilnehmer.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 9;
      emptyCell.textContent = "Noch keine Teilnehmenden vorhanden.";
      emptyRow.appendChild(emptyCell);
      teilnehmerTableBody.appendChild(emptyRow);
      return;
    }

    tnFilterEmptyRow = document.createElement("tr");
    const filterEmptyCell = document.createElement("td");
    filterEmptyCell.colSpan = 9;
    filterEmptyCell.textContent = "Keine Teilnehmenden gefunden.";
    tnFilterEmptyRow.appendChild(filterEmptyCell);
    tnFilterEmptyRow.style.display = "none";
    teilnehmerTableBody.appendChild(tnFilterEmptyRow);

    teilnehmer.forEach((person) => {
      const row = document.createElement("tr");
      const fullName = `${person.Vorname} ${person.Nachname}`;

      const vornameCell = document.createElement("td");
      vornameCell.textContent = person.Vorname;

      const nachnameCell = document.createElement("td");
      nachnameCell.textContent = person.Nachname;

      const geburtsdatumCell = document.createElement("td");
      geburtsdatumCell.textContent = formatDateDE(person.Geburtsdatum);

      const massnahmeCell = document.createElement("td");
      massnahmeCell.textContent = [person.MassnahmeBezeichnung, person.VT].filter(Boolean).join(" ");

      const startCell = document.createElement("td");
      startCell.textContent = formatDateDE(person.Startdatum);

      const endeCell = document.createElement("td");
      endeCell.textContent = formatDateDE(person.Endedatum);

      const emailCell = document.createElement("td");
      emailCell.textContent = person.Email || "";

      const telefonCell = document.createElement("td");
      telefonCell.textContent = person.Telefon || "";

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const steckbriefBtn = document.createElement("button");
      steckbriefBtn.type = "button";
      steckbriefBtn.className = "row-steckbrief-btn";
      steckbriefBtn.setAttribute("aria-label", `Steckbrief von ${fullName} anzeigen`);
      steckbriefBtn.title = "Steckbrief";
      steckbriefBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
          <circle cx="9" cy="10" r="2"></circle>
          <path d="M5 16c0-1.66 1.79-3 4-3s4 1.34 4 3"></path>
          <line x1="14" y1="8" x2="19" y2="8"></line>
          <line x1="14" y1="12" x2="19" y2="12"></line>
        </svg>
      `;
      steckbriefBtn.addEventListener("click", () => openTeilnehmerSteckbrief(person));

      const historyBtnWrap = document.createElement("span");
      historyBtnWrap.className = "history-btn-wrap";

      const historyBtn = document.createElement("button");
      historyBtn.type = "button";
      historyBtn.className = "row-history-btn";
      historyBtn.setAttribute("aria-label", `Aktivitäten von ${fullName} anzeigen`);
      historyBtn.title = "Aktivitäten";
      historyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      `;
      historyBtn.addEventListener("click", () => openTeilnehmerAktivitaeten(person));

      const aktivitaetBadge = document.createElement("span");
      aktivitaetBadge.className = "aktivitaet-badge";
      aktivitaetBadge.hidden = true;
      updateAktivitaetBadge(aktivitaetBadge, person.ID);

      historyBtnWrap.append(historyBtn, aktivitaetBadge);

      const filesBtnWrap = document.createElement("span");
      filesBtnWrap.className = "history-btn-wrap";

      const filesBtn = document.createElement("button");
      filesBtn.type = "button";
      filesBtn.className = "row-files-btn";
      filesBtn.setAttribute("aria-label", `Dateien von ${fullName} anzeigen`);
      filesBtn.title = "Dateiablage";
      filesBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      filesBtn.addEventListener("click", () => openTeilnehmerDateien(person));

      const dokumentBadge = document.createElement("span");
      dokumentBadge.className = "dokument-badge";
      dokumentBadge.hidden = true;
      updateDokumentBadge(dokumentBadge, person.ID);

      filesBtnWrap.append(filesBtn, dokumentBadge);

      const notenBtnWrap = document.createElement("span");
      notenBtnWrap.className = "history-btn-wrap";

      const notenBtn = document.createElement("button");
      notenBtn.type = "button";
      notenBtn.className = "row-noten-btn";
      notenBtn.setAttribute("aria-label", `Notenverlauf von ${fullName} anzeigen`);
      notenBtn.title = "Notenverlauf";
      notenBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
          <polyline points="17 6 23 6 23 12"></polyline>
        </svg>
      `;
      notenBtn.addEventListener("click", () => openTeilnehmerNotenverlauf(person));

      const notenBadge = document.createElement("span");
      notenBadge.className = "noten-badge";
      notenBadge.hidden = true;
      updateNotenBadge(notenBadge, person.ID);

      notenBtnWrap.append(notenBtn, notenBadge);

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.setAttribute("aria-label", `${fullName} bearbeiten`);
      editBtn.title = "Bearbeiten";
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditTeilnehmerDialog(person));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.setAttribute("aria-label", `${fullName} löschen`);
      deleteBtn.title = "Löschen";
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: fullName,
          endpoint: `/api/teilnehmer/${person.ID}`,
          reload: loadTeilnehmer,
        })
      );

      actionsWrap.append(steckbriefBtn, historyBtnWrap, filesBtnWrap, notenBtnWrap, editBtn);
      if (canDeleteMassnahmenOderTeilnehmer()) {
        actionsWrap.append(deleteBtn);
      }
      actionsCell.appendChild(actionsWrap);

      row.append(vornameCell, nachnameCell, geburtsdatumCell, massnahmeCell, startCell, endeCell, emailCell, telefonCell, actionsCell);
      teilnehmerTableBody.appendChild(row);
      tnRowEntries.push({ person, row });
    });

    applyTnFilters();
  } catch (err) {
    console.error(err);
    teilnehmerTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 9;
    errorCell.textContent = "Fehler beim Laden der Teilnehmenden.";
    errorRow.appendChild(errorCell);
    teilnehmerTableBody.appendChild(errorRow);
  }
}

teilnehmerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(teilnehmerForm);
  const payload = {
    Vorname: formData.get("Vorname").trim(),
    Nachname: formData.get("Nachname").trim(),
    Geburtsdatum: formData.get("Geburtsdatum"),
    MassnahmeID: formData.get("MassnahmeID"),
    Startdatum: formData.get("Startdatum"),
    Endedatum: formData.get("Endedatum"),
    Email: formData.get("Email").trim(),
    Telefon: formData.get("Telefon").trim(),
  };

  teilnehmerFormMessage.textContent = "";
  teilnehmerFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/teilnehmer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Teilnehmer konnte nicht gespeichert werden.");
    }

    teilnehmerForm.reset();
    teilnehmerFormMessage.textContent = "Teilnehmer/in gespeichert.";
    teilnehmerFormMessage.classList.add("success");
    await loadTeilnehmer();
  } catch (err) {
    teilnehmerFormMessage.textContent = err.message;
    teilnehmerFormMessage.classList.add("error");
  }
});

let editingTeilnehmerId = null;

function openEditTeilnehmerDialog(person) {
  editingTeilnehmerId = person.ID;
  editTeilnehmerForm.elements.Vorname.value = person.Vorname;
  editTeilnehmerForm.elements.Nachname.value = person.Nachname;
  editTeilnehmerForm.elements.Geburtsdatum.value = person.Geburtsdatum;
  editTnMassnahmeSelect.value = person.MassnahmeID || "";
  editTeilnehmerForm.elements.Startdatum.value = person.Startdatum;
  editTeilnehmerForm.elements.Endedatum.value = person.Endedatum;
  editTeilnehmerForm.elements.Email.value = person.Email || "";
  editTeilnehmerForm.elements.Telefon.value = person.Telefon || "";
  editTeilnehmerFormMessage.textContent = "";
  editTeilnehmerFormMessage.className = "form-message";
  editTeilnehmerDialog.showModal();
}

editTeilnehmerCancelBtn.addEventListener("click", () => {
  editTeilnehmerDialog.close();
});

editTeilnehmerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(editTeilnehmerForm);
  const payload = {
    Vorname: formData.get("Vorname").trim(),
    Nachname: formData.get("Nachname").trim(),
    Geburtsdatum: formData.get("Geburtsdatum"),
    MassnahmeID: formData.get("MassnahmeID"),
    Startdatum: formData.get("Startdatum"),
    Endedatum: formData.get("Endedatum"),
    Email: formData.get("Email").trim(),
    Telefon: formData.get("Telefon").trim(),
  };

  editTeilnehmerFormMessage.textContent = "";
  editTeilnehmerFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/teilnehmer/${editingTeilnehmerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Teilnehmer konnte nicht aktualisiert werden.");
    }

    editTeilnehmerDialog.close();
    editingTeilnehmerId = null;
    await loadTeilnehmer();
  } catch (err) {
    editTeilnehmerFormMessage.textContent = err.message;
    editTeilnehmerFormMessage.className = "form-message error";
  }
});

// Aktivitätenverlauf (Unterseite von Teilnehmende, Master-Detail)

const aktZurueckBtn = document.getElementById("aktZurueckBtn");
const aktTnName = document.getElementById("aktTnName");
const aktTnVt = document.getElementById("aktTnVt");
const aktFormTnName = document.getElementById("aktFormTnName");
const aktFormTnVt = document.getElementById("aktFormTnVt");
const aktFormZeitstempel = document.getElementById("aktFormZeitstempel");
const aktFormBearbeiter = document.getElementById("aktFormBearbeiter");
const aktivitaetListe = document.getElementById("aktivitaetListe");
const aktivitaetDetailPlaceholder = document.getElementById("aktivitaetDetailPlaceholder");
const aktivitaetDetailView = document.getElementById("aktivitaetDetailView");
const aktDetailArt = document.getElementById("aktDetailArt");
const aktDetailThema = document.getElementById("aktDetailThema");
const aktDetailZeitstempel = document.getElementById("aktDetailZeitstempel");
const aktDetailBearbeiter = document.getElementById("aktDetailBearbeiter");
const aktDetailBemerkung = document.getElementById("aktDetailBemerkung");
const aktDetailWiedervorlage = document.getElementById("aktDetailWiedervorlage");
const aktNeueBtn = document.getElementById("aktNeueBtn");
const aktivitaetForm = document.getElementById("aktivitaetForm");
const aktivitaetFormMessage = document.getElementById("aktivitaetFormMessage");
const aktAbbrechenBtn = document.getElementById("aktAbbrechenBtn");

let currentAktivitaetTeilnehmerId = null;
let currentAktivitaetTeilnehmer = null;
let pendingAktivitaetId = null;

function openTeilnehmerAktivitaeten(person, aktivitaetId = null) {
  currentAktivitaetTeilnehmerId = person.ID;
  currentAktivitaetTeilnehmer = person;
  pendingAktivitaetId = aktivitaetId;

  if (window.location.hash === "#teilnehmende-aktivitaeten") {
    // Hash ist unverändert (z. B. nach Reload auf einer alten Aktivitäten-URL) -
    // ein erneutes Setzen desselben Hash-Werts löst kein hashchange aus,
    // daher hier direkt die Seite anzeigen.
    showPage("teilnehmende-aktivitaeten");
  } else {
    window.location.hash = "teilnehmende-aktivitaeten";
  }
}

aktZurueckBtn.addEventListener("click", () => {
  window.location.hash = "teilnehmende";
});

function formatDateTimeDE(datetimeStr) {
  if (!datetimeStr) {
    return "";
  }
  const date = new Date(datetimeStr.replace(" ", "T"));
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function aktivitaetBearbeiterInitialen(bearbeiter) {
  if (!bearbeiter) {
    return "";
  }
  const teile = bearbeiter.trim().split(/\s+/);
  const erstesTeil = teile[0]?.[0] || "";
  const letztesTeil = teile.length > 1 ? teile[teile.length - 1][0] : "";
  return (erstesTeil + letztesTeil).toUpperCase();
}

function clearAktivitaetListSelection() {
  aktivitaetListe.querySelectorAll(".aktivitaet-list-item.active").forEach((item) => item.classList.remove("active"));
}

function showAktivitaetPlaceholder() {
  aktivitaetDetailPlaceholder.hidden = false;
  aktivitaetDetailView.hidden = true;
  aktivitaetForm.hidden = true;
  clearAktivitaetListSelection();
}

function showAktivitaetDetail(aktivitaet) {
  aktivitaetDetailPlaceholder.hidden = true;
  aktivitaetForm.hidden = true;
  aktivitaetDetailView.hidden = false;

  aktDetailArt.textContent = aktivitaet.Art;
  aktDetailThema.textContent = aktivitaet.Thema || "–";
  aktDetailZeitstempel.textContent = formatDateTimeDE(aktivitaet.ErstelltAm);
  aktDetailBearbeiter.textContent = aktivitaet.Bearbeiter || "–";
  aktDetailBemerkung.textContent = aktivitaet.Bemerkung || "–";
  aktDetailWiedervorlage.textContent = aktivitaet.Wiedervorlage
    ? `${formatDateDE(aktivitaet.Wiedervorlage)}${aktivitaet.WiedervorlageErledigt ? " (erledigt)" : ""}`
    : "–";

  aktivitaetListe.querySelectorAll(".aktivitaet-list-item").forEach((item) => {
    item.classList.toggle("active", Number(item.dataset.id) === aktivitaet.ID);
  });
}

function showAktivitaetForm() {
  aktivitaetDetailPlaceholder.hidden = true;
  aktivitaetDetailView.hidden = true;
  aktivitaetForm.hidden = false;

  aktivitaetForm.reset();
  aktivitaetFormMessage.textContent = "";
  aktivitaetFormMessage.className = "form-message";

  const person = currentAktivitaetTeilnehmer;
  aktFormTnName.textContent = person ? `${person.Vorname} ${person.Nachname}` : "";
  aktFormTnVt.textContent = (person && person.VT) || "";
  aktFormZeitstempel.textContent = new Date().toLocaleString("de-DE");
  aktFormBearbeiter.textContent = currentUser ? `${currentUser.Vorname} ${currentUser.Nachname}` : "";

  clearAktivitaetListSelection();
}

aktNeueBtn.addEventListener("click", showAktivitaetForm);
aktAbbrechenBtn.addEventListener("click", showAktivitaetPlaceholder);

function renderAktivitaetListe(aktivitaeten) {
  aktivitaetListe.innerHTML = "";

  if (aktivitaeten.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "aktivitaet-list-empty";
    emptyItem.textContent = "Noch keine Aktivitäten vorhanden.";
    aktivitaetListe.appendChild(emptyItem);
    return;
  }

  aktivitaeten.forEach((aktivitaet) => {
    const item = document.createElement("li");
    item.className = "aktivitaet-list-item";
    item.dataset.id = aktivitaet.ID;

    const headerRow = document.createElement("div");
    headerRow.className = "aktivitaet-list-header";

    const datumSpan = document.createElement("span");
    datumSpan.className = "aktivitaet-list-datum";
    datumSpan.textContent = formatDateTimeDE(aktivitaet.ErstelltAm);

    const bearbeiterSpan = document.createElement("span");
    bearbeiterSpan.className = "aktivitaet-list-bearbeiter";
    bearbeiterSpan.textContent = aktivitaetBearbeiterInitialen(aktivitaet.Bearbeiter);
    bearbeiterSpan.title = aktivitaet.Bearbeiter || "";

    headerRow.append(datumSpan, bearbeiterSpan);

    const themaSpan = document.createElement("span");
    themaSpan.className = "aktivitaet-list-thema";
    themaSpan.textContent = aktivitaet.Thema || "–";

    const artSpan = document.createElement("span");
    artSpan.className = "aktivitaet-list-art";
    artSpan.textContent = aktivitaet.Art;

    item.append(headerRow, themaSpan, artSpan);
    item.addEventListener("click", () => showAktivitaetDetail(aktivitaet));
    aktivitaetListe.appendChild(item);
  });
}

async function loadTeilnehmerAktivitaetenPage(teilnehmerId) {
  const person = currentAktivitaetTeilnehmer;
  aktTnName.textContent = person ? `${person.Vorname} ${person.Nachname}` : "";
  aktTnVt.textContent = (person && person.VT) || "";

  showAktivitaetPlaceholder();

  aktivitaetListe.innerHTML = "";
  const loadingItem = document.createElement("li");
  loadingItem.className = "aktivitaet-list-empty";
  loadingItem.textContent = "Lädt…";
  aktivitaetListe.appendChild(loadingItem);

  try {
    const response = await fetch(`/api/aktivitaeten?teilnehmerId=${teilnehmerId}`);
    if (!response.ok) {
      throw new Error("Aktivitäten konnten nicht geladen werden.");
    }
    const aktivitaeten = await response.json();
    renderAktivitaetListe(aktivitaeten);

    const zielId = pendingAktivitaetId;
    pendingAktivitaetId = null;
    const treffer = zielId != null ? aktivitaeten.find((a) => a.ID === zielId) : null;
    if (treffer) {
      showAktivitaetDetail(treffer);
    }
  } catch (err) {
    console.error(err);
    aktivitaetListe.innerHTML = "";
    const errorItem = document.createElement("li");
    errorItem.className = "aktivitaet-list-empty";
    errorItem.textContent = "Fehler beim Laden der Aktivitäten.";
    aktivitaetListe.appendChild(errorItem);
  }
}

aktivitaetForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentAktivitaetTeilnehmerId) {
    return;
  }

  const formData = new FormData(aktivitaetForm);
  const payload = {
    TeilnehmerID: currentAktivitaetTeilnehmerId,
    Art: formData.get("Art"),
    Thema: formData.get("Thema").trim(),
    Bemerkung: formData.get("Bemerkung").trim(),
    Wiedervorlage: formData.get("Wiedervorlage") || null,
  };

  aktivitaetFormMessage.textContent = "";
  aktivitaetFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/aktivitaeten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Aktivität konnte nicht gespeichert werden.");
    }

    const createdAktivitaet = await response.json();
    await loadTeilnehmerAktivitaetenPage(currentAktivitaetTeilnehmerId);
    showAktivitaetDetail(createdAktivitaet);
  } catch (err) {
    aktivitaetFormMessage.textContent = err.message;
    aktivitaetFormMessage.classList.add("error");
  }
});

// Dateiablage (Unterseite von Teilnehmende, Master-Detail)

const dokZurueckBtn = document.getElementById("dokZurueckBtn");
const dokTnName = document.getElementById("dokTnName");
const dokTnVt = document.getElementById("dokTnVt");
const dokumentListe = document.getElementById("dokumentListe");
const dokumentDetailPlaceholder = document.getElementById("dokumentDetailPlaceholder");
const dokumentDetailView = document.getElementById("dokumentDetailView");
const dokDetailTitel = document.getElementById("dokDetailTitel");
const dokDetailVertraulichBadge = document.getElementById("dokDetailVertraulichBadge");
const dokDetailArt = document.getElementById("dokDetailArt");
const dokDetailSchlagworte = document.getElementById("dokDetailSchlagworte");
const dokDetailLoeschdatum = document.getElementById("dokDetailLoeschdatum");
const dokDetailHochgeladenAm = document.getElementById("dokDetailHochgeladenAm");
const dokDetailDatei = document.getElementById("dokDetailDatei");
const dokDetailDownload = document.getElementById("dokDetailDownload");
const dokDetailVorschau = document.getElementById("dokDetailVorschau");
const dokNeueBtn = document.getElementById("dokNeueBtn");

const dokUploadDialog = document.getElementById("dokUploadDialog");
const dokUploadForm = document.getElementById("dokUploadForm");
const dokUploadFormMessage = document.getElementById("dokUploadFormMessage");
const dokUploadLoeschdatum = document.getElementById("dokUploadLoeschdatum");
const dokUploadCancelBtn = document.getElementById("dokUploadCancelBtn");

const dokEditDialog = document.getElementById("dokEditDialog");
const dokEditForm = document.getElementById("dokEditForm");
const dokEditFormMessage = document.getElementById("dokEditFormMessage");
const dokEditTitel = document.getElementById("dokEditTitel");
const dokEditSchlagworte = document.getElementById("dokEditSchlagworte");
const dokEditArt = document.getElementById("dokEditArt");
const dokEditVertraulich = document.getElementById("dokEditVertraulich");
const dokEditLoeschdatum = document.getElementById("dokEditLoeschdatum");
const dokEditCancelBtn = document.getElementById("dokEditCancelBtn");

let currentDokumentTeilnehmerId = null;
let currentDokumentTeilnehmer = null;
let loeschfristOffsetJahre = 3;
let editingDokumentId = null;

function openTeilnehmerDateien(person) {
  currentDokumentTeilnehmerId = person.ID;
  currentDokumentTeilnehmer = person;

  if (window.location.hash === "#teilnehmende-dateien") {
    showPage("teilnehmende-dateien");
  } else {
    window.location.hash = "teilnehmende-dateien";
  }
}

dokZurueckBtn.addEventListener("click", () => {
  window.location.hash = "teilnehmende";
});

async function loadLoeschfristOffset() {
  try {
    const response = await fetch("/api/einstellungen/loeschfrist-offset");
    if (!response.ok) {
      throw new Error("Einstellung konnte nicht geladen werden.");
    }
    const data = await response.json();
    loeschfristOffsetJahre = Number(data.loeschfristOffsetJahre) || 3;
  } catch (err) {
    console.error(err);
  }
}

function berechneLoeschdatumVorschlag(endedatum, offsetJahre) {
  if (!endedatum) {
    return "";
  }
  const [y, m, d] = endedatum.split("-").map(Number);
  const datum = new Date(y + offsetJahre, m - 1, d);
  return `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, "0")}-${String(datum.getDate()).padStart(2, "0")}`;
}

function formatDateigroesse(bytes) {
  if (!bytes && bytes !== 0) {
    return "";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function clearDokumentListSelection() {
  dokumentListe.querySelectorAll(".aktivitaet-list-item.active").forEach((item) => item.classList.remove("active"));
}

function showDokumentPlaceholder() {
  dokumentDetailPlaceholder.hidden = false;
  dokumentDetailView.hidden = true;
  clearDokumentListSelection();
}

function showDokumentDetail(dokument) {
  dokumentDetailPlaceholder.hidden = true;
  dokumentDetailView.hidden = false;

  dokDetailTitel.textContent = dokument.Titel;
  dokDetailVertraulichBadge.hidden = !dokument.Vertraulich;
  dokDetailArt.textContent = dokument.Dokumentart;
  dokDetailSchlagworte.textContent = dokument.Schlagworte || "–";
  dokDetailLoeschdatum.textContent = formatDateDE(dokument.Loeschdatum);
  dokDetailHochgeladenAm.textContent = formatDateTimeDE(dokument.HochgeladenAm);
  dokDetailDatei.textContent = `${dokument.Dateiname} (${formatDateigroesse(dokument.Dateigroesse)})`;
  dokDetailDownload.href = `/api/dokumente/${dokument.ID}/datei`;
  dokDetailVorschau.onclick = () => {
    const url = `/dokument-vorschau.html?id=${dokument.ID}&name=${encodeURIComponent(dokument.Dateiname)}`;
    window.open(url, "_blank");
  };

  dokumentListe.querySelectorAll(".aktivitaet-list-item").forEach((item) => {
    item.classList.toggle("active", Number(item.dataset.id) === dokument.ID);
  });
}

function openEditDokumentDialog(dokument) {
  editingDokumentId = dokument.ID;
  dokEditTitel.value = dokument.Titel;
  dokEditSchlagworte.value = dokument.Schlagworte || "";
  dokEditArt.value = dokument.Dokumentart;
  dokEditVertraulich.checked = Boolean(dokument.Vertraulich);
  dokEditLoeschdatum.value = dokument.Loeschdatum;
  dokEditFormMessage.textContent = "";
  dokEditFormMessage.className = "form-message";
  dokEditDialog.showModal();
}

function renderDokumentListe(dokumente) {
  dokumentListe.innerHTML = "";

  if (dokumente.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "aktivitaet-list-empty";
    emptyItem.textContent = "Noch keine Dokumente vorhanden.";
    dokumentListe.appendChild(emptyItem);
    return;
  }

  dokumente.forEach((dokument) => {
    const item = document.createElement("li");
    item.className = "aktivitaet-list-item dokument-list-item";
    item.dataset.id = dokument.ID;

    const main = document.createElement("div");
    main.className = "wiedervorlage-item-main";

    const titelSpan = document.createElement("span");
    titelSpan.className = "aktivitaet-list-thema";
    titelSpan.textContent = dokument.Titel;

    const artSpan = document.createElement("span");
    artSpan.className = "aktivitaet-list-art";
    artSpan.textContent = dokument.Dokumentart;

    main.append(titelSpan, artSpan);
    main.addEventListener("click", () => showDokumentDetail(dokument));

    const actions = document.createElement("div");
    actions.className = "wiedervorlage-item-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "row-edit-btn";
    editBtn.setAttribute("aria-label", `${dokument.Titel} bearbeiten`);
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditDokumentDialog(dokument);
    });
    actions.append(editBtn);

    if (canDeleteDokument()) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.setAttribute("aria-label", `${dokument.Titel} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        openDeleteDialog({
          name: dokument.Titel,
          endpoint: `/api/dokumente/${dokument.ID}`,
          reload: () => loadTeilnehmerDateienPage(currentDokumentTeilnehmerId),
        });
      });
      actions.append(deleteBtn);
    }

    item.append(main, actions);
    dokumentListe.appendChild(item);
  });
}

async function loadTeilnehmerDateienPage(teilnehmerId) {
  const person = currentDokumentTeilnehmer;
  dokTnName.textContent = person ? `${person.Vorname} ${person.Nachname}` : "";
  dokTnVt.textContent = (person && person.VT) || "";

  showDokumentPlaceholder();

  dokumentListe.innerHTML = "";
  const loadingItem = document.createElement("li");
  loadingItem.className = "aktivitaet-list-empty";
  loadingItem.textContent = "Lädt…";
  dokumentListe.appendChild(loadingItem);

  try {
    const response = await fetch(`/api/dokumente?teilnehmerId=${teilnehmerId}`);
    if (!response.ok) {
      throw new Error("Dokumente konnten nicht geladen werden.");
    }
    renderDokumentListe(await response.json());
  } catch (err) {
    console.error(err);
    dokumentListe.innerHTML = "";
    const errorItem = document.createElement("li");
    errorItem.className = "aktivitaet-list-empty";
    errorItem.textContent = "Fehler beim Laden der Dokumente.";
    dokumentListe.appendChild(errorItem);
  }
}

dokNeueBtn.addEventListener("click", () => {
  dokUploadForm.reset();
  dokUploadFormMessage.textContent = "";
  dokUploadFormMessage.className = "form-message";
  dokUploadLoeschdatum.value = berechneLoeschdatumVorschlag(
    currentDokumentTeilnehmer && currentDokumentTeilnehmer.Endedatum,
    loeschfristOffsetJahre
  );
  dokUploadDialog.showModal();
});

dokUploadCancelBtn.addEventListener("click", () => {
  dokUploadDialog.close();
});

dokUploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentDokumentTeilnehmerId) {
    return;
  }

  const formData = new FormData(dokUploadForm);
  formData.set("TeilnehmerID", currentDokumentTeilnehmerId);

  dokUploadFormMessage.textContent = "";
  dokUploadFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/dokumente", { method: "POST", body: formData });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Dokument konnte nicht hochgeladen werden.");
    }
    dokUploadDialog.close();
    await loadTeilnehmerDateienPage(currentDokumentTeilnehmerId);
  } catch (err) {
    dokUploadFormMessage.textContent = err.message;
    dokUploadFormMessage.classList.add("error");
  }
});

dokEditCancelBtn.addEventListener("click", () => {
  dokEditDialog.close();
});

dokEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!editingDokumentId) {
    return;
  }

  const payload = {
    Titel: dokEditTitel.value.trim(),
    Schlagworte: dokEditSchlagworte.value.trim(),
    Dokumentart: dokEditArt.value,
    Vertraulich: dokEditVertraulich.checked,
    Loeschdatum: dokEditLoeschdatum.value,
  };

  dokEditFormMessage.textContent = "";
  dokEditFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/dokumente/${editingDokumentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Dokument konnte nicht aktualisiert werden.");
    }
    dokEditDialog.close();
    editingDokumentId = null;
    await loadTeilnehmerDateienPage(currentDokumentTeilnehmerId);
  } catch (err) {
    dokEditFormMessage.textContent = err.message;
    dokEditFormMessage.classList.add("error");
  }
});

// Notenverlauf (Unterseite von Teilnehmende)

const nvZurueckBtn = document.getElementById("nvZurueckBtn");
const nvName = document.getElementById("nvName");
const nvFachbereich = document.getElementById("nvFachbereich");
const nvGruppe = document.getElementById("nvGruppe");
const nvVt = document.getElementById("nvVt");
const nvDurchschnittsnote = document.getElementById("nvDurchschnittsnote");
const nvTrend = document.getElementById("nvTrend");
const nvChart = document.getElementById("nvChart");
const nvChartEmpty = document.getElementById("nvChartEmpty");
const nvTableBody = document.getElementById("nvTableBody");

let currentNotenverlaufTeilnehmerId = null;
let currentNotenverlaufTeilnehmer = null;
let currentNvDaten = [];
let currentNvSelectedId = null;

const NV_CHART_HEIGHT = 280;
const NV_MARGIN = { top: 20, right: 30, bottom: 40, left: 44 };
const NV_POINT_SPACING = 90;
const NV_MIN_WIDTH = 400;

function openTeilnehmerNotenverlauf(person) {
  currentNotenverlaufTeilnehmerId = person.ID;
  currentNotenverlaufTeilnehmer = person;
  if (window.location.hash === "#teilnehmende-notenverlauf") {
    showPage("teilnehmende-notenverlauf");
  } else {
    window.location.hash = "teilnehmende-notenverlauf";
  }
}

nvZurueckBtn.addEventListener("click", () => {
  window.location.hash = "teilnehmende";
});

function formatNoteDE(note) {
  return String(note).replace(".", ",");
}

function parseNoteWert(note) {
  if (note === null || note === undefined || note === "") {
    return null;
  }
  const zahl = Number(note);
  return Number.isFinite(zahl) ? zahl : null;
}

function berechneNotenverlaufKennzahlen(daten) {
  const numerisch = daten.map((e) => parseNoteWert(e.Note)).filter((n) => n !== null);

  if (numerisch.length === 0) {
    return { durchschnitt: null, trend: null };
  }

  const avg = (arr) => arr.reduce((summe, n) => summe + n, 0) / arr.length;
  const durchschnitt = avg(numerisch);

  let trend = null;
  if (numerisch.length >= 2) {
    const mitte = Math.floor(numerisch.length / 2);
    const diff = avg(numerisch.slice(mitte)) - avg(numerisch.slice(0, mitte));
    const SCHWELLE = 0.3;
    trend = diff <= -SCHWELLE ? "verbessert" : diff >= SCHWELLE ? "verschlechtert" : "stabil";
  }

  return { durchschnitt, trend };
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function notenverlaufGradeToY(note) {
  const plotHeight = NV_CHART_HEIGHT - NV_MARGIN.top - NV_MARGIN.bottom;
  const clamped = Math.min(6, Math.max(1, note));
  return NV_MARGIN.top + ((clamped - 1) / 5) * plotHeight;
}

function zeichneNotenChart(zielSvg, zielEmpty, daten, selectedId, onPointClick) {
  zielSvg.innerHTML = "";

  const punkte = daten
    .map((eintrag, index) => ({ ...eintrag, index, noteWert: parseNoteWert(eintrag.Note) }))
    .filter((eintrag) => eintrag.noteWert !== null);

  if (punkte.length === 0) {
    zielSvg.setAttribute("width", "0");
    zielSvg.setAttribute("height", String(NV_CHART_HEIGHT));
    if (zielEmpty) {
      zielEmpty.hidden = false;
    }
    return;
  }
  if (zielEmpty) {
    zielEmpty.hidden = true;
  }

  const plotWidth = Math.max(
    NV_MIN_WIDTH,
    NV_MARGIN.left + NV_MARGIN.right + (punkte.length - 1) * NV_POINT_SPACING + 40
  );
  zielSvg.setAttribute("width", String(plotWidth));
  zielSvg.setAttribute("height", String(NV_CHART_HEIGHT));
  zielSvg.setAttribute("viewBox", `0 0 ${plotWidth} ${NV_CHART_HEIGHT}`);

  const xFor = (index) => NV_MARGIN.left + index * NV_POINT_SPACING;

  for (let note = 1; note <= 6; note++) {
    const y = notenverlaufGradeToY(note);
    zielSvg.appendChild(
      svgEl("line", {
        x1: NV_MARGIN.left,
        x2: plotWidth - NV_MARGIN.right,
        y1: y,
        y2: y,
        stroke: "#eeeff1",
        "stroke-width": 1,
      })
    );
    const label = svgEl("text", {
      x: NV_MARGIN.left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "notenverlauf-axis-label",
    });
    label.textContent = formatNoteDE(note.toFixed(1));
    zielSvg.appendChild(label);
  }

  const pfad = punkte
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.index)} ${notenverlaufGradeToY(p.noteWert)}`)
    .join(" ");
  zielSvg.appendChild(
    svgEl("path", {
      d: pfad,
      fill: "none",
      stroke: "#00adee",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );

  punkte.forEach((p) => {
    const x = xFor(p.index);
    const y = notenverlaufGradeToY(p.noteWert);
    const istSelektiert = p.ID === selectedId;
    const radius = istSelektiert ? 7 : 5;

    const punktKreis = svgEl("circle", {
      cx: x,
      cy: y,
      r: radius,
      fill: istSelektiert ? "#003a4d" : "#00adee",
      stroke: "#ffffff",
      "stroke-width": 2,
      class: "notenverlauf-point",
    });

    const hit = svgEl("circle", {
      cx: x,
      cy: y,
      r: 14,
      class: "notenverlauf-point-hit",
      tabindex: "0",
      role: "button",
      "aria-label": `${formatDateDE(p.Durchfuehrungsdatum)}, ${p.Bezeichnung}: Note ${formatNoteDE(p.noteWert)}`,
    });
    const titel = svgEl("title", {});
    titel.textContent = `${formatDateDE(p.Durchfuehrungsdatum)} – ${p.Bezeichnung}: Note ${formatNoteDE(p.noteWert)}`;
    hit.appendChild(titel);
    if (onPointClick) {
      hit.addEventListener("click", () => onPointClick(p.ID));
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPointClick(p.ID);
        }
      });
    }
    hit.addEventListener("mouseenter", () => punktKreis.setAttribute("r", String(radius + 1)));
    hit.addEventListener("mouseleave", () => punktKreis.setAttribute("r", String(radius)));

    zielSvg.appendChild(punktKreis);
    zielSvg.appendChild(hit);

    if (istSelektiert) {
      const wertLabel = svgEl("text", {
        x,
        y: y - 14,
        "text-anchor": "middle",
        class: "notenverlauf-point-label",
      });
      wertLabel.textContent = formatNoteDE(p.noteWert);
      zielSvg.appendChild(wertLabel);
    }

    const datumLabel = svgEl("text", {
      x,
      y: NV_CHART_HEIGHT - NV_MARGIN.bottom + 20,
      "text-anchor": "middle",
      class: "notenverlauf-axis-label",
    });
    const [jahr, monat, tag] = p.Durchfuehrungsdatum.split("-");
    datumLabel.textContent = `${tag}.${monat}.`;
    zielSvg.appendChild(datumLabel);
  });
}

function renderNotenverlaufChart(daten, selectedId) {
  zeichneNotenChart(nvChart, nvChartEmpty, daten, selectedId, selectNotenverlaufEintrag);
}

function renderNotenverlaufListe(daten, selectedId) {
  nvTableBody.innerHTML = "";

  if (daten.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 5;
    emptyCell.textContent = "Keine Leistungskontrollen für diese Maßnahme vorhanden.";
    emptyRow.appendChild(emptyCell);
    nvTableBody.appendChild(emptyRow);
    return;
  }

  daten.forEach((eintrag) => {
    const row = document.createElement("tr");
    row.className = "notenverlauf-row";
    if (eintrag.ID === selectedId) {
      row.classList.add("selected");
    }

    const artCell = document.createElement("td");
    artCell.textContent = eintrag.Art;

    const bezeichnungCell = document.createElement("td");
    bezeichnungCell.textContent = eintrag.Bezeichnung;

    const datumCell = document.createElement("td");
    datumCell.textContent = formatDateDE(eintrag.Durchfuehrungsdatum);

    const noteCell = document.createElement("td");
    const noteWert = parseNoteWert(eintrag.Note);
    noteCell.textContent = noteWert === null ? "–" : formatNoteDE(noteWert);

    const actionsCell = document.createElement("td");
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "row-edit-btn";
    editBtn.setAttribute("aria-label", `Leistungskontrolle ${eintrag.ID} bearbeiten`);
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openLeistungskontrolleDetail(eintrag);
    });

    actionsWrap.append(editBtn);
    actionsCell.appendChild(actionsWrap);

    row.append(artCell, bezeichnungCell, datumCell, noteCell, actionsCell);
    row.addEventListener("click", () => selectNotenverlaufEintrag(eintrag.ID));
    nvTableBody.appendChild(row);
  });
}

function selectNotenverlaufEintrag(lkId) {
  currentNvSelectedId = currentNvSelectedId === lkId ? null : lkId;
  renderNotenverlaufChart(currentNvDaten, currentNvSelectedId);
  renderNotenverlaufListe(currentNvDaten, currentNvSelectedId);
}

const NV_TREND_LABELS = {
  verbessert: "Verbessert ↑",
  verschlechtert: "Verschlechtert ↓",
  stabil: "Stabil →",
};

async function loadTeilnehmerNotenverlaufPage(teilnehmerId) {
  const person = currentNotenverlaufTeilnehmer;
  nvName.textContent = person ? `${person.Vorname} ${person.Nachname}` : "";
  nvFachbereich.textContent = (person && person.FachbereichBezeichnung) || "";
  nvGruppe.textContent = (person && person.GruppeBezeichnung) || "";
  nvVt.textContent = (person && person.VT) || "";
  nvDurchschnittsnote.textContent = "–";
  nvTrend.textContent = "–";
  nvTrend.className = "stat-value";

  nvTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 5;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  nvTableBody.appendChild(loadingRow);

  try {
    const response = await fetch(`/api/teilnehmer/${teilnehmerId}/leistungskontrollen`);
    if (!response.ok) {
      throw new Error("Notenverlauf konnte nicht geladen werden.");
    }
    currentNvDaten = await response.json();
    currentNvSelectedId = null;

    const { durchschnitt, trend } = berechneNotenverlaufKennzahlen(currentNvDaten);
    nvDurchschnittsnote.textContent = durchschnitt === null ? "–" : formatNoteDE(durchschnitt.toFixed(1));
    nvTrend.textContent = trend ? NV_TREND_LABELS[trend] : "–";
    nvTrend.className = trend ? `stat-value trend-${trend}` : "stat-value";

    renderNotenverlaufChart(currentNvDaten, currentNvSelectedId);
    renderNotenverlaufListe(currentNvDaten, currentNvSelectedId);
  } catch (err) {
    console.error(err);
    nvTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 5;
    errorCell.textContent = err.message;
    errorRow.appendChild(errorCell);
    nvTableBody.appendChild(errorRow);
  }
}

// Teilnehmersteckbrief (Unterseite von Teilnehmende)

const skbZurueckBtn = document.getElementById("skbZurueckBtn");
const skbName = document.getElementById("skbName");
const skbGeburtsdatum = document.getElementById("skbGeburtsdatum");
const skbStartdatum = document.getElementById("skbStartdatum");
const skbEndedatum = document.getElementById("skbEndedatum");
const skbEmail = document.getElementById("skbEmail");
const skbTelefon = document.getElementById("skbTelefon");
const skbFachbereich = document.getElementById("skbFachbereich");
const skbGruppe = document.getElementById("skbGruppe");
const skbMassnahme = document.getElementById("skbMassnahme");
const skbVt = document.getElementById("skbVt");
const skbMassnahmetyp = document.getElementById("skbMassnahmetyp");

const skbFehltageGesamt = document.getElementById("skbFehltageGesamt");
const skbFehltageEntschuldigt = document.getElementById("skbFehltageEntschuldigt");
const skbFehltageUnentschuldigt = document.getElementById("skbFehltageUnentschuldigt");
const skbFehlzeitBisher = document.getElementById("skbFehlzeitBisher");
const skbFehlzeitAufMassnahme = document.getElementById("skbFehlzeitAufMassnahme");
const skbAnwesenheitHeadRow = document.getElementById("skbAnwesenheitHeadRow");
const skbAnwesenheitTableBody = document.getElementById("skbAnwesenheitTableBody");

const skbLkAnzahl = document.getElementById("skbLkAnzahl");
const skbDurchschnittsnote = document.getElementById("skbDurchschnittsnote");
const skbTrend = document.getElementById("skbTrend");
const skbChart = document.getElementById("skbChart");
const skbChartEmpty = document.getElementById("skbChartEmpty");

const skbAktivitaetenListe = document.getElementById("skbAktivitaetenListe");
const skbPdfBtn = document.getElementById("skbPdfBtn");

let currentSteckbriefTeilnehmerId = null;
let currentSteckbriefTeilnehmer = null;
let skbLkDatenCache = [];
let skbAktivitaetenCache = [];
let skbAnwesenheitStatsCache = null;

(function initSkbAnwesenheitHeadRow() {
  for (let tag = 1; tag <= 31; tag++) {
    const th = document.createElement("th");
    th.className = "day-col";
    th.textContent = String(tag);
    skbAnwesenheitHeadRow.appendChild(th);
  }
})();

function openTeilnehmerSteckbrief(person) {
  currentSteckbriefTeilnehmerId = person.ID;
  currentSteckbriefTeilnehmer = person;
  if (window.location.hash === "#teilnehmende-steckbrief") {
    showPage("teilnehmende-steckbrief");
  } else {
    window.location.hash = "teilnehmende-steckbrief";
  }
}

skbZurueckBtn.addEventListener("click", () => {
  window.location.hash = "teilnehmende";
});

// --- Feiertagsberechnung (deutschlandweit + je Bundesland) ---

function skbOstersonntag(jahr) {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

function skbAddTage(datum, tage) {
  const neu = new Date(datum);
  neu.setUTCDate(neu.getUTCDate() + tage);
  return neu;
}

function skbIsoDatum(datum) {
  return datum.toISOString().slice(0, 10);
}

const SKB_HEILIGE_DREI_KOENIGE = ["Baden-Württemberg", "Bayern", "Sachsen-Anhalt"];
const SKB_FRAUENTAG = ["Berlin", "Mecklenburg-Vorpommern"];
const SKB_FRONLEICHNAM = ["Baden-Württemberg", "Bayern", "Hessen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland"];
const SKB_MARIAE_HIMMELFAHRT = ["Saarland"];
const SKB_WELTKINDERTAG = ["Thüringen"];
const SKB_REFORMATIONSTAG = [
  "Brandenburg",
  "Bremen",
  "Hamburg",
  "Mecklenburg-Vorpommern",
  "Niedersachsen",
  "Sachsen",
  "Sachsen-Anhalt",
  "Schleswig-Holstein",
  "Thüringen",
];
const SKB_ALLERHEILIGEN = ["Baden-Württemberg", "Bayern", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland"];

function skbBerechneFeiertage(jahr, bundesland) {
  const feiertage = new Set();
  const ostern = skbOstersonntag(jahr);

  feiertage.add(`${jahr}-01-01`);
  feiertage.add(skbIsoDatum(skbAddTage(ostern, -2)));
  feiertage.add(skbIsoDatum(skbAddTage(ostern, 1)));
  feiertage.add(`${jahr}-05-01`);
  feiertage.add(skbIsoDatum(skbAddTage(ostern, 39)));
  feiertage.add(skbIsoDatum(skbAddTage(ostern, 50)));
  feiertage.add(`${jahr}-10-03`);
  feiertage.add(`${jahr}-12-25`);
  feiertage.add(`${jahr}-12-26`);

  if (SKB_HEILIGE_DREI_KOENIGE.includes(bundesland)) feiertage.add(`${jahr}-01-06`);
  if (SKB_FRAUENTAG.includes(bundesland)) feiertage.add(`${jahr}-03-08`);
  if (SKB_FRONLEICHNAM.includes(bundesland)) feiertage.add(skbIsoDatum(skbAddTage(ostern, 60)));
  if (SKB_MARIAE_HIMMELFAHRT.includes(bundesland)) feiertage.add(`${jahr}-08-15`);
  if (SKB_WELTKINDERTAG.includes(bundesland)) feiertage.add(`${jahr}-09-20`);
  if (SKB_REFORMATIONSTAG.includes(bundesland)) feiertage.add(`${jahr}-10-31`);
  if (SKB_ALLERHEILIGEN.includes(bundesland)) feiertage.add(`${jahr}-11-01`);
  if (bundesland === "Sachsen") {
    const stichtag = new Date(Date.UTC(jahr, 10, 23));
    const wochentag = stichtag.getUTCDay();
    const differenz = (wochentag - 3 + 7) % 7 || 7;
    feiertage.add(skbIsoDatum(skbAddTage(stichtag, -differenz)));
  }

  return feiertage;
}

const skbFeiertageCache = new Map();

function skbFeiertageFuerJahr(jahr, bundesland) {
  const key = `${jahr}|${bundesland}`;
  if (!skbFeiertageCache.has(key)) {
    skbFeiertageCache.set(key, skbBerechneFeiertage(jahr, bundesland));
  }
  return skbFeiertageCache.get(key);
}

function skbIstWerktagOhneFeiertag(isoTag, bundesland) {
  const datum = new Date(`${isoTag}T00:00:00Z`);
  const wochentag = datum.getUTCDay();
  if (wochentag === 0 || wochentag === 6) {
    return false;
  }
  return !skbFeiertageFuerJahr(datum.getUTCFullYear(), bundesland).has(isoTag);
}

function skbZaehleWerktage(vonIso, bisIso, bundesland) {
  if (!vonIso || !bisIso) {
    return 0;
  }
  let anzahl = 0;
  let aktuell = new Date(`${vonIso}T00:00:00Z`);
  const ende = new Date(`${bisIso}T00:00:00Z`);
  while (aktuell <= ende) {
    if (skbIstWerktagOhneFeiertag(skbIsoDatum(aktuell), bundesland)) {
      anzahl++;
    }
    aktuell = skbAddTage(aktuell, 1);
  }
  return anzahl;
}

// --- Anwesenheit ---

const SKB_FEHLZEIT_ENTSCHULDIGT = ["E", "K"];
const SKB_FEHLZEIT_UNENTSCHULDIGT = ["UA"];

function skbFormatProzent(zaehler, nenner) {
  if (!nenner) {
    return "–";
  }
  return `${((zaehler / nenner) * 100).toFixed(1).replace(".", ",")} %`;
}

function skbBerechneAnwesenheitStats(person, records, bundesland) {
  const entschuldigt = records.filter((r) => SKB_FEHLZEIT_ENTSCHULDIGT.includes(r.Kurzzeichen)).length;
  const unentschuldigt = records.filter((r) => SKB_FEHLZEIT_UNENTSCHULDIGT.includes(r.Kurzzeichen)).length;
  const fehltageGesamt = entschuldigt + unentschuldigt;

  const heute = heutigesDatumIso();
  const bisherBis = person.Endedatum && person.Endedatum < heute ? person.Endedatum : heute;
  const werktageBisher = person.Startdatum ? skbZaehleWerktage(person.Startdatum, bisherBis, bundesland) : 0;
  const werktageGesamt =
    person.Startdatum && person.Endedatum ? skbZaehleWerktage(person.Startdatum, person.Endedatum, bundesland) : 0;

  return {
    fehltageGesamt,
    entschuldigt,
    unentschuldigt,
    fehlzeitBisherProzent: skbFormatProzent(fehltageGesamt, werktageBisher),
    fehlzeitAufMassnahmeProzent: skbFormatProzent(fehltageGesamt, werktageGesamt),
    werktageBisher,
    werktageGesamt,
  };
}

function skbMonatsListeZwischen(vonIso, bisIso) {
  const monate = [];
  if (!vonIso || !bisIso) {
    return monate;
  }
  let jahr = Number(vonIso.slice(0, 4));
  let monat = Number(vonIso.slice(5, 7));
  const endJahr = Number(bisIso.slice(0, 4));
  const endMonat = Number(bisIso.slice(5, 7));
  while (jahr < endJahr || (jahr === endJahr && monat <= endMonat)) {
    monate.push({ jahr, monat });
    monat += 1;
    if (monat > 12) {
      monat = 1;
      jahr += 1;
    }
  }
  return monate;
}

function skbIstWochenende(iso) {
  const wochentag = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return wochentag === 0 || wochentag === 6;
}

function skbTageszeichen(iso, recordsByDate, bundesland) {
  const eintrag = recordsByDate.get(iso);
  if (eintrag) {
    return eintrag;
  }
  const jahr = Number(iso.slice(0, 4));
  return skbFeiertageFuerJahr(jahr, bundesland).has(iso) ? "F" : "";
}

function renderSteckbriefAnwesenheitTabelle(person, records, bundesland) {
  skbAnwesenheitTableBody.innerHTML = "";

  const recordsByDate = new Map(records.map((r) => [r.Datum, r.Kurzzeichen]));
  const monate = skbMonatsListeZwischen(person.Startdatum, person.Endedatum);

  if (monate.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 33;
    emptyCell.textContent = "Kein Zeitraum hinterlegt.";
    emptyRow.appendChild(emptyCell);
    skbAnwesenheitTableBody.appendChild(emptyRow);
    return;
  }

  monate.forEach(({ jahr, monat }) => {
    const row = document.createElement("tr");
    const monatCell = document.createElement("td");
    monatCell.className = "col-sticky col-monat";
    monatCell.textContent = MONTH_NAMES_DE[monat - 1];
    const jahrCell = document.createElement("td");
    jahrCell.className = "col-sticky col-jahr";
    jahrCell.textContent = String(jahr);
    row.append(monatCell, jahrCell);

    const tageImMonat = new Date(jahr, monat, 0).getDate();
    for (let tag = 1; tag <= 31; tag++) {
      const cell = document.createElement("td");
      if (tag <= tageImMonat) {
        const iso = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
        if (skbIstWochenende(iso)) {
          cell.classList.add("steckbrief-wochenende");
        }
        cell.textContent = skbTageszeichen(iso, recordsByDate, bundesland);
      }
      row.appendChild(cell);
    }
    skbAnwesenheitTableBody.appendChild(row);
  });
}

// --- Leistung ---

function renderSteckbriefLeistung(daten) {
  skbLkAnzahl.textContent = String(daten.length);

  const { durchschnitt, trend } = berechneNotenverlaufKennzahlen(daten);
  skbDurchschnittsnote.textContent = durchschnitt === null ? "–" : formatNoteDE(durchschnitt.toFixed(1));
  skbTrend.textContent = trend ? NV_TREND_LABELS[trend] : "–";
  skbTrend.className = trend ? `stat-value trend-${trend}` : "stat-value";

  zeichneNotenChart(skbChart, skbChartEmpty, daten, null, null);
}

// --- Aktivitäten ---

function skbFeldMitLabel(label, wert) {
  const span = document.createElement("span");
  const labelSpan = document.createElement("span");
  labelSpan.className = "label";
  labelSpan.textContent = `${label}:`;
  span.append(labelSpan, document.createTextNode(` ${wert}`));
  return span;
}

function renderSteckbriefAktivitaeten(aktivitaeten) {
  skbAktivitaetenListe.innerHTML = "";

  if (aktivitaeten.length === 0) {
    const empty = document.createElement("li");
    empty.className = "aktivitaet-list-empty";
    empty.textContent = "Noch keine Aktivitäten vorhanden.";
    skbAktivitaetenListe.appendChild(empty);
    return;
  }

  aktivitaeten.forEach((aktivitaet) => {
    const item = document.createElement("li");
    item.className = "steckbrief-aktivitaet-item";

    const info = document.createElement("div");
    info.className = "steckbrief-aktivitaet-info";
    info.append(
      skbFeldMitLabel("Datum", formatDateTimeDE(aktivitaet.ErstelltAm)),
      skbFeldMitLabel("Thema", aktivitaet.Thema || "–"),
      skbFeldMitLabel("Bearbeiter", aktivitaet.Bearbeiter || "–")
    );

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-secondary";
    btn.textContent = "Zur Aktivität";
    btn.addEventListener("click", () => openTeilnehmerAktivitaeten(currentSteckbriefTeilnehmer, aktivitaet.ID));

    const btnWrap = document.createElement("div");
    btnWrap.className = "detail-actions";
    btnWrap.appendChild(btn);

    item.append(info, btnWrap);
    skbAktivitaetenListe.appendChild(item);
  });
}

// --- Laden der Steckbrief-Seite ---

async function loadTeilnehmerSteckbriefPage(teilnehmerId) {
  const person = currentSteckbriefTeilnehmer;
  if (!person) {
    return;
  }

  skbName.textContent = `${person.Vorname} ${person.Nachname}`;
  skbGeburtsdatum.textContent = formatDateDE(person.Geburtsdatum);
  skbStartdatum.textContent = formatDateDE(person.Startdatum);
  skbEndedatum.textContent = formatDateDE(person.Endedatum);
  skbEmail.textContent = person.Email || "–";
  skbTelefon.textContent = person.Telefon || "–";
  skbFachbereich.textContent = person.FachbereichBezeichnung || "–";
  skbGruppe.textContent = person.GruppeBezeichnung || "–";
  skbMassnahme.textContent = person.MassnahmeBezeichnung || "–";
  skbVt.textContent = person.VT || "–";
  skbMassnahmetyp.textContent = person.MassnahmetypBezeichnung || "–";

  skbAnwesenheitTableBody.innerHTML = "";
  const ladeRow = document.createElement("tr");
  const ladeCell = document.createElement("td");
  ladeCell.colSpan = 33;
  ladeCell.textContent = "Lädt…";
  ladeRow.appendChild(ladeCell);
  skbAnwesenheitTableBody.appendChild(ladeRow);

  skbAktivitaetenListe.innerHTML = "";
  const ladeItem = document.createElement("li");
  ladeItem.className = "aktivitaet-list-empty";
  ladeItem.textContent = "Lädt…";
  skbAktivitaetenListe.appendChild(ladeItem);

  try {
    const [anwesenheitResp, bildungsstaetteResp, lkResp, aktivitaetenResp] = await Promise.all([
      fetch(`/api/teilnehmer/${teilnehmerId}/anwesenheiten`),
      fetch("/api/einstellungen/bildungsstaette"),
      fetch(`/api/teilnehmer/${teilnehmerId}/leistungskontrollen`),
      fetch(`/api/aktivitaeten?teilnehmerId=${teilnehmerId}`),
    ]);

    if (!anwesenheitResp.ok) throw new Error("Anwesenheiten konnten nicht geladen werden.");
    if (!lkResp.ok) throw new Error("Leistungskontrollen konnten nicht geladen werden.");
    if (!aktivitaetenResp.ok) throw new Error("Aktivitäten konnten nicht geladen werden.");

    const anwesenheitRecords = await anwesenheitResp.json();
    const bildungsstaette = bildungsstaetteResp.ok ? await bildungsstaetteResp.json() : {};
    const bundesland = bildungsstaette.bildungsstaette_bundesland || "";

    const stats = skbBerechneAnwesenheitStats(person, anwesenheitRecords, bundesland);
    skbAnwesenheitStatsCache = stats;
    skbFehltageGesamt.textContent = String(stats.fehltageGesamt);
    skbFehltageEntschuldigt.textContent = String(stats.entschuldigt);
    skbFehltageUnentschuldigt.textContent = String(stats.unentschuldigt);
    skbFehlzeitBisher.textContent = stats.fehlzeitBisherProzent;
    skbFehlzeitAufMassnahme.textContent = stats.fehlzeitAufMassnahmeProzent;
    renderSteckbriefAnwesenheitTabelle(person, anwesenheitRecords, bundesland);

    skbLkDatenCache = await lkResp.json();
    renderSteckbriefLeistung(skbLkDatenCache);

    skbAktivitaetenCache = await aktivitaetenResp.json();
    renderSteckbriefAktivitaeten(skbAktivitaetenCache);
  } catch (err) {
    console.error(err);
    skbAnwesenheitTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 33;
    errorCell.textContent = err.message;
    errorRow.appendChild(errorCell);
    skbAnwesenheitTableBody.appendChild(errorRow);
  }
}

// --- PDF-Bericht ---

async function skbLadeLogoAlsDataUrl() {
  try {
    const response = await fetch("/api/einstellungen/unternehmen/logo");
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error(err);
    return null;
  }
}

const SKB_PDF_TREND_LABELS = {
  verbessert: "Verbessert",
  verschlechtert: "Verschlechtert",
  stabil: "Stabil",
};

function skbBildFormatAusDataUrl(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/gif")) return "GIF";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

async function generateSteckbriefPdf() {
  const person = currentSteckbriefTeilnehmer;
  if (!person) {
    return;
  }

  const [unternehmen, bildungsstaette, logoDataUrl] = await Promise.all([
    fetch("/api/einstellungen/unternehmen").then((r) => (r.ok ? r.json() : {})),
    fetch("/api/einstellungen/bildungsstaette").then((r) => (r.ok ? r.json() : {})),
    skbLadeLogoAlsDataUrl(),
  ]);
  const bundesland = bildungsstaette.bildungsstaette_bundesland || "";

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 44;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 58, 77);
  doc.text(unternehmen.unternehmen_name || "Standortmanager", marginX, y);

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, skbBildFormatAusDataUrl(logoDataUrl), pageWidth - marginX - 110, y - 26, 110, 44, undefined, "FAST");
    } catch (err) {
      console.error("Logo konnte nicht ins PDF eingefügt werden:", err);
    }
  }

  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 51, 51);
  if (unternehmen.unternehmen_bezeichnung) {
    doc.text(unternehmen.unternehmen_bezeichnung, marginX, y);
    y += 12;
  }
  const anschriftZeilen = [
    bildungsstaette.bildungsstaette_name,
    [bildungsstaette.bildungsstaette_strasse, bildungsstaette.bildungsstaette_hausnummer].filter(Boolean).join(" "),
    [bildungsstaette.bildungsstaette_plz, bildungsstaette.bildungsstaette_ort].filter(Boolean).join(" "),
  ].filter(Boolean);
  anschriftZeilen.forEach((zeile) => {
    doc.text(zeile, marginX, y);
    y += 12;
  });

  doc.setTextColor(120, 120, 120);
  doc.text(`Bericht vom ${new Date().toLocaleDateString("de-DE")}`, marginX, y);
  y += 14;

  doc.setDrawColor(238, 239, 241);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(0, 58, 77);
  doc.text(`Teilnehmersteckbrief: ${person.Vorname} ${person.Nachname}`, marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  const kopfZeilen = [
    `Fachbereich: ${person.FachbereichBezeichnung || "–"}     Gruppe: ${person.GruppeBezeichnung || "–"}     Maßnahme: ${person.MassnahmeBezeichnung || "–"}     VT: ${person.VT || "–"}`,
    `Geburtsdatum: ${formatDateDE(person.Geburtsdatum) || "–"}     Startdatum: ${formatDateDE(person.Startdatum) || "–"}     Endedatum: ${formatDateDE(person.Endedatum) || "–"}`,
  ];
  doc.text(kopfZeilen, marginX, y, { lineHeightFactor: 1.4 });
  y += kopfZeilen.length * 13 + 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 58, 77);
  doc.text("Anwesenheit", marginX, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  const stats = skbAnwesenheitStatsCache;
  const anwesenheitZeilen = stats
    ? [
        `Fehltage gesamt: ${stats.fehltageGesamt}     davon entschuldigt: ${stats.entschuldigt}     davon unentschuldigt: ${stats.unentschuldigt}`,
        `Fehlzeit bisher: ${stats.fehlzeitBisherProzent}     Fehlzeit auf Maßnahme: ${stats.fehlzeitAufMassnahmeProzent}`,
      ]
    : ["Keine Daten vorhanden."];
  doc.text(anwesenheitZeilen, marginX, y, { lineHeightFactor: 1.4 });
  y += anwesenheitZeilen.length * 13 + 10;

  const monate = skbMonatsListeZwischen(person.Startdatum, person.Endedatum);
  const recordsByDate = new Map((await (await fetch(`/api/teilnehmer/${person.ID}/anwesenheiten`)).json()).map((r) => [r.Datum, r.Kurzzeichen]));
  if (monate.length > 0) {
    const head = ["Monat", "Jahr", ...Array.from({ length: 31 }, (_, i) => String(i + 1))];
    const body = monate.map(({ jahr, monat }) => {
      const tageImMonat = new Date(jahr, monat, 0).getDate();
      const zeile = [MONTH_NAMES_DE[monat - 1], String(jahr)];
      for (let tag = 1; tag <= 31; tag++) {
        if (tag > tageImMonat) {
          zeile.push("");
        } else {
          const iso = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
          zeile.push(skbTageszeichen(iso, recordsByDate, bundesland));
        }
      }
      return zeile;
    });
    const monatColWidth = 55;
    const jahrColWidth = 32;
    const dayColWidth = Math.max(11, (pageWidth - marginX * 2 - monatColWidth - jahrColWidth) / 31);
    const columnStyles = { 0: { cellWidth: monatColWidth, halign: "left" }, 1: { cellWidth: jahrColWidth, halign: "center" } };
    for (let i = 0; i < 31; i++) {
      columnStyles[2 + i] = { cellWidth: dayColWidth, halign: "center" };
    }
    doc.autoTable({
      head: [head],
      body,
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: "grid",
      styles: { fontSize: 6.5, cellPadding: 2, valign: "middle", lineColor: [238, 239, 241], lineWidth: 0.5 },
      headStyles: { fillColor: [0, 173, 238], textColor: 255, fontSize: 6.5, halign: "center" },
      bodyStyles: { textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [243, 247, 250] },
      columnStyles,
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index < 2) {
          return;
        }
        const { jahr, monat } = monate[data.row.index];
        const tag = data.column.index - 1;
        const tageImMonat = new Date(jahr, monat, 0).getDate();
        if (tag > tageImMonat) {
          return;
        }
        const iso = `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
        if (skbIstWochenende(iso)) {
          data.cell.styles.fillColor = [215, 221, 226];
        }
      },
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  if (y > pageHeight - 120) {
    doc.addPage();
    y = 44;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 58, 77);
  doc.text("Leistung", marginX, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  const { durchschnitt, trend } = berechneNotenverlaufKennzahlen(skbLkDatenCache);
  const leistungZeile = `Leistungskontrollen: ${skbLkDatenCache.length}     Durchschnittsnote: ${
    durchschnitt === null ? "–" : formatNoteDE(durchschnitt.toFixed(1))
  }     Trend: ${trend ? SKB_PDF_TREND_LABELS[trend] : "–"}`;
  doc.text(leistungZeile, marginX, y);
  y += 18;

  if (skbLkDatenCache.length > 0) {
    doc.autoTable({
      head: [["Art", "Bezeichnung", "Durchführungsdatum", "Note"]],
      body: skbLkDatenCache.map((lk) => {
        const noteWert = parseNoteWert(lk.Note);
        return [lk.Art, lk.Bezeichnung, formatDateDE(lk.Durchfuehrungsdatum), noteWert === null ? "–" : formatNoteDE(noteWert)];
      }),
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, lineColor: [238, 239, 241], lineWidth: 0.5 },
      headStyles: { fillColor: [0, 173, 238], textColor: 255, fontSize: 8 },
      bodyStyles: { textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [243, 247, 250] },
      columnStyles: { 2: { cellWidth: 110 }, 3: { cellWidth: 60, halign: "center" } },
    });
    y = doc.lastAutoTable.finalY + 20;
  }

  if (y > pageHeight - 120) {
    doc.addPage();
    y = 44;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 58, 77);
  doc.text("Aktivitäten", marginX, y);
  y += 12;

  if (skbAktivitaetenCache.length > 0) {
    doc.autoTable({
      head: [["Datum", "Thema", "Bearbeiter"]],
      body: skbAktivitaetenCache.map((a) => [formatDateTimeDE(a.ErstelltAm), a.Thema || "–", a.Bearbeiter || "–"]),
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, lineColor: [238, 239, 241], lineWidth: 0.5 },
      headStyles: { fillColor: [0, 173, 238], textColor: 255, fontSize: 8 },
      bodyStyles: { textColor: [51, 51, 51] },
      alternateRowStyles: { fillColor: [243, 247, 250] },
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 51, 51);
    doc.text("Keine Aktivitäten vorhanden.", marginX, y + 12);
  }

  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}

skbPdfBtn.addEventListener("click", async () => {
  const originalLabel = skbPdfBtn.textContent;
  skbPdfBtn.disabled = true;
  skbPdfBtn.textContent = "Erstelle Bericht…";
  try {
    await generateSteckbriefPdf();
  } catch (err) {
    console.error(err);
    alert("Der PDF-Bericht konnte nicht erstellt werden.");
  } finally {
    skbPdfBtn.disabled = false;
    skbPdfBtn.textContent = originalLabel;
  }
});

// Einstellungen

const einstellungenForm = document.getElementById("einstellungenForm");
const einstellungenFormMessage = document.getElementById("einstellungenFormMessage");
const einstDokumentenpfad = document.getElementById("einstDokumentenpfad");
const einstLoeschfristOffset = document.getElementById("einstLoeschfristOffset");

async function loadEinstellungen() {
  try {
    const response = await fetch("/api/einstellungen");
    if (!response.ok) {
      throw new Error("Einstellungen konnten nicht geladen werden.");
    }
    const data = await response.json();
    einstDokumentenpfad.value = data.dokumentenpfad || "";
    einstLoeschfristOffset.value = Number(data.loeschfrist_offset_jahre) || 3;
  } catch (err) {
    console.error(err);
    einstellungenFormMessage.textContent = err.message;
    einstellungenFormMessage.className = "form-message error";
  }
}

einstellungenForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  einstellungenFormMessage.textContent = "";
  einstellungenFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dokumentenpfad: einstDokumentenpfad.value.trim(),
        loeschfrist_offset_jahre: Number(einstLoeschfristOffset.value),
      }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Einstellungen konnten nicht gespeichert werden.");
    }
    const saved = await response.json();
    loeschfristOffsetJahre = Number(saved.loeschfrist_offset_jahre) || 3;
    einstellungenFormMessage.textContent = "Gespeichert.";
    einstellungenFormMessage.className = "form-message";
  } catch (err) {
    einstellungenFormMessage.textContent = err.message;
    einstellungenFormMessage.className = "form-message error";
  }
});

const einstDatenbankForm = document.getElementById("einstDatenbankForm");
const einstDatenbankFormMessage = document.getElementById("einstDatenbankFormMessage");
const einstDbHost = document.getElementById("einstDbHost");
const einstDbPort = document.getElementById("einstDbPort");
const einstDbName = document.getElementById("einstDbName");
const einstDbUser = document.getElementById("einstDbUser");
const einstDbPasswortBtn = document.getElementById("einstDbPasswortBtn");

const einstDbPasswortDialog = document.getElementById("einstDbPasswortDialog");
const einstDbPasswortForm = document.getElementById("einstDbPasswortForm");
const einstDbPasswortFormMessage = document.getElementById("einstDbPasswortFormMessage");
const einstDbNeuesPasswort = document.getElementById("einstDbNeuesPasswort");
const einstDbNeuesPasswortWiederholung = document.getElementById("einstDbNeuesPasswortWiederholung");
const einstDbPasswortCancelBtn = document.getElementById("einstDbPasswortCancelBtn");

async function loadDatenbankEinstellungen() {
  try {
    const response = await fetch("/api/einstellungen/datenbank");
    if (!response.ok) {
      throw new Error("Datenbank-Einstellungen konnten nicht geladen werden.");
    }
    const data = await response.json();
    einstDbHost.value = data.host || "";
    einstDbPort.value = data.port || "";
    einstDbName.value = data.name || "";
    einstDbUser.value = data.user || "";
  } catch (err) {
    console.error(err);
    einstDatenbankFormMessage.textContent = err.message;
    einstDatenbankFormMessage.className = "form-message error";
  }
}

einstDatenbankForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  einstDatenbankFormMessage.textContent = "";
  einstDatenbankFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/einstellungen/datenbank", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: einstDbHost.value.trim(),
        port: Number(einstDbPort.value),
        name: einstDbName.value.trim(),
        user: einstDbUser.value.trim(),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Datenbank-Einstellungen konnten nicht gespeichert werden.");
    }
    einstDatenbankFormMessage.textContent = body.message;
    einstDatenbankFormMessage.className = "form-message";
  } catch (err) {
    einstDatenbankFormMessage.textContent = err.message;
    einstDatenbankFormMessage.className = "form-message error";
  }
});

einstDbPasswortBtn.addEventListener("click", () => {
  einstDbPasswortForm.reset();
  einstDbPasswortFormMessage.textContent = "";
  einstDbPasswortFormMessage.className = "form-message";
  einstDbPasswortDialog.showModal();
});

einstDbPasswortCancelBtn.addEventListener("click", () => {
  einstDbPasswortDialog.close();
});

einstDbPasswortForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  einstDbPasswortFormMessage.textContent = "";
  einstDbPasswortFormMessage.className = "form-message";

  if (einstDbNeuesPasswort.value !== einstDbNeuesPasswortWiederholung.value) {
    einstDbPasswortFormMessage.textContent = "Die Passwort-Wiederholung stimmt nicht überein.";
    einstDbPasswortFormMessage.className = "form-message error";
    return;
  }

  try {
    const response = await fetch("/api/einstellungen/datenbank/passwort", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passwort: einstDbNeuesPasswort.value }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Passwort konnte nicht gespeichert werden.");
    }
    einstDbPasswortDialog.close();
    einstDatenbankFormMessage.textContent = body.message;
    einstDatenbankFormMessage.className = "form-message";
  } catch (err) {
    einstDbPasswortFormMessage.textContent = err.message;
    einstDbPasswortFormMessage.className = "form-message error";
  }
});

const einstLoggingForm = document.getElementById("einstLoggingForm");
const einstLoggingFormMessage = document.getElementById("einstLoggingFormMessage");
const einstLogMaxDateigroesse = document.getElementById("einstLogMaxDateigroesse");

async function loadLoggingEinstellungen() {
  try {
    const response = await fetch("/api/einstellungen/logging");
    if (!response.ok) {
      throw new Error("Logging-Einstellung konnte nicht geladen werden.");
    }
    const data = await response.json();
    einstLogMaxDateigroesse.value = data.log_max_dateigroesse_mb || "";
  } catch (err) {
    console.error(err);
    einstLoggingFormMessage.textContent = err.message;
    einstLoggingFormMessage.className = "form-message error";
  }
}

einstLoggingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  einstLoggingFormMessage.textContent = "";
  einstLoggingFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/einstellungen/logging", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        log_max_dateigroesse_mb: einstLogMaxDateigroesse.value.trim(),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Einstellung konnte nicht gespeichert werden.");
    }
    einstLogMaxDateigroesse.value = body.log_max_dateigroesse_mb || "";
    einstLoggingFormMessage.textContent = "Gespeichert.";
    einstLoggingFormMessage.className = "form-message";
  } catch (err) {
    einstLoggingFormMessage.textContent = err.message;
    einstLoggingFormMessage.className = "form-message error";
  }
});

const einstBildungsstaetteForm = document.getElementById("einstBildungsstaetteForm");
const einstBildungsstaetteFormMessage = document.getElementById("einstBildungsstaetteFormMessage");
const einstBildName = document.getElementById("einstBildName");
const einstBildStrasse = document.getElementById("einstBildStrasse");
const einstBildHausnummer = document.getElementById("einstBildHausnummer");
const einstBildPlz = document.getElementById("einstBildPlz");
const einstBildOrt = document.getElementById("einstBildOrt");
const einstBildBundesland = document.getElementById("einstBildBundesland");
const einstBildEmail = document.getElementById("einstBildEmail");
const einstBildTelefon = document.getElementById("einstBildTelefon");
const einstBildGeschaeftsbereich = document.getElementById("einstBildGeschaeftsbereich");

async function loadBildungsstaetteEinstellungen() {
  try {
    const response = await fetch("/api/einstellungen/bildungsstaette");
    if (!response.ok) {
      throw new Error("Einstellungen konnten nicht geladen werden.");
    }
    const data = await response.json();
    einstBildName.value = data.bildungsstaette_name || "";
    einstBildStrasse.value = data.bildungsstaette_strasse || "";
    einstBildHausnummer.value = data.bildungsstaette_hausnummer || "";
    einstBildPlz.value = data.bildungsstaette_plz || "";
    einstBildOrt.value = data.bildungsstaette_ort || "";
    einstBildBundesland.value = data.bildungsstaette_bundesland || "";
    einstBildEmail.value = data.bildungsstaette_email || "";
    einstBildTelefon.value = data.bildungsstaette_telefon || "";
    einstBildGeschaeftsbereich.value = data.bildungsstaette_geschaeftsbereich || "";
  } catch (err) {
    console.error(err);
    einstBildungsstaetteFormMessage.textContent = err.message;
    einstBildungsstaetteFormMessage.className = "form-message error";
  }
}

einstBildungsstaetteForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  einstBildungsstaetteFormMessage.textContent = "";
  einstBildungsstaetteFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/einstellungen/bildungsstaette", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bildungsstaette_name: einstBildName.value.trim(),
        bildungsstaette_strasse: einstBildStrasse.value.trim(),
        bildungsstaette_hausnummer: einstBildHausnummer.value.trim(),
        bildungsstaette_plz: einstBildPlz.value.trim(),
        bildungsstaette_ort: einstBildOrt.value.trim(),
        bildungsstaette_bundesland: einstBildBundesland.value,
        bildungsstaette_email: einstBildEmail.value.trim(),
        bildungsstaette_telefon: einstBildTelefon.value.trim(),
        bildungsstaette_geschaeftsbereich: einstBildGeschaeftsbereich.value,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Einstellungen konnten nicht gespeichert werden.");
    }
    einstBildungsstaetteFormMessage.textContent = "Gespeichert.";
    einstBildungsstaetteFormMessage.className = "form-message";
  } catch (err) {
    einstBildungsstaetteFormMessage.textContent = err.message;
    einstBildungsstaetteFormMessage.className = "form-message error";
  }
});

const einstUnternehmenForm = document.getElementById("einstUnternehmenForm");
const einstUnternehmenFormMessage = document.getElementById("einstUnternehmenFormMessage");
const einstUntName = document.getElementById("einstUntName");
const einstUntBezeichnung = document.getElementById("einstUntBezeichnung");

const einstUnternehmenLogoForm = document.getElementById("einstUnternehmenLogoForm");
const einstUnternehmenLogoFormMessage = document.getElementById("einstUnternehmenLogoFormMessage");
const einstUntLogo = document.getElementById("einstUntLogo");
const einstUntLogoPreview = document.getElementById("einstUntLogoPreview");
const einstUntLogoEmpty = document.getElementById("einstUntLogoEmpty");
const einstUntLogoRemoveBtn = document.getElementById("einstUntLogoRemoveBtn");

function renderUnternehmenLogo(hatLogo) {
  if (hatLogo) {
    einstUntLogoPreview.src = `/api/einstellungen/unternehmen/logo?t=${Date.now()}`;
    einstUntLogoPreview.hidden = false;
    einstUntLogoEmpty.hidden = true;
    einstUntLogoRemoveBtn.hidden = false;
  } else {
    einstUntLogoPreview.hidden = true;
    einstUntLogoPreview.removeAttribute("src");
    einstUntLogoEmpty.hidden = false;
    einstUntLogoRemoveBtn.hidden = true;
  }
}

async function loadUnternehmenEinstellungen() {
  try {
    const response = await fetch("/api/einstellungen/unternehmen");
    if (!response.ok) {
      throw new Error("Einstellungen konnten nicht geladen werden.");
    }
    const data = await response.json();
    einstUntName.value = data.unternehmen_name || "";
    einstUntBezeichnung.value = data.unternehmen_bezeichnung || "";
    renderUnternehmenLogo(Boolean(data.unternehmen_logo_dateiname));
  } catch (err) {
    console.error(err);
    einstUnternehmenFormMessage.textContent = err.message;
    einstUnternehmenFormMessage.className = "form-message error";
  }
}

einstUnternehmenForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  einstUnternehmenFormMessage.textContent = "";
  einstUnternehmenFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/einstellungen/unternehmen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unternehmen_name: einstUntName.value.trim(),
        unternehmen_bezeichnung: einstUntBezeichnung.value.trim(),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Einstellungen konnten nicht gespeichert werden.");
    }
    einstUnternehmenFormMessage.textContent = "Gespeichert.";
    einstUnternehmenFormMessage.className = "form-message";
  } catch (err) {
    einstUnternehmenFormMessage.textContent = err.message;
    einstUnternehmenFormMessage.className = "form-message error";
  }
});

einstUnternehmenLogoForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  einstUnternehmenLogoFormMessage.textContent = "";
  einstUnternehmenLogoFormMessage.className = "form-message";

  if (!einstUntLogo.files || einstUntLogo.files.length === 0) {
    einstUnternehmenLogoFormMessage.textContent = "Bitte eine Bilddatei auswählen.";
    einstUnternehmenLogoFormMessage.className = "form-message error";
    return;
  }

  const formData = new FormData();
  formData.set("Logo", einstUntLogo.files[0]);

  try {
    const response = await fetch("/api/einstellungen/unternehmen/logo", {
      method: "POST",
      body: formData,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || "Logo konnte nicht hochgeladen werden.");
    }
    einstUnternehmenLogoForm.reset();
    renderUnternehmenLogo(true);
    einstUnternehmenLogoFormMessage.textContent = "Logo gespeichert.";
    einstUnternehmenLogoFormMessage.className = "form-message";
  } catch (err) {
    einstUnternehmenLogoFormMessage.textContent = err.message;
    einstUnternehmenLogoFormMessage.className = "form-message error";
  }
});

einstUntLogoRemoveBtn.addEventListener("click", async () => {
  einstUnternehmenLogoFormMessage.textContent = "";
  einstUnternehmenLogoFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/einstellungen/unternehmen/logo", { method: "DELETE" });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Logo konnte nicht entfernt werden.");
    }
    renderUnternehmenLogo(false);
    einstUnternehmenLogoFormMessage.textContent = "Logo entfernt.";
    einstUnternehmenLogoFormMessage.className = "form-message";
  } catch (err) {
    einstUnternehmenLogoFormMessage.textContent = err.message;
    einstUnternehmenLogoFormMessage.className = "form-message error";
  }
});

// Systemlogs / Dateioperationen

const sysLogTableBody = document.getElementById("sysLogTableBody");
const sysLogArtFilter = document.getElementById("sysLogArtFilter");
const sysLogBenutzerFilter = document.getElementById("sysLogBenutzerFilter");
const sysLogDateinameFilter = document.getElementById("sysLogDateinameFilter");
const sysLogResetFilterBtn = document.getElementById("sysLogResetFilterBtn");

let sysLogEintraege = [];

function formatZeitstempelDE(isoZeitstempel) {
  const datum = new Date(isoZeitstempel);
  if (Number.isNaN(datum.getTime())) {
    return isoZeitstempel;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(datum.getDate())}.${pad(datum.getMonth() + 1)}.${datum.getFullYear()} ${pad(datum.getHours())}:${pad(
    datum.getMinutes()
  )}:${pad(datum.getSeconds())}`;
}

function sysLogMatchesFilter(eintrag) {
  const art = sysLogArtFilter.value;
  const benutzerQuery = sysLogBenutzerFilter.value.trim().toLowerCase();
  const suchQuery = sysLogDateinameFilter.value.trim().toLowerCase();

  if (art && eintrag.Art !== art) {
    return false;
  }
  if (benutzerQuery && !eintrag.Benutzer.toLowerCase().includes(benutzerQuery)) {
    return false;
  }
  if (
    suchQuery &&
    !eintrag.Dateiname.toLowerCase().includes(suchQuery) &&
    !eintrag.Teilnehmer.toLowerCase().includes(suchQuery)
  ) {
    return false;
  }
  return true;
}

function renderSystemlogsTabelle() {
  sysLogTableBody.innerHTML = "";

  const gefiltert = sysLogEintraege.filter(sysLogMatchesFilter);

  if (gefiltert.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 5;
    emptyCell.textContent = sysLogEintraege.length === 0 ? "Noch keine Einträge vorhanden." : "Keine Einträge für diesen Filter.";
    emptyRow.appendChild(emptyCell);
    sysLogTableBody.appendChild(emptyRow);
    return;
  }

  gefiltert.forEach((eintrag) => {
    const row = document.createElement("tr");

    const zeitstempelCell = document.createElement("td");
    zeitstempelCell.textContent = formatZeitstempelDE(eintrag.Zeitstempel);

    const artCell = document.createElement("td");
    artCell.textContent = eintrag.Art;

    const dateinameCell = document.createElement("td");
    dateinameCell.textContent = eintrag.Dateiname;

    const teilnehmerCell = document.createElement("td");
    teilnehmerCell.textContent = eintrag.Teilnehmer;

    const benutzerCell = document.createElement("td");
    benutzerCell.textContent = eintrag.Benutzer;

    row.append(zeitstempelCell, artCell, dateinameCell, teilnehmerCell, benutzerCell);
    sysLogTableBody.appendChild(row);
  });
}

async function loadSystemlogsDateioperationen() {
  sysLogTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 5;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  sysLogTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/systemlogs/dateioperationen");
    if (!response.ok) {
      throw new Error("Logs konnten nicht geladen werden.");
    }
    sysLogEintraege = await response.json();
    renderSystemlogsTabelle();
  } catch (err) {
    console.error(err);
    sysLogTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 5;
    errorCell.textContent = err.message;
    errorRow.appendChild(errorCell);
    sysLogTableBody.appendChild(errorRow);
  }
}

sysLogArtFilter.addEventListener("change", renderSystemlogsTabelle);
sysLogBenutzerFilter.addEventListener("input", renderSystemlogsTabelle);
sysLogDateinameFilter.addEventListener("input", renderSystemlogsTabelle);

sysLogResetFilterBtn.addEventListener("click", () => {
  sysLogArtFilter.value = "";
  sysLogBenutzerFilter.value = "";
  sysLogDateinameFilter.value = "";
  renderSystemlogsTabelle();
});

// Leistungskontrolle

const lkFachbereichFilter = document.getElementById("lkFachbereichFilter");
const lkGruppeFilter = document.getElementById("lkGruppeFilter");
const lkMassnahmeFilter = document.getElementById("lkMassnahmeFilter");
const lkVtFilter = document.getElementById("lkVtFilter");
const lkResetFilterBtn = document.getElementById("lkResetFilterBtn");
const lkForm = document.getElementById("lkForm");
const lkFormMessage = document.getElementById("lkFormMessage");
const lkMassnahmenCheckboxes = document.getElementById("lkMassnahmenCheckboxes");
const lkMassnahmenSuche = document.getElementById("lkMassnahmenSuche");
const lkMassnahmenAnzahl = document.getElementById("lkMassnahmenAnzahl");
const leistungskontrolleTableBody = document.getElementById("leistungskontrolleTableBody");

const lkZurueckBtn = document.getElementById("lkZurueckBtn");
const lkDetailNummer = document.getElementById("lkDetailNummer");
const lkDetailForm = document.getElementById("lkDetailForm");
const lkDetailFormMessage = document.getElementById("lkDetailFormMessage");
const lkDetailMassnahmenListe = document.getElementById("lkDetailMassnahmenListe");
const lkDetailDeleteBtn = document.getElementById("lkDetailDeleteBtn");
const lkDetailErgebnisseBtn = document.getElementById("lkDetailErgebnisseBtn");

const lkErgebnisseDialog = document.getElementById("lkErgebnisseDialog");
const lkErgebnisseForm = document.getElementById("lkErgebnisseForm");
const lkErgebnisseBezeichnung = document.getElementById("lkErgebnisseBezeichnung");
const lkErgebnisseTableBody = document.getElementById("lkErgebnisseTableBody");
const lkErgebnisseFormMessage = document.getElementById("lkErgebnisseFormMessage");
const lkErgebnisseCancelBtn = document.getElementById("lkErgebnisseCancelBtn");

let lkGruppen = [];
let lkMassnahmen = [];
let lkListe = [];
let lkInitialized = false;
let currentLkId = null;

async function loadLkGruppen() {
  try {
    const response = await fetch("/api/gruppen");
    if (!response.ok) {
      throw new Error("Gruppen konnten nicht geladen werden.");
    }
    lkGruppen = await response.json();
  } catch (err) {
    console.error(err);
    lkGruppen = [];
  }
}

async function loadLkMassnahmen() {
  try {
    const response = await fetch("/api/massnahmen");
    if (!response.ok) {
      throw new Error("Maßnahmen konnten nicht geladen werden.");
    }
    lkMassnahmen = await response.json();
  } catch (err) {
    console.error(err);
    lkMassnahmen = [];
  }
}

function lkMassnahmenForFachbereichUndGruppe() {
  const fachbereichId = lkFachbereichFilter.value;
  const gruppeId = lkGruppeFilter.value;

  return lkMassnahmen.filter((massnahme) => {
    if (gruppeId) {
      return String(massnahme.GruppeID || "") === gruppeId;
    }
    if (fachbereichId) {
      const gruppe = lkGruppen.find((g) => g.ID === massnahme.GruppeID);
      return Boolean(gruppe) && String(gruppe.FachbereichID || "") === fachbereichId;
    }
    return true;
  });
}

function refreshLkGruppeOptions() {
  const fachbereichId = lkFachbereichFilter.value;
  const gruppen = fachbereichId ? lkGruppen.filter((g) => String(g.FachbereichID || "") === fachbereichId) : lkGruppen;

  const currentValue = lkGruppeFilter.value;
  lkGruppeFilter.querySelectorAll("option[data-gruppe]").forEach((option) => option.remove());

  gruppen
    .slice()
    .sort((a, b) => a.Bezeichnung.localeCompare(b.Bezeichnung, "de"))
    .forEach((gruppe) => {
      const option = document.createElement("option");
      option.value = gruppe.ID;
      option.textContent = gruppe.Bezeichnung;
      option.dataset.gruppe = "true";
      lkGruppeFilter.appendChild(option);
    });

  lkGruppeFilter.value = gruppen.some((g) => String(g.ID) === currentValue) ? currentValue : "";
}

function refreshLkMassnahmeOptions() {
  const bezeichnungen = [...new Set(lkMassnahmenForFachbereichUndGruppe().map((m) => m.Bezeichnung).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "de")
  );

  const currentValue = lkMassnahmeFilter.value;
  lkMassnahmeFilter.querySelectorAll("option[data-massnahme]").forEach((option) => option.remove());

  bezeichnungen.forEach((bezeichnung) => {
    const option = document.createElement("option");
    option.value = bezeichnung;
    option.textContent = bezeichnung;
    option.dataset.massnahme = "true";
    lkMassnahmeFilter.appendChild(option);
  });

  lkMassnahmeFilter.value = bezeichnungen.includes(currentValue) ? currentValue : "";
}

function refreshLkVtOptions() {
  const massnahmeBezeichnung = lkMassnahmeFilter.value;
  const relevant = lkMassnahmenForFachbereichUndGruppe().filter(
    (m) => !massnahmeBezeichnung || m.Bezeichnung === massnahmeBezeichnung
  );
  const vtValues = [...new Set(relevant.map((m) => m.VT).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de", { numeric: true })
  );

  const currentValue = lkVtFilter.value;
  lkVtFilter.querySelectorAll("option[data-vt]").forEach((option) => option.remove());

  vtValues.forEach((vt) => {
    const option = document.createElement("option");
    option.value = vt;
    option.textContent = vt;
    option.dataset.vt = "true";
    lkVtFilter.appendChild(option);
  });

  lkVtFilter.value = vtValues.includes(currentValue) ? currentValue : "";
}

async function initLkFilterOptions() {
  await Promise.all([loadLkGruppen(), loadLkMassnahmen()]);
  refreshLkGruppeOptions();
  refreshLkMassnahmeOptions();
  refreshLkVtOptions();
}

function buildLkMassnahmenCheckboxes(container, checkedIds = [], { nurAktive = false } = {}) {
  const heute = heutigesDatumIso();
  const items = lkMassnahmen
    .filter((m) => !nurAktive || !m.PlanEnde || m.PlanEnde >= heute)
    .sort((a, b) => a.Bezeichnung.localeCompare(b.Bezeichnung, "de"))
    .map((m) => ({ ID: m.ID, Label: `${m.Bezeichnung} (${m.VT || "–"})` }));
  buildCheckboxGroup(container, items, { labelKey: "Label", checkedIds });
}

function aktualisiereLkMassnahmenAnzahl() {
  const anzahl = getCheckedValues(lkMassnahmenCheckboxes).length;
  lkMassnahmenAnzahl.textContent = anzahl > 0 ? `(${anzahl} ausgewählt)` : "";
}

lkMassnahmenCheckboxes.addEventListener("change", aktualisiereLkMassnahmenAnzahl);

lkMassnahmenSuche.addEventListener("input", () => {
  const suchbegriff = lkMassnahmenSuche.value.trim().toLowerCase();
  lkMassnahmenCheckboxes.querySelectorAll("label").forEach((label) => {
    label.style.display = !suchbegriff || label.textContent.toLowerCase().includes(suchbegriff) ? "" : "none";
  });
});

function lkMatchesFilter(lk) {
  const fachbereichId = lkFachbereichFilter.value;
  const gruppeId = lkGruppeFilter.value;
  const massnahmeBezeichnung = lkMassnahmeFilter.value;
  const vt = lkVtFilter.value;

  if (!fachbereichId && !gruppeId && !massnahmeBezeichnung && !vt) {
    return true;
  }

  return lk.Massnahmen.some((m) => {
    if (fachbereichId && String(m.FachbereichID || "") !== fachbereichId) {
      return false;
    }
    if (gruppeId && String(m.GruppeID || "") !== gruppeId) {
      return false;
    }
    if (massnahmeBezeichnung && (m.Bezeichnung || "") !== massnahmeBezeichnung) {
      return false;
    }
    if (vt && (m.VT || "") !== vt) {
      return false;
    }
    return true;
  });
}

function canDeleteLeistungskontrolle(lk) {
  if (currentUser && currentUser.roles.includes("Administrator")) {
    return true;
  }
  if (!lk.Durchfuehrungsdatum) {
    return false;
  }
  return new Date(lk.Durchfuehrungsdatum) >= new Date(new Date().toDateString());
}

function openLeistungskontrolleDetail(lk) {
  currentLkId = lk.ID;
  if (window.location.hash === "#leistungskontrollen-detail") {
    showPage("leistungskontrollen-detail");
  } else {
    window.location.hash = "leistungskontrollen-detail";
  }
}

function renderLeistungskontrolleTabelle() {
  leistungskontrolleTableBody.innerHTML = "";

  const gefiltert = lkListe.filter(lkMatchesFilter);

  if (gefiltert.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 7;
    emptyCell.textContent = lkListe.length === 0 ? "Noch keine Leistungskontrollen vorhanden." : "Keine Leistungskontrollen für diesen Filter.";
    emptyRow.appendChild(emptyCell);
    leistungskontrolleTableBody.appendChild(emptyRow);
    return;
  }

  gefiltert.forEach((lk) => {
    const row = document.createElement("tr");

    const nummerCell = document.createElement("td");
    nummerCell.textContent = lk.ID;

    const artCell = document.createElement("td");
    artCell.textContent = lk.Art;

    const bezeichnungCell = document.createElement("td");
    bezeichnungCell.textContent = lk.Bezeichnung;

    const durchfuehrungCell = document.createElement("td");
    durchfuehrungCell.textContent = formatDateDE(lk.Durchfuehrungsdatum);

    const gesamtpunkteCell = document.createElement("td");
    gesamtpunkteCell.textContent = lk.Gesamtpunkte === null || lk.Gesamtpunkte === undefined ? "" : lk.Gesamtpunkte;

    const vtCell = document.createElement("td");
    vtCell.textContent = lk.Massnahmen.map((m) => `${m.Bezeichnung} (${m.VT})`).join(", ");

    const actionsCell = document.createElement("td");
    const actionsWrap = document.createElement("div");
    actionsWrap.className = "row-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "row-edit-btn";
    editBtn.setAttribute("aria-label", `Leistungskontrolle ${lk.ID} anzeigen`);
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.addEventListener("click", () => openLeistungskontrolleDetail(lk));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "row-delete-btn";
    deleteBtn.setAttribute("aria-label", `Leistungskontrolle ${lk.ID} löschen`);
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.addEventListener("click", () =>
      openDeleteDialog({
        name: lk.Bezeichnung,
        endpoint: `/api/leistungskontrollen/${lk.ID}`,
        reload: loadLeistungskontrollen,
      })
    );

    actionsWrap.append(editBtn);
    if (canDeleteLeistungskontrolle(lk)) {
      actionsWrap.append(deleteBtn);
    }
    actionsCell.appendChild(actionsWrap);

    row.append(nummerCell, artCell, bezeichnungCell, durchfuehrungCell, gesamtpunkteCell, vtCell, actionsCell);
    leistungskontrolleTableBody.appendChild(row);
  });
}

async function loadLeistungskontrollen() {
  leistungskontrolleTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 7;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  leistungskontrolleTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/leistungskontrollen");
    if (!response.ok) {
      throw new Error("Leistungskontrollen konnten nicht geladen werden.");
    }
    lkListe = await response.json();
    renderLeistungskontrolleTabelle();
  } catch (err) {
    console.error(err);
    leistungskontrolleTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 7;
    errorCell.textContent = err.message;
    errorRow.appendChild(errorCell);
    leistungskontrolleTableBody.appendChild(errorRow);
  }
}

lkFachbereichFilter.addEventListener("change", () => {
  refreshLkGruppeOptions();
  refreshLkMassnahmeOptions();
  refreshLkVtOptions();
  renderLeistungskontrolleTabelle();
});

lkGruppeFilter.addEventListener("change", () => {
  refreshLkMassnahmeOptions();
  refreshLkVtOptions();
  renderLeistungskontrolleTabelle();
});

lkMassnahmeFilter.addEventListener("change", () => {
  refreshLkVtOptions();
  renderLeistungskontrolleTabelle();
});

lkVtFilter.addEventListener("change", renderLeistungskontrolleTabelle);

lkResetFilterBtn.addEventListener("click", () => {
  lkFachbereichFilter.value = "";
  lkGruppeFilter.value = "";
  lkMassnahmeFilter.value = "";
  lkVtFilter.value = "";
  refreshLkGruppeOptions();
  refreshLkMassnahmeOptions();
  refreshLkVtOptions();
  renderLeistungskontrolleTabelle();
});

async function ensureLkInitialized() {
  if (!lkInitialized) {
    lkInitialized = true;
    await loadFachbereichOptionsInto(lkFachbereichFilter);
    await initLkFilterOptions();
    buildLkMassnahmenCheckboxes(lkMassnahmenCheckboxes, [], { nurAktive: true });
    aktualisiereLkMassnahmenAnzahl();
  }
  await loadLeistungskontrollen();
}

lkForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(lkForm);
  const payload = {
    Art: formData.get("Art"),
    Bezeichnung: formData.get("Bezeichnung").trim(),
    Beschreibung: formData.get("Beschreibung").trim(),
    Durchfuehrungsdatum: formData.get("Durchfuehrungsdatum"),
    Lagerort: formData.get("Lagerort").trim(),
    MassnahmeIDs: getCheckedValues(lkMassnahmenCheckboxes),
  };

  lkFormMessage.textContent = "";
  lkFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/leistungskontrollen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Leistungskontrolle konnte nicht gespeichert werden.");
    }

    lkForm.reset();
    lkMassnahmenSuche.value = "";
    buildLkMassnahmenCheckboxes(lkMassnahmenCheckboxes, [], { nurAktive: true });
    aktualisiereLkMassnahmenAnzahl();
    lkFormMessage.textContent = "Leistungskontrolle gespeichert.";
    lkFormMessage.classList.add("success");
    await loadLeistungskontrollen();
  } catch (err) {
    lkFormMessage.textContent = err.message;
    lkFormMessage.classList.add("error");
  }
});

// Leistungskontrolle-Detailseite

let currentLkDetail = null;

async function loadLeistungskontrolleDetailPage(id) {
  lkDetailFormMessage.textContent = "";
  lkDetailFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/leistungskontrollen/${id}`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Leistungskontrolle konnte nicht geladen werden.");
    }
    currentLkDetail = await response.json();

    lkDetailNummer.textContent = currentLkDetail.ID;
    lkDetailForm.elements.Art.value = currentLkDetail.Art;
    lkDetailForm.elements.Bezeichnung.value = currentLkDetail.Bezeichnung;
    lkDetailForm.elements.Beschreibung.value = currentLkDetail.Beschreibung;
    lkDetailForm.elements.Durchfuehrungsdatum.value = currentLkDetail.Durchfuehrungsdatum;
    lkDetailForm.elements.Gesamtpunkte.value =
      currentLkDetail.Gesamtpunkte === null || currentLkDetail.Gesamtpunkte === undefined ? "" : currentLkDetail.Gesamtpunkte;
    lkDetailForm.elements.Loeschdatum.value =
      currentLkDetail.Loeschdatum || berechneLoeschdatumVorschlag(heutigesDatumIso(), loeschfristOffsetJahre);
    lkDetailForm.elements.Lagerort.value = currentLkDetail.Lagerort;

    lkDetailMassnahmenListe.textContent = currentLkDetail.Massnahmen.length
      ? currentLkDetail.Massnahmen.map((m) => `${m.Bezeichnung} (${m.VT || "–"})`).join(", ")
      : "–";

    lkDetailDeleteBtn.hidden = !canDeleteLeistungskontrolle(currentLkDetail);
  } catch (err) {
    console.error(err);
    lkDetailFormMessage.textContent = err.message;
    lkDetailFormMessage.className = "form-message error";
  }
}

lkZurueckBtn.addEventListener("click", () => {
  window.location.hash = "leistungskontrollen";
});

lkDetailForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(lkDetailForm);
  const payload = {
    Art: formData.get("Art"),
    Bezeichnung: formData.get("Bezeichnung").trim(),
    Beschreibung: formData.get("Beschreibung").trim(),
    Durchfuehrungsdatum: formData.get("Durchfuehrungsdatum"),
    Gesamtpunkte: formData.get("Gesamtpunkte"),
    Loeschdatum: formData.get("Loeschdatum"),
    Lagerort: formData.get("Lagerort").trim(),
    MassnahmeIDs: currentLkDetail.Massnahmen.map((m) => m.ID),
  };

  lkDetailFormMessage.textContent = "";
  lkDetailFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/leistungskontrollen/${currentLkId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Leistungskontrolle konnte nicht aktualisiert werden.");
    }

    await loadLeistungskontrolleDetailPage(currentLkId);
    lkDetailFormMessage.textContent = "Gespeichert.";
    lkDetailFormMessage.classList.add("success");
  } catch (err) {
    lkDetailFormMessage.textContent = err.message;
    lkDetailFormMessage.classList.add("error");
  }
});

lkDetailDeleteBtn.addEventListener("click", () => {
  if (!currentLkDetail) {
    return;
  }
  openDeleteDialog({
    name: currentLkDetail.Bezeichnung,
    endpoint: `/api/leistungskontrollen/${currentLkDetail.ID}`,
    reload: () => {
      window.location.hash = "leistungskontrollen";
    },
  });
});

// Ergebniserfassung (Sub-Dialog der Leistungskontrolle-Detailseite)

function heutigesDatumIso() {
  const heute = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${heute.getFullYear()}-${pad(heute.getMonth() + 1)}-${pad(heute.getDate())}`;
}

lkDetailErgebnisseBtn.addEventListener("click", async () => {
  if (!currentLkId) {
    return;
  }

  lkErgebnisseFormMessage.textContent = "";
  lkErgebnisseFormMessage.className = "form-message";
  lkErgebnisseBezeichnung.textContent = currentLkDetail ? currentLkDetail.Bezeichnung : "";
  lkErgebnisseTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 6;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  lkErgebnisseTableBody.appendChild(loadingRow);
  lkErgebnisseDialog.showModal();

  try {
    const response = await fetch(`/api/leistungskontrollen/${currentLkId}/ergebnisse`);
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Ergebnisse konnten nicht geladen werden.");
    }
    const teilnehmerListe = await response.json();

    lkErgebnisseTableBody.innerHTML = "";

    if (teilnehmerListe.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.textContent = "Keine Teilnehmenden in den zugewiesenen Maßnahmen.";
      emptyRow.appendChild(emptyCell);
      lkErgebnisseTableBody.appendChild(emptyRow);
      return;
    }

    teilnehmerListe.forEach((teilnehmer) => {
      const row = document.createElement("tr");
      row.dataset.teilnehmerId = teilnehmer.TeilnehmerID;

      const nameCell = document.createElement("td");
      nameCell.textContent = `${teilnehmer.Vorname} ${teilnehmer.Nachname}`;

      const vtCell = document.createElement("td");
      vtCell.textContent = teilnehmer.VT || "";

      const punkteCell = document.createElement("td");
      const punkteInput = document.createElement("input");
      punkteInput.type = "number";
      punkteInput.step = "0.01";
      punkteInput.min = "0";
      punkteInput.name = "Ergebnispunkte";
      punkteInput.value = teilnehmer.Ergebnispunkte === null || teilnehmer.Ergebnispunkte === undefined ? "" : teilnehmer.Ergebnispunkte;
      punkteCell.appendChild(punkteInput);

      const noteCell = document.createElement("td");
      const noteInput = document.createElement("input");
      noteInput.type = "number";
      noteInput.min = "1";
      noteInput.max = "6";
      noteInput.step = "0.1";
      noteInput.name = "Note";
      noteInput.value = teilnehmer.Note === null || teilnehmer.Note === undefined ? "" : teilnehmer.Note;
      noteCell.appendChild(noteInput);

      const korrekturCell = document.createElement("td");
      const korrekturInput = document.createElement("input");
      korrekturInput.type = "date";
      korrekturInput.name = "Korrekturdatum";
      korrekturInput.value = teilnehmer.Korrekturdatum || heutigesDatumIso();
      korrekturCell.appendChild(korrekturInput);

      const besprochenCell = document.createElement("td");
      const besprochenInput = document.createElement("input");
      besprochenInput.type = "date";
      besprochenInput.name = "BesprochenAmDatum";
      besprochenInput.value = teilnehmer.BesprochenAmDatum || "";
      besprochenCell.appendChild(besprochenInput);

      row.append(nameCell, vtCell, punkteCell, noteCell, korrekturCell, besprochenCell);
      lkErgebnisseTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    lkErgebnisseTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 6;
    errorCell.textContent = err.message;
    errorRow.appendChild(errorCell);
    lkErgebnisseTableBody.appendChild(errorRow);
  }
});

lkErgebnisseCancelBtn.addEventListener("click", () => {
  lkErgebnisseDialog.close();
});

lkErgebnisseForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const ergebnisse = Array.from(lkErgebnisseTableBody.querySelectorAll("tr[data-teilnehmer-id]")).map((row) => ({
    TeilnehmerID: Number(row.dataset.teilnehmerId),
    Ergebnispunkte: row.querySelector('input[name="Ergebnispunkte"]').value,
    Note: row.querySelector('input[name="Note"]').value,
    Korrekturdatum: row.querySelector('input[name="Korrekturdatum"]').value,
    BesprochenAmDatum: row.querySelector('input[name="BesprochenAmDatum"]').value,
  }));

  lkErgebnisseFormMessage.textContent = "";
  lkErgebnisseFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/leistungskontrollen/${currentLkId}/ergebnisse`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Ergebnisse: ergebnisse }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Ergebnisse konnten nicht gespeichert werden.");
    }

    lkErgebnisseDialog.close();
  } catch (err) {
    lkErgebnisseFormMessage.textContent = err.message;
    lkErgebnisseFormMessage.className = "form-message error";
  }
});

// Anwesenheiten

const awFachbereichFilter = document.getElementById("awFachbereichFilter");
const awGruppeFilter = document.getElementById("awGruppeFilter");
const awMassnahmeFilter = document.getElementById("awMassnahmeFilter");
const awVtFilter = document.getElementById("awVtFilter");
const awNameFilter = document.getElementById("awNameFilter");
const awResetFilterBtn = document.getElementById("awResetFilterBtn");
const awPrevMonthBtn = document.getElementById("awPrevMonthBtn");
const awNextMonthBtn = document.getElementById("awNextMonthBtn");
const awMonthLabel = document.getElementById("awMonthLabel");
const awTableHeadRow = document.getElementById("awTableHeadRow");
const awTableBody = document.getElementById("awTableBody");

const MONTH_NAMES_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];
const WEEKDAY_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

const awToday = new Date();
let awYear = awToday.getFullYear();
let awMonth = awToday.getMonth() + 1;

let awTeilnehmer = [];
let awStatusList = [];
let awAttendance = new Map();
let awGruppen = [];
let awMassnahmen = [];
let awBundesland = "";

async function loadAwBundesland() {
  try {
    const response = await fetch("/api/einstellungen/bildungsstaette");
    awBundesland = response.ok ? (await response.json()).bildungsstaette_bundesland || "" : "";
  } catch (err) {
    console.error(err);
    awBundesland = "";
  }
}

function awPad(n) {
  return String(n).padStart(2, "0");
}

function awIsoDate(year, month, day) {
  return `${year}-${awPad(month)}-${awPad(day)}`;
}

function awDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function awAttendanceKey(teilnehmerId, datum) {
  return `${teilnehmerId}|${datum}`;
}

async function loadAwStatusList() {
  try {
    const response = await fetch("/api/anwesenheitsstatus");
    if (!response.ok) {
      throw new Error("Anwesenheitsstatus konnte nicht geladen werden.");
    }
    awStatusList = await response.json();
  } catch (err) {
    console.error(err);
    awStatusList = [];
  }
}

async function loadAwTeilnehmer() {
  try {
    const response = await fetch("/api/teilnehmer");
    if (!response.ok) {
      throw new Error("Teilnehmende konnten nicht geladen werden.");
    }
    awTeilnehmer = await response.json();
  } catch (err) {
    console.error(err);
    awTeilnehmer = [];
  }
}

async function loadAwGruppen() {
  try {
    const response = await fetch("/api/gruppen");
    if (!response.ok) {
      throw new Error("Gruppen konnten nicht geladen werden.");
    }
    awGruppen = await response.json();
  } catch (err) {
    console.error(err);
    awGruppen = [];
  }
}

async function loadAwMassnahmen() {
  try {
    const response = await fetch("/api/massnahmen");
    if (!response.ok) {
      throw new Error("Maßnahmen konnten nicht geladen werden.");
    }
    awMassnahmen = await response.json();
  } catch (err) {
    console.error(err);
    awMassnahmen = [];
  }
}

function awMassnahmenForFachbereichUndGruppe() {
  const fachbereichId = awFachbereichFilter.value;
  const gruppeId = awGruppeFilter.value;

  return awMassnahmen.filter((massnahme) => {
    if (gruppeId) {
      return String(massnahme.GruppeID || "") === gruppeId;
    }
    if (fachbereichId) {
      const gruppe = awGruppen.find((g) => g.ID === massnahme.GruppeID);
      return Boolean(gruppe) && String(gruppe.FachbereichID || "") === fachbereichId;
    }
    return true;
  });
}

function refreshAwGruppeOptions() {
  const fachbereichId = awFachbereichFilter.value;
  const gruppen = fachbereichId
    ? awGruppen.filter((g) => String(g.FachbereichID || "") === fachbereichId)
    : awGruppen;

  const currentValue = awGruppeFilter.value;
  awGruppeFilter.querySelectorAll("option[data-gruppe]").forEach((option) => option.remove());

  gruppen
    .slice()
    .sort((a, b) => a.Bezeichnung.localeCompare(b.Bezeichnung, "de"))
    .forEach((gruppe) => {
      const option = document.createElement("option");
      option.value = gruppe.ID;
      option.textContent = gruppe.Bezeichnung;
      option.dataset.gruppe = "true";
      awGruppeFilter.appendChild(option);
    });

  awGruppeFilter.value = gruppen.some((g) => String(g.ID) === currentValue) ? currentValue : "";
}

function refreshAwMassnahmeOptions() {
  const bezeichnungen = [...new Set(awMassnahmenForFachbereichUndGruppe().map((m) => m.Bezeichnung).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "de")
  );

  const currentValue = awMassnahmeFilter.value;
  awMassnahmeFilter.querySelectorAll("option[data-massnahme]").forEach((option) => option.remove());

  bezeichnungen.forEach((bezeichnung) => {
    const option = document.createElement("option");
    option.value = bezeichnung;
    option.textContent = bezeichnung;
    option.dataset.massnahme = "true";
    awMassnahmeFilter.appendChild(option);
  });

  awMassnahmeFilter.value = bezeichnungen.includes(currentValue) ? currentValue : "";
}

function refreshAwVtOptions() {
  const massnahmeBezeichnung = awMassnahmeFilter.value;
  const relevant = awMassnahmenForFachbereichUndGruppe().filter(
    (m) => !massnahmeBezeichnung || m.Bezeichnung === massnahmeBezeichnung
  );
  const vtValues = [...new Set(relevant.map((m) => m.VT).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "de", { numeric: true })
  );

  const currentValue = awVtFilter.value;
  awVtFilter.querySelectorAll("option[data-vt]").forEach((option) => option.remove());

  vtValues.forEach((vt) => {
    const option = document.createElement("option");
    option.value = vt;
    option.textContent = vt;
    option.dataset.vt = "true";
    awVtFilter.appendChild(option);
  });

  awVtFilter.value = vtValues.includes(currentValue) ? currentValue : "";
}

async function loadAwAttendance() {
  awAttendance = new Map();
  try {
    const response = await fetch(`/api/anwesenheiten?monat=${awYear}-${awPad(awMonth)}`);
    if (!response.ok) {
      throw new Error("Anwesenheiten konnten nicht geladen werden.");
    }
    const rows = await response.json();
    rows.forEach((row) => {
      awAttendance.set(awAttendanceKey(row.TeilnehmerID, row.Datum), row.StatusID);
    });
  } catch (err) {
    console.error(err);
  }
}

function updateAwMonthLabel() {
  awMonthLabel.textContent = `${MONTH_NAMES_DE[awMonth - 1]} ${awYear}`;
}

function buildAwTableHead() {
  awTableHeadRow.querySelectorAll("th.day-col").forEach((th) => th.remove());

  const days = awDaysInMonth(awYear, awMonth);
  for (let day = 1; day <= days; day++) {
    const weekday = new Date(awYear, awMonth - 1, day).getDay();
    const th = document.createElement("th");
    th.className = "day-col";
    if (weekday === 0 || weekday === 6) {
      th.classList.add("weekend");
    }
    th.innerHTML = `<span class="day-num">${day}</span><span class="day-weekday">${WEEKDAY_SHORT_DE[weekday]}</span>`;
    awTableHeadRow.appendChild(th);
  }
}

function awMatchesFilter(person) {
  const fachbereichId = awFachbereichFilter.value;
  const gruppeId = awGruppeFilter.value;
  const massnahmeBezeichnung = awMassnahmeFilter.value;
  const vt = awVtFilter.value;
  const nameQuery = awNameFilter.value.trim().toLowerCase();

  const monthStart = awIsoDate(awYear, awMonth, 1);
  const monthEnd = awIsoDate(awYear, awMonth, awDaysInMonth(awYear, awMonth));
  if ((person.Endedatum || "") < monthStart || (person.Startdatum || "") > monthEnd) {
    return false;
  }
  if (fachbereichId && String(person.FachbereichID || "") !== fachbereichId) {
    return false;
  }
  if (gruppeId && String(person.GruppeID || "") !== gruppeId) {
    return false;
  }
  if (massnahmeBezeichnung && (person.MassnahmeBezeichnung || "") !== massnahmeBezeichnung) {
    return false;
  }
  if (vt && (person.VT || "") !== vt) {
    return false;
  }
  if (nameQuery) {
    const fullName = `${person.Vorname} ${person.Nachname}`.toLowerCase();
    if (!fullName.includes(nameQuery)) {
      return false;
    }
  }
  return true;
}

async function saveAwCell(teilnehmerId, datum, statusId, selectElement) {
  const previousValue = selectElement.dataset.previousValue || "";

  try {
    const response = await fetch("/api/anwesenheiten", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ TeilnehmerID: teilnehmerId, Datum: datum, StatusID: statusId || null }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Anwesenheit konnte nicht gespeichert werden.");
    }

    selectElement.dataset.previousValue = statusId;
    const key = awAttendanceKey(teilnehmerId, datum);
    if (statusId) {
      awAttendance.set(key, Number(statusId));
    } else {
      awAttendance.delete(key);
    }
  } catch (err) {
    console.error(err);
    selectElement.value = previousValue;
    alert(err.message);
  }
}

let awRowEntries = [];
let awEmptyRow = null;
let awSortKey = null;
let awSortDirection = "asc";

const awSortHeaders = Array.from(document.querySelectorAll("#awTableHeadRow th.sortable-col"));

function awSortValue(person, key) {
  return (person[key] || "").toString();
}

function applyAwSort() {
  awSortHeaders.forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sortKey === awSortKey) {
      th.classList.add(awSortDirection === "asc" ? "sort-asc" : "sort-desc");
    }
  });

  if (!awSortKey) {
    return;
  }

  awRowEntries.sort((a, b) => {
    const result = awSortValue(a.person, awSortKey).localeCompare(awSortValue(b.person, awSortKey), "de", { numeric: true });
    return awSortDirection === "asc" ? result : -result;
  });

  awRowEntries.forEach(({ row }) => awTableBody.appendChild(row));
}

awSortHeaders.forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sortKey;
    if (awSortKey === key) {
      awSortDirection = awSortDirection === "asc" ? "desc" : "asc";
    } else {
      awSortKey = key;
      awSortDirection = "asc";
    }
    applyAwSort();
  });
});

function buildAwTableRows() {
  awTableBody.innerHTML = "";
  awRowEntries = [];

  const days = awDaysInMonth(awYear, awMonth);

  awEmptyRow = document.createElement("tr");
  const emptyCell = document.createElement("td");
  emptyCell.colSpan = 4 + days;
  emptyCell.textContent = "Keine Teilnehmenden gefunden.";
  awEmptyRow.appendChild(emptyCell);
  awTableBody.appendChild(awEmptyRow);

  awTeilnehmer.forEach((person) => {
    const row = document.createElement("tr");

    const vornameCell = document.createElement("td");
    vornameCell.className = "col-sticky col-vorname";
    vornameCell.textContent = person.Vorname;

    const nachnameCell = document.createElement("td");
    nachnameCell.className = "col-sticky col-nachname";
    nachnameCell.textContent = person.Nachname;

    const vtCell = document.createElement("td");
    vtCell.className = "col-sticky col-vt";
    vtCell.textContent = person.VT || "";

    const gruppeCell = document.createElement("td");
    gruppeCell.className = "col-sticky col-gruppe";
    gruppeCell.textContent = person.GruppeKennung || "";

    row.append(vornameCell, nachnameCell, vtCell, gruppeCell);

    for (let day = 1; day <= days; day++) {
      const datum = awIsoDate(awYear, awMonth, day);
      const weekday = new Date(awYear, awMonth - 1, day).getDay();

      const dayCell = document.createElement("td");
      dayCell.className = "day-col";
      if (weekday === 0 || weekday === 6) {
        dayCell.classList.add("weekend");
      }

      const select = document.createElement("select");
      select.className = "day-select";
      select.setAttribute("aria-label", `${person.Vorname} ${person.Nachname}, ${awPad(day)}.${awPad(awMonth)}.${awYear}`);

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = skbFeiertageFuerJahr(awYear, awBundesland).has(datum) ? "F" : "–";
      select.appendChild(emptyOption);

      const currentStatusId = awAttendance.get(awAttendanceKey(person.ID, datum));
      const currentValue = currentStatusId != null ? String(currentStatusId) : "";

      if (currentValue) {
        const currentStatus = awStatusList.find((status) => status.ID === currentStatusId);
        if (currentStatus) {
          const currentOption = document.createElement("option");
          currentOption.value = currentStatus.ID;
          currentOption.textContent = currentStatus.Kurzzeichen;
          currentOption.title = currentStatus.Bezeichnung;
          select.appendChild(currentOption);
        }
      }

      select.value = currentValue;
      select.dataset.previousValue = currentValue;

      // Restliche Status-Optionen werden erst bei Bedarf ergänzt, damit beim
      // Seitenaufbau nicht für alle Tageszellen sämtliche Optionen (7x
      // Anzahl Zellen) erzeugt werden müssen (spürbar bei vielen Teilnehmenden).
      const ensureAwSelectOptions = function () {
        if (select.dataset.optionsLoaded === "true") {
          return;
        }
        select.dataset.optionsLoaded = "true";
        const existingValues = new Set(Array.from(select.options).map((option) => option.value));
        awStatusList.forEach((status) => {
          if (existingValues.has(String(status.ID))) {
            return;
          }
          const option = document.createElement("option");
          option.value = status.ID;
          option.textContent = status.Kurzzeichen;
          option.title = status.Bezeichnung;
          select.appendChild(option);
        });
      };

      select.addEventListener("mousedown", ensureAwSelectOptions);
      select.addEventListener("focus", ensureAwSelectOptions);

      select.addEventListener("change", () => {
        saveAwCell(person.ID, datum, select.value, select);
      });

      dayCell.appendChild(select);
      row.appendChild(dayCell);
    }

    awTableBody.appendChild(row);
    awRowEntries.push({ person, row });
  });

  applyAwSort();
  applyAwFilters();
}

function applyAwFilters() {
  let visibleCount = 0;

  awRowEntries.forEach(({ person, row }) => {
    const visible = awMatchesFilter(person);
    row.style.display = visible ? "" : "none";
    if (visible) {
      visibleCount++;
    }
  });

  if (awEmptyRow) {
    awEmptyRow.style.display = visibleCount === 0 ? "" : "none";
  }
}

async function changeAwMonth(delta) {
  awMonth += delta;
  if (awMonth < 1) {
    awMonth = 12;
    awYear -= 1;
  } else if (awMonth > 12) {
    awMonth = 1;
    awYear += 1;
  }
  updateAwMonthLabel();
  buildAwTableHead();
  await loadAwAttendance();
  buildAwTableRows();
}

awPrevMonthBtn.addEventListener("click", () => changeAwMonth(-1));
awNextMonthBtn.addEventListener("click", () => changeAwMonth(1));

awFachbereichFilter.addEventListener("change", () => {
  refreshAwGruppeOptions();
  refreshAwMassnahmeOptions();
  refreshAwVtOptions();
  applyAwFilters();
});

awGruppeFilter.addEventListener("change", () => {
  refreshAwMassnahmeOptions();
  refreshAwVtOptions();
  applyAwFilters();
});

awMassnahmeFilter.addEventListener("change", () => {
  refreshAwVtOptions();
  applyAwFilters();
});

awVtFilter.addEventListener("change", applyAwFilters);
awNameFilter.addEventListener("input", applyAwFilters);

awResetFilterBtn.addEventListener("click", () => {
  awFachbereichFilter.value = "";
  awGruppeFilter.value = "";
  awMassnahmeFilter.value = "";
  awVtFilter.value = "";
  awNameFilter.value = "";
  refreshAwGruppeOptions();
  refreshAwMassnahmeOptions();
  refreshAwVtOptions();
  applyAwFilters();
});

// PDF-Bericht

const awPdfReportBtn = document.getElementById("awPdfReportBtn");
const pdfConfirmDialog = document.getElementById("pdfConfirmDialog");
const pdfConfirmCancelBtn = document.getElementById("pdfConfirmCancelBtn");
const pdfConfirmOkBtn = document.getElementById("pdfConfirmOkBtn");

const awPdfVtReportBtn = document.getElementById("awPdfVtReportBtn");
const pdfVtConfirmDialog = document.getElementById("pdfVtConfirmDialog");
const pdfVtConfirmCancelBtn = document.getElementById("pdfVtConfirmCancelBtn");
const pdfVtConfirmOkBtn = document.getElementById("pdfVtConfirmOkBtn");

function awSanitizeFilenamePart(text) {
  return text
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-");
}

function awFilterLabel(selectElement) {
  if (!selectElement.value) {
    return "alle";
  }
  return selectElement.selectedOptions[0].textContent.trim();
}

function buildAwReportHeaderLines() {
  return [
    `Fachbereich: ${awFilterLabel(awFachbereichFilter)}`,
    `Gruppe: ${awFilterLabel(awGruppeFilter)}`,
    `Maßnahmebezeichnung: ${awFilterLabel(awMassnahmeFilter)}`,
    `VT: ${awFilterLabel(awVtFilter)}`,
    `Name: ${awNameFilter.value.trim() || "alle"}`,
    `Monat: ${MONTH_NAMES_DE[awMonth - 1]} ${awYear}`,
  ];
}

function buildAwReportFilename() {
  const parts = ["Anwesenheiten"];

  if (awFachbereichFilter.value) {
    parts.push(awSanitizeFilenamePart(awFilterLabel(awFachbereichFilter)));
  }
  if (awGruppeFilter.value) {
    parts.push(awSanitizeFilenamePart(awFilterLabel(awGruppeFilter)));
  }
  if (awMassnahmeFilter.value) {
    parts.push(awSanitizeFilenamePart(awFilterLabel(awMassnahmeFilter)));
  }
  if (awVtFilter.value) {
    parts.push(awSanitizeFilenamePart(awFilterLabel(awVtFilter)));
  }
  if (awNameFilter.value.trim()) {
    parts.push(awSanitizeFilenamePart(awNameFilter.value.trim()));
  }

  parts.push(awSanitizeFilenamePart(MONTH_NAMES_DE[awMonth - 1]));
  parts.push(String(awYear));

  return `${parts.join("_")}.pdf`;
}

function buildAwReportHeaderLinesForVt(vt) {
  return buildAwReportHeaderLines().map((line) => (line.startsWith("VT:") ? `VT: ${vt}` : line));
}

function drawAwReportPage(doc, marginX, headerLines, people) {
  const days = awDaysInMonth(awYear, awMonth);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 58, 77);
  doc.text("Anwesenheitsbericht", marginX, 34);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 51, 51);
  doc.text(headerLines, marginX, 52, { lineHeightFactor: 1.35 });

  const nameColWidth = 65;
  const vtColWidth = 32;
  const gruppeColWidth = 42;
  const fixedColsWidth = nameColWidth * 2 + vtColWidth + gruppeColWidth;
  const dayColWidth = Math.max(14, (pageWidth - marginX * 2 - fixedColsWidth) / days);

  const tableHead = ["Vorname", "Nachname", "VT", "Gruppe"];
  for (let day = 1; day <= days; day++) {
    const weekday = new Date(awYear, awMonth - 1, day).getDay();
    tableHead.push(`${day}\n${WEEKDAY_SHORT_DE[weekday]}`);
  }

  const tableBody = people.map((person) => {
    const row = [person.Vorname, person.Nachname, person.VT || "", person.GruppeKennung || ""];
    for (let day = 1; day <= days; day++) {
      const datum = awIsoDate(awYear, awMonth, day);
      const statusId = awAttendance.get(awAttendanceKey(person.ID, datum));
      const status = awStatusList.find((s) => s.ID === statusId);
      row.push(status ? status.Kurzzeichen : "");
    }
    return row;
  });

  const columnStyles = {
    0: { cellWidth: nameColWidth, halign: "left" },
    1: { cellWidth: nameColWidth, halign: "left" },
    2: { cellWidth: vtColWidth, halign: "center" },
    3: { cellWidth: gruppeColWidth, halign: "center" },
  };
  for (let i = 0; i < days; i++) {
    columnStyles[4 + i] = { cellWidth: dayColWidth, halign: "center" };
  }

  doc.autoTable({
    head: [tableHead],
    body: tableBody,
    startY: 52 + headerLines.length * 13 + 10,
    margin: { left: marginX, right: marginX },
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 2.5, valign: "middle", lineColor: [238, 239, 241], lineWidth: 0.5 },
    headStyles: { fillColor: [0, 173, 238], textColor: 255, fontSize: 6.5, halign: "center" },
    bodyStyles: { textColor: [51, 51, 51] },
    alternateRowStyles: { fillColor: [243, 247, 250] },
    columnStyles,
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Erstellt am ${new Date().toLocaleDateString("de-DE")}`, marginX, pageHeight - 15);
    },
  });
}

function generateAwPdfReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginX = 30;

  const filtered = awTeilnehmer.filter(awMatchesFilter);
  drawAwReportPage(doc, marginX, buildAwReportHeaderLines(), filtered);

  doc.save(buildAwReportFilename());
}

function generateAwPdfReportByVt() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginX = 30;

  const filtered = awTeilnehmer.filter(awMatchesFilter);
  const vtGroups = new Map();
  filtered.forEach((person) => {
    const vt = person.VT || "ohne VT";
    if (!vtGroups.has(vt)) {
      vtGroups.set(vt, []);
    }
    vtGroups.get(vt).push(person);
  });

  const sortedVts = [...vtGroups.keys()].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));

  if (sortedVts.length === 0) {
    drawAwReportPage(doc, marginX, buildAwReportHeaderLines(), []);
  } else {
    sortedVts.forEach((vt, index) => {
      if (index > 0) {
        doc.addPage();
      }
      drawAwReportPage(doc, marginX, buildAwReportHeaderLinesForVt(vt), vtGroups.get(vt));
    });
  }

  doc.save(buildAwReportFilename().replace(/\.pdf$/, "_je-VT.pdf"));
}

awPdfReportBtn.addEventListener("click", () => {
  pdfConfirmDialog.showModal();
});

pdfConfirmCancelBtn.addEventListener("click", () => {
  pdfConfirmDialog.close();
});

pdfConfirmOkBtn.addEventListener("click", () => {
  pdfConfirmDialog.close();

  const originalLabel = awPdfReportBtn.textContent;
  awPdfReportBtn.disabled = true;
  awPdfReportBtn.textContent = "Erstelle Bericht…";

  try {
    generateAwPdfReport();
  } catch (err) {
    console.error(err);
    alert("Der PDF-Bericht konnte nicht erstellt werden.");
  } finally {
    awPdfReportBtn.disabled = false;
    awPdfReportBtn.textContent = originalLabel;
  }
});

awPdfVtReportBtn.addEventListener("click", () => {
  pdfVtConfirmDialog.showModal();
});

pdfVtConfirmCancelBtn.addEventListener("click", () => {
  pdfVtConfirmDialog.close();
});

pdfVtConfirmOkBtn.addEventListener("click", () => {
  pdfVtConfirmDialog.close();

  const originalLabel = awPdfVtReportBtn.textContent;
  awPdfVtReportBtn.disabled = true;
  awPdfVtReportBtn.textContent = "Erstelle Bericht…";

  try {
    generateAwPdfReportByVt();
  } catch (err) {
    console.error(err);
    alert("Der PDF-Bericht konnte nicht erstellt werden.");
  } finally {
    awPdfVtReportBtn.disabled = false;
    awPdfVtReportBtn.textContent = originalLabel;
  }
});

async function initAnwesenheiten() {
  updateAwMonthLabel();
  buildAwTableHead();

  await Promise.all([
    loadFachbereichOptionsInto(awFachbereichFilter),
    loadAwGruppen(),
    loadAwMassnahmen(),
    loadAwStatusList(),
    loadAwTeilnehmer(),
    loadAwAttendance(),
    loadAwBundesland(),
  ]);

  refreshAwGruppeOptions();
  refreshAwMassnahmeOptions();
  refreshAwVtOptions();

  buildAwTableRows();
}

let awInitialized = false;

async function ensureAwInitialized() {
  if (awInitialized) {
    return;
  }
  awInitialized = true;
  await initAnwesenheiten();
}

// Benutzerverwaltung

const benutzerTableBody = document.getElementById("benutzerTableBody");
const benutzerForm = document.getElementById("benutzerForm");
const benutzerFormMessage = document.getElementById("benutzerFormMessage");
const buRollenCheckboxes = document.getElementById("buRollenCheckboxes");
const buFachbereicheCheckboxes = document.getElementById("buFachbereicheCheckboxes");

let rollenCache = [];
let benutzerFachbereicheCache = [];

async function loadRollenCache() {
  try {
    const response = await fetch("/api/rollen");
    if (!response.ok) {
      throw new Error("Rollen konnten nicht geladen werden.");
    }
    rollenCache = await response.json();
  } catch (err) {
    console.error(err);
    rollenCache = [];
  }
}

async function loadBenutzerFachbereicheCache() {
  try {
    const response = await fetch("/api/fachbereiche");
    if (!response.ok) {
      throw new Error("Fachbereiche konnten nicht geladen werden.");
    }
    benutzerFachbereicheCache = await response.json();
  } catch (err) {
    console.error(err);
    benutzerFachbereicheCache = [];
  }
}

function buildCheckboxGroup(container, items, { idKey = "ID", labelKey, checkedIds = [], selectAllLabel = null }) {
  container.innerHTML = "";

  const itemCheckboxes = [];
  let selectAllCheckbox = null;

  function updateSelectAllState() {
    if (!selectAllCheckbox) return;
    const alleAngehakt = itemCheckboxes.length > 0 && itemCheckboxes.every((cb) => cb.checked);
    const keinsAngehakt = itemCheckboxes.every((cb) => !cb.checked);
    selectAllCheckbox.checked = alleAngehakt;
    selectAllCheckbox.indeterminate = !alleAngehakt && !keinsAngehakt;
  }

  if (selectAllLabel) {
    const label = document.createElement("label");
    label.className = "checkbox-group-select-all";
    selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.dataset.selectAll = "true";
    selectAllCheckbox.addEventListener("change", () => {
      itemCheckboxes.forEach((cb) => {
        cb.checked = selectAllCheckbox.checked;
      });
      selectAllCheckbox.indeterminate = false;
    });
    label.appendChild(selectAllCheckbox);
    label.append(` ${selectAllLabel}`);
    container.appendChild(label);
  }

  items.forEach((item) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = item[idKey];
    checkbox.checked = checkedIds.includes(item[idKey]);
    checkbox.addEventListener("change", updateSelectAllState);
    label.appendChild(checkbox);
    label.append(` ${item[labelKey]}`);
    container.appendChild(label);
    itemCheckboxes.push(checkbox);
  });

  updateSelectAllState();
}

function getCheckedValues(container) {
  return Array.from(container.querySelectorAll("input[type=checkbox]:checked"))
    .filter((cb) => !cb.dataset.selectAll)
    .map((cb) => Number(cb.value));
}

async function loadBenutzerFormOptions() {
  await Promise.all([loadRollenCache(), loadBenutzerFachbereicheCache()]);
  buildCheckboxGroup(buRollenCheckboxes, rollenCache, { labelKey: "Bezeichnung", checkedIds: [] });
  buildCheckboxGroup(buFachbereicheCheckboxes, benutzerFachbereicheCache, { labelKey: "BezeichnungLang", checkedIds: [] });
}

async function loadBenutzer() {
  benutzerTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 8;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  benutzerTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/benutzer");
    if (!response.ok) {
      throw new Error("Benutzer konnten nicht geladen werden.");
    }
    const benutzerListe = await response.json();

    benutzerTableBody.innerHTML = "";

    if (benutzerListe.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 8;
      emptyCell.textContent = "Noch keine Benutzer vorhanden.";
      emptyRow.appendChild(emptyCell);
      benutzerTableBody.appendChild(emptyRow);
      return;
    }

    benutzerListe.forEach((benutzer) => {
      const row = document.createElement("tr");

      const usernameCell = document.createElement("td");
      usernameCell.textContent = benutzer.Username;
      usernameCell.classList.toggle("username-deaktiviert", !benutzer.Aktiv);

      const vornameCell = document.createElement("td");
      vornameCell.textContent = benutzer.Vorname;

      const nachnameCell = document.createElement("td");
      nachnameCell.textContent = benutzer.Nachname;

      const emailCell = document.createElement("td");
      emailCell.textContent = benutzer.Email || "";

      const telefonCell = document.createElement("td");
      telefonCell.textContent = benutzer.Telefon || "";

      const rollenCell = document.createElement("td");
      rollenCell.textContent = benutzer.RolleNamen.join(", ");

      const fachbereicheCell = document.createElement("td");
      fachbereicheCell.textContent = benutzer.FachbereichNamen.join(", ");

      const actionsCell = document.createElement("td");
      const actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.setAttribute("aria-label", `${benutzer.Username} bearbeiten`);
      editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      editBtn.addEventListener("click", () => openEditBenutzerDialog(benutzer));

      const resetPasswortBtn = document.createElement("button");
      resetPasswortBtn.type = "button";
      resetPasswortBtn.className = "row-reset-passwort-btn";
      resetPasswortBtn.setAttribute("aria-label", `Passwort von ${benutzer.Username} zurücksetzen`);
      resetPasswortBtn.title = "Passwort zurücksetzen";
      resetPasswortBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="15" r="4"></circle>
          <path d="M10.5 12.5 20 3"></path>
          <path d="M17 6l3 3"></path>
          <path d="M14 9l3 3"></path>
        </svg>
      `;
      resetPasswortBtn.addEventListener("click", () => openResetBenutzerPasswortDialog(benutzer));

      const toggleAktivBtn = document.createElement("button");
      toggleAktivBtn.type = "button";
      toggleAktivBtn.className = "row-toggle-aktiv-btn";
      if (benutzer.Aktiv) {
        toggleAktivBtn.setAttribute("aria-label", `Benutzerkonto ${benutzer.Username} deaktivieren`);
        toggleAktivBtn.title = "Konto deaktivieren";
        toggleAktivBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
        `;
      } else {
        toggleAktivBtn.setAttribute("aria-label", `Benutzerkonto ${benutzer.Username} aktivieren`);
        toggleAktivBtn.title = "Konto aktivieren";
        toggleAktivBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        `;
      }
      toggleAktivBtn.addEventListener("click", () => openToggleBenutzerAktivDialog(benutzer));

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "row-delete-btn";
      deleteBtn.setAttribute("aria-label", `${benutzer.Username} löschen`);
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
          <path d="M10 11v6"></path>
          <path d="M14 11v6"></path>
          <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener("click", () =>
        openDeleteDialog({
          name: benutzer.Username,
          endpoint: `/api/benutzer/${benutzer.ID}`,
          reload: loadBenutzer,
        })
      );

      actionsWrap.append(editBtn, resetPasswortBtn, toggleAktivBtn, deleteBtn);
      actionsCell.appendChild(actionsWrap);

      row.append(
        usernameCell,
        vornameCell,
        nachnameCell,
        emailCell,
        telefonCell,
        rollenCell,
        fachbereicheCell,
        actionsCell
      );
      benutzerTableBody.appendChild(row);
    });
  } catch (err) {
    console.error(err);
    benutzerTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 8;
    errorCell.textContent = "Fehler beim Laden der Benutzer.";
    errorRow.appendChild(errorCell);
    benutzerTableBody.appendChild(errorRow);
  }
}

benutzerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(benutzerForm);
  const payload = {
    Username: formData.get("Username").trim(),
    Passwort: formData.get("Passwort"),
    Vorname: formData.get("Vorname").trim(),
    Nachname: formData.get("Nachname").trim(),
    Email: formData.get("Email").trim(),
    Telefon: formData.get("Telefon").trim(),
    RolleIDs: getCheckedValues(buRollenCheckboxes),
    FachbereichIDs: getCheckedValues(buFachbereicheCheckboxes),
  };

  benutzerFormMessage.textContent = "";
  benutzerFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/benutzer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Benutzer konnte nicht gespeichert werden.");
    }

    benutzerForm.reset();
    buildCheckboxGroup(buRollenCheckboxes, rollenCache, { labelKey: "Bezeichnung", checkedIds: [] });
    buildCheckboxGroup(buFachbereicheCheckboxes, benutzerFachbereicheCache, { labelKey: "BezeichnungLang", checkedIds: [] });
    benutzerFormMessage.textContent = "Benutzer gespeichert.";
    benutzerFormMessage.classList.add("success");
    await loadBenutzer();
  } catch (err) {
    benutzerFormMessage.textContent = err.message;
    benutzerFormMessage.classList.add("error");
  }
});

// Benutzer bearbeiten

const editBenutzerDialog = document.getElementById("editBenutzerDialog");
const editBenutzerForm = document.getElementById("editBenutzerForm");
const editBenutzerFormMessage = document.getElementById("editBenutzerFormMessage");
const editBenutzerCancelBtn = document.getElementById("editBenutzerCancelBtn");
const editBuRollenCheckboxes = document.getElementById("editBuRollenCheckboxes");
const editBuFachbereicheCheckboxes = document.getElementById("editBuFachbereicheCheckboxes");

let editingBenutzerId = null;

function openEditBenutzerDialog(benutzer) {
  editingBenutzerId = benutzer.ID;
  editBenutzerForm.elements.Username.value = benutzer.Username;
  editBenutzerForm.elements.Passwort.value = "";
  editBenutzerForm.elements.Vorname.value = benutzer.Vorname;
  editBenutzerForm.elements.Nachname.value = benutzer.Nachname;
  editBenutzerForm.elements.Email.value = benutzer.Email || "";
  editBenutzerForm.elements.Telefon.value = benutzer.Telefon || "";
  buildCheckboxGroup(editBuRollenCheckboxes, rollenCache, { labelKey: "Bezeichnung", checkedIds: benutzer.RolleIDs });
  buildCheckboxGroup(editBuFachbereicheCheckboxes, benutzerFachbereicheCache, {
    labelKey: "BezeichnungLang",
    checkedIds: benutzer.FachbereichIDs,
  });
  editBenutzerFormMessage.textContent = "";
  editBenutzerFormMessage.className = "form-message";
  editBenutzerDialog.showModal();
}

editBenutzerCancelBtn.addEventListener("click", () => {
  editBenutzerDialog.close();
});

editBenutzerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(editBenutzerForm);
  const payload = {
    Username: formData.get("Username").trim(),
    Passwort: formData.get("Passwort"),
    Vorname: formData.get("Vorname").trim(),
    Nachname: formData.get("Nachname").trim(),
    Email: formData.get("Email").trim(),
    Telefon: formData.get("Telefon").trim(),
    RolleIDs: getCheckedValues(editBuRollenCheckboxes),
    FachbereichIDs: getCheckedValues(editBuFachbereicheCheckboxes),
  };

  editBenutzerFormMessage.textContent = "";
  editBenutzerFormMessage.className = "form-message";

  try {
    const response = await fetch(`/api/benutzer/${editingBenutzerId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Benutzer konnte nicht aktualisiert werden.");
    }

    editBenutzerDialog.close();
    editingBenutzerId = null;
    await loadBenutzer();
  } catch (err) {
    editBenutzerFormMessage.textContent = err.message;
    editBenutzerFormMessage.className = "form-message error";
  }
});

// Benutzer-Passwort zurücksetzen (Admin)

const resetBenutzerPasswortDialog = document.getElementById("resetBenutzerPasswortDialog");
const resetBenutzerPasswortForm = document.getElementById("resetBenutzerPasswortForm");
const resetBenutzerPasswortFormMessage = document.getElementById("resetBenutzerPasswortFormMessage");
const resetBenutzerPasswortCancelBtn = document.getElementById("resetBenutzerPasswortCancelBtn");
const resetBenutzerPasswortUsername = document.getElementById("resetBenutzerPasswortUsername");

let resettingBenutzerId = null;

function openResetBenutzerPasswortDialog(benutzer) {
  resettingBenutzerId = benutzer.ID;
  resetBenutzerPasswortUsername.textContent = benutzer.Username;
  resetBenutzerPasswortForm.reset();
  resetBenutzerPasswortFormMessage.textContent = "";
  resetBenutzerPasswortFormMessage.className = "form-message";
  resetBenutzerPasswortDialog.showModal();
}

resetBenutzerPasswortCancelBtn.addEventListener("click", () => {
  resetBenutzerPasswortDialog.close();
});

resetBenutzerPasswortForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(resetBenutzerPasswortForm);
  const payload = {
    NeuesPasswort: formData.get("NeuesPasswort"),
    NeuesPasswortWiederholung: formData.get("NeuesPasswortWiederholung"),
  };

  resetBenutzerPasswortFormMessage.textContent = "";
  resetBenutzerPasswortFormMessage.className = "form-message";

  if (payload.NeuesPasswort !== payload.NeuesPasswortWiederholung) {
    resetBenutzerPasswortFormMessage.textContent = "Die Passwort-Wiederholung stimmt nicht überein.";
    resetBenutzerPasswortFormMessage.classList.add("error");
    return;
  }

  try {
    const response = await fetch(`/api/benutzer/${resettingBenutzerId}/passwort`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Passwort konnte nicht geändert werden.");
    }

    resetBenutzerPasswortDialog.close();
    resettingBenutzerId = null;
  } catch (err) {
    resetBenutzerPasswortFormMessage.textContent = err.message;
    resetBenutzerPasswortFormMessage.classList.add("error");
  }
});

// Benutzerkonto aktivieren/deaktivieren

const toggleBenutzerAktivDialog = document.getElementById("toggleBenutzerAktivDialog");
const toggleBenutzerAktivTitle = document.getElementById("toggleBenutzerAktivTitle");
const toggleBenutzerAktivUsername = document.getElementById("toggleBenutzerAktivUsername");
const toggleBenutzerAktivAction = document.getElementById("toggleBenutzerAktivAction");
const toggleBenutzerAktivMessage = document.getElementById("toggleBenutzerAktivMessage");
const toggleBenutzerAktivCancelBtn = document.getElementById("toggleBenutzerAktivCancelBtn");
const toggleBenutzerAktivOkBtn = document.getElementById("toggleBenutzerAktivOkBtn");

let toggleBenutzerAktivTarget = null;

function openToggleBenutzerAktivDialog(benutzer) {
  const nextAktiv = !benutzer.Aktiv;
  toggleBenutzerAktivTarget = { id: benutzer.ID, nextAktiv };

  toggleBenutzerAktivTitle.textContent = nextAktiv ? "Benutzerkonto aktivieren" : "Benutzerkonto deaktivieren";
  toggleBenutzerAktivUsername.textContent = benutzer.Username;
  toggleBenutzerAktivAction.textContent = nextAktiv ? "aktiviert" : "deaktiviert";
  toggleBenutzerAktivOkBtn.textContent = nextAktiv ? "Aktivieren" : "Deaktivieren";
  toggleBenutzerAktivMessage.textContent = "";
  toggleBenutzerAktivMessage.className = "form-message";

  toggleBenutzerAktivDialog.showModal();
}

toggleBenutzerAktivCancelBtn.addEventListener("click", () => {
  toggleBenutzerAktivDialog.close();
});

toggleBenutzerAktivOkBtn.addEventListener("click", async () => {
  if (!toggleBenutzerAktivTarget) {
    return;
  }

  toggleBenutzerAktivMessage.textContent = "";
  toggleBenutzerAktivMessage.className = "form-message";

  try {
    const response = await fetch(`/api/benutzer/${toggleBenutzerAktivTarget.id}/aktiv`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Aktiv: toggleBenutzerAktivTarget.nextAktiv }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Status konnte nicht geändert werden.");
    }

    toggleBenutzerAktivDialog.close();
    toggleBenutzerAktivTarget = null;
    await loadBenutzer();
  } catch (err) {
    toggleBenutzerAktivMessage.textContent = err.message;
    toggleBenutzerAktivMessage.classList.add("error");
  }
});

// Passwort ändern

const changePasswordBtn = document.getElementById("changePasswordBtn");
const changePasswordDialog = document.getElementById("changePasswordDialog");
const changePasswordForm = document.getElementById("changePasswordForm");
const changePasswordFormMessage = document.getElementById("changePasswordFormMessage");
const changePasswordCancelBtn = document.getElementById("changePasswordCancelBtn");

changePasswordBtn.addEventListener("click", () => {
  changePasswordForm.reset();
  changePasswordFormMessage.textContent = "";
  changePasswordFormMessage.className = "form-message";
  changePasswordDialog.showModal();
});

changePasswordCancelBtn.addEventListener("click", () => {
  changePasswordDialog.close();
});

changePasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(changePasswordForm);
  const payload = {
    AktuellesPasswort: formData.get("AktuellesPasswort"),
    NeuesPasswort: formData.get("NeuesPasswort"),
    NeuesPasswortWiederholung: formData.get("NeuesPasswortWiederholung"),
  };

  changePasswordFormMessage.textContent = "";
  changePasswordFormMessage.className = "form-message";

  if (payload.NeuesPasswort !== payload.NeuesPasswortWiederholung) {
    changePasswordFormMessage.textContent = "Die Passwort-Wiederholung stimmt nicht überein.";
    changePasswordFormMessage.classList.add("error");
    return;
  }

  try {
    const response = await fetch("/api/me/passwort", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Passwort konnte nicht geändert werden.");
    }

    changePasswordDialog.close();
  } catch (err) {
    changePasswordFormMessage.textContent = err.message;
    changePasswordFormMessage.classList.add("error");
  }
});

// Boot-Sequenz / Login

function initializeApp() {
  loadFachbereiche();
  loadFachbereichOptionsInto(grpFachbereichSelect);
  loadFachbereichOptionsInto(editGrpFachbereichSelect);
  if (canAccessFormulare(currentUser)) {
    loadFormularFormOptions();
    loadFormulare();
  }
  loadGruppen();
  loadGruppeOptionsInto(mnGruppeSelect);
  loadGruppeOptionsInto(editMnGruppeSelect);
  loadMassnahmetypen();
  loadMassnahmen();
  loadMassnahmeOptionsInto(tnMassnahmeSelect, { includeVt: true });
  loadMassnahmeOptionsInto(editTnMassnahmeSelect, { includeVt: true });
  loadFachbereichOptionsInto(tnFachbereichFilter);
  initTnFilterOptions();
  loadTeilnehmer();
  loadLoeschfristOffset();

  if (currentUser.roles.includes("Administrator")) {
    loadBenutzerFormOptions();
    loadBenutzer();
  }

  handleRouteChange();
}

const UNRESTRICTED_ROLLEN = ["Administrator", "Lehrgangsorganisation", "Bildungsstättenleiter"];

function isRestrictedUser() {
  return !currentUser || !currentUser.roles.some((r) => UNRESTRICTED_ROLLEN.includes(r));
}

function canDeleteMassnahmenOderTeilnehmer() {
  return !isRestrictedUser();
}

function canDeleteGruppe(gruppe) {
  if (!isRestrictedUser()) {
    return true;
  }
  if (!currentUser.roles.includes("Fachbereichsleiter")) {
    return false;
  }
  return Number(gruppe.MassnahmenAnzahl) === 0;
}

function canDeleteDokument() {
  return currentUser && currentUser.roles.includes("Administrator");
}

function applyRolePermissions(user) {
  const isAdmin = (user.roles || []).includes("Administrator");
  const auditOnly = isAuditorOnly(user);
  const isLehrgangsorganisation = (user.roles || []).includes("Lehrgangsorganisation");

  const leistungskontrolleLink = document.querySelector('.sidebar-link[data-page="leistungskontrollen"]');
  if (leistungskontrolleLink) {
    leistungskontrolleLink.closest("li").style.display = isLehrgangsorganisation || auditOnly ? "none" : "";
  }

  const fachbereicheLink = document.querySelector('.sidebar-link[data-page="fachbereiche"]');
  if (fachbereicheLink) {
    fachbereicheLink.closest("li").style.display = isAdmin ? "" : "none";
  }

  const stammdatenFachbereicheCard = document.getElementById("stammdatenFachbereicheCard");
  if (stammdatenFachbereicheCard) {
    stammdatenFachbereicheCard.style.display = isAdmin ? "" : "none";
  }

  const massnahmetypenLink = document.querySelector('.sidebar-link[data-page="massnahmetypen"]');
  if (massnahmetypenLink) {
    massnahmetypenLink.closest("li").style.display = isAdmin ? "" : "none";
  }
  const stammdatenMassnahmetypenCard = document.getElementById("stammdatenMassnahmetypenCard");
  if (stammdatenMassnahmetypenCard) {
    stammdatenMassnahmetypenCard.style.display = isAdmin ? "" : "none";
  }

  const formulareErlaubt = canAccessFormulare(user);
  const formulareLink = document.querySelector('.sidebar-link[data-page="formulare"]');
  if (formulareLink) {
    formulareLink.closest("li").style.display = formulareErlaubt ? "" : "none";
  }
  const stammdatenFormulareCard = document.getElementById("stammdatenFormulareCard");
  if (stammdatenFormulareCard) {
    stammdatenFormulareCard.style.display = formulareErlaubt ? "" : "none";
  }

  const workflowsLink = document.querySelector('.sidebar-link[data-page="workflows"]');
  if (workflowsLink) {
    workflowsLink.closest("li").style.display = isAdmin ? "" : "none";
  }
  const stammdatenWorkflowsCard = document.getElementById("stammdatenWorkflowsCard");
  if (stammdatenWorkflowsCard) {
    stammdatenWorkflowsCard.style.display = isAdmin ? "" : "none";
  }

  const benutzerLink = document.querySelector('.sidebar-link[data-page="benutzer"]');
  if (benutzerLink) {
    benutzerLink.closest("li").style.display = isAdmin ? "" : "none";
  }

  const einstellungenLink = document.querySelector('.sidebar-link[data-page="einstellungen"]');
  if (einstellungenLink) {
    einstellungenLink.closest("li").style.display = isAdmin ? "" : "none";
  }

  const auditGroup = document.querySelector('.sidebar-group[data-group="audit"]');
  if (auditGroup) {
    auditGroup.closest("li").style.display = canAccessAudit(user) ? "" : "none";
  }

  const systemlogsGroup = document.querySelector('.sidebar-group[data-group="systemlogs"]');
  if (systemlogsGroup) {
    systemlogsGroup.closest("li").style.display = isAdmin ? "" : "none";
  }

  const stammdatenGroup = document.querySelector('.sidebar-group[data-group="stammdaten"]');
  if (stammdatenGroup) {
    stammdatenGroup.closest("li").style.display = auditOnly ? "none" : "";
  }

  const operativePages = ["dashboard", "anwesenheiten", "teilnehmende"];
  operativePages.forEach((page) => {
    const link = document.querySelector(`.sidebar-link[data-page="${page}"]`);
    if (link) {
      link.closest("li").style.display = auditOnly ? "none" : "";
    }
  });
}

function showAppShell(user) {
  currentUser = user;
  document.body.classList.remove("logged-out");
  topbarUsername.textContent = `${user.Vorname} ${user.Nachname}`;
  applyRolePermissions(user);
  initializeApp();
}

async function checkSession() {
  try {
    const response = await fetch("/api/me");
    if (!response.ok) {
      return;
    }
    const user = await response.json();
    showAppShell(user);
  } catch (err) {
    console.error(err);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const payload = {
    Username: formData.get("Username").trim(),
    Passwort: formData.get("Passwort"),
  };

  loginFormMessage.textContent = "";
  loginFormMessage.className = "form-message";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Anmeldung fehlgeschlagen.");
    }

    const user = await response.json();
    loginForm.reset();
    showAppShell(user);
  } catch (err) {
    loginPasswort.value = "";
    loginFormMessage.textContent = err.message;
    loginFormMessage.classList.add("error");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/logout", { method: "POST" });
  } catch (err) {
    console.error(err);
  }
  window.location.reload();
});

checkSession();
