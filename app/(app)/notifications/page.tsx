import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { Skeleton } from "@/components/ui/skeleton";
import { getNotificationState } from "@/lib/data/notifications-data";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.notifications };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Notifications />
    </Suspense>
  );
}

async function Notifications() {
  const m = getMessages();
  const { reminders, allOff } = await getNotificationState();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.nav.notifications}</h1>
        <p className="mt-1 text-sm text-muted">{m.notificationsPage.intro}</p>
      </div>
      <NotificationCenter reminders={reminders} allOff={allOff} />
      <p className="text-xs text-muted">{m.notificationsPage.note}</p>
    </div>
  );
}
