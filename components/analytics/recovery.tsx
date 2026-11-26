import { LifeBuoyIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecoverySubject, TestsNeeded } from "@/lib/domain/analytics";
import { type GradingScale, formatAverage, formatGrade } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";

const m = getMessages().analyticsPage.recovery;

function needText(n: TestsNeeded, tests: number, scale: GradingScale): string {
  if (n.status === "reached") return "";
  if (n.status === "unreachable") return m.unreachable(formatAverage(n.best));
  const v = formatGrade(n.value, scale);
  return tests === 1 ? m.one(v) : m.each(v);
}

/** Per ogni materia sotto la sufficienza: che voto serve con 1, 2, 3 o 4 prove. */
export function RecoveryPlan({ plan, subjects, scale, hasGrades }: { plan: RecoverySubject[]; subjects: Subject[]; scale: GradingScale; hasGrades: boolean }) {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  return (
    <Card aria-labelledby="rec-title">
      <CardHeader>
        <CardTitle id="rec-title" className="flex items-center gap-2">
          <LifeBuoyIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden /> {m.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {plan.length === 0 ? (
          <p className="text-sm text-muted">{hasGrades ? m.none : m.notEnough}</p>
        ) : (
          <>
            {plan.map((p) => {
              const subject = byId.get(p.subjectId);
              return (
                <section key={p.subjectId} aria-label={subject?.name}>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: subject ? `var(--subject-${subject.color})` : undefined }} aria-hidden />
                    <span className="min-w-0 truncate">{subject?.name ?? "—"}</span>
                  </h3>
                  <p className="mt-1 text-xs text-muted">{m.summary(formatAverage(p.average), p.count, formatGrade(scale.passThreshold, scale))}</p>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {p.options.map((o) => (
                      <li key={o.tests} className="rounded-control border border-border px-3 py-2 text-sm">
                        <span className="font-medium">{m.option(o.tests)}</span>
                        <span className="text-muted"> · {needText(o.needed, o.tests, scale)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <p className="text-xs text-muted">{m.hint}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
