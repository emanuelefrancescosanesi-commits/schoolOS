"use client";

import { Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { addCalendarFeed, removeCalendarFeed, syncCalendarFeed } from "@/app/(app)/integrations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import type { FeedView } from "@/lib/data/feeds";
import { getMessages } from "@/lib/i18n";

const t = getMessages().integrationsPage.calendar;

function ago(iso: string | null): string {
  if (!iso) return t.neverSynced;
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  const when = min < 1 ? "adesso" : min < 60 ? `${min} min fa` : min < 1440 ? `${Math.round(min / 60)} h fa` : `${Math.round(min / 1440)} g fa`;
  return t.synced(when);
}

export function CalendarFeeds({ feeds }: { feeds: FeedView[] }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "notice"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (key: string, fn: () => ReturnType<typeof addCalendarFeed>, after?: () => void) =>
    start(async () => {
      setMsg(null);
      setBusy(key);
      const res = await fn();
      setBusy(null);
      if (!res.ok) return setMsg({ tone: "error", text: res.error === "demo" ? t.demo : res.error });
      if (res.summary) setMsg({ tone: "notice", text: res.summary });
      after?.();
    });

  return (
    <div className="flex flex-col gap-4">
      {feeds.length === 0 ? (
        <p className="text-muted">{t.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {feeds.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 rounded-control border border-border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{f.label || f.host}</p>
                <p className="truncate text-xs text-muted">
                  {f.host} · {ago(f.lastSyncedAt)}
                </p>
                {f.lastError && <p className="mt-1 text-xs text-critical">{f.lastError}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(`s-${f.id}`, () => syncCalendarFeed(f.id))}>
                  {busy === `s-${f.id}` ? t.syncing : t.sync}
                </Button>
                {confirm === f.id ? (
                  <Button variant="secondary" size="sm" disabled={pending} onClick={() => run(`r-${f.id}`, () => removeCalendarFeed(f.id), () => setConfirm(null))}>
                    <Trash2Icon strokeWidth={1.5} aria-hidden /> {t.removeConfirm}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm(f.id)}>
                    <Trash2Icon strokeWidth={1.5} aria-hidden /> {t.remove}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {feeds.length < 3 && (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run("add", () => addCalendarFeed(url, label), () => {
              setUrl("");
              setLabel("");
            });
          }}
        >
          <Field label={t.urlLabel} htmlFor="feed-url">
            <Input id="feed-url" type="url" inputMode="url" autoComplete="off" spellCheck={false} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t.urlPlaceholder} />
          </Field>
          <Field label={t.nameLabel} htmlFor="feed-label">
            <Input id="feed-label" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder={t.namePlaceholder} />
          </Field>
          <div>
            <Button type="submit" variant="primary" disabled={pending || !url.trim()}>
              {busy === "add" ? t.adding : t.add}
            </Button>
          </div>
        </form>
      )}
      {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}

      <details className="text-xs text-muted">
        <summary className="tap-area cursor-pointer font-medium text-fg">{t.howTitle}</summary>
        <p className="mt-2">{t.howGoogle}</p>
        <p className="mt-2">{t.howOutlook}</p>
      </details>
      <p className="text-xs text-muted">{t.privacy} {t.limit}</p>
    </div>
  );
}
