"use client";

import { CalendarIcon, CircleHelpIcon, FlagIcon, FolderIcon, PlusIcon, RepeatIcon, TagIcon, BookOpenIcon, ClockIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Subject } from "@/lib/domain/model";
import { getMessages } from "@/lib/i18n";
import { dueLabel } from "@/lib/todo/format";
import { type Detected, parseQuickAdd } from "@/lib/todo/quick-add";
import { describeRecurrence } from "@/lib/todo/recurrence";
import type { TodoProject, TodoView } from "@/lib/todo/types";
import type { NewTodoInput } from "./use-todo-store";

const t = getMessages().todo;

const CHIP_ICON: Record<Detected["kind"], typeof CalendarIcon> = {
  date: CalendarIcon,
  time: ClockIcon,
  recurrence: RepeatIcon,
  priority: FlagIcon,
  project: FolderIcon,
  label: TagIcon,
  subject: BookOpenIcon,
};

/**
 * Campo di aggiunta rapida in linguaggio naturale. Mentre scrivi, sotto compaiono le parti
 * riconosciute (data, ora, priorità…), così sai cosa verrà salvato prima di premere Invio.
 */
export function QuickAdd({
  inputRef,
  view,
  today,
  projects,
  subjects,
  onAdd,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  view: TodoView;
  today: string;
  projects: readonly TodoProject[];
  subjects: readonly Subject[];
  onAdd: (input: NewTodoInput) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const parsed = useMemo(() => parseQuickAdd(text, { today, projects, subjects }), [text, today, projects, subjects]);

  const submit = async () => {
    if (!parsed.title) {
      setError(t.quickAddEmpty);
      return;
    }
    setError(null);
    // Dove sei è il valore predefinito: in "Oggi" si aggiunge per oggi, in una lista dentro quella lista.
    const due = parsed.due ?? (view.type === "today" ? today : null);
    const input: NewTodoInput = {
      title: parsed.title,
      due,
      time: due ? parsed.time : null,
      priority: parsed.priority ?? 4,
      recurrence: parsed.recurrence,
      projectId: parsed.projectId ?? (view.type === "project" ? view.id : null),
      subjectId: parsed.subjectId,
      labels: parsed.labels,
    };
    setText("");
    await onAdd(input);
  };

  const chipText = (d: Detected): string => {
    if (d.kind === "date" && parsed.due) return dueLabel(parsed.due, null, today).text;
    if (d.kind === "time" && parsed.time) return parsed.time;
    if (d.kind === "recurrence" && parsed.recurrence) return describeRecurrence(parsed.recurrence);
    if (d.kind === "priority" && parsed.priority) return t.priorityName[parsed.priority];
    if (d.kind === "project") return projects.find((p) => p.id === parsed.projectId)?.name ?? d.raw;
    if (d.kind === "subject") return subjects.find((s) => s.id === parsed.subjectId)?.name ?? d.raw;
    return d.raw;
  };

  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          placeholder={t.quickAddPlaceholder}
          aria-label={t.quickAddLabel}
          aria-describedby="quick-add-feedback"
          maxLength={400}
          enterKeyHint="done"
          autoComplete="off"
          className="flex-1"
        />
        <Button type="submit" variant="primary" aria-label={t.quickAddButton}>
          <PlusIcon aria-hidden />
          <span className="hidden sm:inline">{t.quickAddButton}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setHelp((v) => !v)}
          aria-expanded={help}
          aria-controls="quick-add-help"
          aria-label={t.quickAddHelpTitle}
        >
          <CircleHelpIcon aria-hidden />
        </Button>
      </form>

      <div id="quick-add-feedback" aria-live="polite" className="flex min-h-5 flex-wrap items-center gap-1.5 text-xs">
        {error && <span className="text-critical">{error}</span>}
        {!error &&
          parsed.detected.map((d, i) => {
            const Icon = CHIP_ICON[d.kind];
            return (
              <span key={`${d.kind}-${i}`} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-text">
                <Icon className="size-3" aria-hidden />
                {chipText(d)}
              </span>
            );
          })}
        {!error && parsed.detected.length === 0 && (
          <span className="text-muted pointer-coarse:hidden">{t.shortcutsHint}</span>
        )}
      </div>

      {help && (
        <dl id="quick-add-help" className="grid gap-x-4 gap-y-1.5 rounded-card border border-border bg-surface p-3 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="sr-only">{t.quickAddHelpTitle}</dt>
          {t.quickAddHelp.map(([name, example]) => (
            <div key={name} className="contents">
              <dt className="font-medium">{name}</dt>
              <dd className="text-muted">{example}</dd>
            </div>
          ))}
          <p className="text-muted sm:col-span-2">{t.quickAddHelpNote}</p>
        </dl>
      )}
    </div>
  );
}
