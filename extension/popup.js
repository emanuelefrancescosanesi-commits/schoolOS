// Legge il testo visibile della scheda attiva e lo apre in SchoolOS nel frammento dell'URL
// (dopo "#": non viene mai inviato a nessun server). Stesso formato del segnalibro.
const MAX_CHARS = 40000;
const DEFAULT_APP = "https://schoolos.example";
const msg = document.getElementById("msg");

function extract(max) {
  const t = (document.body && document.body.innerText) || "";
  return t.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

document.getElementById("go").addEventListener("click", async () => {
  try {
    const { appUrl = DEFAULT_APP } = await chrome.storage.sync.get("appUrl");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("Nessuna scheda attiva.");
    // Axios: la griglia materia × data si legge dalla struttura; altrimenti testo semplice.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["axios.js"] });
    const [axios] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => axiosToText(document) });
    let text = axios && axios.result;
    if (!text) {
      // Altro registro: lettura generica per contenuto (tabelle con date, voti e materie).
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["generic.js"] });
      const [gen] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => genericToText(document) });
      text = gen && gen.result;
    }
    if (!text) {
      const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extract, args: [MAX_CHARS] });
      text = res && res.result;
    }
    if (!text) throw new Error("Non trovo testo in questa pagina.");
    const base = appUrl.replace(/\/$/, "");
    await chrome.tabs.create({ url: `${base}/grades#import=${encodeURIComponent(text)}` });
    window.close();
  } catch (e) {
    msg.textContent = e instanceof Error ? e.message : "Errore imprevisto.";
  }
});

// Report anonimo: l'utente lo rivede e lo copia a mano, non viene inviato a nessuno.
document.getElementById("learn").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("Nessuna scheda attiva.");
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: anonymizePage, args: [60000] });
    const box = document.getElementById("report");
    box.value = (res && res.result) || "";
    box.style.display = box.value ? "block" : "none";
    document.getElementById("copy").style.display = box.value ? "block" : "none";
    msg.textContent = box.value ? "Rileggi il report: nomi e numeri sono mascherati. Poi copialo." : "Pagina vuota.";
  } catch (e) {
    msg.textContent = e instanceof Error ? e.message : "Errore imprevisto.";
  }
});
document.getElementById("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(document.getElementById("report").value);
  msg.textContent = "Copiato. Incollalo nella chat con Claude.";
});

// Esito dell'ultima sincronizzazione automatica.
chrome.storage.local.get("lastSync").then(({ lastSync }) => {
  if (!lastSync) return;
  const when = lastSync.at ? new Date(lastSync.at).toLocaleString("it-IT") : "";
  msg.textContent = `Ultima sincronizzazione: ${lastSync.text}${when ? " (" + when + ")" : ""}`;
  if (lastSync.unmatched && lastSync.unmatched.length) msg.textContent += `. Materie non trovate in SchoolOS: ${lastSync.unmatched.join(", ")}`;
});
chrome.action.setBadgeText({ text: "" });

// Diagnostica: versione, collegamento e se la scheda attiva è la griglia voti di Axios.
(async () => {
  const el = document.getElementById("diag");
  const { token } = await chrome.storage.local.get("token");
  let page = "scheda non leggibile";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["axios.js"] });
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => axiosToSyncRows(document) });
    page = r && r.result ? `griglia Axios trovata (${r.result.length} voti, ${r.result.filter((x) => x.weight !== undefined).length} con peso letto)` : "nessuna griglia Axios in questa scheda";
    if (r && r.result) {
      const [sh] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => axiosCellShape(document) });
      if (sh && sh.result) page += ` · celle ${sh.result}`;
    }
  } catch {
    /* scheda senza permesso: resta «non leggibile» */
  }
  el.textContent = `v${chrome.runtime.getManifest().version} · ${token ? "collegata a SchoolOS" : "NON collegata (manca il codice)"} · ${page}`;
})();

// Lettura dalla schermata iniziale di Axios: cosa è successo l'ultima volta (nessun dato personale).
chrome.storage.local.get("probe").then(({ probe }) => {
  if (!probe) return;
  const el = document.getElementById("probe");
  const parts = [`riquadro Voti: ${probe.tile ? "trovato" : "no"}`];
  if (probe.hrefKind) parts.push(`collegamento: ${probe.hrefKind}`);
  if (probe.status) parts.push(`risposta ${probe.status}`);
  if (probe.grid !== undefined) parts.push(probe.grid ? `griglia con ${probe.rows} voti` : "griglia assente");
  if (probe.path) parts.push(`percorso ${probe.path}`);
  if (probe.attrs) parts.push(`attributi: ${probe.attrs}`);
  if (probe.error) parts.push(`errore: ${probe.error}`);
  el.textContent = `Da home: ${parts.join(" · ")}`;
});
