# Rischi aperti e cosa serve dal preside

Elenco onesto, in ordine di impatto sul lancio. «Verificato» = controllato sul codice o nei documenti del repo; «non verificato» = non so.

## Rischi aperti

### 1. Accordo con il fornitore del registro (Axios) — **bloccante per la scala**
- Oggi non esiste un accordo né un'API ufficiale (verificato in `docs/APP-REGISTRO-FATTIBILITA.md`).
- Le licenze Axios con le scuole vietano accessi di terzi non autorizzati «se non tramite le procedure previste». Se una lettura dal telefono dello studente rientri nel divieto **non è chiaro**.
- Senza accordo, il registro può bloccarci in qualsiasi momento (anti-bot, cambio di markup). L'import manuale resta sempre disponibile.
- Sulla scala di istituto la scuola, cliente di Axios, ha più peso di uno studente. Serve **una richiesta formale della scuola**.
- Il pilota non dipende da questo: usa import manuale e, su PC, l'estensione (letture avviate dall'utente).

### 2. Titolare del trattamento e informativa — **bloccante per il pilota**
- `/privacy` è provvisoria, manca il titolare (verificato).
- Se Emanuele è minorenne non può essere responsabile art. 28 né firmare contratti. Serve un adulto o un'entità (vedi `02-privacy-gdpr-minori.md`).

### 3. Consenso dei minori di 14 anni
- Non verificato: la checkbox è solo una dichiarazione.

### 4. Verifica Google / Gmail — **non bloccante, ma fermo**
- Il login Google non è ancora configurato. Per leggere Gmail serve verifica OAuth e audit di sicurezza (CASA), a pagamento e di settimane. Non è nel pilota.

### 5. Posta e dominio
- Oggi la conferma email è spenta per i test. Prima del pilota: SMTP dedicato (es. Resend), che richiede un **dominio proprio**. Senza conferma chiunque può registrare email altrui. L'URL attuale è un sottodominio Vercel.

### 6. Pagamenti
- Esiste solo la colonna `profiles.plan` (free/pro); **non c'è un sistema di pagamento** né prezzi. Non vendere Pro finché non c'è (es. Stripe, partita IVA, fatturazione, regole sui minori).

### 7. Costi e scala
- Supabase Pro ~25 $/mese serve per backup e password sicure (leaked-password check). Oggi: nessun backup recuperabile.
- L'AI a consumo non può essere offerta a tutti: resta spenta o solo Pro.
- Rate limit applicativo assente (vedi audit): una scuola intera lo rende rilevante.

### 8. Sicurezza residua
- CSP con `unsafe-inline` sugli script, cookie di sessione leggibili dal client, token estensione in chiaro nel browser (tutto in `docs/AUDIT-SICUREZZA.md`). Non c'è un XSS noto, ma non c'è stato un audit di terzi.

### 9. Stato operativo da confermare
- Migrazioni da applicare a mano su Supabase: `delete_my_account`, `match_materie`, `timetable`, `security_hardening`, `todo` (stato al 22/11, da riconfermare). Senza `delete_my_account` il diritto alla cancellazione non funziona.
- Da cancellare 9 utenti di test `schoolos-e2e-…`.
- Le funzioni lato server di Orario e «Da fare» non sono state provate sul Supabase reale (PR #24 e #29).

### 10. App sul telefono
- È un sito/PWA. Nessuna app negli store (decisione 22/11). Niente notifiche push, niente sincronizzazione automatica da telefono. Gli studenti già usano l'app di Axios: **il valore deve essere più alto dell'attrito di importare i voti**, ed è l'ipotesi da validare nel pilota.

### 11. Modello e adozione
- Rischio concreto: gli studenti non aggiornano i voti a mano. Se il pilota mostra retention bassa, l'adozione scolastica è improbabile senza sincronizzazione ufficiale.

## Cosa serve dal preside

**Per il pilota**
1. Via libera a un pilota su 5-10 studenti, con un referente.
2. Il nome del **DPO** della scuola per un parere breve sui ruoli.
3. Indicazione se la scuola vuole essere titolare (e in tal caso firmare un accordo) o se il pilota resta tra studenti.
4. Moduli di consenso dei genitori <14 (se presenti studenti sotto i 14 anni).

**Dopo il pilota, per la scala**
5. Richiesta formale della scuola al fornitore del registro per collegamento ufficiale in sola lettura.
6. DPIA con il DPO; contratto art. 28.
7. Comunicazione agli studenti e alle famiglie da parte della scuola.

## Cosa serve da Emanuele (non dal preside)
- Decidere il **titolare/responsabile** e se serve un adulto o un'entità (vedi sopra).
- Dominio, SMTP, conferma email, Supabase Pro, Google login (guida `docs/SETUP-GOOGLE-SMTP.md`).
- Applicare le migrazioni e cancellare gli utenti di test.
- Contatto privacy e completamento di `/privacy`.
