import { averageDelta, overallAverage, overallTrend, requiredGrade, subjectAverages } from "@/lib/domain/averages";
import { type DateKey, diffDays, isWithin, weekOf } from "@/lib/domain/dates";
import { type GradeStanding, gradeStanding } from "@/lib/domain/grading";
import type { CalendarEvent, InboxMessage, SchoolData, Subject } from "@/lib/domain/model";
import { currentPeriod } from "@/lib/domain/periods";
import { type Priority, type Task, priorityOf, sortByPriority, upcomingAssessments } from "@/lib/domain/tasks";

/**
 * Tutto ciò che serve alla Dashboard, già calcolato e serializzabile.
 * Il calcolo resta sul server: il client riceve numeri pronti, non logica.
 */

export interface SubjectRow {
  subject: Subject;
  average: number;
  count: number;
  standing: GradeStanding;
  /** Voto minimo alla prossima prova per tornare alla sufficienza. */
  needed: { status: "reachable"; value: number } | { status: "unreachable" } | null;
}

export interface TaskRow {
  task: Task;
  subject: Subject | undefined;
  priority: Priority;
  daysLeft: number;
}

export interface DayCell {
  date: DateKey;
  isToday: boolean;
  items: { id: string; title: string; kind: CalendarEvent["kind"]; time?: string; subject?: Subject }[];
}

export interface DashboardViewModel {
  today: DateKey;
  hour: number;
  firstName: string;
  isDemo: boolean;
  scale: SchoolData["profile"]["scale"];
  periodName: string | null;
  performance: {
    overall: number | null;
    delta: number | null;
    trend: { date: DateKey; average: number }[];
    subjects: SubjectRow[];
    recent: { id: string; value: number; date: DateKey; description?: string; subject: Subject }[];
  };
  upcoming: TaskRow[];
  tasks: TaskRow[];
  messages: InboxMessage[];
  week: DayCell[];
  summary: { tests: number; homework: number };
}

export function buildDashboard(data: SchoolData, today: DateKey, hour: number): DashboardViewModel {
  const { profile, subjects } = data;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const period = currentPeriod(data.periods, today);

  const grades = data.grades.filter(
    (g) => g.date <= today && (period === null || isWithin(g.date, period.start, period.end)),
  );

  const perSubject = subjectAverages(
    grades,
    subjects.map((s) => s.id),
    profile.averageMethod,
  );

  const subjectRows: SubjectRow[] = perSubject.map(({ subjectId, average, count }) => {
    const standing = gradeStanding(average, profile.scale);
    let needed: SubjectRow["needed"] = null;
    if (standing !== "positive") {
      const result = requiredGrade(
        grades.filter((g) => g.subjectId === subjectId),
        profile.scale.passThreshold,
        profile.scale,
        profile.averageMethod,
      );
      if (result.status === "reachable") needed = result;
      else if (result.status === "unreachable") needed = { status: "unreachable" };
    }
    return { subject: subjectById.get(subjectId)!, average, count, standing, needed };
  });

  const weakSubjectIds = new Set(subjectRows.filter((r) => r.standing !== "positive").map((r) => r.subject.id));
  const ctx = { today, weakSubjectIds };
  const toRow = (task: Task): TaskRow => ({
    task,
    subject: subjectById.get(task.subjectId),
    priority: priorityOf(task, ctx),
    daysLeft: diffDays(today, task.due),
  });

  const openTasks = data.tasks.filter((t) => !t.done);
  const weekDays = weekOf(today);

  const week: DayCell[] = weekDays.map((date) => {
    const fromTasks = openTasks
      .filter((t) => t.due === date)
      .map((t) => ({ id: t.id, title: t.title, kind: t.kind, subject: subjectById.get(t.subjectId) }));
    const fromEvents = data.events
      .filter((e) => e.date === date)
      .map((e) => ({
        id: e.id,
        title: e.title,
        kind: e.kind,
        time: e.time,
        subject: e.subjectId ? subjectById.get(e.subjectId) : undefined,
      }));
    return { date, isToday: date === today, items: [...fromEvents, ...fromTasks] };
  });

  const next7 = openTasks.filter((t) => {
    const d = diffDays(today, t.due);
    return d >= 0 && d <= 7;
  });

  return {
    today,
    hour,
    firstName: profile.firstName,
    isDemo: data.isDemo,
    scale: profile.scale,
    periodName: period?.name ?? null,
    performance: {
      overall: overallAverage(grades, profile.averageMethod),
      delta: averageDelta(grades, profile.averageMethod, today, 30),
      trend: overallTrend(grades, profile.averageMethod).map((p) => ({ ...p, average: round2(p.average) })),
      subjects: subjectRows,
      recent: [...grades]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
        .slice(0, 4)
        .map((g) => ({
          id: g.id,
          value: g.value,
          date: g.date,
          description: g.description,
          subject: subjectById.get(g.subjectId)!,
        })),
    },
    upcoming: upcomingAssessments(openTasks, today, 14).map(toRow),
    tasks: sortByPriority(openTasks, ctx).map(toRow),
    messages: [...data.messages]
      .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))
      .slice(0, 4),
    week,
    summary: {
      tests: next7.filter((t) => t.kind === "test" || t.kind === "oral").length,
      homework: next7.filter((t) => t.kind === "homework" || t.kind === "project").length,
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
