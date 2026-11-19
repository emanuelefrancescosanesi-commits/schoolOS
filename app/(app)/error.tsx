"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const m = getMessages();
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-card bg-critical-soft text-critical">
        <TriangleAlertIcon strokeWidth={1.5} className="size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">{m.error.title}</h1>
      <p className="mt-2 text-sm text-muted">{m.error.body}</p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcwIcon strokeWidth={1.5} />
        {m.common.retry}
      </Button>
    </div>
  );
}
