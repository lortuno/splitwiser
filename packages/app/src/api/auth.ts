import type { AuthResult, CodeTimes, Debts, SignUpResult, User } from "../dto";
import type { Language } from "../i18n/language";
import { request } from "./client";
import { clearToken, setToken } from "./session";

/**
 * Asks for an account in the given app language; the API emails a code in that language (or "You already have an
 * account"). There is no session until the code is confirmed with verifyCode.
 */
export const signUp = (displayName: string, email: string, password: string, language: Language) =>
  request<SignUpResult>("/auth/signup", { method: "POST", body: { display_name: displayName, email, password, language } });

/** Confirms the code from the email and keeps the new session token. */
export async function verifyCode(email: string, code: string): Promise<User> {
  const result = await request<AuthResult>("/auth/verify", { method: "POST", body: { email, code } });
  setToken(result.token);
  return result.user;
}

/** Asks for a new code, emailed in the given app language. */
export const resendCode = (email: string, language: Language) =>
  request<CodeTimes>("/auth/resend-code", { method: "POST", body: { email, language } });

/**
 * Logs in and keeps the session token. The API trims and lowercases the email. An unverified account answers
 * 403 "unverified" (a new code is on its way, in `language`); the lock answers 429 "locked".
 */
export async function logIn(email: string, password: string, language: Language): Promise<User> {
  const result = await request<AuthResult>("/auth/login", { method: "POST", body: { email, password, language } });
  setToken(result.token);
  return result.user;
}

/** Ends the session on the API; the token is forgotten even when that request fails. */
export async function logOut(): Promise<void> {
  try {
    await request<null>("/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}

export const getMe = () => request<User>("/me");

/** Renames the account (the new name shows on every trip at once) and/or records its app language. */
export const updateMe = (changes: { display_name?: string; language?: Language }) =>
  request<User>("/me", { method: "PATCH", body: changes });

/** What the logged-in user owes and is owed on their open groups ("I owe" / "I'm owed" on My groups). */
export const getDebts = () => request<Debts>("/me/debts");
