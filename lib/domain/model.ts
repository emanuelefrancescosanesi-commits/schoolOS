import type { AverageMethod, Grade } from "./averages";
import type { DateKey } from "./dates";
import type { GradingScale } from "./grading";
import type { Period, PeriodScheme } from "./periods";
import type { Task } from "./tasks";

/**
 * Forma dei dati che la UI legge. Oggi la riempie il dataset demo; nelle fasi
 * successive la riempiranno Supabase e gli adapter, con la stessa forma.
 */

export type SourceId = "email" | "registro" | "calendar" | "manual";

export type RegistroProvider = "classeviva" | "argo" | "axios" | "altro" | "nessuno";

export interface StudentProfile {
  firstName: string;
  schoolName?: string;
  className?: string;
  timeZone: string;
  scale: GradingScale;
  averageMethod: AverageMethod;
  periodScheme: PeriodScheme;
  registro: RegistroProvider;
}

export interface Subject {
  id: string;
  name: string;
  /** Indice 1–8 nella palette materie (token --subject-N). */
  color: number;
  teacher?: string;
}

export interface InboxMessage {
  id: string;
  source: SourceId;
  from: string;
  subject: string;
  preview: string;
  date: DateKey;
  /** Ora locale "HH:MM" nel fuso dello studente. */
  time: string;
  unread: boolean;
  subjectId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: DateKey;
  time?: string;
  kind: "test" | "oral" | "homework" | "project" | "event";
  subjectId?: string;
}

export interface SchoolData {
  profile: StudentProfile;
  subjects: Subject[];
  periods: Period[];
  grades: Grade[];
  tasks: Task[];
  messages: InboxMessage[];
  events: CalendarEvent[];
  /** Vero quando i dati sono di esempio: la UI mostra sempre il banner demo. */
  isDemo: boolean;
}
