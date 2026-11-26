import type { Metadata } from "next";
import { LegalPage, LegalSection, Todo } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Informativa sulla privacy" };

/**
 * Informativa (artt. 13-14 GDPR). Descrive ciò che il codice fa davvero. I campi gialli vanno
 * completati prima dell'apertura al pubblico (vedi docs/AUDIT-SICUREZZA.md).
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Informativa sulla privacy">
      <p className="rounded-control border border-border p-3 text-muted">
        Ultimo aggiornamento: 26 novembre 2026. Versione provvisoria: i campi evidenziati vanno completati prima
        dell&apos;apertura al pubblico.
      </p>

      <LegalSection title="Chi è il titolare del trattamento">
        <p>
          <Todo>nome e cognome (o ragione sociale), indirizzo</Todo>
        </p>
        <p>
          Contatto per le richieste sulla privacy: <Todo>indirizzo email dedicato</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Quali dati trattiamo">
        <ul className="list-disc space-y-1 pl-5">
          <li>Account: indirizzo email, nome di battesimo e password (conservata solo come impronta cifrata, mai in chiaro).</li>
          <li>
            Accesso con Google: se scegli «Continua con Google» riceviamo solo email, nome e foto del profilo. Non accediamo
            alla tua posta (Gmail), al Drive né ad altri dati Google.
          </li>
          <li>Dati scolastici che inserisci o importi: materie, voti, compiti e verifiche, orario, scuola e classe (facoltative), impostazioni.</li>
          <li>Collegamento dell&apos;estensione del browser: un codice revocabile, di cui conserviamo solo l&apos;impronta (hash).</li>
        </ul>
        <p>
          <strong>Non chiediamo né conserviamo mai la password del registro elettronico.</strong> Non usiamo i tuoi dati per
          pubblicità, non li vendiamo e non facciamo profilazione.
        </p>
      </LegalSection>

      <LegalSection title="Perché e su quale base">
        <p>
          Per fornirti il servizio che hai richiesto creando l&apos;account (art. 6.1.b GDPR): mostrarti medie, andamento e
          scadenze. Per la sicurezza (limiti di utilizzo, protezione dai bot) trattiamo i dati tecnici necessari
          (art. 6.1.f). I dati non sono usati per altri scopi.
        </p>
      </LegalSection>

      <LegalSection title="Cookie">
        <p>
          Usiamo solo cookie tecnici: quello di sessione per tenerti collegato. Tema e preferenze di visualizzazione restano nel
          tuo dispositivo. Nessun cookie di statistica o pubblicità. Se è attiva la verifica anti-bot, Cloudflare Turnstile può
          impostare un proprio cookie tecnico per distinguere le persone dai bot.
        </p>
      </LegalSection>

      <LegalSection title="Minori">
        <p>
          In Italia i minori di 14 anni possono usare il servizio solo con il consenso di un genitore o di chi ne fa le veci.
          Registrandoti dichiari di avere almeno 14 anni oppure di avere questo consenso.
        </p>
        <p>
          Come il consenso viene raccolto e verificato: <Todo>da definire con la scuola (vedi sotto «Titolare»)</Todo>
        </p>
      </LegalSection>

      <LegalSection title="Chi li tratta per nostro conto">
        <ul className="list-disc space-y-1 pl-5">
          <li>Supabase: database e accesso, server nell&apos;Unione Europea (Francoforte).</li>
          <li>Vercel: hosting dell&apos;applicazione (funzioni eseguite a Francoforte).</li>
          <li>Cloudflare: verifica anti-bot sui moduli di accesso, quando attiva.</li>
          <li>Resend (o altro servizio di invio email): per le email di conferma e di recupero password.</li>
          <li>
            Anthropic: solo se usi la lettura automatica dei voti (piano Pro, quando attiva): il testo o lo screenshot che invii
            viene trasmesso per essere letto e non per altri scopi. Con l&apos;inserimento manuale, il testo incollato e la
            lettura dello screenshot nel browser, nulla viene inviato a terzi.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Quanto li conserviamo">
        <p>
          Finché mantieni l&apos;account. Quando lo elimini da Impostazioni, profilo, voti, compiti, materie e codici
          dell&apos;estensione vengono cancellati subito dal database. Le copie di sicurezza (backup) possono conservarli per un
          periodo limitato, fino a <Todo>giorni di conservazione dei backup del piano scelto</Todo>, poi vengono sovrascritte.
        </p>
      </LegalSection>

      <LegalSection title="I tuoi diritti">
        <p>
          Puoi accedere ai dati, scaricarli in formato JSON (portabilità), correggerli ed eliminarli, tutto da Impostazioni.
          Puoi inoltre opporti al trattamento, chiedere la limitazione, o proporre reclamo al Garante per la protezione dei
          dati personali (garanteprivacy.it). Per qualunque richiesta scrivi al contatto indicato sopra.
        </p>
      </LegalSection>

      <LegalSection title="Se la tua scuola adotta SchoolOS">
        <p>
          In quel caso titolare del trattamento sarà la scuola e il fornitore del servizio agirà come responsabile, con un
          contratto ai sensi dell&apos;art. 28 GDPR. <Todo>da confermare con la scuola</Todo>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
