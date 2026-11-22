"use client";

import { CheckIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

interface Props extends Omit<React.ComponentProps<"button">, "onChange" | "role" | "aria-checked"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Classi del cerchio visibile (bordo/colore per priorità). */
  ringClassName?: string;
}

/**
 * Spunta con area di tocco di 44×44 px (minimo per il pollice), anche se il cerchio disegnato è
 * più piccolo. Il margine negativo non allarga la riga: l'area extra si sovrappone allo spazio vuoto.
 */
export function TouchCheck({ checked, onCheckedChange, ringClassName, className, ...props }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      onClick={() => onCheckedChange(!checked)}
      className={cn("group -m-[11px] grid size-11 shrink-0 place-items-center rounded-full", className)}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-[22px] place-items-center rounded-full border-2 border-muted/60 bg-surface transition-colors duration-150",
          "group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent group-data-[state=checked]:text-accent-fg",
          ringClassName,
        )}
      >
        {checked && <CheckIcon className="size-3.5" strokeWidth={2.5} />}
      </span>
    </button>
  );
}
