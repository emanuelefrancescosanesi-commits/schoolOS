// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engine = require("../../public/registry/engine.js");
const rules = JSON.parse(readFileSync("public/registry/rules.json", "utf8"));
const axios = rules.registries.axios;

// Pagina voti Axios di prova (dati inventati): stessa struttura della pagina vera.
const GRID = `
<div class="select9-chosen">TRIMESTRE (01/09/2026 - 22/12/2026)</div>
<table class="rdoc_full_alunni"><tbody>
  <tr><td>Matematica</td></tr><tr><td>Biologia</td></tr><tr class="bg-grey-cararra"><td>Media</td></tr><tr><td>Storia dell’arte</td></tr>
</tbody></table>
<table class="rdoc_full_valutazioni"><thead><tr><th>29<br>set</th><th colspan="2">14<br>ott</th><th>5<br>gen</th></tr></thead><tbody>
  <tr><td class="voto voto_S_positivo">8</td><td class="voto voto_O_negativo">5,5</td><td></td><td></td></tr>
  <tr><td></td><td class="voto voto_O_positivo" title="Peso 50%">8</td><td class="voto voto_no_media">DIST</td><td class="voto voto_P_positivo">9,50</td></tr>
  <tr class="bg-grey-cararra"><td colspan="4">7</td></tr>
  <tr><td class="voto voto_G_positivo">7</td><td></td><td></td><td></td></tr>
</tbody></table>`;

describe("motore di lettura registri (Axios)", () => {
  it("legge materia, data, voto, tipo e peso dalla griglia", () => {
    document.body.innerHTML = GRID;
    const rows = engine.extractGrid(document, axios.datasets.grades, new Date("2026-11-20"));
    expect(rows).toEqual([
      { subject: "Matematica", date: "2026-09-29", value: 8, kind: "written" },
      { subject: "Matematica", date: "2026-10-14", value: 5.5, kind: "oral" },
      { subject: "Biologia", date: "2026-10-14", value: 8, kind: "oral", weight: 0.5 },
      { subject: "Biologia", date: "2027-01-05", value: 9.5, kind: "practical" },
      { subject: "Storia dell’arte", date: "2026-09-29", value: 7, kind: "practical" },
    ]);
  });

  it("restituisce null se la pagina non è la griglia voti", () => {
    document.body.innerHTML = "<p>Home</p>";
    expect(engine.extractGrid(document, axios.datasets.grades, new Date())).toBeNull();
  });

  it("senza periodo nella pagina deduce l'anno scolastico da oggi", () => {
    document.body.innerHTML = GRID.replace(/<div class="select9-chosen">.*<\/div>/, "");
    const rows = engine.extractGrid(document, axios.datasets.grades, new Date("2027-02-01"));
    expect(rows[0].date).toBe("2026-09-29");
  });

  it("accetta solo i domini del registro", () => {
    expect(engine.hostAllowed("registrofamiglie.axioscloud.it", axios)).toBe(true);
    expect(engine.hostAllowed("axioscloud.it", axios)).toBe(true);
    expect(engine.hostAllowed("evilaxioscloud.it", axios)).toBe(false);
    expect(engine.hostAllowed("axioscloud.it.evil.com", axios)).toBe(false);
  });

  it("step: griglia in pagina → rows; login → login; home con riquadro → fetch o tile", async () => {
    const win = (html: string, fetchHtml?: string) => {
      document.body.innerHTML = html;
      return {
        document,
        location: new URL("https://registrofamiglie.axioscloud.it/Home"),
        DOMParser,
        fetch: async () => ({ text: async () => fetchHtml ?? "" }),
      };
    };
    expect((await engine.step(win(GRID), axios)).state).toBe("rows");
    expect((await engine.step(win('<input type="password">'), axios)).state).toBe("login");
    const tile = '<a class="family-tile" href="/Voti.aspx"><h4>Voti</h4></a>';
    const viaFetch = await engine.step(win(tile, GRID), axios);
    expect(viaFetch).toMatchObject({ state: "rows", via: "fetch" });
    const noGrid = await engine.step(win(tile, "<p>boh</p>"), axios);
    expect(noGrid).toMatchObject({ state: "tile", next: "https://registrofamiglie.axioscloud.it/Voti.aspx" });
    const js = await engine.step(win('<a class="family-tile" href="javascript:go()"><h4>Voti</h4></a>'), axios);
    expect(js).toMatchObject({ state: "tile", hrefKind: "javascript" });
    const other = { ...win("<p>x</p>"), location: new URL("https://altro.example/") };
    expect((await engine.step(other, axios)).state).toBe("blocked");
  });
});
