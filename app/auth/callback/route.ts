import { type NextRequest, NextResponse } from "next/server";
import { oauthErrorKey } from "@/lib/auth/oauth";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Ritorno da Google (OAuth con PKCE): scambia il codice con una sessione. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  // Google o Supabase hanno rimandato un errore (es. l'utente ha annullato).
  if (searchParams.has("error") || searchParams.has("error_code")) {
    return NextResponse.redirect(new URL(`/login?error=${oauthErrorKey(searchParams)}`, request.url));
  }

  if (code && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=oauth", request.url));
}
