import type { Metadata } from "next";
import { Suspense } from "react";
import { GradesView } from "@/components/grades/grades-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { currentPeriod } from "@/lib/domain/periods";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().grades.title };

export default function GradesPage() {
  return (
    <Suspense fallback={<GradesSkeleton />}>
      <Grades />
    </Suspense>
  );
}

async function Grades() {
  const { data, today } = await getSchoolContext();
  return (
    <GradesView
      demo={data.isDemo}
      today={today}
      scale={data.profile.scale}
      averageMethod={data.profile.averageMethod}
      subjects={data.subjects}
      periods={data.periods}
      initialPeriodId={currentPeriod(data.periods, today)?.id ?? null}
      grades={data.grades}
    />
  );
}

function GradesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
