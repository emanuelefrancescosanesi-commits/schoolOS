import { BellIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { buildReminders } from "@/lib/domain/reminders";
import { formatDayMonth } from "@/lib/format";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.notifications };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Notifications />
    </Suspense>
  );
}

const TONE = { overdue: "critical", today: "warning", "soon-test": "accent", tomorrow: "neutral" } as const;

async function Notifications() {
  const { data, today } = await getSchoolContext();
  const m = getMessages();
  const t = m.notificationsPage;
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const reminders = buildReminders(data.tasks, today, data.profile.notifications);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.nav.notifications}</h1>
        <p className="mt-1 text-sm text-muted">{t.intro}</p>
      </div>
      {reminders.length === 0 ? (
        <p className="flex items-center gap-3 rounded-card border border-border bg-surface p-6 text-sm text-muted">
          <BellIcon strokeWidth={1.5} className="size-4" aria-hidden /> {t.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {reminders.map((r) => {
            const subject = subjectById.get(r.task.subjectId);
            return (
              <li key={r.id}>
                <Link href="/tasks" className="block">
                  <Card className="flex-row items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.task.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {subject ? `${subject.name} · ` : ""}
                        {formatDayMonth(r.task.due)}
                      </p>
                    </div>
                    <Badge tone={TONE[r.type]}>{t.types[r.type](r.days, m.tasksPage.kinds[r.task.kind])}</Badge>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">{t.note}</p>
    </div>
  );
}
