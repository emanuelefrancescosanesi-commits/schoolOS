import {
  type RegistryGrade,
  type RegistryRule,
  registryMessageSchema,
  registryRowsSchema,
  urlAllowed,
} from "@/lib/registry/schema";

/** Strato sottile sulla webview nativa (plugin Capacitor): così la logica si prova senza telefono. */
export interface WebviewDriver {
  /** Apre la pagina; `hidden` = non visibile finché non serve il login. Restituisce l'id. */
  open(opts: { url: string; hidden: boolean }): Promise<string>;
  show(id: string): Promise<void>;
  close(id: string): Promise<void>;
  run(id: string, code: string): Promise<void>;
  navigate(id: string, url: string): Promise<void>;
  /** Eventi della webview `id`; restituiscono la funzione per smettere di ascoltare. */
  onPageLoaded(id: string, fn: () => void): () => void;
  onMessage(id: string, fn: (detail: unknown) => void): () => void;
  onUrl(id: string, fn: (url: string) => void): () => void;
  onClosed(id: string, fn: () => void): () => void;
}

export type SyncStatus = "opening" | "login" | "reading" | "sending";
export type SyncOutcome =
  | { ok: true; rows: number; result: unknown; resumeUrl?: string }
  | { ok: false; reason: "closed" | "timeout" | "blocked" | "error" | "invalid" | "disabled"; detail?: string };

export interface SyncOptions {
  driver: WebviewDriver;
  rule: RegistryRule;
  /** Contenuto di public/registry/engine.js. */
  engine: string;
  /** Pagina da cui ripartire (ultima griglia voti vista): senza, si parte dal login. */
  startUrl?: string;
  upload: (rows: RegistryGrade[]) => Promise<unknown>;
  onStatus?: (s: SyncStatus) => void;
  /** Se la webview nascosta non produce voti entro questo tempo si mostra all'utente. */
  hiddenMs?: number;
  totalMs?: number;
}

/** Script iniettato: motore + regole come dati, risposta via ponte nativo. */
export function buildScript(engine: string, rule: RegistryRule): string {
  return `(function(){try{${engine}\n;var rule=${JSON.stringify(rule)};window.schoolosRegistry.run(window,rule,function(m){window.mobileApp.postMessage({detail:m});});}catch(e){try{window.mobileApp.postMessage({detail:{source:"schoolos-registry",v:1,registry:${JSON.stringify(rule.registry)},state:"error"}});}catch(_){}}})();`;
}

/** Apre il riquadro «Voti» quando l'indirizzo non è un link normale. */
export function buildOpenTileScript(engine: string, rule: RegistryRule): string {
  return `(function(){try{${engine}\n;var rule=${JSON.stringify(rule)};var t=window.schoolosRegistry.findTile(document,rule.home);if(t)t.click();}catch(e){}})();`;
}

/**
 * Un giro di lettura: webview nascosta → (login se serve) → pagina voti → righe → invio.
 * Le credenziali non passano di qui: l'utente le scrive nella pagina vera del registro.
 */
export function runRegistrySync(o: SyncOptions): Promise<SyncOutcome> {
  const { driver, rule } = o;
  if (!rule.enabled) return Promise.resolve({ ok: false, reason: "disabled" });
  const script = buildScript(o.engine, rule);
  const openTile = buildOpenTileScript(o.engine, rule);

  return new Promise<SyncOutcome>((resolve) => {
    let id: string | null = null;
    let shown = false;
    let done = false;
    let tileTried = false;
    const offs: Array<() => void> = [];
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = async (outcome: SyncOutcome) => {
      if (done) return;
      done = true;
      for (const t of timers) clearTimeout(t);
      for (const off of offs) off();
      if (id) await driver.close(id).catch(() => {});
      resolve(outcome);
    };
    const reveal = async () => {
      if (!id || shown) return;
      shown = true;
      o.onStatus?.("login");
      await driver.show(id).catch(() => {});
    };

    const handle = async (detail: unknown) => {
      if (done || !id) return;
      const parsed = registryMessageSchema.safeParse(detail);
      if (!parsed.success || parsed.data.registry !== rule.registry) return;
      const msg = parsed.data;
      switch (msg.state) {
        case "rows": {
          const rows = registryRowsSchema.safeParse(msg.rows ?? []);
          if (!rows.success) return finish({ ok: false, reason: "invalid" });
          o.onStatus?.("sending");
          try {
            const result = await o.upload(rows.data);
            const resumeUrl = msg.origin && msg.path ? `${msg.origin}${msg.path}` : undefined;
            return finish({ ok: true, rows: rows.data.length, result, resumeUrl });
          } catch (e) {
            return finish({ ok: false, reason: "error", detail: e instanceof Error ? e.message : "upload" });
          }
        }
        case "login":
          return reveal();
        case "tile":
          o.onStatus?.("reading");
          if (msg.next && urlAllowed(msg.next, rule.hosts)) return driver.navigate(id, msg.next);
          if (!tileTried) {
            tileTried = true;
            return driver.run(id, openTile);
          }
          return;
        case "blocked":
          return finish({ ok: false, reason: "blocked" });
        case "error":
          return reveal();
        default:
          // «other»: pagina del registro non riconosciuta (es. dopo il login): lascia navigare l'utente.
          return reveal();
      }
    };

    void (async () => {
      try {
        o.onStatus?.("opening");
        const start = o.startUrl && urlAllowed(o.startUrl, rule.hosts) ? o.startUrl : rule.loginUrl;
        id = await driver.open({ url: start, hidden: true });
        const wid = id;
        offs.push(driver.onPageLoaded(wid, () => void driver.run(wid, script).catch(() => {})));
        offs.push(driver.onMessage(wid, (d) => void handle(d)));
        offs.push(
          driver.onUrl(wid, (url) => {
            if (!urlAllowed(url, rule.hosts)) void finish({ ok: false, reason: "blocked" });
          }),
        );
        offs.push(driver.onClosed(wid, () => void finish({ ok: false, reason: "closed" })));
        timers.push(setTimeout(() => void reveal(), o.hiddenMs ?? 20_000));
        timers.push(setTimeout(() => void finish({ ok: false, reason: "timeout" }), o.totalMs ?? 5 * 60_000));
      } catch (e) {
        void finish({ ok: false, reason: "error", detail: e instanceof Error ? e.message : "open" });
      }
    })();
  });
}
