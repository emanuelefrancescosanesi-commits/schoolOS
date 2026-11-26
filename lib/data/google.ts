import "server-only";
import { googleConfig } from "@/lib/google/config";
import { hasScope } from "@/lib/google/oauth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export interface GoogleStatus {
  /** Chiavi presenti su Vercel: se false il collegamento non è ancora attivabile. */
  configured: boolean;
  connected: boolean;
  email: string | null;
  calendar: boolean;
  gmail: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

const OFF: GoogleStatus = { configured: false, connected: false, email: null, calendar: false, gmail: false, lastSyncedAt: null, lastError: null };

export async function getGoogleStatus(): Promise<GoogleStatus> {
  const configured = googleConfig() !== null;
  if (!isSupabaseConfigured()) return OFF;
  const supabase = await createClient();
  // Mai il codice di accesso: si leggono solo i campi che servono alla UI.
  const { data, error } = await supabase.from("google_connections").select("google_email, scopes, last_synced_at, last_error").maybeSingle();
  // Migrazione non ancora applicata: come «non collegato».
  if (error?.code === "PGRST205" || error?.code === "42P01") return { ...OFF, configured };
  if (error) throw new Error(error.message);
  if (!data) return { ...OFF, configured };
  return {
    configured,
    connected: true,
    email: data.google_email,
    calendar: hasScope(data.scopes, "calendar"),
    gmail: hasScope(data.scopes, "gmail"),
    lastSyncedAt: data.last_synced_at,
    lastError: data.last_error,
  };
}
