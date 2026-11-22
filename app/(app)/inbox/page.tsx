import type { Metadata } from "next";
import { Suspense } from "react";
import { InboxView } from "@/components/inbox/inbox-view";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.inbox };

export default function InboxPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Inbox />
    </Suspense>
  );
}

async function Inbox() {
  const { data, today } = await getSchoolContext();
  const m = getMessages();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.nav.inbox}</h1>
        <p className="mt-1 text-sm text-muted">{m.inboxPage.intro}</p>
      </div>
      <InboxView messages={data.messages} subjects={data.subjects} today={today} demo={data.isDemo} />
    </div>
  );
}
