import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { ApiError, request, setUnauthenticatedHandler } from "../../../packages/app/src/api/client";
import { clearToken, getToken, setToken } from "../../../packages/app/src/api/session";

type Call = { url: string; headers: Record<string, string>; method: string };

const realFetch = globalThis.fetch;
let calls: Call[];
let unauthenticated: number;

/** Replaces fetch with one that records the request and answers with the given status and JSON body. */
function answer(status: number, body: unknown) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: (init.headers ?? {}) as Record<string, string>, method: init.method ?? "GET" });
    return new Response(body === null ? null : JSON.stringify(body), { status });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  unauthenticated = 0;
  clearToken();
  setUnauthenticatedHandler(() => unauthenticated++);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  clearToken();
});

describe("request", () => {
  test("sends the token as a Bearer header when logged in", async () => {
    setToken("abc");
    answer(200, { ok: true });

    await request("/me");

    expect(calls[0].headers.Authorization).toBe("Bearer abc");
  });

  test("sends no Authorization header when logged out", async () => {
    answer(200, []);

    await request("/auth/login", { method: "POST", body: { email: "a", password: "b" } });

    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
  });

  test("a 401 with a token clears it and reports the ended session", async () => {
    setToken("expired");
    answer(401, { error: { code: "unauthenticated", message: "Please log in." } });

    const error = await request("/trips").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("unauthenticated");
    expect(getToken()).toBeNull();
    expect(unauthenticated).toBe(1);
  });

  test("a 401 without a token (wrong password at login) is not an ended session", async () => {
    answer(401, { error: { code: "invalid_credentials", message: "Email or password is wrong." } });

    const error = (await request("/auth/login", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(401);
    expect(error.code).toBe("invalid_credentials");
    expect(unauthenticated).toBe(0);
  });

  test("a 403 keeps the token and carries the error code", async () => {
    setToken("abc");
    answer(403, { error: { code: "not_a_member", message: "You are not a member of this trip." } });

    const error = (await request("/trips/7").catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(403);
    expect(error.code).toBe("not_a_member");
    expect(getToken()).toBe("abc");
    expect(unauthenticated).toBe(0);
  });

  test("422 field errors are passed on", async () => {
    answer(422, { errors: { email: { code: "taken", message: "This email already has an account." } } });

    const error = (await request("/auth/signup", { method: "POST", body: {} }).catch((e: unknown) => e)) as ApiError;

    expect(error.fieldErrors.email.code).toBe("taken");
  });

  test("a 204 without a body resolves", async () => {
    setToken("abc");
    answer(204, null);

    expect(await request("/auth/logout", { method: "POST" })).toBeNull();
  });
});
