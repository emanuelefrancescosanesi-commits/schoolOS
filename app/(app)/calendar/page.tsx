import type { Metadata } from "next";
import { Suspense } from "react";
import { MonthView } from "@/components/calendar/month-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.calendar };

export default function CalendarPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Calendar />
    </Suspense>
  );
}

async function Calendar() {
  const { data, today } = await getSchoolContext();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.calendar}</h1>
        <p className="mt-1 text-sm text-muted">{getMessages().calendarPage.intro}</p>
      </div>
      <MonthView tasks={data.tasks} events={data.events} subjects={data.subjects} today={today} demo={data.isDemo} />
    </div>
  );
}
