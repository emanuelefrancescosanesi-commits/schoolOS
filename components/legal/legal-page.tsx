import Link from "next/link";
import { Logo } from "@/components/shell/logo";

/** Struttura comune delle pagine legali pubbliche (informativa, termini). */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center px-6">
        <Link href="/login" className="tap-area rounded-control" aria-label="SchoolOS">
          <Logo />
        </Link>
      </header>
      <main id="contenuto" className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 pb-10 text-sm leading-relaxed">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {children}
      </main>
      <LegalLinks />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Dato ancora da inserire: ben visibile, così non finisce in produzione per sbaglio. */
export function Todo({ children }: { children: React.ReactNode }) {
  return <mark className="rounded bg-yellow-200 px-1 text-black">[DA COMPLETARE: {children}]</mark>;
}

/** Link a informativa e termini: nel footer dell'accesso e in fondo alle pagine legali. */
export function LegalLinks() {
  return (
    <footer className="flex justify-center gap-4 px-4 py-6 text-xs text-muted">
      <Link href="/privacy" className="tap-area hover:underline">
        Privacy
      </Link>
      <Link href="/termini" className="tap-area hover:underline">
        Termini di servizio
      </Link>
    </footer>
  );
}
