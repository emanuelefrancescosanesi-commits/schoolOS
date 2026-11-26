"use server";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { authErrorMessage } from "@/lib/auth/errors";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { siteOrigin } from "@/lib/auth/site-origin";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { changeEmailSchema, changePasswordSchema } from "@/lib/validation/account";
import { firstIssue } from "@/lib/validation/onboarding";

export type AccountResult = { ok: true; notice?: string } | { ok: false; error: string };

const DEMO: AccountResult = { ok: false, error: "Non disponibile in modalità demo." };
const WRONG_PASSWORD: AccountResult = { ok: false, error: "La password attuale non è corretta." };
const TOO_MANY: AccountResult = { ok: false, error: "Troppi tentativi. Riprova tra qualche minuto." };

// 5 verifiche della password attuale ogni 10 minuti per utente (best effort, vedi rate-limit.ts).
const passwordChecks = createRateLimiter(5, 10 * 60_000);

/** Chi è entrato solo con Google non ha una password da verificare. */
function hasPassword(user: User): boolean {
  return (user.identities ?? []).some((i) => i.provider === "email");
}

/** Riconferma l'identità con la password attuale prima di un'operazione sensibile. */
async function verifyCurrentPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  current: string,
): Promise<AccountResult | null> {
  if (!hasPassword(user)) return null;
  if (!current) return { ok: false, error: "Scrivi la password attuale." };
  if (!passwordChecks.attempt(user.id)) return TOO_MANY;
  const { error } = await supabase.auth.signInWithPassword({ email: user.email ?? "", password: current });
  if (error) return error.code === "invalid_credentials" ? WRONG_PASSWORD : { ok: false, error: authErrorMessage(error) };
  passwordChecks.reset(user.id);
  return null;
}

async function currentAuthUser() {
  await requireUser("/settings");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login?next=%2Fsettings");
  return { supabase, user: data.user };
}

/** Cambia la password (chiede quella attuale) ed esce dagli altri dispositivi. */
export async function changePassword(input: unknown): Promise<AccountResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!isSupabaseConfigured()) return DEMO;
  const { supabase, user } = await currentAuthUser();

  const denied = await verifyCurrentPassword(supabase, user, parsed.data.current);
  if (denied) return denied;
  if (parsed.data.current && parsed.data.current === parsed.data.password) {
    return { ok: false, error: "La nuova password deve essere diversa da quella attuale." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: authErrorMessage(error) };
  // Se la password era compromessa, chi la usava altrove viene fatto uscire.
  await supabase.auth.signOut({ scope: "others" }).catch(() => {});
  return { ok: true, notice: "Password cambiata. Sugli altri dispositivi dovrai accedere di nuovo." };
}

/**
 * Chiede il cambio email: Supabase manda un link di conferma (anche al vecchio indirizzo,
 * se «Secure email change» è attivo) e l'email cambia solo dopo il click.
 * La risposta è identica che l'indirizzo sia libero o già registrato: nessuna enumerazione.
 */
export async function changeEmail(input: unknown): Promise<AccountResult> {
  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  if (!isSupabaseConfigured()) return DEMO;
  const { supabase, user } = await currentAuthUser();

  if (parsed.data.email === user.email?.toLowerCase()) {
    return { ok: false, error: "Questa è già la tua email attuale." };
  }
  const denied = await verifyCurrentPassword(supabase, user, parsed.data.current);
  if (denied) return denied;

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/settings` },
  );
  // email_exists: stessa risposta del successo, per non rivelare quali indirizzi sono registrati.
  if (error && error.code !== "email_exists") return { ok: false, error: authErrorMessage(error) };
  return {
    ok: true,
    notice: `Se l'indirizzo è valido, ti abbiamo mandato un link di conferma a ${parsed.data.email}. L'email cambia solo dopo aver aperto il link (controlla anche lo spam).`,
  };
}

/** Esce da tutti i dispositivi, compreso questo. */
export async function signOutEverywhere(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "global" }).catch(() => {});
  }
  redirect("/login");
}
