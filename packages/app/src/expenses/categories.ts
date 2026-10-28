// The icon of each category. Display only: the API decides which category an expense has.
import type { Category } from "../dto";
import { t } from "../i18n";

/** In the form's order. Emoji render in the platform font, so no icon package is needed. */
export const CATEGORIES: { code: Category; icon: string }[] = [
  { code: "food", icon: "🍴" },
  { code: "groceries", icon: "🛒" },
  { code: "drinks", icon: "🍺" },
  { code: "coffee", icon: "☕" },
  { code: "fuel", icon: "⛽" },
  { code: "transport", icon: "🚕" },
  { code: "flights", icon: "✈️" },
  { code: "lodging", icon: "🏨" },
  { code: "activities", icon: "🎟️" },
  { code: "shopping", icon: "🛍️" },
  { code: "other", icon: "🧾" },
];

export function categoryIcon(code: Category): string {
  return CATEGORIES.find((c) => c.code === code)?.icon ?? "🧾";
}

export function categoryLabel(code: Category): string {
  return t(`category.${code}`);
}
