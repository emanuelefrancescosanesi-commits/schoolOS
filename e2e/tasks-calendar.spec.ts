import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, open, trackErrors } from "./helpers";

test.describe("Compiti (demo)", () => {
  test("aggiungere, completare con annulla ed eliminare un compito", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, "/tasks");
    await expectNoHorizontalScroll(page);

    await page.getByLabel("Cosa devi fare?").fill("Esercizi di inglese e2e");
    await page.getByLabel("Materia", { exact: true }).selectOption({ label: "Inglese" });
    await page.getByLabel("Tipo", { exact: true }).selectOption({ label: "Verifica" });
    await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
    await expect(page.getByText("Esercizi di inglese e2e")).toBeVisible();

    // Completa: sparisce e compare l'avviso con Annulla.
    await page.getByRole("checkbox", { name: /Esercizi di inglese e2e/ }).click();
    await expect(page.getByText("Fatto: Esercizi di inglese e2e")).toBeVisible();
    await page.getByRole("button", { name: "Annulla" }).click();
    await expect(page.getByText("Esercizi di inglese e2e")).toBeVisible();

    await page.getByRole("button", { name: "Elimina: Esercizi di inglese e2e" }).click();
    await expect(page.getByText("Eliminato: Esercizi di inglese e2e")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("un titolo vuoto mostra un errore", async ({ page }) => {
    await open(page, "/tasks");
    await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
});

test.describe("Calendario (demo)", () => {
  test("mese, navigazione e aggiunta di un impegno", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, "/calendar");
    await expectNoHorizontalScroll(page);
    const month = page.getByRole("group").filter({ has: page.getByRole("button", { pressed: true }) }).first();
    await expect(month).toBeVisible();

    // Mese successivo e ritorno a oggi.
    await page.getByRole("button", { name: "Mese successivo" }).click();
    await page.getByRole("button", { name: "Oggi", exact: true }).click();

    await page.getByRole("button", { name: "Aggiungi impegno" }).click();
    await page.getByLabel("Titolo").fill("Gita e2e");
    await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
    await expect(page.getByText("Gita e2e").first()).toBeVisible();
    await page.getByRole("button", { name: "Elimina: Gita e2e" }).click();
    await expect(page.getByText("Gita e2e")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
