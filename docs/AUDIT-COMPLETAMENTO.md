# Audit di completamento SchoolOS — 22 novembre 2026

Base: `main` @ 586193b. Metodo: lint/typecheck/test (tutti verdi: 262 test passati, 64 DB-test saltati senza `TEST_DATABASE_URL`), lettura di route/azioni/mapper, visita automatica di 21 route a 390 px e 1280 px in modalità demo (nessun overflow orizzontale, nessun errore console tranne quelli indicati).
Stime: **S** < 1 h, **M** 1–3 h, **L** > 3 h. Priorità: **P0** funzione mancante/rotta visibile, **P1** importante, **P2** rifinitura.

## 1. Compiti / Da fare / Calendario / Orario

| # | Pri | Problema | File | Stima |
|---|---|---|---|---|
| 1.1 | P0 | **Calendario e «Comunicazioni» sempre vuoti in modalità live**: `toSchoolData` imposta `events: []` e `messages: []`. Non esiste tabella né UI per creare verifiche/interrogazioni. Serve tabella `events` (migrazione SQL), azioni add/delete, form nel Calendario, lettura nel mapper, uso in dashboard («Prossimi impegni», «Settimana») e Notifiche. | `lib/data/mappers.ts`, `lib/data/school-data.ts`, `components/calendar/month-view.tsx`, `app/(app)/calendar/page.tsx`, nuovo `app/(app)/calendar/actions.ts`, `supabase/migrations/` | L |
| 1.2 | P1 | **Compiti non modificabili** (solo aggiungi/spunta/elimina): niente modifica titolo/scadenza/materia, niente annulla dopo eliminazione. | `app/(app)/tasks/actions.ts`, `components/tasks/task-board.tsx` | M |
| 1.3 | P1 | **Orario**: solo add/delete, nessuna modifica; verificare sovrapposizioni orari e validazione ora fine > inizio. | `app/(app)/timetable/actions.ts`, `components/timetable/timetable-board.tsx` | M |
| 1.4 | P1 | **Due liste sovrapposte** («Compiti» `/tasks` e «Da fare» `/todo`) con dati separati: la dashboard e le Notifiche leggono solo i Compiti, i task di «Da fare» non compaiono in Calendario/Notifiche/Dashboard. Unificare le fonti o collegarle (`importAssignment` esiste ma è manuale). | `lib/data/todo-data.ts`, `lib/domain/reminders.ts`, `lib/dashboard/view-model.ts` | L |
| 1.5 | P2 | Calendario: vista settimana/agenda, salto a oggi, tap su giorno con elenco impegni su telefono. | `components/calendar/month-view.tsx` | M |
| 1.6 | P2 | Orario: vista «oggi» in dashboard collegata ai dati reali (verificare). | `components/dashboard/week-widget.tsx` | S |

## 2. Voti / import / estensione

