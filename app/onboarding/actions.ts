"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { firstIssue, onboardingSchema, toOnboardingPayload } from "@/lib/validation/onboarding";

export interface OnboardingResult {
  error?: string;
  demo?: boolean;
}

/** Salva l'onboarding in modo atomico tramite public.complete_onboarding. */
export async function completeOnboarding(input: unknown): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (!isSupabaseConfigured()) return { demo: true };

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", { payload: toOnboardingPayload(parsed.data) });

  if (error) {
    if (error.message.includes("già completato")) redirect("/dashboard");
    if (error.message.includes("subjects_unique_name")) return { error: "Ci sono materie ripetute." };
    if (error.message.includes("esce dall")) return { error: error.message };
    return { error: "Non siamo riusciti a salvare la configurazione. Riprova." };
  }
  redirect("/dashboard");
}
