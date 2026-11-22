import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Scelta singola a scheda (radio), condivisa tra onboarding e Impostazioni. */
export function ChoiceCard({
  name,
  value,
  checked,
  onChange,
  label,
  body,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  body: string;
}) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col gap-0.5 rounded-control border px-3.5 py-3 transition-colors",
        checked ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className={cn("text-sm font-medium", checked ? "text-accent-text" : "text-fg")}>{label}</span>
      <span className="text-xs text-muted">{body}</span>
      {checked && <CheckIcon className="absolute top-3 right-3 size-4 text-accent-text" aria-hidden />}
    </label>
  );
}

/** Interruttore accessibile (checkbox con role=switch). */
export function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 py-1">
      <span className="text-sm">{label}</span>
      <span className="relative inline-flex">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-10 rounded-full bg-surface-2 ring-1 ring-border transition-colors peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-text" />
        <span className="absolute top-1 left-1 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}
