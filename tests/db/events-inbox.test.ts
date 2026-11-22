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
  subjects: [{ name: "Matematica", color: 1 }],
};

describe.skipIf(!url)("calendario (events) e Inbox (inbox_messages)", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let subject: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
    for (const u of [alice, bob]) await db.asUser(u, (q) => q("select public.complete_onboarding($1)", [payload]));
    subject = (await db.admin.query("select id from public.subjects where user_id = $1", [alice])).rows[0].id;
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  const addEvent = (u: string, over: Partial<{ title: string; kind: string; day: string; time: string | null; subject: string | null }> = {}) =>
    db.asUser(u, (q) =>
      q("insert into public.events (title, kind, starts_on, starts_at, subject_id) values ($1,$2,$3,$4,$5) returning id", [
        over.title ?? "Verifica di matematica",
        over.kind ?? "test",
        over.day ?? "2026-12-01",
        over.time === undefined ? "08:30" : over.time,
        over.subject === undefined ? subject : over.subject,
      ]),
    );

  describe("events", () => {
    it("ognuno vede e modifica solo i propri eventi", async () => {
      const { rows } = await addEvent(alice);
      expect((await db.asUser(alice, (q) => q("select * from public.events"))).rows).toHaveLength(1);
      expect((await db.asUser(bob, (q) => q("select * from public.events"))).rows).toHaveLength(0);
      // Bob non può né modificare né cancellare l'evento di Alice (RLS: 0 righe toccate).
      const upd = await db.asUser(bob, (q) => q("update public.events set title = 'x' where id = $1", [rows[0].id]));
      const del = await db.asUser(bob, (q) => q("delete from public.events where id = $1", [rows[0].id]));
      expect(upd.rowCount).toBe(0);
      expect(del.rowCount).toBe(0);
    });

    it("l'owner può modificare ed eliminare; updated_at si aggiorna", async () => {
      const { rows } = await addEvent(alice, { title: "Da modificare" });
      await db.asUser(alice, (q) => q("update public.events set title = 'Modificato', starts_at = null where id = $1", [rows[0].id]));
      const after = await db.asUser(alice, (q) => q("select title, starts_at, updated_at >= created_at as ok from public.events where id = $1", [rows[0].id]));
      expect(after.rows[0]).toMatchObject({ title: "Modificato", starts_at: null, ok: true });
      const del = await db.asUser(alice, (q) => q("delete from public.events where id = $1", [rows[0].id]));
      expect(del.rowCount).toBe(1);
    });

    it("rifiuta la materia di un altro utente, tipi sconosciuti e titoli vuoti o troppo lunghi", async () => {
      await expect(addEvent(bob, { subject })).rejects.toThrow();
      await expect(addEvent(alice, { kind: "party" })).rejects.toThrow();
      await expect(addEvent(alice, { title: "   " })).rejects.toThrow();
      await expect(addEvent(alice, { title: "x".repeat(141) })).rejects.toThrow();
    });

    it("non permette di spostare un evento su un'altra persona", async () => {
      const { rows } = await addEvent(alice);
      await expect(
        db.asUser(alice, (q) => q("update public.events set user_id = $1 where id = $2", [bob, rows[0].id])),
      ).rejects.toThrow();
    });

    it("non è accessibile senza sessione", async () => {
      await expect(db.asAnon((q) => q("select * from public.events"))).rejects.toThrow(/permission denied/);
    });

    it("rispetta il tetto di righe per studente", async () => {
      const carol = await db.createUser();
      await db.asUser(carol, (q) => q("select public.complete_onboarding($1)", [payload]));
      await db.admin.query(
        "insert into public.events (user_id, title, kind, starts_on) select $1, 'e' || g, 'event', '2026-12-01' from generate_series(1, 3000) g",
        [carol],
      );
      await expect(
        db.asUser(carol, (q) => q("insert into public.events (title, kind, starts_on) values ('uno in più', 'event', '2026-12-02')")),
      ).rejects.toThrow(/Limite di 3000/);
    }, 30_000);
  });

  describe("inbox_messages", () => {
    const addMsg = (u: string, title = "Colloqui", sub: string | null = null) =>
      db.asUser(u, (q) => q("insert into public.inbox_messages (title, sender, body, subject_id) values ($1,'Segreteria','Testo',$2) returning id", [title, sub]));

    it("ognuno vede solo le proprie comunicazioni, non lette di default, fonte «manual»", async () => {
      await addMsg(alice);
      const mine = await db.asUser(alice, (q) => q("select * from public.inbox_messages"));
      expect(mine.rows).toHaveLength(1);
      expect(mine.rows[0]).toMatchObject({ is_read: false, source: "manual" });
      expect((await db.asUser(bob, (q) => q("select * from public.inbox_messages"))).rows).toHaveLength(0);
    });

    it("si segna come letta e si elimina solo dal proprietario", async () => {
      const { rows } = await addMsg(alice, "Da leggere");
      const id = rows[0].id;
      expect((await db.asUser(bob, (q) => q("update public.inbox_messages set is_read = true where id = $1", [id]))).rowCount).toBe(0);
      expect((await db.asUser(alice, (q) => q("update public.inbox_messages set is_read = true where id = $1", [id]))).rowCount).toBe(1);
      expect((await db.asUser(bob, (q) => q("delete from public.inbox_messages where id = $1", [id]))).rowCount).toBe(0);
      expect((await db.asUser(alice, (q) => q("delete from public.inbox_messages where id = $1", [id]))).rowCount).toBe(1);
    });

    it("rifiuta materia altrui, fonte sconosciuta, oggetto vuoto e testo troppo lungo", async () => {
      await expect(addMsg(bob, "x", subject)).rejects.toThrow();
      await expect(db.asUser(alice, (q) => q("insert into public.inbox_messages (title, source) values ('x', 'sms')"))).rejects.toThrow();
      await expect(addMsg(alice, "  ")).rejects.toThrow();
      await expect(db.asUser(alice, (q) => q("insert into public.inbox_messages (title, body) values ('x', $1)", ["a".repeat(4001)]))).rejects.toThrow();
    });

    it("non è accessibile senza sessione", async () => {
      await expect(db.asAnon((q) => q("select * from public.inbox_messages"))).rejects.toThrow(/permission denied/);
    });
  });

  it("eventi e comunicazioni spariscono con la materia o con l'account", async () => {
    await addEvent(alice);
    await db.asUser(alice, (q) => q("insert into public.inbox_messages (title, subject_id) values ('m', $1)", [subject]));
    await db.admin.query("delete from public.subjects where id = $1", [subject]);
    const count = async (t: string) => (await db.admin.query(`select count(*)::int as n from public.${t} where user_id = $1 and subject_id is not null`, [alice])).rows[0].n;
    expect(await count("events")).toBe(0);
    expect(await count("inbox_messages")).toBe(0);

    await addEvent(alice, { subject: null });
    await db.admin.query("delete from auth.users where id = $1", [alice]);
    expect((await db.admin.query("select count(*)::int as n from public.events where user_id = $1", [alice])).rows[0].n).toBe(0);
  });
});
