#!/usr/bin/env node
/**
 * Copia in public/ocr i file che il riconoscimento dei testi (OCR) scarica nel browser:
 * il worker, il motore WebAssembly e il dizionario italiano. Li serviamo noi, non una CDN,
 * così gli screenshot degli studenti non toccano mai servizi esterni (nemmeno per gli script).
 * Si esegue prima di `dev` e `build`; la cartella è ignorata da git.
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const out = "public/ocr";
const core = "node_modules/tesseract.js-core";
const worker = "node_modules/tesseract.js/dist/worker.min.js";
const lang = "node_modules/@tesseract.js-data/ita/4.0.0_best_int/ita.traineddata.gz";

if (!existsSync(worker) || !existsSync(core) || !existsSync(lang)) {
  console.error("Dipendenze OCR mancanti: esegui npm install.");
  process.exit(1);
}

mkdirSync(out, { recursive: true });
cpSync(worker, join(out, "worker.min.js"));
cpSync(lang, join(out, "ita.traineddata.gz"));
for (const file of readdirSync(core)) {
  if (file.endsWith("-lstm.wasm.js")) cpSync(join(core, file), join(out, file));
}
console.log(`OCR: asset copiati in ${out}`);
