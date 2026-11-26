import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifratura del codice di accesso a Google (AES-256-GCM). Il database custodisce solo il testo
 * cifrato: senza la chiave (variabile GOOGLE_TOKEN_KEY, che sta su Vercel e non nel database)
 * non si può leggere né modificare senza che la verifica fallisca.
 * Formato: v1.<iv>.<tag>.<testo>, tutto in base64url.
 */

/** La chiave è una frase lunga a piacere (almeno 24 caratteri): se ne ricava la chiave a 32 byte con SHA-256. */
function keyFrom(secret: string): Buffer {
  if (secret.length < 24) throw new Error("GOOGLE_TOKEN_KEY deve essere una frase di almeno 24 caratteri (vedi la guida).");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptToken(enc: string, secret: string): string {
  const [v, iv, tag, ct] = enc.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Codice cifrato non valido.");
  const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
