import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export const metadata: Metadata = { title: "Informativa sulla privacy" };

/**
 * Informativa (artt. 13-14 GDPR). Descrive ciò che il codice fa davvero; il titolare del trattamento
 * va completato prima del lancio pubblico (vedi docs/AUDIT-SICUREZZA.md).
 */
export default function PrivacyPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center px-6">
        <Link href="/login" className="rounded-control" aria-label="SchoolOS">
          <Logo />
        </Link>
      </header>
      <main id="contenuto" className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 pb-16 text-sm leading-relaxed">
        <h1 className="text-2xl font-semibold">Informativa sulla privacy</h1>
        <p className="rounded-control border border-border p-3 text-muted">
          Versione provvisoria: i dati di contatto del titolare del trattamento verranno completati prima dell&apos;apertura al
          pubblico.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Quali dati trattiamo</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Account: indirizzo email, nome di battesimo e password (conservata solo come hash, mai in chiaro).</li>
            <li>Dati scolastici che inserisci o importi: materie, voti, compiti e verifiche, scuola e classe (facoltative), impostazioni.</li>
            <li>Collegamento dell&apos;estensione del browser: un codice revocabile, di cui conserviamo solo l&apos;impronta (hash).</li>
          </ul>
          <p>
            <strong>Non chiediamo né conserviamo mai la password del registro elettronico.</strong> Non usiamo i tuoi dati per
            pubblicità né li vendiamo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Perché e su quale base</h2>
          <p>
            Per fornirti il servizio che hai richiesto creando l&apos;account (art. 6.1.b GDPR): mostrarti medie, andamento e
            scadenze. I dati non sono usati per altri scopi.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Minori</h2>
          <p>
            In Italia i minori di 14 anni possono usare il servizio solo con il consenso di un genitore o di chi ne fa le veci.
            Registrandoti dichiari di avere almeno 14 anni oppure di avere questo consenso.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Chi li tratta per nostro conto</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase: database e accesso, server nell&apos;Unione Europea (Francoforte).</li>
            <li>Vercel: hosting dell&apos;applicazione (funzioni eseguite a Francoforte).</li>
            <li>
              Anthropic: solo se usi la lettura automatica dei voti (piano Pro, quando attiva), il testo o lo screenshot che
              invii per l&apos;analisi viene trasmesso per essere letto e non per altri scopi. Con l&apos;inserimento manuale,
              il testo incollato e la lettura dello screenshot nel browser, nulla viene inviato a terzi.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Quanto li conserviamo</h2>
          <p>
            Finché mantieni l&apos;account. Quando lo elimini da Impostazioni, profilo, voti, compiti, materie e codici
            dell&apos;estensione vengono cancellati subito dal database.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">I tuoi diritti</h2>
          <p>
            Puoi accedere ai dati, scaricarli in formato JSON (portabilità), correggerli ed eliminarli, tutto da Impostazioni.
            Puoi inoltre opporti al trattamento o proporre reclamo al Garante per la protezione dei dati personali
            (garanteprivacy.it).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Titolare del trattamento</h2>
          <p>[Da completare: nome, indirizzo e contatto per le richieste privacy.]</p>
        </section>
      </main>
    </div>
  );
}
