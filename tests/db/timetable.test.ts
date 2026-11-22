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

describe.skipIf(!url)("orario settimanale", () => {
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

  const insert = (u: string, s: string | null, day = 1, from = "08:00", to = "09:00") =>
    db.asUser(u, (q) =>
      q("insert into public.timetable_slots (subject_id, weekday, starts_at, ends_at, room) values ($1,$2,$3,$4,'A1') returning id", [s, day, from, to]),
    );

  it("ognuno vede e modifica solo il proprio orario", async () => {
    await insert(alice, subject);
    const mine = await db.asUser(alice, (q) => q("select * from public.timetable_slots"));
    const theirs = await db.asUser(bob, (q) => q("select * from public.timetable_slots"));
    expect(mine.rows).toHaveLength(1);
    expect(theirs.rows).toHaveLength(0);
  });

  it("rifiuta la materia di un altro utente, giorni e orari incoerenti", async () => {
    await expect(insert(bob, subject)).rejects.toThrow();
    await expect(insert(alice, subject, 7)).rejects.toThrow();
    await expect(insert(alice, subject, 1, "10:00", "09:00")).rejects.toThrow();
  });

  it("non è accessibile senza sessione", async () => {
    await expect(db.asAnon((q) => q("select * from public.timetable_slots"))).rejects.toThrow(/permission denied/);
  });

  it("sparisce con la materia", async () => {
    await db.admin.query("delete from public.subjects where id = $1", [subject]);
    expect((await db.admin.query("select count(*)::int as n from public.timetable_slots where user_id = $1", [alice])).rows[0].n).toBe(0);
  });
});
