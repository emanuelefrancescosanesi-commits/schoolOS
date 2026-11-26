# Collegare Google (Gmail e Calendar) a SchoolOS

Guida per chi non è tecnico. Il codice è pronto: mancano solo queste configurazioni su Google e su Vercel (circa 30 minuti).
Finché non le fai, in **Integrazioni** il riquadro «Google» dice «Non ancora attivo» e nulla si rompe.

Indirizzi usati qui (cambiali se cambiano):

| Cosa | Valore |
|---|---|
| Sito | `https://school-os-brown.vercel.app` |
| Indirizzo di ritorno da Google | `https://school-os-brown.vercel.app/api/google/callback` |

> I nomi dei menu di Google cambiano spesso: se un pulsante non c'è, cerca la parola in grassetto con la barra di ricerca in alto.

## Cosa devi sapere prima (onestà)
- Finché l'app non è **verificata da Google** funziona solo per gli **utenti di prova** che inserisci tu (massimo 100), mostra l'avviso «app non verificata» e Google fa **scadere il collegamento ogni 7 giorni** (poi si preme «Ricollega Google»).
- Per aprirla a tutta la scuola servono la verifica di Google e, per Gmail, una valutazione di sicurezza annuale a pagamento. È una decisione per dopo.
- Gli account della scuola (`@setificio.edu.it`) possono avere le app esterne **bloccate dall'amministratore**: in quel caso l'amministratore deve consentirlo, oppure si collega un account Gmail personale.
- L'app **legge soltanto**: non scrive, non invia, non cancella. Delle mail salva mittente, oggetto e anteprima dell'ultimo mese.

## 1. Google Cloud: progetto e API
1. Vai su <https://console.cloud.google.com> con il tuo account Google.
2. In alto scegli (o crea) il progetto `SchoolOS`.
3. Barra di ricerca → **Gmail API** → **Abilita**.
4. Barra di ricerca → **Google Calendar API** → **Abilita**.

## 2. Schermata di consenso
1. Cerca **Google Auth Platform** (o *Schermata consenso OAuth*) → **Accesso ai dati** (*Scopes*) → **Aggiungi o rimuovi ambiti**.
2. Aggiungi: `.../auth/gmail.readonly`, `.../auth/calendar.readonly`, `openid`, `.../auth/userinfo.email`. **Salva**.
3. **Pubblico** (*Audience*): lascia **In test** e in **Utenti di prova** → **Add users** aggiungi la tua email e quelle di chi vuoi far provare. Salva.

## 3. Credenziali
1. **Client** → **Crea client** → tipo **Applicazione web**, nome `SchoolOS collegamento`.
2. **URI di reindirizzamento autorizzati** → **Aggiungi URI** e incolla esattamente:
   `https://school-os-brown.vercel.app/api/google/callback`
3. **Crea**. Copia **ID client** e **Segreto client** (non incollarli mai in chat né nel repository).

## 4. Vercel: le tre variabili
Vercel → progetto `school-os` → **Settings** → **Environment Variables**, aggiungi (ambiente **Production**):

| Nome | Valore |
|---|---|
| `GOOGLE_CLIENT_ID` | l'ID client del punto 3 |
| `GOOGLE_CLIENT_SECRET` | il segreto client del punto 3 |
| `GOOGLE_TOKEN_KEY` | una frase lunga e casuale che inventi tu (almeno 24 caratteri, es. 6 parole a caso con numeri). Cifra il codice di accesso nel database: **non perderla e non cambiarla**, altrimenti tutti dovranno ricollegare Google. |

Poi **Deployments** → sui tre puntini dell'ultimo deploy → **Redeploy**.

## 5. Supabase: migrazioni
Nell'SQL Editor applica, in questo ordine, `20261126100000_calendar_feeds.sql` (se non l'hai già fatta) e `20261126110000_google_connection.sql`.

## 6. Prova
1. Apri l'app → **Integrazioni** → **Collega Google** → scegli l'account.
2. Se compare «Google non ha verificato questa app»: **Avanzate** → **Vai a SchoolOS (non sicuro)**. È normale in modalità test.
3. Lascia **spuntati** Gmail e Calendar → **Continua**.
4. Tornato in app: «Google collegato». Controlla **Inbox** (mail) e **Calendario** (eventi).

## Scollegare
Integrazioni → **Scollega Google**: l'app revoca il permesso presso Google e cancella il collegamento e tutto ciò che ne era arrivato. Puoi anche revocare da <https://myaccount.google.com/permissions>.
