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
