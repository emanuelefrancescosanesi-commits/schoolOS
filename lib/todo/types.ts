import type { DateKey } from "@/lib/domain/dates";

/** 1 = urgente … 4 = normale (come Todoist: p1 è la più alta). */
export type TodoPriority = 1 | 2 | 3 | 4;

export type RecurrenceFreq = "day" | "week" | "month";

export interface Recurrence {
  freq: RecurrenceFreq;
  /** Ogni quante unità (ogni 2 settimane → 2). */
  interval: number;
  /** Solo per "week": giorni ISO 1 = lunedì … 7 = domenica. */
  weekdays?: number[];
}

export interface Todo {
  id: string;
  title: string;
  notes: string | null;
  /** Nullo = Inbox. */
  projectId: string | null;
  parentId: string | null;
  due: DateKey | null;
  /** "HH:MM", solo con una scadenza. */
  time: string | null;
  priority: TodoPriority;
  recurrence: Recurrence | null;
  subjectId: string | null;
  assignmentId: string | null;
  labelIds: string[];
  /** ISO timestamp del completamento; nullo se aperta. */
  completedAt: string | null;
  position: number;
  createdAt: string;
}

export interface TodoProject {
  id: string;
  name: string;
  /** 1–8, palette materie. */
  color: number;
  position: number;
}

export interface TodoLabel {
  id: string;
  name: string;
}

/** Compito della scuola non ancora collegato a un'attività: si può importare con un tocco. */
export interface ImportableAssignment {
  id: string;
  title: string;
  subjectId: string | null;
  due: DateKey;
  kind: "test" | "oral" | "homework" | "project";
}

export type TodoView =
  | { type: "inbox" }
  | { type: "today" }
  | { type: "upcoming" }
  | { type: "project"; id: string }
  | { type: "label"; id: string }
  | { type: "completed" };

export const PRIORITIES: readonly TodoPriority[] = [1, 2, 3, 4];

export function isPriority(n: number): n is TodoPriority {
  return n === 1 || n === 2 || n === 3 || n === 4;
}
