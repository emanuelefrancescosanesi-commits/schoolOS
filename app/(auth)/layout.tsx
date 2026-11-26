import Link from "next/link";
import { StashImport } from "@/components/auth/stash-import";
import { LegalLinks } from "@/components/legal/legal-page";
import { Logo } from "@/components/shell/logo";
import { getMessages } from "@/lib/i18n";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  const m = getMessages();
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center px-6">
        <Link href="/login" className="tap-area rounded-control" aria-label={m.meta.appName}>
          <Logo />
        </Link>
      </header>
      <main id="contenuto" className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-16">
        <div className="w-full max-w-sm">{children}</div>
        <StashImport />
      </main>
      <LegalLinks />
    </div>
  );
}
