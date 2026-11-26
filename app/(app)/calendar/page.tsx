import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedAutoSync } from "@/components/calendar/feed-auto-sync";
import { MonthView } from "@/components/calendar/month-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getCalendarFeeds } from "@/lib/data/feeds";
import { getGoogleStatus } from "@/lib/data/google";
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
  const autoSync = !data.isDemo && ((await getCalendarFeeds()).length > 0 || (await getGoogleStatus()).connected);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.calendar}</h1>
        <p className="mt-1 text-sm text-muted">{getMessages().calendarPage.intro}</p>
      </div>
      {autoSync && <FeedAutoSync />}
      <MonthView tasks={data.tasks} events={data.events} subjects={data.subjects} today={today} demo={data.isDemo} />
    </div>
  );
}
