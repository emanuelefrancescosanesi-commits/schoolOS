import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { LoginForm } from "@/components/auth/auth-forms";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().auth.signIn };

export default function LoginPage() {
  const m = getMessages().auth;
  return (
    <AuthPage title={m.signInTitle} subtitle={m.signInSubtitle}>
      <LoginForm />
    </AuthPage>
  );
}
