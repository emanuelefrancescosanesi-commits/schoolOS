"use client";

import { useEffect, useRef } from "react";

/**
 * Widget anti-bot (Cloudflare Turnstile) per i moduli di accesso. Si attiva solo se è impostata
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY: senza, non rende nulla e i moduli funzionano come prima.
 * Il token finisce nel campo nascosto "captchaToken" e le server action lo passano a Supabase, che
 * lo verifica (Authentication → Attack Protection → CAPTCHA). Il token vale una volta sola:
 * `resetKey` cambia a ogni risposta del server e riporta il widget al punto di partenza.
 */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile"));
    };
    document.head.append(script);
  });
  return scriptPromise;
}

export function Turnstile({ resetKey }: { resetKey?: unknown }) {
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: SITE_KEY,
          language: "it",
          theme: "auto",
          callback: (token: string) => {
            if (input.current) input.current.value = token;
          },
          "expired-callback": () => {
            if (input.current) input.current.value = "";
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, []);

  useEffect(() => {
    if (widget.current && window.turnstile) {
      if (input.current) input.current.value = "";
      window.turnstile.reset(widget.current);
    }
  }, [resetKey]);

  if (!SITE_KEY) return null;
  return (
    <>
      <input ref={input} type="hidden" name="captchaToken" defaultValue="" />
      <div ref={box} className="min-h-[65px]" />
    </>
  );
}
