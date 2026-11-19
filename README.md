# SchoolOS

App per organizzare la scuola: voti, compiti, calendario, email e registro in un solo posto.
Pensata per gli studenti italiani: scala di voti, periodi e registro si configurano per ogni utente.

Piano tecnico: `docs/PIANO-TECNICO-FASE-1.md` (nella cartella del progetto).

## Stato

**Fase 2 (in corso):** design system, app shell e Dashboard con dati demo. Nessun backend ancora:
autenticazione, Supabase e integrazioni arrivano nella Fase 3.

## Avvio

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # test della logica pura (Vitest)
npm run typecheck
npm run lint
npm run build
```

Richiede Node.js ≥ 20.9.

## Struttura

| Percorso | Contenuto |
|---|---|
| `app/(app)/` | Route dell'app autenticata (Dashboard, pagine "In arrivo") |
| `app/globals.css` | Design token dark/light: unica fonte dei colori |
| `components/ui/` | Componenti base in stile shadcn/ui (Button, Card, Badge, Tooltip, Sheet…) |
| `components/shell/` | Sidebar comprimibile, barra inferiore mobile, tema |
| `components/dashboard/` | Widget della Dashboard e griglia personalizzabile |
| `lib/domain/` | Logica pura e testata: voti, medie, obiettivi, priorità, periodi, date |
| `lib/dashboard/` | View model della Dashboard e disposizione dei widget |
| `lib/demo/` | Dataset di esempio, sempre segnalato dal banner demo |
| `lib/data/` | Accesso ai dati: oggi demo, dalla Fase 3 Supabase |
| `lib/i18n/` | Testi dell'interfaccia (italiano), pronti per altre lingue |

## Scelte da sapere

- **Colori accessibili:** i test in `lib/design/contrast.test.ts` leggono `globals.css` e falliscono se una coppia testo/sfondo scende sotto WCAG AA. Alcuni colori del piano sono stati corretti per questo.
- **Calcoli deterministici:** medie, voto necessario per la sufficienza e priorità dei compiti sono funzioni pure con test, mai risposte dell'AI.
- **Date di calendario come stringhe `YYYY-MM-DD`** nel fuso dello studente, per evitare slittamenti di un giorno tra server UTC e Italia.
- **Niente flash al caricamento:** tema e stato della sidebar sono applicati da uno script inline prima del primo paint; la disposizione dei widget è letta dal cookie lato server.
- **shadcn/ui:** `components.json` è configurato; i componenti in `components/ui/` sono scritti a mano nello stesso stile perché il registro non era raggiungibile dall'ambiente di sviluppo. `npx shadcn add <componente>` funziona normalmente in locale.
