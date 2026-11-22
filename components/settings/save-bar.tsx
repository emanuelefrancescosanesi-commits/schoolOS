"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import type { SettingsResult } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";

const m = getMessages().settings;

/**
 * Stato di salvataggio condiviso dalle schede delle Impostazioni: avvia l'azione,
 * mostra «Salvato» o l'errore, e in demo avvisa che non si salva nulla.
 */
export function useSave(demo: boolean) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ tone: "error" | "notice"; text: string } | null>(null);

  const save = (action: () => Promise<SettingsResult>) => {
    setStatus(null);
    if (demo) return setStatus({ tone: "notice", text: m.demoNotice });
    start(async () => {
      try {
        const res = await action();
        setStatus(res.ok ? { tone: "notice", text: m.saved } : { tone: "error", text: res.error });
      } catch {
        setStatus({ tone: "error", text: m.errorGeneric });
      }
    });
  };

  return { pending, status, save, clear: () => setStatus(null) };
}

export function SaveBar({ pending, status, disabled }: { pending: boolean; status: { tone: "error" | "notice"; text: string } | null; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="primary" disabled={pending || disabled}>
        {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
        {pending ? m.saving : m.save}
      </Button>
      <div className="min-w-0 flex-1">
        {status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}
      </div>
    </div>
  );
}
