import { describe, expect, it } from "vitest";
import { taskInputSchema } from "./task";

describe("taskInputSchema", () => {
  const ok = { title: "  Esercizi pag. 40 ", kind: "homework", due_on: "2026-11-21" };
  it("accetta un compito valido e ripulisce il titolo", () => {
    const r = taskInputSchema.parse(ok);
    expect(r.title).toBe("Esercizi pag. 40");
    expect(r.subject_id).toBe("");
  });
  it("rifiuta titolo vuoto, data inesistente, tipo sconosciuto, durata assurda", () => {
    expect(taskInputSchema.safeParse({ ...ok, title: "  " }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...ok, due_on: "2026-02-31" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...ok, kind: "gita" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...ok, estimated_minutes: 5000 }).success).toBe(false);
  });
});
