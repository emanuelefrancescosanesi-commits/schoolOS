import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton({ className, lines = 4 }: { className?: string; lines?: number }) {
  return (
    <div className={`rounded-card border border-border bg-surface p-5 ${className ?? ""}`}>
      <Skeleton className="mb-5 h-4 w-28" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    </div>
  );
}

/** Stato di caricamento della Dashboard: stessa griglia, niente salti di layout. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CardSkeleton className="md:col-span-2 xl:row-span-2" lines={8} />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton className="md:col-span-2" lines={3} />
        <CardSkeleton className="md:col-span-2 xl:col-span-1" />
      </div>
    </div>
  );
}
