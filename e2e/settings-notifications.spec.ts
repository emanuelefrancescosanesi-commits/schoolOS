import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, open, trackErrors } from "./helpers";

test.describe("Impostazioni (demo)", () => {
  test("le schede si vedono e in demo il salvataggio avvisa che non salva nulla", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, "/settings");
    await expect(page.getByRole("heading", { name: "Impostazioni" })).toBeVisible();
    await expect(page.getByText("Modalità demo: nessun account collegato.")).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Profilo: si può modificare il nome, ma non viene salvato.
    const name = page.getByRole("textbox", { name: "Nome", exact: true }).last();
    await name.fill("Marta");
    await page.getByRole("button", { name: "Salva", exact: true }).first().click();
    await expect(page.getByText("Modalità demo: puoi provare i campi, ma non salviamo nulla.").first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("cambio password e cambio email: i moduli esistono con tutti i campi", async ({ page }) => {
    await open(page, "/settings");
    await expect(page.getByRole("heading", { name: "Cambia password" })).toBeVisible();
    await expect(page.getByLabel("Password attuale").first()).toBeVisible();
    await expect(page.getByLabel("Nuova password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Ripeti la nuova password")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cambia email" })).toBeVisible();
    await expect(page.getByLabel("Nuova email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Esci da tutti i dispositivi" })).toBeVisible();
  });

  test("il tema si può cambiare e la scelta resta dopo il ricaricamento", async ({ page }) => {
    await open(page, "/settings");
    // Il radio vero è nascosto: si clicca l'etichetta, come fa l'utente.
    await page.locator("label").filter({ hasText: "Scuro" }).first().click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("Notifiche, Inbox e Analisi (demo)", () => {
  test("segnare una notifica come letta aggiorna il contatore; «Segna tutte» lo azzera", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, "/notifications");
    await expect(page.getByText("4 notifiche da leggere")).toBeVisible();
    await page.getByRole("button", { name: /^Segna come letta: / }).first().click();
    await expect(page.getByText("3 notifiche da leggere")).toBeVisible();
    await page.getByRole("button", { name: "Segna tutte come lette" }).click();
    await expect(page.getByText("Nessuna notifica da leggere")).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });

  test("Inbox: aggiungere una comunicazione e filtrare le non lette", async ({ page }) => {
    await open(page, "/inbox");
    await page.getByLabel("Oggetto").fill("Gita al museo e2e");
    await page.getByLabel("Da chi (facoltativo)").fill("Segreteria");
    await page.getByRole("button", { name: "Salva comunicazione" }).click();
    await expect(page.getByText("Gita al museo e2e").first()).toBeVisible();
    await page.getByRole("button", { name: "Segna tutto come letto" }).click();
    await expect(page.getByText("Tutto letto").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("Analisi: piano di recupero e grafico dell'andamento", async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, "/analytics");
    await expect(page.getByRole("heading", { name: "Analisi" })).toBeVisible();
    await expect(page.getByText("Da recuperare")).toBeVisible();
    await expect(page.getByText(/per arrivare a 6 serve/).first()).toBeVisible();
    await expect(page.getByText("Andamento della media")).toBeVisible();
    await expect(page.locator("svg.recharts-surface").first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
});
