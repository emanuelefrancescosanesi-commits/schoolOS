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

describe.skipIf(!url)("notifiche lette e obiettivi: schema e RLS", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let subjectId: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
    for (const u of [alice, bob]) await db.asUser(u, (q) => q("select public.complete_onboarding($1)", [payload]));
    subjectId = (await db.asUser(alice, (q) => q<{ id: string }>("select id from public.subjects"))).rows[0].id;
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  it("gli anonimi non toccano nulla", async () => {
    for (const t of ["notification_reads", "goals"]) {
      await expect(db.asAnon((q) => q(`select * from public.${t}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("i segni di lettura sono privati e senza duplicati", async () => {
    await db.asUser(alice, (q) => q("insert into public.notification_reads (reminder_id) values ('today-1')"));
    await expect(db.asUser(alice, (q) => q("insert into public.notification_reads (reminder_id) values ('today-1')"))).rejects.toThrow(/duplicate key/);
    expect((await db.asUser(bob, (q) => q("select * from public.notification_reads"))).rowCount).toBe(0);
    await expect(
      db.asUser(bob, (q) => q("insert into public.notification_reads (user_id, reminder_id) values ($1, 'x')", [alice])),
    ).rejects.toThrow(/row-level security/);
  });

  it("un solo obiettivo per materia e uno generale", async () => {
    await db.asUser(alice, (q) => q("insert into public.goals (subject_id, target) values ($1, 7.5)", [subjectId]));
    await expect(db.asUser(alice, (q) => q("insert into public.goals (subject_id, target) values ($1, 8)", [subjectId]))).rejects.toThrow(/duplicate key/);
    await db.asUser(alice, (q) => q("insert into public.goals (subject_id, target) values (null, 7)"));
    await expect(db.asUser(alice, (q) => q("insert into public.goals (subject_id, target) values (null, 8)"))).rejects.toThrow(/duplicate key/);
  });

  it("non si può puntare alla materia di un altro, né vedere i suoi obiettivi", async () => {
    await expect(db.asUser(bob, (q) => q("insert into public.goals (subject_id, target) values ($1, 7)", [subjectId]))).rejects.toThrow(/foreign key|row-level security/);
    expect((await db.asUser(bob, (q) => q("select * from public.goals"))).rowCount).toBe(0);
  });

  it("l'obiettivo deve essere un valore sensato", async () => {
    await expect(db.asUser(bob, (q) => q("insert into public.goals (subject_id, target) values (null, 0)"))).rejects.toThrow(/check/);
  });
});
