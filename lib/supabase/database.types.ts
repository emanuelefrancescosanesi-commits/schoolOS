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

type Generated = "id" | "user_id" | "created_at" | "updated_at";
type Insertable<R, Required extends keyof R> = Pick<R, Required> & Partial<Omit<R, Required>>;

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        { id: string },
        Partial<Omit<ProfileRow, "id" | "onboarding_completed_at" | "created_at" | "updated_at">>
      >;
      school_years: Table<SchoolYearRow, Insertable<Omit<SchoolYearRow, Generated>, "label" | "starts_on" | "ends_on">>;
      periods: Table<
        PeriodRow,
        Insertable<Omit<PeriodRow, Generated>, "school_year_id" | "name" | "position" | "starts_on" | "ends_on">
      >;
      subjects: Table<SubjectRow, Insertable<Omit<SubjectRow, Generated>, "school_year_id" | "name" | "color">>;
      grades: Table<GradeRow, Insertable<Omit<GradeRow, Exclude<Generated, "id">>, "subject_id" | "value" | "graded_on">>;
      assignments: Table<AssignmentRow, Insertable<Omit<AssignmentRow, Generated>, "title" | "due_on">>;
    };
    Views: { [_ in never]: never };
    Functions: {
      complete_onboarding: { Args: { payload: Json }; Returns: string };
    };
    Enums: {
      period_scheme: PeriodScheme;
      average_method: AverageMethodDb;
      registro_provider: RegistroProviderDb;
      grade_kind: GradeKindDb;
      assignment_kind: AssignmentKindDb;
      assignment_status: AssignmentStatusDb;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
