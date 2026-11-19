import { InboxIcon, MailIcon, NotebookTabsIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DashboardViewModel } from "@/lib/dashboard/view-model";
import { diffDays } from "@/lib/domain/dates";
import { formatShortDate } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EmptyState, WidgetCard } from "./widget-card";

export function InboxWidget({ messages, today }: { messages: DashboardViewModel["messages"]; today: string }) {
  const m = getMessages();
  const t = m.dashboard.inbox;

  return (
    <WidgetCard id="inbox" title={m.dashboard.widgets.inbox} icon={InboxIcon} href="/inbox">
      {messages.length === 0 ? (
        <EmptyState icon={MailIcon}>{t.empty}</EmptyState>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {messages.map((msg) => {
            const ago = diffDays(msg.date, today);
            const when = ago === 0 ? msg.time : ago === 1 ? m.common.daysAgo(1) : formatShortDate(msg.date);
            const SourceIcon = msg.source === "registro" ? NotebookTabsIcon : MailIcon;
            return (
              <li key={msg.id} className="flex gap-3 rounded-control px-2 py-2">
                <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <SourceIcon strokeWidth={1.5} className="size-4" aria-hidden />
                  {msg.unread && (
                    <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-accent">
                      <span className="sr-only">{t.unread}</span>
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className={cn("min-w-0 flex-1 truncate text-sm", msg.unread ? "font-medium text-fg" : "text-fg")}>
                      {msg.subject}
                    </p>
                    <span className="tabular shrink-0 text-xs text-muted">{when}</span>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {msg.from} · {msg.preview}
                  </p>
                </div>
                <Badge tone={msg.source === "registro" ? "accent" : "neutral"} className="hidden self-start sm:inline-flex">
                  {t.source[msg.source]}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}
