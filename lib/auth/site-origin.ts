import "server-only";
import { headers } from "next/headers";
import { resolveSiteOrigin } from "./origin";

/** Origine pubblica del sito, per i link nelle email e il ritorno da Google (vedi origin.ts). */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  return resolveSiteOrigin({
    configured: process.env.NEXT_PUBLIC_SITE_URL,
    vercelProductionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    vercelDeployHost: process.env.VERCEL_URL,
    host: h.get("x-forwarded-host") ?? h.get("host"),
    proto: h.get("x-forwarded-proto"),
    production: process.env.NODE_ENV === "production",
  });
}
