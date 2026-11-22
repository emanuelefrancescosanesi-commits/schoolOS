"use client";

import { ChevronDownIcon, InboxIcon, MailCheckIcon, MailIcon, NotebookTabsIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { addMessage, deleteMessage, markAllRead, setMessageRead } from "@/app/(app)/inbox/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { type DateKey, diffDays } from "@/lib/domain/dates";
import type { InboxMessage, Subject } from "@/lib/domain/model";
import { formatShortDate } from "@/lib/format";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { messageInputSchema } from "@/lib/validation/message";

const t = getMessages().inboxPage;
const src = getMessages().dashboard.inbox.source;

interface Props {
  messages: InboxMessage[];
  subjects: Subject[];
  today: DateKey;
  demo: boolean;
}

/** Inbox: comunicazioni della scuola incollate a mano, con letto/non letto. */
export function InboxView({ messages, subjects, today, demo }: Props) {
  const [local, setLocal] = useState<InboxMessage[]>(messages);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  // Letto/non letto cambiati ma non ancora riflessi dal server (aggiornamento ottimistico).
  const [readOverride, setReadOverride] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [title, setTitle] = useState("");
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const list = useMemo(
    () =>
      (demo ? local : messages)
        .filter((m) => !gone.has(m.id))
        .map((m) => (readOverride.has(m.id) ? { ...m, unread: !readOverride.get(m.id) } : m))
        .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [demo, local, messages, gone, readOverride],
  );
  const unreadCount = list.filter((m) => m.unread).length;
  const shown = onlyUnread ? list.filter((m) => m.unread) : list;

  const fail = (res: { ok: false; error: string }) => setError(res.error === "demo" ? t.errorSave : res.error);

  const setRead = (id: string, read: boolean) => {
    setReadOverride((o) => new Map(o).set(id, read));
    if (demo) return;
    start(async () => {
      const res = await setMessageRead(id, read);
      if (!res.ok) {
        setReadOverride((o) => {
          const n = new Map(o);
          n.delete(id);
          return n;
        });
        fail(res);
      }
    });
  };

  const toggle = (msg: InboxMessage) => {
    const next = open === msg.id ? null : msg.id;
    setOpen(next);
    if (next && msg.unread) setRead(msg.id, true);
  };

  const readAll = () => {
    setError(null);
    const ids = list.filter((m) => m.unread).map((m) => m.id);
    setReadOverride((o) => new Map([...o, ...ids.map((id) => [id, true] as const)]));
    if (demo) return;
    start(async () => {
      const res = await markAllRead();
      if (!res.ok) {
        setReadOverride(new Map());
        fail(res);
      }
    });
  };

  const remove = (msg: InboxMessage) => {
    setError(null);
    setGone((s) => new Set(s).add(msg.id));
    if (demo) return;
    start(async () => {
      const res = await deleteMessage(msg.id);
      if (!res.ok) {
        setGone((s) => {
          const n = new Set(s);
          n.delete(msg.id);
          return n;
        });
        fail(res);
      }
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input = { title, sender, body, subject_id: subjectId };
    const parsed = messageInputSchema.safeParse(input);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const reset = () => {
      setTitle("");
      setSender("");
      setBody("");
      setSubjectId("");
    };
    if (demo) {
      const now = new Date();
      setLocal((l) => [
        {
          id: crypto.randomUUID(),
          source: "manual",
          from: parsed.data.sender,
          subject: parsed.data.title,
          preview: parsed.data.body.replace(/\s+/g, " ").slice(0, 140),
          body: parsed.data.body,
          date: today,
          time: now.toTimeString().slice(0, 5),
          unread: true,
          subjectId: parsed.data.subject_id || undefined,
        },
        ...l,
      ]);
      return reset();
    }
    start(async () => {
      const res = await addMessage(input);
      if (!res.ok) return fail(res);
      reset();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <section aria-label={getMessages().nav.inbox} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted" aria-live="polite">
            {t.unreadCount(unreadCount)}
          </p>
          <div className="flex gap-2">
            <Button variant={onlyUnread ? "primary" : "secondary"} size="sm" aria-pressed={onlyUnread} onClick={() => setOnlyUnread((v) => !v)}>
              <MailIcon strokeWidth={1.5} aria-hidden /> {t.onlyUnread}
            </Button>
            <Button variant="secondary" size="sm" onClick={readAll} disabled={unreadCount === 0 || pending}>
              <MailCheckIcon strokeWidth={1.5} aria-hidden /> {t.markAllRead}
            </Button>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="flex items-center gap-3 rounded-card border border-border bg-surface p-6 text-sm text-muted">
            <InboxIcon strokeWidth={1.5} className="size-4 shrink-0" aria-hidden /> {onlyUnread ? t.unreadCount(0) : t.empty}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((msg) => {
              const ago = diffDays(msg.date, today);
              const when = ago === 0 ? msg.time : ago === 1 ? getMessages().common.daysAgo(1) : formatShortDate(msg.date);
              const SourceIcon = msg.source === "registro" ? NotebookTabsIcon : MailIcon;
              const isOpen = open === msg.id;
              const subject = msg.subjectId ? subjectById.get(msg.subjectId) : undefined;
              const text = msg.body ?? msg.preview;
              return (
                <li key={msg.id}>
                  <Card className="gap-0 p-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggle(msg)}
                        aria-expanded={isOpen}
                        aria-controls={`msg-${msg.id}`}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-control px-2 text-left hover:bg-surface-2"
                      >
                        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                          <SourceIcon strokeWidth={1.5} className="size-4" aria-hidden />
                          {msg.unread && (
                            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface bg-accent">
                              <span className="sr-only">{t.unread}</span>
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-sm", msg.unread ? "font-semibold" : "font-medium")}>{msg.subject}</span>
                          <span className="block truncate text-xs text-muted">{[msg.from, subject?.name, src[msg.source]].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span className="tabular shrink-0 text-xs text-muted">{when}</span>
                        <ChevronDownIcon strokeWidth={1.5} className={cn("size-4 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden />
                      </button>
                    </div>
                    {isOpen && (
                      <div id={`msg-${msg.id}`} className="flex flex-col gap-3 px-3 pt-2 pb-2">
                        {text ? <p className="text-sm break-words whitespace-pre-wrap">{text}</p> : <p className="text-sm text-muted">{t.noBody}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setRead(msg.id, !msg.unread)}>
                            {msg.unread ? t.markRead : t.markUnread}
                          </Button>
                          <Button variant="ghost" size="sm" aria-label={t.remove(msg.subject)} onClick={() => remove(msg)} disabled={pending}>
                            <Trash2Icon strokeWidth={1.5} aria-hidden /> {t.delete}
                          </Button>
                          <Badge className="ml-auto self-center">{src[msg.source]}</Badge>
                        </div>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
        {error && <FormMessage tone="error">{error}</FormMessage>}
      </section>

      <Card aria-labelledby="msg-add-title">
        <CardHeader>
          <PlusIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
          <CardTitle id="msg-add-title">{t.addTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <Field label={t.subjectLabel} htmlFor="m-title">
              <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.subjectPlaceholder} maxLength={200} />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t.sender} htmlFor="m-sender">
                <Input id="m-sender" value={sender} onChange={(e) => setSender(e.target.value)} placeholder={t.senderPlaceholder} maxLength={120} />
              </Field>
              <Field label={t.schoolSubject} htmlFor="m-subject">
                <Select id="m-subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">{t.noSubject}</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label={t.body} htmlFor="m-body" hint={t.manualNote}>
              <textarea
                id="m-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t.bodyPlaceholder}
                maxLength={4000}
                rows={5}
                className="min-h-28 w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted/80 hover:border-muted/50 focus-visible:border-accent-text"
              />
            </Field>
            <div>
              <Button type="submit" variant="primary" disabled={pending}>
                <PlusIcon strokeWidth={1.5} aria-hidden /> {t.add}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
