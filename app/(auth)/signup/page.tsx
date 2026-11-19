import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { SignUpForm } from "@/components/auth/auth-forms";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().auth.signUp };

export default function SignUpPage() {
  const m = getMessages().auth;
  return (
    <AuthPage title={m.signUpTitle} subtitle={m.signUpSubtitle}>
      <SignUpForm />
    </AuthPage>
  );
}
