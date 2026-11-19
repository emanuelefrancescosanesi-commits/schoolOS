import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { getMessages } from "@/lib/i18n";
import { PREFERENCES_SCRIPT } from "@/lib/preferences";
import "./globals.css";

const m = getMessages();

export const metadata: Metadata = {
  title: { default: m.meta.appName, template: `%s · ${m.meta.appName}` },
  description: m.meta.tagline,
  applicationName: m.meta.appName,
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: m.meta.appName, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Applica tema e stato della sidebar prima del primo paint. */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
