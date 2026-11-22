import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { matchSubject, subjectKey } from "@/lib/import/normalize";

/**
 * Il confronto dei nomi delle materie esiste due volte: in TypeScript (anteprima import) e in SQL
 * (sincronizzazione automatica). Qui la funzione SQL vera gira su un Postgres in memoria e deve
 * dare lo stesso risultato del TypeScript (senza il livello «fuzzy», che in SQL non esiste).
 */

const USER = "00000000-0000-0000-0000-000000000001";
const YEAR = "00000000-0000-0000-0000-0000000000a1";
const OLD_YEAR = "00000000-0000-0000-0000-0000000000a0";

const NAMES = [
  "Matematica",
  "Italiano",
  "Inglese",
  "Storia",
  "Disegno e storia dell'arte",
  "Scienze motorie e sportive",
  "Scienze naturali",
  "Religione",
  "Educazione civica",
];

const GUESSES = [
  "MATEMATICA", "matematica ", "Mat.", "Ital", "Italiano", "Lingua e letteratura italiana", "Lingua inglese",
  "Lingua e cultura straniera (Inglese)", "Disegno e Storia dell’Arte", "Storia dell'arte", "STORIA DELL’ARTE", "Storia dell arte",
  "Disegno e storia dell arte", "Storia dell'Arte e Disegno", "Storia", "Stor", "Scienze", "Scienze motorie",
  "Ed. fisica", "Educazione fisica", "Ed Fisica", "Scienze motorie e sportive", "IRC", "Religione cattolica",
  "Insegnamento religione cattolica", "Ed. civica", "Educazione civica", "Cittadinanza e Costituzione", "Chimica", "Fisica", "  ", "e di",
];

const SCHEMA = `
  create role anon; create role authenticated;
  create table public.school_years (id uuid primary key, user_id uuid not null, starts_on date not null);
  create table public.subjects (id uuid primary key default gen_random_uuid(), user_id uuid not null, school_year_id uuid not null, name text not null, position int not null default 0);
`;

describe("match_subject (SQL) = matchSubject (TypeScript)", () => {
  let db: PGlite;
  const ids = new Map<string, string>();

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SCHEMA);
    const migration = readFileSync("supabase/migrations/20261122110000_match_materie.sql", "utf8");
    // Ci servono solo le tre funzioni di abbinamento, non il resto della sincronizzazione.
    const cut = migration.indexOf("create or replace function public.sync_grades_for");
    await db.exec(migration.slice(0, cut));
    await db.query("insert into public.school_years values ($1,$2,'2025-09-15'),($3,$2,'2026-09-14')", [OLD_YEAR, USER, YEAR]);
    for (const [i, name] of NAMES.entries()) {
      const r = await db.query<{ id: string }>(
        "insert into public.subjects (user_id, school_year_id, name, position) values ($1,$2,$3,$4) returning id",
        [USER, YEAR, name, i],
      );
      ids.set(r.rows[0].id, name);
    }
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  const sqlMatch = async (guess: string) => {
    const r = await db.query<{ id: string | null }>("select public.match_subject($1, $2) as id", [USER, guess]);
    return r.rows[0].id ? ids.get(r.rows[0].id) ?? null : null;
  };
  const subjects = () => [...ids].map(([id, name]) => ({ id, name }));

  it("la chiave canonica coincide", async () => {
    for (const name of [...NAMES, ...GUESSES]) {
      const r = await db.query<{ k: string }>("select public.subject_key($1) as k", [name]);
      expect(r.rows[0].k, name).toBe(subjectKey(name));
    }
  });

  it("stessi risultati su tutti i casi (senza fuzzy)", async () => {
    for (const guess of GUESSES) {
      const ts = matchSubject(guess, subjects(), { fuzzy: false })?.name ?? null;
      expect(await sqlMatch(guess), guess).toBe(ts);
    }
  });

  it("casi chiave", async () => {
    expect(await sqlMatch("Storia dell'arte")).toBe("Disegno e storia dell'arte");
    expect(await sqlMatch("Ed. fisica")).toBe("Scienze motorie e sportive");
    expect(await sqlMatch("Lingua e letteratura italiana")).toBe("Italiano");
    expect(await sqlMatch("IRC")).toBe("Religione");
    expect(await sqlMatch("Storia")).toBe("Storia");
    expect(await sqlMatch("Chimica")).toBeNull();
    expect(await sqlMatch("Scienze")).toBeNull();
  });

  it("la stessa materia dell'anno scorso si trova ancora, quella più recente ha la precedenza", async () => {
    const old = await db.query<{ id: string }>(
      "insert into public.subjects (user_id, school_year_id, name) values ($1,$2,'Latino') returning id",
      [USER, OLD_YEAR],
    );
    const r = await db.query<{ id: string }>("select public.match_subject($1, 'latino') as id", [USER]);
    expect(r.rows[0].id).toBe(old.rows[0].id);
  });
});
