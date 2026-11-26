import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Calendario collegato come lo vede la UI: l'indirizzo segreto resta sul server (si mostra solo il sito). */
export interface FeedView {
  id: string;
  label: string;
  host: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}

export async function getCalendarFeeds(): Promise<FeedView[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_feeds").select("id, label, url, last_synced_at, last_error").order("created_at");
  // Migrazione non ancora applicata: nessun calendario invece di un errore.
  if (error?.code === "PGRST205" || error?.code === "42P01") return [];
  if (error) throw new Error(error.message);
  return data.map((f) => ({
    id: f.id,
    label: f.label,
    host: (() => {
      try {
        return new URL(f.url).hostname;
      } catch {
        return "";
      }
    })(),
    lastSyncedAt: f.last_synced_at,
    lastError: f.last_error,
  }));
}
