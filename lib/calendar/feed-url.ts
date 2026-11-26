/**
 * Validazione dell'indirizzo iCal incollato dallo studente. Il server lo scarica da solo: va
 * accettato solo se punta a un sito pubblico in https (niente indirizzi interni, niente password
 * nell'URL), altrimenti si potrebbe far leggere al server risorse private (SSRF).
 */

export type FeedUrlResult = { ok: true; url: string } | { ok: false; error: string };

const BAD_HOST = /(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/i;

/** True per indirizzi IP privati, di loopback o riservati (IPv4 e IPv6). */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && Number(m[3]) === 0))) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (v.includes(":")) {
    return v === "::" || v === "::1" || /^(fc|fd|fe[89ab])/.test(v) || v.startsWith("ff");
  }
  return false;
}

export function normalizeFeedUrl(input: string): FeedUrlResult {
  let raw = input.trim();
  if (!raw) return { ok: false, error: "Incolla l'indirizzo del calendario." };
  if (raw.length > 2000) return { ok: false, error: "Indirizzo troppo lungo." };
  // webcal:// è https:// con un altro nome (è quello che offrono molti calendari).
  raw = raw.replace(/^webcals?:\/\//i, "https://");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "Questo non sembra un indirizzo valido." };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Serve un indirizzo che inizi con https:// (o webcal://)." };
  if (u.username || u.password) return { ok: false, error: "L'indirizzo non deve contenere nome utente o password." };
  if (u.port && u.port !== "443") return { ok: false, error: "Porta non consentita." };
  const host = u.hostname;
  if (!host.includes(".") && !host.includes(":")) return { ok: false, error: "Indirizzo non consentito." };
  if (BAD_HOST.test(host) || isPrivateIp(host)) return { ok: false, error: "Indirizzo non consentito." };
  return { ok: true, url: u.toString() };
}
