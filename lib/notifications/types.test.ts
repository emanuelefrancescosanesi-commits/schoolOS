import { describe, expect, it } from "vitest";
import { badgeLabel, countUnread } from "./types";

describe("contatore notifiche", () => {
  it("conta solo i promemoria non letti", () => {
    expect(countUnread(["a", "b", "c"], new Set(["b"]))).toBe(2);
    expect(countUnread([], new Set(["b"]))).toBe(0);
    expect(countUnread(["a"], new Set(["x"]))).toBe(1);
  });
  it("abbrevia oltre 9", () => {
    expect(badgeLabel(3)).toBe("3");
    expect(badgeLabel(9)).toBe("9");
    expect(badgeLabel(10)).toBe("9+");
  });
});
