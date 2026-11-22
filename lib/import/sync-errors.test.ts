import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// extension/sync-errors.js è uno script classico (importScripts): lo valutiamo come farebbe il browser.
const classify = new Function(`${readFileSync("extension/sync-errors.js", "utf8")}; return classifySyncError;`)() as (
  status: number,
  body: string,
) => { kind: string; action: string | null; text: string };

describe("classifySyncError", () => {
  it("codice non valido (28000) chiede di rifare il collegamento, qualunque sia lo status", () => {
    for (const status of [400, 401, 403]) {
      const r = classify(status, JSON.stringify({ code: "28000", message: "Codice non valido" }));
      expect(r).toMatchObject({ kind: "invalid", action: "relink" });
      expect(r.text).toMatch(/nuovo codice/);
    }
  });
  it("401/403 senza corpo leggibile è comunque un problema di codice", () => {
    expect(classify(403, "<html>").kind).toBe("invalid");
  });
  it("tetto righe", () => expect(classify(503, JSON.stringify({ code: "53400" })).kind).toBe("limit"));
  it("rete assente e server giù non chiedono azioni all'utente", () => {
    expect(classify(0, "")).toMatchObject({ kind: "network", action: "retry" });
    expect(classify(502, "")).toMatchObject({ kind: "server", action: "retry" });
    expect(classify(429, "")).toMatchObject({ kind: "busy", action: "retry" });
  });
  it("altro errore riporta lo status", () => expect(classify(404, "").text).toContain("404"));
});
