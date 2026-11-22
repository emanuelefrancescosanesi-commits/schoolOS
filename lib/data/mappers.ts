import type { Grade } from "@/lib/domain/averages";
import { dateKeyInTimeZone, timeInTimeZone } from "@/lib/domain/dates";
import type { GradingScale } from "@/lib/domain/grading";
import type { CalendarEvent, InboxMessage, SchoolData, StudentProfile, Subject } from "@/lib/domain/model";
import type { Period } from "@/lib/domain/periods";
import type { Task } from "@/lib/domain/tasks";
import type { AssignmentRow, EventRow, GradeRow, InboxMessageRow, PeriodRow, ProfileRow, SubjectRow } from "@/lib/supabase/database.types";

/** Conversioni pure dalle righe del database al modello del dominio. */

export function scaleFromProfile(p: ProfileRow): GradingScale {
  return {
    min: Number(p.grade_min),
    max: Number(p.grade_max),
    allowHalf: p.allow_half,
    allowPlusMinus: p.allow_plus_minus,
    passThreshold: Number(p.pass_threshold),
  };
}

export function profileFromRow(p: ProfileRow): StudentProfile {
  return {
    firstName: p.first_name,
    schoolName: p.school_name?.trim() || undefined,
    className: p.class_name?.trim() || undefined,
    timeZone: p.time_zone,
    scale: scaleFromProfile(p),
    averageMethod: p.average_method,
    periodScheme: p.period_scheme ?? "trimestre-pentamestre",
    registro: p.registro,
    notifications: {
      overdue: p.notify_overdue,
      dueSoon: p.notify_due_soon,
      tests: p.notify_tests,
      testDays: p.notify_test_days,
    },
  };
}

export const subjectFromRow = (s: SubjectRow): Subject => ({
  id: s.id,
  name: s.name,
  color: s.color,
  teacher: s.teacher_name ?? undefined,
});

export const periodFromRow = (p: PeriodRow): Period => ({ id: p.id, name: p.name, start: p.starts_on, end: p.ends_on });

// numeric di Postgres arriva come stringa da PostgREST: va sempre convertito.
export const gradeFromRow = (g: GradeRow): Grade => ({
  id: g.id,
  subjectId: g.subject_id,
  value: Number(g.value),
  weight: Number(g.weight),
  date: g.graded_on,
  kind: g.kind,
  description: g.description ?? undefined,
});

export const taskFromRow = (a: AssignmentRow): Task => ({
  id: a.id,
  title: a.title,
  subjectId: a.subject_id ?? "",
  kind: a.kind,
  due: a.due_on,
  estimatedMinutes: a.estimated_minutes ?? undefined,
  done: a.status === "done",
});

export const eventFromRow = (e: EventRow): CalendarEvent => ({
  id: e.id,
  title: e.title,
  date: e.starts_on,
  time: e.starts_at ? e.starts_at.slice(0, 5) : undefined,
  kind: e.kind,
  subjectId: e.subject_id ?? undefined,
  notes: e.notes ?? undefined,
});

export function messageFromRow(m: InboxMessageRow, timeZone: string): InboxMessage {
  const at = new Date(m.received_at);
  return {
    id: m.id,
    source: m.source,
    from: m.sender,
    subject: m.title,
    preview: m.body.replace(/\s+/g, " ").slice(0, 140),
    body: m.body,
    date: dateKeyInTimeZone(at, timeZone),
    time: timeInTimeZone(at, timeZone),
    unread: !m.is_read,
    subjectId: m.subject_id ?? undefined,
  };
}

export function toSchoolData(rows: {
  profile: ProfileRow;
  subjects: SubjectRow[];
  periods: PeriodRow[];
  grades: GradeRow[];
  assignments: AssignmentRow[];
  events?: EventRow[];
  messages?: InboxMessageRow[];
}): SchoolData {
  return {
    profile: profileFromRow(rows.profile),
    subjects: [...rows.subjects].sort((a, b) => a.position - b.position).map(subjectFromRow),
    periods: [...rows.periods].sort((a, b) => a.position - b.position).map(periodFromRow),
    grades: rows.grades.map(gradeFromRow),
    tasks: rows.assignments.map(taskFromRow),
    messages: (rows.messages ?? []).map((m) => messageFromRow(m, rows.profile.time_zone)),
    events: (rows.events ?? []).map(eventFromRow),
    isDemo: false,
  };
}
