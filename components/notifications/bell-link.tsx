"use client";

import { BellIcon } from "lucide-react";
import Link from "next/link";
import { getMessages } from "@/lib/i18n";
import { UnreadBadge, UnreadSrText } from "./bell-badge";

/** Campanella nella barra superiore mobile, con il contatore. */
export function BellLink() {
  const label = getMessages().nav.notifications;
  return (
    <Link
      href="/notifications"
      className="relative inline-flex size-9 pointer-coarse:size-11 items-center justify-center rounded-control text-muted hover:bg-surface-2 hover:text-fg"
    >
      <BellIcon strokeWidth={1.5} className="size-[18px]" aria-hidden />
      <span className="sr-only">{label}</span>
      <UnreadSrText />
      <UnreadBadge className="absolute top-0.5 right-0.5 pointer-coarse:top-1.5 pointer-coarse:right-1.5" />
    </Link>
  );
}
