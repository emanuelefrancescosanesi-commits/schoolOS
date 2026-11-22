import { describe, expect, it } from "vitest";
import { applyCompletion, completionPatch } from "./complete";
import { parseQuickAdd } from "./quick-add";
import { describeRecurrence, firstDue, nextDue, parseRecurrence } from "./recurrence";
import type { Recurrence, Todo } from "./types";
import { buildTree, compareTodos, countTodos, filterView, groupUpcoming, matchesQuery } from "./views";

// Domenica 22 novembre 2026.
const TODAY = "2026-11-22";

const ctx = {
  today: TODAY,
  projects: [
    { id: "p-scuola", name: "Scuola" },
    { id: "p-tesina", name: "Tesina di maturità" },
  ],
  subjects: [
    { id: "s-storia", name: "Storia" },
    { id: "s-arte", name: "Storia dell'arte" },
    { id: "s-mate", name: "Matematica" },
  ],
};

describe("parseQuickAdd", () => {
  it("lascia il titolo intatto se non c'è nulla da riconoscere", () => {
    const r = parseQuickAdd("Comprare il quaderno", ctx);
    expect(r).toMatchObject({ title: "Comprare il quaderno", due: null, time: null, priority: null, recurrence: null });
    expect(r.detected).toEqual([]);
  });

  it("riconosce date relative", () => {
    expect(parseQuickAdd("studiare storia domani", ctx)).toMatchObject({ title: "studiare storia", due: "2026-11-23" });
    expect(parseQuickAdd("dopodomani verifica", ctx)).toMatchObject({ title: "verifica", due: "2026-11-24" });
    expect(parseQuickAdd("ripasso oggi", ctx)).toMatchObject({ title: "ripasso", due: TODAY });
    expect(parseQuickAdd("consegnare relazione entro domani", ctx)).toMatchObject({ title: "consegnare relazione", due: "2026-11-23" });
    expect(parseQuickAdd("esercizi tra 3 giorni", ctx)).toMatchObject({ title: "esercizi", due: "2026-11-25" });
    expect(parseQuickAdd("esercizi fra due settimane", ctx)).toMatchObject({ due: "2026-12-06" });
  });

  it("i giorni della settimana sono sempre nel futuro", () => {
    // Oggi è domenica: "domenica" = domenica prossima; "lunedì" = domani.
    expect(parseQuickAdd("tema lunedì", ctx)).toMatchObject({ title: "tema", due: "2026-11-23" });
    expect(parseQuickAdd("tema domenica", ctx).due).toBe("2026-11-29");
    expect(parseQuickAdd("tema venerdì", ctx).due).toBe("2026-11-27");
  });

  it("riconosce date assolute", () => {
    expect(parseQuickAdd("verifica il 15/12", ctx)).toMatchObject({ title: "verifica", due: "2026-12-15" });
    expect(parseQuickAdd("verifica 3 gennaio", ctx)).toMatchObject({ title: "verifica", due: "2027-01-03" });
    // Data già passata quest'anno: l'anno prossimo.
    expect(parseQuickAdd("compleanno 5/3", ctx).due).toBe("2027-03-05");
    expect(parseQuickAdd("consegna il 25", ctx).due).toBe("2026-11-25");
    expect(parseQuickAdd("consegna il 10", ctx).due).toBe("2026-12-10");
    expect(parseQuickAdd("data impossibile 31/02", ctx).due).toBeNull();
  });

  it("riconosce gli orari", () => {
    expect(parseQuickAdd("lezione domani alle 15", ctx)).toMatchObject({ title: "lezione", due: "2026-11-23", time: "15:00" });
    expect(parseQuickAdd("lezione domani alle 15:30", ctx).time).toBe("15:30");
    expect(parseQuickAdd("lezione domani ore 9.05", ctx).time).toBe("09:05");
    expect(parseQuickAdd("lezione domani 18:45", ctx).time).toBe("18:45");
    // Un orario da solo vale per oggi.
    expect(parseQuickAdd("chiamare Marco alle 17", ctx)).toMatchObject({ due: TODAY, time: "17:00" });
    expect(parseQuickAdd("lezione domani alle 25", ctx).time).toBeNull();
    expect(parseQuickAdd("studiare stasera", ctx)).toMatchObject({ due: TODAY, time: "20:00" });
  });

  it("riconosce le ricorrenze", () => {
    expect(parseQuickAdd("ripasso ogni giorno", ctx)).toMatchObject({
      title: "ripasso",
      recurrence: { freq: "day", interval: 1 },
      due: TODAY,
    });
    expect(parseQuickAdd("ripasso ogni 2 settimane", ctx).recurrence).toEqual({ freq: "week", interval: 2 });
    expect(parseQuickAdd("rata ogni mese", ctx).recurrence).toEqual({ freq: "month", interval: 1 });
    const r = parseQuickAdd("allenamento ogni martedì e giovedì", ctx);
    expect(r.recurrence).toEqual({ freq: "week", interval: 1, weekdays: [2, 4] });
    expect(r.due).toBe("2026-11-24");
    expect(r.title).toBe("allenamento");
    expect(parseQuickAdd("studio nei giorni feriali", ctx).recurrence?.weekdays).toEqual([1, 2, 3, 4, 5]);
  });

  it("riconosce priorità, liste, materie ed etichette", () => {
    const r = parseQuickAdd("studiare capitolo 4 p1 #scuola @ripasso @esame +storia domani", ctx);
    expect(r).toMatchObject({
      title: "studiare capitolo 4",
      priority: 1,
      projectId: "p-scuola",
      subjectId: "s-storia",
      labels: ["ripasso", "esame"],
      due: "2026-11-23",
    });
    expect(parseQuickAdd("fare !2", ctx).priority).toBe(2);
    // Prefisso e nomi con spazi.
    expect(parseQuickAdd("scrivere #tesina", ctx).projectId).toBe("p-tesina");
    expect(parseQuickAdd("disegni +storiadellarte", ctx).subjectId).toBe("s-arte");
    // Nome esatto batte prefisso.
    expect(parseQuickAdd("leggere +storia", ctx).subjectId).toBe("s-storia");
    // Lista sconosciuta: resta nel titolo.
    expect(parseQuickAdd("cosa #boh", ctx)).toMatchObject({ title: "cosa #boh", projectId: null });
  });

  it("non tocca parole simili dentro altre parole", () => {
    expect(parseQuickAdd("preparare il domanio", ctx).due).toBeNull();
    expect(parseQuickAdd("ordinare 3 matite", ctx).title).toBe("ordinare 3 matite");
    expect(parseQuickAdd("visita a.p1x", ctx).priority).toBeNull();
  });
});

