// "Discard your changes?" (specs/translations/06-translations-specification.md): whether the open form holds input that
// differs from how it opened. Forms report it (useUnsavedInput); the app menu asks before "Settings" and "Log out".

let unsaved = false;

// Same input regardless of key order, empty texts versus missing entries, and the order of id lists (a payer unticked
// and ticked again).
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(normalize);
    return items.every((item) => typeof item === "number") ? [...(items as number[])].sort((a, b) => a - b) : items;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== "" && item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
}

/** True when `current` holds the same input as `initial`; a field changed and changed back counts as unchanged. */
export function sameInput(initial: unknown, current: unknown): boolean {
  return JSON.stringify(normalize(initial)) === JSON.stringify(normalize(current));
}

export function setUnsavedInput(value: boolean): void {
  unsaved = value;
}

export function hasUnsavedInput(): boolean {
  return unsaved;
}
