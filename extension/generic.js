// Lettura "generica" della pagina voti di un registro che non conosciamo (ClasseViva, Argo, altri).
// Non sa nulla di un layout in particolare: cerca tabelle in cui riconosce, dal CONTENUTO delle
// celle, una colonna di date, una di voti e una di materie (elenco "un voto per riga"), oppure una
// griglia con le date in intestazione e una materia per riga (come Axios).
// Il risultato passa sempre dall'anteprima di SchoolOS, dove lo studente conferma o corregge:
// ciò che non si riconosce viene saltato, nulla viene inventato.
// Restituisce null se non trova nulla che somigli a dei voti.

(function (global) {
  const MONTHS = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };
  const KINDS = [
    [/scritt/i, "Scritto"],
    [/orale|interrogaz/i, "Orale"],
    [/prati|laborator/i, "Pratico"],
    [/grafic/i, "Grafico"],
  ];
  const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

  // Data da una cella: gg/mm/aaaa, gg-mm-aa, gg/mm, «29 set», «29 ottobre 2026».
  function parseDate(text, startYear) {
    const t = clean(text);
    let m = /^(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{4}|\d{2}))?$/.exec(t);
    let day, month, year;
    if (m) {
      day = Number(m[1]);
      month = Number(m[2]);
      year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    } else {
      m = /^(\d{1,2})\s*([A-Za-zÀ-ÿ]{3,9})\.?(?:\s*(\d{4}))?$/.exec(t);
      if (!m) return null;
      day = Number(m[1]);
      month = MONTHS[m[2].slice(0, 3).toLowerCase()];
      year = m[3] ? Number(m[3]) : null;
    }
    if (!month || month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (!year) year = month >= 9 ? startYear : startYear + 1;
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  }

  // Voto da una cella: 8, 7,5, 6+, 7½, 5-… (1–10). Restituisce il testo originale.
  function parseGrade(text) {
    const t = clean(text);
    const m = /^(\d{1,2})(?:[.,](\d{1,2}))?\s?([+\-−–½])?$/.exec(t);
    if (!m) return null;
    const n = Number(m[1] + (m[2] ? "." + m[2] : ""));
    if (!(n >= 1 && n <= 10)) return null;
    return t;
  }

  const kindOf = (text) => {
    for (const [re, label] of KINDS) if (re.test(text)) return label;
    return "";
  };

  const isWordy = (t) => /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’.\s/,&-]{2,}$/.test(t) && !parseDate(t, 2000) && !kindOf(t);

  // Matrice di testo di una tabella (i colspan si espandono; le righe di intestazione restano).
  function matrix(table) {
    const rows = [];
    for (const tr of table.querySelectorAll("tr")) {
      const cells = [];
      for (const c of tr.children) {
        if (c.tagName !== "TD" && c.tagName !== "TH") continue;
        const span = Math.min(Number(c.getAttribute("colspan") || 1), 40);
        // textContent: «29<br>set» → «29set», che funziona anche su pagine non ancora disegnate.
        const text = clean((c.textContent || "").replace(/\n/g, " "));
        for (let i = 0; i < span; i++) cells.push({ text, cell: c, tag: c.tagName });
      }
      if (cells.length) rows.push({ cells, tr });
    }
    return rows;
  }

  // Elenco «un voto per riga»: colonne riconosciute dal contenuto.
  function readList(rows, startYear) {
    const body = rows.filter((r) => r.cells.some((c) => c.tag === "TD"));
    if (body.length < 2) return [];
    const width = Math.max(...body.map((r) => r.cells.length));
    const firstBody = rows.indexOf(body[0]);
    const header = firstBody > 0 ? rows[firstBody - 1] : null;
    const headText = (i) => (header && header.cells[i] ? header.cells[i].text : "");
    const col = (i) => body.map((r) => (r.cells[i] ? r.cells[i].text : ""));
    const share = (i, f) => col(i).filter((t) => t && f(t)).length / body.length;

    let dateCol = -1;
    let gradeCol = -1;
    let bestDate = 0.6;
    let bestGrade = 0.6;
    for (let i = 0; i < width; i++) {
      const d = share(i, (t) => !!parseDate(t, startYear));
      if (d >= bestDate) { bestDate = d; dateCol = i; }
    }
    for (let i = 0; i < width; i++) {
      if (i === dateCol) continue;
      const g = share(i, (t) => !!parseGrade(t));
      if (g >= bestGrade) { bestGrade = g; gradeCol = i; }
    }
    if (dateCol < 0 || gradeCol < 0) return [];

    // Materia: prima per intestazione («Materia», «Disciplina»), poi per ripetizione dei valori.
    let subjectCol = -1;
    for (let i = 0; i < width; i++) if (/materia|disciplina/i.test(headText(i))) subjectCol = i;
    if (subjectCol < 0) {
      let best = 0;
      for (let i = 0; i < width; i++) {
        if (i === dateCol || i === gradeCol) continue;
        const values = col(i).filter((t) => isWordy(t));
        if (values.length < body.length * 0.8) continue;
        const distinct = new Set(values.map((v) => v.toLowerCase())).size;
        const score = 1 - distinct / values.length + 0.01; // più ripetuta = più probabile sia la materia
        if (score > best && distinct <= 25) { best = score; subjectCol = i; }
      }
    }
    if (subjectCol < 0) return [];
    const kindCol = (() => {
      for (let i = 0; i < width; i++) if (i !== subjectCol && share(i, (t) => !!kindOf(t)) >= 0.5) return i;
      return -1;
    })();

    const out = [];
    for (const r of body) {
      const date = parseDate((r.cells[dateCol] || {}).text, startYear);
      const raw = parseGrade((r.cells[gradeCol] || {}).text);
      const subject = clean((r.cells[subjectCol] || {}).text);
      if (!date || !raw || !subject) continue;
      out.push({ subject, date, raw, kind: kindCol >= 0 ? kindOf(r.cells[kindCol].text) : kindOf(r.tr.textContent || "") });
    }
    return out;
  }

  // Griglia: date in intestazione, una materia per riga, voti nelle celle.
  function readGrid(rows, startYear) {
    const headIdx = rows.findIndex((r) => r.cells.filter((c) => parseDate(c.text, startYear)).length >= 2);
    if (headIdx < 0) return [];
    const dates = rows[headIdx].cells.map((c) => parseDate(c.text, startYear));
    const out = [];
    for (const r of rows.slice(headIdx + 1)) {
      const first = r.cells[0] && r.cells[0].text;
      if (!first || !isWordy(first)) continue;
      r.cells.forEach((c, i) => {
        const raw = parseGrade(c.text);
        if (i > 0 && raw && dates[i]) out.push({ subject: first, date: dates[i], raw, kind: kindOf(c.cell.className + " " + (c.cell.title || "")) });
      });
    }
    return out;
  }

  function genericToRows(doc, today) {
    const now = today || new Date();
    const startYear = now.getMonth() + 1 >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    const seen = new Set();
    const all = [];
    for (const table of doc.querySelectorAll("table")) {
      const rows = matrix(table);
      if (rows.length < 2) continue;
      for (const r of [...readList(rows, startYear), ...readGrid(rows, startYear)]) {
        const key = `${r.subject.toLowerCase()}|${r.date}|${r.raw}|${r.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        all.push(r);
      }
    }
    return all.length ? all : null;
  }

  // Stesso formato testuale di axiosToText: «MATERIA» poi «gg/mm/aaaa Tipo voto».
  function genericToText(doc, today) {
    const rows = genericToRows(doc, today);
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

  global.genericToRows = genericToRows;
  global.genericToText = genericToText;
})(typeof self !== "undefined" ? self : globalThis);
