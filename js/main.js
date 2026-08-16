console.log("Standortmanager geladen");

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
const breadcrumb = document.getElementById("breadcrumb");
const navLinks = document.querySelectorAll(".sidebar-link[data-page]");
const pages = document.querySelectorAll(".page");
const defaultPage = "teilnehmende";

const pageLabels = {
  teilnehmende: "Teilnehmende",
  anwesenheiten: "Anwesenheiten",
  massnahmen: "Maßnahmen",
  gruppen: "Gruppen",
  fachbereiche: "Fachbereiche",
};

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
}

function handleRouteChange() {
  const pageId = window.location.hash.replace("#", "") || defaultPage;
  showPage(pageId);
}

window.addEventListener("hashchange", handleRouteChange);
handleRouteChange();

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
      zertCell.textContent = massnahme.ZertDatum;

      const startCell = document.createElement("td");
      startCell.textContent = massnahme.PlanStart;

      const endeCell = document.createElement("td");
      endeCell.textContent = massnahme.PlanEnde;

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

async function loadMassnahmeOptionsInto(selectElement) {
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
      option.textContent = massnahme.Bezeichnung;
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
      geburtsdatumCell.textContent = person.Geburtsdatum;

      const massnahmeCell = document.createElement("td");
      massnahmeCell.textContent = person.MassnahmeBezeichnung || "";

      const startCell = document.createElement("td");
      startCell.textContent = person.Startdatum;

      const endeCell = document.createElement("td");
      endeCell.textContent = person.Endedatum;

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

loadMassnahmeOptionsInto(tnMassnahmeSelect);
loadMassnahmeOptionsInto(editTnMassnahmeSelect);
loadTeilnehmer();
