// Report anonimo della struttura di una pagina: serve a scrivere il parser per un registro
// senza vedere i dati dello studente. Viene eseguita DENTRO la pagina e restituisce solo testo
// che l'utente rivede e copia a mano: nulla viene inviato in automatico.
//
// Si conserva: tag, classi, ruoli, forma dei valori (9,9 · 99/99/9999 · xxxxx) e un piccolo
// vocabolario di etichette neutre (materie, giorni, mesi, "Voto", "Scritto"…).
// Si cancella: ogni altra parola (nomi, cognomi, commenti), ogni cifra, valori dei campi,
// link, immagini, script, stili, id e attributi diversi da class/role/colspan/rowspan.
function anonymizePage(maxChars) {
  const SAFE = new Set(
    ("voto voti materia materie data tipo scritto orale pratico grafico media periodo trimestre pentamestre " +
      "quadrimestre primo secondo descrizione docente assenze note compiti argomenti lezioni " +
      "lunedì martedì mercoledì giovedì venerdì sabato domenica gennaio febbraio marzo aprile maggio giugno " +
      "luglio agosto settembre ottobre novembre dicembre italiano matematica storia geografia inglese francese " +
      "spagnolo tedesco latino greco filosofia fisica chimica biologia scienze informatica diritto economia " +
      "disegno arte musica motoria educazione civica religione fisiche naturali scientifiche " +
      "e di del della in per con la le il lo").split(/\s+/),
  );
  const maskWord = (w) => {
    if (SAFE.has(w.toLowerCase())) return w;
    return w.replace(/[A-Za-zÀ-ÿ]/g, "x").replace(/\d/g, "9");
  };
  const maskText = (s) =>
    s
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map((tok) => {
        // Separa punteggiatura e simboli di voto (½ + − - /) per mantenerli.
        return tok.replace(/[A-Za-zÀ-ÿ0-9]+/g, maskWord);
      })
      .join(" ");

  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "SVG", "IMG", "IFRAME", "LINK", "META", "HEAD", "INPUT", "TEXTAREA", "SELECT"]);
  const KEEP_ATTR = ["role", "colspan", "rowspan"];
  const out = [];

  function walk(node, depth) {
    if (out.join("").length > maxChars) return;
    const pad = "  ".repeat(Math.min(depth, 24));
    if (node.nodeType === 3) {
      const t = maskText(node.nodeValue || "");
      if (t) out.push(pad + t + "\n");
      return;
    }
    if (node.nodeType !== 1 || SKIP.has(node.tagName.toUpperCase())) return;
    const el = node;
    const tag = el.tagName.toLowerCase();
    const cls = (el.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => c.replace(/\d+/g, "9"))
      .join(".");
    const attrs = KEEP_ATTR.filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${String(el.getAttribute(a)).replace(/[^\w-]/g, "").slice(0, 20)}`)
      .join(" ");
    out.push(`${pad}<${tag}${cls ? "." + cls : ""}${attrs ? " " + attrs : ""}>\n`);
    for (const child of el.childNodes) walk(child, depth + 1);
  }
  walk(document.body, 0);
  return out.join("").slice(0, maxChars);
}
