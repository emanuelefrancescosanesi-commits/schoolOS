import type { Grade, GradeKind } from "@/lib/domain/averages";
import { type DateKey, addDays } from "@/lib/domain/dates";
import { DEFAULT_SCALE } from "@/lib/domain/grading";
import type { CalendarEvent, InboxMessage, SchoolData, Subject } from "@/lib/domain/model";
import { type Period, currentPeriod, suggestedPeriods } from "@/lib/domain/periods";
import type { Task } from "@/lib/domain/tasks";

/**
 * Dataset di esempio. Tutte le date sono relative a `today`, così la demo
 * sembra sempre "attuale". Nomi e contenuti sono generici: nessun riferimento
 * a scuole, docenti o studenti reali.
 */

const SUBJECTS: Subject[] = [
  { id: "ita", name: "Italiano", color: 1, teacher: "Prof.ssa Conti" },
  { id: "mat", name: "Matematica", color: 2, teacher: "Prof. Ferri" },
  { id: "fis", name: "Fisica", color: 3, teacher: "Prof. Ferri" },
  { id: "ing", name: "Inglese", color: 4, teacher: "Prof.ssa Wright" },
  { id: "sto", name: "Storia", color: 5, teacher: "Prof. Galli" },
  { id: "fil", name: "Filosofia", color: 6, teacher: "Prof. Galli" },
  { id: "sci", name: "Scienze", color: 7, teacher: "Prof.ssa Moretti" },
  { id: "inf", name: "Informatica", color: 8, teacher: "Prof. Lodi" },
];

// [materia, voto, giorni fa, peso, tipo, descrizione]
type GradeSeed = [string, number, number, number, GradeKind, string];

const GRADE_SEEDS: GradeSeed[] = [
  ["ita", 7, 62, 1, "written", "Analisi del testo"],
  ["ita", 7.5, 34, 1, "oral", "Dante, Inferno I–V"],
  ["ita", 8, 9, 1, "written", "Tema argomentativo"],
  ["mat", 5.5, 58, 1, "written", "Equazioni di secondo grado"],
  ["mat", 6.25, 30, 0.5, "oral", "Disequazioni"],
  ["mat", 5.75, 12, 1, "written", "Sistemi di disequazioni"],
  ["fis", 6, 55, 1, "written", "Cinematica"],
  ["fis", 4.75, 27, 1, "written", "Moto parabolico"],
  ["fis", 5.5, 6, 1, "oral", "Principi della dinamica"],
  ["ing", 8, 50, 1, "written", "Reading comprehension"],
  ["ing", 8.5, 21, 1, "oral", "Presentation"],
  ["sto", 7, 45, 1, "oral", "Età comunale"],
  ["sto", 6.5, 15, 1, "written", "Test a risposta aperta"],
  ["fil", 7.25, 40, 1, "oral", "Presocratici"],
  ["fil", 8, 4, 1, "oral", "Platone"],
  ["sci", 6.75, 38, 1, "written", "La cellula"],
  ["sci", 7, 10, 0.5, "practical", "Relazione di laboratorio"],
  ["inf", 9, 33, 1, "practical", "Algoritmi in pseudocodice"],
  ["inf", 8.5, 3, 1, "practical", "Primo programma in Python"],
];

// [id, titolo, materia, tipo, tra giorni, minuti stimati]
type TaskSeed = [string, string, string, Task["kind"], number, number?];

const TASK_SEEDS: TaskSeed[] = [
  ["t1", "Verifica sui vettori", "fis", "test", 2, 120],
  ["t2", "Esercizi pag. 214, n. 30–42", "mat", "homework", 1, 60],
  ["t3", "Interrogazione su Kant", "fil", "oral", 6, 90],
  ["t4", "Leggere il canto VI", "ita", "homework", 0, 30],
  ["t5", "Verifica di logaritmi", "mat", "test", 8, 150],
  ["t6", "Essay: climate change", "ing", "homework", 4, 45],
  ["t7", "Relazione sulla mitosi", "sci", "project", 10, 120],
  ["t8", "Ripasso Rinascimento", "sto", "homework", -1, 40],
  ["t9", "Interrogazione di storia", "sto", "oral", 12, 60],
];

