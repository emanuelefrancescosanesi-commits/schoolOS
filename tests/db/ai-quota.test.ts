import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb } from "./harness";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("quota AI", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  const consume = (user: string, kind = "grade_import", limit = 3) =>
    db.asUser(user, async (q) => {
      const res = await q<{ ok: boolean }>("select public.consume_ai_quota($1, $2) as ok", [kind, limit]);
      return res.rows[0].ok;
    });

  it("concede esattamente il tetto e poi rifiuta", async () => {
    expect(await consume(alice)).toBe(true);
    expect(await consume(alice)).toBe(true);
    expect(await consume(alice)).toBe(true);
    expect(await consume(alice)).toBe(false);
    expect(await consume(alice)).toBe(false);
  });

  it("il tetto è per utente e per tipo di funzione", async () => {
    expect(await consume(bob)).toBe(true);
    expect(await consume(alice, "chat")).toBe(true);
  });

  it("richieste parallele non superano il tetto", async () => {
    const carol = await db.createUser();
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await consume(carol, "burst", 2));
    expect(results.filter(Boolean)).toHaveLength(2);
  });

  it("il client non può leggere né modificare il contatore", async () => {
    await expect(db.asUser(alice, (q) => q("select * from public.ai_usage"))).rejects.toThrow(/permission denied/);
    await expect(
      db.asUser(alice, (q) => q("update public.ai_usage set used = 0")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.asUser(alice, (q) => q("insert into public.ai_usage (user_id, day, kind) values ($1, current_date, 'x')", [alice])),
    ).rejects.toThrow(/permission denied/);
  });

  it("rifiuta limiti assurdi e gli anonimi", async () => {
    await expect(consume(alice, "grade_import", 0)).rejects.toThrow(/Limite non valido/);
    await expect(consume(alice, "grade_import", 100000)).rejects.toThrow(/Limite non valido/);
    await expect(
      db.asAnon((q) => q("select public.consume_ai_quota('grade_import', 3)")),
    ).rejects.toThrow(/permission denied/);
  });

  it("eliminare l'utente cancella il suo contatore", async () => {
    await db.admin.query("delete from auth.users where id = $1", [alice]);
    const res = await db.admin.query("select 1 from public.ai_usage where user_id = $1", [alice]);
    expect(res.rowCount).toBe(0);
  });
});
