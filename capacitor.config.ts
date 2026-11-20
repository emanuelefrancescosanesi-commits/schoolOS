import type { CapacitorConfig } from "@capacitor/cli";

// L'app carica SchoolOS dal sito (aggiornamenti subito, senza nuove release). La webview del
// registro è separata (plugin InAppBrowser) e si apre solo sui domini del registro.
const config: CapacitorConfig = {
  appId: "it.schoolos.app",
  appName: "SchoolOS",
  webDir: "capacitor/www",
  server: {
    url: process.env.CAP_SERVER_URL ?? "https://school-os-brown.vercel.app",
    cleartext: false,
    allowNavigation: ["school-os-brown.vercel.app", "*.supabase.co"],
  },
  ios: { contentInset: "always" },
  android: { allowMixedContent: false },
};

export default config;
