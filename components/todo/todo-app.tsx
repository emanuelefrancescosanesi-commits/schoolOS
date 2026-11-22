"use client";

import { PencilIcon, PlusIcon, SearchIcon, SchoolIcon, Trash2Icon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dateKeyToDate } from "@/lib/domain/dates";
import type { Subject } from "@/lib/domain/model";
import { capitalize } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { dayHeading } from "@/lib/todo/format";
import type { Todo, TodoView } from "@/lib/todo/types";
import { buildTree, compareTodos, countTodos, filterView, groupUpcoming, matchesQuery } from "@/lib/todo/views";
import type { TodoPageData } from "@/lib/data/todo-data";
import { cn } from "@/lib/utils";
import { QuickAdd } from "./quick-add";
import { TodoDetail } from "./todo-detail";
import { TodoNav } from "./todo-nav";
import { type RowContext, TodoRow } from "./todo-row";
import { useTodoStore } from "./use-todo-store";

const t = getMessages().todo;

const longDay = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function TodoApp({ data, subjects }: { data: Omit<TodoPageData, "subjects">; subjects: Subject[] }) {
  const { today } = data;
  const store = useTodoStore(data);
  const { todos, projects, labels } = store;

  const [view, setView] = useState<TodoView>({ type: "today" });
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirmList, setConfirmList] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Se la vista corrente sparisce (lista eliminata), si torna alla Inbox.
  const effectiveView: TodoView =
    (view.type === "project" && !projects.some((p) => p.id === view.id)) ||
    (view.type === "label" && !labels.some((l) => l.id === view.id))
      ? { type: "inbox" }
      : view;

  // Scorciatoie da tastiera (solo dove c'è una tastiera: su telefono non scattano mai).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        quickRef.current?.focus();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const labelMap = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const counts = useMemo(() => countTodos(todos, today), [todos, today]);
  const todoById = useMemo(() => new Map(todos.map((x) => [x.id, x])), [todos]);

  const onOpen = useCallback((id: string) => setOpenId(id), []);
  const ctxFor = (showProject: boolean): RowContext => ({
    today,
    subjects: subjectMap,
    projects: projectMap,
    labels: labelMap,
    showProject,
    onToggle: (id) => void store.toggle(id),
    onOpen,
  });

  const searching = query.trim().length > 0;
  const project = effectiveView.type === "project" ? projectMap.get(effectiveView.id) : undefined;
  const label = effectiveView.type === "label" ? labelMap.get(effectiveView.id) : undefined;
  const heading = project?.name ?? (label ? `@${label.name}` : t.views[effectiveView.type as keyof typeof t.views]);

  const node = (x: Todo) => buildTree([x], todos)[0];
  const crumb = (x: Todo) => (x.parentId ? todoById.get(x.parentId)?.title : undefined);

  const list = (items: Todo[], ctx: RowContext, tree: boolean) => (
    <ul>
      {items.map((x) => (
        <TodoRow key={x.id} node={tree ? node(x) : { todo: x, children: [], doneChildren: 0 }} ctx={ctx} parentTitle={tree ? undefined : crumb(x)} />
      ))}
    </ul>
  );

  const heading2 = (text: string, tone?: "critical") => (
    <h3 className={cn("mt-4 mb-1 text-xs font-semibold tracking-wide uppercase first:mt-0", tone === "critical" ? "text-critical" : "text-muted")}>{text}</h3>
  );

  let body: React.ReactNode;
  let shown = 0;
  if (searching) {
    const results = todos.filter((x) => matchesQuery(x, query)).sort((a, b) => Number(a.completedAt !== null) - Number(b.completedAt !== null) || compareTodos(a, b));
    shown = results.length;
    body = results.length ? list(results, ctxFor(true), false) : <p className="py-6 text-center text-sm text-muted">{t.noResults}</p>;
  } else if (effectiveView.type === "today") {
    const items = filterView(todos, effectiveView, today);
    shown = items.length;
    const late = items.filter((x) => x.due! < today);
    const now = items.filter((x) => x.due! >= today);
    body = items.length ? (
      <>
        {late.length > 0 && (
          <>
            {heading2(t.overdue, "critical")}
            {list(late, ctxFor(true), false)}
          </>
        )}
        {now.length > 0 && (
          <>
            {late.length > 0 && heading2(dayHeading(today, today, longDay.format(dateKeyToDate(today))))}
            {list(now, ctxFor(true), false)}
          </>
        )}
      </>
    ) : null;
  } else if (effectiveView.type === "upcoming") {
    const { groups, later } = groupUpcoming(todos, today);
    shown = groups.reduce((n, g) => n + g.items.length, 0) + later.length;
    body = shown ? (
      <>
        {groups.map((g) => (
          <div key={`${g.overdue ? "o" : "d"}-${g.date}`}>
            {g.overdue ? heading2(t.overdue, "critical") : heading2(dayHeading(g.date!, today, longDay.format(dateKeyToDate(g.date!))))}
            {list(g.items, ctxFor(true), false)}
          </div>
        ))}
        {later.length > 0 && (
          <>
            {heading2(t.later)}
            {list(later, ctxFor(true), false)}
          </>
        )}
      </>
    ) : null;
  } else {
    const items = filterView(todos, effectiveView, today).sort(effectiveView.type === "completed" ? () => 0 : compareTodos);
    shown = items.length;
    body = items.length ? list(items, ctxFor(effectiveView.type !== "project"), effectiveView.type !== "completed") : null;
  }

  const emptyText = t.empty[effectiveView.type];
  const opened = openId ? (todoById.get(openId) ?? null) : null;
  const showImport = !searching && store.importable.length > 0 && (effectiveView.type === "inbox" || effectiveView.type === "upcoming");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row lg:gap-8">
      <TodoNav
        view={effectiveView}
        onView={(v) => {
          setView(v);
          setQuery("");
          setRenaming(null);
          setConfirmList(false);
        }}
        projects={projects}
        labels={labels}
        counts={counts}
        onAddProject={async (name) => {
          const p = await store.addProject(name, (projects.length % 8) + 1);
          if (p) setView({ type: "project", id: p.id });
          return p !== null;
        }}
      />

      <section className="min-w-0 flex-1" aria-labelledby="todo-heading">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {renaming && project ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = new FormData(e.currentTarget).get("name")?.toString() ?? "";
                  if (name.trim()) void store.editProject(project.id, name, project.color);
                  setRenaming(null);
                }}
              >
                <Input name="name" defaultValue={project.name} maxLength={60} autoFocus aria-label={t.newListName} />
                <Button type="submit" variant="primary">{t.save}</Button>
                <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>{t.cancel}</Button>
              </form>
            ) : (
              <h1 id="todo-heading" className="truncate text-3xl font-semibold tracking-tight">
                {searching ? t.searchResults(shown) : capitalize(heading)}
              </h1>
            )}
            <p className="mt-1 text-sm text-muted">{effectiveView.type === "today" ? capitalize(longDay.format(dateKeyToDate(today))) : t.count(shown)}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && (setQuery(""), e.currentTarget.blur())}
                placeholder={t.search}
                aria-label={t.search}
                className="w-full pl-9 sm:w-56"
              />
            </div>
            {project && !renaming && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setRenaming(project.id)} aria-label={t.rename}>
                  <PencilIcon aria-hidden />
                </Button>
                {confirmList ? (
                  <Button variant="primary" className="bg-critical hover:bg-critical/90" onClick={() => void store.removeProject(project.id)}>
                    {t.deleteListConfirm}
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" onClick={() => setConfirmList(true)} aria-label={t.deleteList}>
                    <Trash2Icon aria-hidden />
                  </Button>
                )}
              </>
            )}
          </div>
        </header>

        {effectiveView.type !== "completed" && (
          <div className="mb-4">
            <QuickAdd inputRef={quickRef} view={effectiveView} today={today} projects={projects} subjects={subjects} onAdd={store.addTodo} />
          </div>
        )}

        {showImport && (
          <Card className="mb-4 flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <SchoolIcon className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{t.schoolImport.title}</h2>
                <p className="text-xs text-muted">{t.schoolImport.body(store.importable.length)}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => store.importable.forEach((a) => void store.importOne(a))}>
                {t.schoolImport.addAll}
              </Button>
            </div>
            <ul className="flex flex-col">
              {store.importable.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-xs text-muted">{t.schoolImport.kind[a.kind]} · </span>
                    {a.title}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void store.importOne(a)} aria-label={`${t.schoolImport.add}: ${a.title}`}>
                    <PlusIcon aria-hidden />
                    {t.schoolImport.add}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="px-4 py-2">
          {body ?? <p className="py-8 text-center text-sm text-muted">{emptyText}</p>}
        </Card>
      </section>

      <TodoDetail
        todo={opened}
        onClose={() => setOpenId(null)}
        store={store}
        today={today}
        projects={projects}
        subjects={subjects}
        labels={labels}
        subtasks={opened ? todos.filter((x) => x.parentId === opened.id) : []}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {store.error && (
          <div role="alert" className="pointer-events-auto flex max-w-md items-center gap-3 rounded-card border border-critical/40 bg-critical-soft px-4 py-2.5 text-sm text-critical shadow-lg">
            <span className="flex-1">{store.error}</span>
            <button type="button" onClick={store.dismissError} className="rounded-control p-1 hover:bg-critical/10" aria-label={t.dismiss}>
              <XIcon className="size-4" aria-hidden />
            </button>
          </div>
        )}
        {store.notice && !store.error && (
          <div role="status" className="pointer-events-auto flex max-w-md items-center gap-3 rounded-card border border-border bg-surface px-4 py-2.5 text-sm shadow-lg">
            <span className="flex-1">{store.notice.text}</span>
            {store.notice.undo && (
              <Button size="sm" variant="ghost" onClick={() => { store.notice?.undo?.(); store.dismissNotice(); }}>
                {t.undo}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
