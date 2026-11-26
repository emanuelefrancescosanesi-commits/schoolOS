import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface GoalsData {
  overall: number | null;
  bySubject: Record<string, number>;
}

/** Obiettivi di media dello studente. Tabella assente (migrazione non applicata) = nessun obiettivo. */
export async function getGoals(demo: boolean): Promise<GoalsData> {
  const empty: GoalsData = { overall: null, bySubject: {} };
  if (demo) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").select("subject_id, target");
  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01") return empty;
    throw new Error(error.message);
  }
  const out: GoalsData = { overall: null, bySubject: {} };
  for (const row of data) {
    if (row.subject_id === null) out.overall = Number(row.target);
    else out.bySubject[row.subject_id] = Number(row.target);
  }
  return out;
}
