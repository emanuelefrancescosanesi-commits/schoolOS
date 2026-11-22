import { describe, expect, it } from "vitest";
import { codeStatus } from "./extension-codes";

const now = new Date("2026-11-22T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

describe("codeStatus", () => {
  it("codice usato di recente è attivo", () => expect(codeStatus(daysAgo(200), daysAgo(2), now)).toEqual({ state: "active" }));
  it("mai usato conta dalla creazione", () => expect(codeStatus(daysAgo(10), null, now)).toEqual({ state: "active" }));
  it("in scadenza negli ultimi 14 giorni", () => expect(codeStatus(daysAgo(100), daysAgo(80), now)).toEqual({ state: "expiring", daysLeft: 10 }));
  it("scaduto dopo 90 giorni di inattività", () => {
    expect(codeStatus(daysAgo(100), daysAgo(90), now)).toEqual({ state: "expired" });
    expect(codeStatus(daysAgo(120), null, now)).toEqual({ state: "expired" });
  });
});
