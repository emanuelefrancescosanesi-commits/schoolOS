"use client";

import { FileUpIcon, LoaderCircleIcon, ScanTextIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { confirmImport, previewImport } from "@/app/(app)/grades/import/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Select } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { RegistryConnect } from "@/components/grades/registry-connect";
import { ExtensionLink } from "@/components/grades/extension-link";
import { type DateKey, isDateKey } from "@/lib/domain/dates";
import { type GradingScale, formatGrade, parseGrade } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import { buildBookmarklet, readImportHash } from "@/lib/import/bookmarklet";
import { MAX_IMAGE_BYTES, MAX_TEXT_CHARS } from "@/lib/import/input";
import { readScreenshot } from "@/lib/import/ocr";
import type { GradeKind, ImportRow } from "@/lib/import/normalize";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  today: DateKey;
  scale: GradingScale;
  subjects: Subject[];
}

type Draft = ImportRow & { selected: boolean };

/** Una riga è importabile quando materia, voto e data sono validi per lo studente. */
function problem(row: Draft, scale: GradingScale, today: DateKey, hasSubject: (id: string) => boolean): string | null {
  if (!row.subjectId || !hasSubject(row.subjectId)) return "Scegli la materia";
  const parsed = parseGrade(row.valueText, scale);
  if (!parsed.ok) return "Voto non valido per la tua scala";
  if (!row.date || !isDateKey(row.date)) return "Data non valida";
  if (row.date > today) return "La data è nel futuro";
  return null;
}

