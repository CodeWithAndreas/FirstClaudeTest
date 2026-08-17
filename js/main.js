console.log("Standortmanager geladen");

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

const pageLabels = {
  dashboard: "Dashboard",
  teilnehmende: "Teilnehmende",
  anwesenheiten: "Anwesenheiten",
  massnahmen: "Maßnahmen",
  gruppen: "Gruppen",
  fachbereiche: "Fachbereiche",
};

const dashTeilnehmerCount = document.getElementById("dashTeilnehmerCount");
const dashMassnahmenCount = document.getElementById("dashMassnahmenCount");
const dashGruppenCount = document.getElementById("dashGruppenCount");
const dashFachbereicheCount = document.getElementById("dashFachbereicheCount");

sidebarToggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Menü ausklappen" : "Menü einklappen");
});

function showPage(pageId) {
  const targetId = document.getElementById(`page-${pageId}`) ? pageId : defaultPage;

  pages.forEach((page) => {
    page.classList.toggle("active", page.id === `page-${targetId}`);
  });

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.page === targetId);
  });

  breadcrumb.textContent = `Start / ${pageLabels[targetId]}`;

  if (targetId === "dashboard") {
    loadDashboardStats();
  }
  if (targetId === "anwesenheiten") {
    ensureAwInitialized();
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

loadFachbereiche();

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

      actionsWrap.append(editBtn, deleteBtn);
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

loadFachbereichOptionsInto(grpFachbereichSelect);
loadGruppen();

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

loadFachbereichOptionsInto(editGrpFachbereichSelect);

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

      actionsWrap.append(editBtn, deleteBtn);
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

loadGruppeOptionsInto(mnGruppeSelect);
loadGruppeOptionsInto(editMnGruppeSelect);
loadMassnahmen();

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

async function loadTeilnehmer() {
  teilnehmerTableBody.innerHTML = "";
  const loadingRow = document.createElement("tr");
  const loadingCell = document.createElement("td");
  loadingCell.colSpan = 9;
  loadingCell.textContent = "Lädt…";
  loadingRow.appendChild(loadingCell);
  teilnehmerTableBody.appendChild(loadingRow);

  try {
    const response = await fetch("/api/teilnehmer");
    if (!response.ok) {
      throw new Error("Teilnehmende konnten nicht geladen werden.");
    }
    const teilnehmer = await response.json();

    teilnehmerTableBody.innerHTML = "";

    if (teilnehmer.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.colSpan = 9;
      emptyCell.textContent = "Noch keine Teilnehmenden vorhanden.";
      emptyRow.appendChild(emptyCell);
      teilnehmerTableBody.appendChild(emptyRow);
      return;
    }

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

      actionsWrap.append(editBtn, deleteBtn);
      actionsCell.appendChild(actionsWrap);

      row.append(vornameCell, nachnameCell, geburtsdatumCell, massnahmeCell, startCell, endeCell, emailCell, telefonCell, actionsCell);
      teilnehmerTableBody.appendChild(row);
    });
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

loadMassnahmeOptionsInto(tnMassnahmeSelect, { includeVt: true });
loadMassnahmeOptionsInto(editTnMassnahmeSelect, { includeVt: true });
loadTeilnehmer();

handleRouteChange();
