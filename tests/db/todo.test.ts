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

const id = async (q: Query, sql: string, params: unknown[] = []) => (await q<{ id: string }>(sql, params)).rows[0].id;
const newTodo = (q: Query, title = "Studiare", extra = "") =>
  id(q, `insert into public.todos (title${extra ? ", " + extra.split("=")[0] : ""}) values ($1${extra ? ", " + extra.split("=")[1] : ""}) returning id`, [title]);

describe.skipIf(!url)("lista Da fare: schema e RLS", () => {
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

  it("gli anonimi non toccano nulla", async () => {
    for (const t of ["todos", "todo_projects", "todo_labels", "todo_label_links"]) {
      await expect(db.asAnon((q) => q(`select * from public.${t}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("ognuno vede e modifica solo le proprie attività", async () => {
    const todo = await db.asUser(alice, (q) => newTodo(q, "Segreto di Alice"));
    expect((await db.asUser(bob, (q) => q("select * from public.todos"))).rowCount).toBe(0);
    expect((await db.asUser(bob, (q) => q("update public.todos set title = 'x' where id = $1", [todo]))).rowCount).toBe(0);
    expect((await db.asUser(bob, (q) => q("delete from public.todos where id = $1", [todo]))).rowCount).toBe(0);
    await expect(
      db.asUser(bob, (q) => q("insert into public.todos (user_id, title) values ($1, 'a nome di Alice')", [alice])),
    ).rejects.toThrow(/row-level security/);
    expect((await db.asUser(alice, (q) => q("select * from public.todos where id = $1", [todo]))).rowCount).toBe(1);
  });

  it("non si può agganciare un'attività a lista, materia o compito di un altro", async () => {
    const project = await db.asUser(alice, (q) => id(q, "insert into public.todo_projects (name) values ('Mia') returning id"));
    const subject = await db.asUser(alice, (q) => id(q, "select id from public.subjects limit 1"));
    await expect(
      db.asUser(bob, (q) => q("insert into public.todos (title, project_id) values ('x', $1)", [project])),
    ).rejects.toThrow(/foreign key/);
    await expect(
      db.asUser(bob, (q) => q("insert into public.todos (title, subject_id) values ('x', $1)", [subject])),
    ).rejects.toThrow(/foreign key/);
    const label = await db.asUser(alice, (q) => id(q, "insert into public.todo_labels (name) values ('privata') returning id"));
    await expect(
      db.asUser(bob, async (q) => {
        const t = await newTodo(q);
        return q("insert into public.todo_label_links (todo_id, label_id) values ($1, $2)", [t, label]);
      }),
    ).rejects.toThrow(/foreign key/);
  });

  it("vincoli sui dati: titolo, priorità, orario e ricorrenza", async () => {
    await expect(db.asUser(alice, (q) => newTodo(q, "   "))).rejects.toThrow(/check/);
    await expect(db.asUser(alice, (q) => newTodo(q, "x", "priority=0"))).rejects.toThrow(/check/);
    await expect(db.asUser(alice, (q) => newTodo(q, "x", "due_time='10:00'"))).rejects.toThrow(/check/);
    await expect(db.asUser(alice, (q) => newTodo(q, "x", `recurrence='{"freq":"day","interval":1}'::jsonb`))).rejects.toThrow(/check/);
    await expect(
      db.asUser(alice, (q) => q(`insert into public.todos (title, due_on, recurrence) values ('x', '2026-12-01', '{"freq":"year","interval":1}')`)),
    ).rejects.toThrow(/check/);
    await expect(
      db.asUser(alice, (q) => q(`insert into public.todos (title, due_on, recurrence) values ('x', '2026-12-01', '{"freq":"day","interval":0}')`)),
    ).rejects.toThrow(/check/);
    const ok = await db.asUser(alice, (q) =>
      q(`insert into public.todos (title, due_on, due_time, recurrence) values ('ok', '2026-12-01', '10:00', '{"freq":"week","interval":1,"weekdays":[1,3]}') returning due_time::text`),
    );
    expect(ok.rows[0]).toEqual({ due_time: "10:00:00" });
  });

  it("le sotto-attività hanno un solo livello e seguono la lista del genitore", async () => {
    await db.asUser(alice, async (q) => {
      const p1 = await id(q, "insert into public.todo_projects (name) values ('Lista A') returning id");
      const p2 = await id(q, "insert into public.todo_projects (name) values ('Lista B') returning id");
      const parent = await id(q, "insert into public.todos (title, project_id) values ('Genitore', $1) returning id", [p1]);
      // La lista passata viene ignorata: vale quella del genitore. La ricorrenza è rimossa.
      const child = await id(q, `insert into public.todos (title, parent_id, project_id, due_on, recurrence) values ('Figlio', $1, $2, '2026-12-01', '{"freq":"day","interval":1}') returning id`, [parent, p2]);
      let row = (await q<{ project_id: string; recurrence: unknown }>("select project_id, recurrence from public.todos where id = $1", [child])).rows[0];
      expect(row).toEqual({ project_id: p1, recurrence: null });

      await q("update public.todos set project_id = $2 where id = $1", [parent, p2]);
      row = (await q<{ project_id: string; recurrence: unknown }>("select project_id, recurrence from public.todos where id = $1", [child])).rows[0];
      expect(row.project_id).toBe(p2);

      await q("savepoint s");
      await expect(q("insert into public.todos (title, parent_id) values ('Nipote', $1)", [child])).rejects.toThrow(/un solo livello/);
    });
  });

  it("eliminare una lista riporta le attività nell'Inbox; eliminare un genitore elimina i figli", async () => {
    await db.asUser(alice, async (q) => {
      const p = await id(q, "insert into public.todo_projects (name) values ('Da cancellare') returning id");
      const t = await id(q, "insert into public.todos (title, project_id) values ('Resta', $1) returning id", [p]);
      const sub = await id(q, "insert into public.todos (title, parent_id) values ('Sotto', $1) returning id", [t]);
      await q("delete from public.todo_projects where id = $1", [p]);
      expect((await q("select 1 from public.todos where id = $1 and project_id is null", [t])).rowCount).toBe(1);
      expect((await q("select 1 from public.todos where id = $1 and project_id is null", [sub])).rowCount).toBe(1);
      await q("delete from public.todos where id = $1", [t]);
      expect((await q("select 1 from public.todos where id = $1", [sub])).rowCount).toBe(0);
    });
  });

  it("eliminare la materia o il compito collegato scollega soltanto", async () => {
    await db.asUser(alice, async (q) => {
      const subject = await id(q, "insert into public.subjects (school_year_id, name, color) select id, 'Latino', 2 from public.school_years returning id");
      const assignment = await id(q, "insert into public.assignments (title, due_on) values ('Versione', '2026-12-01') returning id");
      const t = await id(q, "insert into public.todos (title, subject_id, assignment_id) values ('Collegata', $1, $2) returning id", [subject, assignment]);
      await q("delete from public.subjects where id = $1", [subject]);
      await q("delete from public.assignments where id = $1", [assignment]);
      const row = (await q("select subject_id, assignment_id from public.todos where id = $1", [t])).rows[0];
      expect(row).toEqual({ subject_id: null, assignment_id: null });
    });
  });

  it("un compito della scuola si collega a una sola attività", async () => {
    await db.asUser(alice, async (q) => {
      const assignment = await id(q, "insert into public.assignments (title, due_on) values ('Tema', '2026-12-02') returning id");
      await q("insert into public.todos (title, assignment_id) values ('a', $1)", [assignment]);
      await expect(q("insert into public.todos (title, assignment_id) values ('b', $1)", [assignment])).rejects.toThrow(/duplicate key/);
    });
  });

  it("nomi di liste ed etichette: univoci senza badare alle maiuscole; etichette senza spazi", async () => {
    await db.asUser(alice, async (q) => {
      await q("insert into public.todo_projects (name) values ('Sport')");
      await q("savepoint a");
      await expect(q("insert into public.todo_projects (name) values (' sport ')")).rejects.toThrow(/duplicate key/);
      await q("rollback to savepoint a");
      await q("insert into public.todo_labels (name) values ('Ripasso')");
      await q("savepoint b");
      await expect(q("insert into public.todo_labels (name) values ('ripasso')")).rejects.toThrow(/duplicate key/);
      await q("rollback to savepoint b");
      await expect(q("insert into public.todo_labels (name) values ('due parole')")).rejects.toThrow(/check/);
    });
  });

  it("limite di liste per account", async () => {
    const carol = await db.createUser();
    await db.asUser(carol, async (q) => {
      await q("insert into public.todo_projects (name) select 'L' || g from generate_series(1, 60) g");
      await expect(q("insert into public.todo_projects (name) values ('una di troppo')")).rejects.toThrow(/Limite raggiunto/);
    });
  });

  it("l'eliminazione dell'account porta via tutto", async () => {
    const dave = await db.createUser();
    await db.asUser(dave, async (q) => {
      const t = await newTodo(q, "mia");
      const l = await id(q, "insert into public.todo_labels (name) values ('x') returning id");
      await q("insert into public.todo_label_links (todo_id, label_id) values ($1, $2)", [t, l]);
    });
    await db.admin.query("delete from auth.users where id = $1", [dave]);
    for (const t of ["todos", "todo_labels", "todo_label_links", "todo_projects"]) {
      expect((await db.admin.query(`select 1 from public.${t} where user_id = $1`, [dave])).rowCount).toBe(0);
    }
  });
});
