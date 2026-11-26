import { describe, expect, it } from "vitest";
import { changeEmailSchema, changePasswordSchema } from "./account";

describe("changePasswordSchema", () => {
  const ok = { current: "vecchia", password: "nuova-password", confirm: "nuova-password" };
  it("accetta dati validi", () => expect(changePasswordSchema.safeParse(ok).success).toBe(true));
  it("rifiuta password corta", () => expect(changePasswordSchema.safeParse({ ...ok, password: "corta", confirm: "corta" }).success).toBe(false));
  it("rifiuta password oltre 72 caratteri", () => {
    const p = "a".repeat(73);
    expect(changePasswordSchema.safeParse({ ...ok, password: p, confirm: p }).success).toBe(false);
  });
  it("rifiuta conferma diversa", () => {
    const r = changePasswordSchema.safeParse({ ...ok, confirm: "altra-password" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Le due password non coincidono");
  });
});

describe("changeEmailSchema", () => {
  it("normalizza l'email", () => {
    const r = changeEmailSchema.parse({ email: "  Nome@Example.COM ", current: "x" });
    expect(r.email).toBe("nome@example.com");
  });
  it("rifiuta email non valida", () => expect(changeEmailSchema.safeParse({ email: "no", current: "" }).success).toBe(false));
});
