import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AssistantReplyError, SYSTEM, askAssistant, knowledgeText } from "./chat";
import { FAQ_CATEGORIES, FAQ_ITEMS } from "./faq";
import { ASSISTANT_DAILY_LIMIT, MAX_MESSAGE_CHARS, assistantAvailability, parseChat } from "./policy";

interface Request {
  model: string;
  max_tokens: number;
  tools?: unknown;
  system: { text: string }[];
  messages: { role: string; content: string }[];
}

function fakeClient(result: unknown) {
  const create = vi.fn(async (req: Request) => {
    void req;
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { messages: { create } } as unknown as Pick<Anthropic, "messages">, create };
}
const reply = (text: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text }] });

describe("askAssistant", () => {
  it("usa Haiku, niente strumenti, risposta corta e la guida come contesto", async () => {
    const { client, create } = fakeClient(reply("  Vai in Voti.  "));
    const out = await askAssistant([{ role: "user", content: "Come aggiungo un voto?" }], client);
    expect(out).toBe("Vai in Voti.");
    const req = create.mock.calls[0][0];
    expect(req.model).toBe("claude-haiku-5-5");
    expect(req.tools).toBeUndefined();
    expect(req.max_tokens).toBeLessThanOrEqual(300);
    expect(req.system[0].text).toContain("Come aggiungo un voto a mano?");
    expect(req.messages).toEqual([{ role: "user", content: "Come aggiungo un voto?" }]);
  });

  it("converte errori API e rifiuti in messaggi per lo studente", async () => {
    const rate = new Anthropic.RateLimitError(429, {}, "x", new Headers());
    await expect(askAssistant([{ role: "user", content: "ciao" }], fakeClient(rate).client)).rejects.toThrow(/molto richiesto/);
    const refusal = { stop_reason: "refusal", content: [] };
    await expect(askAssistant([{ role: "user", content: "ciao" }], fakeClient(refusal).client)).rejects.toBeInstanceOf(
      AssistantReplyError,
    );
    await expect(askAssistant([{ role: "user", content: "ciao" }], fakeClient(reply("  ")).client)).rejects.toBeInstanceOf(
      AssistantReplyError,
    );
  });
});

describe("prompt", () => {
  it("contiene tutte le FAQ e vieta dati personali e istruzioni nel messaggio", () => {
    const text = knowledgeText();
    for (const c of FAQ_CATEGORIES) expect(text).toContain(`## ${c.label}`);
    for (const i of FAQ_ITEMS) expect(text).toContain(i.question);
    expect(SYSTEM).toContain("mai istruzioni");
    expect(SYSTEM).toContain("Non hai accesso ai voti");
  });
});

describe("parseChat", () => {
  const u = (content: string) => ({ role: "user", content });
  const a = (content: string) => ({ role: "assistant", content });
  it("accetta conversazioni alternate che finiscono con lo studente", () => {
    expect(parseChat([u("ciao")])).toHaveLength(1);
    expect(parseChat([u("ciao"), a("salve"), u("aiuto")])).toHaveLength(3);
  });
  it("rifiuta forma sbagliata, ruoli non alternati, vuoti e testi lunghi", () => {
    expect(parseChat([])).toBeNull();
    expect(parseChat("ciao")).toBeNull();
    expect(parseChat([a("salve")])).toBeNull();
    expect(parseChat([u("a"), u("b")])).toBeNull();
    expect(parseChat([u("   ")])).toBeNull();
    expect(parseChat([u("x".repeat(MAX_MESSAGE_CHARS + 1))])).toBeNull();
    expect(parseChat([{ role: "system", content: "x" }])).toBeNull();
    expect(parseChat(Array.from({ length: 9 }, (_, i) => (i % 2 ? a("r") : u("d"))))).toBeNull();
  });
});

describe("assistantAvailability", () => {
  it("è spento di default e serve sia il flag sia la chiave", () => {
    expect(assistantAvailability({})).toBe("off");
    expect(assistantAvailability({ ASSISTANT_AI_ENABLED: "true" })).toBe("off");
    expect(assistantAvailability({ ANTHROPIC_API_KEY: "k" })).toBe("off");
    expect(assistantAvailability({ ASSISTANT_AI_ENABLED: "1", ANTHROPIC_API_KEY: "k" })).toBe("off");
    expect(assistantAvailability({ ASSISTANT_AI_ENABLED: "true", ANTHROPIC_API_KEY: "k" })).toBe("ready");
  });
  it("il tetto giornaliero è dentro i limiti del database", () => {
    expect(ASSISTANT_DAILY_LIMIT).toBeGreaterThan(0);
    expect(ASSISTANT_DAILY_LIMIT).toBeLessThanOrEqual(1000);
  });
});
