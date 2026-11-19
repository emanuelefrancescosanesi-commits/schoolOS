import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().auth.resetTitle };

/** Raggiunta dal link di recupero: la sessione di recupero l'ha già aperta /auth/confirm. */
export default function ResetPasswordPage() {
  const m = getMessages().auth;
  return (
    <AuthPage title={m.resetTitle} subtitle={m.passwordHint}>
      <ResetPasswordForm />
    </AuthPage>
  );
}
