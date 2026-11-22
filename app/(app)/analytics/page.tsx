import type { Metadata } from "next";
import { Suspense } from "react";
import { PeriodComparison, SubjectWatch } from "@/components/analytics/insights";
import { Simulator } from "@/components/analytics/simulator";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { periodAverages, subjectInsights } from "@/lib/domain/analytics";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.analytics };

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Analytics />
    </Suspense>
  );
}

async function Analytics() {
  const { data, today } = await getSchoolContext();
  const { grades, subjects, periods, profile } = data;
  const method = profile.averageMethod;
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.analytics}</h1>
        <p className="mt-1 text-sm text-muted">{getMessages().analyticsPage.intro}</p>
      </div>
      <PeriodComparison rows={periodAverages(grades, periods, method)} scale={profile.scale} today={today} />
      <SubjectWatch insights={subjectInsights(grades, method)} subjects={subjects} scale={profile.scale} />
      <Simulator grades={grades} subjects={subjects} scale={profile.scale} method={method} />
    </div>
  );
}
