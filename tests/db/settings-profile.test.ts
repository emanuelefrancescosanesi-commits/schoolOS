import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestDb, createTestDb } from "./harness";

const url = process.env.TEST_DATABASE_URL;

const payload = {
  profile: {
    first_name: "Sara", school_name: "", class_name: "", registro: "axios", period_scheme: "trimestre-pentamestre",
    grade_min: 1, grade_max: 10, allow_half: true, allow_plus_minus: true, pass_threshold: 6, average_method: "weighted",
  },
  school_year: { label: "2026/27", starts_on: "2026-09-14", ends_on: "2027-06-10" },
  periods: [
    { name: "Trimestre", starts_on: "2026-09-14", ends_on: "2026-12-22" },
    { name: "Pentamestre", starts_on: "2027-01-07", ends_on: "2027-06-10" },
  ],
  subjects: [{ name: "Matematica", color: 1 }],
};
const year = { label: "2026/27", starts_on: "2026-09-14", ends_on: "2027-06-10" };
const quadrimestri = [
  { name: "Primo quadrimestre", starts_on: "2026-09-14", ends_on: "2027-01-31" },
  { name: "Secondo quadrimestre", starts_on: "2027-02-01", ends_on: "2027-06-10" },
];

describe.skipIf(!url)("impostazioni: periodi e notifiche", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let aliceYear: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
    for (const u of [alice, bob]) await db.asUser(u, (q) => q("select public.complete_onboarding($1)", [payload]));
    aliceYear = (await db.admin.query("select id from public.school_years where user_id = $1", [alice])).rows[0].id;
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  const replace = (u: string, id: string, scheme: string, y: object, periods: object[]) =>
    db.asUser(u, (q) => q("select public.replace_periods($1, $2, $3, $4)", [id, scheme, y, JSON.stringify(periods)]));

  it("sostituisce i periodi e lo schema in modo atomico", async () => {
    await replace(alice, aliceYear, "quadrimestri", year, quadrimestri);
    const periods = await db.admin.query("select name, position from public.periods where user_id = $1 order by position", [alice]);
    expect(periods.rows.map((r) => r.name)).toEqual(["Primo quadrimestre", "Secondo quadrimestre"]);
    const profile = await db.admin.query("select period_scheme from public.profiles where id = $1", [alice]);
    expect(profile.rows[0].period_scheme).toBe("quadrimestri");
  });

  it("un errore a metà non lascia l'anno senza periodi", async () => {
    const bad = [{ name: "Fuori", starts_on: "2026-08-01", ends_on: "2026-12-22" }];
    await expect(replace(alice, aliceYear, "trimestri", year, bad)).rejects.toThrow(/esce dall/);
    const n = await db.admin.query("select count(*)::int as n from public.periods where user_id = $1", [alice]);
    expect(n.rows[0].n).toBe(2);
  });

  it("rifiuta periodi sovrapposti", async () => {
    const overlap = [
      { name: "A", starts_on: "2026-09-14", ends_on: "2027-01-31" },
      { name: "B", starts_on: "2027-01-20", ends_on: "2027-06-10" },
    ];
    await expect(replace(alice, aliceYear, "quadrimestri", year, overlap)).rejects.toThrow();
  });

  it("non si toccano i periodi di un altro utente", async () => {
    await expect(replace(bob, aliceYear, "quadrimestri", year, quadrimestri)).rejects.toThrow(/non trovato/);
  });

  it("i voti restano dopo il cambio di periodi", async () => {
    const subject = (await db.admin.query("select id from public.subjects where user_id = $1", [alice])).rows[0].id;
    await db.asUser(alice, (q) => q("insert into public.grades (subject_id, value, graded_on) values ($1, 7, '2026-10-10')", [subject]));
    await replace(alice, aliceYear, "trimestre-pentamestre", year, payload.periods);
    const n = await db.admin.query("select count(*)::int as n from public.grades where user_id = $1", [alice]);
    expect(n.rows[0].n).toBe(1);
  });

  it("le preferenze di notifica si salvano, con i vincoli", async () => {
    await db.asUser(alice, (q) => q("update public.profiles set notify_tests = false, notify_test_days = 7 where id = $1", [alice]));
    const row = await db.admin.query("select notify_tests, notify_test_days from public.profiles where id = $1", [alice]);
    expect(row.rows[0]).toEqual({ notify_tests: false, notify_test_days: 7 });
    await expect(db.asUser(alice, (q) => q("update public.profiles set notify_test_days = 30 where id = $1", [alice]))).rejects.toThrow();
  });

  it("il client non può cambiare piano o onboarding dal profilo", async () => {
    await expect(db.asUser(alice, (q) => q("update public.profiles set plan = 'pro' where id = $1", [alice]))).rejects.toThrow(/permission denied/);
  });
});
