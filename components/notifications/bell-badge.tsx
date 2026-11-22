"use client";

import { badgeLabel } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";
import { useNotifications } from "./notifications-provider";

/** Pallino con il numero di notifiche non lette; non si vede se sono zero. */
export function UnreadBadge({ className }: { className?: string }) {
  const { unread } = useNotifications();
  if (unread === 0) return null;
  return (
    <span
      className={cn(
        "tabular inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] leading-none font-semibold text-white",
        className,
      )}
      aria-hidden
    >
      {badgeLabel(unread)}
    </span>
  );
}

/** Testo per gli screen reader (il pallino è aria-hidden). */
export function UnreadSrText() {
  const { unread } = useNotifications();
  if (unread === 0) return null;
  return <span className="sr-only">, {unread === 1 ? "1 non letta" : `${unread} non lette`}</span>;
}
