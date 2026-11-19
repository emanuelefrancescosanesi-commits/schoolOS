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
