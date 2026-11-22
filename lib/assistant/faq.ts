/**
 * Conoscenza dell'assistente: le domande frequenti su SchoolOS, scritte una volta sola.
 * Diventano il contesto del prompt (vedi chat.ts). Scrivi solo ciò che l'app fa davvero oggi;
 * le funzioni non ancora pronte sono dichiarate come tali, così l'assistente non le promette.
 */

export type FaqCategoryId = "start" | "grades" | "import" | "privacy" | "account" | "trouble";

export interface FaqCategory {
  id: FaqCategoryId;
  label: string;
}

export interface FaqLink {
  label: string;
  href: `/${string}`;
}

export interface FaqItem {
  id: string;
  category: FaqCategoryId;
  question: string;
  /** Paragrafi della risposta, nell'ordine. */
  answer: string[];
  /** Passaggi numerati, mostrati dopo i paragrafi. */
  steps?: string[];
  /** Sinonimi e parole che gli studenti usano davvero. Non entrano nel prompt: servono a chi cura le FAQ. */
  keywords: string[];
  links?: FaqLink[];
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: "start", label: "Iniziare" },
  { id: "grades", label: "Voti e media" },
  { id: "import", label: "Importare i voti" },
  { id: "privacy", label: "Privacy e dati" },
  { id: "account", label: "Account e piano" },
  { id: "trouble", label: "Qualcosa non va" },
];

