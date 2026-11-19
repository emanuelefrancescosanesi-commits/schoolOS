const input = document.getElementById("url");
chrome.storage.sync.get("appUrl").then(({ appUrl }) => { if (appUrl) input.value = appUrl; });
document.getElementById("save").addEventListener("click", async () => {
  let u;
  try { u = new URL(input.value.trim()); } catch { document.getElementById("ok").textContent = "Indirizzo non valido."; return; }
  if (u.protocol !== "https:" && u.hostname !== "localhost") { document.getElementById("ok").textContent = "Serve https."; return; }
  await chrome.storage.sync.set({ appUrl: u.origin });
  document.getElementById("ok").textContent = "Salvato.";
});

const tokenInput = document.getElementById("token");
const okToken = document.getElementById("okToken");
chrome.storage.local.get("token").then(({ token }) => { if (token) tokenInput.value = token; });
document.getElementById("saveToken").addEventListener("click", async () => {
  const t = tokenInput.value.trim();
  if (!/^sos_[0-9a-f]{64}$/.test(t)) { okToken.textContent = "Codice non valido."; return; }
  await chrome.storage.local.set({ token: t });
  okToken.textContent = "Collegato.";
});
document.getElementById("clearToken").addEventListener("click", async () => {
  await chrome.storage.local.remove("token");
  tokenInput.value = "";
  okToken.textContent = "Scollegato.";
});
