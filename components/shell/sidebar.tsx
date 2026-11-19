"use client";

import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarCollapsed } from "@/hooks/use-preferences";
import { getMessages } from "@/lib/i18n";
import { NAV_GROUPS, NAV_ITEMS, type NavItem, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

/**
 * Barra laterale desktop (≥ lg). Comprimibile: la larghezza è guidata da
 * `data-sidebar` su <html>, così lo stato salvato si applica prima del paint.
 */
export function Sidebar({ account }: { account?: React.ReactNode }) {
  const m = getMessages();
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const ToggleIcon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;
  const toggleLabel = collapsed ? m.nav.expand : m.nav.collapse;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface sidebar-width transition-[width] duration-200 ease-soft lg:flex">
      <div className="flex h-14 items-center px-[18px]">
        <Link href="/dashboard" className="rounded-control" aria-label={m.meta.appName}>
          <Logo labelClassName="sidebar-collapsed:hidden" />
        </Link>
      </div>

      <nav aria-label={m.nav.primary} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group} className="mb-4 last:mb-0">
            <h2 className="mb-1 h-6 px-2.5 text-xs font-medium leading-6 text-muted sidebar-collapsed:invisible">
              {m.nav.groups[group]}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {NAV_ITEMS.filter((item) => item.group === group).map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} label={m.nav[item.key]} active={isActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border p-3">
        {account}
        <ThemeToggle withLabel />
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="flex h-9 items-center gap-2 rounded-control px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <ToggleIcon strokeWidth={1.5} className="size-[18px] shrink-0" />
          <span className="truncate sidebar-collapsed:sr-only">{m.nav.collapse}</span>
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ item, label, active }: { item: NavItem; label: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group relative flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors duration-150",
            active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />}
          <Icon strokeWidth={1.5} className={cn("size-[18px] shrink-0", active && "text-accent-text")} />
          <span className="truncate sidebar-collapsed:sr-only">{label}</span>
        </Link>
      </TooltipTrigger>
      {/* Il tooltip serve solo a barra compressa, quando l'etichetta non si vede. */}
      <TooltipContent side="right" className="hidden sidebar-collapsed:block">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
