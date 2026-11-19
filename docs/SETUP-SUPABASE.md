# Attivare Supabase, login e Google

Senza questa configurazione SchoolOS gira in **modalità demo**: dati di esempio, nessun login, niente viene salvato.
Servono circa 20 minuti. Tutti i servizi usati hanno un piano gratuito sufficiente per iniziare.

## 1. Progetto Supabase

1. Crea un account su [supabase.com](https://supabase.com) e un nuovo progetto.
   - **Regione:** scegli `eu-central-1` (Francoforte) o un'altra regione UE: i dati degli studenti restano in Europa (GDPR).
   - Salva la password del database in un gestore di password.
2. Applica le migrazioni (schema, sicurezza RLS, funzione di onboarding). Due modi:
   - **Con la CLI (consigliato):**
     ```bash
     npx supabase login
     npx supabase link --project-ref <id-progetto>
     npx supabase db push
     ```
   - **Senza CLI:** in Supabase apri *SQL Editor* e incolla, in ordine, i file di `supabase/migrations/`.
3. In *Project Settings → API* copia **Project URL** e **Publishable key**.

## 2. Variabili d'ambiente

```bash
cp .env.example .env.local
```

Compila `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_SITE_URL`
(`http://localhost:3000` in locale, il dominio vero in produzione). Riavvia `npm run dev`.

> La publishable key è pensata per stare nel browser: la sicurezza viene dalla RLS. La **secret key**
> (service role) non va mai messa in variabili `NEXT_PUBLIC_` né nel repository.

## 3. Autenticazione

In *Authentication → URL Configuration*:

- **Site URL:** lo stesso valore di `NEXT_PUBLIC_SITE_URL`.
- **Redirect URLs:** aggiungi `http://localhost:3000/**` e `https://<tuo-dominio>/**`.

In *Authentication → Providers → Email* lascia attiva la conferma email.

### Email in italiano (consigliato)

In *Authentication → Email Templates* sostituisci il link dei template **Confirm signup** e **Reset password** con:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding">Conferma l'account</a>
```

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password">Scegli una nuova password</a>
```

Funzionano anche i template predefiniti: `/auth/confirm` gestisce entrambi i formati.

Per il lancio pubblico configura un SMTP tuo (*Project Settings → Auth → SMTP*): quello incluso in Supabase
ha limiti bassi di invio ed è pensato solo per i test.

## 4. Accesso con Google

1. In [Google Cloud Console](https://console.cloud.google.com) crea un progetto.
2. *APIs & Services → OAuth consent screen*: tipo **External**, nome "SchoolOS", email di supporto.
   Per ora bastano gli scope `openid`, `email`, `profile`.
3. *Credentials → Create credentials → OAuth client ID*, tipo **Web application**.
   - **Authorized redirect URI:** `https://<id-progetto>.supabase.co/auth/v1/callback`
4. Copia Client ID e Client secret in Supabase: *Authentication → Providers → Google*.

Gli scope di Gmail e Calendar arriveranno con le integrazioni: richiedono la verifica di Google e li aggiungiamo solo allora.

## 5. Verifica

1. `npm run dev`, apri `http://localhost:3000`: devi finire sulla pagina di accesso, senza banner demo.
2. Crea un account, conferma l'email, completa l'onboarding.
3. Aggiungi un voto in *Voti* e controlla che compaia nella Dashboard.

## Test dello schema in locale

I test in `tests/db/` applicano le migrazioni a un Postgres vero e verificano RLS e vincoli
(per esempio che uno studente non possa leggere i voti di un altro).

```bash
# con un Postgres locale (o: docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16)
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm test
```

Senza `TEST_DATABASE_URL` questi test vengono saltati; in CI girano sempre.
