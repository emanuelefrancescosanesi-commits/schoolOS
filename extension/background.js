importScripts("config.js");

// Riceve i voti letti dalla pagina del registro e li manda a SchoolOS con il codice di collegamento.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "sync" && Array.isArray(msg.rows)) void sync(msg.rows);
});

async function sync(rows) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return setStatus({ ok: false, text: "Collega l'estensione (Opzioni)" }, "!");
  try {
    const res = await fetch(`${SCHOOLOS_SUPABASE_URL}/rest/v1/rpc/sync_grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SCHOOLOS_SUPABASE_KEY },
      body: JSON.stringify({ p_token: token, p_rows: rows }),
    });
    if (!res.ok) {
      return setStatus({ ok: false, text: res.status === 400 || res.status === 401 ? "Codice non valido: rifai il collegamento" : "Errore di rete" }, "!");
    }
    const r = await res.json();
    const text = r.inserted > 0 ? `${r.inserted} voti nuovi inviati` : "Nessun voto nuovo";
    await setStatus({ ok: true, text, unmatched: r.unmatched || [], at: Date.now() }, r.inserted > 0 ? String(r.inserted) : "");
  } catch {
    await setStatus({ ok: false, text: "Errore di rete" }, "!");
  }
}

async function setStatus(status, badge) {
  await chrome.storage.local.set({ lastSync: status });
  await chrome.action.setBadgeText({ text: badge });
}
