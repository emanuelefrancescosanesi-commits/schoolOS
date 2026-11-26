"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { markNotificationUnread, markNotificationsRead } from "@/app/(app)/notifications/actions";
import { countUnread } from "@/lib/notifications/types";

interface Value {
  unread: number;
  isRead: (id: string) => boolean;
  /** Segna come letti; ritorna false (e annulla) se il salvataggio fallisce. */
  markRead: (ids: string[]) => Promise<boolean>;
  markUnread: (id: string) => Promise<boolean>;
  /** Allinea lo stato a quello letto dal server (chiamato dal seme nel layout). */
  sync: (ids: string[], readIds: string[]) => void;
}

const Ctx = createContext<Value | null>(null);

/**
 * Stato condiviso di barra laterale, barra mobile e centro notifiche, così il contatore
 * si aggiorna subito quando segni qualcosa come letto, senza aspettare il server.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());

  const sync = useCallback((nextIds: string[], readIds: string[]) => {
    setIds(nextIds);
    setRead(new Set(readIds));
  }, []);

  const setReadIds = useCallback((fn: (s: Set<string>) => void) => {
    setRead((prev) => {
      const next = new Set(prev);
      fn(next);
      return next;
    });
  }, []);

  const markRead = useCallback(
    async (target: string[]) => {
      setReadIds((s) => target.forEach((id) => s.add(id)));
      const res = await markNotificationsRead(target).catch(() => ({ ok: false as const }));
      if (!res.ok) setReadIds((s) => target.forEach((id) => s.delete(id)));
      return res.ok;
    },
    [setReadIds],
  );

  const markUnread = useCallback(
    async (id: string) => {
      setReadIds((s) => s.delete(id));
      const res = await markNotificationUnread(id).catch(() => ({ ok: false as const }));
      if (!res.ok) setReadIds((s) => s.add(id));
      return res.ok;
    },
    [setReadIds],
  );

  const value = useMemo<Value>(
    () => ({ unread: countUnread(ids, read), isRead: (id) => read.has(id), markRead, markUnread, sync }),
    [ids, read, markRead, markUnread, sync],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications richiede NotificationsProvider");
  return v;
}

/** Montato dal server nel layout: porta nel client l'elenco attuale e i letti. */
export function NotificationsSync({ ids, readIds }: { ids: string[]; readIds: string[] }) {
  const { sync } = useNotifications();
  const key = `${ids.join("|")}#${readIds.join("|")}`;
  // `key` riassume ids e readIds: evita di risincronizzare a ogni render per via di nuovi array.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => sync(ids, readIds), [key, sync]);
  return null;
}
