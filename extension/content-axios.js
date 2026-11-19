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
  lastSent = sig;
  chrome.runtime.sendMessage({ type: "sync", rows });
}

// La griglia viene caricata da Axios dopo l'apertura della pagina: si guarda quando cambia.
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(check, 800);
}).observe(document.documentElement, { childList: true, subtree: true });
check();
