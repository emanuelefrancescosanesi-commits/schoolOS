# Accesso con Google ed email vere (Google Cloud + Supabase + Resend)

Guida per chi non è tecnico. Il codice è già pronto: il pulsante **Continua con Google** è su Accedi e Crea account,
il ritorno da Google e il rimando dell'email di conferma funzionano. Mancano solo le **configurazioni sui siti esterni**,
che sono queste (circa 30–40 minuti in tutto).

Indirizzi usati qui (cambiali se cambiano):

| Cosa | Valore |
|---|---|
| Sito | `https://school-os-brown.vercel.app` |
| Progetto Supabase | `oduqbzifwhrunwunuvkl` |
| Indirizzo di ritorno di Google (lo mette Supabase) | `https://oduqbzifwhrunwunuvkl.supabase.co/auth/v1/callback` |

> I nomi dei menu cambiano ogni tanto: se un pulsante non c'è, cerca la parola in grassetto con la barra di ricerca del sito.

---

## Parte A. Accesso con Google

### A1. Google Cloud: crea il progetto
1. Vai su <https://console.cloud.google.com> con il tuo account Google.
2. In alto, clicca il selettore di progetto → **Nuovo progetto** → nome `SchoolOS` → **Crea**. Poi selezionalo.

### A2. Schermata di consenso
1. Menu ☰ → **API e servizi** → **Schermata consenso OAuth** (nella versione nuova: **Google Auth Platform**). Clicca **Inizia**.
2. **Nome app:** `SchoolOS`. **Email assistenza utenti:** la tua. Avanti.
3. **Pubblico:** scegli **Esterno**. Avanti.
4. **Dati di contatto:** la tua email. Accetta le norme → **Crea**.
5. **Accesso ai dati** (Scopes): aggiungi solo `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`. Non aggiungere altro: con questi tre **non serve la verifica di Google**.
6. **Pubblico → Pubblica app** (da «Test» a «In produzione»). Se resta in «Test», possono entrare solo gli utenti di prova che aggiungi a mano.

### A3. Crea le credenziali
1. **Client** (o *Credenziali*) → **Crea client** (*Crea credenziali → ID client OAuth*).
2. Tipo di applicazione: **Applicazione web**. Nome: `SchoolOS web`.
3. **URI di reindirizzamento autorizzati** → **Aggiungi URI** e incolla esattamente:
   `https://oduqbzifwhrunwunuvkl.supabase.co/auth/v1/callback`
4. **Crea**. Copia **ID client** e **Segreto client** (il segreto non va mai in chat né nel repository).

### A4. Supabase: attiva Google
1. <https://supabase.com/dashboard> → progetto SchoolOS → **Authentication** → **Sign In / Providers** (o *Providers*) → **Google**.
2. Attiva **Enable Sign in with Google**, incolla **Client ID** e **Client Secret** → **Save**.

### A5. Supabase: indirizzi consentiti (importante)
**Authentication → URL Configuration**:
- **Site URL:** `https://school-os-brown.vercel.app`
- **Redirect URLs** (aggiungi tutte e tre):
  - `https://school-os-brown.vercel.app/**`
  - `http://localhost:3000/**`
  - (facoltativo, per le anteprime di Vercel) `https://*-<tuo-nome-vercel>.vercel.app/**`

Senza questo passaggio Google funziona ma poi Supabase rimanda l'utente alla pagina sbagliata.

### A6. Prova
1. Apri il sito in una finestra anonima → **Continua con Google** → scegli l'account.
2. Un account nuovo deve finire nell'**onboarding**, uno già configurato nella **Dashboard**.
3. Il nome si compila da solo con quello di Google.

Se esiste già un account email+password con la stessa email di Google, Supabase li **collega** in automatico (Google conferma l'email).

**Se non va:**
- «Accesso con Google non è ancora attivo» → A4 non fatto o salvato male.
- `redirect_uri_mismatch` su Google → l'URI nel punto A3 non è identico (controlla `https`, nessuno spazio, nessuno `/` finale).
- Torni al login con «non riuscito» → controlla A5 (Site URL e Redirect URLs).

---

## Parte B. Email dedicata (Resend) e conferma email

**Perché serve:** l'invio incluso in Supabase manda email solo ai membri del tuo team ed è limitato a pochissime all'ora. Per studenti veri serve un invio tuo.
Finché la conferma email resta spenta, **chiunque può registrarsi con un'email falsa o altrui**: va riaccesa prima del lancio.

**Serve un dominio tuo** (es. `schoolos.it`, ~10 €/anno da Aruba, Register, Cloudflare ecc.). Senza dominio Resend invia solo al tuo indirizzo di prova: non basta.

### B1. Resend
1. <https://resend.com> → registrati.
2. **Domains → Add Domain** → scrivi il dominio (meglio un sottodominio, es. `mail.schoolos.it`) → regione **Europe (Ireland)** → **Add**.
3. Resend mostra alcuni record DNS (SPF, DKIM, MX). Aprili nel sito dove hai comprato il dominio, sezione **DNS**, e copiali uno per uno. Poi **Verify** in Resend (può metterci da 5 minuti a qualche ora).
4. **API Keys → Create API Key** → permesso **Sending access** → copia la chiave (inizia con `re_`). Si vede una volta sola.

### B2. Supabase: collega Resend
**Authentication → Emails → SMTP Settings** (oppure *Project Settings → Authentication → SMTP*) → attiva **Enable custom SMTP**:

| Campo | Valore |
|---|---|
| Sender email | `no-reply@mail.schoolos.it` (sul dominio verificato) |
| Sender name | `SchoolOS` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la chiave `re_...` |

**Save**. Poi **Authentication → Rate Limits**: alza «Emails sent per hour» (es. 100 per iniziare).

### B3. Template email in italiano (consigliato)
**Authentication → Emails → Templates**, per **Confirm signup** e **Reset password**, sostituisci il link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding">Conferma l'account</a>
```

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Scegli una nuova password</a>
```

Il link passa direttamente dal sito e non si rompe con gli scanner antispam che «aprono» i link prima dell'utente.

### B4. Riaccendi la conferma email
**Authentication → Sign In / Providers → Email** → attiva **Confirm email** → **Save**.

### B5. Prova
1. Crea un account con una tua seconda email → deve arrivare l'email (controlla anche lo **spam**).
2. Clicca il link → finisci nell'onboarding.
3. Prova ad accedere con un account non confermato: compare «Conferma prima l'email» col pulsante **Rimanda l'email di conferma**.
4. «Password dimenticata?» deve mandare l'email di recupero.

**Se non arriva:** Resend → **Logs** mostra se è partita; stato «Domain not verified» = DNS non ancora propagato; in Supabase → **Logs → Auth** vedi l'errore SMTP.

---

## Variabile su Vercel
Su Vercel → Settings → Environment Variables imposta `NEXT_PUBLIC_SITE_URL=https://school-os-brown.vercel.app` (poi **Redeploy**). Serve perché i link nelle email e il ritorno da Google puntino sempre al dominio vero. Con un dominio personalizzato, cambia qui, nel Site URL di Supabase e nelle Redirect URLs.

## Prima del lancio pubblico
- Account Google con **Gmail/Calendar**: richiedono la **verifica di Google** (scope sensibili/ristretti, audit di sicurezza per Gmail). Non toccare gli scope ora.
- Account di studenti **minorenni**: informativa privacy e consenso già nel modulo di registrazione; da rivedere con la scuola.
- Cancellare a mano gli utenti di test `schoolos-e2e-…` da *Authentication → Users*.
