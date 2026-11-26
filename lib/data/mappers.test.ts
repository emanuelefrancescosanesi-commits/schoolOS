import { describe, expect, it } from "vitest";
import { eventFromRow, messageFromRow } from "./mappers";

describe("eventFromRow", () => {
  it("converte l'ora in HH:MM e i null in undefined", () => {
    const e = eventFromRow({ id: "1", user_id: "u", subject_id: null, title: "T", kind: "test", starts_on: "2026-12-01", starts_at: "08:30:00", notes: null, feed_id: null, external_id: null, created_at: "", updated_at: "" });
    expect(e).toEqual({ id: "1", title: "T", date: "2026-12-01", time: "08:30", kind: "test", subjectId: undefined, notes: undefined });
  });
  it("evento senza ora = tutto il giorno", () => {
    const e = eventFromRow({ id: "1", user_id: "u", subject_id: "s", title: "T", kind: "event", starts_on: "2026-12-01", starts_at: null, notes: "n", feed_id: null, external_id: null, created_at: "", updated_at: "" });
    expect(e.time).toBeUndefined();
    expect(e).toMatchObject({ subjectId: "s", notes: "n" });
  });
});

describe("messageFromRow", () => {
  const row = { id: "m", user_id: "u", subject_id: null, source: "manual" as const, sender: "Segreteria", title: "Colloqui", body: "Riga uno\n\nriga   due", received_at: "2026-11-30T23:30:00Z", is_read: false, created_at: "" };
  it("calcola data e ora nel fuso dello studente (a cavallo di mezzanotte)", () => {
    const m = messageFromRow(row, "Europe/Rome");
    expect(m).toMatchObject({ date: "2026-12-01", time: "00:30", unread: true, from: "Segreteria", subject: "Colloqui" });
    expect(messageFromRow(row, "UTC")).toMatchObject({ date: "2026-11-30", time: "23:30" });
  });
  it("l'anteprima è il testo su una riga, il corpo resta intero", () => {
    const m = messageFromRow({ ...row, body: `${"a".repeat(300)}` }, "UTC");
    expect(m.preview).toHaveLength(140);
    expect(m.body).toHaveLength(300);
    expect(messageFromRow(row, "UTC").preview).toBe("Riga uno riga due");
  });
  it("una comunicazione letta non è «unread»", () => {
    expect(messageFromRow({ ...row, is_read: true }, "UTC").unread).toBe(false);
  });
});

describe("eventFromRow: eventi importati", () => {
  it("un evento con feed_id è importato (sola lettura)", () => {
    const e = eventFromRow({ id: "1", user_id: "u", subject_id: null, title: "T", kind: "event", starts_on: "2026-12-01", starts_at: null, notes: null, feed_id: "f", external_id: "x", created_at: "", updated_at: "" });
    expect(e.imported).toBe(true);
  });
});
