const input = document.getElementById("url");
chrome.storage.sync.get("appUrl").then(({ appUrl }) => { if (appUrl) input.value = appUrl; });
document.getElementById("save").addEventListener("click", async () => {
  let u;
  try { u = new URL(input.value.trim()); } catch { document.getElementById("ok").textContent = "Indirizzo non valido."; return; }
  if (u.protocol !== "https:" && u.hostname !== "localhost") { document.getElementById("ok").textContent = "Serve https."; return; }
  await chrome.storage.sync.set({ appUrl: u.origin });
  document.getElementById("ok").textContent = "Salvato.";
});
