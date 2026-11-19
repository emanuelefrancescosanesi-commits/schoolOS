import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { Logo } from "@/components/shell/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_TIME_ZONE, getDataMode } from "@/lib/data/school-data";
import { getProfile, requireUser } from "@/lib/data/session";
import { dateKeyInTimeZone } from "@/lib/domain/dates";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().onboarding.title };

export default function OnboardingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center px-6">
        <Logo />
      </header>
      <main id="contenuto" className="flex flex-1 justify-center px-4 pt-[4vh] pb-16">
        <div className="w-full max-w-xl">
          <Suspense fallback={<WizardSkeleton />}>
            <Onboarding />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function Onboarding() {
  await connection();
  const demo = getDataMode() === "demo";
  let firstName = "";
  let timeZone = DEFAULT_TIME_ZONE;

  if (!demo) {
    const user = await requireUser("/onboarding");
    const profile = await getProfile(user.id);
    if (profile?.onboarding_completed_at) redirect("/dashboard");
    firstName = profile?.first_name ?? "";
    timeZone = profile?.time_zone ?? DEFAULT_TIME_ZONE;
  }

  return <OnboardingWizard demo={demo} today={dateKeyInTimeZone(new Date(), timeZone)} initialFirstName={firstName} />;
}

function WizardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
