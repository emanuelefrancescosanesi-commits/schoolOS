# SchoolOS — Piano tecnico (Fase 1)

19 nov 2026 · @Moses

## Sintesi

SchoolOS si può costruire come prodotto reale, con un'eccezione: oggi nessun registro elettronico italiano offre un accesso autorizzato per app di terze parti. Il piano costruisce quindi tutto il resto in modo completo e tratta il registro con un'architettura ad adapter, pronta per un'integrazione ufficiale ma onesta sul fatto che oggi non esiste.

Il cuore dell'app è "My School": un modello dati unico in cui ogni voto, compito, verifica e comunicazione ha una o più fonti (registro, email, Google Calendar, inserimento manuale). Le fonti si fondono senza duplicati e ogni modifica lascia traccia. Tutto il resto, cioè dashboard, analytics, inbox, assistente AI e briefing, legge da questo modello.

Decisioni tecniche principali:

- **Stack:** Next.js (App Router) con TypeScript, Tailwind CSS, shadcn/ui, Framer Motion e Recharts; Supabase per PostgreSQL, Auth, Storage e job pianificati; deploy su Vercel.
- **Sicurezza:** Row Level Security su ogni tabella; token OAuth cifrati con AES-256-GCM lato server e mai leggibili dal browser.
- **Calcoli deterministici:** medie, obiettivi e simulazioni sono codice testato, non risposte del modello AI. L'AI legge i dati tramite funzioni e propone; non scrive mai senza conferma.
- **Email come canale principale:** Gmail e Outlook via OAuth sostituiscono in buona parte il registro, perché molte comunicazioni e notifiche della scuola passano già da lì.
- **Modalità demo:** un dataset di esempio separato, attivabile solo esplicitamente e segnalato da un banner sempre visibile.

## Verifica delle integrazioni

Google Calendar, Gmail e Outlook si integrano in modo ufficiale; i tre registri elettronici no. Per uso personale (fino a 100 utenti di test) le integrazioni Google funzionano senza verifica, ma un account scolastico può essere bloccato dall'amministratore della scuola.

| Integrazione | Accesso ufficiale | Cosa ho verificato | Decisione |
|---|---|---|---|
| ClasseViva (Spaggiari) | No | Esistono solo librerie della community; una specifica OpenAPI della community dichiara che l'API non è documentata pubblicamente da Spaggiari (fonte) | Adapter "non disponibile"; import manuale, da file o da email |
| Argo (didUP / ScuolaNext) | No | Le librerie esistenti si basano su reverse engineering (fonte); le condizioni riportate limitano il token all'app didUP Famiglia o a fornitori autorizzati (fonte) | Come sopra |
| Axios Italia | No | Trovate solo le app ufficiali per alunni (fonte), nessuna API pubblica | Come sopra |
| Google Calendar | Sì | Gli scope Calendar sono "sensibili": serve solo la verifica dell'app, non un audit (fonte) | Sync bidirezionale completa |
| Gmail | Sì, con vincoli | `gmail.readonly` è uno scope "riservato": in produzione richiede verifica e audit di sicurezza CASA; in modalità test vale fino a 100 utenti (fonte, fonte) | Uso personale in modalità test; verifica solo se l'app verrà aperta ad altri |
| Google Workspace for Education | Dipende dalla scuola | L'amministratore può bloccare le app non configurate; per gli utenti designati come minorenni sono bloccate di default (fonte) | Messaggio d'errore chiaro (`admin_policy_enforced`) e istruzioni per chiedere l'approvazione |
| Outlook / Microsoft 365 Education | Sì, con vincoli | `Mail.Read` delegato è consentibile dall'utente, ma il tenant scolastico può richiedere il consenso dell'amministratore (fonte) | Come per Workspace |

> Nota: i riferimenti "(fonte)" del documento originale hanno perso i link durante la copia e vanno reinseriti.

**Perché non uso le librerie non ufficiali.** Chiedono la password del registro e chiamano endpoint che i fornitori non hanno autorizzato. Questo viola tre regole del progetto: niente accessi non autorizzati, niente password scolastiche in servizi terzi, niente connessioni fragili spacciate per stabili.

**Come resta utile il registro.** I dati del registro entrano in SchoolOS in quattro modi legittimi:

