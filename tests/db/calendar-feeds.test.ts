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

describe.skipIf(!url)("calendari collegati (calendar_feeds)", () => {
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

  const addFeed = (u: string, link = "https://calendar.google.com/calendar/ical/x/private-abc/basic.ics") =>
    db.asUser(u, (q) => q("insert into public.calendar_feeds (label, url) values ('Scuola', $1) returning id", [link]));
  const addImported = (u: string, feed: string, ext: string) =>
    db.asUser(u, (q) =>
      q("insert into public.events (title, kind, starts_on, feed_id, external_id) values ('Verifica', 'test', '2026-12-01', $1, $2) returning id", [feed, ext]),
    );

  it("il link è privato: lo vede solo il proprietario", async () => {
    await addFeed(alice);
    expect((await db.asUser(alice, (q) => q("select * from public.calendar_feeds"))).rows).toHaveLength(1);
    expect((await db.asUser(bob, (q) => q("select * from public.calendar_feeds"))).rows).toHaveLength(0);
    await expect(db.asAnon((q) => q("select * from public.calendar_feeds"))).rejects.toThrow(/permission denied/);
  });

  it("accetta solo link https e massimo 3 calendari", async () => {
    await expect(addFeed(bob, "http://example.com/a.ics")).rejects.toThrow();
    await expect(addFeed(bob, "file:///etc/passwd")).rejects.toThrow();
    await addFeed(bob);
    await addFeed(bob);
    await addFeed(bob);
    await expect(addFeed(bob)).rejects.toThrow(/Limite di 3/);
  });

  it("un evento importato non si duplica (stesso calendario + stesso id esterno)", async () => {
    const carol = await db.createUser();
    await db.asUser(carol, (q) => q("select public.complete_onboarding($1)", [payload]));
    const feed = (await addFeed(carol)).rows[0].id;
    await addImported(carol, feed, "uid-1");
    await expect(addImported(carol, feed, "uid-1")).rejects.toThrow();
    await addImported(carol, feed, "uid-2");
  });

  it("feed_id e external_id vanno insieme, e il calendario deve essere dello stesso utente", async () => {
    const feed = (await addFeed(alice)).rows[0].id;
    await expect(db.asUser(alice, (q) => q("insert into public.events (title, starts_on, feed_id) values ('x', '2026-12-01', $1)", [feed]))).rejects.toThrow();
    await expect(addImported(bob, feed, "uid-x")).rejects.toThrow();
  });

  it("scollegare il calendario elimina i suoi eventi, non gli altri", async () => {
    const dave = await db.createUser();
    await db.asUser(dave, (q) => q("select public.complete_onboarding($1)", [payload]));
    const feed = (await addFeed(dave)).rows[0].id;
    await addImported(dave, feed, "uid-1");
    await db.asUser(dave, (q) => q("insert into public.events (title, starts_on) values ('Mio', '2026-12-02')"));
    await db.asUser(dave, (q) => q("delete from public.calendar_feeds where id = $1", [feed]));
    const left = await db.asUser(dave, (q) => q("select title from public.events"));
    expect(left.rows).toEqual([{ title: "Mio" }]);
  });
});
