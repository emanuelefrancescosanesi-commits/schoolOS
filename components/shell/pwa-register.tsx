"use client";

import { WifiOffIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { getMessages } from "@/lib/i18n";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** Registra il service worker (solo in produzione) e mostra un avviso quando manca la rete. */
export function PwaRegister() {
  const m = getMessages().common;
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-border bg-surface-2 px-4 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-center text-xs font-medium text-fg"
    >
      <WifiOffIcon strokeWidth={1.5} className="size-3.5 shrink-0 text-critical" aria-hidden />
      {m.offlineBanner}
    </div>
  );
}
