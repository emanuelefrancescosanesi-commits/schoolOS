import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { siteOrigin } from "@/lib/auth/site-origin";
import { requireOnboardedUser } from "@/lib/data/session";
import { dateKeyInTimeZone } from "@/lib/domain/dates";
import { googleConfig } from "@/lib/google/config";
import { encryptToken } from "@/lib/google/crypto";
import { GOOGLE_SCOPES, emailFromIdToken, exchangeCode, hasScope } from "@/lib/google/oauth";
import { syncGoogle } from "@/lib/google/sync";
import { createClient } from "@/lib/supabase/server";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Ritorno da Google: verifica lo `state`, salva il codice di accesso cifrato e fa la prima sincronizzazione. */
export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`/integrations?google=${flag}`, origin));
    res.cookies.delete({ name: "g_state", path: "/api/google" });
    return res;
  };
  const cfg = googleConfig();
  if (!cfg) return back("off");
  const { user, profile } = await requireOnboardedUser();

  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return back("denied");
  const state = sp.get("state");
  const cookie = request.cookies.get("g_state")?.value;
  const code = sp.get("code");
  if (!state || !cookie || !code || !same(state, cookie)) return back("error");

  try {
    const t = await exchangeCode(cfg, code, `${origin}/api/google/callback`);
    const wanted = hasScope(t.scope, "calendar") || hasScope(t.scope, "gmail");
    if (!wanted) return back("noscope");
    // Senza refresh token non si può restare collegati (succede se Google l'ha già dato e `prompt` è stato saltato).
    if (!t.refreshToken) return back("error");

    const supabase = await createClient();
    const { error } = await supabase.from("google_connections").upsert(
      {
        user_id: user.id,
        google_email: (emailFromIdToken(t.idToken) ?? "account Google").slice(0, 254),
        refresh_token_enc: encryptToken(t.refreshToken, cfg.tokenKey),
        scopes: t.scope.split(/\s+/).filter((s) => Object.values(GOOGLE_SCOPES).includes(s as never)).join(" "),
        last_error: null,
      },
      { onConflict: "user_id" },
    );
    if (error) return back("error");
    // Prima sincronizzazione subito: se fallisce, lo stato si vede in Integrazioni.
    await syncGoogle(supabase, user.id, profile.time_zone, dateKeyInTimeZone(new Date(), profile.time_zone));
    return back("ok");
  } catch {
    return back("error");
  }
}
