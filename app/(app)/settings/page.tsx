import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { DeleteAccount } from "@/components/settings/delete-account";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/data/session";
import { getMessages } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: getMessages().nav.settings };

export default async function SettingsPage() {
  const m = getMessages().settings;
  const demo = !isSupabaseConfigured();
  const user = demo ? null : await getCurrentUser();

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
