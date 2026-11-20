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

  it("inserisce i voti, salta i duplicati, crea le materie mancanti e segnala i voti non validi", async () => {
    const rows = [
      { subject: "MATEMATICA", value: 8, kind: "written", date: "2026-10-27" },
      { subject: "Scienze motorie", value: 9.5, kind: "practical", date: "2026-10-14" },
      { subject: "Scienze motorie", value: 8, kind: "practical", date: "2026-10-14" },
      { subject: "Fisica", value: 4, kind: "written", date: "2026-10-19" },
      { subject: "Matematica", value: 6.3, kind: "written", date: "2026-10-20" },
      { subject: "Matematica", value: 7, kind: "written", date: "2999-01-01" },
    ];
    expect(await sync(token, rows)).toEqual({ inserted: 4, skipped: 0, invalid: 2, unmatched: [], created: ["Fisica"], updated: 0 });
    expect(await sync(token, rows)).toMatchObject({ inserted: 0, skipped: 4, invalid: 2, created: [] });
    const n = await db.admin.query("select count(*)::int as n from public.grades where user_id = $1", [alice]);
    expect(n.rows[0].n).toBe(4);
  });

  it("legge il peso dal registro e corregge quello dei voti già importati senza duplicarli", async () => {
    const w = async (subject: string, date: string) =>
      Number((await db.admin.query("select g.weight from public.grades g join public.subjects s on s.id = g.subject_id where g.user_id = $1 and s.name = $2 and g.graded_on = $3", [alice, subject, date])).rows[0].weight);
    const base = { subject: "Biologia", value: 8, kind: "oral", date: "2026-10-21" };
    // Importato senza peso (come prima): peso 1.
    expect(await sync(token, [base])).toMatchObject({ inserted: 1, updated: 0 });
    expect(await w("Biologia", "2026-10-21")).toBe(1);
    // Il registro indica 0,5: il voto esistente viene aggiornato, non duplicato.
    expect(await sync(token, [{ ...base, weight: 0.5 }])).toMatchObject({ inserted: 0, skipped: 1, updated: 1 });
    expect(await w("Biologia", "2026-10-21")).toBe(0.5);
    // Stesso peso: nessun aggiornamento. Peso assurdo o assente: ignorato.
    expect(await sync(token, [{ ...base, weight: 0.5 }])).toMatchObject({ updated: 0 });
    expect(await sync(token, [{ ...base, weight: 99 }, { ...base, weight: "x" }, base])).toMatchObject({ updated: 0 });
    expect(await w("Biologia", "2026-10-21")).toBe(0.5);
    // Voto nuovo con peso.
    expect(await sync(token, [{ ...base, date: "2026-10-22", weight: 2 }])).toMatchObject({ inserted: 1 });
    expect(await w("Biologia", "2026-10-22")).toBe(2);
    const n = await db.admin.query("select count(*)::int as n from public.grades g join public.subjects s on s.id = g.subject_id where g.user_id = $1 and s.name = 'Biologia'", [alice]);
    expect(n.rows[0].n).toBe(2);
  });

  it("i voti vanno solo all'utente del codice", async () => {
    const n = await db.admin.query("select count(*)::int as n from public.grades where user_id = $1", [bob]);
    expect(n.rows[0].n).toBe(0);
  });

  it("riconosce le materie anche con apostrofo curvo e maiuscole diverse", async () => {
    await db.admin.query(
      "insert into public.subjects (user_id, school_year_id, name, color) select user_id, school_year_id, 'Storia dell’arte', 3 from public.subjects where user_id = $1 and name = 'Matematica'",
      [alice],
    );
    const res = await sync(token, [{ subject: "STORIA DELL'ARTE", value: 8, kind: "oral", date: "2026-10-21" }]);
    expect(res).toMatchObject({ inserted: 1, unmatched: [], created: [] });
  });

  it("le materie create hanno colore e posizione validi e non superano il tetto di 25", async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ subject: `Extra ${i}`, value: 7, kind: "written", date: "2026-10-22" }));
    const res = (await sync(token, many)) as { created: string[]; unmatched: string[] };
    const total = await db.admin.query("select count(*)::int as n, min(color) as lo, max(color) as hi from public.subjects where user_id = $1", [alice]);
    expect(total.rows[0].n).toBeLessThanOrEqual(25);
    expect(total.rows[0].lo).toBeGreaterThanOrEqual(1);
    expect(total.rows[0].hi).toBeLessThanOrEqual(8);
    expect(res.created.length + res.unmatched.length).toBe(40);
    expect(res.unmatched.length).toBeGreaterThan(0);
  });

  it("l'app sincronizza con la sessione, senza codice: stessa logica, solo il proprio utente", async () => {
    const dave = await db.createUser();
    const erin = await db.createUser();
    await db.asUser(dave, (q) => q("select public.complete_onboarding($1)", [payload]));
    await db.asUser(erin, (q) => q("select public.complete_onboarding($1)", [payload]));
    const mine = (u: string, rows: unknown) =>
      db.asUser(u, async (q) => (await q<{ r: Record<string, unknown> }>("select public.sync_my_grades($1) as r", [JSON.stringify(rows)])).rows[0].r);
    const rows = [{ subject: "Matematica", value: 7, kind: "oral", date: "2026-10-27", weight: 0.5 }];
    expect(await mine(dave, rows)).toMatchObject({ inserted: 1, skipped: 0, unmatched: [] });
    expect(await mine(dave, rows)).toMatchObject({ inserted: 0, skipped: 1 });
    const n = async (u: string) => (await db.admin.query("select count(*)::int as n from public.grades where user_id = $1", [u])).rows[0].n;
    expect(await n(dave)).toBe(1);
    expect(await n(erin)).toBe(0);
    await expect(mine(dave, { a: 1 })).rejects.toThrow(/Dati non validi/);
    await expect(db.asAnon((q) => q("select public.sync_my_grades('[]')"))).rejects.toThrow(/permission denied/);
    // La funzione interna non è chiamabile dal client.
    await expect(db.asUser(dave, (q) => q("select public.sync_grades_for($1, '[]')", [erin]))).rejects.toThrow(/permission denied/);
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
