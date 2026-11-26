"use client";

import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { disconnectGoogle, syncGoogleNow } from "@/app/(app)/integrations/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/label";
import type { GoogleStatus } from "@/lib/data/google";
import { getMessages } from "@/lib/i18n";

const t = getMessages().integrationsPage.google;

function ago(iso: string | null): string {
  if (!iso) return "Mai sincronizzato";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return `Aggiornato ${min < 1 ? "adesso" : min < 60 ? `${min} min fa` : min < 1440 ? `${Math.round(min / 60)} h fa` : `${Math.round(min / 1440)} g fa`}`;
}

export function GoogleConnect({ status, flash }: { status: GoogleStatus; flash?: string }) {
  const [msg, setMsg] = useState<{ tone: "error" | "notice"; text: string } | null>(
    flash && t.flash[flash] ? { tone: flash === "ok" ? "notice" : "error", text: t.flash[flash] } : null,
  );
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<"sync" | "off" | null>(null);
  const [pending, start] = useTransition();

  const run = (kind: "sync" | "off") =>
    start(async () => {
      setMsg(null);
      setBusy(kind);
      const res = await (kind === "sync" ? syncGoogleNow() : disconnectGoogle());
      setBusy(null);
      setConfirm(false);
      if (!res.ok) return setMsg({ tone: "error", text: res.error });
      if (res.summary) setMsg({ tone: "notice", text: res.summary });
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted">{t.body}</p>

      {!status.configured ? (
        <p className="text-muted">{t.off}</p>
      ) : status.connected ? (
        <>
          <div className="flex flex-col gap-2 rounded-control border border-border p-3">
            <p className="font-medium break-all">{t.connectedAs(status.email ?? "")}</p>
            <p className="flex flex-wrap gap-1.5">
              <Badge tone={status.calendar ? "positive" : "neutral"}>{status.calendar ? t.calendarOn : t.calendarOff}</Badge>
              <Badge tone={status.gmail ? "positive" : "neutral"}>{status.gmail ? t.gmailOn : t.gmailOff}</Badge>
            </p>
            <p className="text-xs text-muted">{ago(status.lastSyncedAt)}</p>
            {status.lastError && <p className="text-xs text-critical">{status.lastError}</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => run("sync")}>
                {busy === "sync" ? t.syncing : t.sync}
              </Button>
              <a href="/api/google/connect" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                {t.reconnect}
              </a>
              {confirm ? (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => run("off")}>
                  <Trash2Icon strokeWidth={1.5} aria-hidden /> {t.disconnectConfirm}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm(true)}>
                  <Trash2Icon strokeWidth={1.5} aria-hidden /> {t.disconnect}
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <div>
          <a href="/api/google/connect" className={buttonVariants({ variant: "primary" })}>
            {t.connect}
          </a>
        </div>
      )}

      {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
      <p className="text-xs text-muted">{t.privacy}</p>
      {status.configured && <p className="text-xs text-muted">{t.testMode}</p>}
    </div>
  );
}
