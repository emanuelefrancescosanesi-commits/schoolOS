// Axios "Registro Famiglie": la pagina voti è una griglia materia × data.
//  - tabella .rdoc_full_alunni: una riga per materia (nome nella prima cella)
//  - tabella .rdoc_full_valutazioni: stesse righe, colonne = date ("29<br>set"), eventuale colspan;
//    cella voto = td.voto.voto_{S|G|O|P|A}_{positivo|negativo} (voto_no_media = senza tipo).
// Il testo semplice della pagina perde le date: qui si legge la struttura e si produce un testo
// "MATERIA / gg/mm/aaaa Tipo voto" che il parser di SchoolOS già capisce.
// Restituisce null se la pagina non è la griglia voti di Axios.
function axiosToRows(doc, today) {
  const names = doc.querySelector("table.rdoc_full_alunni");
  const grid = doc.querySelector("table.rdoc_full_valutazioni");
  if (!names || !grid) return null;

  const MONTHS = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
  const KINDS = { S: "Scritto", G: "Grafico", O: "Orale", P: "Pratico", A: "Altro" };
  const now = today || new Date();

  // Anno di inizio dell'anno scolastico: dal periodo selezionato "TRIMESTRE (01/09/2026 - …)",
  // altrimenti da oggi (da settembre in poi è l'anno corrente).
  const chosen = doc.querySelector(".select9-chosen");
  const m = chosen && /(\d{2})\/(\d{2})\/(\d{4})/.exec(chosen.textContent || "");
  const startYear = m ? Number(m[3]) - (Number(m[2]) < 9 ? 1 : 0) : now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const yearOf = (month) => (month >= 9 ? startYear : startYear + 1);

  // Colonne → data (espande i colspan).
  const dates = [];
  const headRow = grid.querySelector("thead tr");
  if (!headRow) return null;
  for (const th of headRow.children) {
    const parts = (th.innerText || th.textContent || "").trim().split(/\s+/);
    const day = Number(parts[0]);
    const month = MONTHS[(parts[1] || "").slice(0, 3).toLowerCase()];
    const span = Number(th.getAttribute("colspan") || 1);
    const iso = day && month ? `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${yearOf(month)}` : null;
    for (let i = 0; i < span; i++) dates.push(iso);
  }

  const subjects = [...names.querySelectorAll("tbody tr")].map((tr) => (tr.cells[0] ? tr.cells[0].textContent.trim() : ""));
  const bodyRows = [...grid.querySelectorAll("tbody tr")].filter((tr) => !tr.classList.contains("bg-grey-cararra"));
  const rows = [];
  bodyRows.forEach((tr, r) => {
    let col = 0;
    for (const td of tr.cells) {
      const span = Number(td.getAttribute("colspan") || 1);
      if (td.classList.contains("voto") && subjects[r]) {
        const raw = (td.textContent || "").trim();
        const type = [...td.classList].map((c) => /^voto_([SGOPA])_/.exec(c)).find(Boolean);
        const date = dates[col];
        // Solo voti numerici: "DIST", "-" (senza media) e simili restano fuori.
        if (date && /^\d+([.,]\d+)?$/.test(raw)) {
          rows.push({
            subject: subjects[r],
            date, // gg/mm/aaaa
            raw,
            value: Number(raw.replace(",", ".")),
            kind: type ? KINDS[type[1]] : "",
          });
        }
      }
      col += span;
    }
  });
  return rows;
}

// Testo «MATERIA / gg/mm/aaaa Tipo voto» che il parser di SchoolOS già capisce (import a mano).
function axiosToText(doc, today) {
  const rows = axiosToRows(doc, today);
  if (!rows) return null;
  const out = [];
  let last = null;
  for (const r of rows.slice().sort((a, b) => a.subject.localeCompare(b.subject))) {
    if (r.subject !== last) out.push("", r.subject);
    last = r.subject;
    out.push(`${r.date} ${r.kind} ${r.raw}`.replace(/\s+/g, " "));
  }
  return out.join("\n").trim();
}

// Righe per la sincronizzazione automatica: data ISO, kind come l'enum di SchoolOS.
function axiosToSyncRows(doc, today) {
  const rows = axiosToRows(doc, today);
  if (!rows) return null;
  const KIND = { Scritto: "written", Grafico: "practical", Orale: "oral", Pratico: "practical", Altro: "written", "": "written" };
  return rows.map((r) => {
    const [d, m, y] = r.date.split("/");
    return { subject: r.subject, date: `${y}-${m}-${d}`, value: r.value, kind: KIND[r.kind] || "written" };
  });
}
