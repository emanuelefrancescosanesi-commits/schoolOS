/**
 * Tipi del database, allineati a supabase/migrations.
 *
 * Con un progetto Supabase collegato si rigenerano con:
 *   npx supabase gen types typescript --linked > lib/supabase/database.types.ts
 * Finché non c'è un progetto, sono scritti a mano nella stessa forma.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type PeriodScheme = "trimestri" | "trimestre-pentamestre" | "quadrimestri";
export type AverageMethodDb = "arithmetic" | "weighted";
export type RegistroProviderDb = "classeviva" | "argo" | "axios" | "altro" | "nessuno";
export type PlanDb = "free" | "pro";
export type GradeKindDb = "written" | "oral" | "practical";
export type AssignmentKindDb = "test" | "oral" | "homework" | "project";
export type AssignmentStatusDb = "todo" | "done";

export type ProfileRow = {
  id: string;
  first_name: string;
  school_name: string | null;
  class_name: string | null;
  time_zone: string;
  registro: RegistroProviderDb;
  period_scheme: PeriodScheme | null;
  grade_min: number;
  grade_max: number;
  allow_half: boolean;
  allow_plus_minus: boolean;
  pass_threshold: number;
  average_method: AverageMethodDb;
  dashboard_layout: Json | null;
  onboarding_completed_at: string | null;
  plan: PlanDb;
  created_at: string;
  updated_at: string;
};

export type SchoolYearRow = {
  id: string;
  user_id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  created_at: string;
};

export type PeriodRow = {
  id: string;
  user_id: string;
  school_year_id: string;
  name: string;
  position: number;
  starts_on: string;
  ends_on: string;
  created_at: string;
};

export type SubjectRow = {
  id: string;
  user_id: string;
  school_year_id: string;
  name: string;
  color: number;
  teacher_name: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type GradeRow = {
  id: string;
  user_id: string;
  subject_id: string;
  value: number;
  weight: number;
  kind: GradeKindDb;
  graded_on: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  kind: AssignmentKindDb;
  assigned_on: string | null;
  due_on: string;
  estimated_minutes: number | null;
  status: AssignmentStatusDb;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TodoProjectRow = {
  id: string;
  user_id: string;
  name: string;
  color: number;
  position: number;
  created_at: string;
  updated_at: string;
};

export type TodoLabelRow = { id: string; user_id: string; name: string; created_at: string };

export type TodoRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  parent_id: string | null;
  title: string;
  notes: string | null;
  due_on: string | null;
  due_time: string | null;
  priority: number;
  recurrence: Json | null;
  subject_id: string | null;
  assignment_id: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type TodoLabelLinkRow = { todo_id: string; label_id: string; user_id: string };

export type TimetableSlotRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  weekday: number;
  starts_at: string;
  ends_at: string;
  room: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  kind: "test" | "oral" | "project" | "homework" | "event";
  starts_on: string;
  starts_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InboxMessageRow = {
  id: string;
  user_id: string;
  subject_id: string | null;
  source: "manual" | "email" | "registro" | "calendar";
  sender: string;
  title: string;
  body: string;
  received_at: string;
  is_read: boolean;
  created_at: string;
};

type ExtensionTokenRow = {
  id: string;
  user_id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
};

type Generated = "id" | "user_id" | "created_at" | "updated_at";
type Insertable<R, Required extends keyof R> = Pick<R, Required> & Partial<Omit<R, Required>>;

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        { id: string },
        Partial<Omit<ProfileRow, "id" | "onboarding_completed_at" | "plan" | "created_at" | "updated_at">>
      >;
      school_years: Table<SchoolYearRow, Insertable<Omit<SchoolYearRow, Generated>, "label" | "starts_on" | "ends_on">>;
      periods: Table<
        PeriodRow,
        Insertable<Omit<PeriodRow, Generated>, "school_year_id" | "name" | "position" | "starts_on" | "ends_on">
      >;
      subjects: Table<SubjectRow, Insertable<Omit<SubjectRow, Generated>, "school_year_id" | "name" | "color">>;
      grades: Table<GradeRow, Insertable<Omit<GradeRow, Exclude<Generated, "id">>, "subject_id" | "value" | "graded_on">>;
      assignments: Table<AssignmentRow, Insertable<Omit<AssignmentRow, Generated>, "title" | "due_on">>;
      todo_projects: Table<TodoProjectRow, Insertable<Omit<TodoProjectRow, Generated>, "name">>;
      todo_labels: Table<TodoLabelRow, Insertable<Omit<TodoLabelRow, "id" | "user_id" | "created_at">, "name">>;
      todos: Table<TodoRow, Insertable<Omit<TodoRow, Generated>, "title">>;
      todo_label_links: Table<TodoLabelLinkRow, Insertable<Omit<TodoLabelLinkRow, "user_id">, "todo_id" | "label_id">>;
      timetable_slots: Table<
        TimetableSlotRow,
        Insertable<Omit<TimetableSlotRow, Exclude<Generated, "id">>, "weekday" | "starts_at" | "ends_at">
      >;
      events: Table<EventRow, Insertable<Omit<EventRow, Generated>, "title" | "starts_on">>;
      inbox_messages: Table<InboxMessageRow, Insertable<Omit<InboxMessageRow, Exclude<Generated, "id">>, "title">>;
      // Solo lettura e revoca dal client: i codici si creano con create_extension_token().
      extension_tokens: Table<ExtensionTokenRow, never, never>;
    };
    Views: { [_ in never]: never };
    Functions: {
      complete_onboarding: { Args: { payload: Json }; Returns: string };
      create_extension_token: { Args: { p_label?: string }; Returns: string };
      sync_grades: { Args: { p_token: string; p_rows: Json }; Returns: Json };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      sync_my_grades: { Args: { p_rows: Json }; Returns: Json };
      consume_ai_quota: { Args: { p_kind: string; p_limit: number }; Returns: boolean };
    };
    Enums: {
      period_scheme: PeriodScheme;
      average_method: AverageMethodDb;
      registro_provider: RegistroProviderDb;
      grade_kind: GradeKindDb;
      assignment_kind: AssignmentKindDb;
      assignment_status: AssignmentStatusDb;
      plan: PlanDb;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
