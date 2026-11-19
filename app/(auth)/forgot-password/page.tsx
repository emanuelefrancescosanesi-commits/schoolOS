import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().auth.forgotTitle };

export default function ForgotPasswordPage() {
  const m = getMessages().auth;
  return (
    <AuthPage title={m.forgotTitle} subtitle={m.forgotSubtitle}>
      <ForgotPasswordForm />
    </AuthPage>
  );
}
