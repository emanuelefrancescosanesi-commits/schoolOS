// Axios "Registro Famiglie": la pagina voti è una griglia materia × data.
//  - tabella .rdoc_full_alunni: una riga per materia (nome nella prima cella)
//  - tabella .rdoc_full_valutazioni: stesse righe, colonne = date ("29<br>set"), eventuale colspan;
//    cella voto = td.voto.voto_{S|G|O|P|A}_{positivo|negativo} (voto_no_media = senza tipo).
// Il testo semplice della pagina perde le date: qui si legge la struttura e si produce un testo
// "MATERIA / gg/mm/aaaa Tipo voto" che il parser di SchoolOS già capisce.
// Restituisce null se la pagina non è la griglia voti di Axios.
// Peso del voto (0–10). Axios lo indica fuori dal testo della cella: lo cerchiamo negli attributi
// (title, data-*, aria-label…) e nei discendenti della cella come «peso 50%», «Peso: 0,5», «50%».
// Percentuale → frazione (50% = 0,5); numero semplice ≤ 10 = peso diretto. Altrimenti undefined.
function axiosWeight(td) {
  const texts = [];
  const collect = (el) => {
    for (const a of el.getAttributeNames()) {
      if (a === "class" || a === "style" || a === "colspan" || a === "id") continue;
      texts.push(el.getAttribute(a) || "");
    }
  };
  collect(td);
  for (const el of td.querySelectorAll("*")) {
    collect(el);
    if (!el.children.length) texts.push(el.textContent || "");
  }
  for (const t of texts) {
    const m = /peso\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)\s*(%?)/i.exec(t);
    if (!m) continue;
    const n = Number(m[1].replace(",", "."));
    const w = m[2] ? n / 100 : n;
    if (w > 0 && w <= 10) return Math.round(w * 100) / 100;
  }
  return undefined;
}

// Solo la struttura delle celle voto (nomi di attributi, tag e classi dei figli; nessun contenuto):
// serve a capire dove Axios scrive il peso senza vedere dati dello studente.
function axiosCellShape(doc) {
  const attrs = new Set();
  const kids = new Set();
  for (const td of doc.querySelectorAll("table.rdoc_full_valutazioni td.voto")) {
    for (const a of td.getAttributeNames()) if (a !== "class" && a !== "style") attrs.add(a);
    for (const el of td.querySelectorAll("*")) {
      kids.add(el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : ""));
      for (const a of el.getAttributeNames()) if (a !== "class" && a !== "style") attrs.add(el.tagName.toLowerCase() + "@" + a);
    }
  }
  return `attributi: ${[...attrs].slice(0, 12).join(",") || "nessuno"} · figli: ${[...kids].slice(0, 12).join(",") || "nessuno"}`;
}

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
    // textContent (non innerText): «29<br>set» diventa «29set», che funziona anche su pagine
    // scaricate con fetch e non ancora mostrate, dove innerText non converte il <br> in spazio.
    const dm = /^\s*(\d{1,2})\s*([A-Za-z]{3})/.exec(th.textContent || "");
    const day = dm ? Number(dm[1]) : 0;
    const month = dm ? MONTHS[dm[2].toLowerCase()] : undefined;
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
            weight: axiosWeight(td),
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
    const out = { subject: r.subject, date: `${y}-${m}-${d}`, value: r.value, kind: KIND[r.kind] || "written" };
    if (r.weight !== undefined) out.weight = r.weight;
    return out;
  });
}
