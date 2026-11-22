# Lista «Da fare» (stile Todoist, su misura per studenti)

Sezione `/tasks` (voce «Da fare» nel menu). Funziona nella **base gratuita**: nessuna AI, nessun costo per uso.
Gli impegni della scuola (compiti, verifiche, interrogazioni) restano nella tabella `assignments` e si possono
importare con un tocco; la lista «Da fare» è lo spazio personale dello studente, per tutto il resto.

## Cosa c'è

| Funzione | Note |
|---|---|
| Attività con titolo, note, scadenza, ora, priorità P1–P4 | P1 = urgente (come Todoist) |
| Viste | **Inbox**, **Oggi** (scadute + oggi), **Prossimi** (per giorno), **Liste**, **Etichette**, **Completati** (ultimi 30 giorni) |
| Liste e etichette | Una lista per attività (senza lista = Inbox); fino a 8 etichette. Eliminare una lista riporta le attività nell'Inbox |
| Sotto-attività | Un solo livello; seguono la lista del genitore; completare il genitore chiude i figli |
| Ricorrenze | ogni giorno / N giorni, giorni feriali, settimane con giorni scelti, mesi. L'attività non si duplica: al completamento la scadenza scorre alla prossima occorrenza (mai arretrati) |
| Aggiunta rapida in italiano | «studiare storia domani alle 15 p1 #scuola @ripasso +storia» (vedi sotto) |
| Collegamenti con la scuola | Materia (`subject_id`) e compito importato (`assignment_id`): completare l'attività segna fatto anche il compito |
| Ricerca | Su titolo e note, ignora maiuscole e accenti |
| Mobile-first | Viste come chip scorrevoli, dettagli come foglio dal basso, bersagli 44px con `pointer-coarse` |
| Extra PC | Colonna delle viste, pannello laterale, scorciatoie: **Q** aggiungi, **/** cerca, **Esc** chiude |
| Annulla | Dopo aver completato compare «Annulla» per 6 secondi |

### Sintassi dell'aggiunta rapida

| Cosa | Esempi |
|---|---|
| Data | `oggi`, `domani`, `dopodomani`, `lunedì` (sempre nel futuro), `tra 3 giorni`, `fra 2 settimane`, `15/12`, `3 gennaio`, `il 25` |
| Ora | `alle 15`, `alle 15:30`, `ore 9.30`, `18:45`, `stasera` (20:00) |
| Ripetizione | `ogni giorno`, `ogni 2 giorni`, `ogni settimana`, `ogni martedì e giovedì`, `ogni mese`, `nei giorni feriali` |
| Priorità | `p1`…`p4` oppure `!1`…`!4` |
| Lista | `#scuola` (nome o inizio del nome; spazi ignorati) |
| Materia | `+storia` (nome esatto prima, poi prefisso) |
| Etichetta | `@ripasso` (se non esiste viene creata) |

Ciò che non viene riconosciuto resta nel titolo. Le parti riconosciute appaiono come chip sotto il campo prima dell'invio.
Il parser è puro e deterministico: `lib/todo/quick-add.ts`.

## Dati (migrazione `20261122120000_todo.sql`)

- `todo_projects`, `todo_labels`, `todos`, `todo_label_links`, tutte con `user_id` e RLS «solo i propri dati».
- Chiavi esterne **composte** `(id, user_id)`: nessuno può agganciare una propria attività a lista, materia o compito altrui.
- Trigger: sotto-attività a un solo livello, stessa lista del genitore, niente ricorrenza sui figli.
- Limiti per account (anti-abuso, app pubblica): 5000 attività, 60 liste, 100 etichette.
- Eliminare materia/compito collegato scollega soltanto (`on delete set null (colonna)`, richiede Postgres 15+: ok su Supabase).
- Le tabelle sono incluse nell'esportazione dati (GDPR, art. 20) e spariscono con l'account (`on delete cascade`).
- **Da applicare** sul progetto Supabase come le altre migrazioni (SQL Editor, dopo `delete_my_account`).

## Architettura

- `lib/todo/` — dominio puro e testato: `quick-add.ts`, `recurrence.ts`, `complete.ts` (stessa logica su server e client), `views.ts`, `format.ts`.
- `app/(app)/tasks/actions.ts` — azioni server: zod, client dell'utente (quindi RLS), restituiscono le righe salvate.
- `components/todo/use-todo-store.ts` — stato client **ottimistico** con rollback per singola attività se il server rifiuta; in demo tutto resta locale.
- `lib/data/todo-data.ts` — lettura: attività aperte + completate negli ultimi 30 giorni, compiti importabili.

## Idee per dopo (non fatte)

- Widget «Da fare» nella Dashboard e scadenze nel Calendario (oggi la Dashboard legge ancora solo `assignments`).
- Promemoria/notifiche all'ora indicata (serve push: Capacitor/Web Push).
- Trascinamento per riordinare (`position` esiste già), vista Kanban.
- Aggiunta vocale e modelli (es. «settimana di verifiche»); AI per Pro (spezzare un compito in sotto-attività).
- Offline vero (coda di scritture) nella PWA: oggi serve la rete per salvare.
