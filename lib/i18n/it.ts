/**
 * Testi dell'interfaccia in italiano. Ogni stringa visibile passa da qui, così
 * aggiungere una lingua significa aggiungere un file con la stessa forma
 * (`satisfies Messages`), senza toccare i componenti.
 */
export const it = {
  meta: {
    appName: "SchoolOS",
    tagline: "Scuola, voti e scadenze in un solo posto",
  },
  common: {
    skipToContent: "Vai al contenuto",
    demoBanner: "Modalità demo: stai vedendo dati di esempio, non i tuoi.",
    demoBadge: "Demo",
    retry: "Riprova",
    seeAll: "Vedi tutto",
    close: "Chiudi",
    today: "Oggi",
    tomorrow: "Domani",
    inDays: (n: number) => (n === 0 ? "oggi" : n === 1 ? "domani" : `tra ${n} giorni`),
    daysAgo: (n: number) => (n === 1 ? "ieri" : `${n} giorni fa`),
    minutes: (n: number) => (n < 60 ? `${n} min` : `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ""}`),
  },
  nav: {
    groups: { main: "Principale", study: "Studio", system: "Sistema" },
    dashboard: "Dashboard",
    mySchool: "My School",
    inbox: "Inbox",
    assistant: "Assistente",
    grades: "Voti",
    analytics: "Analisi",
    subjects: "Materie",
    tasks: "Compiti",
    calendar: "Calendario",
    timetable: "Orario",
    notifications: "Notifiche",
    integrations: "Integrazioni",
    settings: "Impostazioni",
    more: "Altro",
    moreTitle: "Tutte le sezioni",
    collapse: "Comprimi barra laterale",
    expand: "Espandi barra laterale",
    primary: "Navigazione principale",
    mobile: "Navigazione rapida",
  },
  theme: {
    label: "Tema",
    light: "Chiaro",
    dark: "Scuro",
    system: "Sistema",
    switchTo: (name: string) => `Tema: ${name}. Cambia tema`,
  },
  greeting: {
    morning: "Buongiorno",
    afternoon: "Buon pomeriggio",
    evening: "Buonasera",
    night: "Buonanotte",
  },
  dashboard: {
    title: "Dashboard",
    customize: "Personalizza",
    doneCustomizing: "Fatto",
    customizeHint: "Riordina o nascondi i widget. Le scelte restano salvate su questo dispositivo.",
    reset: "Ripristina",
    hidden: "Widget nascosti",
    show: (name: string) => `Mostra ${name}`,
    hide: (name: string) => `Nascondi ${name}`,
    moveUp: (name: string) => `Sposta ${name} prima`,
    moveDown: (name: string) => `Sposta ${name} dopo`,
    periodLabel: (name: string) => `Periodo: ${name}`,
    summary: (tests: number, tasks: number) => {
      const t = tests === 0 ? "nessuna verifica" : tests === 1 ? "1 verifica" : `${tests} verifiche`;
      const h = tasks === 0 ? "nessun compito" : tasks === 1 ? "1 compito" : `${tasks} compiti`;
      return `Nei prossimi 7 giorni: ${t} e ${h}.`;
    },
    widgets: {
      performance: "Rendimento",
      upcoming: "Prossimi impegni",
      tasks: "Attività",
      inbox: "Comunicazioni",
      week: "Settimana",
    },
    performance: {
      overall: "Media generale",
      delta: (sign: string, value: string) => `${sign}${value} negli ultimi 30 giorni`,
      noDelta: "Primo mese di voti",
      stable: "Stabile negli ultimi 30 giorni",
      recent: "Ultimi voti",
      bySubject: "Per materia",
      gradesCount: (n: number) => (n === 1 ? "1 voto" : `${n} voti`),
      trendLabel: "Andamento della media generale",
      needed: (grade: string) => `Per la sufficienza serve almeno ${grade}`,
      unreachable: "Servono più prove per tornare alla sufficienza",
      empty: "Nessun voto ancora. Aggiungi il primo voto per vedere la media.",
      addGrade: "Aggiungi voto",
    },
    upcoming: {
      empty: "Nessuna verifica o interrogazione nelle prossime due settimane.",
      kind: { test: "Verifica", oral: "Interrogazione", homework: "Compito", project: "Progetto" },
    },
    tasks: {
      empty: "Tutto fatto. Nessun compito aperto.",
      markDone: (title: string) => `Segna come fatto: ${title}`,
      markUndone: (title: string) => `Segna come da fare: ${title}`,
      priority: { high: "Alta", medium: "Media", low: "Bassa" },
      overdue: "Scaduto",
      completed: (n: number) => (n === 1 ? "1 completato" : `${n} completati`),
    },
    inbox: {
      empty: "Nessuna comunicazione recente.",
      unread: "Non letta",
      source: { email: "Email", registro: "Registro", calendar: "Calendario", manual: "Manuale" },
    },
    week: {
      empty: "Niente in programma.",
      events: (n: number) => (n === 0 ? "nessun impegno" : n === 1 ? "1 impegno" : `${n} impegni`),
    },
  },
  placeholder: {
    title: "In arrivo",
    body: "Questa sezione fa parte delle prossime fasi. La Dashboard è già attiva con dati di esempio.",
    back: "Torna alla Dashboard",
    descriptions: {
      "my-school": "Feed unificato di voti, compiti e comunicazioni da tutte le fonti, con le modifiche recenti.",
      grades: "Elenco filtrabile dei voti, inserimento rapido e grafici.",
      analytics: "Trend, materie instabili, confronto tra periodi, obiettivi e simulatore.",
      subjects: "Una scheda per materia con media, voti, compiti e docenti.",
      tasks: "Lista, Kanban e calendario con priorità automatica.",
      calendar: "Viste giorno, settimana, mese e agenda.",
      inbox: "Email e registro unificati, con riassunti e briefing giornaliero.",
      timetable: "Orario settimanale con variazioni evidenziate.",
      assistant: "Chat con accesso ai tuoi dati e risposte con riferimenti.",
      notifications: "Centro notifiche con filtri.",
      settings: "Profilo, tema, metodo di media, notifiche, esporta ed elimina dati.",
      integrations: "Stato reale di ogni connessione, ultimo sync e revoca.",
    } as Record<string, string>,
  },
  notFound: {
    title: "Pagina non trovata",
    body: "L'indirizzo non corrisponde a nessuna sezione di SchoolOS.",
  },
  error: {
    title: "Qualcosa è andato storto",
    body: "Non siamo riusciti a caricare questa pagina. Riprova tra un attimo.",
  },
};

export type Messages = typeof it;
