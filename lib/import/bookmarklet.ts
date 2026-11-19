/**
 * Segnalibro "Importa in SchoolOS": un piccolo script che lo studente salva tra i preferiti.
 * Aperto sulla pagina dei voti del registro, ne legge il testo visibile e lo porta a SchoolOS.
 *
 * Il testo viaggia nel frammento dell'indirizzo (la parte dopo "#"): il browser non lo invia mai
 * a nessun server, nemmeno al nostro. SchoolOS lo legge nel browser, lo toglie dall'indirizzo e
 * lo passa al parser come se lo avesse incollato lo studente.
 */

export const IMPORT_HASH_KEY = "import";
/** Oltre questo il frammento diventa troppo pesante per alcuni browser. */
export const BOOKMARKLET_MAX_CHARS = 40_000;

/** Codice del segnalibro, già pronto da incollare come indirizzo di un preferito. */
export function buildBookmarklet(appOrigin: string): string {
  const target = `${appOrigin.replace(/\/$/, "")}/grades#${IMPORT_HASH_KEY}=`;
  const body = `(function(){
var t=(document.body&&document.body.innerText||"").replace(/[ \\t]+/g," ").replace(/\\n{3,}/g,"\\n\\n").trim().slice(0,${BOOKMARKLET_MAX_CHARS});
if(!t){alert("SchoolOS: non trovo testo in questa pagina.");return}
var u=${JSON.stringify(target)}+encodeURIComponent(t);
var w=window.open(u,"_blank");
if(!w){location.href=u}
})();`;
  return `javascript:${encodeURIComponent(body.replace(/\n/g, ""))}`;
}

/** Legge il testo portato dal segnalibro; null se l'indirizzo non ne contiene. */
export function readImportHash(hash: string): string | null {
  const prefix = `#${IMPORT_HASH_KEY}=`;
  if (!hash.startsWith(prefix)) return null;
  try {
    const text = decodeURIComponent(hash.slice(prefix.length)).trim();
    return text ? text.slice(0, BOOKMARKLET_MAX_CHARS) : null;
  } catch {
    return null;
  }
}
