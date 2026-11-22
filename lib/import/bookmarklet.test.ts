import { describe, expect, it, vi } from "vitest";
import { BOOKMARKLET_MAX_CHARS, buildBookmarklet, readImportHash } from "./bookmarklet";

/** Esegue il segnalibro come lo eseguirebbe il browser, con una pagina finta. */
function run(code: string, pageText: string, popupBlocked = false) {
  const open = vi.fn(() => (popupBlocked ? null : {}));
  const location = { href: "https://registro.example/voti" };
  const alert = vi.fn();
  const source = decodeURIComponent(code.replace(/^javascript:/, ""));
  new Function("document", "window", "location", "alert", source)({ body: { innerText: pageText } }, { open }, location, alert);
  return { open, location, alert };
}

describe("segnalibro", () => {
  const code = buildBookmarklet("https://schoolos.example/");

  it("è un indirizzo javascript: senza caratteri che rompono un preferito", () => {
    expect(code.startsWith("javascript:")).toBe(true);
    expect(code).not.toMatch(/[\s"<>]/);
  });

  it("apre SchoolOS con il testo nel frammento e il testo torna identico", () => {
    const page = "MATEMATICA\n14/10/2026  Scritto  7+  Equazioni è più 6½ — 😀";
    const { open } = run(code, page);
    const url = (open.mock.calls[0] as unknown as [string])[0];
    expect(url.startsWith("https://schoolos.example/grades#import=")).toBe(true);
    expect(readImportHash(url.slice(url.indexOf("#")))).toBe("MATEMATICA\n14/10/2026 Scritto 7+ Equazioni è più 6½ — 😀");
  });

  it("se il popup è bloccato naviga nella stessa scheda", () => {
    const { location } = run(code, "Matematica 14/10/2026 7", true);
    expect(location.href).toContain("https://schoolos.example/grades#import=");
  });

  it("avvisa se la pagina non ha testo", () => {
    const { open, alert } = run(code, "   ");
    expect(open).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });

  it("taglia le pagine enormi", () => {
    const { open } = run(code, "x".repeat(BOOKMARKLET_MAX_CHARS * 2));
    const url = (open.mock.calls[0] as unknown as [string])[0];
    expect(readImportHash(url.slice(url.indexOf("#")))?.length).toBe(BOOKMARKLET_MAX_CHARS);
  });
});

describe("readImportHash", () => {
  it("ignora indirizzi senza testo o malformati", () => {
    expect(readImportHash("")).toBeNull();
    expect(readImportHash("#altro=1")).toBeNull();
    expect(readImportHash("#import=")).toBeNull();
    expect(readImportHash("#import=%E0%A4%A")).toBeNull();
  });
});

describe("testo del segnalibro conservato durante il login", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { setItem: (k: string, v: string) => void m.set(k, v), getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k) };
  };
  it("lo tiene da parte e lo restituisce una sola volta", async () => {
    const { stashImportHash, takeStashedImport } = await import("@/lib/import/bookmarklet");
    const s = mem();
    expect(stashImportHash("#import=Matematica%0A29%2F09%2F2026%20Scritto%208", s)).toBe(true);
    expect(takeStashedImport(s)).toBe("Matematica\n29/09/2026 Scritto 8");
    expect(takeStashedImport(s)).toBeNull();
  });
  it("ignora frammenti che non sono del segnalibro", async () => {
    const { stashImportHash, takeStashedImport } = await import("@/lib/import/bookmarklet");
    const s = mem();
    expect(stashImportHash("#altro=1", s)).toBe(false);
    expect(stashImportHash("", s)).toBe(false);
    expect(takeStashedImport(s)).toBeNull();
  });
});
