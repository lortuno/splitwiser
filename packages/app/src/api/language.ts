import type { User } from "../dto";
import { setLanguage, takePickedLanguage } from "../i18n";
import { updateMe } from "./auth";

/**
 * After every start and login: the account's language (the database) is the source of truth and is applied. Only a
 * language picked on Login or Sign up during this visit wins, and is recorded on the account first. If recording fails,
 * the stored language is shown, so the app never shows a language the database does not have.
 */
export async function applyAccountLanguage(who: User): Promise<User> {
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