export function ImportCard({ today, scale, subjects }: Props) {
  const m = getMessages().grades.import;
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [ocr, setOcr] = useState<{ busy: boolean; progress: number; note: string | null }>({ busy: false, progress: 0, note: null });
  const subjectIds = new Set(subjects.map((s) => s.id));

  const reset = () => {
    setRows(null);
    setError(null);
    setOcr({ busy: false, progress: 0, note: null });
    form.current?.reset();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > MAX_IMAGE_BYTES) return setError("L'immagine è troppo grande (massimo 4 MB).");
    setOcr({ busy: true, progress: 0, note: null });
    try {
      const text = await readScreenshot(file, (progress) => setOcr((o) => ({ ...o, progress })));
      if (textRef.current) textRef.current.value = text;
      setOcr({ busy: false, progress: 1, note: text ? m.ocrDone : m.ocrEmpty });
    } catch {
      setOcr({ busy: false, progress: 0, note: null });
      setError(m.ocrFailed);
    }
    e.target.value = "";
  };

  const analyze = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    analyzeText(textRef.current?.value ?? "");
  };

  const analyzeText = (text: string) => {
    setError(null);
    setDone(null);
    // Lo screenshot è già stato letto sul dispositivo: al server arriva solo il testo.
    const data = new FormData();
    data.set("text", text);
    startTransition(async () => {
      const result = await previewImport(data);
      if (!result.ok) {
        setError(result.error === "demo" ? m.unavailableDemo : result.error);
        return;
      }
      setRows(result.rows.map((r) => ({ ...r, selected: r.status === "ready" })));
    });
  };

  // Testo portato dal segnalibro: lo togliamo subito dall'indirizzo e lo analizziamo.
  useEffect(() => {
    const text = readImportHash(window.location.hash);
    if (!text) return;
    const id = setTimeout(() => {
      history.replaceState(null, "", window.location.pathname + window.location.search);
      setOpen(true);
      setOcr({ busy: false, progress: 0, note: m.bookmarkletReceived });
      analyzeText(text);
    }, 0);
    return () => clearTimeout(id);
    // Solo al primo caricamento: il segnalibro apre sempre la pagina da zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [copied, setCopied] = useState(false);
  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(buildBookmarklet(window.location.origin));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError(m.copyFailed);
    }
  };

  const update = (key: string, patch: Partial<Draft>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);

  const importable = rows?.filter((r) => r.selected && !problem(r, scale, today, (id) => subjectIds.has(id))) ?? [];

  const confirm = () => {
    if (!rows) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmImport(
        importable.map((r) => ({
          subject_id: r.subjectId,
          value: r.valueText,
          date: r.date,
          kind: r.kind,
          description: r.description,
        })),
      );
      if (!result.ok) {
        setError(result.error === "demo" ? m.unavailableDemo : result.error);
        return;
      }
      setDone(m.done(result.imported, result.skipped));
      reset();
    });
  };

  return (
    <Card aria-labelledby="import-title">
      <CardHeader>
        <ScanTextIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
        <CardTitle id="import-title">{m.title}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          aria-expanded={open}
          aria-controls="import-body"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Chiudi" : "Apri"}
        </Button>
      </CardHeader>
      {open && (
        <CardContent id="import-body" className="flex flex-col gap-4">
          {done && <FormMessage tone="notice">{done}</FormMessage>}

          {!rows ? (
            <form ref={form} onSubmit={analyze} className="flex flex-col gap-4">
              <RegistryConnect />
              <p className="text-sm text-muted">{m.intro}</p>
              <Field label={m.textLabel} htmlFor="import-text">
                <textarea
                  id="import-text"
                  ref={textRef}
                  name="text"
                  rows={6}
                  maxLength={MAX_TEXT_CHARS}
                  placeholder={m.textPlaceholder}
                  className="min-h-32 w-full rounded-control border border-border bg-surface p-3 text-sm text-fg placeholder:text-muted/80 hover:border-muted/50 focus-visible:border-accent-text"
                />
              </Field>
              <Field label={m.fileLabel} htmlFor="import-file" hint={m.fileHint}>
                <Input
                  id="import-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="h-auto py-2"
                  disabled={ocr.busy}
                  onChange={onFile}
                />
              </Field>
              {ocr.busy && (
                <p role="status" className="flex items-center gap-2 text-sm text-muted">
                  <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
                  {m.ocrReading(Math.round(ocr.progress * 100))}
                </p>
              )}
              {ocr.note && <FormMessage tone="notice">{ocr.note}</FormMessage>}
              <p className="text-xs text-muted">{m.privacy}</p>
              <details className="rounded-control border border-border p-3 text-sm">
                <summary className="cursor-pointer font-medium">{m.bookmarkletTitle}</summary>
                <div className="mt-3 flex flex-col gap-3 text-muted">
                  <p>{m.bookmarkletIntro}</p>
                  <ol className="list-decimal space-y-1 pl-5">
                    {m.bookmarkletSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div>
                    <Button onClick={copyBookmarklet}>{copied ? m.copied : m.copyBookmarklet}</Button>
                  </div>
                  <p className="text-xs">{m.bookmarkletPrivacy}</p>
                </div>
              </details>
              <ExtensionLink />
              {error && <FormMessage tone="error">{error}</FormMessage>}
              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={pending || ocr.busy}>
                  {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <FileUpIcon strokeWidth={1.5} />}
                  {pending ? m.analyzing : m.analyze}
                </Button>
                <span className="text-xs text-muted">{m.limit}</span>
              </div>
            </form>
          ) : rows.length === 0 ? (
            <div className="flex flex-col gap-3">
              <FormMessage tone="notice">{m.none}</FormMessage>
              <div>
                <Button onClick={reset}>{m.back}</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-base font-medium">{m.reviewTitle(rows.length)}</h3>
                <p className="mt-1 text-sm text-muted">{m.reviewHint}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {rows.map((r) => {
                  const issue = problem(r, scale, today, (id) => subjectIds.has(id));
                  const parsed = parseGrade(r.valueText, scale);
                  const label = `${r.subjectGuess} ${r.valueText}`;
                  return (
                    <li
                      key={r.key}
                      className={cn(
                        "grid grid-cols-[auto_1fr] items-start gap-3 rounded-control border border-border p-3",
                        r.status === "duplicate" && "opacity-70",
                      )}
                    >
                      <Checkbox
                        checked={r.selected && !issue}
                        disabled={Boolean(issue)}
                        onCheckedChange={(v) => update(r.key, { selected: v === true })}
                        aria-label={m.include(label)}
                        className="mt-2.5"
                      />
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.3fr_0.6fr_0.9fr_0.8fr]">
                        <Select
                          aria-label={`${m.chooseSubject}: ${r.subjectGuess}`}
                          className="col-span-2 sm:col-span-1"
                          value={r.subjectId ?? ""}
                          onChange={(e) => update(r.key, { subjectId: e.target.value || null, selected: true })}
                          aria-invalid={!r.subjectId}
                        >
                          <option value="">{m.chooseSubject}</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                        <Input
                          aria-label={`${m.grade}: ${r.subjectGuess}`}
                          value={r.valueText}
                          inputMode="decimal"
                          className="tabular"
                          aria-invalid={!parsed.ok}
                          onChange={(e) => update(r.key, { valueText: e.target.value, selected: true })}
                        />
                        <Input
                          aria-label={`${m.date}: ${r.subjectGuess}`}
                          type="date"
                          max={today}
                          value={r.date ?? ""}
                          aria-invalid={!r.date}
                          onChange={(e) => update(r.key, { date: e.target.value || null, selected: true })}
                        />
                        <Select
                          aria-label={`${m.kind}: ${r.subjectGuess}`}
                          value={r.kind}
                          onChange={(e) => update(r.key, { kind: e.target.value as GradeKind })}
                        >
                          <option value="written">Scritto</option>
                          <option value="oral">Orale</option>
                          <option value="practical">Pratico</option>
                        </Select>
                        {(issue || r.status === "duplicate") && (
                          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-4">
                            {issue ? (
                              <Badge tone="critical">{issue}</Badge>
                            ) : (
                              <Badge tone="warning">{m.duplicate}</Badge>
                            )}
                            {parsed.ok && <span className="text-xs text-muted">{formatGrade(parsed.value, scale)}</span>}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {error && <FormMessage tone="error">{error}</FormMessage>}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" onClick={confirm} disabled={pending || importable.length === 0}>
                  {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : null}
                  {pending ? m.confirming : m.confirm(importable.length)}
                </Button>
                <Button variant="ghost" onClick={reset} disabled={pending}>
                  {m.back}
                </Button>
                <span className="text-xs text-muted">{m.selected(importable.length)}</span>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
