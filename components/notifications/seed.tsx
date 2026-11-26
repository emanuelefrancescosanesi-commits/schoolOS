import { getNotificationState } from "@/lib/data/notifications-data";
import { NotificationsSync } from "./notifications-provider";

/** Server component senza UI: legge i promemoria e li passa al contatore nel client. */
export async function NotificationsSeed() {
  const { reminders, readIds } = await getNotificationState();
  return <NotificationsSync ids={reminders.map((r) => r.id)} readIds={readIds} />;
}
