import { cn } from "@/lib/utils";

/**
 * Simbolo di SchoolOS: tre barre sfalsate, come righe di un'agenda che
 * convergono in una sola colonna. Disegnato a mano su griglia 24×24.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="24" height="24" rx="7" fill="var(--accent)" />
      <rect x="6" y="6" width="9" height="3" rx="1.5" fill="var(--accent-fg)" />
      <rect x="6" y="10.5" width="12" height="3" rx="1.5" fill="var(--accent-fg)" opacity="0.85" />
      <rect x="9" y="15" width="9" height="3" rx="1.5" fill="var(--accent-fg)" opacity="0.7" />
    </svg>
  );
}

export function Logo({ className, labelClassName }: { className?: string; labelClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-base font-semibold tracking-tight text-fg", labelClassName)}>SchoolOS</span>
    </span>
  );
}
