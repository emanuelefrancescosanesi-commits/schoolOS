import { SchoolIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { average } from "@/lib/domain/averages";
import { formatAverage } from "@/lib/domain/grading";
import { formatDayMonth } from "@/lib/format";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.mySchool };

export default function MySchoolPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <MySchool />
    </Suspense>
  );
}

async function MySchool() {
  const { data, today, schoolYear } = await getSchoolContext();
  const m = getMessages();
  const t = m.mySchoolPage;
  const { profile, subjects, periods, grades, tasks } = data;
  const header = [profile.schoolName ?? t.noSchool, profile.className].filter(Boolean).join(" · ");
  const openTasks = tasks.filter((x) => !x.done).length;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.nav.mySchool}</h1>
        <p className="mt-1 text-sm text-muted">{t.intro}</p>
      </div>

      <Card aria-labelledby="ms-school">
        <CardHeader>
          <SchoolIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
          <CardTitle id="ms-school">{header}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {schoolYear && <span>{t.year(schoolYear.label)}</span>}
          <Badge tone="neutral">{t.openTasks(openTasks)}</Badge>
        </CardContent>
      </Card>

      {periods.length > 0 && (
        <section aria-labelledby="ms-periods" className="flex flex-col gap-2">
          <h2 id="ms-periods" className="text-sm font-medium text-muted">
            {t.periods}
          </h2>
          <ul className="flex flex-col gap-2">
            {periods.map((p) => (
              <li key={p.id}>
                <Card className="flex-row items-center justify-between gap-3 p-3 text-sm">
                  <span className="font-medium">
                    {p.name}
                    {p.start <= today && today <= p.end && <Badge tone="accent" className="ml-2">{t.current}</Badge>}
                  </span>
                  <span className="text-muted">
                    {formatDayMonth(p.start)} – {formatDayMonth(p.end)}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ms-subjects" className="flex flex-col gap-2">
        <h2 id="ms-subjects" className="text-sm font-medium text-muted">
          {t.subjects}
        </h2>
        <ul className="flex flex-col gap-2">
          {subjects.map((s) => {
            const avg = average(grades.filter((g) => g.subjectId === s.id), profile.averageMethod);
            return (
              <li key={s.id}>
                <Card className="flex-row items-center gap-3 p-3">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `var(--subject-${s.color})` }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted">{s.teacher ?? t.noTeacher}</p>
                  </div>
                  <span className="tabular text-sm text-muted">{avg === null ? t.noGrades : formatAverage(avg)}</span>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
