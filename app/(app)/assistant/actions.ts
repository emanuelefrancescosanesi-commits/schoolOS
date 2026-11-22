"use server";

import { askAssistant, AssistantReplyError, AssistantUnavailableError } from "@/lib/assistant/chat";
import { ASSISTANT_DAILY_LIMIT, ASSISTANT_QUOTA_KIND, assistantAvailability, parseChat } from "@/lib/assistant/policy";
import { getCurrentUser, getProfile } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AskResult =
  | { ok: true; reply: string }
  | { ok: false; code: "invalid" | "session" | "unavailable" | "pro" | "limit" | "error"; error?: string };

/**
 * Una risposta dell'assistente. L'ordine dei controlli conta: prima ciò che non costa nulla
 * (forma del messaggio, sessione, flag, piano), poi la quota giornaliera, poi la chiamata al
 * modello. Al modello arriva solo la conversazione: nessun dato dello studente.
 */
export async function askAction(messages: unknown): Promise<AskResult> {
  const chat = parseChat(messages);
  if (!chat) return { ok: false, code: "invalid" };

  if (!isSupabaseConfigured()) return { ok: false, code: "unavailable" };
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "session" };

  if (assistantAvailability() !== "ready") return { ok: false, code: "unavailable" };
  const profile = await getProfile(user.id);
  if (profile?.plan !== "pro") return { ok: false, code: "pro" };

  const supabase = await createClient();
  const quota = await supabase.rpc("consume_ai_quota", { p_kind: ASSISTANT_QUOTA_KIND, p_limit: ASSISTANT_DAILY_LIMIT });
  if (quota.error) return { ok: false, code: "error" };
  if (!quota.data) return { ok: false, code: "limit" };

  try {
    return { ok: true, reply: await askAssistant(chat) };
  } catch (error) {
    if (error instanceof AssistantReplyError) return { ok: false, code: "error", error: error.message };
    if (error instanceof AssistantUnavailableError) return { ok: false, code: "unavailable" };
    console.error("[assistant] errore inatteso", error);
    return { ok: false, code: "error" };
  }
}
