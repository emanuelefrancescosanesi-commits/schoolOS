import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it.each([
    ["/grades", "/grades"],
    ["/grades?period=p1", "/grades?period=p1"],
    ["  /tasks  ", "/tasks"],
  ])("accetta il percorso interno %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["https://evil.example"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["%2F%2Fevil.example"],
    ["/%2F/evil.example"],
    ["javascript:alert(1)"],
    ["/ok\nSet-Cookie: x"],
    ["/login"],
    ["/login?next=/x"],
    ["/auth/callback"],
  ])("ripiega sulla Dashboard per %s", (input) => {
    expect(safeNextPath(input)).toBe("/dashboard");
  });
});
