import { TrendingDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PeriodAverage, SubjectInsight } from "@/lib/domain/analytics";
import type { DateKey } from "@/lib/domain/dates";
import { type GradingScale, formatAverage, gradeStanding } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";

const m = getMessages().analyticsPage;
const BAR = { positive: "bg-positive", borderline: "bg-warning", critical: "bg-critical" } as const;

export function PeriodComparison({ rows, scale, today }: { rows: PeriodAverage[]; scale: GradingScale; today: DateKey }) {
  return (
    <Card aria-labelledby="per-title">
      <CardHeader>
        <CardTitle id="per-title">{m.periods.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{m.periods.empty}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map(({ period, average, count }) => (
              <li key={period.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">
                    {period.name}
                    {period.start <= today && today <= period.end && <Badge tone="accent" className="ml-2">{m.periods.current}</Badge>}
                  </span>
                  <span className="tabular text-muted">
                    {average === null ? m.periods.noGrades : `${formatAverage(average)} · ${m.periods.count(count)}`}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  {average !== null && (
                    <div
                      className={`h-full rounded-full ${BAR[gradeStanding(average, scale)]}`}
                      style={{ width: `${Math.max(4, ((average - scale.min) / (scale.max - scale.min)) * 100)}%` }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function SubjectWatch({ insights, subjects, scale }: { insights: SubjectInsight[]; subjects: Subject[]; scale: GradingScale }) {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  // Instabili e in calo prima: sono quelle da tenere d'occhio.
  const watch = insights.filter((i) => i.unstable || (i.momentum !== null && i.momentum <= -0.5));
  return (
    <Card aria-labelledby="watch-title">
      <CardHeader>
        <CardTitle id="watch-title">{m.watch.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {watch.length === 0 ? (
          <p className="text-sm text-muted">{insights.length === 0 ? m.watch.notEnough : m.watch.allGood}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {watch.map((i) => {
              const subject = byId.get(i.subjectId);
              const falling = i.momentum !== null && i.momentum <= -0.5;
              return (
                <li key={i.subjectId} className="flex items-center gap-3 text-sm">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: subject ? `var(--subject-${subject.color})` : undefined }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{subject?.name ?? "—"}</span>
                  <span className="tabular text-muted">{formatAverage(i.average)}</span>
                  {i.unstable && <Badge tone="warning">{m.watch.unstable}</Badge>}
                  {falling && (
                    <Badge tone="critical">
                      <TrendingDownIcon strokeWidth={1.5} className="size-3" aria-hidden /> {m.watch.falling}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {watch.length > 0 && <p className="mt-4 text-xs text-muted">{m.watch.explain(scale.max)}</p>}
      </CardContent>
    </Card>
  );
}
