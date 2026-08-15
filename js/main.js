console.log("FirstClaudeTest geladen");

const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");

sidebarToggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "Menü ausklappen" : "Menü einklappen");
});
