import { Suspense } from "react";
import { AccountMenu } from "@/components/shell/account-menu";
import { AppShell } from "@/components/shell/app-shell";
import { OnboardingGate } from "@/components/shell/onboarding-gate";
import { getDataMode } from "@/lib/data/school-data";

export default function AppLayout({ children }: LayoutProps<"/">) {
  const live = getDataMode() === "live";
  return (
    <AppShell
      isDemo={!live}
      account={
        live ? (
          <Suspense fallback={null}>
            <AccountMenu />
          </Suspense>
        ) : null
      }
    >
      {live ? (
        <Suspense fallback={null}>
          <OnboardingGate>{children}</OnboardingGate>
        </Suspense>
      ) : (
        children
      )}
    </AppShell>
  );
}
