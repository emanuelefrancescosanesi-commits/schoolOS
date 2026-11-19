"use client";

import { PencilIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { renameSubject } from "@/app/(app)/subjects/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/components/ui/label";
import type { Subject } from "@/lib/domain/model";

/** Elenco materie con rinomina in linea: utile per allinearsi ai nomi del registro. */
export function SubjectList({ subjects, demo }: { subjects: Subject[]; demo: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = (s: Subject) => {
    setEditing(s.id);
    setValue(s.name);
    setError(null);
  };

  const save = (id: string) =>
    start(async () => {
      const res = await renameSubject(id, value);
      if (!res.ok) return setError(res.error === "demo" ? "Disponibile con un account." : res.error);
      setEditing(null);
      setError(null);
    });

  return (
    <ul className="flex flex-col gap-2">
      {subjects.map((s) => (
        <li key={s.id}>
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: `var(--subject-${s.color})` }}
              aria-hidden
            />
            {editing === s.id ? (
              <form
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(s.id);
                }}
              >
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  maxLength={60}
                  autoFocus
                  aria-label={`Nome della materia ${s.name}`}
                  className="min-w-40 flex-1"
                />
                <Button type="submit" size="sm" disabled={pending}>
                  Salva
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={pending}>
                  Annulla
                </Button>
                {error && <FormMessage tone="error">{error}</FormMessage>}
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => begin(s)}
                  disabled={demo}
                  aria-label={`Rinomina ${s.name}`}
                >
                  <PencilIcon className="size-4" aria-hidden />
                  Rinomina
                </Button>
              </>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
