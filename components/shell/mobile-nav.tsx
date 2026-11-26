"use client";

import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { UnreadBadge, UnreadSrText } from "@/components/notifications/bell-badge";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getMessages } from "@/lib/i18n";
import { MOBILE_ITEMS, NAV_GROUPS, NAV_ITEMS, isActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Barra inferiore su smartphone e tablet (< lg): quattro sezioni + "Altro". */
export function MobileNav({ account }: { account?: React.ReactNode }) {
  const m = getMessages();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreActive = !MOBILE_ITEMS.some((i) => isActive(pathname, i.href));

  return (
    <nav
      aria-label={m.nav.mobile}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {MOBILE_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors",
                  active ? "text-accent-text" : "text-muted hover:text-fg",
                )}
              >
                <Icon strokeWidth={active ? 2 : 1.5} className="size-5" />
                <span className={cn(active && "font-medium")}>{m.nav[item.key]}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-1 text-xs transition-colors",
                moreActive ? "text-accent-text" : "text-muted hover:text-fg",
              )}
            >
              <span className="relative">
                <EllipsisIcon strokeWidth={moreActive ? 2 : 1.5} className="size-5" />
                <UnreadBadge className="absolute -top-1.5 -right-2.5" />
              </span>
              <span className={cn(moreActive && "font-medium")}>{m.nav.more}</span>
              <UnreadSrText />
            </SheetTrigger>
            <SheetContent closeLabel={m.common.close} className="px-4 pt-4 pb-6">
              <SheetTitle className="px-2 pb-1 text-base font-semibold">{m.nav.moreTitle}</SheetTitle>
              <SheetDescription className="sr-only">{m.nav.primary}</SheetDescription>
              {NAV_GROUPS.map((group) => (
                <div key={group} className="mt-4">
                  <h3 className="px-2 pb-1 text-xs font-medium text-muted">{m.nav.groups[group]}</h3>
                  <ul className="grid grid-cols-2 gap-1">
                    {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex h-11 items-center gap-2.5 rounded-control px-2.5 text-sm",
                              active ? "bg-surface-2 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                            )}
                          >
                            <Icon strokeWidth={1.5} className={cn("size-[18px]", active && "text-accent-text")} />
                            {m.nav[item.key]}
                            {item.key === "notifications" && (
                              <>
                                <UnreadSrText />
                                <UnreadBadge className="ml-auto" />
                              </>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {account && <div className="mt-6 border-t border-border pt-3">{account}</div>}
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
