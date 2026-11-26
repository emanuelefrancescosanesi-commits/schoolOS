import { describe, expect, it } from "vitest";
import { classifyTitle, parseIcal } from "./ical";
import { isPrivateIp, normalizeFeedUrl } from "./feed-url";

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//t//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;
const opts = { timeZone: "Europe/Rome", from: "2026-11-01", to: "2027-03-31" };

describe("parseIcal", () => {
  it("legge un evento con orario UTC e lo converte nel fuso dello studente", () => {
    const [e] = parseIcal(wrap("BEGIN:VEVENT\r\nUID:a1\r\nDTSTART:20261201T073000Z\r\nDTEND:20261201T083000Z\r\nSUMMARY:Verifica di matematica\r\nDESCRIPTION:Capitolo 4\r\nEND:VEVENT"), opts);
    expect(e).toMatchObject({ externalId: "a1", title: "Verifica di matematica", date: "2026-12-01", time: "08:30", kind: "test", notes: "Capitolo 4" });
  });

  it("gestisce gli eventi tutto il giorno senza spostare la data, anche su più giorni", () => {
    const evs = parseIcal(wrap("BEGIN:VEVENT\r\nUID:g\r\nDTSTART;VALUE=DATE:20261210\r\nDTEND;VALUE=DATE:20261213\r\nSUMMARY:Gita\r\nEND:VEVENT"), opts);
    expect(evs.map((e) => [e.date, e.time])).toEqual([["2026-12-10", undefined], ["2026-12-11", undefined], ["2026-12-12", undefined]]);
    expect(new Set(evs.map((e) => e.externalId)).size).toBe(3);
  });

  it("applica il fuso dichiarato (TZID) con VTIMEZONE", () => {
    const tz = "BEGIN:VTIMEZONE\r\nTZID:America/New_York\r\nBEGIN:STANDARD\r\nDTSTART:19701101T020000\r\nTZOFFSETFROM:-0400\r\nTZOFFSETTO:-0500\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\n";
    const [e] = parseIcal(wrap(`${tz}BEGIN:VEVENT\r\nUID:ny\r\nDTSTART;TZID=America/New_York:20261201T090000\r\nSUMMARY:Call\r\nEND:VEVENT`), opts);
    expect(e).toMatchObject({ date: "2026-12-01", time: "15:00" }); // 09:00 EST = 15:00 a Roma
  });

  it("espande le ripetizioni nella finestra e rispetta EXDATE", () => {
    const evs = parseIcal(wrap("BEGIN:VEVENT\r\nUID:w\r\nDTSTART;TZID=Europe/Rome:20261102T080000\r\nRRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE;TZID=Europe/Rome:20261109T080000\r\nSUMMARY:Lezione\r\nEND:VEVENT"), opts);
    expect(evs.map((e) => e.date)).toEqual(["2026-11-02", "2026-11-16", "2026-11-23"]);
    expect(new Set(evs.map((e) => e.externalId)).size).toBe(3);
  });

  it("applica una modifica a una singola occorrenza", () => {
    const evs = parseIcal(
      wrap(
        "BEGIN:VEVENT\r\nUID:r\r\nDTSTART;TZID=Europe/Rome:20261102T080000\r\nRRULE:FREQ=WEEKLY;COUNT=2\r\nSUMMARY:Lezione\r\nEND:VEVENT\r\n" +
          "BEGIN:VEVENT\r\nUID:r\r\nRECURRENCE-ID;TZID=Europe/Rome:20261109T080000\r\nDTSTART;TZID=Europe/Rome:20261110T100000\r\nSUMMARY:Lezione spostata\r\nEND:VEVENT",
      ),
      opts,
    );
    expect(evs.map((e) => [e.date, e.time, e.title])).toEqual([["2026-11-02", "08:00", "Lezione"], ["2026-11-10", "10:00", "Lezione spostata"]]);
  });

  it("scarta gli eventi fuori finestra e rispetta il tetto", () => {
    const body = ["2020", "2026", "2030"].map((y, i) => `BEGIN:VEVENT\r\nUID:y${i}\r\nDTSTART;VALUE=DATE:${y}1201\r\nSUMMARY:E\r\nEND:VEVENT`).join("\r\n");
    expect(parseIcal(wrap(body), opts)).toHaveLength(1);
    expect(parseIcal(wrap(body), { ...opts, from: "2000-01-01", to: "2040-01-01", max: 2 })).toHaveLength(2);
  });

  it("non va in loop su ripetizioni infinite", () => {
    const evs = parseIcal(wrap("BEGIN:VEVENT\r\nUID:i\r\nDTSTART;VALUE=DATE:20261101\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Ogni giorno\r\nEND:VEVENT"), opts);
    expect(evs.length).toBeGreaterThan(100);
    expect(evs.length).toBeLessThanOrEqual(600);
  });

  it("rifiuta file che non sono calendari", () => {
    expect(() => parseIcal("<html>login</html>", opts)).toThrow(/iCal/);
    expect(() => parseIcal("", opts)).toThrow(/iCal/);
  });
});

describe("classifyTitle", () => {
  it.each([
    ["Verifica di fisica", "test"], ["Compito in classe di latino", "test"], ["Interrogazione di storia", "oral"],
    ["Consegna progetto", "project"], ["Assemblea di classe", "event"],
  ])("%s → %s", (t, k) => expect(classifyTitle(t)).toBe(k));
});

describe("normalizeFeedUrl", () => {
  it("accetta https e trasforma webcal in https", () => {
    expect(normalizeFeedUrl(" webcal://calendar.google.com/a/b.ics ")).toEqual({ ok: true, url: "https://calendar.google.com/a/b.ics" });
    expect(normalizeFeedUrl("https://outlook.office365.com/owa/calendar/x/reachcalendar.ics").ok).toBe(true);
  });
  it.each([
    "", "ciao", "http://example.com/a.ics", "ftp://example.com/a.ics", "file:///etc/passwd", "https://user:pw@example.com/a.ics",
    "https://localhost/a.ics", "https://127.0.0.1/a.ics", "https://10.0.0.5/a.ics", "https://192.168.1.2/a.ics",
    "https://169.254.169.254/latest/meta-data", "https://[::1]/a.ics", "https://intranet/a.ics", "https://printer.local/a.ics",
    "https://example.com:8443/a.ics", "https://[fd00::1]/a.ics",
  ])("rifiuta %j", (u) => expect(normalizeFeedUrl(u).ok).toBe(false));
  it("riconosce gli IP privati", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.1", "192.168.0.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "::ffff:10.0.0.1"]) expect(isPrivateIp(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "172.32.0.1", "142.250.1.1", "2a00:1450::1"]) expect(isPrivateIp(ip)).toBe(false);
  });
});
