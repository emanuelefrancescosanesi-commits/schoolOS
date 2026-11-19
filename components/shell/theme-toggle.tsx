"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-preferences";
import { getMessages } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/preferences";
import { cn } from "@/lib/utils";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

/** Pulsante a tre stati: Sistema → Chiaro → Scuro. */
export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const m = getMessages();
  const { theme, setTheme } = useTheme();
  const Icon = ICONS[theme];
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const name = m.theme[theme];

  return (
    <Button
      variant="ghost"
      size={withLabel ? "md" : "icon"}
      className={cn(withLabel && "w-full justify-start px-2.5", className)}
      onClick={() => setTheme(next)}
      aria-label={m.theme.switchTo(name)}
      title={m.theme.switchTo(name)}
    >
      <Icon strokeWidth={1.5} className="size-[18px]" />
      {withLabel && <span className="truncate sidebar-collapsed:sr-only">{`${m.theme.label}: ${name}`}</span>}
    </Button>
  );
}
