import { z } from "zod";
import { isTime } from "@/lib/domain/timetable";

export const slotInputSchema = z
  .object({
    weekday: z.coerce.number().int().min(1).max(6),
    starts_at: z.string().refine(isTime, "Ora di inizio non valida"),
    ends_at: z.string().refine(isTime, "Ora di fine non valida"),
    subject_id: z.string().optional().default(""),
    room: z.string().trim().max(40, "Massimo 40 caratteri").optional().default(""),
  })
  .refine((v) => v.ends_at > v.starts_at, { path: ["ends_at"], message: "La fine deve essere dopo l'inizio" });
export type SlotInput = z.infer<typeof slotInputSchema>;
