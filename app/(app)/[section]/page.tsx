import { ArrowLeftIcon, HourglassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import { NAV_ITEMS, PLACEHOLDER_SLUGS } from "@/lib/navigation";

/** Sezioni previste dal piano ma non ancora realizzate: pagina "In arrivo" onesta. */

export function generateStaticParams() {
  return PLACEHOLDER_SLUGS.map((section) => ({ section }));
}

function itemFor(section: string) {
  return NAV_ITEMS.find((i) => i.href === `/${section}` && !i.ready);
}

export async function generateMetadata({ params }: PageProps<"/[section]">): Promise<Metadata> {
  const { section } = await params;
  const item = itemFor(section);
  return { title: item ? getMessages().nav[item.key] : undefined };
}

export default async function PlaceholderPage({ params }: PageProps<"/[section]">) {
  const { section } = await params;
  const item = itemFor(section);
  if (!item) notFound();

  const m = getMessages();
  const Icon = item.icon;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-card border border-border bg-surface text-accent-text">
        <Icon strokeWidth={1.5} className="size-6" aria-hidden />
      </span>
      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted">
        <HourglassIcon className="size-3.5" aria-hidden />
        {m.placeholder.title}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">{m.nav[item.key]}</h1>
      <p className="mt-3 text-muted">{m.placeholder.descriptions[section]}</p>
      <p className="mt-1 text-sm text-muted">{m.placeholder.body}</p>
      <Link href="/dashboard" className={buttonVariants({ variant: "secondary", className: "mt-8" })}>
        <ArrowLeftIcon strokeWidth={1.5} />
        {m.placeholder.back}
      </Link>
    </div>
  );
}
