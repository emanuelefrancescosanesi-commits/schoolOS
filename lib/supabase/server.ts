import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { requireSupabaseEnv } from "./env";

/**
 * Client Supabase per Server Component, Server Action e Route Handler.
 * Va creato per ogni richiesta: legge e scrive i cookie di sessione dell'utente.
 */
export async function createClient() {
  const { url, publishableKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Chiamato da un Server Component, dove i cookie sono in sola lettura:
          // il rinnovo della sessione lo fa già il proxy.
        }
      },
    },
  });
}

export type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
