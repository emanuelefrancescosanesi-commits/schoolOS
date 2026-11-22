import type { Grade } from "@/lib/domain/averages";
import type { GradingScale } from "@/lib/domain/grading";
import type { SchoolData, StudentProfile, Subject } from "@/lib/domain/model";
import type { Period } from "@/lib/domain/periods";
import type { Task } from "@/lib/domain/tasks";
import type { AssignmentRow, GradeRow, PeriodRow, ProfileRow, SubjectRow } from "@/lib/supabase/database.types";

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

export function toSchoolData(rows: {
  profile: ProfileRow;
  subjects: SubjectRow[];
  periods: PeriodRow[];
  grades: GradeRow[];
  assignments: AssignmentRow[];
}): SchoolData {
  return {
    profile: profileFromRow(rows.profile),
    subjects: [...rows.subjects].sort((a, b) => a.position - b.position).map(subjectFromRow),
    periods: [...rows.periods].sort((a, b) => a.position - b.position).map(periodFromRow),
    grades: rows.grades.map(gradeFromRow),
    tasks: rows.assignments.map(taskFromRow),
    // Comunicazioni ed eventi arrivano con le integrazioni (Fase 3b).
    messages: [],
    events: [],
    isDemo: false,
  };
}
