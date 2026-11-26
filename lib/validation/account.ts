import { z } from "zod";

/** Regole della password: le stesse della registrazione e del recupero. */
export const newPasswordSchema = z
  .string()
  .min(8, "La password deve avere almeno 8 caratteri")
  .max(72, "La password può avere al massimo 72 caratteri");

export const changePasswordSchema = z
  .object({
    /** Vuota solo per chi è entrato con Google e non ha ancora una password. */
    current: z.string().max(200),
    password: newPasswordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Le due password non coincidono", path: ["confirm"] });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const changeEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Indirizzo email non valido").max(254, "Indirizzo email non valido"),
  /** Vuota solo per chi è entrato con Google e non ha una password. */
  current: z.string().max(200),
});
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
