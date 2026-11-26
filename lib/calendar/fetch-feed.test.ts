import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...a: unknown[]) => lookup(...a) }));

import { FeedFetchError, fetchFeedText } from "./fetch-feed";

const ICS = "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
const ok = (body: string) => new Response(body, { status: 200 });

describe("fetchFeedText", () => {
  beforeEach(() => lookup.mockResolvedValue([{ address: "142.250.1.1", family: 4 }]));
  afterEach(() => vi.unstubAllGlobals());

  it("scarica un calendario pubblico", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok(ICS)));
    await expect(fetchFeedText("https://calendar.google.com/a.ics")).resolves.toBe(ICS);
  });

  it("rifiuta un nome che risolve a un indirizzo interno (e non scarica nulla)", async () => {
    lookup.mockResolvedValue([{ address: "10.0.0.7", family: 4 }]);
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(fetchFeedText("https://evil.example.com/a.ics")).rejects.toBeInstanceOf(FeedFetchError);
    expect(f).not.toHaveBeenCalled();
  });

  it("controlla anche i reindirizzamenti", async () => {
    lookup.mockImplementation(async (h: string) => [{ address: h === "inner.example.com" ? "169.254.169.254" : "142.250.1.1", family: 4 }]);
    const f = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://inner.example.com/x" } }));
    vi.stubGlobal("fetch", f);
    await expect(fetchFeedText("https://calendar.google.com/a.ics")).rejects.toThrow(/non consentito/i);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("rifiuta un reindirizzamento verso http", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "http://example.com/x" } })));
    await expect(fetchFeedText("https://calendar.google.com/a.ics")).rejects.toBeInstanceOf(FeedFetchError);
  });

  it("si ferma dopo troppi reindirizzamenti", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "https://calendar.google.com/b.ics" } })));
    await expect(fetchFeedText("https://calendar.google.com/a.ics")).rejects.toThrow(/reindirizzamenti/);
  });

  it("rifiuta file oltre 2 MB", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("x".repeat(2_100_000))));
    await expect(fetchFeedText("https://calendar.google.com/a.ics")).rejects.toThrow(/troppo grande/);
  });

  it("spiega il link revocato (404/403)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 404 })));
    await expect(fetchFeedText("https://calendar.google.com/a.ics")).rejects.toThrow(/non è più raggiungibile/);
  });

  it("non scarica indirizzi non https o interni", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await expect(fetchFeedText("http://example.com/a.ics")).rejects.toBeInstanceOf(FeedFetchError);
    await expect(fetchFeedText("https://localhost/a.ics")).rejects.toBeInstanceOf(FeedFetchError);
    expect(f).not.toHaveBeenCalled();
  });
});
