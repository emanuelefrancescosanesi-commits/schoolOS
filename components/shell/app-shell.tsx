import { FlaskConicalIcon } from "lucide-react";
import Link from "next/link";
import { BellLink } from "@/components/notifications/bell-link";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMessages } from "@/lib/i18n";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({
  children,
  isDemo,
  account,
}: {
  children: React.ReactNode;
  isDemo: boolean;
  account?: React.ReactNode;
}) {
  const m = getMessages();
  return (
    <TooltipProvider>
      <a
        href="#contenuto"
        className="sr-only rounded-control bg-accent px-3 py-2 text-sm font-medium text-accent-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        {m.common.skipToContent}
      </a>

      <Sidebar account={account} />

      <div className="flex min-h-dvh flex-col transition-[padding] duration-200 ease-soft lg:sidebar-offset">
        {isDemo && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 border-b border-border bg-accent-soft px-4 py-1.5 text-center text-xs text-accent-text"
          >
            <FlaskConicalIcon strokeWidth={1.5} className="size-3.5 shrink-0" aria-hidden />
            {m.common.demoBanner}
          </div>
        )}

        {/* Barra superiore solo su smartphone e tablet. */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
          <Link href="/dashboard" aria-label={m.meta.appName} className="inline-flex min-h-11 items-center rounded-control">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <BellLink />
          </div>
        </header>

        <main id="contenuto" tabIndex={-1} className="flex-1 px-4 pt-6 pb-28 outline-none sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      <MobileNav account={account} />
    </TooltipProvider>
  );
}
