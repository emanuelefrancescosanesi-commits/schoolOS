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

/**
 * Segnalibro per i registri riconosciuti dalle regole (oggi Axios): contiene il motore di lettura
 * (public/registry/engine.js) e le regole, legge la griglia voti con data e tipo e la manda come
 * testo «MATERIA / gg/mm/aaaa Tipo voto», che SchoolOS già capisce. Se la pagina non è
 * riconosciuta ripiega sul testo visibile, come il segnalibro semplice.
 */
export function buildRegistryBookmarklet(appOrigin: string, engine: string, rules: unknown[]): string {
  const target = `${appOrigin.replace(/\/$/, "")}/grades#${IMPORT_HASH_KEY}=`;
  const body = `(function(){var t="";
try{${engine}
;var rules=${JSON.stringify(rules)};var K={written:"Scritto",oral:"Orale",practical:"Pratico"};
for(var i=0;i<rules.length&&!t;i++){var r=window.schoolosRegistry.hostAllowed(location.hostname,rules[i])?window.schoolosRegistry.extractGrid(document,rules[i].datasets.grades,new Date()):null;
if(r&&r.length){r.sort(function(a,b){return a.subject<b.subject?-1:a.subject>b.subject?1:0});var last=null,o=[];
r.forEach(function(x){if(x.subject!==last){o.push("",x.subject);last=x.subject}var p=x.date.split("-");o.push(p[2]+"/"+p[1]+"/"+p[0]+" "+K[x.kind]+" "+String(x.value).replace(".",",")+(x.weight!==undefined&&x.weight!==1?" peso "+String(x.weight).replace(".",","):""))});t=o.join("\\n").trim()}}}catch(e){}
if(!t)t=(document.body&&document.body.innerText||"").replace(/[ \\t]+/g," ").replace(/\\n{3,}/g,"\\n\\n").trim();
t=t.slice(0,${BOOKMARKLET_MAX_CHARS});
if(!t){alert("SchoolOS: non trovo testo in questa pagina.");return}
var u=${JSON.stringify(target)}+encodeURIComponent(t);
var w=window.open(u,"_blank");
if(!w){location.href=u}
})();`;
  return `javascript:${encodeURIComponent(body)}`;
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

const STASH_KEY = "schoolos.import-stash";

/**
 * Il segnalibro può aprire SchoolOS senza sessione (es. Safari, che non condivide il login con la
 * PWA): il login rimanda alla pagina senza il frammento e il testo andrebbe perso. Si tiene da
 * parte nella scheda (sessionStorage) fino al ritorno su Voti.
 */
export function stashImportHash(hash: string, storage: Pick<Storage, "setItem">): boolean {
  if (!readImportHash(hash)) return false;
  try {
    storage.setItem(STASH_KEY, hash);
    return true;
  } catch {
    return false;
  }
}

/** Testo messo da parte prima del login; si legge una volta sola. */
export function takeStashedImport(storage: Pick<Storage, "getItem" | "removeItem">): string | null {
  try {
    const hash = storage.getItem(STASH_KEY);
    if (!hash) return null;
    storage.removeItem(STASH_KEY);
    return readImportHash(hash);
  } catch {
    return null;
  }
}
