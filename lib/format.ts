import { type DateKey, dateKeyToDate } from "@/lib/domain/dates";
import { DEFAULT_LOCALE, INTL_LOCALE } from "@/lib/i18n";

const locale = INTL_LOCALE[DEFAULT_LOCALE];

// Le DateKey sono giorni di calendario: si formattano sempre in UTC per non slittare.
const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" });

const longDay = fmt({ weekday: "long", day: "numeric", month: "long" });
const shortWeekday = fmt({ weekday: "short" });
const dayMonth = fmt({ day: "numeric", month: "short" });
const shortDate = fmt({ day: "numeric", month: "short" });

/** "giovedì 19 novembre" */
export function formatLongDay(key: DateKey): string {
  return longDay.format(dateKeyToDate(key));
}

/** "gio" */
export function formatWeekdayShort(key: DateKey): string {
  return shortWeekday.format(dateKeyToDate(key)).replace(".", "");
}

/** "19 nov" */
export function formatDayMonth(key: DateKey): string {
  return dayMonth.format(dateKeyToDate(key));
}

export function formatShortDate(key: DateKey): string {
  return shortDate.format(dateKeyToDate(key));
}

export function dayOfMonth(key: DateKey): number {
  return Number(key.slice(8, 10));
}

export function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
