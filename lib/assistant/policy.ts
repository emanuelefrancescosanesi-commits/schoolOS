import { z } from "zod";

/** Risposte dell'assistente al giorno per studente (applicato dal database: consume_ai_quota). */
export const ASSISTANT_DAILY_LIMIT = 30;
export const ASSISTANT_QUOTA_KIND = "assistant";
export const MAX_MESSAGE_CHARS = 500;
/** Messaggi precedenti inviati al modello: la conversazione è breve per costruzione. */
export const MAX_HISTORY_MESSAGES = 6;
export const MAX_REPLY_TOKENS = 300;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const chatSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }))
  .min(1)
  .max(MAX_HISTORY_MESSAGES + 1);

/**
 * Non si fida del client: forma, lunghezza e alternanza. L'ultimo messaggio deve essere
 * dello studente e i ruoli devono alternarsi (richiesto dall'API e utile contro messaggi
 * "assistant" inventati per pilotare il modello).
 */
export function parseChat(input: unknown): ChatMessage[] | null {
  const parsed = chatSchema.safeParse(input);
  if (!parsed.success) return null;
  const list = parsed.data;
  if (list[list.length - 1].role !== "user") return null;
  for (let i = 1; i < list.length; i++) if (list[i].role === list[i - 1].role) return null;
  return list;
}

export type AssistantAvailability = "off" | "ready";

/** Spento di default: serve ASSISTANT_AI_ENABLED=true e la chiave API (solo lato server). */
export function assistantAvailability(env: Record<string, string | undefined> = process.env): AssistantAvailability {
  return env.ASSISTANT_AI_ENABLED === "true" && !!env.ANTHROPIC_API_KEY ? "ready" : "off";
}
