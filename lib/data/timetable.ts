import "server-only";
import { type TimetableSlot, trimTime } from "@/lib/domain/timetable";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// [giorno, inizio, fine, materia demo, aula]
const DEMO: [number, string, string, string, string][] = [
  [1, "08:00", "09:00", "mat", "A12"],
  [1, "09:00", "10:00", "ita", "A12"],
  [1, "10:10", "11:10", "ing", "A12"],
  [2, "08:00", "09:00", "fis", "Lab 2"],
  [2, "09:00", "10:00", "sto", "A12"],
  [2, "10:10", "12:10", "inf", "Lab 1"],
  [3, "08:00", "09:00", "ita", "A12"],
  [3, "09:00", "10:00", "mat", "A12"],
  [3, "10:10", "11:10", "sci", "A12"],
  [4, "08:00", "10:00", "fil", "A12"],
  [4, "10:10", "11:10", "ing", "A12"],
  [5, "08:00", "09:00", "mat", "A12"],
  [5, "09:00", "10:00", "fis", "A12"],
  [5, "10:10", "11:10", "sto", "A12"],
];

export async function getTimetable(): Promise<TimetableSlot[]> {
  if (!isSupabaseConfigured()) {
    return DEMO.map(([weekday, start, end, subjectId, room], i) => ({ id: `demo-${i}`, weekday, start, end, subjectId, room }));
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("timetable_slots").select("*").order("starts_at");
  if (error) throw new Error(error.message);
  return data.map((r) => ({
    id: r.id,
    weekday: r.weekday,
    start: trimTime(r.starts_at),
    end: trimTime(r.ends_at),
    subjectId: r.subject_id ?? undefined,
    room: r.room ?? undefined,
  }));
}
