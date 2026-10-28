import { en, type MessageKey } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { getLanguage, type Language } from "./language";

export { getLanguage, isLanguage, LANGUAGES, setLanguage, subscribeLanguage, takePickedLanguage, type Language } from "./language";

const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, es, fr };

/** When a count uses the ".one" variant: English and Spanish for exactly 1, French for 0 and 1. */
const USES_ONE: Record<Language, (count: number) => boolean> = {
  en: (count) => count === 1,
  es: (count) => count === 1,
  fr: (count) => count === 0 || count === 1,
};

/** Looks up a UI string in the current language and fills {placeholders}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[getLanguage()][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

type CountKey = "trip.expenseCount" | "trip.peopleCount";

/** "1 expense" / "3 expenses": uses the key's ".one" variant where the language's plural rule says so. */
export function tCount(key: CountKey, count: number): string {
  return t(USES_ONE[getLanguage()](count) ? `${key}.one` : key, { count });
}

/** "2026-06-01" -> "1 Jun 2026" ("1 jun 2026", "1 juin 2026"). */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  return `${day} ${t(`month.${month}` as MessageKey)} ${year}`;
}

/** A UTC timestamp ("2026-10-28T09:15:00Z") as the device's local date: "28 Oct 2026". */
export function formatLocalDate(timestamp: string): string {
  const date = new Date(timestamp);
  return formatDate([date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-"));
}

export function joinNames(names: string[]): string {
  return names.join(", ");
}