describe("ricorrenze", () => {
  const rule = (r: Recurrence) => r;
  it("giornaliera: la prossima è dopo la scadenza e dopo oggi", () => {
    expect(nextDue(rule({ freq: "day", interval: 1 }), "2026-11-22", TODAY)).toBe("2026-11-23");
    // Completata in anticipo: dopo la scadenza, non dopo oggi.
    expect(nextDue(rule({ freq: "day", interval: 1 }), "2026-11-25", TODAY)).toBe("2026-11-26");
    // In ritardo: nessun arretrato.
    expect(nextDue(rule({ freq: "day", interval: 1 }), "2026-11-10", TODAY)).toBe("2026-11-23");
    // Intervallo 3, mantiene il passo.
    expect(nextDue(rule({ freq: "day", interval: 3 }), "2026-11-10", TODAY)).toBe("2026-11-25");
  });
  it("settimanale con giorni", () => {
    const r = rule({ freq: "week", interval: 1, weekdays: [2, 4] });
    expect(nextDue(r, "2026-11-24", "2026-11-24")).toBe("2026-11-26"); // mar → gio
    expect(nextDue(r, "2026-11-26", "2026-11-26")).toBe("2026-12-01"); // gio → mar
    expect(nextDue(r, "2026-11-26", "2026-12-05")).toBe("2026-12-08"); // in ritardo
  });
  it("ogni 2 settimane rispetta la settimana di partenza", () => {
    const r = rule({ freq: "week", interval: 2, weekdays: [1] });
    expect(nextDue(r, "2026-11-23", "2026-11-23")).toBe("2026-12-07");
    expect(nextDue({ freq: "week", interval: 2 }, "2026-11-22", TODAY)).toBe("2026-12-06");
  });
  it("mensile: il 31 cade nell'ultimo giorno dei mesi corti e torna il 31", () => {
    const r = rule({ freq: "month", interval: 1 });
    expect(nextDue(r, "2026-01-31", "2026-01-31")).toBe("2026-02-28");
    expect(nextDue(r, "2026-12-31", "2026-12-31")).toBe("2027-01-31");
    expect(nextDue(r, "2026-11-15", TODAY)).toBe("2026-12-15");
  });
  it("prima occorrenza e descrizione", () => {
    expect(firstDue({ freq: "week", interval: 1, weekdays: [1] }, TODAY)).toBe("2026-11-23");
    expect(describeRecurrence({ freq: "day", interval: 1 })).toBe("Ogni giorno");
    expect(describeRecurrence({ freq: "day", interval: 3 })).toBe("Ogni 3 giorni");
    expect(describeRecurrence({ freq: "week", interval: 1, weekdays: [1, 3, 5] })).toBe("Ogni lunedì, mercoledì e venerdì");
    expect(describeRecurrence({ freq: "week", interval: 1, weekdays: [1, 2, 3, 4, 5] })).toBe("Nei giorni feriali");
    expect(describeRecurrence({ freq: "month", interval: 2 })).toBe("Ogni 2 mesi");
  });
  it("parseRecurrence rifiuta valori non validi", () => {
    expect(parseRecurrence({ freq: "year", interval: 1 })).toBeNull();
    expect(parseRecurrence({ freq: "day", interval: 0 })).toBeNull();
    expect(parseRecurrence({ freq: "week", interval: 1, weekdays: [9, 3, 3] })).toEqual({ freq: "week", interval: 1, weekdays: [3] });
    expect(parseRecurrence(null)).toBeNull();
  });
});

