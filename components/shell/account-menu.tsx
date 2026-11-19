import { LogOutIcon } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/data/session";
import { getMessages } from "@/lib/i18n";

/** Email dell'utente e pulsante di uscita. Legge la sessione: va reso dentro un Suspense. */
export async function AccountMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  const m = getMessages().auth;
  return (
    <form action={signOut} className="flex items-center gap-2 rounded-control px-2.5 py-1">
      <span className="min-w-0 flex-1 truncate text-xs text-muted sidebar-collapsed:sr-only" title={user.email ?? undefined}>
        {user.email}
      </span>
      <button
        type="submit"
        aria-label={m.signOut}
        title={m.signOut}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-fg"
      >
        <LogOutIcon strokeWidth={1.5} className="size-4" />
      </button>
    </form>
  );
}
