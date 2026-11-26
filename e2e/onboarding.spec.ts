import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, open, trackErrors } from "./helpers";

test.describe("Onboarding (demo)", () => {
  test("percorre tutti i passi fino al riepilogo e finisce senza salvare", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, "/onboarding");
    await expect(page.getByText("Modalità demo: puoi provare tutti i passi")).toBeVisible();

    // 1. Nome: obbligatorio.
    await expect(page.getByRole("heading", { name: "Come ti chiami?" })).toBeVisible();
    await page.getByRole("button", { name: "Avanti" }).click();
    await expect(page.getByRole("heading", { name: "Come ti chiami?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Giulia");
    await page.getByRole("button", { name: "Avanti" }).click();

    // 2. Scuola e 3. classe: facoltative.
    await expect(page.getByRole("heading", { name: "Che scuola frequenti?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Nome della scuola" }).fill("Liceo Test");
    await page.getByRole("button", { name: "Avanti" }).click();
    await expect(page.getByRole("heading", { name: "In che classe sei?" })).toBeVisible();
    await page.getByRole("textbox", { name: "Classe" }).fill("3B");
    await page.getByRole("button", { name: "Avanti" }).click();

    // 4. Anno e periodi.
    await expect(page.getByRole("heading", { name: "Anno scolastico e periodi" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("button", { name: "Avanti" }).click();

    // 5. Materie: aggiungo una materia personalizzata.
    await expect(page.getByRole("heading", { name: "Le tue materie" })).toBeVisible();
    await page.getByRole("textbox", { name: "Aggiungi materia" }).fill("Latino");
    await page.getByRole("button", { name: "Aggiungi materia" }).click();
    await expect(page.getByRole("button", { name: "Rimuovi Latino" })).toBeVisible();
    await page.getByRole("button", { name: "Avanti" }).click();

    // 6. Scala dei voti e 7. registro.
    await expect(page.getByRole("heading", { name: "Come vengono dati i voti" })).toBeVisible();
    await page.getByRole("button", { name: "Avanti" }).click();
    await expect(page.getByRole("heading", { name: "Quale registro elettronico usa la scuola?" })).toBeVisible();
    await page.getByRole("button", { name: "Avanti" }).click();

    // Riepilogo e fine.
    await expect(page.getByRole("heading", { name: "Tutto pronto" })).toBeVisible();
    await expect(page.getByText("Giulia").first()).toBeVisible();
    await expect(page.getByText("Latino").first()).toBeVisible();
    await page.getByRole("button", { name: "Inizia a usare SchoolOS" }).click();
    await expect(page.getByText("In modalità demo non è stato salvato nulla")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("il tasto Indietro riporta al passo precedente", async ({ page }) => {
    await open(page, "/onboarding");
    await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Luca");
    await page.getByRole("button", { name: "Avanti" }).click();
    await page.getByRole("button", { name: "Indietro" }).click();
    await expect(page.getByRole("heading", { name: "Come ti chiami?" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue("Luca");
  });
});
