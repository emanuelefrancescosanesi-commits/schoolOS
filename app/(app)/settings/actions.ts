"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const DELETE_PHRASE = "ELIMINA";

/** Elimina l'account e tutti i dati dello studente (cascade nel database), poi esce. */
export async function deleteAccount(phrase: string): Promise<{ error: string } | never> {
  if (!isSupabaseConfigured()) return { error: "Non disponibile in modalità demo." };
  await requireUser("/settings");
  if (phrase.trim().toUpperCase() !== DELETE_PHRASE) return { error: `Scrivi ${DELETE_PHRASE} per confermare.` };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "Non sono riuscito a eliminare l'account. Riprova tra poco." };
  await supabase.auth.signOut().catch(() => {});
  redirect("/login");
}
