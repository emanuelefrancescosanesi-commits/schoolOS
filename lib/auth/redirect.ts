export const DEFAULT_AFTER_LOGIN = "/dashboard";

/**
 * Accetta solo percorsi interni come destinazione dopo il login, per evitare
 * open redirect del tipo /login?next=https://sito-malevolo.example.
 */
export function safeNextPath(value: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!value) return fallback;
  let path = value.trim();
  try {
    // Un valore doppiamente codificato non deve aggirare il controllo.
    if (/%2f|%5c/i.test(path)) path = decodeURIComponent(path);
  } catch {
    return fallback;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (/[\r\n\t]/.test(path) || path.includes("\\")) return fallback;
  // Il login stesso non è una destinazione utile.
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/auth/")) return fallback;
  return path;
}
