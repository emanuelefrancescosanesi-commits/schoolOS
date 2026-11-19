# SchoolOS

App per organizzare la scuola: voti, compiti, calendario, email e registro in un solo posto.
Pensata per gli studenti italiani: scala di voti, periodi e registro si configurano per ogni utente.

Piano tecnico: `docs/PIANO-TECNICO-FASE-1.md` (nella cartella del progetto).

## Stato

- **Fase 2 (fatta):** design system, app shell e Dashboard.
- **Fase 3a (questa):** schema Supabase con RLS, login (email/password e Google), onboarding in 7 passi, pagina Voti.
- **Prossimo:** import dei voti da testo/screenshot del registro e dalle email di notifica, poi integrazioni Gmail e Calendar.

Senza Supabase configurato l'app parte in **modalità demo**. Per attivare i dati reali: [docs/SETUP-SUPABASE.md](docs/SETUP-SUPABASE.md).

## Avvio

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # test (Vitest); con TEST_DATABASE_URL anche schema e RLS su Postgres
npm run typecheck
npm run lint
npm run build
```

Richiede Node.js ≥ 20.9.

## Struttura

| Percorso | Contenuto |
|---|---|
| `app/(app)/` | Route dell'app autenticata (Dashboard, Voti, pagine "In arrivo") |
| `app/(auth)/`, `app/auth/` | Accesso, registrazione, recupero password, callback OAuth ed email |
| `app/onboarding/` | Configurazione guidata al primo accesso |
| `proxy.ts` | Rinnovo della sessione e redirect al login |
| `supabase/migrations/` | Schema, vincoli e policy RLS |
| `tests/db/` | Test dello schema su Postgres reale |
| `app/globals.css` | Design token dark/light: unica fonte dei colori |
| `components/ui/` | Componenti base in stile shadcn/ui (Button, Card, Badge, Tooltip, Sheet…) |
| `components/shell/` | Sidebar comprimibile, barra inferiore mobile, tema |
| `components/dashboard/` | Widget della Dashboard e griglia personalizzabile |
| `lib/domain/` | Logica pura e testata: voti, medie, obiettivi, priorità, periodi, date |
| `lib/dashboard/` | View model della Dashboard e disposizione dei widget |
| `lib/demo/` | Dataset di esempio, sempre segnalato dal banner demo |
| `lib/data/` | Accesso ai dati: sessione, profilo, dati scolastici (Supabase o demo) |
| `lib/supabase/` | Client Supabase (server e proxy) e tipi del database |
| `lib/validation/` | Schemi Zod condivisi tra client e server |
| `lib/i18n/` | Testi dell'interfaccia (italiano), pronti per altre lingue |

## Scelte da sapere

- **Colori accessibili:** i test in `lib/design/contrast.test.ts` leggono `globals.css` e falliscono se una coppia testo/sfondo scende sotto WCAG AA. Alcuni colori del piano sono stati corretti per questo.
- **Calcoli deterministici:** medie, voto necessario per la sufficienza e priorità dei compiti sono funzioni pure con test, mai risposte dell'AI.
- **Date di calendario come stringhe `YYYY-MM-DD`** nel fuso dello studente, per evitare slittamenti di un giorno tra server UTC e Italia.
- **Niente flash al caricamento:** tema e stato della sidebar sono applicati da uno script inline prima del primo paint; la disposizione dei widget è letta dal cookie lato server.
- **Sicurezza dei dati:** ogni tabella ha RLS (`user_id = auth.uid()`) e chiavi esterne composte `(id, user_id)`, così uno studente non può agganciare dati suoi a righe di un altro. La scala dei voti del profilo è imposta anche dal database.
- **Onboarding atomico:** profilo, anno, periodi e materie si salvano in un'unica funzione SQL: o tutto o niente.
- **shadcn/ui:** `components.json` è configurato; i componenti in `components/ui/` sono scritti a mano nello stesso stile perché il registro non era raggiungibile dall'ambiente di sviluppo. `npx shadcn add <componente>` funziona normalmente in locale.
