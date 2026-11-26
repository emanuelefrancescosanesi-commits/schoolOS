"use client";

import { BellIcon, BellOffIcon, CheckCheckIcon, CircleIcon, CircleCheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDayMonth } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import type { ReminderView } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { useNotifications } from "./notifications-provider";

const TONE = { overdue: "critical", today: "warning", "soon-test": "accent", tomorrow: "neutral" } as const;

/** Centro notifiche: elenco con stato letto/da leggere, filtro e "segna tutte come lette". */
export function NotificationCenter({ reminders, allOff }: { reminders: ReminderView[]; allOff: boolean }) {
  const m = getMessages();
  const t = m.notificationsPage;
  const { isRead, markRead, markUnread } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [error, setError] = useState(false);

  const unreadIds = reminders.filter((r) => !isRead(r.id)).map((r) => r.id);
  const shown = filter === "unread" ? reminders.filter((r) => !isRead(r.id)) : reminders;

  async function run(ok: Promise<boolean>) {
    setError(!(await ok));
  }

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-6 text-sm text-muted">
        <p className="flex items-center gap-3">
          {allOff ? <BellOffIcon strokeWidth={1.5} className="size-4 shrink-0" aria-hidden /> : <BellIcon strokeWidth={1.5} className="size-4 shrink-0" aria-hidden />}
          {allOff ? t.allOff : t.empty}
        </p>
        <Link href="/settings" className="inline-flex min-h-11 items-center text-accent-text underline-offset-4 hover:underline">
          {t.prefsHint}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={m.nav.notifications} className="flex gap-1 rounded-control border border-border bg-surface p-0.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "h-8 rounded-[calc(var(--radius-control)-2px)] px-3 text-sm pointer-coarse:h-10",
                filter === f ? "bg-surface-2 font-medium text-fg" : "text-muted hover:text-fg",
              )}
            >
              {f === "all" ? t.filterAll : `${t.filterUnread}${unreadIds.length ? ` (${unreadIds.length})` : ""}`}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" disabled={unreadIds.length === 0} onClick={() => run(markRead(unreadIds))}>
          <CheckCheckIcon aria-hidden /> {t.markAll}
        </Button>
      </div>

      <p role="status" className="text-sm text-muted">
        {t.unread(unreadIds.length)}
      </p>
      {error && (
        <p role="alert" className="rounded-control border border-critical/40 bg-critical-soft p-3 text-sm text-critical">
          {t.saveError}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-card border border-border bg-surface p-6 text-sm text-muted">{t.allRead}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((r) => {
            const read = isRead(r.id);
            const kind = m.tasksPage.kinds[r.kind as keyof typeof m.tasksPage.kinds] ?? r.kind;
            return (
              <li key={r.id}>
                <Card className={cn("flex-row items-center gap-1 p-1 pr-2", read && "opacity-70")}>
                  <Link
                    href="/tasks"
                    onClick={() => {
                      if (!read) void markRead([r.id]);
                    }}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-2"
                  >
                    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", read ? "bg-transparent" : "bg-accent")} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", !read && "font-semibold")}>{r.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {r.subjectName ? `${r.subjectName} · ` : ""}
                        {formatDayMonth(r.due)}
                      </span>
                    </span>
                    <Badge tone={TONE[r.type]}>{t.types[r.type](r.days, kind)}</Badge>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${read ? t.markUnread : t.markRead}: ${r.title}`}
                    title={read ? t.markUnread : t.markRead}
                    onClick={() => run(read ? markUnread(r.id) : markRead([r.id]))}
                  >
                    {read ? <CircleIcon strokeWidth={1.5} aria-hidden /> : <CircleCheckIcon strokeWidth={1.5} aria-hidden />}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/settings" className="inline-flex min-h-11 items-center self-start text-sm text-accent-text underline-offset-4 hover:underline">
        {t.prefsHint}
      </Link>
    </div>
  );
}
