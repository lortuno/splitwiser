// The session token. On the web it is kept in localStorage, so a reload stays logged in; iOS and Android have no
// localStorage and keep it in memory only, so a cold start begins at Login (no storage dependency needed).

export const TOKEN_KEY = "travel-expenses.token";

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let token: string | null = null;

// Read on every call: localStorage can be missing (native) or throw (blocked storage in a private window).
function store(): KeyValueStore | null {
  try {
    return (globalThis as { localStorage?: KeyValueStore }).localStorage ?? null;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (token === null) {
    try {
      token = store()?.getItem(TOKEN_KEY) ?? null;
    } catch {
      token = null;
    }
  }
  return token;
}

export function setToken(value: string): void {
  token = value;
  try {
    store()?.setItem(TOKEN_KEY, value);
  } catch {
    // Memory still holds the token for this visit.
  }
}

export function clearToken(): void {
  token = null;
  try {
    store()?.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored that could be removed.
  }
}
