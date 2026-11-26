import { describe, expect, it } from "vitest";
import { diffImported } from "./sync";
import type { ImportedEvent } from "./ical";

const ev = (id: string, over: Partial<ImportedEvent> = {}): ImportedEvent => ({ externalId: id, title: "T", date: "2026-12-01", kind: "event", ...over });
const row = (id: string, ext: string, over = {}) => ({ id, external_id: ext, title: "T", kind: "event", starts_on: "2026-12-01", starts_at: null, notes: null, ...over });

describe("diffImported", () => {
  it("separa nuovi, modificati e spariti", () => {
    const d = diffImported([row("1", "a"), row("2", "b"), row("3", "c")], [ev("a"), ev("b", { title: "Cambiato" }), ev("d")]);
    expect(d.toInsert.map((e) => e.externalId)).toEqual(["d"]);
    expect(d.toUpdate.map((u) => u.id)).toEqual(["2"]);
    expect(d.toDelete).toEqual(["3"]);
  });
  it("un evento uguale non genera scritture (anche con ora HH:MM:SS dal database)", () => {
    const d = diffImported([row("1", "a", { starts_at: "08:30:00" })], [ev("a", { time: "08:30" })]);
    expect(d).toEqual({ toInsert: [], toUpdate: [], toDelete: [] });
  });
  it("rileva spostamento di data e di ora", () => {
    expect(diffImported([row("1", "a")], [ev("a", { date: "2026-12-02" })]).toUpdate).toHaveLength(1);
    expect(diffImported([row("1", "a")], [ev("a", { time: "09:00" })]).toUpdate).toHaveLength(1);
  });
  it("con calendario vuoto elimina tutto", () => {
    expect(diffImported([row("1", "a")], []).toDelete).toEqual(["1"]);
  });
});
