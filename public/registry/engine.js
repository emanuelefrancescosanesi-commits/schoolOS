// Motore di lettura dei registri (SchoolOS). Gira DENTRO la pagina del registro, nella webview
// dell'app, con la sessione dello studente. Non contiene nulla di specifico di un registro:
// selettori, formati e mappe stanno nelle regole (JSON, aggiornabili dal sito senza nuove release).
// Restituisce solo materia/data/voto/tipo/peso; mai nomi, password o altri dati della pagina.
// Nessuna dipendenza: funziona in browser e (per i test) con jsdom.
(function (root) {
  "use strict";

  var MONTHS = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 };

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  // Peso del voto (0–10): cerca «peso 50%», «Peso: 0,5» negli attributi e nei testi della cella.
  // Percentuale → frazione (50% = 0,5); numero semplice ≤ 10 = peso diretto.
  function cellWeight(td) {
    var texts = [];
    function collect(el) {
      var names = el.getAttributeNames();
      for (var i = 0; i < names.length; i++) {
        var a = names[i];
        if (a === "class" || a === "style" || a === "colspan" || a === "id") continue;
        texts.push(el.getAttribute(a) || "");
      }
    }
    collect(td);
    var all = td.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      collect(all[j]);
      if (!all[j].children.length) texts.push(all[j].textContent || "");
    }
    for (var k = 0; k < texts.length; k++) {
      var m = /peso\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)\s*(%?)/i.exec(texts[k]);
      if (!m) continue;
      var n = Number(m[1].replace(",", "."));
      var w = m[2] ? n / 100 : n;
      if (w > 0 && w <= 10) return Math.round(w * 100) / 100;
    }
    return undefined;
  }

  // Anno in cui inizia l'anno scolastico: dal periodo selezionato nella pagina («01/09/2026 - …»)
  // o, in mancanza, da oggi (da settembre in poi è l'anno corrente).
  function schoolYearStart(doc, cfg, today) {
    if (cfg.periodSelector) {
      var el = doc.querySelector(cfg.periodSelector);
      var m = el && /(\d{2})\/(\d{2})\/(\d{4})/.exec(el.textContent || "");
      if (m) return Number(m[3]) - (Number(m[2]) < 9 ? 1 : 0);
    }
    return today.getMonth() + 1 >= 9 ? today.getFullYear() : today.getFullYear() - 1;
  }

  // Griglia materia × data: tabella dei nomi + tabella dei voti con le date in intestazione.
  // Restituisce null se la pagina non è quella dei voti.
  function extractGrid(doc, grid, today) {
    var names = doc.querySelector(grid.subjectsTable);
    var table = doc.querySelector(grid.gradesTable);
    if (!names || !table) return null;
    var head = table.querySelector(grid.headRow);
    if (!head) return null;

    var startYear = schoolYearStart(doc, grid, today);
    var dateRe = new RegExp(grid.dateHeader, "i");
    var dates = [];
    for (var i = 0; i < head.children.length; i++) {
      var th = head.children[i];
      // textContent (non innerText): «29<br>set» diventa «29set» anche su pagine non mostrate.
      var dm = dateRe.exec(th.textContent || "");
      var day = dm ? Number(dm[1]) : 0;
      var month = dm ? MONTHS[String(dm[2]).toLowerCase().slice(0, 3)] : undefined;
      var span = Number(th.getAttribute("colspan") || 1);
      var iso = day && month ? (month >= 9 ? startYear : startYear + 1) + "-" + pad(month) + "-" + pad(day) : null;
      for (var s = 0; s < span; s++) dates.push(iso);
    }

    var subjects = [];
    var nameRows = names.querySelectorAll(grid.subjectRow);
    for (var r = 0; r < nameRows.length; r++) {
      if (grid.skipRowClass && nameRows[r].classList.contains(grid.skipRowClass)) continue;
      var cell = nameRows[r].cells[0];
      subjects.push(cell ? (cell.textContent || "").trim() : "");
    }

    var kindRe = grid.kindClass ? new RegExp(grid.kindClass.pattern) : null;
    var valueRe = new RegExp(grid.valuePattern);
    var rows = [];
    var all = table.querySelectorAll(grid.gradeRow);
    var bodyRows = [];
    for (var b = 0; b < all.length; b++) {
      if (grid.skipRowClass && all[b].classList.contains(grid.skipRowClass)) continue;
      bodyRows.push(all[b]);
    }
    for (var ri = 0; ri < bodyRows.length; ri++) {
      var col = 0;
      var cells = bodyRows[ri].cells;
      for (var ci = 0; ci < cells.length; ci++) {
        var td = cells[ci];
        var cspan = Number(td.getAttribute("colspan") || 1);
        if (td.matches(grid.gradeCell) && subjects[ri]) {
          var raw = (td.textContent || "").trim();
          var date = dates[col];
          // Solo voti numerici: «DIST», «-» e simili restano fuori.
          if (date && valueRe.test(raw)) {
            var code = null;
            if (kindRe) {
              for (var c = 0; c < td.classList.length; c++) {
                var km = kindRe.exec(td.classList[c]);
                if (km) {
                  code = km[1];
                  break;
                }
              }
            }
            var row = {
              subject: subjects[ri],
              date: date,
              value: Number(raw.replace(",", ".")),
              kind: (code && grid.kindClass.map[code]) || grid.defaultKind || "written",
            };
            var w = cellWeight(td);
            if (w !== undefined) row.weight = w;
            rows.push(row);
          }
        }
        col += cspan;
      }
    }
    return rows;
  }

  // Link del riquadro «Voti» nella schermata iniziale del registro.
  function findTile(doc, home) {
    var links = doc.querySelectorAll(home.tile);
    for (var i = 0; i < links.length; i++) {
      var label = links[i].querySelector(home.tileLabel);
      if (label && (label.textContent || "").trim().toLowerCase() === home.tileText.toLowerCase()) return links[i];
    }
    return null;
  }

  function hostAllowed(hostname, rule) {
    for (var i = 0; i < rule.hosts.length; i++) {
      var h = rule.hosts[i];
      if (hostname === h || hostname.slice(-(h.length + 1)) === "." + h) return true;
    }
    return false;
  }

  // Un solo passo di lettura sulla pagina corrente. Mai dati personali nella diagnosi.
  //  - rows:   la griglia voti è nella pagina (o è stata scaricata dal riquadro «Voti»)
  //  - tile:   siamo nella home e il riquadro c'è ma non si legge da qui: l'app deve aprirlo
  //            (`next` è l'indirizzo, già verificato come dello stesso registro)
  //  - login:  pagina di accesso
  //  - wait:   la pagina non è ancora pronta (caricamento in corso)
  //  - other:  pagina del registro non riconosciuta
  //  - blocked: pagina di un altro sito
  async function step(win, rule) {
    var doc = win.document;
    var loc = win.location;
    var today = new Date();
    if (!hostAllowed(loc.hostname, rule)) return { state: "blocked" };

    var rows = extractGrid(doc, rule.datasets.grades, today);
    if (rows) return { state: "rows", rows: rows, via: "page" };

    if (rule.login && doc.querySelector(rule.login.passwordField)) return { state: "login" };

    var tile = rule.home ? findTile(doc, rule.home) : null;
    if (tile) {
      var href = tile.getAttribute("href") || "";
      var kind = !href ? "vuoto" : href.charAt(0) === "#" ? "ancora" : /^javascript/i.test(href) ? "javascript" : "indirizzo";
      if (kind === "indirizzo") {
        var url = new URL(href, loc.href);
        if (url.origin === loc.origin) {
          try {
            var res = await win.fetch(url.href, { credentials: "include" });
            var html = await res.text();
            var parsed = new win.DOMParser().parseFromString(html, "text/html");
            var fetched = extractGrid(parsed, rule.datasets.grades, today);
            if (fetched) return { state: "rows", rows: fetched, via: "fetch" };
          } catch {
            /* si ripiega sull'apertura del riquadro */
          }
        }
        return { state: "tile", next: url.href, hrefKind: kind };
      }
      return { state: "tile", hrefKind: kind };
    }
    if (doc.readyState !== "complete") return { state: "wait" };
    return { state: "other" };
  }

  // Aspetta che la pagina (caricata a pezzi) mostri qualcosa di riconoscibile; poi risponde una volta.
  function run(win, rule, post, maxMs) {
    var done = false;
    var started = Date.now();
    var timer = null;
    function finish(result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (obs) obs.disconnect();
      post(Object.assign({ source: "schoolos-registry", v: 1, registry: rule.registry, path: win.location.pathname }, result));
    }
    function attempt() {
      if (done) return;
      step(win, rule).then(function (r) {
        if (r.state === "wait" || r.state === "other") {
          if (Date.now() - started > (maxMs || 12000)) return finish(r.state === "wait" ? { state: "other" } : r);
          return;
        }
        finish(r);
      }, function () {
        finish({ state: "error" });
      });
    }
    var obs = null;
    if (typeof win.MutationObserver === "function") {
      obs = new win.MutationObserver(function () {
        clearTimeout(timer);
        timer = setTimeout(attempt, 600);
      });
      obs.observe(win.document.documentElement, { childList: true, subtree: true });
    }
    attempt();
    timer = setTimeout(function tick() {
      attempt();
      if (!done) timer = setTimeout(tick, 1500);
    }, 1500);
  }

  var api = { extractGrid: extractGrid, findTile: findTile, hostAllowed: hostAllowed, step: step, run: run, cellWeight: cellWeight };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.schoolosRegistry = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
