import { FlaskConicalIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMessages } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Intestazione e contenitore comune alle pagine di accesso. */
export function AuthPage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const m = getMessages().auth;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>
      {!isSupabaseConfigured() && (
        <div className="flex flex-col gap-3 rounded-card border border-border bg-accent-soft p-4 text-sm text-accent-text">
          <p className="flex gap-2">
            <FlaskConicalIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            {m.demoNotice}
          </p>
          <Link href="/dashboard" className={buttonVariants({ variant: "primary", size: "sm", className: "self-start" })}>
            {m.exploreDemo}
          </Link>
        </div>
      )}
      <div className="rounded-card border border-border bg-surface p-6">
        <Suspense fallback={<FormSkeleton />}>{children}</Suspense>
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
      <Skeleton className="h-10" />
    </div>
  );
}
