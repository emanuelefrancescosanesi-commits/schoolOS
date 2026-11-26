import { afterEach, describe, expect, it, vi } from "vitest";
import { mapGoogleEvents } from "./calendar";
import { googleConfig } from "./config";
import { decryptToken, encryptToken } from "./crypto";
import { senderName } from "./gmail";
import { GOOGLE_SCOPES, buildAuthUrl, emailFromIdToken, exchangeCode, hasScope, refreshAccessToken, GoogleAuthError } from "./oauth";

const KEY = "una-frase-lunga-e-casuale-per-i-test-1234";

describe("cifratura del codice di accesso", () => {
  it("cifra e decifra, con testo diverso a ogni volta", () => {
    const a = encryptToken("1//refresh-token", KEY);
    const b = encryptToken("1//refresh-token", KEY);
    expect(a).not.toBe(b);
    expect(a).not.toContain("refresh-token");
    expect(decryptToken(a, KEY)).toBe("1//refresh-token");
  });
  it("rifiuta dati alterati, chiave sbagliata e formati non validi", () => {
    const enc = encryptToken("segreto", KEY);
    const parts = enc.split(".");
    parts[3] = Buffer.from("manomesso").toString("base64url");
    expect(() => decryptToken(parts.join("."), KEY)).toThrow();
    expect(() => decryptToken(enc, "un-altra-frase-lunga-e-diversa-5678")).toThrow();
    expect(() => decryptToken("v2.a.b.c", KEY)).toThrow();
    expect(() => encryptToken("x", "corta")).toThrow(/24 caratteri/);
  });
});

describe("googleConfig", () => {
  it("è attivo solo con tutte e tre le variabili", () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" })).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", GOOGLE_TOKEN_KEY: "c" })).toEqual({ clientId: "a", clientSecret: "b", tokenKey: "c" });
  });
});

describe("buildAuthUrl", () => {
  it("chiede accesso offline, consenso, sola lettura e porta lo state", () => {
    const u = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://s.it/api/google/callback", state: "st", loginHint: "a@b.it" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("st");
    expect(u.searchParams.get("redirect_uri")).toBe("https://s.it/api/google/callback");
    const scope = u.searchParams.get("scope")!;
    expect(scope).toContain("calendar.readonly");
    expect(scope).toContain("gmail.readonly");
    expect(scope).not.toMatch(/gmail\.(send|modify|compose)|auth\/calendar(?!\.readonly)(\s|$)/);
  });
  it("hasScope", () => {
    expect(hasScope(`${GOOGLE_SCOPES.calendar} openid`, "calendar")).toBe(true);
    expect(hasScope(`${GOOGLE_SCOPES.calendar} openid`, "gmail")).toBe(false);
  });
  it("emailFromIdToken", () => {
    const tok = `x.${Buffer.from(JSON.stringify({ email: "m.rossi@setificio.edu.it" })).toString("base64url")}.y`;
    expect(emailFromIdToken(tok)).toBe("m.rossi@setificio.edu.it");
    expect(emailFromIdToken("rotto")).toBeNull();
    expect(emailFromIdToken(undefined)).toBeNull();
  });
});

describe("scambio dei codici", () => {
  afterEach(() => vi.unstubAllGlobals());
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("scambia il codice e restituisce il refresh token", async () => {
    const f = vi.fn().mockResolvedValue(json({ access_token: "at", refresh_token: "rt", scope: "openid email", id_token: "i" }));
    vi.stubGlobal("fetch", f);
    await expect(exchangeCode({ clientId: "c", clientSecret: "s" }, "code", "https://s.it/cb")).resolves.toMatchObject({ accessToken: "at", refreshToken: "rt" });
    expect(String(f.mock.calls[0][1].body)).toContain("grant_type=authorization_code");
  });
  it("segnala il collegamento revocato/scaduto (invalid_grant) come da ricollegare", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ error: "invalid_grant" }, 400)));
    const err = await refreshAccessToken({ clientId: "c", clientSecret: "s" }, "rt").catch((e) => e);
    expect(err).toBeInstanceOf(GoogleAuthError);
    expect(err.revoked).toBe(true);
    expect(err.message).toMatch(/ricollega/i);
  });
});

describe("senderName", () => {
  it.each([
    ['"Rossi Mario" <m.rossi@scuola.it>', "Rossi Mario"],
    ["Segreteria <segr@scuola.it>", "Segreteria"],
    ["<solo@indirizzo.it>", "solo@indirizzo.it"],
    ["solo@indirizzo.it", "solo@indirizzo.it"],
  ])("%s → %s", (i, o) => expect(senderName(i)).toBe(o));
});

describe("mapGoogleEvents", () => {
  it("converte eventi con orario nel fuso dello studente e salta quelli cancellati", () => {
    const evs = mapGoogleEvents(
      [
        { id: "a", summary: "Verifica di fisica", start: { dateTime: "2026-12-01T08:00:00+01:00" } },
        { id: "b", status: "cancelled", summary: "Annullato", start: { dateTime: "2026-12-02T08:00:00+01:00" } },
        { id: "c", start: { dateTime: "2026-12-03T23:30:00Z" }, summary: "Tardi" },
      ],
      "Europe/Rome",
    );
    expect(evs).toHaveLength(2);
    expect(evs[0]).toMatchObject({ externalId: "a", date: "2026-12-01", time: "08:00", kind: "test" });
    expect(evs[1]).toMatchObject({ date: "2026-12-04", time: "00:30" });
  });
  it("gestisce gli eventi tutto il giorno su più giorni (fine esclusiva) e senza titolo", () => {
    const evs = mapGoogleEvents([{ id: "g", start: { date: "2026-12-10" }, end: { date: "2026-12-13" } }], "Europe/Rome");
    expect(evs.map((e) => e.date)).toEqual(["2026-12-10", "2026-12-11", "2026-12-12"]);
    expect(evs[0].title).toBe("Evento");
    expect(evs[0].time).toBeUndefined();
  });
});
