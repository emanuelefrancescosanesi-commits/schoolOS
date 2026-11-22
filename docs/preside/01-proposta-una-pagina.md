# SchoolOS — proposta per la Dirigenza

> Versione per il dirigente scolastico. Sostituisce la bozza `docs/PROPOSTA-PRESIDE.md`. I campi [tra parentesi] si completano prima dell'invio. Non è un parere legale.

## Cosa è
SchoolOS è un'app web, installabile sul telefono, che dà a ogni studente **un posto solo** per i propri voti e medie, compiti e verifiche, calendario e orario. Calcola le medie, mostra l'andamento per materia e risponde a «che voto mi serve per la sufficienza?». Oggi lo studente fa questi conti a mente, tra registro, chat di classe e appunti.

## Cosa ottiene lo studente
- Medie e andamento sempre aggiornati, per periodo e per materia.
- Compiti e verifiche con scadenze, promemoria e calendario.
- Una lista «Da fare» personale, anche per lo studio.
- Funziona su telefono e su PC.

## Cosa NON fa
- **Non chiede e non conserva la password del registro elettronico.** Lo studente inserisce i voti a mano, incolla il testo o legge uno screenshot (la lettura avviene nel suo browser).
- Nessuna pubblicità, nessuna vendita di dati.
- **Nessun docente e nessun membro della dirigenza può vedere i dati di uno studente**: ogni utente vede solo i propri. Oggi non esiste alcuna vista per la scuola.
- Non si sostituisce al registro: non è un documento ufficiale.

## Quali dati e dove stanno
- Email, nome, materie, voti, compiti, orario; scuola e classe sono facoltativi.
- Database Supabase, server a **Francoforte (UE)**; applicazione su Vercel, funzioni a Francoforte.
- Connessioni cifrate; accesso ai dati separato per utente a livello di database.
- Ogni studente può **scaricare tutti i suoi dati o cancellare l'account** da Impostazioni.

## Costi
- **Per la scuola: zero** nel pilota.
- Per lo studente: la base è gratuita. Funzioni automatiche (lettura assistita dei voti, assistente) in abbonamento opzionale **Pro** [prezzo da definire]. Nel pilota il Pro non viene venduto.

## Cosa proponiamo
Un **pilota di 4 settimane con 5-10 studenti** [classe/i], su base volontaria e con il consenso dei genitori dei minori di 14 anni. Piano in `03-piano-pilota.md`; rischi aperti in `04-rischi-e-richieste.md`.

## Cosa chiediamo alla scuola
1. Autorizzazione al pilota e un referente.
2. Un parere del vostro DPO sul ruolo della scuola (vedi `02-privacy-minori.md`).
3. In seguito, se il pilota va bene: una richiesta formale al fornitore del registro [Axios] per un collegamento ufficiale.

## Contatto
[Nome, ruolo, email]
