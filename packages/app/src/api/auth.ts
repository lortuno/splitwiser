import type { AuthResult, User } from "../dto";
import { request } from "./client";
import { clearToken, setToken } from "./session";

/** Creates an account and keeps its session token. */
export async function signUp(name: string, email: string, password: string): Promise<User> {
  const result = await request<AuthResult>("/auth/signup", { method: "POST", body: { name, email, password } });
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
