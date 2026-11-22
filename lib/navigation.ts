import {
  BellIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChartLineIcon,
  GraduationCapIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  type LucideIcon,
  PlugIcon,
  SchoolIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";
import type { Messages } from "@/lib/i18n";

export type NavKey = Exclude<keyof Messages["nav"], "groups" | "more" | "moreTitle" | "collapse" | "expand" | "primary" | "mobile">;

export interface NavItem {
  key: NavKey;
  href: `/${string}`;
  icon: LucideIcon;
  group: keyof Messages["nav"]["groups"];
  /** Voce fissa nella barra inferiore su smartphone. */
  mobile?: boolean;
  /** Pagina già realizzata; le altre mostrano "In arrivo". */
  ready?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboardIcon, group: "main", mobile: true, ready: true },
  { key: "mySchool", href: "/my-school", icon: SchoolIcon, group: "main", mobile: true },
  { key: "inbox", href: "/inbox", icon: InboxIcon, group: "main", mobile: true },
  { key: "assistant", href: "/assistant", icon: SparklesIcon, group: "main", ready: true },
  { key: "grades", href: "/grades", icon: GraduationCapIcon, group: "study", ready: true },
  { key: "analytics", href: "/analytics", icon: ChartLineIcon, group: "study" },
  { key: "subjects", href: "/subjects", icon: BookOpenIcon, group: "study", ready: true },
  { key: "tasks", href: "/tasks", icon: ListChecksIcon, group: "study", mobile: true },
  { key: "calendar", href: "/calendar", icon: CalendarDaysIcon, group: "study" },
  { key: "timetable", href: "/timetable", icon: CalendarClockIcon, group: "study" },
  { key: "notifications", href: "/notifications", icon: BellIcon, group: "system" },
  { key: "integrations", href: "/integrations", icon: PlugIcon, group: "system" },
  { key: "settings", href: "/settings", icon: SettingsIcon, group: "system", ready: true },
];

export const NAV_GROUPS = ["main", "study", "system"] as const;

/** Ordine della barra inferiore mobile: Dashboard, My School, Compiti, Inbox, Altro. */
export const MOBILE_ITEMS: NavItem[] = ["dashboard", "mySchool", "tasks", "inbox"].map(
  (key) => NAV_ITEMS.find((i) => i.key === key)!,
);

/** Le sezioni non ancora realizzate, servite dalla pagina "In arrivo". */
export const PLACEHOLDER_SLUGS = NAV_ITEMS.filter((i) => !i.ready).map((i) => i.href.slice(1));

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
