import { expect, type Locator, type Page } from "@playwright/test";

/** Apre una pagina dell'app e aspetta che l'interfaccia sia davvero interattiva. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  // Il layout dell'app mostra sempre il banner demo: se c'è, la pagina è idratata.
  await expect(page.getByText("Modalità demo", { exact: false }).first()).toBeVisible();
}

/** Nessuna pagina deve scorrere in orizzontale: è il bug più comune su telefono. */
export async function expectNoHorizontalScroll(page: Page) {
  // Con retry: durante le animazioni di transizione la larghezza può oscillare per qualche istante.
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), {
      message: "scroll orizzontale della pagina",
    })
    .toBeLessThanOrEqual(1);
}

/** Raccoglie gli errori JS e le risposte 5xx: ogni spec li controlla alla fine. */
export function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

/** Converte "7,11" (formato italiano) in numero. */
export function it(n: string): number {
  return Number(n.trim().replace("−", "-").replace(",", "."));
}

/**
 * Clic come lo farebbe una persona: porta l'elemento al centro dello schermo, lontano
 * dall'intestazione fissa e dalla barra in basso del telefono, poi tocca.
 */
export async function tap(locator: Locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await locator.click();
}