const todo = (over: Partial<Todo> & { id: string }): Todo => ({
  title: over.id,
  notes: null,
  projectId: null,
  parentId: null,
  due: null,
  time: null,
  priority: 4,
  recurrence: null,
  subjectId: null,
  assignmentId: null,
  labelIds: [],
  completedAt: null,
  position: 0,
  createdAt: "2026-11-01T10:00:00Z",
  ...over,
});

describe("completamento", () => {
  it("una normale si chiude, una ricorrente scorre, una chiusa si riapre", () => {
    const now = new Date("2026-11-22T10:00:00Z");
    const plain = todo({ id: "a", due: TODAY });
    const p1 = completionPatch(plain, TODAY, now);
    expect(p1).toEqual({ kind: "done", completedAt: now.toISOString() });
    expect(applyCompletion(plain, p1).completedAt).toBe(now.toISOString());

    const rec = todo({ id: "b", due: TODAY, recurrence: { freq: "day", interval: 1 } });
    const p2 = completionPatch(rec, TODAY, now);
    expect(p2).toEqual({ kind: "rolled", due: "2026-11-23" });
    expect(applyCompletion(rec, p2)).toMatchObject({ due: "2026-11-23", completedAt: null });

    const done = todo({ id: "c", completedAt: now.toISOString() });
    expect(completionPatch(done, TODAY, now)).toEqual({ kind: "reopened" });
  });
});

