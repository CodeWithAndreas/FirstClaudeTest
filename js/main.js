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
const adminOnlyPages = ["fachbereiche", "benutzer"];

const pageLabels = {
  dashboard: "Dashboard",
  teilnehmende: "Teilnehmende",
  anwesenheiten: "Anwesenheiten",
  massnahmen: "Maßnahmen",
  gruppen: "Gruppen",
  fachbereiche: "Fachbereiche",
  benutzer: "Benutzer",
};

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

function showPage(pageId) {
  let targetId = document.getElementById(`page-${pageId}`) ? pageId : defaultPage;

  if (adminOnlyPages.includes(targetId) && !(currentUser && currentUser.roles.includes("Administrator"))) {
    targetId = defaultPage;
  }

  if (targetId === "teilnehmende-aktivitaeten" && !currentAktivitaetTeilnehmerId) {
    targetId = "teilnehmende";
  }

  pages.forEach((page) => {
    page.classList.toggle("active", page.id === `page-${targetId}`);
  });

  const activeNavPage = targetId === "teilnehmende-aktivitaeten" ? "teilnehmende" : targetId;
  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === activeNavPage);
  });

  breadcrumb.textContent =
    targetId === "teilnehmende-aktivitaeten"
      ? "Start / Teilnehmende / Aktivitätenverlauf"
      : `Start / ${pageLabels[targetId]}`;

  if (targetId === "dashboard") {
    loadDashboardStats();
    loadDashboardWiedervorlagen();
  }
  if (targetId === "anwesenheiten") {
    ensureAwInitialized();
  }
  if (targetId === "teilnehmende" && tnRowEntries.length > 0) {
    refreshTnAktivitaetBadges();
  }
  if (targetId === "teilnehmende-aktivitaeten") {
    loadTeilnehmerAktivitaetenPage(currentAktivitaetTeilnehmerId);
  }
}

function handleRouteChange() {
  const pageId = window.location.hash.replace("#", "") || defaultPage;
  showPage(pageId);
}

window.addEventListener("hashchange", handleRouteChange);

// Dashboard

async function loadDashboardStats() {
  const endpoints = [
    ["/api/teilnehmer", dashTeilnehmerCount],
    ["/api/massnahmen", dashMassnahmenCount],
    ["/api/gruppen", dashGruppenCount],
    ["/api/fachbereiche", dashFachbereicheCount],
  ];

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

// Maßnahmen

const massnahmenTableBody = document.getElementById("massnahmenTableBody");
const massnahmeForm = document.getElementById("massnahmeForm");
const massnahmeFormMessage = document.getElementById("massnahmeFormMessage");
const mnGruppeSelect = document.getElementById("mnGruppeID");

const editMassnahmeDialog = document.getElementById("editMassnahmeDialog");
const editMassnahmeForm = document.getElementById("editMassnahmeForm");
const editMassnahmeFormMessage = document.getElementById("editMassnahmeFormMessage");
const editMassnahmeCancelBtn = document.getElementById("editMassnahmeCancelBtn");
const editMnGruppeSelect = document.getElementById("editMnGruppeID");

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
  loadingCell.colSpan = 7;
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
      emptyCell.colSpan = 7;
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

      row.append(bezeichnungCell, vtCell, gruppeCell, zertCell, startCell, endeCell, actionsCell);
      massnahmenTableBody.appendChild(row);
    });

    loadMassnahmeOptionsInto(tnMassnahmeSelect, { includeVt: true });
    loadMassnahmeOptionsInto(editTnMassnahmeSelect, { includeVt: true });
  } catch (err) {
    console.error(err);
    massnahmenTableBody.innerHTML = "";
    const errorRow = document.createElement("tr");
    const errorCell = document.createElement("td");
    errorCell.colSpan = 7;
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

async function loadTeilnehmer() {
  teilnehmerTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 9;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  teilnehmerTableBody.appendChild(loadingRow);

  try {
    const [response] = await Promise.all([fetch("/api/teilnehmer"), loadTnAktivitaetSummary()]);
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

      const historyBtnWrap = document.createElement("span");
      historyBtnWrap.className = "history-btn-wrap";

      const historyBtn = document.createElement("button");
      historyBtn.type = "button";
      historyBtn.className = "row-history-btn";
      historyBtn.setAttribute("aria-label", `Aktivitäten von ${fullName} anzeigen`);
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

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "row-edit-btn";
      editBtn.setAttribute("aria-label", `${fullName} bearbeiten`);
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

      actionsWrap.append(historyBtnWrap, editBtn);
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
      emptyOption.textContent = "–";
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

function buildCheckboxGroup(container, items, { idKey = "ID", labelKey, checkedIds = [] }) {
  container.innerHTML = "";
  items.forEach((item) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = item[idKey];
    checkbox.checked = checkedIds.includes(item[idKey]);
    label.appendChild(checkbox);
    label.append(` ${item[labelKey]}`);
    container.appendChild(label);
  });
}

function getCheckedValues(container) {
  return Array.from(container.querySelectorAll("input[type=checkbox]:checked")).map((cb) => Number(cb.value));
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
  loadGruppen();
  loadGruppeOptionsInto(mnGruppeSelect);
  loadGruppeOptionsInto(editMnGruppeSelect);
  loadMassnahmen();
  loadMassnahmeOptionsInto(tnMassnahmeSelect, { includeVt: true });
  loadMassnahmeOptionsInto(editTnMassnahmeSelect, { includeVt: true });
  loadFachbereichOptionsInto(tnFachbereichFilter);
  initTnFilterOptions();
  loadTeilnehmer();

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

function applyRolePermissions(user) {
  const isAdmin = (user.roles || []).includes("Administrator");

  const fachbereicheLink = document.querySelector('.sidebar-link[data-page="fachbereiche"]');
  if (fachbereicheLink) {
    fachbereicheLink.closest("li").style.display = isAdmin ? "" : "none";
  }

  const benutzerLink = document.querySelector('.sidebar-link[data-page="benutzer"]');
  if (benutzerLink) {
    benutzerLink.closest("li").style.display = isAdmin ? "" : "none";
  }
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
