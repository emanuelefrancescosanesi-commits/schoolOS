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

describe.skipIf(!url)("cancellazione dell'account", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
    for (const u of [alice, bob]) {
      await db.asUser(u, (q) => q("select public.complete_onboarding($1)", [payload]));
      await db.asUser(u, (q) => q("select public.sync_my_grades($1)", [JSON.stringify([{ subject: "Matematica", value: 7, kind: "oral", date: "2026-10-01" }])]));
      await db.asUser(u, (q) => q("select public.create_extension_token()"));
    }
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  const count = async (table: string, user: string) =>
    (await db.admin.query(`select count(*)::int as n from public.${table} where ${table === "profiles" ? "id" : "user_id"} = $1`, [user])).rows[0].n;

  it("elimina utente e tutti i suoi dati, e non tocca gli altri", async () => {
    for (const t of ["profiles", "school_years", "subjects", "grades", "extension_tokens"]) expect(await count(t, alice)).toBeGreaterThan(0);
    await db.asUser(alice, (q) => q("select public.delete_my_account()"));
    for (const t of ["profiles", "school_years", "subjects", "grades", "extension_tokens"]) expect(await count(t, alice)).toBe(0);
    expect((await db.admin.query("select count(*)::int as n from auth.users where id = $1", [alice])).rows[0].n).toBe(0);
    for (const t of ["profiles", "school_years", "subjects", "grades", "extension_tokens"]) expect(await count(t, bob)).toBeGreaterThan(0);
  });

  it("non è chiamabile senza sessione", async () => {
    await expect(db.asAnon((q) => q("select public.delete_my_account()"))).rejects.toThrow(/permission denied/);
  });
});