export function buildDemoDataset(today: DateKey): SchoolData {
  const schoolYearStart = Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) >= 8 ? 0 : 1);
  const periods = demoPeriods(suggestedPeriods("trimestre-pentamestre", schoolYearStart), today);

  const grades: Grade[] = GRADE_SEEDS.map(([subjectId, value, daysAgo, weight, kind, description], i) => ({
    id: `g${i + 1}`,
    subjectId,
    value,
    weight,
    kind,
    description,
    date: addDays(today, -daysAgo),
  }));

  const tasks: Task[] = TASK_SEEDS.map(([id, title, subjectId, kind, inDays, estimatedMinutes]) => ({
    id,
    title,
    subjectId,
    kind,
    estimatedMinutes,
    due: addDays(today, inDays),
    done: false,
  }));

  const messages: InboxMessage[] = [
    {
      id: "m1",
      source: "registro",
      from: "Registro elettronico",
      subject: "Nuovo voto in Fisica",
      preview: "È stato registrato un voto orale: Principi della dinamica.",
      date: addDays(today, -6),
      time: "13:12",
      unread: false,
      subjectId: "fis",
    },
    {
      id: "m2",
      source: "email",
      from: "Segreteria didattica",
      subject: "Colloqui generali con le famiglie",
      preview: "I colloqui si terranno su prenotazione. Il modulo è disponibile fino a venerdì.",
      date: today,
      time: "08:05",
      unread: true,
    },
    {
      id: "m3",
      source: "email",
      from: "Prof. Ferri",
      subject: "Materiale per la verifica sui vettori",
      preview: "Vi allego gli esercizi svolti e le formule che potrete usare.",
      date: addDays(today, -1),
      time: "17:40",
      unread: true,
      subjectId: "fis",
    },
    {
      id: "m4",
      source: "registro",
      from: "Registro elettronico",
      subject: "Variazione d'orario di domani",
      preview: "La 4ª ora di Scienze è sostituita da Matematica.",
      date: addDays(today, -1),
      time: "14:20",
      unread: false,
    },
    {
      id: "m5",
      source: "email",
      from: "Rappresentanti di classe",
      subject: "Assemblea di classe",
      preview: "Proposta di ordine del giorno per l'assemblea del mese.",
      date: addDays(today, -3),
      time: "19:02",
      unread: false,
    },
  ];

  const events: CalendarEvent[] = [
    { id: "e1", title: "Assemblea di classe", date: addDays(today, 3), time: "11:00", kind: "event" },
    { id: "e2", title: "Uscita didattica al museo", date: addDays(today, 5), time: "08:30", kind: "event" },
    { id: "e3", title: "Colloqui con le famiglie", date: addDays(today, 1), time: "15:00", kind: "event" },
  ];

  return {
    profile: {
      firstName: "Alex",
      timeZone: "Europe/Rome",
      scale: DEFAULT_SCALE,
      averageMethod: "weighted",
      periodScheme: "trimestre-pentamestre",
      registro: "nessuno",
    },
    subjects: SUBJECTS,
    periods,
    grades,
    tasks,
    messages,
    events,
    isDemo: true,
  };
}

/**
 * Allarga il periodo corrente quanto basta perché i voti demo (fino a ~2 mesi
 * fa) ci rientrino, anche se oggi è l'inizio di un periodo reale.
 */
function demoPeriods(periods: Period[], today: DateKey): Period[] {
  const current = currentPeriod(periods, today);
  if (!current) return periods;
  const minStart = addDays(today, -75);
  const minEnd = addDays(today, 30);
  return periods.map((p) =>
    p.id === current.id
      ? { ...p, start: p.start < minStart ? p.start : minStart, end: p.end > minEnd ? p.end : minEnd }
      : p,
  );
}
