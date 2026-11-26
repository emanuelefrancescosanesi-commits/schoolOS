"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "./errors";
import { siteOrigin } from "./site-origin";
import { safeNextPath } from "./redirect";

export interface AuthFormState {
  error?: string;
  /** Messaggio di successo che non porta a un redirect (es. "controlla la tua email"). */
  notice?: string;
  /** Il login è fallito perché l'email non è ancora confermata: mostra «Rimanda il link». */
  needsConfirmation?: boolean;
  fields?: { email?: string; first_name?: string };
}

const email = z.string().trim().toLowerCase().email("Indirizzo email non valido");
const password = z
  .string()
  .min(8, "La password deve avere almeno 8 caratteri")
  .max(72, "La password può avere al massimo 72 caratteri");

const NOT_CONFIGURED: AuthFormState = {
  error: "L'accesso non è ancora attivo: Supabase non è configurato. Puoi esplorare l'app in modalità demo.",
};

export async function signInWithPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z.object({ email, password: z.string().min(1, "Scrivi la password") }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const fields = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), needsConfirmation: error.code === "email_not_confirmed", fields };

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const fields = { email: String(formData.get("email") ?? ""), first_name: String(formData.get("first_name") ?? "") };
  const parsed = z
    .object({
      first_name: z.string().trim().min(1, "Scrivi il tuo nome").max(60),
      email,
      password,
      consent: z.literal("on", { error: "Per creare l'account devi accettare l'informativa sulla privacy" }),
    })
    .safeParse({
      first_name: formData.get("first_name"),
      email: formData.get("email"),
      password: formData.get("password"),
      consent: formData.get("consent"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { first_name: parsed.data.first_name },
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/onboarding`,
    },
  });
  if (error) return { error: authErrorMessage(error), fields };

  // Con la conferma email attiva, Supabase non apre subito una sessione.
  if (!data.session) {
    return { notice: `Ti abbiamo mandato un'email a ${parsed.data.email}. Apri il link per attivare l'account.` };
  }
  redirect("/onboarding");
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) redirect("/login?error=not_configured");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

/** Rimanda l'email di conferma (utile quando il primo link è scaduto o finito in spam). */
export async function resendConfirmation(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/onboarding` },
  });
  if (error) return { error: authErrorMessage(error) };
  return { notice: `Email rimandata a ${parsed.data}. Controlla anche la cartella spam.` };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });
  // Stesso messaggio che l'account esista o no: non riveliamo quali email sono registrate.
  if (error && error.code?.startsWith("over_")) return { error: authErrorMessage(error) };
  return { notice: "Se l'indirizzo è registrato, riceverai un'email con il link per scegliere una nuova password." };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Le due password non coincidono" })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorMessage(error) };
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
