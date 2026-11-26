"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { averageTrend } from "@/lib/domain/analytics";
import type { AverageMethod, Grade } from "@/lib/domain/averages";
import { type GradingScale, formatAverage, formatGrade } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import type { Period } from "@/lib/domain/periods";
import { formatDayMonth } from "@/lib/format";
import { getMessages } from "@/lib/i18n";

const m = getMessages().analyticsPage.trend;

interface Props {
  grades: Grade[];
  subjects: Subject[];
  periods: Period[];
  scale: GradingScale;
  method: AverageMethod;
}

/** Andamento della media nel tempo, per materia o generale, con la soglia di sufficienza e l'inizio dei periodi. */
export function TrendChart({ grades, subjects, periods, scale, method }: Props) {
  const withGrades = useMemo(() => subjects.filter((s) => grades.some((g) => g.subjectId === s.id)), [subjects, grades]);
  const [choice, setChoice] = useState("all");
  const subject = withGrades.find((s) => s.id === choice) ?? null;
  const points = useMemo(() => averageTrend(grades, subject?.id ?? null, method), [grades, subject, method]);
  const color = subject ? `var(--subject-${subject.color})` : "var(--accent-text)";

  const values = points.map((p) => p.average);
  const lo = Math.max(scale.min, Math.floor(Math.min(...values, scale.passThreshold) - 0.5));
  const hi = Math.min(scale.max, Math.ceil(Math.max(...values, scale.passThreshold) + 0.5));
  const first = points[0];
  const last = points.at(-1);
  const name = subject?.name ?? m.all;
  const periodStarts = periods.filter((p) => first && last && p.start > first.date && p.start < last.date);

  return (
    <Card aria-labelledby="trend-title">
      <CardHeader>
        <CardTitle id="trend-title">{m.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {withGrades.length === 0 ? (
          <p className="text-sm text-muted">{getMessages().analyticsPage.simulator.empty}</p>
        ) : (
          <>
            <Field label={m.subject} htmlFor="trend-subject">
              <Select id="trend-subject" value={subject ? subject.id : "all"} onChange={(e) => setChoice(e.target.value)}>
                <option value="all">{m.all}</option>
                {withGrades.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            {points.length < 2 || !first || !last ? (
              <p className="text-sm text-muted">{m.notEnough}</p>
            ) : (
              <>
                <figure
                  className="m-0 h-56 w-full sm:h-64"
                  role="img"
                  aria-label={m.summary(name, formatDayMonth(first.date), formatDayMonth(last.date), formatAverage(first.average), formatAverage(last.average))}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => formatDayMonth(d)}
                        tick={{ fill: "var(--muted)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        minTickGap={32}
                      />
                      <YAxis domain={[lo, hi]} allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                      <ReferenceLine y={scale.passThreshold} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: m.pass(formatGrade(scale.passThreshold, scale)), position: "insideBottomRight", fill: "var(--muted)", fontSize: 11 }} />
                      {periodStarts.map((p) => (
                        <ReferenceLine key={p.id} x={points.find((pt) => pt.date >= p.start)?.date ?? p.start} stroke="var(--border)" />
                      ))}
                      <Tooltip
                        cursor={{ stroke: "var(--border)" }}
                        content={({ active, payload }) => {
                          const point = payload?.[0]?.payload as { date: string; average: number } | undefined;
                          if (!active || !point) return null;
                          return (
                            <div className="rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs shadow-sm">
                              <span className="text-muted">{formatDayMonth(point.date)}</span>{" "}
                              <span className="tabular font-medium text-fg">{formatAverage(point.average)}</span>
                            </div>
                          );
                        }}
                      />
                      <Line type="monotone" dataKey="average" stroke={color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: color }} activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2, fill: color }} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </figure>
                <details className="text-sm">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-accent-text">{m.table}</summary>
                  <table className="mt-2 w-full text-left text-sm">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th scope="col" className="py-1 font-medium">{m.date}</th>
                        <th scope="col" className="py-1 text-right font-medium">{m.average}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {points.map((p) => (
                        <tr key={p.date} className="border-t border-border">
                          <td className="py-1.5">{formatDayMonth(p.date)}</td>
                          <td className="tabular py-1.5 text-right">{formatAverage(p.average)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
