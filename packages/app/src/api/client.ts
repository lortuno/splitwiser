import type { FieldErrors } from "../dto";
import { clearToken, getToken } from "./session";

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly fieldErrors: FieldErrors = {},
    /** `error.code` from the API, e.g. "invalid_credentials", "not_a_member". */
    readonly code: string | null = null,
  ) {
    super(`API request failed with status ${status}`);
  }
}

let onUnauthenticated: () => void = () => {};

/** Called when a request that carried a token answers 401: the session has ended, the token is already cleared. */
export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

export async function request<T>(path: string, init: { method?: "GET" | "POST" | "PUT" | "PATCH"; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && token !== null) {
      clearToken();
      onUnauthenticated();
    }
    throw new ApiError(response.status, data?.errors ?? {}, data?.error?.code ?? null);
  }
  return data as T;
}
