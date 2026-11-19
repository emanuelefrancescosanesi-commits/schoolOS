/**
 * Limiti sugli ingressi dell'importazione. Si applicano nel server, perché il client può
 * essere aggirato; il client li usa solo per avvisare prima.
 */

export const MAX_TEXT_CHARS = 15_000;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

export type ImportInput =
  | { kind: "text"; text: string }
  | { kind: "image"; mediaType: ImageType; base64: string; bytes: number };

export type InputResult = { ok: true; input: ImportInput } | { ok: false; error: string };

/** Riconosce il formato dai primi byte: il tipo dichiarato dal browser non è affidabile. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const startsWith = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (startsWith(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    return "image/webp";
  return null;
}

/** Valida il testo incollato o il file caricato dal modulo di importazione. */
export async function readImportInput(text: unknown, file: unknown): Promise<InputResult> {
  const hasFile = typeof File !== "undefined" && file instanceof File && file.size > 0;

  if (hasFile) {
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "L'immagine è troppo grande (massimo 4 MB)." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = sniffImageType(bytes);
    if (!mediaType) return { ok: false, error: "Carica uno screenshot in formato PNG, JPG, WebP o GIF." };
    return { ok: true, input: { kind: "image", mediaType, base64: Buffer.from(bytes).toString("base64"), bytes: bytes.length } };
  }

  const value = typeof text === "string" ? text.trim() : "";
  if (!value) return { ok: false, error: "Incolla il testo dei voti oppure carica uno screenshot." };
  if (value.length > MAX_TEXT_CHARS)
    return { ok: false, error: `Il testo è troppo lungo (massimo ${MAX_TEXT_CHARS.toLocaleString("it-IT")} caratteri).` };
  return { ok: true, input: { kind: "text", text: value } };
}
