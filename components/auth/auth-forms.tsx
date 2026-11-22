"use client";

import { LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormMessage } from "@/components/ui/label";
import {
  type AuthFormState,
  requestPasswordReset,
  resendConfirmation,
  signInWithGoogle,
  signInWithPassword,
  signUp,
  updatePassword,
} from "@/lib/auth/actions";
import { getMessages } from "@/lib/i18n";

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="w-full" disabled={pending} aria-disabled={pending}>
      {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

function Messages({ state }: { state: AuthFormState }) {
  const params = useSearchParams();
  const queryError = params.get("error");
  const m = getMessages().auth;
  const error = state.error ?? (queryError ? m.queryErrors[queryError] : undefined);
  return (
    <>
      {error && <FormMessage tone="error">{error}</FormMessage>}
      {state.notice && <FormMessage tone="notice">{state.notice}</FormMessage>}
    </>
  );
}

function GoogleButton() {
  const m = getMessages().auth;
  const next = useSearchParams().get("next") ?? "";
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <Button type="submit" className="w-full">
        <GoogleMark />
        {m.google}
      </Button>
    </form>
  );
}

function ResendButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-disabled={pending}>
      {pending && <LoaderCircleIcon className="animate-spin" aria-hidden />}
      {label}
    </Button>
  );
}

function ResendConfirmation({ email }: { email: string }) {
  const m = getMessages().auth;
  const [state, action] = useActionState(resendConfirmation, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="email" value={email} />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.notice ? (
        <FormMessage tone="notice">{state.notice}</FormMessage>
      ) : (
        <ResendButton label={m.resendConfirmation} />
      )}
    </form>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
      <span className="h-px flex-1 bg-border" />
      {getMessages().auth.or}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LoginForm() {
  const m = getMessages().auth;
  const next = useSearchParams().get("next") ?? "";
  const [state, action] = useActionState(signInWithPassword, {});
  return (
    <div className="flex flex-col gap-5">
      <GoogleButton />
      <Divider />
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Messages state={state} />
        <Field label={m.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={state.fields?.email}
          />
        </Field>
        <Field label={m.password} htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Link href="/forgot-password" className="-mt-1 self-end text-xs text-accent-text hover:underline">
          {m.forgot}
        </Link>
        <SubmitButton>{m.signIn}</SubmitButton>
      </form>
      {state.needsConfirmation && state.fields?.email && <ResendConfirmation key={state.fields.email} email={state.fields.email} />}
      <p className="text-center text-sm text-muted">
        {m.noAccount}{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-accent-text hover:underline">
          {m.signUp}
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const m = getMessages().auth;
  const [state, action] = useActionState(signUp, {});
  if (state.notice) {
    return (
      <div className="flex flex-col gap-4">
        <FormMessage tone="notice">{state.notice}</FormMessage>
        <Link href="/login" className="text-center text-sm text-accent-text hover:underline">
          {m.backToLogin}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <GoogleButton />
      <Divider />
      <form action={action} className="flex flex-col gap-4" noValidate>
        <Messages state={state} />
        <Field label={m.firstName} htmlFor="first_name">
          <Input
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            required
            maxLength={60}
            defaultValue={state.fields?.first_name}
          />
        </Field>
        <Field label={m.email} htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={state.fields?.email}
          />
        </Field>
        <Field label={m.password} htmlFor="password" hint={m.passwordHint}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            aria-describedby="password-hint"
          />
        </Field>
        <label className="flex items-start gap-2.5 text-xs text-muted">
          <input type="checkbox" name="consent" required className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
          {m.consent}
        </label>
        <SubmitButton>{m.signUp}</SubmitButton>
      </form>
      <p className="text-center text-sm text-muted">
        {m.haveAccount}{" "}
        <Link href="/login" className="text-accent-text hover:underline">
          {m.signIn}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const m = getMessages().auth;
  const [state, action] = useActionState(requestPasswordReset, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      {!state.notice && (
        <>
          <Field label={m.email} htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </Field>
          <SubmitButton>{m.sendLink}</SubmitButton>
        </>
      )}
      <Link href="/login" className="text-center text-sm text-accent-text hover:underline">
        {m.backToLogin}
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const m = getMessages().auth;
  const [state, action] = useActionState(updatePassword, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Messages state={state} />
      <Field label={m.newPassword} htmlFor="password" hint={m.passwordHint}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label={m.confirmPassword} htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton>{m.savePassword}</SubmitButton>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}
