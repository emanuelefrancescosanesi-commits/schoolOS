/** I codici dell'estensione scadono dopo 90 giorni senza uso (vedi sync_grades). */
export const CODE_IDLE_DAYS = 90;
export const CODE_WARN_DAYS = 14;

export type CodeStatus = { state: "active" } | { state: "expiring"; daysLeft: number } | { state: "expired" };

export function codeStatus(createdAt: string, lastUsedAt: string | null, now: Date = new Date()): CodeStatus {
  const last = new Date(lastUsedAt ?? createdAt).getTime();
  if (Number.isNaN(last)) return { state: "active" };
  const idleDays = (now.getTime() - last) / 86_400_000;
  if (idleDays >= CODE_IDLE_DAYS) return { state: "expired" };
  const daysLeft = Math.ceil(CODE_IDLE_DAYS - idleDays);
  return daysLeft <= CODE_WARN_DAYS ? { state: "expiring", daysLeft } : { state: "active" };
}
