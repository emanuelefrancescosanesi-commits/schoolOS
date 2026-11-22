# Audit sicurezza e privacy · 22 novembre 2026

Ambito: repo `schoolOS` a `9c68587` (dopo PR #23). Utenti: studenti, molti minorenni. Metodo: lettura di migrazioni, server action, route, proxy, estensione; test DB su Postgres locale; build di produzione con controllo degli header e dell'OCR sotto CSP; `npm audit` (0 vulnerabilità).

## Esito in breve

- **Base solida:** RLS su ogni tabella, FK composte `(id, user_id)`, GRANT espliciti per colonna, codici estensione hashati, RPC `security definer` con `search_path` vuoto e EXECUTE revocato, nessuna chiave segreta nel repo, validazione server-side (Zod), `getClaims()` al posto di `getSession()`, redirect `next` protetto, export e cancellazione account GDPR già presenti.
- **Buchi trovati e chiusi in questa PR:** vedi sotto.
- **Bloccanti per il lancio che il codice non può risolvere:** titolare del trattamento e informativa definitiva, consenso dei minori di 14 anni, impostazioni Auth su Supabase, migrazioni da applicare. Vedi «Cosa serve da Emanuele».

## Corretto in questa PR

| # | Problema | Gravità | Correzione |
|---|---|---|---|
| 1 | **Nessun header di sicurezza** (clickjacking, sniffing, referrer, nessuna CSP) | Alta | `next.config.ts`: CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri`, `form-action`, `connect-src` solo noi + Supabase), HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP. Verificato in browser: pagine e OCR (Tesseract/wasm) funzionano senza violazioni. |
| 2 | **Link nelle email costruiti dall'header Host** quando manca `NEXT_PUBLIC_SITE_URL` → *password-reset poisoning* | Alta | `lib/auth/origin.ts` + test: in produzione l'header Host non è più usato (si usa `NEXT_PUBLIC_SITE_URL`, poi i domini `VERCEL_*`, poi errore). `NEXT_PUBLIC_SITE_URL` aggiunto a `vercel.json`. |
| 3 | **Nessuna informativa privacy** (la checkbox rimandava a un testo inesistente) | Alta (GDPR) | Pagina pubblica `/privacy` con ciò che l'app fa davvero (dati, fornitori, conservazione, diritti, minori) e link dalla checkbox. **Provvisoria**: manca il titolare. |
| 4 | Consenso senza età | Alta (minori) | La checkbox ora dichiara «ho almeno 14 anni o un genitore è d'accordo» (art. 2-quinquies Codice privacy). È una dichiarazione, non una verifica: vedi rischi residui. |
| 5 | Codici estensione **validi per sempre** (anche dimenticati su un PC di scuola) | Media | Migrazione: scadono dopo 90 giorni senza uso; l'uso rinnova. Stesso errore per sbagliato/scaduto. |
| 6 | **Nessun tetto di righe per utente**: un account poteva riempire il DB | Media | Trigger `enforce_row_cap`: 10.000 voti, 5.000 compiti, 100 materie, 20 anni, 60 periodi. `dashboard_layout` max 20 KB. |
| 7 | Funzioni-trigger `security definer` eseguibili da `anon` via API | Bassa (hygiene) | `revoke execute` su `handle_new_user`, `set_updated_at`, `enforce_grade_scale`. |
| 8 | Log dell'errore AI con `error.message` (può citare il contenuto inviato) | Bassa | Si logga solo lo status. Nel resto del codice nessun log contiene email, voti o testo. |

Test: `lib/auth/origin.test.ts`, `tests/db/security-hardening.test.ts` (scadenza codici, tetti, funzioni non richiamabili, isolamento tra studenti). Suite completa, lint, typecheck e build verdi.

## Rischi residui (in ordine di priorità)

1. **Verifica dell'età e consenso dei genitori.** Per i minori di 14 anni serve il consenso del genitore; la checkbox non lo prova. Per un servizio proposto dalla scuola la via pulita è che sia **la scuola** a essere titolare e a raccogliere i consensi (vedi sotto). Da decidere con il preside/DPO prima di aprire a tutti.
2. **CSP con `'unsafe-inline'` sugli script.** Serve allo script del tema e a quelli di Next; un nonce per richiesta renderebbe dinamiche tutte le pagine (incompatibile con `cacheComponents`). Quindi la CSP limita molto (frame, plugin, form, connessioni) ma **non ferma un XSS inline**. Mitigazione: React esegue l'escape, l'unico `dangerouslySetInnerHTML` è una costante. Da rivedere con hash SHA-256 dello script del tema.
3. **Cookie di sessione Supabase non httpOnly** (`@supabase/ssr` li lascia leggibili dal client per design). Combinato con il punto 2, un XSS potrebbe rubare la sessione. Nessun XSS noto.
4. **Nessun rate limit applicativo.** I login/registrazioni sono limitati da Supabase Auth (da configurare, vedi sotto). Le server action di import (parser, solo CPU) e `sync_grades` (RPC pubblica con codice a 256 bit: indovinarlo è impossibile, ma si può inviare spazzatura) non hanno limiti propri. La quota AI (15/giorno) è invece applicata dal DB.
5. **Fornitori e trasferimenti.** Supabase (Francoforte) e Vercel (fra1) vanno bene; **Anthropic** riceve testo/screenshot solo con piano Pro e `ANTHROPIC_API_KEY`: serve DPA, clausole contrattuali standard e preferibilmente zero data retention. Uno screenshot può contenere nomi di docenti e compagni. L'AI è spenta di default: tenerla così finché i punti sopra non sono chiusi.
6. **Backup.** I dati cancellati restano nei backup di Supabase per il periodo di retention: da dichiarare nell'informativa.
7. **Modalità demo «fail-open».** Se in produzione mancassero le variabili Supabase, il proxy non richiederebbe login (mostra la demo, senza dati reali). Impatto basso; resta d'obbligo non togliere le variabili da `vercel.json`.
8. **Token estensione in chiaro in `chrome.storage.local`** (standard per le estensioni). Con il browser sbloccato chi ha accesso al profilo può *inviare* voti, non leggerne; si revoca da SchoolOS. Mitigato dalla scadenza a 90 giorni.
9. **Gmail (futuro):** se si leggerà la posta degli studenti servono verifica Google e audit di sicurezza CASA (a pagamento, settimane). Non toccare finché non è deciso.
10. **Enumerazione email in registrazione** (`user_already_exists`): sparisce con «Confirm email» attiva (Supabase risponde in modo uniforme).

## Cosa serve da Emanuele (e perché)

**Subito (5 minuti, sblocca le correzioni):**

1. **Applicare le migrazioni sul progetto Supabase** (SQL Editor → incolla ed esegui, nell'ordine):
   - `20261122100000_delete_my_account.sql`: senza, «Elimina account» in Impostazioni dà errore. È un obbligo GDPR.
   - `20261122120000_security_hardening.sql`: scadenza codici, tetti, funzioni chiuse. Il codice dell'app funziona anche senza, ma resta il buco.
   - Verifica che `20261120120000_sync_my_grades.sql` risulti applicata (serve solo all'app nativa, ora in pausa).
2. **Cancellare i 9 utenti `schoolos-e2e-…`** (Authentication → Users): il client non può e sono account reali con password note ai test.
3. **Dopo il deploy**, controllare in Vercel → Settings → Environment Variables che non ci siano `NEXT_PUBLIC_SITE_URL` diverse da `https://school-os-brown.vercel.app` (con un dominio proprio andrà aggiornata).

**Prima di far entrare altri studenti (Supabase → Authentication):**

4. **SMTP dedicato (es. Resend) e poi «Confirm email» ON.** Perché: con l'SMTP di default Supabase invia solo ai membri del team, e senza conferma chiunque può registrare email altrui.
5. **Site URL e Redirect URLs** = l'indirizzo del sito: senza, i link nelle email e il login Google falliscono o accettano destinazioni arbitrarie.
6. **Password**: lunghezza minima 10 e «Prevent use of leaked passwords» (richiede piano Pro, ~25 $/mese, che ti serve comunque per i backup).
7. **CAPTCHA (Cloudflare Turnstile, gratuito)** su registrazione e recupero password, e rivedere i rate limit di Auth: ferma i bot che riempiono il DB e fanno spam di email.
8. **Piano Pro Supabase**: backup giornalieri/PITR. Oggi, se perdi il DB, non c'è recupero.

**Decisioni tue/del preside (non risolvibili con il codice):**

9. **Chi è il titolare del trattamento**: tu come persona, o la scuola? Se vai dal preside, la scuola dovrebbe essere titolare e tu **responsabile** (art. 28 GDPR, con contratto). Serve per completare `/privacy`, e per il consenso dei minori di 14 anni (lo raccoglie la scuola).
10. **Contatto privacy** (email) da scrivere nell'informativa.
11. **Anthropic**: prima di attivare l'AI, accettare il DPA nella console e valutare zero data retention. Finché non lo fai, non impostare `ANTHROPIC_API_KEY` su Vercel (senza chiave la lettura AI resta spenta).
12. **Segnalare alla scuola** che si tratta dati di minori: per un uso su scala di istituto potrebbe servire una valutazione d'impatto (DPIA). Non è un blocco, ma il preside/DPO lo chiederà.

## Scelte annotate

- CSP con `unsafe-inline` sugli script: compromesso consapevole (vedi rischio 2), scelto per non rendere dinamico tutto il sito.
- `upgrade-insecure-requests` solo in produzione: con `next start` su IP locale via http (prova da telefono) gli asset non si caricherebbero; usare `next dev` o https.
- `NEXT_PUBLIC_SITE_URL` fissato in `vercel.json`: il link delle email di una preview punta alla produzione. Accettabile, più sicuro che fidarsi dell'header.
- Scadenza codici per **inattività** (90 giorni) invece che fissa: la sincronizzazione automatica non obbliga a ricollegare l'estensione finché la usi.
- Non toccati: Compiti, Impostazioni, assistente AI (altri thread). Il link a `/privacy` è l'unica modifica a `lib/i18n/it.ts` e `auth-forms.tsx`.