1. dalle email di notifica che la scuola o il registro inviano alla casella collegata;
2. da file esportati dall'utente (PDF o CSV del registro, pagella);
3. incollando il testo di una pagina del registro, che un parser trasforma in voti o compiti da confermare;
4. con l'inserimento manuale, reso veloce da scorciatoie e valori predefiniti.

Alcune app commerciali dichiarano una sincronizzazione ufficiale con questi registri (fonte). Esiste quindi una strada tramite accordi di partnership. L'adapter è progettato per accoglierla, ma non la si può percorrere per un progetto personale.

## Architettura

SchoolOS è un'unica app Next.js: il browser parla solo con il server, e il server è l'unico che tocca token, chiavi e provider esterni. Supabase conserva i dati sotto RLS e avvia le sincronizzazioni con `pg_cron`.

*Il browser non vede mai token o chiavi: il server legge e scrive su Supabase sotto RLS e manda al provider AI solo i dati necessari alla richiesta.*

**Adapter.** Ogni fonte implementa la stessa interfaccia, così aggiungere un provider (per esempio un registro che in futuro apra un'API ufficiale) non tocca il resto dell'app:

```typescript
interface SourceAdapter {
  id: 'gmail' | 'outlook' | 'gcal' | 'registro-import' | 'manual';
  status(userId: string): Promise<ConnectionStatus>;   // reale, mai simulato
  sync(userId: string, cursor?: string): Promise<{ candidates: Candidate[]; nextCursor?: string }>;
  revoke(userId: string): Promise<void>;
}
```

**Sincronizzazione.** `pg_cron` chiama ogni 15 minuti una route protetta da un segreto condiviso; lo stesso flusso parte da "Sincronizza ora". Ogni esecuzione scrive in `sync_logs`; gli errori ripetuti rallentano i tentativi (backoff esponenziale) e passano l'integrazione allo stato "errore" visibile in `/integrations`.

**Struttura del codice.**

- `app/` per le route;
- `lib/domain/` per la logica pura (medie, priorità, deduplicazione), coperta da test Vitest;
- `lib/adapters/`, `lib/ai/` e `lib/security/` per integrazioni, AI e cifratura;
- `supabase/migrations/` per schema e policy;
- `tests/e2e/` per i flussi principali con Playwright.

## Database e sicurezza

Ogni tabella appartiene a un solo utente (`user_id`) e la Row Level Security consente solo `user_id = auth.uid()`. Le uniche eccezioni sono i token, che il browser non può leggere in nessun caso. Le entità scolastiche sono "canoniche"; da dove arrivano lo registra `item_sources`, ed è questo che rende possibile la deduplicazione.

| Tabella | Contiene | Relazioni principali |
|---|---|---|
| `profiles` | Nome, scuola, classe, registro scelto, tipo di periodi, sistema di valutazione (scala, mezzi voti, "+" / "−"), metodo di media preferito, layout della dashboard (JSON) | 1:1 con `auth.users` |
| `school_years`, `periods` | Anno scolastico e periodi (quadrimestri o trimestri) con date | periodo → anno |
| `subjects` | Materia, colore, icona, peso predefinito per tipologia | → anno; ← voti, compiti, eventi |
| `teachers` | Nome, contatto, materie | N:M con `subjects` |
| `timetable_slots` | Giorno, ora inizio/fine, materia, docente, aula | → materia, docente |
| `timetable_changes` | Variazione puntuale (data, slot, cosa cambia, fonte) | → slot |
| `grades` | Valore, data, tipologia (scritto, orale, pratico), peso, argomento, note | → materia, periodo |
| `academic_goals` | Media obiettivo per materia o generale | → materia |
| `assignments` | Titolo, descrizione, assegnazione, scadenza, priorità, stato, minuti stimati | → materia; ← allegati |
| `school_events` | Verifiche, interrogazioni, uscite, eventi; data, stato (confermato, spostato, annullato) | → materia |
| `communications` | Messaggi unificati: email e registro; mittente, oggetto, anteprima, categoria, riassunto AI, letto/preferito/archiviato | ← allegati, estrazioni |
| `attachments` | File in Supabase Storage (bucket privato) | → compito o comunicazione |
| `item_sources` | Fonte di ogni elemento: tipo, ID esterno, hash del contenuto, data di ricezione | → qualsiasi entità canonica |
| `ai_extractions` | Proposte dell'AI (nuovo compito, nuovo evento, possibile modifica), con stato in attesa, accettata o rifiutata | → comunicazione, entità coinvolta |
| `change_log` | Ogni modifica: prima, dopo, fonte, data; alimenta "Recent Changes" e il briefing | → entità |
| `calendar_links` | Corrispondenza elemento ↔ evento Google (ID, etag, ultimo sync) | → compito o evento |
| `integrations` | Provider, stato, scope concessi, ultimo sync, token cifrati | 1 per provider |
| `sync_logs` | Ogni esecuzione: inizio, fine, esito, conteggi, errore | → integrazione |
| `notifications`, `notification_prefs` | Notifiche in-app e preferenze per canale e tipo | → utente |
| `ai_threads`, `ai_messages` | Conversazioni con l'assistente | → utente |

**Validazione.** Ogni input passa da schemi Zod condivisi tra client e server. Il database aggiunge vincoli `CHECK`: un voto deve stare nella scala scelta, un peso deve essere maggiore di zero, una scadenza non può precedere l'assegnazione.

**Token.** Sono cifrati con AES-256-GCM in una server action, usando una chiave presente solo nelle variabili d'ambiente del server. Si salva solo il refresh token. Una policy RLS nega ogni lettura dal client e solo il codice server con service role li decifra. Revocare un'integrazione cancella il token e chiama l'endpoint di revoca del provider.

**Protezione delle API.** Ogni route verifica la sessione e la proprietà della risorsa. Sono previsti rate limit sulle chiamate AI e sulla sincronizzazione e header di sicurezza (CSP, HSTS). Lo stato OAuth usa PKCE e un parametro `state` firmato.

**GDPR e recupero.** L'utente può esportare tutti i propri dati in JSON e cancellare l'account con eliminazione a cascata. Per le email si salvano solo i messaggi che passano il filtro scolastico, con anteprima e corpo; i messaggi scartati non vengono conservati. I backup automatici dipendono dal piano Supabase; il README documenta in più un `pg_dump` pianificato.

## Pagine e navigazione

L'app ha 16 schermate: le 14 richieste, più "My School" e una landing pubblica. Su desktop la sidebar è comprimibile; su smartphone diventa una barra inferiore con cinque voci (Dashboard, My School, Compiti, Inbox, Altro). Una palette comandi (⌘K) cerca tra tutte le fonti e dà accesso alle azioni rapide, sul modello di Raycast e Linear.

| Route | Pagina | Contenuto chiave |
|---|---|---|
| `/` | Landing | Presentazione, asset Higgsfield, accesso |
| `/login` | Login / Registrazione | Email + password o Google; recupero password |
| `/onboarding` | Onboarding | Setup su misura al primo avvio, 7 passi: nome, scuola, classe, anno e periodi, materie, scala di valutazione, registro; poi integrazioni facoltative. Vedi "Configurazione per studente" |
| `/dashboard` | Dashboard | Widget spostabili e nascondibili: rendimento, prossimi impegni, attività, comunicazioni, settimana |
| `/my-school` | My School | Feed unificato con fonti e "Recent Changes" |
| `/grades` | Voti | Elenco filtrabile, inserimento rapido, 5 grafici |
| `/analytics` | Analisi rendimento | Trend, materie instabili, confronto periodi, obiettivi, simulatore |
| `/subjects` | Materie | Scheda per materia: media, voti, compiti, docenti |
| `/tasks` | Compiti | Lista, Kanban e calendario; priorità automatica |
| `/calendar` | Calendario | Viste giorno, settimana, mese, agenda; colori per tipo |
| `/inbox` | School Inbox | Email e registro unificati, riassunti, "Cosa è cambiato?", Daily Briefing |
| `/timetable` | Orario | Griglia settimanale con variazioni evidenziate |
| `/assistant` | Assistente AI | Chat con accesso ai dati, risposte con riferimenti |
| `/notifications` | Notifiche | Centro notifiche e filtri |
| `/settings` | Impostazioni | Profilo, tema, media, notifiche, esporta ed elimina dati |
| `/integrations` | Integrazioni | Stato reale di ogni connessione, ultimo sync, log, revoca |

Ogni pagina ha quattro stati progettati: caricamento (skeleton), vuoto (illustrazione e azione primaria), errore (messaggio comprensibile e riprova) e contenuto. Ogni azione distruttiva chiede conferma e offre "Annulla" per qualche secondo.

## Design system e identità visiva

L'interfaccia funzionale usa token di design e componenti shadcn/ui personalizzati. Higgsfield serve per gli elementi decorativi: landing, onboarding, empty states, video. Il logo lo disegno a mano in SVG, perché un generatore di immagini non produce un simbolo vettoriale pulito.

| Token | Dark | Light | Uso |
|---|---|---|---|
| `bg` | `#0B0D12` | `#FAFAFB` | Sfondo |
| `surface` | `#141821` | `#FFFFFF` | Card |
| `surface-2` | `#1B2230` | `#F2F3F6` | Card annidate, hover |
| `accent` | `#6366F1` (indaco) | `#4F46E5` | Azione primaria, focus |
| `positive` | `#22C55E` | `#16A34A` | Voti sufficienti, trend in crescita |
| `critical` | `#EF4444` | `#DC2626` | Insufficienze, scadenze superate |
| `muted` | `#8B93A7` | `#6B7280` | Testo secondario |

I colori della versione light, le soglie positivo/critico (per esempio 6 su 10) e i colori delle materie sono proposte. Prima della Fase 2 verifico ogni coppia testo/sfondo contro il contrasto WCAG AA.

- **Tipografia:** Geist Sans per l'interfaccia, Geist Mono per numeri e medie, così le cifre restano allineate in colonna. Scala 12 / 14 / 16 / 20 / 28 / 40.
- **Forma:** raggio 12 px per le card e 8 px per i controlli; bordi da 1 px al posto delle ombre, come Linear e Vercel.
- **Icone:** Lucide, tratto 1,5.
- **Movimento:** Framer Motion, durate 150–250 ms con easing morbido; transizioni di pagina e layout animati per i widget. Con `prefers-reduced-motion` attivo, tutte le animazioni si disattivano.
- **Grafici:** Recharts con palette per materia coerente in tutta l'app, tooltip al passaggio e dettaglio al clic.

**Pipeline Higgsfield.** Prima scrivo una brand brief (simbolo, palette, mood); da quella genero sfondi astratti per landing e onboarding, illustrazioni per gli empty states e un video promozionale breve. Le immagini vengono convertite in WebP/AVIF; i video in MP4 H.264 e WebM compressi, caricati in lazy loading e mai nelle pagine operative. Gli asset vanno nelle cartelle richieste (`/public/assets/branding`, `backgrounds`, `animations`, `illustrations`, `logos`). Ogni generazione consuma crediti del tuo account: prima di ogni lotto ti mostro la stima del costo e aspetto il via libera.

## AI: assistente, classificazione ed estrazione

L'AI non ricorda e non calcola: interroga il database tramite funzioni e ogni dato che cita rimanda al record da cui proviene. Il provider è configurabile con un'interfaccia unica; quello predefinito è la API di Claude, e altri provider si aggiungono come adapter.

**Assistente.** Ha a disposizione strumenti in sola lettura (`getGrades`, `getAverages`, `getUpcoming`, `getAssignments`, `getCommunications`, `getChanges`, `simulateGrades`). Se un dato manca, lo dice invece di stimarlo. Il piano di studio per i prossimi cinque giorni si basa su scadenze e minuti stimati reali e diventa compiti solo dopo la tua conferma.

**Calcoli.** Medie, obiettivi e simulazioni sono funzioni TypeScript coperte da test, che l'assistente chiama come strumento. Con voti $v_i$ di peso $w_i$, somma pesata $S = \sum v_i w_i$ e peso totale $W = \sum w_i$, il voto $x$ necessario alla prossima prova di peso $w$ per arrivare alla media $T$ è:

$$
x = \frac{T\,(W + w) - S}{w}
$$

Se $x$ supera il massimo della scala, l'app dice che l'obiettivo non è raggiungibile con una sola prova e calcola quante prove servono. La simulazione di più voti aggiunge ciascuno a $S$ e $W$ con il proprio peso.

**Classificazione e riassunto delle email.** Ogni messaggio che passa il filtro scolastico riceve una categoria (tra le 11 richieste), un riassunto di 2–3 righe e quattro campi: cosa chiede, scadenze, allegati da leggere, azione richiesta sì/no. L'uscita segue uno schema JSON validato con Zod; se la validazione fallisce, il messaggio resta "non classificato". L'originale è sempre a un clic.

**Estrazione di compiti ed eventi.** L'AI produce una proposta in `ai_extractions` con materia, descrizione, scadenza, livello di confidenza e frase sorgente evidenziata. Le date relative ("lunedì prossimo") vengono risolte rispetto alla data di ricezione del messaggio. Tu confermi, modifichi o rifiuti; solo dopo la conferma si crea il compito e, se vuoi, l'evento su Google Calendar.

**Daily School Briefing.** Si genera ogni mattina esclusivamente da `change_log` e dai nuovi messaggi delle ultime 24 ore. Ogni riga rimanda all'elemento originale; se non è successo niente, il briefing lo dice.

**Privacy dell'AI.** Il testo delle email viene inviato al provider AI solo per le funzioni attive, e ognuna si può spegnere nelle impostazioni. L'informativa nell'onboarding lo spiega in chiaro.

## Configurazione per studente

Le scelte non sono fisse: ogni utente le sceglie nell'onboarding e le può cambiare in `/settings`. Il primo avvio è un setup guidato su misura, prima di qualsiasi altra schermata.

| Scelta | Opzioni | Effetto |
|---|---|---|
| Registro | ClasseViva, Argo, Axios, altro, nessuno | Mostra le istruzioni di import adatte a quel registro (email di notifica, file, testo incollato, manuale). Nessun accesso diretto: vedi "Verifica delle integrazioni" |
| Email | Google (principale), Outlook / Microsoft 365 (opzionale), nessuna | Quali adapter attivare |
| Scala di voti | Decimi; mezzi voti sì/no; "+" e "−" sì/no | Valori ammessi nei voti e vincolo `CHECK` sul database |
| Periodi | Trimestri; trimestre + pentamestre; quadrimestri | Righe di `periods` con le date scelte dall'utente |
| Metodo di media | Aritmetica o pesata | Calcoli in `lib/domain/` |

Tutto si appoggia sui campi già previsti in `profiles` e `periods`: la configurazione cambia i dati, non il codice. Per questo ogni calcolo legge la scala e i periodi dal profilo e non assume né i decimi né un numero fisso di periodi. Un "+" vale +0,25 e un "−" vale −0,25 (confermato da Emanuele il 19 nov 2026).

## Chatbot di supporto

Oltre all'assistente sui dati, l'app ha un chatbot di supporto con un solo compito: rispondere alle domande dell'utente su come si usa l'app e, se non capisce la domanda, chiedere di riformularla.

- **Modello:** il più economico della famiglia, Haiku 5.5, dietro l'interfaccia di provider già prevista.
- **Pochi token:** nessuna cronologia lunga (solo gli ultimi scambi), `max_tokens` basso, risposte brevi, un prompt di sistema compatto con la guida dell'app messa in cache.
- **Nessun accesso ai dati scolastici:** non legge voti, email o compiti, quindi costa poco e non espone nulla.
- **Limiti:** rate limit per utente, come per le altre funzioni AI.

## My School: fonti, duplicati e modifiche

Ogni dato in arrivo viene normalizzato in un candidato, confrontato con gli elementi esistenti e poi fuso, creato o proposto come modifica. Una verifica che compare sia in un'email sia in un inserimento manuale resta quindi un solo elemento, con due fonti.

1. **Normalizzazione:** l'adapter della fonte produce un candidato con tipo, materia, data, titolo e un hash del contenuto.
2. **Già visto?** Se l'ID esterno e l'hash coincidono con una fonte esistente, il candidato viene ignorato. Se coincide solo l'ID esterno, si tratta di un aggiornamento della stessa fonte e si passa al punto 5.
3. **Ricerca di duplicati:** si cercano elementi dello stesso tipo e materia con data entro ±2 giorni, valutando la somiglianza del titolo (trigrammi `pg_trgm`).
4. **Decisione:** con punteggio alto si aggiunge la fonte all'elemento esistente; con punteggio medio si chiede "Possibile duplicato"; con punteggio basso si crea un nuovo elemento.
5. **Modifica:** se cambiano data, aula o argomento, si registra una riga in `change_log` con prima, dopo, fonte e data della comunicazione, e si mostra la notifica "Possibile modifica rilevata". Gli elementi inseriti a mano non vengono mai sovrascritti in automatico.

Le soglie esatte si tarano in Fase 4 su esempi reali. "Recent Changes" e "Cosa è cambiato?" sono due viste di `change_log`, filtrate per periodo o per ultima sincronizzazione.

**Google Calendar bidirezionale.** I compiti e gli eventi che scegli di sincronizzare finiscono in un calendario dedicato "SchoolOS", così gli impegni personali non vengono toccati. Gli altri calendari sono in sola lettura e servono a calcolare il carico della settimana. La sync incrementale usa i `syncToken` della Calendar API; un job periodico la esegue e il pulsante "Sincronizza ora" la avvia a mano. Per i conflitti, se un evento è cambiato su entrambi i lati dall'ultimo sync (confronto `etag` e `updated_at`), non vince nessuno in automatico: compaiono le due versioni e scegli tu. Un evento cancellato su Google diventa "scollegato" in SchoolOS, non cancellato.

## Roadmap

Siamo alla fine della Fase 1. Ogni fase termina con qualcosa che puoi controllare tu, e la successiva parte solo dopo il tuo via libera.

Alla fine di ogni fase ricevi il codice aggiornato e una breve nota su cosa è cambiato e cosa resta aperto. Per la Fase 2 propongo di partire dal design system e dalla Dashboard, poi le altre pagine in ordine di importanza.

## Cosa serve da te e limiti

Per approvare il piano servono le tue risposte alle domande qui sotto; gli account servono solo dalla Fase 3. Il codice lo scrivo comunque per intero, ma in questa chat non posso installare pacchetti, quindi la prima compilazione e i test li esegui tu in locale (oppure apri una nuova chat dopo aver abilitato le installazioni nelle impostazioni di rete).

### Da decidere prima della Fase 2

- [x] Consegna del codice: repository GitHub `schoolOS`
- [x] Registro elettronico: non fisso, scelto dall'utente in onboarding (ClasseViva, Argo, Axios, altro); i dati entrano per email, file, testo incollato o inserimento manuale
- [x] Email: Google come principale, Outlook / Microsoft 365 opzionale
- [x] Scala di valutazione: decimi, con opzioni per mezzi voti e "+" / "−"; suddivisione dell'anno scelta dall'utente (trimestri, trimestre + pentamestre, quadrimestri)
- [x] Provider AI: Claude, con il modello più economico (Haiku 5.5) per il chatbot di supporto
- [ ] Da verificare con la scuola: se permette app di terze parti sull'email scolastica

Dettagli delle scelte in "Configurazione per studente" e "Chatbot di supporto".

### Da creare prima della Fase 3

Con guida passo passo; le chiavi vanno solo nel file `.env.local`, mai in chat.

- [ ] Progetto Supabase
- [ ] Progetto Google Cloud: schermata di consenso in modalità test, client OAuth, API Calendar e Gmail abilitate
- [ ] Registrazione app su Microsoft Entra (solo se usi Outlook)
- [ ] Chiave API del provider AI
- [ ] Account Vercel per il deploy

### Limiti documentati

- Il registro elettronico non si collega direttamente (vedi "Verifica delle integrazioni"): l'app lo mostra con lo stato "non disponibile" e offre i quattro canali alternativi.
- Gmail resta in modalità test: va benissimo per te e pochi amici, ma per aprirla al pubblico servono verifica Google e audit CASA.
- Un amministratore scolastico può bloccare l'accesso all'email della scuola; in quel caso SchoolOS mostra l'errore e le istruzioni, senza aggirarlo.
- Le notifiche push via browser funzionano su desktop e Android; su iPhone solo se l'app è installata nella schermata Home.
- I job pianificati dipendono dai limiti del piano gratuito di Supabase e Vercel, che verifico al momento della configurazione.
