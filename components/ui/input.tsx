import type * as React from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "h-10 w-full min-w-0 rounded-control border border-border bg-surface px-3 text-sm text-fg transition-colors placeholder:text-muted/80 hover:border-muted/50 focus-visible:border-accent-text disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-critical";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(controlClass, className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(controlClass, "pr-8", className)} {...props} />;
}
