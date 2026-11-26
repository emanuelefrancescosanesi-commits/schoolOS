import { expect, test } from "@playwright/test";

/**
 * Prova di fumo: l'app si avvia e React si idrata. Se fallisce, il messaggio riporta
 * gli errori della console del browser: è il primo posto dove guardare quando un browser
 * (per esempio WebKit) rompe tutti gli altri test insieme.
 */
test("la pagina di accesso si idrata e il modulo è visibile", async ({ page }) => {
  const log: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") log.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => log.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("requestfailed", (r) => log.push(`requestfailed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`));

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const state = await page.evaluate(() => ({
    inputs: document.querySelectorAll("input").length,
    hiddenBlocks: document.querySelectorAll("[hidden]").length,
    suspense: document.querySelectorAll("template[id^='B:'], div[id^='S:']").length,
    ua: navigator.userAgent.slice(0, 120),
  }));
  const email = page.locator("#email");
  const visible = await email.first().isVisible().catch(() => false);
  expect(visible, `modulo non visibile. stato=${JSON.stringify(state)} log=${JSON.stringify(log)}`).toBe(true);
});
