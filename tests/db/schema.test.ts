import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Query, type TestDb, createTestDb } from "./harness";

/**
 * Test dello schema su un Postgres reale. Richiedono TEST_DATABASE_URL (un utente con
 * permesso di creare database); in CI li esegue il workflow con un servizio Postgres.
 */
const url = process.env.TEST_DATABASE_URL;

const onboardingPayload = (overrides: Record<string, unknown> = {}) => ({
  profile: {
    first_name: "Sara",
    school_name: "Liceo di prova",
    class_name: "3B",
    registro: "classeviva",
    period_scheme: "trimestre-pentamestre",
    grade_min: 1,
    grade_max: 10,
    allow_half: true,
    allow_plus_minus: true,
    pass_threshold: 6,
    average_method: "weighted",
  },
  school_year: { label: "2026/27", starts_on: "2026-09-14", ends_on: "2027-06-10" },
  periods: [
    { name: "Trimestre", starts_on: "2026-09-14", ends_on: "2026-12-22" },
    { name: "Pentamestre", starts_on: "2027-01-07", ends_on: "2027-06-10" },
  ],
  subjects: [
    { name: "Matematica", color: 2, teacher_name: "Prof. Rossi" },
    { name: "Italiano", color: 1 },
  ],
  ...overrides,
});

async function onboard(q: Query, overrides: Record<string, unknown> = {}) {
  const res = await q<{ id: string }>("select public.complete_onboarding($1) as id", [onboardingPayload(overrides)]);
  return res.rows[0].id;
}

async function subjectId(q: Query, name = "Matematica") {
  const res = await q<{ id: string }>("select id from public.subjects where name = $1", [name]);
  return res.rows[0].id;
}

