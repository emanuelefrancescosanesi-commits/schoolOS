import { Skeleton } from "@/components/ui/skeleton";
import { getMessages } from "@/lib/i18n";

/** Stato di caricamento generico mentre una sezione dell'app si apre. */
export default function Loading() {
  const m = getMessages();
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{m.common.loading}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
    </div>
  );
}
