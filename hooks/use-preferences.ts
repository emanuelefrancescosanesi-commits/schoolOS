"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { PREFERENCES_EVENT, SIDEBAR_KEY, THEME_KEY, type ThemePreference } from "@/lib/preferences";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFERENCES_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFERENCES_EVENT, callback);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage non disponibile (es. navigazione privata): la scelta vale solo per questa pagina.
  }
  window.dispatchEvent(new Event(PREFERENCES_EVENT));
}

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    () => (read(THEME_KEY) as ThemePreference | null) ?? "system",
    () => "system" as ThemePreference,
  );

  // Con "system", segue il cambio di tema del sistema operativo in tempo reale.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    write(THEME_KEY, next);
    applyTheme(next);
  }, []);

  return { theme, setTheme };
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute("data-sidebar") === "collapsed",
    () => false,
  );

  const setCollapsed = useCallback((next: boolean) => {
    if (next) document.documentElement.setAttribute("data-sidebar", "collapsed");
    else document.documentElement.removeAttribute("data-sidebar");
    write(SIDEBAR_KEY, next ? "collapsed" : "expanded");
  }, []);

  return { collapsed, setCollapsed };
}