| # | Pri | Problema | File | Stima |
|---|---|---|---|---|
| 2.1 | P1 | **Voti non modificabili**: solo aggiungi/elimina/ripristina. Serve modifica (voto, peso, data, tipo, nota). | `app/(app)/grades/actions.ts`, `components/grades/grades-view.tsx` | M |
| 2.2 | P1 | `/grades/import` risponde 404 (l'import vive dentro `/grades`): ok, ma verificare che nessun link/estensione punti a quella URL. | `components/grades/*`, `extension/` | S |
| 2.3 | P1 | Import: percorsi di errore e stati vuoti (OCR fallito, testo non riconosciuto, materia non trovata, duplicati) da coprire con test e messaggi chiari; test su casi reali Axios (testo incollato). | `lib/import/*`, `components/grades/import-card.tsx` | M |
| 2.4 | P1 | Estensione: codice revocato/scaduto (scade dopo 90 gg) → l'estensione deve mostrare cosa fare; test manuale dopo la migrazione security_hardening. | `extension/`, `components/grades/extension-link.tsx` | M |
| 2.5 | P2 | Export CSV dei voti e filtri/ordinamento per materia e periodo nella lista. | `components/grades/grades-view.tsx` | M |

## 3. Analisi

| # | Pri | Problema | File | Stima |
|---|---|---|---|---|
| 3.1 | P1 | Stato vuoto/pochi dati (0–1 voti per materia, un solo periodo): verificare che grafici e simulatore non mostrino NaN/grafici vuoti. | `components/analytics/*`, `app/(app)/analytics/page.tsx` | S |
| 3.2 | P2 | Grafici: alternativa testuale/tabellare per accessibilità, colori non solo come segnale. | `components/dashboard/performance-widget.tsx`, `components/analytics/insights.tsx` | M |

## 4. Integrazioni / My School / Notifiche / Inbox

| # | Pri | Problema | File | Stima |
|---|---|---|---|---|
| 4.1 | P0 | **Inbox è una pagina «In arrivo» ma è nel menu e nella barra inferiore mobile** (dead tab). Decisione: nasconderla da menu/barra finché Gmail non c'è, o realizzare Inbox minima (comunicazioni incollate a mano). Collegato a 1.1 (`messages`). | `lib/navigation.ts`, `app/(app)/[section]/page.tsx`, `lib/i18n/it.ts` | S (nascondere) / L (realizzare) |
| 4.2 | P0 | La rotta `[section]` (404 e Inbox) genera in dev l'errore «params outside Suspense / Could not validate instant»; la pagina 404 mostra anche un avviso «script tag» in console. Va sistemata per non rompere la build/hydration. | `app/(app)/[section]/page.tsx`, `app/not-found.tsx` | S |
| 4.3 | P1 | **Notifiche**: solo promemoria calcolati, nessuno stato letto/non letto né contatore nel menu, nessun push. Minimo: badge con numero sul menu/barra. | `app/(app)/notifications/page.tsx`, `lib/domain/reminders.ts`, `components/shell/*` | M |
| 4.4 | P1 | My School: modifica scuola/periodi/materie (colore, docente) e aggiunta/eliminazione materie; oggi solo rinomina. | `app/(app)/my-school/page.tsx`, `app/(app)/subjects/actions.ts` | M |
| 4.5 | P2 | Integrazioni Google (Gmail/Calendar): dichiarate «non disponibili»; ok finché il consenso Google/CASA non c'è, ma l'etichetta deve essere onesta. | `app/(app)/integrations/page.tsx` | S |

## 5. Impostazioni / onboarding / account / assistente

| # | Pri | Problema | File | Stima |
|---|---|---|---|---|
| 5.1 | P0 | **Impostazioni sono solo «email, scarica dati, elimina account»**: mancano nome, scala voti (decimi, mezzi voti, +/−), periodi (trimestri/pentamestre/quadrimestri), registro, tema, lingua. Tutto ciò che si sceglie in onboarding deve essere modificabile dopo. | `app/(app)/settings/*`, `lib/validation/onboarding.ts`, `lib/data/mappers.ts` | L |
| 5.2 | P1 | Onboarding: possibilità di rifarlo/tornare indietro, errori di rete, scelta salvata se si chiude a metà. | `components/onboarding/wizard.tsx`, `app/onboarding/actions.ts` | M |
| 5.3 | P1 | Account: cambio password e cambio email dall'app (oggi solo recupero password dal login). Login Google non configurato (vedi docs/SETUP-GOOGLE-SMTP.md). | `lib/auth/actions.ts`, `app/(app)/settings/*` | M |
| 5.4 | P1 | Assistente: gate Pro/AI spenta ok; verificare messaggi per utente free (invito chiaro), limiti giornalieri, errori API, risposta troppo lunga/vuota. | `app/(app)/assistant/*`, `components/assistant/chat-view.tsx`, `lib/assistant/*` | S |
| 5.5 | P2 | Pagina `/privacy` provvisoria: va sostituita con informativa reale (decisione di Emanuele/DPO), consenso <14 anni. | `app/privacy/page.tsx` | M (+ legale) |

## 6. Mobile / PWA / accessibilità

| # | Pri | Problema | File | Stima |
|---|---|---|---|---|
| 6.1 | P1 | **Bersagli tocco troppo piccoli su telefono**: pulsanti «Segna come fatto» 18×18 px (dashboard, Compiti), 20×20 in «Da fare» e checkbox signup; minimo consigliato 44 px (almeno area di tocco estesa). Link «Vedi tutto» alti 28 px. | `components/tasks/task-board.tsx`, `components/todo/todo-row.tsx`, `components/dashboard/tasks-widget.tsx`, `components/ui/checkbox.tsx`, `components/auth/auth-forms.tsx` | S |
| 6.2 | P1 | **Nessun service worker**: la PWA si installa ma non ha offline né pagina di errore di rete. Minimo: service worker con cache shell + pagina offline. | `public/`, `app/layout.tsx`, `next.config.ts` | M |
| 6.3 | P1 | Un solo `error.tsx` (nel gruppo `(app)`): mancano `global-error.tsx`, `loading.tsx` per segmento e error boundary per le pagine fuori gruppo (auth, onboarding). | `app/` | S |
| 6.4 | P2 | Accessibilità: audit axe su tutte le pagine (nessun nome mancante rilevato su 5 pagine campione), contrasto in tema scuro/chiaro, focus visibile, grafici con alternativa testuale, `prefers-reduced-motion`. | `components/ui/*`, `app/globals.css` | M |
| 6.5 | P2 | Test visivi/e2e Playwright a 390 e 1280 px per i flussi principali (oggi non esistono). | nuovo `tests/e2e/` | L |
| 6.6 | P2 | Icone e screenshot nel manifest (richiesti per installabilità curata su Android), shortcut «Aggiungi compito». | `app/manifest.ts`, `public/icons/` | S |

## 7. Qualità / test / infrastruttura

| # | Pri | Problema | File | Stima |
|---|---|---|---|---|
| 7.1 | P1 | 64 test DB saltati senza Postgres: far girare postgres nella CI (GitHub Actions) così non restano ciechi. Verificare che esista un workflow CI. | `.github/workflows/`, `tests/db/*` | M |
| 7.2 | P1 | Nessun test dei componenti React (task board, grades view, wizard, quick-add) né delle server action (validazione input, utenti non autenticati). | `components/*`, `app/**/actions.ts` | L |
| 7.3 | P1 | Migrazioni non ancora applicate in Supabase (a mano da Emanuele): `20261122100000_delete_my_account`, `20261122110000_match_materie`, `20261122110500_timetable`, `20261122120000_security_hardening`, `20261122130000_todo`. Prima dell'apertura ad altri: SMTP + conferma email, CAPTCHA, piano Pro Supabase. | `supabase/migrations/` | S (guida) |
| 7.4 | P2 | Rate limit e tetti: verificare azioni add* contro invio massivo (oltre ai tetti righe). | `app/**/actions.ts` | S |

## Ordine di smistamento consigliato (un thread per area)

1. **Calendario + eventi + Inbox/Comunicazioni** (1.1, 4.1, 4.2): sblocca le pagine oggi vuote. *Contiene una migrazione.*
2. **Impostazioni complete + account** (5.1, 5.3, 5.2, 4.4). *Può avere una migrazione.*
3. **Voti: modifica + import robusto + estensione** (2.1–2.5).
4. **Compiti / Da fare unificati + modifica + Orario** (1.2–1.4).
5. **Mobile/PWA/accessibilità** (6.1–6.6, 6.3): indipendente, può partire subito.
6. **Notifiche + Analisi + Assistente rifiniture** (4.3, 3.x, 5.4).
7. **Test e CI** (7.1, 7.2, 6.5): dopo gli altri o in parallelo sui file non toccati.

Conflitti attesi: 1, 2 e 4 toccano `lib/navigation.ts`, `lib/i18n/it.ts`, `lib/data/mappers.ts`: far unire le PR una alla volta.
