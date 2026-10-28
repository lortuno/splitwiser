import type { User } from "../dto";
import { setLanguage, takePickedLanguage, type Language } from "../i18n";
import { updateMe } from "./auth";
import { ApiError } from "./client";

// A language switched to while logged in that could not be saved yet. It stays on screen and is sent again at every
// screen change; it lives only as long as the running app, so the database decides at the next start.
let pending: Language | null = null;

/**
 * After every start and login: the account's language (the database) is applied. Only a language picked on Login or
 * Sign up during this visit wins, and is recorded on the account first. If recording fails, the stored language is
 * shown.
 */
export async function applyAccountLanguage(who: User): Promise<User> {
  pending = null;
  const picked = takePickedLanguage();
  let account = who;
  if (picked !== null && picked !== who.language) {
    try {
      account = await updateMe({ language: picked });
    } catch {
      // Keep the stored language.
    }
  }
  setLanguage(account.language);
  return account;
}

/** A switch while logged in: shown at once, then saved. Resolves to the updated account, or null when not saved. */
export async function switchLanguage(language: Language): Promise<User | null> {
  setLanguage(language);
  pending = language;
  return savePendingLanguage();
}

/** Sends the pending language again, if there is one. Resolves to the updated account, or null. */
export async function savePendingLanguage(): Promise<User | null> {
  const language = pending;
  if (language === null) {
    return null;
  }
  try {
    const account = await updateMe({ language });
    if (pending === language) {
      pending = null;
    }
    return account;
  } catch (error) {
    // A 401 ends the session (the app shell shows Login); anything else keeps the language for the next try.
    if (error instanceof ApiError && error.status === 401) {
      pending = null;
    }
    return null;
  }
}

/** Logging out forgets an unsaved language. */
export function dropPendingLanguage(): void {
  pending = null;
}

export function pendingLanguage(): Language | null {
  return pending;
}
