import type { Metadata } from "next";
import { Suspense } from "react";
import { Goals } from "@/components/analytics/goals";
import { PeriodMatrix } from "@/components/analytics/period-matrix";
import { RecoveryPlan } from "@/components/analytics/recovery";
import { TrendChart } from "@/components/analytics/trend-chart";
import { PeriodComparison, SubjectWatch } from "@/components/analytics/insights";
import { Simulator } from "@/components/analytics/simulator";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { getGoals } from "@/lib/data/goals-data";
import { periodAverages, recoveryPlan, subjectInsights, subjectPeriodMatrix } from "@/lib/domain/analytics";
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
  const goals = await getGoals(data.isDemo);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.analytics}</h1>
        <p className="mt-1 text-sm text-muted">{getMessages().analyticsPage.intro}</p>
      </div>
      <RecoveryPlan plan={recoveryPlan(grades, profile.scale, method)} subjects={subjects} scale={profile.scale} hasGrades={grades.length > 0} />
      <TrendChart grades={grades} subjects={subjects} periods={periods} scale={profile.scale} method={method} />
      <Goals grades={grades} subjects={subjects} scale={profile.scale} method={method} initial={goals} />
      <PeriodMatrix rows={subjectPeriodMatrix(grades, subjects.map((s) => s.id), periods, method)} subjects={subjects} periods={periods} scale={profile.scale} />
      <PeriodComparison rows={periodAverages(grades, periods, method)} scale={profile.scale} today={today} />
      <SubjectWatch insights={subjectInsights(grades, method)} subjects={subjects} scale={profile.scale} />
      <Simulator grades={grades} subjects={subjects} scale={profile.scale} method={method} />
    </div>
  );
}
