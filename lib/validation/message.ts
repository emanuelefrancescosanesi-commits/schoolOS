import { z } from "zod";

export const messageInputSchema = z.object({
  title: z.string().trim().min(1, "Scrivi l'oggetto").max(200, "Massimo 200 caratteri"),
  sender: z.string().trim().max(120, "Massimo 120 caratteri").optional().default(""),
  body: z.string().trim().max(4000, "Massimo 4000 caratteri").optional().default(""),
  subject_id: z.string().optional().default(""),
});
export type MessageInput = z.infer<typeof messageInputSchema>;
