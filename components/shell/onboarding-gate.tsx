import { requireOnboardedUser } from "@/lib/data/session";

/**
 * Protegge le pagine dell'app: senza sessione rimanda al login, senza onboarding
 * completato rimanda all'onboarding. Il proxy fa già un controllo ottimistico;
 * questo è quello definitivo, vicino ai dati.
 */
export async function OnboardingGate({ children }: { children: React.ReactNode }) {
  await requireOnboardedUser();
  return <>{children}</>;
}
