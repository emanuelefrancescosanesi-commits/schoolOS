import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client, type QueryResultRow } from "pg";

/**
 * Crea un database usa-e-getta, applica lo stub di Supabase e tutte le migrazioni
 * in ordine, ed espone helper per eseguire query come un utente autenticato.
 */

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, "supabase/migrations");

export interface TestDb {
  /** Client con privilegi di amministratore (bypassa la RLS): solo per preparare i dati. */
  admin: Client;
  createUser(meta?: Record<string, unknown>): Promise<string>;
  /** Esegue `fn` in una transazione come ruolo `authenticated` con auth.uid() = userId. */
  asUser<T>(userId: string, fn: (q: Query) => Promise<T>): Promise<T>;
  asAnon<T>(fn: (q: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type Query = <R extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<{ rows: R[]; rowCount: number }>;

export async function createTestDb(baseUrl: string): Promise<TestDb> {
  const name = `schoolos_test_${process.pid}_${Date.now()}`;
  const server = new Client({ connectionString: baseUrl });
  await server.connect();
  await server.query(`create database ${name}`);

  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();

  await admin.query(readFileSync(join(ROOT, "tests/db/supabase-stub.sql"), "utf8"));
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await admin.query(readFileSync(join(MIGRATIONS, file), "utf8"));
    } catch (error) {
      throw new Error(`Migrazione ${file} fallita: ${(error as Error).message}`);
    }
  }

  const run = async <T>(setup: string[], fn: (q: Query) => Promise<T>): Promise<T> => {
    await admin.query("begin");
    try {
      for (const sql of setup) await admin.query(sql);
      const q: Query = async (sql, params) => {
        const res = await admin.query(sql, params);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      };
      const result = await fn(q);
      await admin.query("commit");
      return result;
    } catch (error) {
      await admin.query("rollback");
      throw error;
    }
  };

  return {
    admin,
    async createUser(meta = {}) {
      const res = await admin.query<{ id: string }>(
        "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [`${crypto.randomUUID()}@example.test`, meta],
      );
      return res.rows[0].id;
    },
    asUser(userId, fn) {
      if (!/^[0-9a-f-]{36}$/.test(userId)) throw new Error("userId non valido");
      return run(["set local role authenticated", `select set_config('request.jwt.claim.sub', '${userId}', true)`], fn);
    },
    asAnon(fn) {
      return run(["set local role anon"], fn);
    },
    async close() {
      await admin.end();
      await server.query(`drop database if exists ${name} with (force)`);
      await server.end();
    },
  };
}
