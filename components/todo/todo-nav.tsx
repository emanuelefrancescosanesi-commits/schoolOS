"use client";

import { CalendarCheckIcon, CalendarRangeIcon, CircleCheckBigIcon, InboxIcon, PlusIcon, TagIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";
import type { TodoLabel, TodoProject, TodoView } from "@/lib/todo/types";
import type { TodoCounts } from "@/lib/todo/views";
import { cn } from "@/lib/utils";

const t = getMessages().todo;

export const sameView = (a: TodoView, b: TodoView) =>
  a.type === b.type && ("id" in a ? "id" in b && a.id === b.id : true);

interface Props {
  view: TodoView;
  onView: (v: TodoView) => void;
  projects: readonly TodoProject[];
  labels: readonly TodoLabel[];
  counts: TodoCounts;
  onAddProject: (name: string) => Promise<boolean>;
}

type Entry = { view: TodoView; label: string; count?: number; icon?: typeof InboxIcon; dot?: number };

function entries({ projects, labels, counts }: Pick<Props, "projects" | "labels" | "counts">) {
  const base: Entry[] = [
    { view: { type: "inbox" }, label: t.views.inbox, count: counts.inbox, icon: InboxIcon },
    { view: { type: "today" }, label: t.views.today, count: counts.today, icon: CalendarCheckIcon },
    { view: { type: "upcoming" }, label: t.views.upcoming, count: counts.upcoming, icon: CalendarRangeIcon },
  ];
  const lists: Entry[] = projects.map((p) => ({ view: { type: "project", id: p.id }, label: p.name, count: counts.byProject.get(p.id), dot: p.color }));
  const tags: Entry[] = labels
    .filter((l) => (counts.byLabel.get(l.id) ?? 0) > 0)
    .map((l) => ({ view: { type: "label", id: l.id }, label: `@${l.name}`, count: counts.byLabel.get(l.id), icon: TagIcon }));
  const done: Entry = { view: { type: "completed" }, label: t.views.completed, icon: CircleCheckBigIcon };
  return { base, lists, tags, done };
}

function NewListForm({ onAdd, onDone }: { onAdd: Props["onAddProject"]; onDone: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2 px-1 py-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Scrivi un nome");
        const ok = await onAdd(name);
        if (ok) onDone();
        else setError("Non siamo riusciti a creare la lista.");
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus placeholder={t.newListName} aria-label={t.newListName} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="primary">
          {t.create}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t.cancel}
        </Button>
      </div>
      {error && <FormMessage tone="error">{error}</FormMessage>}
    </form>
  );
}

/** Su PC è una colonna a sinistra; su telefono una riga di "chip" scorrevole sopra la lista. */
export function TodoNav(props: Props) {
  const { view, onView } = props;
  const { base, lists, tags, done } = entries(props);
  // Un solo modulo alla volta: telefono e PC hanno ciascuno il proprio, mai due aperti insieme.
  const [addingMobile, setAddingMobile] = useState(false);
  const [addingDesktop, setAddingDesktop] = useState(false);

  const item = (e: Entry, layout: "column" | "chip") => {
    const active = sameView(view, e.view);
    const Icon = e.icon;
    return (
      <button
        key={`${layout}-${e.view.type}-${"id" in e.view ? e.view.id : ""}`}
        type="button"
        onClick={() => onView(e.view)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-control text-sm transition-colors",
          layout === "chip"
            ? "h-9 pointer-coarse:h-11 border border-border px-3 whitespace-nowrap"
            : "h-9 w-full px-3 text-left",
          active ? "bg-accent-soft font-medium text-accent-text" : "text-fg hover:bg-surface-2",
          layout === "chip" && active && "border-accent-text/40",
        )}
      >
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        {e.dot && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `var(--subject-${e.dot})` }} aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{e.label}</span>
        {e.count ? <span className="text-xs text-muted tabular-nums">{e.count}</span> : null}
      </button>
    );
  };

  return (
    <>
      {/* Telefono e tablet */}
      <nav aria-label={t.navLabel} className="-mx-4 lg:hidden">
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {[...base, ...lists, ...tags, done].map((e) => item(e, "chip"))}
          <button
            type="button"
            onClick={() => setAddingMobile((v) => !v)}
            aria-expanded={addingMobile}
            className="inline-flex h-9 pointer-coarse:h-11 shrink-0 items-center gap-1 rounded-control border border-dashed border-border px-3 text-sm text-muted"
          >
            <PlusIcon className="size-4" aria-hidden />
            {t.newList}
          </button>
        </div>
        {addingMobile && (
          <div className="px-4">
            <NewListForm onAdd={props.onAddProject} onDone={() => setAddingMobile(false)} />
          </div>
        )}
      </nav>

      {/* PC */}
      <nav aria-label={t.navLabel} className="hidden w-56 shrink-0 flex-col gap-4 lg:flex">
        <div className="flex flex-col gap-0.5">{base.map((e) => item(e, "column"))}</div>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-3 pb-1">
            <h2 className="text-xs font-medium text-muted">{t.lists}</h2>
            <button
              type="button"
              onClick={() => setAddingDesktop((v) => !v)}
              aria-label={t.newList}
              aria-expanded={addingDesktop}
              className="rounded-control p-1 text-muted hover:bg-surface-2 hover:text-fg"
            >
              <PlusIcon className="size-4" aria-hidden />
            </button>
          </div>
          {addingDesktop && <NewListForm onAdd={props.onAddProject} onDone={() => setAddingDesktop(false)} />}
          {lists.map((e) => item(e, "column"))}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <h2 className="px-3 pb-1 text-xs font-medium text-muted">{t.labels}</h2>
            {tags.map((e) => item(e, "column"))}
          </div>
        )}
        <div>{item(done, "column")}</div>
      </nav>
    </>
  );
}
