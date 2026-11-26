"use client";

import { useEffect } from "react";
import { syncStaleFeeds } from "@/app/(app)/integrations/actions";

/** All'apertura del Calendario aggiorna (in silenzio) i calendari collegati vecchi di oltre 30 minuti. */
export function FeedAutoSync() {
  useEffect(() => {
    void syncStaleFeeds().catch(() => undefined);
  }, []);
  return null;
}