export const FAQ_ITEMS: FaqItem[] = [
  // ───────── Iniziare
  {
    id: "cos-e-schoolos",
    category: "start",
    question: "Che cos'è SchoolOS?",
    answer: [
      "Un posto unico dove tieni voti, medie, materie e impegni della scuola. Non sostituisce il registro elettronico: lo affianca, così vedi subito come stai andando e quanto ti serve per recuperare.",
      "Funziona da telefono e da computer. Puoi aggiungerla alla schermata Home e usarla come una normale app.",
    ],
    keywords: ["cosa", "serve", "app", "scopo", "registro", "funziona", "a cosa"],
  },
  {
    id: "installare-telefono",
    category: "start",
    question: "Come la metto sulla schermata Home del telefono?",
    answer: ["Non serve nessuno store: è un sito che si installa dal browser."],
    steps: [
      "iPhone (Safari): tocca il tasto Condividi, poi «Aggiungi alla schermata Home».",
      "Android (Chrome): tocca il menu ⋮, poi «Installa app» o «Aggiungi a schermata Home».",
      "Computer (Chrome o Edge): clicca l'icona di installazione nella barra dell'indirizzo.",
    ],
    keywords: ["installare", "scaricare", "download", "home", "iphone", "android", "pwa", "icona", "store", "app store", "play store"],
  },
  {
    id: "demo",
    category: "start",
    question: "Cosa significa «Modalità demo»?",
    answer: [
      "Stai guardando dati di esempio, non i tuoi. Puoi provare tutto, ma le modifiche spariscono quando ricarichi la pagina e l'importazione dal registro non è attiva.",
      "Per usare i tuoi dati crea un account o accedi.",
    ],
    keywords: ["demo", "esempio", "prova", "dati finti", "sparisce", "non salva"],
  },
  {
    id: "configurazione-iniziale",
    category: "start",
    question: "Cosa mi chiede la configurazione iniziale e posso cambiarla dopo?",
    answer: [
      "Anno e materie, come vengono dati i voti nella tua scuola (mezzi voti, più e meno, sufficienza), come è divisa l'annata (trimestri, trimestre + pentamestre, quadrimestri), il registro che usi e come calcolare la media.",
      "Sono scelte tue: ogni scuola è diversa, quindi niente è imposto. Gmail, Outlook e Calendar non sono obbligatori e si collegano più avanti.",
    ],
    keywords: ["onboarding", "configurazione", "setup", "iniziale", "cambiare", "modificare", "impostazioni", "scuola"],
    links: [{ label: "Apri le impostazioni", href: "/settings" }],
  },
  {
    id: "assistente",
    category: "start",
    question: "Cos'è l'Assistente e cosa può fare?",
    answer: [
      "Una chat che risponde in poche righe a come si usa SchoolOS. Non vede i tuoi voti né i tuoi dati personali, non risolve compiti e non sostituisce le medie dell'app. È una funzione del piano Pro e ha un limite di risposte al giorno.",
    ],
    keywords: ["assistente", "chat", "chatbot", "ai", "intelligenza artificiale", "domanda", "bot"],
  },
  {
    id: "sezioni-in-arrivo",
    category: "start",
    question: "Perché alcune sezioni dicono «In arrivo»?",
    answer: [
      "Il menu mostra già tutto il percorso previsto, ma le sezioni non ancora pronte te lo dicono onestamente invece di fingere. Oggi sono realizzati Dashboard, Voti, Materie, Impostazioni e l'Assistente.",
    ],
    keywords: ["in arrivo", "non funziona", "vuota", "calendario", "orario", "compiti", "inbox", "analisi", "assistente", "mancano"],
  },

  // ───────── Voti e media
  {
    id: "aggiungere-voto",
    category: "grades",
    question: "Come aggiungo un voto a mano?",
    answer: ["Vai in Voti, scegli la materia, il voto e la data, poi salva. Puoi eliminare un voto e, subito dopo, premere «Annulla» se ti sei sbagliato."],
    keywords: ["inserire", "aggiungere", "nuovo", "manuale", "mano", "scrivere", "eliminare", "cancellare", "annulla"],
    links: [{ label: "Vai ai voti", href: "/grades" }],
  },
  {
    id: "come-media",
    category: "grades",
    question: "Come viene calcolata la media?",
    answer: [
      "Prima si calcola la media di ogni materia, poi la media generale è la media delle medie delle materie: una materia con tanti voti non pesa più di una con pochi.",
      "Nella media di materia puoi scegliere: «Pesata» (ogni voto conta secondo il suo peso: un test breve può valere metà) oppure «Aritmetica» (tutti i voti uguali).",
    ],
    keywords: ["media", "calcolo", "calcolare", "pesata", "aritmetica", "generale", "peso", "pesi", "come si fa"],
    links: [{ label: "Cambia il metodo", href: "/settings" }],
  },
  {
    id: "mezzi-voti-piu-meno",
    category: "grades",
    question: "Come funzionano mezzi voti, «+» e «−»?",
    answer: [
      "Dipende dalla tua scuola, quindi lo imposti tu. Un mezzo voto vale 0,5 (6½ = 6,5). Un «+» vale +0,25 e un «−» vale −0,25: 7+ è 7,25 e 7− è 6,75.",
      "Se la tua scuola non usa i mezzi voti o i segni, disattivali: l'app accetterà solo i voti validi per te.",
    ],
    keywords: ["mezzo", "mezzi", "più", "meno", "+", "-", "6½", "7+", "decimi", "0,25", "0,5", "scala", "segno"],
    links: [{ label: "Imposta la scala", href: "/settings" }],
  },
  {
    id: "periodi",
    category: "grades",
    question: "Come funzionano trimestri, pentamestre e quadrimestri?",
    answer: [
      "Scegli lo schema della tua scuola: tre trimestri, trimestre + pentamestre (comune nei licei) o due quadrimestri. In Voti puoi filtrare per periodo o guardare tutto l'anno.",
    ],
    keywords: ["trimestre", "pentamestre", "quadrimestre", "periodo", "pagella", "scrutinio", "filtro", "anno"],
  },
  {
    id: "sufficienza",
    category: "grades",
    question: "Posso cambiare la soglia della sufficienza?",
    answer: ["Sì. Di solito è 6, ma la imposti tu insieme al voto più basso. Serve a colorare e a capire quali materie sono a rischio."],
    keywords: ["sufficienza", "insufficiente", "sotto il 6", "rosso", "rischio", "soglia", "minimo"],
    links: [{ label: "Apri le impostazioni", href: "/settings" }],
  },
  {
    id: "materie",
    category: "grades",
    question: "Come aggiungo, tolgo o rinomino le materie?",
    answer: ["Dalla sezione Materie puoi aggiungerne, rimuoverle e cambiare il colore. Per importare bene i voti dal registro, usa per le materie gli stessi nomi del registro (o molto simili)."],
    keywords: ["materia", "materie", "colore", "rinominare", "aggiungere materia", "togliere", "storia dell'arte", "nome"],
    links: [{ label: "Vai alle materie", href: "/subjects" }],
  },

  // ───────── Importare i voti
  {
    id: "come-importare",
    category: "import",
    question: "Qual è il modo più semplice per importare i voti dal registro?",
    answer: [
      "Quello che trovi in Voti → «Importa dal registro». Hai due strade che funzionano su ogni telefono e computer, senza password:",
    ],
    steps: [
      "Copia il testo della pagina dei voti del registro e incollalo nella casella, poi premi «Analizza».",
      "Oppure carica uno screenshot: il testo viene letto sul tuo dispositivo.",
      "Controlla ogni riga, correggi materia, voto o data se serve, e conferma.",
    ],
    keywords: ["importare", "importa", "import", "registro", "voti", "caricare", "copiare", "incollare", "axios", "classeviva", "argo", "sincronizzare"],
    links: [{ label: "Importa i voti", href: "/grades" }],
  },
  {
    id: "serve-password",
    category: "import",
    question: "SchoolOS mi chiede la password del registro?",
    answer: [
      "No, mai. Non c'è nessun collegamento al registro con le tue credenziali: i voti arrivano solo da testo o screenshot che scegli tu di portare, e confermi riga per riga.",
      "Se qualcuno ti chiede la password del registro a nome di SchoolOS, non darla.",
    ],
    keywords: ["password", "credenziali", "login", "accesso", "sicuro", "sicurezza", "codice", "utente", "chiede"],
  },
  {
    id: "screenshot",
    category: "import",
    question: "Come importo con uno screenshot?",
    answer: [
      "Fai lo screenshot della pagina dei voti (meglio grande e nitido), caricalo nell'importazione e aspetta la lettura. Il riconoscimento avviene sul tuo dispositivo: l'immagine non viene caricata da nessuna parte.",
      "Controlla sempre il testo letto: il riconoscimento può sbagliare ½, + e −, e a volte i numeri. Correggi e poi premi «Analizza».",
    ],
    keywords: ["screenshot", "foto", "immagine", "ocr", "png", "jpg", "schermata", "4 mb", "leggere"],
  },
  {
    id: "estensione-pc",
    category: "import",
    question: "Come funziona l'estensione per il browser del computer?",
    answer: [
      "Su PC (Chrome o Edge) l'estensione legge la pagina del registro che hai già aperto e fa arrivare i voti a SchoolOS. Con il codice di collegamento, su Axios i voti nuovi arrivano da soli quando apri il registro.",
      "L'estensione non vede mai la tua password e il codice si può revocare quando vuoi.",
    ],
    steps: [
      "In Voti → Importa dal registro crea un «codice di collegamento» e copialo (si vede una volta sola).",
      "Aprilo nelle Opzioni dell'estensione e incollalo.",
      "Da quel momento, aprendo il registro, i voti nuovi arrivano senza altri clic.",
    ],
    keywords: ["estensione", "chrome", "edge", "pc", "computer", "automatico", "automatica", "sincronizzazione", "codice di collegamento", "revocare"],
    links: [{ label: "Collega l'estensione", href: "/grades" }],
  },
  {
    id: "segnalibro",
    category: "import",
    question: "Cos'è il «segnalibro» di importazione?",
    answer: [
      "Un preferito del browser che, toccato sulla pagina dei voti del registro, manda i voti a SchoolOS. È un ripiego per chi non può usare l'estensione: richiede qualche passaggio manuale e va fatto nello stesso browser in cui sei entrato in SchoolOS.",
      "Per la maggior parte degli studenti è più semplice incollare il testo o caricare uno screenshot.",
    ],
    keywords: ["segnalibro", "preferito", "bookmark", "bookmarklet", "safari", "telefono", "un tocco"],
  },
  {
    id: "app-registro-telefono",
    category: "import",
    question: "Uso l'app del registro sul telefono: come importo da lì?",
    answer: [
      "Dall'app del registro non si può leggere in automatico. Apri la pagina dei voti, fai uno screenshot (o copia il testo, se l'app lo permette) e portalo in SchoolOS con «Importa dal registro».",
      "Una sincronizzazione completamente automatica da telefono, per ora, non c'è.",
    ],
    keywords: ["app", "telefono", "cellulare", "axios", "app del registro", "mobile", "automatico"],
  },
  {
    id: "duplicati",
    category: "import",
    question: "Se importo due volte lo stesso voto, lo duplica?",
    answer: ["No. I voti già presenti sono riconosciuti e saltati: vedrai «Già presente» e alla fine quanti ne sono stati importati e quanti già c'erano."],
    keywords: ["duplicato", "duplicati", "doppio", "doppi", "già presente", "due volte", "ripetuto"],
  },
  {
    id: "materia-non-trovata",
    category: "import",
    question: "L'importazione non trova una materia: cosa faccio?",
    answer: [
      "Nell'anteprima scegli tu la materia giusta dall'elenco prima di confermare. Se la materia non esiste ancora in SchoolOS, aggiungila da Materie e riprova.",
      "Il nome può essere scritto in modo diverso (maiuscole, apostrofi, abbreviazioni): scegliere a mano è sempre possibile.",
    ],
    keywords: ["materia", "non trovata", "non trova", "storia dell'arte", "nome", "sbagliata", "abbreviazione", "scegli la materia"],
    links: [{ label: "Vai alle materie", href: "/subjects" }],
  },
  {
    id: "limite-analisi",
    category: "import",
    question: "C'è un limite alle analisi?",
    answer: ["Sì: la lettura automatica con intelligenza artificiale (testo non riconosciuto o screenshot) ha un massimo di 15 analisi al giorno. Le funzioni automatiche avanzate sono pensate per un piano a pagamento; leggere i voti a mano resta sempre gratuito."],
    keywords: ["limite", "15", "massimo", "giorno", "analisi", "quota", "pro", "abbonamento", "ai", "intelligenza artificiale"],
  },

  // ───────── Privacy e dati
  {
    id: "dove-dati",
    category: "privacy",
    question: "Dove finiscono i miei dati e chi li vede?",
    answer: [
      "Voti e materie sono legati al tuo account e li vedi solo tu. Gli screenshot vengono letti sul tuo dispositivo e non vengono caricati. Al server arriva solo il testo che vedi e confermi.",
      "I dati stanno su un server in Europa.",
    ],
    keywords: ["privacy", "dati", "chi vede", "server", "europa", "gdpr", "minorenne", "sicuri", "riservati", "condivisione"],
  },
  {
    id: "scaricare-dati",
    category: "privacy",
    question: "Posso scaricare i miei dati?",
    answer: ["Sì, da Impostazioni puoi esportare tutti i tuoi dati in un file."],
    keywords: ["esporta", "esportare", "scaricare", "copia", "file", "portabilità", "backup", "download"],
    links: [{ label: "Vai alle impostazioni", href: "/settings" }],
  },
  {
    id: "eliminare-account",
    category: "privacy",
    question: "Come elimino il mio account?",
    answer: [
      "Da Impostazioni → «Elimina il mio account». Vengono cancellati account, voti, materie, compiti e codici di collegamento: non si può tornare indietro, quindi scarica prima i dati se ti servono.",
    ],
    keywords: ["eliminare", "cancellare", "account", "chiudere", "rimuovere", "disiscrivere", "cancellazione", "dati"],
    links: [{ label: "Vai alle impostazioni", href: "/settings" }],
  },

  // ───────── Account e piano
  {
    id: "gratis",
    category: "account",
    question: "SchoolOS è gratuita?",
    answer: [
      "La base sì e resta tale: inserimento manuale, incolla testo, lettura degli screenshot sul tuo dispositivo, medie e questa guida.",
      "Per le funzioni automatiche e con intelligenza artificiale è previsto un piano a pagamento, non ancora attivo.",
    ],
    keywords: ["gratis", "gratuita", "gratuito", "costa", "prezzo", "pagare", "pagamento", "abbonamento", "pro", "free", "piano"],
  },
  {
    id: "password-dimenticata",
    category: "account",
    question: "Ho dimenticato la password di SchoolOS",
    answer: ["Dalla pagina di accesso usa «Password dimenticata»: ti arriva una email con il link per sceglierne una nuova. Controlla anche lo spam."],
    keywords: ["password", "dimenticata", "reset", "recuperare", "email", "accesso", "non riesco", "entrare"],
    links: [{ label: "Recupera la password", href: "/forgot-password" }],
  },
  {
    id: "email-non-arriva",
    category: "account",
    question: "Non mi arriva l'email di conferma o di reset",
    answer: ["Aspetta un paio di minuti, controlla spam e promozioni, poi riprova una sola volta. Verifica di aver scritto bene l'indirizzo."],
    keywords: ["email", "mail", "conferma", "non arriva", "spam", "link", "posta", "verifica"],
  },
  {
    id: "tema",
    category: "account",
    question: "Come cambio il tema chiaro o scuro?",
    answer: ["Dal pulsante del tema nella barra superiore: Chiaro, Scuro o Sistema (segue il tuo dispositivo). La scelta resta salvata su quel dispositivo."],
    keywords: ["tema", "scuro", "chiaro", "dark", "notte", "colori", "aspetto"],
  },

  // ───────── Qualcosa non va
  {
    id: "voti-spariti",
    category: "trouble",
    question: "Non vedo più i miei voti",
    answer: [
      "Controlla che non sia attiva la «Modalità demo» e di essere nel periodo giusto: il filtro potrebbe mostrare un altro periodo. Prova «Tutto l'anno».",
      "Se sei fuori dall'account (accesso scaduto) rifai l'accesso.",
    ],
    keywords: ["spariti", "non vedo", "vuoto", "nessun voto", "periodo", "filtro", "sparito", "persi"],
  },
  {
    id: "media-sbagliata",
    category: "trouble",
    question: "La media non coincide con quella del registro",
    answer: [
      "Succede se cambiano i pesi, se manca un voto o se la scuola arrotonda in modo diverso. Controlla: che il metodo (pesata o aritmetica) sia quello della tua scuola, che i voti siano tutti importati e che mezzi voti e segni siano impostati come nel registro.",
      "La media di SchoolOS è una stima per orientarti, non il valore ufficiale dello scrutinio.",
    ],
    keywords: ["media", "sbagliata", "diversa", "non coincide", "registro", "errore", "arrotondamento", "pesi", "calcolo"],
    links: [{ label: "Controlla le impostazioni", href: "/settings" }],
  },
  {
    id: "ocr-sbaglia",
    category: "trouble",
    question: "Lo screenshot viene letto male",
    answer: [
      "Usa uno screenshot grande e nitido, con la pagina a luminosità normale e senza elementi sopra. Poi correggi il testo letto prima di premere «Analizza»: è normale che a volte sbagli ½, + e −.",
      "In alternativa copia e incolla il testo: è più preciso.",
    ],
    keywords: ["screenshot", "ocr", "male", "sbaglia", "errori", "illeggibile", "non legge", "numeri", "sfocato"],
  },
  {
    id: "app-non-si-aggiorna",
    category: "trouble",
    question: "L'app sembra vecchia o non si aggiorna",
    answer: ["Chiudila del tutto e riaprila. Se non basta, ricarica la pagina dal browser (su PC Ctrl+R). Gli aggiornamenti arrivano da soli alla prossima apertura."],
    keywords: ["vecchia", "aggiornare", "aggiornamento", "ricaricare", "bug", "bloccata", "non carica", "errore", "lenta"],
  },
  {
    id: "segnalare",
    category: "trouble",
    question: "Come segnalo un problema che non trovo qui?",
    answer: ["Scrivi alla persona che ti ha dato SchoolOS, con una frase su cosa stavi facendo e cosa è successo. Non inviare mai screenshot con la tua password o con dati di altri."],
    keywords: ["segnalare", "problema", "bug", "contatto", "supporto", "assistenza", "aiuto", "scrivere"],
  },
];
