"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { type AverageMethod, type Grade, average, requiredGrade } from "@/lib/domain/averages";
import { type GradingScale, formatAverage, formatGrade } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";

const m = getMessages().analyticsPage.simulator;

interface Props {
  grades: Grade[];
  subjects: Subject[];
  scale: GradingScale;
  method: AverageMethod;
}

/** "Che voto mi serve?": il voto minimo alla prossima prova per raggiungere una media. */
export function Simulator({ grades, subjects, scale, method }: Props) {
  const withGrades = useMemo(() => subjects.filter((s) => grades.some((g) => g.subjectId === s.id)), [subjects, grades]);
  const [subjectId, setSubjectId] = useState(withGrades[0]?.id ?? "");
  const [target, setTarget] = useState(String(scale.passThreshold));
  const [weight, setWeight] = useState("1");

  const list = grades.filter((g) => g.subjectId === subjectId);
  const current = average(list, method);
  const targetNum = Number(target.replace(",", "."));
  const valid = Number.isFinite(targetNum) && targetNum >= scale.min && targetNum <= scale.max;
  const result = valid && list.length ? requiredGrade(list, targetNum, scale, method, Number(weight)) : null;

  return (
    <Card aria-labelledby="sim-title">
      <CardHeader>
        <CardTitle id="sim-title">{m.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {withGrades.length === 0 ? (
          <p className="text-sm text-muted">{m.empty}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={m.subject} htmlFor="sim-subject" className="col-span-2">
                <Select id="sim-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {withGrades.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={m.target} htmlFor="sim-target">
                <Input id="sim-target" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
              </Field>
              {method === "weighted" && (
                <Field label={m.weight} htmlFor="sim-weight">
                  <Select id="sim-weight" value={weight} onChange={(e) => setWeight(e.target.value)}>
                    <option value="0.5">{m.weights.half}</option>
                    <option value="1">{m.weights.normal}</option>
                    <option value="2">{m.weights.double}</option>
                  </Select>
                </Field>
              )}
            </div>
            {current !== null && (
              <p className="text-sm text-muted">
                {m.currentAverage} <span className="tabular font-medium text-fg">{formatAverage(current)}</span>
              </p>
            )}
            <p role="status" className="rounded-card border border-border bg-surface-2 p-4 text-sm">
              {!valid
                ? m.invalidTarget(formatGrade(scale.min, scale), formatGrade(scale.max, scale))
                : result?.status === "reached"
                  ? m.reached
                  : result?.status === "reachable"
                    ? m.reachable(formatGrade(result.value, scale))
                    : result?.status === "unreachable"
                      ? m.unreachable(formatAverage(result.best))
                      : null}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
