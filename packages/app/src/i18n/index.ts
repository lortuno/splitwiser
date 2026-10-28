import { en, type MessageKey } from "./en";

const messages: Record<MessageKey, string> = en;

/** Looks up a UI string and fills {placeholders}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

type CountKey = "trip.expenseCount" | "trip.peopleCount";

/** "1 expense" / "3 expenses": uses the key's ".one" variant for a count of 1. */
export function tCount(key: CountKey, count: number): string {
  return count === 1 ? t(`${key}.one`) : t(key, { count });
}

/** "2026-06-01" -> "1 Jun 2026". */
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
