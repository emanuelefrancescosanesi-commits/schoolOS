"use client";

import { LoaderCircleIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";

const m = getMessages().settings;

export function DeleteAccount({ disabled }: { disabled: boolean }) {
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await deleteAccount(phrase);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-muted">{m.deleteWarning}</p>
      <Field label={m.deleteLabel} htmlFor="delete-phrase">
        <Input id="delete-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" disabled={disabled} />
      </Field>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      <div>
        <Button type="submit" disabled={disabled || pending || phrase.trim().toUpperCase() !== "ELIMINA"}>
          {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <Trash2Icon strokeWidth={1.5} aria-hidden />}
          {m.deleteButton}
        </Button>
      </div>
    </form>
  );
}
