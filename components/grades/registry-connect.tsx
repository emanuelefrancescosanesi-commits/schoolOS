"use client";

import { Capacitor } from "@capacitor/core";
import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { syncRegistryGrades } from "@/app/(app)/grades/registry/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";
import type { RegistryRules } from "@/lib/registry/schema";
import { type SyncOutcome, type SyncStatus, runRegistrySync } from "@/lib/registry/session";

const m = getMessages().grades.registry;
const KEY = "schoolos.registry";
type Saved = { registry: string; resumeUrl?: string };

function load(): Saved | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}
function save(v: Saved | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
    else localStorage.removeItem(KEY);
  } catch {
    /* archiviazione non disponibile: si ripartirà dal login */
  }
}

/** Collegamento al registro dentro l'app: login nella pagina vera, voti letti e salvati. */
export function RegistryConnect({ autoRefresh = true }: { autoRefresh?: boolean }) {
  // Solo nell'app nativa: sul sito e nella PWA non compare (restano gli altri modi di importare).
  const native = useSyncExternalStore(
    () => () => {},
    () => Capacitor.isNativePlatform(),
    () => false,
  );
  return native ? <Connect autoRefresh={autoRefresh} /> : null;
}

function Connect({ autoRefresh }: { autoRefresh: boolean }) {
  const [rules, setRules] = useState<RegistryRules | null>(null);
  const [saved, setSaved] = useState<Saved | null>(load);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [message, setMessage] = useState<{ tone: "notice" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/registry/rules.json").then((r) => r.json()).then(setRules, () => setMessage({ tone: "error", text: m.error }));
  }, []);

  const sync = useCallback(
    async (key: string) => {
      if (status || !rules?.registries[key]) return;
      setStatus("opening");
      setMessage(null);
      try {
        const [{ inAppBrowserDriver }, engine] = await Promise.all([
          import("@/lib/registry/inappbrowser-driver"),
          fetch("/registry/engine.js").then((r) => r.text()),
        ]);
        const prev = load();
        const outcome: SyncOutcome = await runRegistrySync({
          driver: inAppBrowserDriver,
          rule: rules.registries[key],
          engine,
          startUrl: prev?.registry === key ? prev.resumeUrl : undefined,
          onStatus: setStatus,
          upload: async (rows) => {
            const res = await syncRegistryGrades(rows);
            if (!res.ok) throw new Error(res.error);
            return res;
          },
        });
        if (outcome.ok) {
          const res = outcome.result as { inserted: number; created: string[] };
          const next = { registry: key, resumeUrl: outcome.resumeUrl };
          save(next);
          setSaved(next);
          setMessage({ tone: "notice", text: [m.done(res.inserted), res.created.length ? m.created(res.created) : ""].join(" ").trim() });
        } else {
          setMessage({ tone: "error", text: m[outcome.reason] });
        }
      } catch {
        setMessage({ tone: "error", text: m.error });
      } finally {
        setStatus(null);
      }
    },
    [rules, status],
  );

  // Aggiornamento all'apertura dell'app (iOS non permette lo sfondo).
  useEffect(() => {
    if (autoRefresh && saved && rules) void Promise.resolve().then(() => sync(saved.registry));
    // solo al primo caricamento delle regole
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  const list = rules ? Object.values(rules.registries).filter((r) => r.enabled) : [];
  const forget = async () => {
    const { forgetRegistrySession } = await import("@/lib/registry/inappbrowser-driver");
    await forgetRegistrySession().catch(() => {});
    save(null);
    setSaved(null);
    setMessage(null);
  };

  return (
    <section className="flex flex-col gap-3 rounded-control border border-border p-3" aria-labelledby="registry-title">
      <h3 id="registry-title" className="text-base font-medium">
        {m.title}
      </h3>
      <p className="text-sm text-muted">{m.intro}</p>
      {status && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          {m[status]}
        </p>
      )}
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      <div className="flex flex-wrap gap-2">
        {saved ? (
          <>
            <Button variant="primary" disabled={!!status} onClick={() => void sync(saved.registry)}>
              <RefreshCwIcon aria-hidden /> {m.refresh}
            </Button>
            <Button disabled={!!status} onClick={() => void forget()}>
              {m.forget}
            </Button>
          </>
        ) : (
          list.map((r) => (
            <Button key={r.registry} variant="primary" disabled={!!status || !rules} onClick={() => void sync(r.registry)}>
              {m.connect(r.label)}
            </Button>
          ))
        )}
      </div>
      {Capacitor.getPlatform() === "ios" && <p className="text-xs text-muted">{m.iosNote}</p>}
    </section>
  );
}
