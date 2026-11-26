import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, open, trackErrors } from "./helpers";

test.describe("Da fare con aggiunta rapida (demo)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "/todo");
  });

  test("l'aggiunta rapida riconosce priorità, ora e materia e salva l'attività", async ({ page }) => {
    const errors = trackErrors(page);
    const input = page.getByLabel("Aggiungi un'attività");
    await input.fill("Ripasso storia domani alle 15 p1 +storia");
    // Mentre scrivi compaiono le parti riconosciute.
    const feedback = page.locator("#quick-add-feedback");
    await expect(feedback).toContainText("15:00");
    await expect(feedback).toContainText("Storia");
    await input.press("Enter");

    await expect(input).toHaveValue("");
    // Il titolo resta pulito: solo "Ripasso storia".
    // È per domani: la trovi in «Prossimi», con priorità P1 e materia Storia.
    await page.getByRole("button", { name: /^Prossimi/ }).first().click();
    await expect(page.getByRole("button", { name: /^Ripasso storia/ }).first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Segna come fatt[oa]: Ripasso storia \(.*\)/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("un testo vuoto non crea nulla e avvisa", async ({ page }) => {
    await page.getByRole("button", { name: "Aggiungi", exact: true }).click();
    await expect(page.getByText("Scrivi cosa devi fare.")).toBeVisible();
  });

  test("spuntare un'attività la sposta in Completati; si può rimettere da fare", async ({ page }) => {
    const input = page.getByLabel("Aggiungi un'attività");
    await input.fill("Preparare lo zaino oggi");
    await input.press("Enter");
    await page.getByRole("checkbox", { name: /Segna come fatt[oa]: Preparare lo zaino/ }).click();
    await expect(page.getByRole("checkbox", { name: /Segna come fatt[oa]: Preparare lo zaino/ })).toHaveCount(0);

    await page.getByRole("button", { name: /^Completati/ }).first().click();
    const undone = page.getByRole("checkbox", { name: /Segna come da fare: Preparare lo zaino/ });
    await expect(undone).toBeVisible();
    await undone.click();
    await expect(undone).toHaveCount(0);
  });

  test("aprire il dettaglio, aggiungere una sotto-attività ed eliminare l'attività", async ({ page }) => {
    const input = page.getByLabel("Aggiungi un'attività");
    await input.fill("Progetto di fisica oggi");
    await input.press("Enter");
    await page.getByRole("button", { name: /^Progetto di fisica/ }).first().click();

    await page.getByLabel("Aggiungi sotto-attività").first().fill("Raccogliere i dati");
    await page.getByLabel("Aggiungi sotto-attività").first().press("Enter");
    await expect(page.getByText("Raccogliere i dati").first()).toBeVisible();

    await page.getByRole("button", { name: "Elimina attività", exact: true }).click();
    await page.getByRole("button", { name: "Conferma eliminazione" }).click();
    await expect(page.getByRole("button", { name: /^Progetto di fisica/ })).toHaveCount(0);
  });

  test("la ricerca filtra la lista e la navigazione tra le viste funziona", async ({ page }) => {
    await expectNoHorizontalScroll(page);
    const search = page.getByLabel("Cerca nelle attività");
    await search.fill("zzzz-niente");
    await expect(page.getByText("Nessuna attività corrisponde alla ricerca.")).toBeVisible();
    await search.fill("");
    await page.getByRole("button", { name: /^Prossimi/ }).first().click();
    await expect(page.getByRole("heading", { name: "Prossimi" })).toBeVisible();
  });
});
