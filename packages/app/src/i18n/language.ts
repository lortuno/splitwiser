// The app's current language. The account's language (users.language) is the source of truth: the app shell applies
// it at every start and login. The device copy (web localStorage) only covers Login and Sign up, before an account is
// known; iOS and Android keep nothing, like the session token.

export type Language = "en" | "es" | "fr";

/** Each language written in its own language, as the language control shows it. */
export const LANGUAGES: { code: Language; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
];

export const LANGUAGE_KEY = "travel-expenses.language";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.code === value);
}

// Read on every call: localStorage can be missing (native) or throw (blocked storage in a private window).
function store(): KeyValueStore | null {
  try {
    return (globalThis as { localStorage?: KeyValueStore }).localStorage ?? null;
  } catch {
    return null;
  }
}

function deviceLanguage(): Language {
  try {
    const stored = store()?.getItem(LANGUAGE_KEY);
    return isLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

/** Screen readers pronounce the web page in this language. */
function markPage(language: Language): void {
  const page = (globalThis as { document?: { documentElement?: { lang: string } } }).document?.documentElement;
  if (page) {
    page.lang = language;
  }
}

let current: Language = deviceLanguage();
markPage(current);
// A language picked on Login or Sign up during this visit: recorded on the account at login, instead of the stored one.
let picked = false;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

/** Switches every text at once and keeps the choice on the device. `picked` marks a choice made before login. */
export function setLanguage(language: Language, options: { picked?: boolean } = {}): void {
  current = language;
  picked = picked || options.picked === true;
  try {
    store()?.setItem(LANGUAGE_KEY, language);
  } catch {
    // Memory still holds the language for this visit.
  }
  markPage(language);
  listeners.forEach((listener) => listener());
}

/** True once, after a language was picked on Login or Sign up; reading it clears the flag. */
export function takePickedLanguage(): Language | null {
  const result = picked ? current : null;
  picked = false;
  return result;
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
