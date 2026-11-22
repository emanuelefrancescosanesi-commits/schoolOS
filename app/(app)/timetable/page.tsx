import type { Metadata } from "next";
import { Suspense } from "react";
import { TimetableBoard } from "@/components/timetable/timetable-board";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { getTimetable } from "@/lib/data/timetable";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.timetable };

export default function TimetablePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Timetable />
    </Suspense>
  );
}

async function Timetable() {
  const { data, today } = await getSchoolContext();
  const slots = await getTimetable();
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: data.profile.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.timetable}</h1>
        <p className="mt-1 text-sm text-muted">{getMessages().timetablePage.intro}</p>
      </div>
      <TimetableBoard slots={slots} subjects={data.subjects} today={today} nowTime={nowTime} demo={data.isDemo} />
    </div>
  );
}
