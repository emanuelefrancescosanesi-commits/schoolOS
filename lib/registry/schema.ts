import { z } from "zod";

/** Un voto letto dal registro, come lo accetta `sync_my_grades`. */
export const registryGradeSchema = z.object({
  subject: z.string().trim().min(1).max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().min(0).max(10),
  kind: z.enum(["written", "oral", "practical"]),
  weight: z.number().gt(0).max(10).optional(),
});
export type RegistryGrade = z.infer<typeof registryGradeSchema>;

export const MAX_REGISTRY_ROWS = 300;
export const registryRowsSchema = z.array(registryGradeSchema).max(MAX_REGISTRY_ROWS);

/**
 * Messaggio dalla webview del registro. La pagina del registro può chiamare lo stesso ponte,
 * quindi è un input NON attendibile: si accetta solo questa forma.
 */
export const registryMessageSchema = z.object({
  source: z.literal("schoolos-registry"),
  v: z.literal(1),
  registry: z.string().max(40),
  state: z.enum(["rows", "login", "tile", "wait", "other", "blocked", "error"]),
  rows: z.array(z.unknown()).max(MAX_REGISTRY_ROWS).optional(),
  next: z.string().max(2000).optional(),
  hrefKind: z.string().max(20).optional(),
  via: z.string().max(10).optional(),
  path: z.string().max(300).optional(),
  origin: z.string().max(200).optional(),
});
export type RegistryMessage = z.infer<typeof registryMessageSchema>;

/** Regole di un registro (public/registry/rules.json). */
export interface RegistryRule {
  registry: string;
  label: string;
  enabled: boolean;
  hosts: string[];
  loginUrl: string;
  login?: { passwordField: string };
  home?: { tile: string; tileLabel: string; tileText: string };
  datasets: { grades: Record<string, unknown> };
}
export interface RegistryRules {
  version: number;
  registries: Record<string, RegistryRule>;
}

export function hostAllowed(hostname: string, hosts: string[]): boolean {
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

export function urlAllowed(url: string, hosts: string[]): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && hostAllowed(u.hostname, hosts);
  } catch {
    return false;
  }
}
