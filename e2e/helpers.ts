import { expect, type Locator, type Page } from "@playwright/test";

/** Apre una pagina dell'app e aspetta che l'interfaccia sia davvero interattiva. */
export async function open(page: Page, path: string, opts: { banner?: boolean } = {}) {
  await page.goto(path);
  // Aspetta l'idratazione di React: un clic prima di quel momento (WebKit su CI è più lento)
  // farebbe inviare il modulo al server invece di passare al passo successivo.
  await page.waitForLoadState("networkidle");
  // Il layout dell'app mostra sempre il banner demo (le pagine legali no).
  if (opts.banner === false) return;
  await expect(page.getByText("Modalità demo", { exact: false }).first()).toBeVisible();
}

/**
 * Nessuna pagina deve essere più larga dello schermo: è il bug più comune su telefono.
 * Su un telefono vero (e nell'emulazione mobile) il browser non scorre di lato: rimpicciolisce
 * la pagina finché ci sta, quindi `innerWidth` supera la larghezza reale. Si controllano
 * entrambe le cose e, se fallisce, il messaggio dice quali elementi sbordano.
 */
export async function expectNoHorizontalScroll(page: Page) {
  const width = page.viewportSize()?.width ?? 0;
  const measure = () =>
    page.evaluate((w) => {
      const wide = [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > w + 1 && !e.closest("[data-scroll-x], nav"))
        .slice(0, 5)
        .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)} →${Math.round(e.getBoundingClientRect().right)}`);
      return { over: Math.max(innerWidth, document.documentElement.scrollWidth) - w, wide };
    }, width);
  // Con retry: durante le animazioni di transizione la larghezza può oscillare per qualche istante.
  await expect.poll(async () => (await measure()).over, { message: `pagina più larga di ${width}px: ${JSON.stringify((await measure()).wide)}` }).toBeLessThanOrEqual(1);
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
 * Se il clic non riesce, l'errore contiene cosa copre il pulsante (utile in CI, dove non si vede lo schermo).
 */
export async function tap(locator: Locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: "center" }));
  try {
    await locator.click({ timeout: 8_000 });
  } catch (error) {
    const info = await locator
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const describe = (n: Element) => `${n.tagName.toLowerCase()}.${String(n.className).slice(0, 60)}`;
        return JSON.stringify({
          rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
          viewport: [window.innerWidth, window.innerHeight],
          scrollY: Math.round(window.scrollY),
          docHeight: document.documentElement.scrollHeight,
          stack: document.elementsFromPoint(x, y).slice(0, 5).map(describe),
        });
      })
      .catch(() => "n/d");
    throw new Error(`tap fallito: ${info}\n${String(error).slice(0, 300)}`);
  }
}
