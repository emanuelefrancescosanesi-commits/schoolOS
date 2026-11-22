import Link from "next/link";
import { LogoMark } from "@/components/shell/logo";
import { buttonVariants } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

export default function NotFound() {
  const m = getMessages();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <LogoMark className="mb-6 size-10" />
      <p className="tabular text-sm text-muted">404</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{m.notFound.title}</h1>
      <p className="mt-2 text-muted">{m.notFound.body}</p>
      <Link href="/dashboard" className={buttonVariants({ variant: "primary", className: "mt-8" })}>
        {m.notFound.back}
      </Link>
    </main>
  );
}
