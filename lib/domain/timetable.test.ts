import { describe, expect, it } from "vitest";
import { type TimetableSlot, currentOrNext, isTime, slotsOfDay, trimTime, visibleWeekdays } from "./timetable";

const slot = (id: string, weekday: number, start: string, end: string): TimetableSlot => ({ id, weekday, start, end });
const slots = [slot("b", 1, "09:00", "10:00"), slot("a", 1, "08:00", "09:00"), slot("c", 2, "08:00", "09:00")];

describe("orario", () => {
  it("ordina le lezioni del giorno", () => {
    expect(slotsOfDay(slots, 1).map((s) => s.id)).toEqual(["a", "b"]);
    expect(slotsOfDay(slots, 3)).toEqual([]);
  });
  it("mostra il sabato solo se c'è lezione", () => {
    expect(visibleWeekdays(slots)).toEqual([1, 2, 3, 4, 5]);
    expect(visibleWeekdays([...slots, slot("s", 6, "08:00", "09:00")])).toHaveLength(6);
  });
  it("trova la lezione in corso o la prossima", () => {
    // 2026-11-23 è un lunedì
    expect(currentOrNext(slots, "2026-11-23", "08:30")).toMatchObject({ state: "now", slot: { id: "a" } });
    expect(currentOrNext(slots, "2026-11-23", "09:00")).toMatchObject({ state: "now", slot: { id: "b" } });
    expect(currentOrNext(slots, "2026-11-23", "07:00")).toMatchObject({ state: "next", slot: { id: "a" } });
    expect(currentOrNext(slots, "2026-11-23", "10:00")).toBeNull();
    expect(currentOrNext(slots, "2026-11-22", "08:30")).toBeNull(); // domenica
  });
  it("valida e normalizza gli orari", () => {
    expect(isTime("08:05")).toBe(true);
    expect(isTime("8:05")).toBe(false);
    expect(isTime("24:00")).toBe(false);
    expect(trimTime("08:05:00")).toBe("08:05");
  });
});
