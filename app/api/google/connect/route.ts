import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { siteOrigin } from "@/lib/auth/site-origin";
import { requireOnboardedUser } from "@/lib/data/session";
import { googleConfig } from "@/lib/google/config";
import { buildAuthUrl } from "@/lib/google/oauth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Avvia il collegamento a Google: genera uno `state` anti-CSRF e manda l'utente alla pagina di consenso. */
export async function GET() {
  const origin = await siteOrigin();
  const back = (flag: string) => NextResponse.redirect(new URL(`/integrations?google=${flag}`, origin));
  const cfg = googleConfig();
  if (!cfg || !isSupabaseConfigured()) return back("off");
  const { user } = await requireOnboardedUser();

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(
    buildAuthUrl({ clientId: cfg.clientId, redirectUri: `${origin}/api/google/callback`, state, loginHint: user.email ?? undefined }),
  );
  res.cookies.set("g_state", state, { httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
}
