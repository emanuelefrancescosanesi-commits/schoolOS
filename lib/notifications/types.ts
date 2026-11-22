import type { ReminderType } from "@/lib/domain/reminders";

/** Un promemoria pronto per il client: solo dati serializzabili. */
export interface ReminderView {
  id: string;
  type: ReminderType;
  /** Giorni a scadenza: negativo = scaduto. */
  days: number;
  title: string;
  /** Chiave del tipo di impegno (compito, verifica, interrogazione…), per l'etichetta. */
  kind: string;
  subjectName: string | null;
  due: string;
}

export interface NotificationState {
  reminders: ReminderView[];
  /** Id dei promemoria attuali già segnati come letti. */
  readIds: string[];
  /** Tutte le categorie di promemoria sono spente nelle Impostazioni. */
  allOff: boolean;
}

/** Quanti promemoria non sono ancora stati letti. */
export function countUnread(ids: readonly string[], read: ReadonlySet<string>): number {
  let n = 0;
  for (const id of ids) if (!read.has(id)) n++;
  return n;
}

/** Testo breve per il contatore: oltre 9 si scrive "9+" per non rompere il layout. */
export function badgeLabel(n: number): string {
  return n > 9 ? "9+" : String(n);
}