describe.skipIf(!url)("schema e RLS", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser({ first_name: "Alice" });
    bob = await db.createUser({ full_name: "Roberto Bianchi" });
    await db.asUser(alice, (q) => onboard(q));
    await db.asUser(bob, (q) => onboard(q));
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  describe("profili", () => {
    it("la registrazione crea il profilo con il nome", async () => {
      const giulia = await db.createUser({ full_name: "Giulia Verdi" });
      const anon = await db.createUser();
      const res = await db.admin.query<{ id: string; first_name: string }>(
        "select id, first_name from public.profiles where id = any($1)",
        [[giulia, anon]],
      );
      const byId = Object.fromEntries(res.rows.map((r) => [r.id, r.first_name]));
      expect(byId).toEqual({ [giulia]: "Giulia", [anon]: "" });
    });

    it("ognuno vede solo il proprio profilo", async () => {
      const rows = await db.asUser(alice, (q) => q("select id from public.profiles"));
      expect(rows.rows).toEqual([{ id: alice }]);
    });

    it("non si può modificare il profilo di un altro", async () => {
      const res = await db.asUser(alice, (q) =>
        q("update public.profiles set first_name = 'Hacker' where id = $1", [bob]),
      );
      expect(res.rowCount).toBe(0);
    });

    it("il client non può segnare da solo l'onboarding come completato", async () => {
      await expect(
        db.asUser(alice, (q) => q("update public.profiles set onboarding_completed_at = null where id = $1", [alice])),
      ).rejects.toThrow(/permission denied/);
    });

    it("gli utenti anonimi non leggono nulla", async () => {
      await expect(db.asAnon((q) => q("select * from public.profiles"))).rejects.toThrow(/permission denied/);
      await expect(db.asAnon((q) => q("select * from public.grades"))).rejects.toThrow(/permission denied/);
    });
  });

  describe("isolamento tra studenti", () => {
    it("i voti di un altro non sono visibili", async () => {
      await db.asUser(bob, async (q) =>
        q("insert into public.grades (subject_id, value, graded_on) values ($1, 7, '2026-10-01')", [await subjectId(q)]),
      );
      const rows = await db.asUser(alice, (q) => q("select * from public.grades"));
      expect(rows.rowCount).toBe(0);
    });

    it("non si può inserire una riga a nome di un altro", async () => {
      await expect(
        db.asUser(alice, (q) =>
          q("insert into public.school_years (user_id, label, starts_on, ends_on) values ($1, 'x', '2030-09-01', '2031-06-01')", [
            bob,
          ]),
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it("non si può agganciare un voto alla materia di un altro", async () => {
      const bobSubject = await db.asUser(bob, (q) => subjectId(q));
      await expect(
        db.asUser(alice, (q) =>
          q("insert into public.grades (subject_id, value, graded_on) values ($1, 8, '2026-10-01')", [bobSubject]),
        ),
      ).rejects.toThrow(/foreign key/);
    });

    it("update e delete sulle righe altrui non toccano nulla", async () => {
      const res = await db.asUser(alice, async (q) => {
        const u = await q("update public.subjects set name = 'X' where user_id = $1", [bob]);
        const d = await q("delete from public.periods where user_id = $1", [bob]);
        return u.rowCount + d.rowCount;
      });
      expect(res).toBe(0);
    });
  });

  describe("vincoli sui voti", () => {
    const insertGrade = (value: number) =>
      db.asUser(alice, async (q) =>
        q("insert into public.grades (subject_id, value, graded_on) values ($1, $2, '2026-10-02')", [
          await subjectId(q),
          value,
        ]),
      );

    it("accetta interi, mezzi e +/−", async () => {
      for (const v of [6, 6.5, 6.25, 6.75, 10, 1]) await expect(insertGrade(v)).resolves.toBeDefined();
    });

    it("rifiuta voti fuori scala o con passo non valido", async () => {
      await expect(insertGrade(10.25)).rejects.toThrow(/fuori scala/);
      await expect(insertGrade(0.5)).rejects.toThrow(/fuori scala/);
      await expect(insertGrade(6.3)).rejects.toThrow(/grades_value_quarter/);
    });

    it("rispetta le opzioni della scala del profilo", async () => {
      await db.asUser(alice, (q) => q("update public.profiles set allow_plus_minus = false where id = $1", [alice]));
      await expect(insertGrade(7.25)).rejects.toThrow(/non ammesso/);
      await expect(insertGrade(7.5)).resolves.toBeDefined();
      await db.asUser(alice, (q) => q("update public.profiles set allow_plus_minus = true where id = $1", [alice]));
    });

    it("il peso deve essere positivo", async () => {
      await expect(
        db.asUser(alice, async (q) =>
          q("insert into public.grades (subject_id, value, weight, graded_on) values ($1, 7, 0, '2026-10-02')", [
            await subjectId(q),
          ]),
        ),
      ).rejects.toThrow(/check constraint/);
    });
  });

  describe("compiti e periodi", () => {
    it("una scadenza non può precedere l'assegnazione", async () => {
      await expect(
        db.asUser(alice, (q) =>
          q("insert into public.assignments (title, assigned_on, due_on) values ('Esercizi', '2026-10-10', '2026-10-09')"),
        ),
      ).rejects.toThrow(/check constraint/);
    });

    it("stato fatto e data di completamento vanno insieme", async () => {
      await expect(
        db.asUser(alice, (q) => q("insert into public.assignments (title, due_on, status) values ('X', '2026-10-09', 'done')")),
      ).rejects.toThrow(/check constraint/);
    });

    it("due periodi dello stesso anno non si sovrappongono", async () => {
      await expect(
        db.asUser(alice, async (q) => {
          const y = await q<{ id: string }>("select id from public.school_years limit 1");
          return q(
            "insert into public.periods (school_year_id, name, position, starts_on, ends_on) values ($1, 'Extra', 3, '2026-12-01', '2027-01-10')",
            [y.rows[0].id],
          );
        }),
      ).rejects.toThrow(/exclusion constraint/);
    });
  });

  describe("complete_onboarding", () => {
    it("salva tutto e segna l'onboarding come completato", async () => {
      const res = await db.asUser(alice, async (q) => {
        const p = await q<{ first_name: string; registro: string; done: boolean }>(
          "select first_name, registro, onboarding_completed_at is not null as done from public.profiles",
        );
        const periods = await q("select name from public.periods order by position");
        const subjects = await q("select name from public.subjects order by position");
        return { profile: p.rows[0], periods: periods.rows, subjects: subjects.rows };
      });
      expect(res.profile).toEqual({ first_name: "Sara", registro: "classeviva", done: true });
      expect(res.periods.map((r) => r.name)).toEqual(["Trimestre", "Pentamestre"]);
      expect(res.subjects.map((r) => r.name)).toEqual(["Matematica", "Italiano"]);
    });

    it("non si può ripetere", async () => {
      await expect(db.asUser(alice, (q) => onboard(q))).rejects.toThrow(/già completato/);
    });

    it("è atomico: un errore non lascia dati a metà", async () => {
      const carla = await db.createUser();
      await expect(
        db.asUser(carla, (q) =>
          onboard(q, {
            subjects: [
              { name: "Fisica", color: 3 },
              { name: "fisica", color: 4 }, // duplicato: viola l'indice unico
            ],
          }),
        ),
      ).rejects.toThrow(/subjects_unique_name/);
      const left = await db.asUser(carla, async (q) => {
        const y = await q("select 1 from public.school_years");
        const p = await q<{ done: boolean }>("select onboarding_completed_at is not null as done from public.profiles");
        return { years: y.rowCount, done: p.rows[0].done };
      });
      expect(left).toEqual({ years: 0, done: false });
    });

    it("rifiuta periodi fuori dall'anno scolastico", async () => {
      const dario = await db.createUser();
      await expect(
        db.asUser(dario, (q) =>
          onboard(q, { periods: [{ name: "Fuori", starts_on: "2026-08-01", ends_on: "2026-12-01" }] }),
        ),
      ).rejects.toThrow(/esce dall'anno/);
    });

    it("gli anonimi non possono chiamarla", async () => {
      await expect(db.asAnon((q) => onboard(q))).rejects.toThrow(/permission denied/);
    });
  });

  describe("cancellazione account", () => {
    it("eliminare l'utente cancella tutti i suoi dati", async () => {
      await db.admin.query("delete from auth.users where id = $1", [bob]);
      const counts = await db.admin.query<{ n: number }>(
        `select (select count(*) from public.profiles where id = $1)
              + (select count(*) from public.school_years where user_id = $1)
              + (select count(*) from public.subjects where user_id = $1)
              + (select count(*) from public.grades where user_id = $1) as n`,
        [bob],
      );
      expect(Number(counts.rows[0].n)).toBe(0);
    });
  });
});
