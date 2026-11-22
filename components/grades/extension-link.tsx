"use client";

import { useEffect, useState, useTransition } from "react";
import {
  type ExtensionCode,
  createExtensionCode,
  listExtensionCodes,
  revokeExtensionCode,
} from "@/app/(app)/grades/import/extension-actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";

const m = getMessages().grades.import;

/** Collegamento dell'estensione al proprio account: crea e revoca i codici. */
export function ExtensionLink({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const [codes, setCodes] = useState<ExtensionCode[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reload = () => listExtensionCodes().then(setCodes, () => setError(m.extError));
  useEffect(() => {
    void listExtensionCodes().then(setCodes, () => setError(m.extError));
  }, []);

  const create = () =>
    start(async () => {
      setError(null);
      const res = await createExtensionCode();
      if (!res.ok) return setError(res.error === "demo" ? m.extError : res.error);
      setFresh(res.code);
      setCopied(false);
      await reload();
    });

  const revoke = (id: string) =>
    start(async () => {
      setError(null);
      if (!(await revokeExtensionCode(id))) return setError(m.extError);
      await reload();
    });

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setError(m.copyFailed);
    }
  };

  return (
    <details open={defaultOpen || undefined} className="rounded-control border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">{m.extTitle}</summary>
      <div className="mt-3 flex flex-col gap-3 text-muted">
        <p>{m.extIntro}</p>
        <div>
          <Button onClick={create} disabled={pending}>
            {m.extCreate}
          </Button>
        </div>
        {fresh && (
          <div className="flex flex-col gap-2 rounded-control bg-surface-2 p-3">
            <code className="break-all font-mono text-xs text-foreground">{fresh}</code>
            <p className="text-xs">{m.extShownOnce}</p>
            <div>
              <Button onClick={copy}>{copied ? m.copied : m.extCopyCode}</Button>
            </div>
          </div>
        )}
        {codes.length > 0 && (
          <div>
            <p className="mb-1 font-medium text-foreground">{m.extActive}</p>
            <ul className="flex flex-col gap-2">
              {codes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3">
                  <span>
                    {c.label} · {c.lastUsedAt ? m.extLastUsed(new Date(c.lastUsedAt).toLocaleDateString("it-IT")) : m.extNever}
                    {c.status.state === "expired" && <span className="text-critical"> · {m.extExpired}</span>}
                    {c.status.state === "expiring" && <span className="text-warning"> · {m.extExpiring(c.status.daysLeft)}</span>}
                  </span>
                  <Button onClick={() => revoke(c.id)} disabled={pending}>
                    {m.extRevoke}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs">{m.extExpiryNote}</p>
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </div>
    </details>
  );
}
