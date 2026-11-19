import { ArrowUpRightIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function WidgetCard({
  id,
  title,
  icon: Icon,
  href,
  action,
  className,
  contentClassName,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  href?: string;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const m = getMessages();
  const titleId = `widget-${id}-title`;
  return (
    <Card aria-labelledby={titleId} className={cn("h-full", className)}>
      <CardHeader>
        <Icon strokeWidth={1.5} className="size-4 text-muted" aria-hidden />
        <CardTitle id={titleId}>{title}</CardTitle>
        <CardAction>
          {action}
          {href && (
            <Link
              href={href}
              className="inline-flex h-7 items-center gap-1 rounded-control px-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {m.common.seeAll}
              <ArrowUpRightIcon className="size-3.5" aria-hidden />
              <span className="sr-only">: {title}</span>
            </Link>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function SubjectDot({ color, className }: { color: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: `var(--subject-${color})` }}
    />
  );
}

export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-control border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
      <Icon strokeWidth={1.5} className="size-5" aria-hidden />
      <p className="max-w-64">{children}</p>
    </div>
  );
}
