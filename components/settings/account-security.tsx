"use client";

import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { changeEmail, changePassword, signOutEverywhere, type AccountResult } from "@/app/(app)/settings/account-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n";

const m = getMessages().settings.security;

type Status = { tone: "error" | "notice"; text: string } | null;

function useAccountAction(demo: boolean) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const run = (action: () => Promise<AccountResult>, onOk?: () => void) => {
    setStatus(null);
    if (demo) return setStatus({ tone: "notice", text: getMessages().settings.demoNotice });
    start(async () => {
      try {
        const res = await action();
        if (res.ok) {
          setStatus({ tone: "notice", text: res.notice ?? getMessages().settings.saved });
          onOk?.();
        } else setStatus({ tone: "error", text: res.error });
      } catch {
        setStatus({ tone: "error", text: getMessages().settings.errorGeneric });
      }
    });
  };
  return { pending, status, run, clear: () => setStatus(null) };
}

function Submit({ pending, disabled, children }: { pending: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" variant="primary" disabled={pending || disabled}>
      {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function PasswordForm({ demo, hasPassword }: { demo: boolean; hasPassword: boolean }) {
  const [v, setV] = useState({ current: "", password: "", confirm: "" });
  const { pending, status, run, clear } = useAccountAction(demo);
  const set = (patch: Partial<typeof v>) => {
    clear();
    setV((x) => ({ ...x, ...patch }));
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => changePassword(v), () => setV({ current: "", password: "", confirm: "" }));
      }}
      className="flex flex-col gap-4"
    >
      {hasPassword ? (
        <Field label={m.currentPassword} htmlFor="sec-current">
          <Input id="sec-current" type="password" autoComplete="current-password" value={v.current} onChange={(e) => set({ current: e.target.value })} required />
        </Field>
      ) : (
        <p className="text-sm text-muted">{m.noPasswordYet}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={m.newPassword} htmlFor="sec-new" hint={m.passwordHint}>
          <Input id="sec-new" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={v.password} onChange={(e) => set({ password: e.target.value })} required />
        </Field>
        <Field label={m.confirmPassword} htmlFor="sec-confirm">
          <Input id="sec-confirm" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => set({ confirm: e.target.value })} required />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} disabled={!v.password || !v.confirm || (hasPassword && !v.current)}>
          {m.changePasswordButton}
        </Submit>
        <div className="min-w-0 flex-1">{status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}</div>
      </div>
    </form>
  );
}

export function EmailForm({ demo, hasPassword, currentEmail }: { demo: boolean; hasPassword: boolean; currentEmail: string | null }) {
  const [v, setV] = useState({ email: "", current: "" });
  const { pending, status, run, clear } = useAccountAction(demo);
  const set = (patch: Partial<typeof v>) => {
    clear();
    setV((x) => ({ ...x, ...patch }));
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => changeEmail(v), () => setV({ email: "", current: "" }));
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-muted">
        {m.emailNow} <span className="font-medium text-fg">{currentEmail ?? "—"}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={m.newEmail} htmlFor="sec-email">
          <Input id="sec-email" type="email" autoComplete="email" inputMode="email" maxLength={254} value={v.email} onChange={(e) => set({ email: e.target.value })} required />
        </Field>
        {hasPassword && (
          <Field label={m.currentPassword} htmlFor="sec-email-pw">
            <Input id="sec-email-pw" type="password" autoComplete="current-password" value={v.current} onChange={(e) => set({ current: e.target.value })} required />
          </Field>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} disabled={!v.email || (hasPassword && !v.current)}>
          {m.changeEmailButton}
        </Submit>
        <div className="min-w-0 flex-1">{status && <FormMessage tone={status.tone}>{status.text}</FormMessage>}</div>
      </div>
    </form>
  );
}

export function SignOutEverywhere({ demo }: { demo: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button type="button" variant="secondary" disabled={demo || pending} onClick={() => start(() => signOutEverywhere())}>
          {pending ? <LoaderCircleIcon className="animate-spin" aria-hidden /> : <LogOutIcon strokeWidth={1.5} aria-hidden />}
          {m.signOutAllButton}
        </Button>
      </div>
    </div>
  );
}
