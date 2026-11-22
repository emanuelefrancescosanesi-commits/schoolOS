# Piano pilota — 5-10 compagni

## Obiettivo
Verificare in 4 settimane se studenti comuni, **senza aiuto**, tengono SchoolOS aggiornato e lo trovano utile. Non misuriamo il numero di funzioni: misuriamo **ritorno e attrito**.

## Domande a cui deve rispondere
1. Gli studenti tornano? (retention)
2. Quanto costa tenere i voti aggiornati? (attrito di import)
3. I numeri sono giusti rispetto al registro? (fiducia)
4. Si fidano dei dati e dei permessi? (privacy percepita)
5. Ci pagherebbero per le funzioni automatiche? (modello)

## Chi
- 5-10 volontari [classi]; mix voluto: 2-3 non tecnici, almeno 1 con iPhone e 1 con Android, 1-2 sotto i 15 anni se esistono.
- Referente per la scuola: [nome].
- **Prima di invitare**: checklist in `02-privacy-gdpr-minori.md` (titolare, informativa, consensi). Se non è pronta, non partire.

## Cosa fanno
- Settimana 0: onboarding da soli (cronometrato), registro Axios, scala decimi, periodi della scuola.
- Settimane 1-4: uso libero. Import voti con il metodo che preferiscono (manuale, incolla, screenshot/OCR nel browser, estensione su PC). Niente AI.
- Nota onesta: la sincronizzazione automatica oggi richiede l'estensione su PC aperto su Axios; **su telefono manca**. Il pilota misura quanto pesa.

## Metriche
| Metrica | Come | Soglia di successo |
|---|---|---|
| Onboarding completato senza aiuto | osservazione + tempo | ≥ 8/10, < 5 minuti |
| Retention settimana 2 e 4 | accessi (≥ 1 volta/settimana) | ≥ 60% a 2 sett., ≥ 40% a 4 |
| Voti aggiornati entro 7 giorni dal registro | confronto a campione, a consenso | ≥ 70% |
| Tempo medio per importare un voto/lotto | cronometro in test | < 2 minuti per lotto |
| Errori di media vs registro | confronto con la media del registro | 0 errori di calcolo; differenze solo per arrotondamento/peso, documentate |
| Bug bloccanti su mobile | segnalazioni | 0 aperti a fine pilota |
| Disponibilità a pagare per «automatico» | domanda diretta, prezzo in fascia | ≥ 3/10 dicono sì a un prezzo indicato |
| Fiducia/privacy | questionario 5 domande | nessuno si sente a disagio |

Nota: con 5-10 persone le percentuali sono indicative, non statistiche. Servono come segnale, non come prova.

## Misurazione e privacy
- Preferire **misure a mano e interviste** a un sistema di analytics: non c'è tracciamento nell'app e non lo aggiungiamo per il pilota.
- Il confronto con il registro si fa **insieme allo studente, sul suo schermo**, mai leggendo i suoi dati dal database.

## Feedback
- Questionario di 8 domande al giorno 7 e al giorno 28.
- Intervista di 15 minuti a 4-5 studenti.
- Canale unico di segnalazione (gruppo/forma) con modello: cosa volevi fare, cosa è successo, telefono/PC.

## Criteri di stop
Si ferma e si corregge se: un dato personale è visibile a chi non dovrebbe, un errore di media è sistematico, o un genitore/studente chiede la cancellazione e non funziona. Ognuno cancellabile in Impostazioni.

## Cosa succede dopo
- **Esito positivo:** report di una pagina al preside con numeri, rischi chiusi, richiesta al fornitore del registro, proposta per la classe/scuola.
- **Esito negativo o dubbio:** si tiene l'app come strumento personale e si decide il da farsi con i dati sull'attrito.
