# Nota privacy / GDPR per minori

Stato verificato sul codice a `main` (22/11/2026). **Non è un parere legale**: va rivista da un DPO o un avvocato prima del lancio. Dove un punto non è verificabile dal codice lo dico.

## 1. Cosa il codice fa davvero
| Tema | Fatto verificato |
|---|---|
| Dati trattati | Account (email, nome, hash password); profilo; anni, periodi, materie; voti; compiti; orario; liste «Da fare»; codice estensione (solo hash). Scuola e classe facoltative. |
| Dati NON trattati | Password del registro, credenziali di terzi, geolocalizzazione, pubblicità/tracciamento. Nessun dato di altri studenti. |
| Separazione | RLS su ogni tabella (`user_id = auth.uid()`), chiavi esterne composte `(id, user_id)`. Nessun ruolo docente/dirigente. |
| Sicurezza | Header e CSP, codici estensione hashati e scadenza a 90 giorni di inattività, tetti di righe, test su Postgres reale (`docs/AUDIT-SICUREZZA.md`). |
| Diritti | Esportazione JSON (art. 20) e cancellazione a cascata (`delete_my_account`, art. 17) in Impostazioni. |
| AI | Spenta di default. Con piano Pro e chiave attiva, testo/screenshot dei voti va ad Anthropic. L'assistente (Haiku) non riceve voti. |
| Informativa | Pagina `/privacy` **provvisoria**: manca il titolare. |

## 2. Ruoli: chi è titolare?
È la decisione che cambia tutto.
- **Pilota tra compagni, uso individuale:** ciascuno usa l'app per sé; titolare è chi gestisce il servizio. Va bene solo su scala minima e con informativa e consenso in regola.
- **Proposta della scuola a tutti gli studenti:** la scuola sarebbe titolare e SchoolOS responsabile (art. 28) con contratto. Una scuola pubblica tratta dati per compiti istituzionali; promuovere un'app esterna non è ovvio che lo sia. **Domanda da girare al DPO della scuola**, non da assumere.
- **Attenzione, punto che nessuno dice:** per firmare un contratto art. 28 serve capacità di agire. Se Emanuele è minorenne, non può essere responsabile. Serve un adulto o una persona giuridica (es. genitore/tutore con partita IVA, associazione, srl). [Da confermare con Emanuele.]

## 3. Basi giuridiche (proposta, da validare)
- **Contratto (art. 6.1.b)**: erogare il servizio a chi crea l'account. È quanto scrive oggi `/privacy`. Per un minore la validità del contratto è dubbia: perciò sotto i 14 anni conviene il consenso.
- **Consenso (art. 6.1.a + art. 8, art. 2-quinquies Codice privacy)**: in Italia il minore da **14 anni** consente da solo; sotto i 14 serve il genitore.
- Nessuna categoria particolare (art. 9): i voti non lo sono, ma il Garante tratta i dati scolastici dei minori con cautela. Non usarli mai per profilazione.

## 4. Consenso dei genitori sotto i 14 anni
Oggi **non verificato**: la checkbox dice «ho almeno 14 anni o un genitore è d'accordo». È una dichiarazione, non una prova.
- **Per il pilota:** scheda cartacea o PDF firmata dal genitore, raccolta dal referente, per ogni studente <14. Probabilmente non servirà in un liceo (quasi tutti ≥14), ma va verificato la data di nascita nel gruppo.
- **Per la scala di istituto:** consenso raccolto dalla scuola (modulo/Registro) e comunicato; oppure account creati su invito. Da progettare con il DPO.

## 5. Informativa (artt. 13-14)
Serve prima di aprire a chiunque:
1. Titolare e contatto privacy (oggi mancano).
2. Responsabili: Supabase, Vercel; Anthropic solo con Pro/AI.
3. Tempi di conservazione: fino a cancellazione; **backup** conservano i dati cancellati per il periodo di retention Supabase (da dichiarare).
4. Trasferimenti extra-UE: Supabase e Vercel sono società USA con regione UE; indicare DPA e clausole contrattuali standard. Anthropic: DPA/CCS, valutare zero data retention.
5. Linguaggio comprensibile a un quattordicenne (art. 12).

## 6. Diritti degli interessati
Già in app: accesso/portabilità (JSON), cancellazione. Mancano: rettifica da interfaccia dei dati dell'account (email), canale per opposizione/limitazione (basta un'email di contatto), procedura per le richieste dei genitori.

## 7. DPIA (art. 35)
- **Pilota 5-10 studenti, uso volontario:** probabilmente non obbligatoria; farne comunque una versione leggera (1-2 pagine) è buona pratica.
- **Tutta la scuola:** minori + dati scolastici + nuova tecnologia: **da considerare molto probabile** una DPIA. Chiederlo al DPO prima.
- Cosa serve per farla: descrizione trattamenti (sezione 1), analisi di necessità e proporzionalità, rischi per i diritti (accesso non autorizzato, perdita, uso improprio), misure (RLS, cifratura, scadenza codici, cancellazione), parere del DPO.

## 8. Checklist prima del primo studente reale
- [ ] Titolare scelto e `/privacy` completata.
- [ ] DPA con Supabase e Vercel accettati.
- [ ] AI spenta (nessuna `ANTHROPIC_API_KEY`).
- [ ] Consensi dei genitori per gli <14.
- [ ] Conferma email attiva con SMTP dedicato.
- [ ] Backup: piano Pro Supabase.
- [ ] Contatto privacy attivo.
- [ ] Registro dei trattamenti (art. 30) di una pagina.
- [ ] Procedura per violazioni dei dati (notifica al Garante entro 72 ore, art. 33).
