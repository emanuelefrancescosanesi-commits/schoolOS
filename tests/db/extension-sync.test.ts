import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb } from "./harness";

const url = process.env.TEST_DATABASE_URL;

const payload = {
  profile: {
    first_name: "Sara", school_name: "", class_name: "", registro: "axios", period_scheme: "trimestre-pentamestre",
    grade_min: 1, grade_max: 10, allow_half: true, allow_plus_minus: true, pass_threshold: 6, average_method: "weighted",
  },
  school_year: { label: "2026/27", starts_on: "2026-09-14", ends_on: "2027-06-10" },
  periods: [{ name: "Trimestre", starts_on: "2026-09-14", ends_on: "2026-12-22" }],
  subjects: [{ name: "Matematica", color: 1 }, { name: "Scienze motorie", color: 2 }],
};

describe.skipIf(!url)("sincronizzazione dall'estensione", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let token: string;

  const sync = (t: string, rows: unknown) =>
    db.asAnon(async (q) => (await q<{ r: Record<string, unknown> }>("select public.sync_grades($1, $2) as r", [t, JSON.stringify(rows)])).rows[0].r);

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
    await db.asUser(alice, (q) => q("select public.complete_onboarding($1)", [payload]));
    await db.asUser(bob, (q) => q("select public.complete_onboarding($1)", [payload]));
    token = await db.asUser(alice, async (q) => (await q<{ t: string }>("select public.create_extension_token('Chrome') as t")).rows[0].t);
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  it("il codice ha il formato atteso e nel database c'è solo l'hash", async () => {
    expect(token).toMatch(/^sos_[0-9a-f]{64}$/);
    const rows = await db.admin.query("select token_hash from public.extension_tokens");
    expect(rows.rows.some((r) => Buffer.from(r.token_hash).toString("utf8").includes(token))).toBe(false);
  });

  it("inserisce i voti, salta i duplicati e segnala materie sconosciute e voti non validi", async () => {
    const rows = [
      { subject: "MATEMATICA", value: 8, kind: "written", date: "2026-10-27" },
      { subject: "Scienze motorie", value: 9.5, kind: "practical", date: "2026-10-14" },
      { subject: "Scienze motorie", value: 8, kind: "practical", date: "2026-10-14" },
      { subject: "Fisica", value: 4, kind: "written", date: "2026-10-19" },
      { subject: "Matematica", value: 6.3, kind: "written", date: "2026-10-20" },
      { subject: "Matematica", value: 7, kind: "written", date: "2999-01-01" },
    ];
    expect(await sync(token, rows)).toEqual({ inserted: 3, skipped: 0, invalid: 2, unmatched: ["Fisica"] });
    expect(await sync(token, rows)).toMatchObject({ inserted: 0, skipped: 3, invalid: 2 });
    const n = await db.admin.query("select count(*)::int as n from public.grades where user_id = $1", [alice]);
    expect(n.rows[0].n).toBe(3);
  });

  it("i voti vanno solo all'utente del codice", async () => {
    const n = await db.admin.query("select count(*)::int as n from public.grades where user_id = $1", [bob]);
    expect(n.rows[0].n).toBe(0);
  });

  it("rifiuta codici sbagliati, malformati o revocati", async () => {
    await expect(sync("sos_" + "0".repeat(64), [])).rejects.toThrow(/Codice non valido/);
    await expect(sync("x", [])).rejects.toThrow(/Codice non valido/);
    await expect(sync(null as unknown as string, [])).rejects.toThrow(/Codice non valido/);
    await db.asUser(alice, (q) => q("delete from public.extension_tokens"));
    await expect(sync(token, [])).rejects.toThrow(/Codice non valido/);
  });

  it("rifiuta troppe righe e dati non array", async () => {
    const t = await db.asUser(bob, async (q) => (await q<{ t: string }>("select public.create_extension_token() as t")).rows[0].t);
    await expect(sync(t, Array.from({ length: 301 }, () => ({})))).rejects.toThrow(/Dati non validi/);
    await expect(sync(t, { a: 1 })).rejects.toThrow(/Dati non validi/);
  });

  it("il client non legge l'hash né i codici altrui e non crea codici a mano", async () => {
    await expect(db.asUser(bob, (q) => q("select token_hash from public.extension_tokens"))).rejects.toThrow(/permission denied/);
    const own = await db.asUser(bob, (q) => q("select id, label from public.extension_tokens"));
    expect(own.rows).toHaveLength(1);
    await expect(
      db.asUser(bob, (q) => q("insert into public.extension_tokens (user_id, token_hash) values ($1, 'x')", [bob])),
    ).rejects.toThrow(/permission denied/);
    await expect(db.asAnon((q) => q("select public.create_extension_token()"))).rejects.toThrow(/permission denied|Accesso richiesto/);
  });

  it("massimo 5 codici attivi", async () => {
    const carol = await db.createUser();
    await db.asUser(carol, (q) => q("select public.complete_onboarding($1)", [payload]));
    for (let i = 0; i < 5; i++) await db.asUser(carol, (q) => q("select public.create_extension_token()"));
    await expect(db.asUser(carol, (q) => q("select public.create_extension_token()"))).rejects.toThrow(/Troppi codici/);
  });
});
