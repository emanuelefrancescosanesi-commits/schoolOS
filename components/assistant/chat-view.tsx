"use client";

import { ArrowUpIcon, LockIcon, RotateCcwIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askAction } from "@/app/(app)/assistant/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { controlClass } from "@/components/ui/input";
import { assistantMessages as m } from "@/lib/assistant/messages";
import { type ChatMessage, ASSISTANT_DAILY_LIMIT, MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS } from "@/lib/assistant/policy";
import { cn } from "@/lib/utils";

export type AssistantState = "ready" | "demo" | "off" | "pro";

export function ChatView({ state }: { state: AssistantState }) {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.title}</h1>
        <p className="mt-1 text-sm text-muted">{m.intro}</p>
      </div>
      {state === "ready" ? <Chat /> : <Blocked state={state} />}
    </div>
  );
}

function Blocked({ state }: { state: Exclude<AssistantState, "ready"> }) {
  const b = m.blocked;
  const [title, body] = {
    demo: [b.demoTitle, b.demoBody],
    off: [b.offTitle, b.offBody],
    pro: [b.proTitle, b.proBody],
  }[state];
  return (
    <Card className="items-start gap-3 p-5">
      <span className="flex size-10 items-center justify-center rounded-card border border-border text-accent-text">
        <LockIcon strokeWidth={1.5} className="size-5" aria-hidden />
      </span>
      <h2 className="text-base font-medium">{title}</h2>
      <p className="text-sm text-muted">{body}</p>
      <Link href="/grades" className={buttonVariants({ variant: "secondary" })}>
        {b.back}
      </Link>
    </Card>
  );
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, pending, error]);

  function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    if (content.length > MAX_MESSAGE_CHARS) {
      setError(m.tooLong(MAX_MESSAGE_CHARS));
      return;
    }
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setError(null);
    startTransition(async () => {
      // Il server riceve solo gli ultimi messaggi: la conversazione resta breve e poco costosa.
      const result = await askAction(next.slice(-(MAX_HISTORY_MESSAGES + 1)));
      if (result.ok) {
        setMessages([...next, { role: "assistant", content: result.reply }]);
        return;
      }
      // La domanda non ha avuto risposta: la tolgo dalla conversazione (altrimenti due messaggi
      // dello studente di fila sarebbero rifiutati dal server) e la rimetto nella casella.
      setMessages(messages);
      setDraft(content);
      setError(
        result.error ??
          (result.code === "limit"
            ? m.limit(ASSISTANT_DAILY_LIMIT)
            : result.code === "session"
              ? m.errors.session
              : result.code === "invalid"
                ? m.errors.invalid
                : m.errors.generic),
      );
    });
  }

  return (
    <Card className="gap-0 overflow-hidden">
      <div className="flex min-h-[50dvh] flex-col gap-3 p-4" role="log" aria-live="polite" aria-label={m.title}>
        {messages.length === 0 && (
          <div className="flex flex-col items-start gap-3 py-2">
            <span className="flex size-10 items-center justify-center rounded-card border border-border text-accent-text">
              <SparklesIcon strokeWidth={1.5} className="size-5" aria-hidden />
            </span>
            <p className="text-sm text-muted">{m.suggestionsTitle}</p>
            <ul className="flex flex-col items-start gap-2">
              {m.suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-10 rounded-control border border-border bg-surface px-3 py-2 text-left text-sm hover:border-muted/60 pointer-coarse:min-h-11"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-card px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user" ? "bg-accent text-accent-fg" : "border border-border bg-surface-2 text-fg",
              )}
            >
              <span className="sr-only">{msg.role === "user" ? m.you : m.assistant}: </span>
              {msg.content}
            </p>
          </div>
        ))}

        {pending && <p className="text-sm text-muted">{m.thinking}</p>}
        {error && (
          <p role="alert" className="text-sm text-critical">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex flex-col gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="assistant-input" className="sr-only">
            {m.inputLabel}
          </label>
          <textarea
            id="assistant-input"
            rows={1}
            value={draft}
            maxLength={MAX_MESSAGE_CHARS}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder={m.placeholder}
            className={cn(controlClass, "h-auto max-h-32 min-h-10 resize-none py-2.5 pointer-coarse:min-h-11")}
          />
          <Button type="submit" size="icon" variant="primary" disabled={pending || !draft.trim()} aria-label={m.send} className="shrink-0">
            <ArrowUpIcon strokeWidth={1.5} aria-hidden />
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-muted">
          <p>{m.privacy}</p>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className="inline-flex shrink-0 items-center gap-1 py-1 hover:text-fg"
            >
              <RotateCcwIcon strokeWidth={1.5} className="size-3.5" aria-hidden />
              {m.newChat}
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
