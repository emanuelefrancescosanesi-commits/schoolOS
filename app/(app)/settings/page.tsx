import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ExtensionLink } from "@/components/grades/extension-link";
import { EmailForm, PasswordForm, SignOutEverywhere } from "@/components/settings/account-security";
import { DeleteAccount } from "@/components/settings/delete-account";
import { NotificationsForm } from "@/components/settings/notifications-form";
import { PeriodsForm } from "@/components/settings/periods-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { ScaleForm } from "@/components/settings/scale-form";
import { ThemePicker } from "@/components/settings/theme-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/data/session";
import type { DateKey } from "@/lib/domain/dates";
import { yearForScheme, schoolYearStart } from "@/lib/validation/onboarding-defaults";
import { getMessages } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: getMessages().nav.settings };

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" aria-busy="true" />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const m = getMessages().settings;
  const demo = !isSupabaseConfigured();
  const user = demo ? null : await getCurrentUser();
  // Chi è entrato solo con Google non ha una password da verificare.
  const hasPassword = demo
    ? true
    : ((await (await createClient()).auth.getUser()).data.user?.identities ?? []).some((i) => i.provider === "email");
  const { data, today, schoolYear } = await getSchoolContext();
  const { profile, periods } = data;
  const scheme = profile.periodScheme;
  const fallbackYear = yearForScheme(scheme, schoolYearStart(today as DateKey));
  const year = {
    period_scheme: scheme,
    school_year: schoolYear
      ? { label: schoolYear.label, starts_on: schoolYear.starts_on, ends_on: schoolYear.ends_on }
      : fallbackYear.school_year,
    periods: periods.length ? periods.map((p) => ({ name: p.name, starts_on: p.start, ends_on: p.end })) : fallbackYear.periods,
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.settings}</h1>
        <p className="mt-1 text-sm text-muted">{m.intro}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{m.accountTitle}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted">{user?.email ?? m.demoAccount}</CardContent>
      </Card>

      <Section title={m.security.passwordTitle} body={m.security.passwordBody}>
        <PasswordForm demo={demo} hasPassword={hasPassword} />
      </Section>

      <Section title={m.security.emailTitle} body={m.security.emailBody}>
        <EmailForm demo={demo} hasPassword={hasPassword} currentEmail={user?.email ?? null} />
      </Section>

      <Section title={m.security.signOutAllTitle} body={m.security.signOutAllBody}>
        <SignOutEverywhere demo={demo} />
      </Section>

      <Section title={m.profileTitle} body={m.profileBody}>
        <ProfileForm
          demo={demo}
          initial={{
            first_name: profile.firstName,
            school_name: profile.schoolName ?? "",
            class_name: profile.className ?? "",
            registro: profile.registro,
          }}
        />
      </Section>

      <Section title={m.scaleTitle} body={m.scaleBody}>
        <ScaleForm
          demo={demo}
          initial={{
            grade_min: profile.scale.min,
            grade_max: profile.scale.max,
            allow_half: profile.scale.allowHalf,
            allow_plus_minus: profile.scale.allowPlusMinus,
            pass_threshold: profile.scale.passThreshold,
            average_method: profile.averageMethod,
          }}
        />
      </Section>

      <Section title={m.periodsTitle} body={m.periodsBody}>
        <PeriodsForm demo={demo} today={today} initial={year} />
      </Section>

      <Section title={m.notificationsTitle} body={m.notificationsBody}>
        <NotificationsForm
          demo={demo}
          initial={{
            notify_overdue: profile.notifications.overdue,
            notify_due_soon: profile.notifications.dueSoon,
            notify_tests: profile.notifications.tests,
            notify_test_days: profile.notifications.testDays,
          }}
        />
      </Section>

      <Section title={m.themeTitle} body={m.themeBody}>
        <ThemePicker />
      </Section>

      <Section title={m.extensionTitle} body={m.extensionBody}>
        {demo ? <span className="text-sm text-muted">{m.demoUnavailable}</span> : <ExtensionLink defaultOpen />}
      </Section>

      <Card>
        <CardHeader>
          <CardTitle>{m.exportTitle}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted">{m.exportBody}</p>
          <div>
            {demo ? (
              <span className="text-sm text-muted">{m.demoUnavailable}</span>
            ) : (
              <a href="/settings/export" download className={buttonVariants({ variant: "secondary" })}>
                <DownloadIcon strokeWidth={1.5} aria-hidden />
                {m.exportButton}
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{m.deleteTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteAccount disabled={demo} />
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <p className="text-sm font-normal text-muted">{body}</p>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
