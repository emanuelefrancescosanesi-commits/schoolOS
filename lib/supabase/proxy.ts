import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/redirect";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/** Pagine raggiungibili senza sessione. */
const PUBLIC_PREFIXES = ["/login", "/signup", "/forgot-password", "/auth/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p));
}

/**
 * Rinnova la sessione a ogni richiesta e fa un primo controllo ottimistico:
 * senza sessione si va al login, con sessione il login rimanda alla Dashboard.
 * La verifica vera (utente e onboarding) resta nel server, vicino ai dati.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const env = getSupabaseEnv();
  // Modalità demo: nessuna autenticazione.
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Non inserire codice tra la creazione del client e getClaims(): è qui che il token si rinnova.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const target = NextResponse.redirect(new URL(path, request.url));
    // Conserva i cookie di sessione appena rinnovati.
    for (const cookie of response.cookies.getAll()) target.cookies.set(cookie);
    return target;
  };

  if (!signedIn && !isPublic(pathname)) {
    return redirectTo(`/login?next=${encodeURIComponent(safeNextPath(pathname + search))}`);
  }
  if (signedIn && (pathname === "/login" || pathname === "/signup")) {
    return redirectTo(safeNextPath(request.nextUrl.searchParams.get("next")));
  }
  return response;
}
