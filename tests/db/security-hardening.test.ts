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

describe.skipIf(!url)("rafforzamento sicurezza", () => {
  let db: TestDb;
  let alice: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    await db.asUser(alice, (q) => q("select public.complete_onboarding($1)", [payload]));
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  const sync = (t: string) =>
    db.asAnon(async (q) => (await q("select public.sync_grades($1, '[]'::jsonb) as r", [t])).rows[0]);
  const newToken = () =>
    db.asUser(alice, async (q) => (await q<{ t: string }>("select public.create_extension_token('x') as t")).rows[0].t);

  describe("scadenza dei codici", () => {
    it("un codice usato di recente funziona", async () => {
      await expect(sync(await newToken())).resolves.toBeTruthy();
    });

    it("un codice mai usato da più di 90 giorni non funziona più", async () => {
      const t = await newToken();
      await db.admin.query("update public.extension_tokens set created_at = now() - interval '91 days', last_used_at = null");
      await expect(sync(t)).rejects.toThrow(/Codice non valido/);
    });

    it("l'uso rinnova la scadenza", async () => {
      await db.admin.query("delete from public.extension_tokens");
      const t = await newToken();
      await db.admin.query("update public.extension_tokens set created_at = now() - interval '200 days', last_used_at = now() - interval '89 days'");
      await expect(sync(t)).resolves.toBeTruthy();
      await db.admin.query("update public.extension_tokens set last_used_at = now() - interval '91 days'");
      await expect(sync(t)).rejects.toThrow(/Codice non valido/);
    });
  });

  describe("funzioni interne", () => {
    it("le funzioni-trigger e il contatore non sono richiamabili dall'API", async () => {
      for (const fn of ["set_updated_at()", "handle_new_user()", "enforce_grade_scale()", "enforce_row_cap()", "sync_grades_for(gen_random_uuid(), '[]'::jsonb)"]) {
        await expect(db.asAnon((q) => q(`select public.${fn}`))).rejects.toThrow(/permission denied/);
        await expect(db.asUser(alice, (q) => q(`select public.${fn}`))).rejects.toThrow(/permission denied/);
      }
    });
  });

  describe("tetti per studente", () => {
    it("blocca le materie oltre il tetto", async () => {
      const year = (await db.admin.query("select id from public.school_years where user_id = $1", [alice])).rows[0].id;
      await db.admin.query(
        "insert into public.subjects (user_id, school_year_id, name, color) select $1, $2, 'M' || g, 1 from generate_series(1, 99) g",
        [alice, year],
      );
      await expect(
        db.asUser(alice, (q) => q("insert into public.subjects (school_year_id, name, color) values ($1, 'Una di troppo', 1)", [year])),
      ).rejects.toThrow(/Limite di 100 righe/);
    });

    it("blocca i voti oltre il tetto, senza toccare gli altri studenti", async () => {
      const subj = (await db.admin.query("select id from public.subjects where user_id = $1 and name = 'Matematica'", [alice])).rows[0].id;
      await db.admin.query("alter table public.grades disable trigger grades_row_cap");
      await db.admin.query(
        "insert into public.grades (user_id, subject_id, value, graded_on) select $1, $2, 6, date '2026-10-01' + (g % 200) from generate_series(1, 10000) g",
        [alice, subj],
      );
      await db.admin.query("alter table public.grades enable trigger grades_row_cap");
      await expect(
        db.asUser(alice, (q) => q("insert into public.grades (subject_id, value, graded_on) values ($1, 7, '2026-10-02')", [subj])),
      ).rejects.toThrow(/Limite di 10000 righe/);

      const bob = await db.createUser();
      await db.asUser(bob, (q) => q("select public.complete_onboarding($1)", [payload]));
      const bobSubj = (await db.admin.query("select id from public.subjects where user_id = $1", [bob])).rows[0].id;
      await expect(
        db.asUser(bob, (q) => q("insert into public.grades (subject_id, value, graded_on) values ($1, 7, '2026-10-02')", [bobSubj])),
      ).resolves.toBeTruthy();
    });
  });

  it("il layout della dashboard ha una dimensione massima", async () => {
    const big = { widgets: "x".repeat(25_000) };
    await expect(
      db.asUser(alice, (q) => q("update public.profiles set dashboard_layout = $1 where id = $2", [big, alice])),
    ).rejects.toThrow(/profiles_layout_size/);
  });
});
