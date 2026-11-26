import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("blocca dopo il massimo e riapre a finestra scaduta", () => {
    let t = 0;
    const rl = createRateLimiter(3, 1000, () => t);
    expect([rl.attempt("a"), rl.attempt("a"), rl.attempt("a"), rl.attempt("a")]).toEqual([true, true, true, false]);
    expect(rl.attempt("b")).toBe(true);
    t = 1001;
    expect(rl.attempt("a")).toBe(true);
  });
  it("reset azzera la chiave", () => {
    const rl = createRateLimiter(1, 1000, () => 0);
    rl.attempt("a");
    expect(rl.attempt("a")).toBe(false);
    rl.reset("a");
    expect(rl.attempt("a")).toBe(true);
  });
});
