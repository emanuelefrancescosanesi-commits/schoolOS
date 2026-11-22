import { describe, expect, it } from "vitest";
import { buildDemoDataset } from "@/lib/demo/dataset";
import { DEFAULT_LAYOUT, WIDGET_IDS, moveWidget, parseLayout, serializeLayout, setHidden } from "./layout";
import { buildDashboard } from "./view-model";

describe("parseLayout", () => {
  it("usa la disposizione predefinita se il cookie manca o è corrotto", () => {
    expect(parseLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout("{non json")).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout("42")).toEqual(DEFAULT_LAYOUT);
  });

  it("scarta id sconosciuti e duplicati e aggiunge i widget nuovi in coda", () => {
    const layout = parseLayout(JSON.stringify({ order: ["inbox", "bogus", "inbox", "tasks"], hidden: ["week", "x"] }));
    expect(layout.order.slice(0, 2)).toEqual(["inbox", "tasks"]);
    expect([...layout.order].sort()).toEqual([...WIDGET_IDS].sort());
    expect(layout.hidden).toEqual(["week"]);
  });

  it("fa il giro completo con serializeLayout", () => {
    const layout = setHidden(DEFAULT_LAYOUT, "inbox", true);
    expect(parseLayout(serializeLayout(layout))).toEqual(layout);
  });
});

describe("moveWidget e setHidden", () => {
  it("scambia con il vicino visibile, saltando i nascosti", () => {
    const layout = setHidden(DEFAULT_LAYOUT, "upcoming", true);
    // ordine: performance, (upcoming nascosto), tasks, week, inbox
    const moved = moveWidget(layout, "tasks", -1);
    expect(moved.order.indexOf("tasks")).toBeLessThan(moved.order.indexOf("performance"));
  });

  it("non sposta oltre i bordi", () => {
    expect(moveWidget(DEFAULT_LAYOUT, "performance", -1)).toBe(DEFAULT_LAYOUT);
    expect(moveWidget(DEFAULT_LAYOUT, "inbox", 1)).toBe(DEFAULT_LAYOUT);
  });

  it("mostra e nasconde mantenendo l'ordine", () => {
    const hidden = setHidden(setHidden(DEFAULT_LAYOUT, "week", true), "performance", true);
    expect(hidden.hidden).toEqual(["performance", "week"]);
    expect(setHidden(hidden, "week", false).hidden).toEqual(["performance"]);
  });
});

describe("buildDashboard con il dataset demo", () => {
  // Date diverse per coprire inizio anno, metà periodo e cambio periodo.
  it.each(["2026-09-15", "2026-11-19", "2027-01-08", "2027-05-30"])("produce dati coerenti il %s", (today) => {
    const vm = buildDashboard(buildDemoDataset(today), today, 9);

    expect(vm.isDemo).toBe(true);
    expect(vm.performance.overall).not.toBeNull();
    expect(vm.performance.subjects.length).toBe(8);
    expect(vm.week).toHaveLength(7);
    expect(vm.week.filter((d) => d.isToday)).toHaveLength(1);
    expect(vm.tasks.every((r) => !r.task.done)).toBe(true);
    expect(vm.upcoming.every((r) => r.daysLeft >= 0 && r.daysLeft <= 14)).toBe(true);
    expect(vm.messages.length).toBeLessThanOrEqual(4);
  });

  it("segnala le materie insufficienti con il voto necessario", () => {
    const vm = buildDashboard(buildDemoDataset("2026-11-19"), "2026-11-19", 9);
    const fisica = vm.performance.subjects.find((s) => s.subject.id === "fis");
    expect(fisica?.standing).not.toBe("positive");
    expect(fisica?.needed).toEqual({ status: "reachable", value: expect.any(Number) });
    const inglese = vm.performance.subjects.find((s) => s.subject.id === "ing");
    expect(inglese?.needed).toBeNull();
  });

  it("mette in cima i compiti scaduti e le verifiche vicine", () => {
    const vm = buildDashboard(buildDemoDataset("2026-11-19"), "2026-11-19", 9);
    expect(vm.tasks[0].priority).toBe("high");
    const scores = vm.tasks.map((r) => r.priority);
    expect(scores.indexOf("low")).toBeGreaterThan(scores.lastIndexOf("high"));
  });

  it("ordina le comunicazioni dalla più recente", () => {
    const vm = buildDashboard(buildDemoDataset("2026-11-19"), "2026-11-19", 9);
    const keys = vm.messages.map((m) => `${m.date}${m.time}`);
    expect(keys).toEqual([...keys].sort().reverse());
  });
});

describe("buildDashboard con eventi del calendario", () => {
  const today = "2026-11-23";
  it("le verifiche inserite nel calendario compaiono tra gli impegni in arrivo e nel riepilogo", () => {
    const data = buildDemoDataset(today);
    const base = buildDashboard(data, today, 10);
    const withEvent = buildDashboard(
      { ...data, events: [...data.events, { id: "ev-x", title: "Verifica sui limiti", date: "2026-11-25", kind: "test" }] },
      today,
      10,
    );
    expect(withEvent.upcoming.some((r) => r.task.title === "Verifica sui limiti")).toBe(true);
    expect(withEvent.summary.tests).toBe(base.summary.tests + 1);
  });
  it("gli eventi generici o già passati non diventano impegni", () => {
    const data = buildDemoDataset(today);
    const base = buildDashboard(data, today, 10);
    const vm = buildDashboard(
      {
        ...data,
        events: [
          { id: "g", title: "Assemblea", date: "2026-11-25", kind: "event" },
          { id: "p", title: "Verifica passata", date: "2026-11-01", kind: "test" },
        ],
      },
      today,
      10,
    );
    expect(vm.upcoming.map((r) => r.task.id)).toEqual(base.upcoming.map((r) => r.task.id));
  });
});
