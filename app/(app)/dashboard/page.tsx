import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { InboxWidget } from "@/components/dashboard/inbox-widget";
import { PerformanceWidget } from "@/components/dashboard/performance-widget";
import { TasksWidget } from "@/components/dashboard/tasks-widget";
import { UpcomingWidget } from "@/components/dashboard/upcoming-widget";
import { WeekWidget } from "@/components/dashboard/week-widget";
import { Badge } from "@/components/ui/badge";
import { LAYOUT_COOKIE, parseLayout } from "@/lib/dashboard/layout";
import { buildDashboard } from "@/lib/dashboard/view-model";
import { getSchoolContext } from "@/lib/data/school-data";
import { capitalize, formatLongDay } from "@/lib/format";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().dashboard.title };

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

/**
 * Componente dinamico: legge l'ora corrente e il cookie della disposizione,
 * quindi viene reso a ogni richiesta (come avverrà con i dati reali per utente).
 */
async function Dashboard() {
  const m = getMessages();
  const cookieStore = await cookies();
  const layout = parseLayout(safeDecode(cookieStore.get(LAYOUT_COOKIE)?.value));
  const { data, today, hour } = await getSchoolContext();
  const vm = buildDashboard(data, today, hour);

  const header = (
    <div className="min-w-0">
      <p className="text-sm text-muted">{capitalize(formatLongDay(vm.today))}</p>
      <h1 className="mt-0.5 text-3xl font-semibold tracking-tight">
        {greeting(vm.hour, m)}, {vm.firstName}
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        {m.dashboard.summary(vm.summary.tests, vm.summary.homework)}
        {vm.periodName && <Badge>{m.dashboard.periodLabel(vm.periodName)}</Badge>}
      </p>
    </div>
  );

  return (
    <DashboardGrid
      initialLayout={layout}
      header={header}
      widgets={{
        performance: <PerformanceWidget vm={vm} />,
        upcoming: <UpcomingWidget rows={vm.upcoming} />,
        tasks: <TasksWidget rows={vm.tasks} />,
        week: <WeekWidget week={vm.week} />,
        inbox: <InboxWidget messages={vm.messages} today={vm.today} />,
      }}
    />
  );
}

function greeting(hour: number, m: ReturnType<typeof getMessages>): string {
  if (hour >= 5 && hour < 13) return m.greeting.morning;
  if (hour >= 13 && hour < 18) return m.greeting.afternoon;
  if (hour >= 18 && hour < 23) return m.greeting.evening;
  return m.greeting.night;
}

function safeDecode(value: string | undefined): string | undefined {
  if (!value) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
