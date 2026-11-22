# SchoolOS — proposta di pilota per la scuola

> Bozza di lavoro da adattare. I campi tra [parentesi quadre] vanno completati prima dell'invio. Non è un parere legale: le parti su privacy e contratti vanno riviste da un avvocato/DPO.

## Cosa è
SchoolOS è un'app web (installabile su telefono) che dà allo studente un posto solo per: voti e medie, compiti e verifiche, calendario, orario, analisi dell'andamento e simulatore «che voto mi serve?». Oggi i dati stanno su tre app diverse e le medie le calcola ognuno a mente.

## Cosa chiediamo alla scuola
1. **Un pilota su una classe** ([classe], [n.] studenti) per [durata, es. un periodo scolastico].
2. **Consenso e informativa**: per i minori di 14 anni serve l'assenso dei genitori (età del consenso digitale in Italia: 14 anni). Forniamo noi i moduli.
3. **Un referente** (docente o segreteria) per raccogliere feedback.
4. **Opzionale, il passo che fa la differenza**: una richiesta formale al fornitore del registro ([Axios]) per un accesso ufficiale in lettura ai dati dei voti degli studenti che aderiscono. Senza, gli studenti importano i voti da soli (incolla, screenshot, estensione PC): funziona ma richiede un gesto manuale.

## Cosa NON facciamo
- Non chiediamo né conserviamo la password del registro.
- Non leggiamo niente al di fuori di materia, data, voto, tipo e peso del voto.
- Nessuna pubblicità, nessuna vendita di dati. Ogni studente può scaricare o cancellare tutto dalle Impostazioni (funzioni già presenti).

## Dati e privacy (stato attuale)
| Tema | Stato |
|---|---|
| Titolare del trattamento | [SchoolOS / persona fisica] per l'uso individuale; per un uso a nome della scuola serve un accordo (scuola titolare, SchoolOS responsabile ex art. 28 GDPR) |
| Dati trattati | Profilo, materie, voti, compiti, orario. Nessun dato sensibile oltre ai voti |
| Sicurezza | Database con accesso per utente (Row Level Security), connessioni cifrate, nessuna credenziale del registro |
| Diritti | Export e cancellazione dell'account in app |
| Da fare prima di un uso esteso | DPIA, informativa, nomina DPO di riferimento della scuola, registro dei trattamenti, regione UE dei dati (già Francoforte) |

## Modello (per trasparenza)
Base gratuita per tutti gli studenti della scuola. Funzioni automatiche/AI in abbonamento opzionale. Nessun costo per la scuola nel pilota.

## Cosa ci aspettiamo di misurare nel pilota
- Quanti studenti ci tornano dopo una settimana.
- Quanti voti vengono importati e quanto tempo richiede.
- Segnalazioni di errori nelle medie rispetto al registro.

## Rischi che dichiariamo
- Il fornitore del registro potrebbe non autorizzare l'accesso automatico: in quel caso resta l'import manuale.
- Le condizioni d'uso del registro vanno verificate con il fornitore prima di estendere oltre il pilota.

---

# Bozza di richiesta al fornitore del registro (da inviare dalla scuola o con la scuola)

Oggetto: richiesta di accesso in sola lettura ai voti per un pilota studentesco

Gentili [Axios / Spaggiari / Argo],
l'istituto [nome scuola] sta valutando un pilota con SchoolOS, un'applicazione che mostra allo studente i propri voti, compiti e calendario. Chiediamo:
1. se esiste un'interfaccia ufficiale (API o export) per leggere i **propri** voti dello studente che dà il consenso;
2. in alternativa, se l'uso da parte dello studente di uno strumento sul proprio dispositivo che legge la pagina dei voti dopo il suo login è compatibile con le condizioni d'uso;
3. le condizioni economiche e tecniche di un eventuale accordo.
SchoolOS non raccoglie né conserva le credenziali del registro e tratta solo materia, data, voto, tipo e peso. Restiamo a disposizione per una dimostrazione.
[Firma / ruolo / contatto]
