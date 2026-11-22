import { describe, expect, it } from "vitest";
import { eventInputSchema } from "./event";
import { messageInputSchema } from "./message";

const base = { title: "Verifica di matematica", kind: "test", starts_on: "2026-12-01" };

describe("eventInputSchema", () => {
  it("accetta un evento minimo e normalizza i campi facoltativi", () => {
    const r = eventInputSchema.parse({ ...base, title: "  Verifica  " });
    expect(r).toMatchObject({ title: "Verifica", starts_at: "", subject_id: "", notes: "" });
  });
  it("accetta l'ora o il vuoto (tutto il giorno)", () => {
    expect(eventInputSchema.safeParse({ ...base, starts_at: "08:30" }).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...base, starts_at: "" }).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...base, starts_at: "25:00" }).success).toBe(false);
  });
  it("rifiuta titolo vuoto o lungo, tipo e data non validi", () => {
    expect(eventInputSchema.safeParse({ ...base, title: "   " }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, title: "x".repeat(141) }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, kind: "party" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, starts_on: "2026-13-40" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, starts_on: "" }).success).toBe(false);
  });
  it("limita le note a 500 caratteri", () => {
    expect(eventInputSchema.safeParse({ ...base, notes: "n".repeat(501) }).success).toBe(false);
  });
});

describe("messageInputSchema", () => {
  it("richiede solo l'oggetto", () => {
    expect(messageInputSchema.parse({ title: " Colloqui " })).toMatchObject({ title: "Colloqui", sender: "", body: "" });
    expect(messageInputSchema.safeParse({ title: "" }).success).toBe(false);
  });
  it("rispetta i limiti di lunghezza", () => {
    expect(messageInputSchema.safeParse({ title: "x".repeat(201) }).success).toBe(false);
    expect(messageInputSchema.safeParse({ title: "x", body: "a".repeat(4001) }).success).toBe(false);
    expect(messageInputSchema.safeParse({ title: "x", sender: "a".repeat(121) }).success).toBe(false);
  });
});
