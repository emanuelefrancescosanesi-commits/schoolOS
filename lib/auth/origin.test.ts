import { describe, expect, it } from "vitest";
import { resolveSiteOrigin } from "./origin";

describe("resolveSiteOrigin", () => {
  it("preferisce NEXT_PUBLIC_SITE_URL e ignora l'header Host", () => {
    expect(resolveSiteOrigin({ configured: "https://schoolos.example/", host: "evil.example", production: true })).toBe(
      "https://schoolos.example",
    );
  });

  it("in produzione rifiuta un indirizzo configurato senza https", () => {
    expect(() => resolveSiteOrigin({ configured: "http://schoolos.example", production: true })).toThrow(/https/);
  });

  it("usa il dominio di produzione di Vercel se manca la variabile", () => {
    expect(resolveSiteOrigin({ vercelProductionHost: "school-os-brown.vercel.app", host: "evil.example", production: true })).toBe(
      "https://school-os-brown.vercel.app",
    );
  });

  it("in produzione non si fida mai dell'header Host", () => {
    expect(() => resolveSiteOrigin({ host: "evil.example", proto: "https", production: true })).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("in sviluppo usa l'header Host, http solo in locale", () => {
    expect(resolveSiteOrigin({ host: "localhost:3000", production: false })).toBe("http://localhost:3000");
    expect(resolveSiteOrigin({ host: "192.168.1.5:3000", proto: "http", production: false })).toBe("http://192.168.1.5:3000");
  });

  it("scarta host con caratteri strani", () => {
    expect(() => resolveSiteOrigin({ host: "a.example/evil?x=", production: false })).toThrow();
  });
});
