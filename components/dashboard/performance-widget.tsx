"use client";

import { ChartNoAxesColumnIcon, GraduationCapIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import type { DashboardViewModel, SubjectRow } from "@/lib/dashboard/view-model";
import { type GradingScale, formatAverage, formatGrade, gradeStanding } from "@/lib/domain/grading";
import { formatDayMonth } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EmptyState, SubjectDot, WidgetCard } from "./widget-card";

const STANDING_TEXT = { positive: "text-positive", borderline: "text-warning", critical: "text-critical" } as const;
const OVERALL_TEXT = { positive: "text-fg", borderline: "text-warning", critical: "text-critical" } as const;
const GRADE_CHIP = {
  positive: "bg-positive-soft text-positive",
  borderline: "bg-warning-soft text-warning",
  critical: "bg-critical-soft text-critical",
} as const;
const STANDING_BAR = { positive: "bg-positive", borderline: "bg-warning", critical: "bg-critical" } as const;

export function PerformanceWidget({ vm }: { vm: DashboardViewModel }) {
  const m = getMessages();
  const t = m.dashboard.performance;
  const { overall, delta, trend, subjects } = vm.performance;

  return (
    <WidgetCard id="performance" title={m.dashboard.widgets.performance} icon={ChartNoAxesColumnIcon} href="/grades">
      {overall === null ? (
        <EmptyState icon={GraduationCapIcon}>{t.empty}</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-muted">{t.overall}</p>
              <p
                className={cn(
                  "tabular text-5xl font-medium tracking-tight",
                  OVERALL_TEXT[gradeStanding(overall, vm.scale)],
                )}
              >
                {formatAverage(overall)}
              </p>
              <DeltaBadge delta={delta} />
            </div>
            <TrendChart trend={trend} scale={vm.scale} label={t.trendLabel} />
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted">{t.bySubject}</h3>
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {subjects.map((row) => (
                <SubjectAverageRow key={row.subject.id} row={row} scale={vm.scale} />
              ))}
            </ul>
          </div>

          {vm.performance.recent.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted">{t.recent}</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {vm.performance.recent.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 rounded-control border border-border px-3 py-2">
                    <span
                      className={cn(
                        "tabular flex h-8 min-w-10 items-center justify-center rounded-control px-1.5 text-sm font-medium",
                        GRADE_CHIP[gradeStanding(g.value, vm.scale)],
                      )}
                    >
                      {formatGrade(g.value, vm.scale)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{g.description ?? g.subject.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <SubjectDot color={g.subject.color} />
                        <span className="truncate">{g.subject.name}</span>
                        <span aria-hidden>·</span>
                        <span className="shrink-0">{formatDayMonth(g.date)}</span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  const t = getMessages().dashboard.performance;
  if (delta === null) return <p className="mt-1 text-xs text-muted">{t.noDelta}</p>;
  // Sotto i cinque centesimi la variazione è rumore: non la coloriamo come un allarme.
  if (Math.abs(delta) < 0.05) return <Badge className="mt-2">{t.stable}</Badge>;
  const up = delta > 0;
  const Icon = up ? TrendingUpIcon : TrendingDownIcon;
  return (
    <Badge tone={up ? "positive" : "critical"} className="mt-2">
      <Icon className="size-3.5" aria-hidden />
      {t.delta(up ? "+" : "−", formatAverage(Math.abs(delta)))}
    </Badge>
  );
}

function SubjectAverageRow({ row, scale }: { row: SubjectRow; scale: GradingScale }) {
  const t = getMessages().dashboard.performance;
  const pct = ((row.average - scale.min) / (scale.max - scale.min)) * 100;
  const threshold = ((scale.passThreshold - scale.min) / (scale.max - scale.min)) * 100;

  return (
    <li className="py-1.5">
      <div className="flex items-center gap-2 text-sm">
        <SubjectDot color={row.subject.color} />
        <span className="min-w-0 flex-1 truncate">{row.subject.name}</span>
        <span className="text-xs text-muted">{t.gradesCount(row.count)}</span>
        <span className={cn("tabular w-11 text-right font-medium", STANDING_TEXT[row.standing])}>
          {formatAverage(row.average)}
        </span>
      </div>
      <div className="relative mt-1.5 h-1 rounded-full bg-surface-2" aria-hidden>
        <div className={cn("h-full rounded-full", STANDING_BAR[row.standing])} style={{ width: `${pct}%` }} />
        <div className="absolute -top-0.5 h-2 w-px bg-muted/60" style={{ left: `${threshold}%` }} />
      </div>
      {row.needed && (
        <p className={cn("mt-1 text-xs", STANDING_TEXT[row.standing])}>
          {row.needed.status === "reachable" ? t.needed(formatGrade(row.needed.value, scale)) : t.unreachable}
        </p>
      )}
    </li>
  );
}

function TrendChart({
  trend,
  scale,
  label,
}: {
  trend: DashboardViewModel["performance"]["trend"];
  scale: GradingScale;
  label: string;
}) {
  if (trend.length < 2) return null;
  const values = trend.map((p) => p.average);
  const min = Math.max(scale.min, Math.floor(Math.min(...values) - 0.5));
  const max = Math.min(scale.max, Math.ceil(Math.max(...values) + 0.5));
  const first = trend[0];
  const last = trend.at(-1)!;
  const summary = `${label}: da ${formatAverage(first.average)} (${formatDayMonth(first.date)}) a ${formatAverage(last.average)} (${formatDayMonth(last.date)})`;

  return (
    <figure className="h-24 w-full max-w-sm min-w-48 flex-1" role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-text)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent-text)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" hide />
          <YAxis domain={[min, max]} hide />
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
          <Area
            type="monotone"
            dataKey="average"
            stroke="var(--accent-text)"
            strokeWidth={2}
            fill="url(#trend-fill)"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0, fill: "var(--accent-text)" }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
