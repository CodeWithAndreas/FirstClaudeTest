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
      deleteBtn.addEventListener("click", () => openDeleteDialog(fachbereich));
      actionsCell.appendChild(deleteBtn);

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

// Löschen mit Bestätigung

const deleteDialog = document.getElementById("deleteDialog");
const deleteForm = document.getElementById("deleteForm");
const deleteTargetName = document.getElementById("deleteTargetName");
const deleteConfirmInput = document.getElementById("deleteConfirmInput");
const deleteFormMessage = document.getElementById("deleteFormMessage");
const deleteCancelBtn = document.getElementById("deleteCancelBtn");

let pendingDelete = null;

function openDeleteDialog(fachbereich) {
  pendingDelete = fachbereich;
  deleteTargetName.textContent = fachbereich.BezeichnungLang;
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

  if (deleteConfirmInput.value.trim() !== pendingDelete.BezeichnungLang) {
    deleteFormMessage.textContent = "Die eingegebene Bezeichnung stimmt nicht überein.";
    deleteFormMessage.className = "form-message error";
    return;
  }

  try {
    const response = await fetch(`/api/fachbereiche/${pendingDelete.ID}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Fachbereich konnte nicht gelöscht werden.");
    }

    deleteDialog.close();
    pendingDelete = null;
    await loadFachbereiche();
  } catch (err) {
    deleteFormMessage.textContent = err.message;
    deleteFormMessage.className = "form-message error";
  }
});
