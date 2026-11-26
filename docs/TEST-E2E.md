# Test end-to-end (Playwright)

Provano l'app come la usa uno studente: si apre il browser, si clicca, si controlla cosa compare.
Girano in **modalità demo**: nessuna variabile Supabase, nessun backend, dati di `lib/demo`.
Le modifiche in demo vivono solo nel browser, quindi ogni test parte pulito.

## Come lanciarli

```bash
npm ci
npx playwright install chromium          # una volta sola (anche firefox / webkit se li vuoi)
npm run test:e2e                         # tutto: parte da solo un dev server sulla porta 3100
npx playwright test e2e/grades.spec.ts   # un solo file
npx playwright test --project=chromium-mobile-390   # una sola viewport
npm run test:e2e:ui                      # interfaccia con replay passo-passo
npx playwright show-report               # report HTML dell'ultima esecuzione
```

Se hai già un server su `localhost:3100` (`E2E_PORT` per cambiare porta) viene riusato.
In CI il server è la **build di produzione** (`next build` + `next start`).

## Cosa coprono (`e2e/`)

| File | Flussi |
|---|---|
| `onboarding.spec.ts` | tutti i 7 passi, validazione del nome, Indietro, fine in demo |
| `auth.spec.ts` | login, registrazione (consenso età/privacy), password dimenticata, /privacy, /termini |
| `grades.spec.ts` | aggiungere voto (media e conteggio), anteprima «7½», voto non valido, modifica, elimina e annulla, filtri |
| `todo.spec.ts` | aggiunta rapida in linguaggio naturale, spunta, dettaglio e sotto-attività, ricerca, viste |
| `tasks-calendar.spec.ts` | Compiti (aggiungi, completa e annulla, elimina) e Calendario (mese, oggi, aggiungi/elimina impegno) |
| `settings-notifications.spec.ts` | Impostazioni (profilo in demo, cambio password/email, tema), Notifiche, Inbox, Analisi |

Ogni pagina viene anche controllata contro lo **scroll orizzontale** (il bug classico su telefono),
gli errori JS e le risposte 5xx.

## Browser e viewport

`chromium-mobile-390`, `chromium-tablet-768`, `chromium-desktop-1280`, `firefox-desktop-1280`,
`webkit-iphone-390` (WebKit = motore di Safari).

## In CI

`.github/workflows/e2e.yml`, job **separato** da `CI`: se è lento non blocca la build.
Chromium è il riferimento; Firefox e WebKit hanno `continue-on-error` (segnalano, non bloccano).
Se un test fallisce, il report e le tracce sono negli artifact del job.

## Cosa NON coprono (di proposito)

Registrazione vera, conferma email, login Google, cambio password reale, RLS: servono Supabase
e una casella email. Sono in `scripts/e2e-supabase.mjs` (backend reale) e nei test di schema/RLS
con Postgres (`npm test`). In demo i form di Impostazioni dicono solo «non salviamo nulla».

## Scrivere un nuovo test

- Usa ruoli e testi come li vede l'utente (`getByRole`, `getByLabel`), non classi CSS.
- Evita date fisse: il demo è calcolato rispetto a oggi. Confronta prima/dopo (es. la media sale).
- Chiudi il test con `expectNoHorizontalScroll(page)` sulle pagine nuove.