describe("viste", () => {
  const items = [
    todo({ id: "late", due: "2026-11-20", priority: 2 }),
    todo({ id: "today-p1", due: TODAY, priority: 1 }),
    todo({ id: "today-p3-early", due: TODAY, priority: 3, time: "08:00" }),
    todo({ id: "tomorrow", due: "2026-11-23", projectId: "p1", labelIds: ["l1"] }),
    todo({ id: "far", due: "2027-03-01" }),
    todo({ id: "nodate", projectId: "p1" }),
    todo({ id: "sub", parentId: "nodate", projectId: "p1", due: TODAY }),
    todo({ id: "done", completedAt: "2026-11-21T10:00:00Z" }),
  ];

  it("ordina per data, orario e priorità", () => {
    const ids = [...items].sort(compareTodos).map((t) => t.id);
    expect(ids.slice(0, 4)).toEqual(["late", "today-p3-early", "today-p1", "sub"]);
    expect(ids.slice(-2).sort()).toEqual(["done", "nodate"]);
  });

  it("Oggi include gli scaduti, Prossimi no", () => {
    expect(filterView(items, { type: "today" }, TODAY).map((t) => t.id)).toEqual(["late", "today-p3-early", "today-p1", "sub"]);
    expect(filterView(items, { type: "upcoming" }, TODAY).map((t) => t.id)).toEqual(["today-p3-early", "today-p1", "sub", "tomorrow", "far"]);
  });

  it("Inbox, liste, etichette e completati", () => {
    expect(filterView(items, { type: "inbox" }, TODAY).map((t) => t.id).sort()).toEqual(["far", "late", "today-p1", "today-p3-early"]);
    expect(filterView(items, { type: "project", id: "p1" }, TODAY).map((t) => t.id).sort()).toEqual(["nodate", "tomorrow"]);
    expect(filterView(items, { type: "label", id: "l1" }, TODAY).map((t) => t.id)).toEqual(["tomorrow"]);
    expect(filterView(items, { type: "completed" }, TODAY).map((t) => t.id)).toEqual(["done"]);
  });

  it("raggruppa i prossimi giorni", () => {
    const { groups, later } = groupUpcoming(items, TODAY, 14);
    expect(groups.map((g) => [g.overdue ?? false, g.date, g.items.map((t) => t.id)])).toEqual([
      [true, TODAY, ["late"]],
      [false, TODAY, ["today-p3-early", "today-p1", "sub"]],
      [false, "2026-11-23", ["tomorrow"]],
    ]);
    expect(later.map((t) => t.id)).toEqual(["far"]);
  });

  it("conta i badge senza contare le sotto-attività nelle liste", () => {
    const c = countTodos(items, TODAY);
    expect(c).toMatchObject({ inbox: 4, today: 4, upcoming: 2 });
    expect(c.byProject.get("p1")).toBe(2);
    expect(c.byLabel.get("l1")).toBe(1);
  });

  it("costruisce l'albero e cerca ignorando accenti", () => {
    const [node] = buildTree([items[5]], items);
    expect(node.children.map((t) => t.id)).toEqual(["sub"]);
    expect(node.doneChildren).toBe(0);
    expect(matchesQuery(todo({ id: "x", title: "Perché la Rivoluzione" }), "perche")).toBe(true);
    expect(matchesQuery(todo({ id: "x", title: "abc", notes: "Dante" }), "dante")).toBe(true);
    expect(matchesQuery(todo({ id: "x", title: "abc" }), "zzz")).toBe(false);
  });
});

describe("dueLabel", () => {
  it("legge la scadenza come uno studente", async () => {
    const { dueLabel } = await import("./format");
    expect(dueLabel(TODAY, "17:30", TODAY)).toEqual({ text: "Oggi 17:30", tone: "today" });
    expect(dueLabel("2026-11-23", null, TODAY)).toEqual({ text: "Domani", tone: "soon" });
    expect(dueLabel("2026-11-21", null, TODAY)).toEqual({ text: "Ieri", tone: "overdue" });
    expect(dueLabel("2026-11-10", null, TODAY).tone).toBe("overdue");
    expect(dueLabel("2026-11-10", null, TODAY, true).tone).toBe("later");
    expect(dueLabel("2026-11-27", null, TODAY).tone).toBe("soon");
    expect(dueLabel("2026-12-15", null, TODAY)).toEqual({ text: "15 dic", tone: "later" });
    expect(dueLabel("2027-01-15", null, TODAY).text).toContain("2027");
  });
});
