import { MonitorIcon, GraduationCapIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExtensionLink } from "@/components/grades/extension-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.integrations };

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Integrations />
    </Suspense>
  );
}

async function Integrations() {
  const { data } = await getSchoolContext();
  const m = getMessages();
  const t = m.integrationsPage;
  const registro = data.profile.registro;
  const registroLabel = m.onboarding.registri[registro].label;
  const gradeCount = data.grades.length;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.nav.integrations}</h1>
        <p className="mt-1 text-sm text-muted">{t.intro}</p>
      </div>

      <Card aria-labelledby="int-registro">
        <CardHeader>
          <GraduationCapIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
          <CardTitle id="int-registro">{t.registro.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{registroLabel}</span>
            <Badge tone={gradeCount > 0 ? "positive" : "neutral"}>{t.registro.grades(gradeCount)}</Badge>
          </p>
          <p className="text-muted">{t.registro.body}</p>
          <p>
            <Link href="/grades" className="tap-area font-medium text-accent-text underline-offset-4 hover:underline">
              {t.registro.cta}
            </Link>
          </p>
        </CardContent>
      </Card>

      <Card aria-labelledby="int-ext">
        <CardHeader>
          <MonitorIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
          <CardTitle id="int-ext">{t.extension.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted">{t.extension.body}</p>
          {data.isDemo ? <p className="text-muted">{t.extension.demo}</p> : <ExtensionLink />}
        </CardContent>
      </Card>

      <Card aria-labelledby="int-mail">
        <CardHeader>
          <MailIcon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
          <CardTitle id="int-mail">{t.mail.title}</CardTitle>
          <Badge tone="neutral">{t.mail.soon}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted">{t.mail.body}</CardContent>
      </Card>
    </div>
  );
}
