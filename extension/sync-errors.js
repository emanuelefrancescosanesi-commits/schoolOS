// Traduce la risposta di errore di sync_grades in un messaggio chiaro e in un'azione per l'utente.
// Script classico: lo carica importScripts() nel service worker ed è testato con vitest.
//   status: codice HTTP (0 se la rete non risponde); body: testo della risposta (JSON di PostgREST).
function classifySyncError(status, body) {
  var code = "";
  try { code = (JSON.parse(body) || {}).code || ""; } catch (e) { /* risposta non JSON */ }
  // 28000 = «Codice non valido»: codice revocato, scaduto (90 giorni senza uso) o mai esistito.
  if (code === "28000" || status === 401 || status === 403) {
    return { kind: "invalid", action: "relink", text: "Codice revocato o scaduto: crea un nuovo codice in SchoolOS e incollalo nelle Opzioni" };
  }
  if (code === "53400") return { kind: "limit", action: null, text: "Hai raggiunto il limite di voti in SchoolOS" };
  if (status === 0) return { kind: "network", action: "retry", text: "Nessuna connessione: riprovo alla prossima apertura del registro" };
  if (status === 429) return { kind: "busy", action: "retry", text: "Troppe richieste: riprovo tra poco" };
  if (status >= 500) return { kind: "server", action: "retry", text: "SchoolOS non risponde: riprovo alla prossima apertura del registro" };
  return { kind: "error", action: "retry", text: "Sincronizzazione non riuscita (errore " + status + ")" };
}
