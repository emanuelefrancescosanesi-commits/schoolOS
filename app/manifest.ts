import type { MetadataRoute } from "next";
import { getMessages } from "@/lib/i18n";

// Rende SchoolOS installabile («Aggiungi a Home»): icona, schermo intero, avvio dalla Dashboard.
export default function manifest(): MetadataRoute.Manifest {
  const m = getMessages();
  return {
    name: m.meta.appName,
    short_name: m.meta.appName,
    description: m.meta.tagline,
    lang: "it",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
