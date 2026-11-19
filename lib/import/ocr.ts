"use client";

import { cleanOcrText } from "./ocr-text";

/**
 * OCR nel browser: lo screenshot non lascia mai il dispositivo dello studente.
 * Worker, motore e dizionario sono serviti da /ocr (vedi scripts/copy-ocr-assets.mjs).
 */

const TARGET_WIDTH = 2400;
const MAX_SCALE = 3;

/** Ingrandisce gli screenshot piccoli e porta a scuro-su-chiaro quelli in modalità scura. */
async function prepare(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(MAX_SCALE, Math.max(1, TARGET_WIDTH / bitmap.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas non disponibile");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
  const dark = sum / (px.length / 4) < 110;
  for (let i = 0; i < px.length; i += 4) {
    const gray = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    const v = dark ? 255 - gray : gray;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function readScreenshot(file: File, onProgress?: (fraction: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const canvas = await prepare(file);
  const worker = await createWorker("ita", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    gzip: true,
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(canvas);
    return cleanOcrText(data.text);
  } finally {
    await worker.terminate();
  }
}
