import { expect, test, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, it, open, tap, trackErrors } from "./helpers";

/** Legge la media generale dalla statistica in alto. */
async function average(page: Page): Promise<number> {
  const text = await page.getByText("Media generale", { exact: true }).first().locator("xpath=..").innerText();
  return it(text.replace("Media generale", ""));
}

/** Numero di voti, dal sottotitolo «19 voti registrati». */
async function count(page: Page): Promise<number> {
  const text = await page.getByText(/^\d+ voti? registrat/).innerText();
  return Number(text.split(" ")[0]);
}

test.describe("Voti e media (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/grades");
    // Per confrontare medie e conteggi serve lo stesso insieme di voti: tutto l'anno.
    await page.getByRole("button", { name: "Tutto l'anno" }).click();
  });

  test("aggiungere un voto aggiorna conteggio e media; il preview interpreta 7½", async ({ page }) => {
    const errors = trackErrors(page);
    const before = { avg: await average(page), n: await count(page) };

    await page.getByLabel("Materia", { exact: true }).first().selectOption({ label: "Matematica" });
    const value = page.getByLabel("Voto", { exact: true });
    await value.fill("7½");
    await expect(page.getByText("Vale 7,5")).toBeVisible();
    await value.fill("10");
    await tap(page.getByRole("button", { name: "Aggiungi", exact: true }));

    await expect(page.getByText("Aggiunto 10 in Matematica")).toBeVisible();
    await expect(page.getByLabel("Voto", { exact: true })).toHaveValue("");
    await expect.poll(async () => await count(page)).toBe(before.n + 1);
    // Un 10 alza sempre la media generale (era sotto il 10).
    await expect.poll(async () => await average(page)).toBeGreaterThan(before.avg);
    expect(errors).toEqual([]);
  });

  test("un voto non valido mostra un errore e non cambia nulla", async ({ page }) => {
    const n = await count(page);
    await page.getByLabel("Voto", { exact: true }).fill("abc");
    await tap(page.getByRole("button", { name: "Aggiungi", exact: true }));
    await expect(page.getByRole("alert").or(page.locator("[role=status], p").filter({ hasText: /voto|valore|non/i })).first()).toBeVisible();
    expect(await count(page)).toBe(n);
  });

  test("modificare un voto cambia la media subito", async ({ page }) => {
    const before = await average(page);
    await tap(page.getByRole("button", { name: /^Modifica voto: / }).first());
    await expect(page.getByRole("heading", { name: "Modifica voto" })).toBeVisible();
    await page.getByLabel("Voto", { exact: true }).last().fill("10");
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(page.getByRole("heading", { name: "Modifica voto" })).toBeHidden();
    await expect.poll(async () => await average(page)).not.toBe(before);
  });

  test("eliminare un voto lo toglie dal conteggio e Annulla lo ripristina", async ({ page }) => {
    const n = await count(page);
    await tap(page.getByRole("button", { name: /^Elimina voto: / }).first());
    await expect(page.getByText("Voto eliminato")).toBeVisible();
    await expect.poll(async () => await count(page)).toBe(n - 1);
    await page.getByRole("button", { name: "Annulla" }).click();
    await expect.poll(async () => await count(page)).toBe(n);
  });

  test("filtri per materia e ordinamento; senza scroll orizzontale", async ({ page }) => {
    await page.getByLabel("Materia", { exact: true }).last().selectOption({ label: "Fisica" });
    await expect(page.getByRole("heading", { name: "Fisica" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Italiano" })).toBeHidden();
    await page.getByLabel("Ordina per").selectOption("value");
    await expectNoHorizontalScroll(page);
  });
});
