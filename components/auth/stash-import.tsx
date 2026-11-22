"use client";

import { useEffect } from "react";
import { stashImportHash } from "@/lib/import/bookmarklet";

/** Pagine di accesso: se arrivi dal segnalibro, tiene da parte i voti fino al login. */
export function StashImport() {
  useEffect(() => {
    try {
      if (stashImportHash(window.location.hash, window.sessionStorage)) {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    } catch {
      /* archiviazione non disponibile */
    }
  }, []);
  return null;
}
