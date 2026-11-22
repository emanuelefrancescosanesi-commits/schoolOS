importScripts("config.js", "sync-errors.js");

// Riceve i voti letti dalla pagina del registro e li manda a SchoolOS con il codice di collegamento.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "sync" && Array.isArray(msg.rows)) void sync(msg.rows);
  if (msg && msg.type === "probe" && msg.probe) void chrome.storage.local.set({ probe: msg.probe });
});

// Una volta al giorno (alle 14:00) chiede alle schede Axios aperte di rileggere i voti.
// Serve una scheda Axios con la sessione ancora attiva; altrimenti si legge alla prossima apertura.
const REFRESH_HOUR = 14;
function nextRefresh() {
  const d = new Date();
  d.setHours(REFRESH_HOUR, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d.getTime();
}
chrome.alarms.get("refresh").then((a) => {
  if (!a) chrome.alarms.create("refresh", { when: nextRefresh(), periodInMinutes: 24 * 60 });
});
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "refresh") return;
  const tabs = await chrome.tabs.query({ url: "https://*.axioscloud.it/*" });
  for (const tab of tabs) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, { type: "refresh" }).catch(() => {});
  }
});

async function sync(rows) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) return setStatus({ ok: false, text: "Collega l'estensione: incolla il codice nelle Opzioni", action: "relink", at: Date.now() }, "!");
  try {
    const res = await fetch(`${SCHOOLOS_SUPABASE_URL}/rest/v1/rpc/sync_grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SCHOOLOS_SUPABASE_KEY },
      body: JSON.stringify({ p_token: token, p_rows: rows }),
    });
    if (!res.ok) {
      const err = classifySyncError(res.status, await res.text().catch(() => ""));
      return setStatus({ ok: false, text: err.text, action: err.action, at: Date.now() }, "!");
    }
    const r = await res.json();
    let text = r.inserted > 0 ? `${r.inserted} voti nuovi inviati` : "Nessun voto nuovo";
    if (r.created && r.created.length) text += ` · materie create: ${r.created.join(", ")}`;
    await setStatus({ ok: true, text, unmatched: r.unmatched || [], at: Date.now() }, r.inserted > 0 ? String(r.inserted) : "");
  } catch {
    const err = classifySyncError(0, "");
    await setStatus({ ok: false, text: err.text, action: err.action, at: Date.now() }, "!");
  }
}

async function setStatus(status, badge) {
  await chrome.storage.local.set({ lastSync: status });
  await chrome.action.setBadgeText({ text: badge });
}
