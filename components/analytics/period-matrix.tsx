import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubjectPeriodRow } from "@/lib/domain/analytics";
import { type GradingScale, formatAverage, gradeStanding } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import type { Period } from "@/lib/domain/periods";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const m = getMessages().analyticsPage.matrix;
const TEXT = { positive: "text-fg", borderline: "text-warning", critical: "text-critical" } as const;

/** Tabella materia × periodo, scorrevole in orizzontale su telefono. */
export function PeriodMatrix({ rows, subjects, periods, scale }: { rows: SubjectPeriodRow[]; subjects: Subject[]; periods: Period[]; scale: GradingScale }) {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  return (
    <Card aria-labelledby="mx-title">
      <CardHeader>
        <CardTitle id="mx-title">{m.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 || periods.length === 0 ? (
          <p className="text-sm text-muted">{m.empty}</p>
        ) : (
          <div className="-mx-1 overflow-x-auto px-1" tabIndex={0} role="region" aria-labelledby="mx-title">
            <table className="w-full min-w-[22rem] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-medium">{m.subject}</th>
                  {periods.map((p) => (
                    <th key={p.id} scope="col" className="px-2 py-2 text-right font-medium">{p.name}</th>
                  ))}
                  <th scope="col" className="py-2 pl-2 text-right font-medium">{m.overall}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const subject = byId.get(r.subjectId);
                  return (
                    <tr key={r.subjectId} className="border-t border-border">
                      <th scope="row" className="py-2 pr-3 text-left font-normal">
                        <span className="flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: subject ? `var(--subject-${subject.color})` : undefined }} aria-hidden />
                          <span className="truncate">{subject?.name ?? "—"}</span>
                        </span>
                      </th>
                      {r.perPeriod.map((v, i) => (
                        <td key={periods[i].id} className={cn("tabular px-2 py-2 text-right", v === null ? "text-muted" : TEXT[gradeStanding(v, scale)])}>
                          {v === null ? m.none : formatAverage(v)}
                        </td>
                      ))}
                      <td className={cn("tabular py-2 pl-2 text-right font-medium", r.overall === null ? "text-muted" : TEXT[gradeStanding(r.overall, scale)])}>
                        {r.overall === null ? m.none : formatAverage(r.overall)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
