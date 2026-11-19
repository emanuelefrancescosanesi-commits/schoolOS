import { type Messages, it } from "./it";

export type Locale = "it";

export const DEFAULT_LOCALE: Locale = "it";

/** BCP 47 per Intl (date, numeri). */
export const INTL_LOCALE: Record<Locale, string> = { it: "it-IT" };

const dictionaries: Record<Locale, Messages> = { it };

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return dictionaries[locale];
}

export type { Messages };
