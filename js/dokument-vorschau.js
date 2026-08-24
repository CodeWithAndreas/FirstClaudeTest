(function () {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const name = params.get("name") || "Dokument";

  const dateinameEl = document.getElementById("vorschauDateiname");
  const downloadEl = document.getElementById("vorschauDownload");
  const inhaltEl = document.getElementById("vorschauInhalt");
  const statusEl = document.getElementById("vorschauStatus");

  dateinameEl.textContent = name;

  if (!id) {
    statusEl.textContent = "Kein Dokument angegeben.";
    return;
  }

  downloadEl.href = `/api/dokumente/${id}/datei`;

  const endung = (name.split(".").pop() || "").toLowerCase();
  const vorschauUrl = `/api/dokumente/${id}/vorschau`;

  const PDF_TYPEN = ["pdf"];
  const BILD_TYPEN = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"];
  const DOCX_TYPEN = ["docx"];
  const TABELLEN_TYPEN = ["xlsx", "xls"];

  function zeigeFehler(text) {
    inhaltEl.innerHTML = "";
    const p = document.createElement("p");
    p.className = "vorschau-status";
    p.textContent = text;
    inhaltEl.appendChild(p);
  }

  function ersetzeInhalt(element) {
    inhaltEl.innerHTML = "";
    inhaltEl.appendChild(element);
  }

  if (endung === "doc") {
    zeigeFehler("Für dieses ältere Word-Format (.doc) ist keine Vorschau möglich. Bitte herunterladen.");
    return;
  }

  const unterstuetzt = [...PDF_TYPEN, ...BILD_TYPEN, ...DOCX_TYPEN, ...TABELLEN_TYPEN];
  if (!unterstuetzt.includes(endung)) {
    zeigeFehler("Für diesen Dateityp ist keine Vorschau verfügbar. Bitte herunterladen.");
    return;
  }

  fetch(vorschauUrl)
    .then(async (resp) => {
      if (!resp.ok) {
        let meldung = "Datei konnte nicht geladen werden.";
        try {
          const data = await resp.json();
          if (data && data.error) meldung = data.error;
        } catch (err) {
          // Antwort war kein JSON, Standardmeldung verwenden.
        }
        throw new Error(meldung);
      }
      const contentType = resp.headers.get("content-type") || "";
      const buffer = await resp.arrayBuffer();

      if (PDF_TYPEN.includes(endung)) {
        const blob = new Blob([buffer], { type: contentType || "application/pdf" });
        const iframe = document.createElement("iframe");
        iframe.className = "vorschau-frame";
        iframe.src = URL.createObjectURL(blob);
        ersetzeInhalt(iframe);
      } else if (BILD_TYPEN.includes(endung)) {
        const blob = new Blob([buffer], { type: contentType || "image/*" });
        const img = document.createElement("img");
        img.className = "vorschau-bild";
        img.alt = name;
        img.src = URL.createObjectURL(blob);
        ersetzeInhalt(img);
      } else if (DOCX_TYPEN.includes(endung)) {
        const container = document.createElement("div");
        container.className = "vorschau-docx";
        ersetzeInhalt(container);
        await window.docx.renderAsync(buffer, container, undefined, {
          inWrapper: false,
          ignoreWidth: true,
        });
      } else if (TABELLEN_TYPEN.includes(endung)) {
        renderTabelle(buffer);
      }
    })
    .catch((err) => {
      console.error(err);
      zeigeFehler(err.message || "Vorschau konnte nicht geladen werden.");
    });

  function renderTabelle(buffer) {
    const workbook = window.XLSX.read(new Uint8Array(buffer), { type: "array" });
    const wrap = document.createElement("div");
    wrap.className = "vorschau-tabelle-wrap";

    let auswahl = null;
    if (workbook.SheetNames.length > 1) {
      auswahl = document.createElement("select");
      auswahl.className = "vorschau-tabelle-blattauswahl";
      workbook.SheetNames.forEach((blattname) => {
        const option = document.createElement("option");
        option.value = blattname;
        option.textContent = blattname;
        auswahl.appendChild(option);
      });
      wrap.appendChild(auswahl);
    }

    const tabelleContainer = document.createElement("div");
    wrap.appendChild(tabelleContainer);
    ersetzeInhalt(wrap);

    function zeigeBlatt(blattname) {
      const sheet = workbook.Sheets[blattname];
      tabelleContainer.innerHTML = window.XLSX.utils.sheet_to_html(sheet, { editable: false });
      const table = tabelleContainer.querySelector("table");
      if (table) table.className = "vorschau-tabelle";
    }

    if (auswahl) {
      auswahl.addEventListener("change", () => zeigeBlatt(auswahl.value));
    }
    zeigeBlatt(workbook.SheetNames[0]);
  }
})();
