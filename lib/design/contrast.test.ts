import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseTokens } from "./contrast";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Blocco ${selector} non trovato`);
  const end = css.indexOf("\n}", start);
  return parseTokens(css.slice(start, end));
}

const themes = { light: block(":root"), dark: block(".dark") };

/** Testi usati sopra le superfici dell'app: devono superare AA (4,5:1). */
const TEXT_TOKENS = ["fg", "muted", "accent-text", "positive", "critical", "warning"];
const SURFACES = ["bg", "surface", "surface-2"];
const AA_TEXT = 4.5;
const AA_UI = 3;

describe.each(Object.entries(themes))("tema %s", (_name, t) => {
  it("definisce tutti i token di testo e superficie", () => {
    for (const token of [...TEXT_TOKENS, ...SURFACES, "accent", "accent-fg"]) {
      expect(t[token], token).toBeDefined();
    }
  });

  it.each(TEXT_TOKENS.flatMap((text) => SURFACES.map((surface) => [text, surface])))(
    "%s su %s supera WCAG AA",
    (text, surface) => {
      expect(contrastRatio(t[text], t[surface])).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );

  it.each(["accent", "positive", "critical", "warning"])("badge %s sul proprio fondo tenue supera AA", (tone) => {
    const text = tone === "accent" ? t["accent-text"] : t[tone];
    expect(contrastRatio(text, t[`${tone}-soft`])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("il testo dei pulsanti primari supera AA", () => {
    expect(contrastRatio(t["accent-fg"], t.accent)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("i colori delle materie si distinguono dalle card (3:1)", () => {
    for (let i = 1; i <= 8; i++) {
      expect(contrastRatio(t[`subject-${i}`], t.surface), `subject-${i}`).toBeGreaterThanOrEqual(AA_UI);
    }
  });
});

describe("contrastRatio", () => {
  it("bianco su nero vale 21:1", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21);
  });
});
