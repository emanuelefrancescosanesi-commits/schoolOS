import { describe, expect, it, vi } from "vitest";
import { type WebviewDriver, runRegistrySync } from "@/lib/registry/session";
import type { RegistryRule } from "@/lib/registry/schema";

const rule: RegistryRule = {
  registry: "axios",
  label: "Axios",
  enabled: true,
  hosts: ["axioscloud.it"],
  loginUrl: "https://segreteriadigitale.axioscloud.it/login",
  home: { tile: "a", tileLabel: "h4", tileText: "voti" },
  datasets: { grades: {} },
};
const msg = (o: object) => ({ source: "schoolos-registry", v: 1, registry: "axios", ...o });
const row = { subject: "Matematica", date: "2026-10-27", value: 8, kind: "written" };

function fake() {
  const h: Record<string, (x?: never) => void> = {};
  const calls: string[] = [];
  const d: WebviewDriver = {
    open: async ({ url, hidden }) => (calls.push(`open:${hidden ? "hidden" : "visible"}:${url}`), "w1"),
    show: async () => void calls.push("show"),
    close: async () => void calls.push("close"),
    run: async (_id, code) => void calls.push(code.includes("t.click") ? "click" : "run"),
    navigate: async (_id, url) => void calls.push(`nav:${url}`),
    onPageLoaded: (_i, fn) => ((h.page = fn as never), () => {}),
    onMessage: (_i, fn) => ((h.msg = fn as never), () => {}),
    onUrl: (_i, fn) => ((h.url = fn as never), () => {}),
    onClosed: (_i, fn) => ((h.closed = fn as never), () => {}),
  };
  return { d, h, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("sessione di lettura del registro", () => {
  it("sessione valida: webview nascosta → righe → invio → chiusa, mai mostrata", async () => {
    const { d, h, calls } = fake();
    const upload = vi.fn(async () => ({ inserted: 1 }));
    const p = runRegistrySync({ driver: d, rule, engine: "/*e*/", upload });
    await tick();
    h.page();
    h.msg(msg({ state: "rows", rows: [row], origin: "https://reg.axioscloud.it", path: "/Voti" }) as never);
    const out = await p;
    expect(out).toEqual({ ok: true, rows: 1, result: { inserted: 1 }, resumeUrl: "https://reg.axioscloud.it/Voti" });
    expect(upload).toHaveBeenCalledWith([row]);
    expect(calls).toEqual([`open:hidden:${rule.loginUrl}`, "run", "close"]);
  });

  it("sessione scaduta: mostra la webview per il login, poi legge", async () => {
    const { d, h, calls } = fake();
    const p = runRegistrySync({ driver: d, rule, engine: "", upload: async () => ({}) });
    await tick();
    h.msg(msg({ state: "login" }) as never);
    await tick();
    h.msg(msg({ state: "rows", rows: [row] }) as never);
    expect((await p).ok).toBe(true);
    expect(calls).toContain("show");
  });

  it("home: apre il riquadro Voti (indirizzo o clic) e ignora i messaggi non validi o di altri registri", async () => {
    const { d, h, calls } = fake();
    const p = runRegistrySync({ driver: d, rule, engine: "", upload: async () => ({}) });
    await tick();
    h.msg({ source: "evil", state: "rows", rows: [row] } as never);
    h.msg(msg({ registry: "argo", state: "rows", rows: [row] }) as never);
    h.msg(msg({ state: "tile", next: "https://evil.example/x" }) as never); // fuori dominio: non si naviga
    h.msg(msg({ state: "tile", next: "https://reg.axioscloud.it/Voti" }) as never);
    h.msg(msg({ state: "tile" }) as never);
    h.msg(msg({ state: "rows", rows: [row] }) as never);
    expect((await p).ok).toBe(true);
    expect(calls).toContain("nav:https://reg.axioscloud.it/Voti");
    expect(calls).toContain("click");
    expect(calls.filter((c) => c.startsWith("nav:"))).toHaveLength(1);
  });

  it("righe non valide, pagina fuori dominio, chiusura e timeout chiudono senza inviare", async () => {
    for (const [trigger, reason] of [
      [(h: ReturnType<typeof fake>["h"]) => h.msg(msg({ state: "rows", rows: [{ subject: "", value: 99 }] }) as never), "invalid"],
      [(h: ReturnType<typeof fake>["h"]) => h.url("https://evil.example/" as never), "blocked"],
      [(h: ReturnType<typeof fake>["h"]) => h.closed(), "closed"],
    ] as const) {
      const { d, h } = fake();
      const upload = vi.fn();
      const p = runRegistrySync({ driver: d, rule, engine: "", upload });
      await tick();
      trigger(h);
      expect(await p).toMatchObject({ ok: false, reason });
      expect(upload).not.toHaveBeenCalled();
    }
    const { d } = fake();
    expect(await runRegistrySync({ driver: d, rule, engine: "", upload: vi.fn(), totalMs: 5, hiddenMs: 1 })).toMatchObject({ reason: "timeout" });
  });

  it("registro spento dalle regole: non apre nulla", async () => {
    const { d, calls } = fake();
    expect(await runRegistrySync({ driver: d, rule: { ...rule, enabled: false }, engine: "", upload: vi.fn() })).toEqual({ ok: false, reason: "disabled" });
    expect(calls).toEqual([]);
  });
});
