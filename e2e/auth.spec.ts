import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers";

/**
 * In modalità demo non c'è Supabase: qui si controlla l'interfaccia delle pagine pubbliche.
 * Registrazione reale, conferma email e RLS sono coperte da scripts/e2e-supabase.mjs (backend vero).
 */
test.describe("Pagine pubbliche e accesso (demo)", () => {
  test("login: mostra il modulo, il Google e l'ingresso alla demo", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Accedi a SchoolOS" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continua con Google/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Password dimenticata?" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Esplora la demo" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("registrazione: il consenso età/privacy è obbligatorio e i link legali si aprono", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Crea il tuo account" })).toBeVisible();
    // .first(): su Firefox (CI) il DOM di /signup contiene due #first_name; vedi nota nella PR #41.
    await expect(page.locator("#first_name").first()).toBeVisible();
    await expect(page.getByRole("checkbox")).not.toBeChecked();
    await expectNoHorizontalScroll(page);
    // I link legali si aprono in una nuova scheda, per non perdere il modulo compilato.
    const link = page.getByRole("link", { name: "Leggi l'informativa" });
    await expect(link).toHaveAttribute("href", "/privacy");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("link", { name: "Termini di servizio" }).first()).toHaveAttribute("href", "/termini");
  });

  test("password dimenticata: modulo con email", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Recupera la password" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("link", { name: "Torna all'accesso" })).toBeVisible();
  });

  test("informativa privacy e termini di servizio sono raggiungibili", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Informativa sulla privacy" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.goto("/termini");
    await expect(page.getByRole("heading", { name: "Termini di servizio" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
