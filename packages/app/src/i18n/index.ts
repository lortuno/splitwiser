import { en, type MessageKey } from "./en";

const messages: Record<MessageKey, string> = en;

/** Looks up a UI string and fills {placeholders}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** "2026-06-01" -> "1 Jun 2026". */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  return `${day} ${t(`month.${month}` as MessageKey)} ${year}`;
}

export function joinNames(names: string[]): string {
  return names.join(", ");
}
