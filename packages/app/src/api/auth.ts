import type { AuthResult, User } from "../dto";
import { request } from "./client";
import { clearToken, setToken } from "./session";

/** Creates an account and keeps its session token. */
export async function signUp(displayName: string, email: string, password: string): Promise<User> {
  const result = await request<AuthResult>("/auth/signup", {
    method: "POST",
    body: { display_name: displayName, email, password },
  });
  setToken(result.token);
  return result.user;
}

/** Logs in and keeps the session token. The API trims and lowercases the email. */
export async function logIn(email: string, password: string): Promise<User> {
  const result = await request<AuthResult>("/auth/login", { method: "POST", body: { email, password } });
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

/** Renames the account; the new name shows on every trip at once. */
export const updateMe = (displayName: string) => request<User>("/me", { method: "PATCH", body: { display_name: displayName } });
