import "server-only";
import { connection } from "next/server";
import { buildDemoDataset } from "@/lib/demo/dataset";
import { type DateKey, dateKeyInTimeZone, hourInTimeZone } from "@/lib/domain/dates";
import type { SchoolData } from "@/lib/domain/model";

/**
 * Punto unico di accesso ai dati dello studente. Oggi restituisce il dataset
 * demo; nella Fase 3 leggerà da Supabase l'utente autenticato (sotto RLS),
 * senza cambiare chi lo chiama.
 */
export const DATA_MODE: "demo" | "live" = "demo";

/** Fuso usato finché non c'è un profilo: l'app è pensata per l'Italia. */
export const DEFAULT_TIME_ZONE = "Europe/Rome";

export interface SchoolContext {
  data: SchoolData;
  today: DateKey;
  hour: number;
}

export async function getSchoolContext(): Promise<SchoolContext> {
  // I dati dipendono dall'ora e (dalla Fase 3) dall'utente: sempre a richiesta, mai prerenderizzati.
  await connection();
  const now = new Date();
  const today = dateKeyInTimeZone(now, DEFAULT_TIME_ZONE);
  const data = buildDemoDataset(today);
  // Il giorno "di oggi" segue il fuso del profilo, non quello del server.
  const tz = data.profile.timeZone;
  return { data, today: dateKeyInTimeZone(now, tz), hour: hourInTimeZone(now, tz) };
}
