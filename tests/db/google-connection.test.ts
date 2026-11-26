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

describe.skipIf(!url)("collegamento Google (google_connections)", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
    for (const u of [alice, bob]) await db.asUser(u, (q) => q("select public.complete_onboarding($1)", [payload]));
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });

  const connect = (u: string) =>
    db.asUser(u, (q) => q("insert into public.google_connections (google_email, refresh_token_enc, scopes) values ('a@scuola.it', 'v1.xx.yy.zz', 'calendar')"));

  it("una sola connessione per studente, visibile solo a lui", async () => {
    await connect(alice);
    await expect(connect(alice)).rejects.toThrow();
    expect((await db.asUser(alice, (q) => q("select * from public.google_connections"))).rows).toHaveLength(1);
    expect((await db.asUser(bob, (q) => q("select * from public.google_connections"))).rows).toHaveLength(0);
    await expect(db.asAnon((q) => q("select * from public.google_connections"))).rejects.toThrow(/permission denied/);
  });

  it("Bob non può toccare la connessione di Alice", async () => {
    expect((await db.asUser(bob, (q) => q("update public.google_connections set google_email = 'x@y.it'"))).rowCount).toBe(0);
    expect((await db.asUser(bob, (q) => q("delete from public.google_connections"))).rowCount).toBe(0);
  });

  it("eventi e messaggi Google non si duplicano, e un evento non ha due origini", async () => {
    const ev = (id: string) => db.asUser(alice, (q) => q("insert into public.events (title, starts_on, google_event_id) values ('E', '2026-12-01', $1)", [id]));
    await ev("g1");
    await expect(ev("g1")).rejects.toThrow();
    await ev("g2");
    const msg = (id: string) => db.asUser(alice, (q) => q("insert into public.inbox_messages (title, source, external_id) values ('M', 'email', $1)", [id]));
    await msg("m1");
    await expect(msg("m1")).rejects.toThrow();
    // Stesso id esterno per un altro utente: consentito.
    await db.asUser(bob, (q) => q("insert into public.events (title, starts_on, google_event_id) values ('E', '2026-12-01', 'g1')"));
    const feed = (await db.asUser(alice, (q) => q("insert into public.calendar_feeds (url) values ('https://x.example.com/a.ics') returning id"))).rows[0].id;
    await expect(
      db.asUser(alice, (q) => q("insert into public.events (title, starts_on, feed_id, external_id, google_event_id) values ('E', '2026-12-01', $1, 'x', 'g9')", [feed])),
    ).rejects.toThrow();
  });

  it("eliminare l'account elimina connessione, eventi e messaggi", async () => {
    await db.admin.query("delete from auth.users where id = $1", [alice]);
    for (const t of ["google_connections", "events", "inbox_messages"]) {
      expect((await db.admin.query(`select count(*)::int as n from public.${t} where user_id = $1`, [alice])).rows[0].n).toBe(0);
    }
  });
});
