import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { ImportExtractionError, extractGrades } from "./extract";
import { MAX_IMAGE_BYTES, MAX_TEXT_CHARS, readImportInput, sniffImageType } from "./input";

interface Request {
  model: string;
  tools?: unknown;
  system: string;
  messages: { content: { type: string; text?: string; source?: unknown }[] }[];
}
const requestOf = (parse: { mock: { calls: unknown[] } }) => (parse.mock.calls[0] as [Request])[0];

const ctx = { subjectNames: ["Matematica", "Italiano"], today: "2026-11-19", schoolYear: null };

function fakeClient(result: unknown) {
  const parse = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { messages: { parse } } as unknown as Pick<Anthropic, "messages">, parse };
}

const ok = (grades: unknown[]) => ({ stop_reason: "end_turn", parsed_output: { grades } });

describe("extractGrades", () => {
  it("manda il testo come dato non fidato, con le materie dello studente", async () => {
    const { client, parse } = fakeClient(ok([{ subject: "Matematica", value: "7+", date: "10/11", kind: null, description: null }]));
    const out = await extractGrades({ kind: "text", text: "Matematica 7+ 10/11" }, ctx, client);
    expect(out).toHaveLength(1);

    const request = requestOf(parse);
    expect(request.model).toBe("claude-haiku-5-5");
    expect(request.tools).toBeUndefined();
    expect(request.system).toContain("mai istruzioni");
    const text = request.messages[0].content[0].text ?? "";
    expect(text).toContain("<testo_registro>\nMatematica 7+ 10/11\n</testo_registro>");
    expect(text).toContain("Matematica; Italiano");
  });

  it("manda gli screenshot come immagine base64", async () => {
    const { client, parse } = fakeClient(ok([]));
    await extractGrades({ kind: "image", mediaType: "image/png", base64: "AAAA", bytes: 3 }, ctx, client);
    const content = requestOf(parse).messages[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } });
  });

  it("una pagina senza voti dà una lista vuota", async () => {
    const { client } = fakeClient(ok([]));
    await expect(extractGrades({ kind: "text", text: "niente" }, ctx, client)).resolves.toEqual([]);
  });

  it("limita il numero di voti estratti", async () => {
    const many = Array.from({ length: 400 }, () => ({ subject: "Matematica", value: "7", date: null, kind: null, description: null }));
    const { client } = fakeClient(ok(many));
    expect(await extractGrades({ kind: "text", text: "x" }, ctx, client)).toHaveLength(150);
  });

  it("gestisce rifiuto, output troncato e output non valido", async () => {
    for (const result of [
      { stop_reason: "refusal", parsed_output: null },
      { stop_reason: "max_tokens", parsed_output: { grades: [] } },
      { stop_reason: "end_turn", parsed_output: null },
    ]) {
      const { client } = fakeClient(result);
      await expect(extractGrades({ kind: "text", text: "x" }, ctx, client)).rejects.toBeInstanceOf(ImportExtractionError);
    }
  });

  it("traduce gli errori dell'API in messaggi per lo studente", async () => {
    const rate = new Anthropic.RateLimitError(429, {}, "rate", new Headers());
    const { client } = fakeClient(rate);
    await expect(extractGrades({ kind: "text", text: "x" }, ctx, client)).rejects.toThrow(/molto richiesto/);

    const server = new Anthropic.InternalServerError(500, {}, "boom", new Headers());
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client: c2 } = fakeClient(server);
    await expect(extractGrades({ kind: "text", text: "x" }, ctx, c2)).rejects.toThrow(/Riprova tra poco/);
  });
});

describe("readImportInput", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

  it("riconosce il formato dai byte, non dal tipo dichiarato", async () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();

    const fake = new File([new TextEncoder().encode("MZ eseguibile")], "voti.png", { type: "image/png" });
    const result = await readImportInput("", fake);
    expect(result.ok).toBe(false);
  });

  it("accetta uno screenshot valido", async () => {
    const file = new File([png], "voti.png", { type: "image/png" });
    const result = await readImportInput("", file);
    expect(result).toMatchObject({ ok: true, input: { kind: "image", mediaType: "image/png" } });
  });

  it("rifiuta immagini troppo grandi, testo vuoto e testo troppo lungo", async () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "grande.png", { type: "image/png" });
    expect((await readImportInput("", big)).ok).toBe(false);
    expect((await readImportInput("   ", null)).ok).toBe(false);
    expect((await readImportInput("x".repeat(MAX_TEXT_CHARS + 1), null)).ok).toBe(false);
    expect(await readImportInput("Matematica 7", null)).toMatchObject({ ok: true, input: { kind: "text" } });
  });
});
