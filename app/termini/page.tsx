import type { Metadata } from "next";
import { LegalPage, LegalSection, Todo } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Termini di servizio" };

/** Condizioni d'uso in italiano semplice. I campi gialli vanno completati prima dell'apertura al pubblico. */
export default function TermsPage() {
  return (
    <LegalPage title="Termini di servizio">
      <p className="rounded-control border border-border p-3 text-muted">
        Ultimo aggiornamento: 26 novembre 2026. Versione provvisoria: i campi evidenziati vanno completati prima
        dell&apos;apertura al pubblico.
      </p>

      <LegalSection title="Cos'è SchoolOS">
        <p>
          SchoolOS è uno strumento gratuito per studenti: raccoglie voti, compiti, verifiche e orario in un posto solo e calcola
          medie e andamento. È un aiuto per organizzarti, non un documento ufficiale della scuola.
        </p>
        <p>
          SchoolOS non è collegato né approvato dai fornitori dei registri elettronici (Axios, ClasseViva, Argo e altri). Il
          registro della scuola resta l&apos;unica fonte ufficiale dei tuoi voti.
        </p>
      </LegalSection>

      <LegalSection title="Chi può usarlo">
        <p>
          Devi avere almeno 14 anni. Se ne hai meno, serve il consenso di un genitore o di chi ne fa le veci. Un account è per
          una sola persona: non condividere la password.
        </p>
      </LegalSection>

      <LegalSection title="Cosa ti chiediamo">
        <ul className="list-disc space-y-1 pl-5">
          <li>Inserisci dati veri e tuoi: i voti e i compiti dei tuoi compagni non vanno caricati.</li>
          <li>Non usare il servizio per attività illecite, per disturbare gli altri o per sovraccaricarlo (per esempio con programmi automatici).</li>
          <li>Non provare ad accedere ai dati di altri utenti né a aggirare i limiti di sicurezza.</li>
          <li>Rispetta le regole della tua scuola sull&apos;uso del registro e dei dispositivi.</li>
        </ul>
      </LegalSection>

      <LegalSection title="I tuoi dati">
        <p>
          I dati che inserisci restano tuoi. Come li trattiamo è spiegato nell&apos;
          <a href="/privacy" className="text-accent-text underline">
            informativa sulla privacy
          </a>
          . Puoi scaricarli o eliminare l&apos;account in qualunque momento da Impostazioni.
        </p>
      </LegalSection>

      <LegalSection title="Precisione dei calcoli">
        <p>
          Medie e previsioni sono calcolate sui dati che hai inserito o importato e possono differire dalla valutazione ufficiale
          della scuola. Prima di prendere decisioni importanti, controlla sempre il registro.
        </p>
      </LegalSection>

      <LegalSection title="Funzioni a pagamento">
        <p>
          La base di SchoolOS è gratuita. In futuro potranno esserci funzioni opzionali a pagamento (per esempio la lettura
          automatica dei voti con intelligenza artificiale): saranno sempre chiaramente indicate e non si attiveranno senza la
          tua conferma.
        </p>
      </LegalSection>

      <LegalSection title="Disponibilità e responsabilità">
        <p>
          Facciamo il possibile perché il servizio funzioni, ma lo offriamo «così com&apos;è»: può avere interruzioni, errori o
          cambiare. Non garantiamo che sia sempre disponibile e, nei limiti consentiti dalla legge, non rispondiamo di danni
          dovuti a un uso scorretto o a dati inseriti in modo errato. Questo non limita i diritti che la legge ti riconosce come
          consumatore.
        </p>
      </LegalSection>

      <LegalSection title="Sospensione e cancellazione">
        <p>
          Puoi chiudere l&apos;account quando vuoi. Possiamo sospendere o chiudere un account che viola questi termini o mette a
          rischio il servizio o altri utenti.
        </p>
      </LegalSection>

      <LegalSection title="Modifiche">
        <p>
          Se cambiamo questi termini in modo importante, ti avvisiamo nell&apos;app prima che le modifiche valgano. Continuare a
          usare SchoolOS dopo l&apos;avviso significa accettarle.
        </p>
      </LegalSection>

      <LegalSection title="Chi siamo e come contattarci">
        <p>
          Gestore del servizio: <Todo>nome e cognome (o ragione sociale), indirizzo</Todo>
        </p>
        <p>
          Contatto: <Todo>indirizzo email di assistenza</Todo>
        </p>
        <p>Si applica la legge italiana. Per i consumatori resta il foro del luogo di residenza.</p>
      </LegalSection>
    </LegalPage>
  );
}
