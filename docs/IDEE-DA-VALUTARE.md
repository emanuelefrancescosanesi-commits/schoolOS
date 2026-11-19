# SchoolOS — Idee da valutare

Appunti di Emanuele del 19 nov 2026, con una prima valutazione rispetto al [Piano tecnico Fase 1](PIANO-TECNICO-FASE-1.md).

## 1. Chatbot nell'app con Haiku 5.5 o modello base semplice

- **Compatibile col piano:** l'assistente AI c'è già (`/assistant`) e il provider è configurabile.
- **Scelta consigliata:** Haiku 5.5 come predefinito. È economico e basta per chiamare gli strumenti in sola lettura (`getGrades`, `getUpcoming`, ecc.).
- **Da decidere:** limite di messaggi per utente, per tenere sotto controllo i costi.

## 2. Layout professionale ma con colori

- **Compatibile col piano:** i token attuali sono sobri, con indaco come unico accento.
- **Proposta:** più colore tramite palette per materia e stati (positivo, critico, in scadenza), mantenendo sfondi neutri.
- **Vincolo:** ogni coppia testo/sfondo resta soggetta alla verifica WCAG AA.

## 3. Attività pianificata che legge il registro e riempie il calendario in-app

- **Conflitto col piano:** nessun registro offre un accesso autorizzato, e leggerlo con le credenziali dell'utente è escluso dal piano.
- **Versione realizzabile:** il job pianificato (già previsto, ogni 15 minuti) legge le email di notifica del registro dalla casella collegata e propone compiti, comunicazioni e verifiche da confermare nel calendario in-app.
- **Alternative:** import da file, testo incollato, inserimento manuale.
- **Se in futuro esce un'API ufficiale:** si aggiunge come adapter.

## 4. Community per scambiarsi appunti (utenti ChatGPT Pro / Claude Pro / Gemini Pro)

- **Rischi da risolvere prima:**
  - **Copyright:** appunti derivati da slide, libri e materiale dei docenti.
  - **Minori:** molti studenti sono minorenni, quindi servono moderazione, segnalazioni e regole GDPR su contenuti generati dagli utenti.
  - **"Utenti Pro":** non esiste modo di verificare un abbonamento, e gli abbonamenti non danno accesso API. Meglio un tag volontario "fatto con…" che un filtro.
- **Consiglio:** tenerla fuori dal primo rilascio. Prima il nucleo (My School, voti, compiti, inbox), poi la community come fase a sé.
