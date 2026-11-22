import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Query, type TestDb, createTestDb } from "./harness";

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

const first = async <T extends Record<string, unknown>>(q: Query, sql: string, params: unknown[] = []) => (await q<T>(sql, params)).rows[0];

describe.skipIf(!url)("Compiti e Da fare: un'unica fonte", () => {
  let db: TestDb;
  let alice: string;
  let bob: string;
  let subject: string;

  beforeAll(async () => {
    db = await createTestDb(url!);
    alice = await db.createUser();
    bob = await db.createUser();
    for (const u of [alice, bob]) await db.asUser(u, (q) => q("select public.complete_onboarding($1)", [payload]));
    subject = (await db.asUser(alice, (q) => first<{ id: string }>(q, "select id from public.subjects limit 1"))).id;
  }, 30_000);

  afterAll(async () => {
    await db?.close();
  });

  const addAssignment = (q: Query, title = "Esercizi", kind = "homework") =>
    first<{ id: string }>(q, "insert into public.assignments (title, kind, due_on, subject_id) values ($1, $2, '2026-12-01', $3) returning id", [title, kind, subject]);
  const todoOf = (q: Query, assignment: string) => first<Record<string, unknown>>(q, "select * from public.todos where assignment_id = $1", [assignment]);

  it("un nuovo compito crea l'attività collegata, con priorità dal tipo", async () => {
    await db.asUser(alice, async (q) => {
      const test = await addAssignment(q, "Verifica di matematica", "test");
      const home = await addAssignment(q, "Pagina 12", "homework");
      const t = await todoOf(q, test.id);
      expect(t).toMatchObject({ title: "Verifica di matematica", priority: 1, subject_id: subject, completed_at: null });
      expect(String(t.due_on)).toContain("2026");
      expect(await todoOf(q, home.id)).toMatchObject({ priority: 3 });
    });
  });

  it("modificare o spuntare il compito aggiorna l'attività", async () => {
    await db.asUser(alice, async (q) => {
      const a = await addAssignment(q);
      await q("update public.assignments set title = 'Esercizi 3 e 4', due_on = '2026-12-05' where id = $1", [a.id]);
      expect(await todoOf(q, a.id)).toMatchObject({ title: "Esercizi 3 e 4" });
      await q("update public.assignments set status = 'done', completed_at = now() where id = $1", [a.id]);
      expect((await todoOf(q, a.id)).completed_at).not.toBeNull();
      await q("update public.assignments set status = 'todo', completed_at = null where id = $1", [a.id]);
      expect((await todoOf(q, a.id)).completed_at).toBeNull();
    });
  });

  it("modificare o spuntare l'attività aggiorna il compito", async () => {
    await db.asUser(alice, async (q) => {
      const a = await addAssignment(q);
      await q("update public.todos set title = 'Rifare tutto', due_on = '2026-12-09' where assignment_id = $1", [a.id]);
      expect(await first(q, "select title, due_on::text d from public.assignments where id = $1", [a.id])).toMatchObject({ title: "Rifare tutto", d: "2026-12-09" });
      await q("update public.todos set completed_at = now() where assignment_id = $1", [a.id]);
      expect(await first(q, "select status from public.assignments where id = $1", [a.id])).toMatchObject({ status: "done" });
      await q("update public.todos set completed_at = null where assignment_id = $1", [a.id]);
      expect(await first(q, "select status, completed_at from public.assignments where id = $1", [a.id])).toMatchObject({ status: "todo", completed_at: null });
    });
  });

  it("un titolo lungo dell'attività viene troncato per il compito (140) senza errori", async () => {
    await db.asUser(alice, async (q) => {
      const a = await addAssignment(q);
      await q("update public.todos set title = $2 where assignment_id = $1", [a.id, "x".repeat(200)]);
      expect((await first<{ n: number }>(q, "select char_length(title) n from public.assignments where id = $1", [a.id])).n).toBe(140);
    });
  });

  it("eliminare da una parte elimina l'altra", async () => {
    await db.asUser(alice, async (q) => {
      const a = await addAssignment(q, "A");
      await q("delete from public.assignments where id = $1", [a.id]);
      expect(await todoOf(q, a.id)).toBeUndefined();
      const b = await addAssignment(q, "B");
      await q("delete from public.todos where assignment_id = $1", [b.id]);
      expect(await first(q, "select 1 from public.assignments where id = $1", [b.id])).toBeUndefined();
    });
  });

  it("eliminando la materia (cascata) spariscono compiti e attività collegate, il flag non resta attivo", async () => {
    const s2 = await db.asUser(alice, (q) => first<{ id: string }>(q, "insert into public.subjects (name, color, school_year_id) select 'Fisica', 2, school_year_id from public.subjects limit 1 returning id"));
    await db.asUser(alice, async (q) => {
      const a = await first<{ id: string }>(q, "insert into public.assignments (title, due_on, subject_id) values ('Fisica 1', '2026-12-01', $1) returning id", [s2.id]);
      await q("delete from public.subjects where id = $1", [s2.id]);
      expect(await todoOf(q, a.id)).toBeUndefined();
      // La sincronizzazione funziona ancora nella stessa transazione.
      const b = await addAssignment(q, "Dopo la cascata");
      expect(await todoOf(q, b.id)).toMatchObject({ title: "Dopo la cascata" });
    });
  });

  it("un'attività ricorrente collegata non chiude il compito", async () => {
    await db.asUser(alice, async (q) => {
      const a = await addAssignment(q);
      await q(`update public.todos set recurrence = '{"freq":"week","interval":1}' where assignment_id = $1`, [a.id]);
      await q("update public.assignments set status = 'done', completed_at = now() where id = $1", [a.id]);
      expect((await todoOf(q, a.id)).completed_at).toBeNull();
    });
  });

  it("gli altri utenti non vedono nulla", async () => {
    await db.asUser(alice, (q) => addAssignment(q, "Privato"));
    expect((await db.asUser(bob, (q) => q("select * from public.todos where title = 'Privato'"))).rowCount).toBe(0);
  });

  it("l'inserimento tramite funzioni della sincronizzazione (senza auth.uid) crea comunque l'attività", async () => {
    const id = (await db.admin.query<{ id: string }>(
      "insert into public.assignments (user_id, title, due_on) values ($1, 'Da estensione', '2026-12-02') returning id", [bob])).rows[0].id;
    const t = await db.admin.query("select title from public.todos where assignment_id = $1 and user_id = $2", [id, bob]);
    expect(t.rowCount).toBe(1);
  });
});
