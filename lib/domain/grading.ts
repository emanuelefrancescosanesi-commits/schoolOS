/**
 * Scala di valutazione configurabile per studente.
 *
 * Ogni scuola usa convenzioni diverse: alcune ammettono il mezzo voto, altre
 * "+" e "−", altre entrambi. Il modello non assume nulla: legge la scala dal
 * profilo. Un "+" vale +0,25 e un "−" vale −0,25 (decisione del 19 nov 2026).
 */

export interface GradingScale {
  min: number;
  max: number;
  /** Ammette i mezzi voti (es. 6½). */
  allowHalf: boolean;
  /** Ammette "+" e "−" (±0,25). */
  allowPlusMinus: boolean;
  /** Soglia della sufficienza (es. 6). */
  passThreshold: number;
}

export const DEFAULT_SCALE: GradingScale = {
  min: 1,
  max: 10,
  allowHalf: true,
  allowPlusMinus: true,
  passThreshold: 6,
};

export const PLUS_MINUS_STEP = 0.25;

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "format" | "range" | "step" };

/** Il passo minimo tra due voti consentiti dalla scala. */
export function scaleStep(scale: GradingScale): number {
  if (scale.allowPlusMinus) return PLUS_MINUS_STEP;
  if (scale.allowHalf) return 0.5;
  return 1;
}

/** Vero se `value` è un voto ammesso dalla scala. */
export function isAllowedGrade(value: number, scale: GradingScale): boolean {
  if (!Number.isFinite(value) || value < scale.min || value > scale.max) return false;
  const fraction = round2(value - Math.floor(value));
  if (fraction === 0) return true;
  if (fraction === 0.5) return scale.allowHalf;
  if (fraction === 0.25 || fraction === 0.75) return scale.allowPlusMinus;
  return false;
}

/**
 * Interpreta un voto scritto come lo scriverebbe uno studente o un registro:
 * "7", "7.5", "7,5", "7½", "7 e mezzo", "7+", "7-", "7−", "8--" non è ammesso.
 */
export function parseGrade(input: string, scale: GradingScale = DEFAULT_SCALE): ParseResult {
  const raw = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (raw === "") return { ok: false, reason: "empty" };

  const normalized = raw
    .replace(/[−–]/g, "-")
    .replace(/\s*e mezzo$/, ".5")
    .replace(/½$/, ".5")
    .replace(",", ".");

  const match = /^(\d{1,2}(?:\.\d{1,2})?)\s*([+-])?$/.exec(normalized);
  if (!match) return { ok: false, reason: "format" };

  const base = Number(match[1]);
  const sign = match[2];

  if (sign) {
    // "+" e "−" si applicano solo a voti interi: "6.5+" non ha senso.
    if (!Number.isInteger(base)) return { ok: false, reason: "format" };
    if (!scale.allowPlusMinus) return { ok: false, reason: "step" };
  }

  const value = round2(base + (sign === "+" ? PLUS_MINUS_STEP : sign === "-" ? -PLUS_MINUS_STEP : 0));

  if (value < scale.min || value > scale.max) return { ok: false, reason: "range" };
  if (!isAllowedGrade(value, scale)) return { ok: false, reason: "step" };
  return { ok: true, value };
}

/**
 * Rappresentazione leggibile di un voto: 7 → "7", 7.25 → "7+", 7.5 → "7½",
 * 7.75 → "8−". Con `allowPlusMinus` falso, i quarti vengono mostrati in decimali.
 */
export function formatGrade(value: number, scale: GradingScale = DEFAULT_SCALE): string {
  const v = round2(value);
  const whole = Math.floor(v);
  const fraction = round2(v - whole);
  if (fraction === 0) return String(whole);
  if (fraction === 0.5) return `${whole}½`;
  if (scale.allowPlusMinus && fraction === 0.25) return `${whole}+`;
  if (scale.allowPlusMinus && fraction === 0.75) return `${whole + 1}−`;
  return formatAverage(v);
}

/** Medie con due decimali e virgola, come le scrive la scuola italiana. */
export function formatAverage(value: number, locale = "it-IT"): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export type GradeStanding = "positive" | "borderline" | "critical";

/**
 * Posizione rispetto alla sufficienza. "borderline" copre il mezzo punto sotto
 * la soglia, la zona in cui un solo voto cambia il quadro.
 */
export function gradeStanding(value: number, scale: GradingScale = DEFAULT_SCALE): GradeStanding {
  if (value >= scale.passThreshold) return "positive";
  if (value >= scale.passThreshold - 0.5) return "borderline";
  return "critical";
}

/** Arrotonda per eccesso al prossimo voto consentito dalla scala. */
export function ceilToStep(value: number, scale: GradingScale): number {
  const step = scaleStep(scale);
  return round2(Math.ceil(round2(value / step)) * step);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Quanti dei voti dati non sarebbero più ammessi da `scale` (es. dopo aver tolto i mezzi voti). */
export function countGradesOutsideScale(values: readonly number[], scale: GradingScale): number {
  return values.filter((v) => !isAllowedGrade(v, scale)).length;
}
