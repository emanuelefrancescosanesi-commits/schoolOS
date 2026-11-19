import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Data Access Layer della sessione: unico punto in cui si legge l'utente corrente.
 * `cache` evita di ripetere la lettura nella stessa richiesta.
 */

export interface SessionUser {
  id: string;
  email: string | null;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  // getClaims verifica la firma del JWT: a differenza di getSession non si fida del cookie.
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

export const getProfile = cache(async (userId: string): Promise<ProfileRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Lettura profilo non riuscita: ${error.message}`);
  return data;
});

/** Utente autenticato o redirect al login. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  return user;
}

/** Utente autenticato che ha completato l'onboarding, con il suo profilo. */
export async function requireOnboardedUser(): Promise<{ user: SessionUser; profile: ProfileRow }> {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  return { user, profile };
}
