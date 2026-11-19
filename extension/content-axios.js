// Gira sulle pagine di Axios. Quando compare la griglia dei voti la legge e la passa allo
// script di sfondo, che la manda a SchoolOS. Rilegge solo se i voti sono cambiati.
let lastSent = "";
let timer = null;

function check() {
  let rows = null;
  try {
    rows = axiosToSyncRows(document);
  } catch {
    return;
  }
  if (!rows || rows.length === 0) return;
  const sig = JSON.stringify(rows);
  if (sig === lastSent) return;
  // Dopo aver ricaricato o aggiornato l'estensione, le pagine già aperte restano con uno script
  // «orfano» senza chrome.runtime: va ricaricata la pagina, non c'è altro da fare.
  if (!chrome.runtime || !chrome.runtime.id) {
    observer.disconnect();
    return;
  }
  lastSent = sig;
  try {
    chrome.runtime.sendMessage({ type: "sync", rows });
  } catch {
    observer.disconnect();
  }
}

// La griglia viene caricata da Axios dopo l'apertura della pagina: si guarda quando cambia.
const observer = new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(check, 800);
});
observer.observe(document.documentElement, { childList: true, subtree: true });
check();

// --- Lettura dalla schermata iniziale -------------------------------------------------------
// Dalla home di Axios si trova il riquadro «Voti»; ne chiediamo la pagina con la stessa sessione
// (fetch dello stesso sito, senza cambiare la pagina che vedi) e leggiamo la griglia da lì.
// Quello che succede viene annotato in `probe` e mostrato nel popup: nessun dato dello studente.
let probing = false;

function votiTile() {
  for (const a of document.querySelectorAll("a.family-tile")) {
    const h = a.querySelector("h4");
    if (h && h.textContent.trim().toLowerCase() === "voti") return a;
  }
  return null;
}

function report(probe) {
  try {
    if (chrome.runtime && chrome.runtime.id) chrome.runtime.sendMessage({ type: "probe", probe });
  } catch {
    /* script orfano: serve ricaricare la pagina */
  }
}

const MIN_GAP_MS = 6 * 60 * 60 * 1000; // dalla home: al massimo ogni 6 ore, senza polling

async function probeFromHome(force) {
  if (probing || !chrome.runtime || !chrome.runtime.id) return;
  if (document.querySelector("table.rdoc_full_valutazioni")) return; // già nella pagina voti
  const tile = votiTile();
  if (!tile) return;
  if (!force) {
    const { probe: last } = await chrome.storage.local.get("probe");
    if (last && last.grid && Date.now() - last.at < MIN_GAP_MS) return;
  }
  probing = true;
  const probe = { at: Date.now(), tile: true };
  try {
    const href = tile.getAttribute("href") || "";
    probe.hrefKind = !href ? "vuoto" : href.startsWith("#") ? "ancora" : href.toLowerCase().startsWith("javascript") ? "javascript" : "indirizzo";
    probe.attrs = tile.getAttributeNames().filter((n) => n !== "href").join(",");
    if (probe.hrefKind !== "indirizzo") return report(probe);
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return report({ ...probe, note: "altro sito" });
    probe.path = url.pathname;
    const res = await fetch(url, { credentials: "include" });
    probe.status = res.status;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    probe.grid = !!doc.querySelector("table.rdoc_full_valutazioni");
    const rows = probe.grid ? axiosToSyncRows(doc) : [];
    probe.rows = rows.length;
    report(probe);
    if (rows.length > 0) chrome.runtime.sendMessage({ type: "sync", rows });
  } catch (e) {
    report({ ...probe, error: String((e && e.message) || e).slice(0, 80) });
  } finally {
    probing = false;
  }
}

// La home di Axios carica i riquadri a pagina aperta: si riprova quando cambia, e su richiesta.
setTimeout(() => probeFromHome(false), 2500);
try {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "refresh") void probeFromHome(true);
  });
} catch {
  /* script orfano */
}
