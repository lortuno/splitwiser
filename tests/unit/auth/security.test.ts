import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { logIn, resendCode, signUp, verifyCode } from "../../../packages/app/src/api/auth";
import { ApiError } from "../../../packages/app/src/api/client";
import { clearToken, getToken } from "../../../packages/app/src/api/session";
import { formatCountdown } from "../../../packages/app/src/auth/countdown";
import { setLanguage, t, tCount } from "../../../packages/app/src/i18n";
import { errorText, requestErrorText } from "../../../packages/app/src/i18n/errors";

type Call = { url: string; method: string; body: unknown };

const realFetch = globalThis.fetch;
let calls: Call[];

function answer(status: number, body: unknown) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
  clearToken();
  setLanguage("en");
});

afterEach(() => {
  globalThis.fetch = realFetch;
  clearToken();
});

describe("feature 8 requests", () => {
  test("signUp sends the language and keeps no token: the session comes with the code", async () => {
    answer(202, { email: "margot@example.com", code_minutes: 15, resend_in_seconds: 60 });

    expect(await signUp("Margot", "margot@example.com", "long-enough-1", "fr")).toEqual({ email: "margot@example.com", code_minutes: 15, resend_in_seconds: 60 });
    expect(calls[0]).toEqual({ url: expect.stringMatching(/\/auth\/signup$/), method: "POST", body: { display_name: "Margot", email: "margot@example.com", password: "long-enough-1", language: "fr" } });
    expect(getToken()).toBeNull();
  });

  test("verifyCode keeps the token; resendCode sends the language", async () => {
    answer(200, { token: "abc", user: { id: 12, display_name: "Margot", email: "margot@example.com", language: "fr" } });
    expect((await verifyCode("margot@example.com", "123456")).display_name).toBe("Margot");
    expect(calls[0].body).toEqual({ email: "margot@example.com", code: "123456" });
    expect(getToken()).toBe("abc");

    answer(202, { code_minutes: 15, resend_in_seconds: 60 });
    expect(await resendCode("margot@example.com", "es")).toEqual({ code_minutes: 15, resend_in_seconds: 60 });
    expect(calls[1]).toEqual({ url: expect.stringMatching(/\/auth\/resend-code$/), method: "POST", body: { email: "margot@example.com", language: "es" } });
  });

  test("logIn sends the language; 403 unverified and 429 locked come with their params", async () => {
    answer(403, { error: { code: "unverified", message: "Confirm your email first.", params: { code_minutes: 15, resend_in_seconds: 60 } } });
    const unverified = await logIn("paula@example.com", "long-enough-1", "fr").catch((e) => e);
    expect(calls[0].body).toEqual({ email: "paula@example.com", password: "long-enough-1", language: "fr" });
    expect([unverified.code, unverified.params]).toEqual(["unverified", { code_minutes: 15, resend_in_seconds: 60 }]);

    answer(429, { error: { code: "locked", message: "Too many attempts.", params: { minutes: 5 } } });
    const locked = await logIn("ben@example.com", "wrong-3", "en").catch((e) => e);
    expect(requestErrorText(locked)).toBe("Too many attempts. Try again in 5 minutes.");
  });
});

describe("feature 8 texts", () => {
  test("the countdown reads m:ss", () => {
    expect([formatCountdown(59), formatCountdown(5), formatCountdown(0.2), formatCountdown(0), formatCountdown(125)]).toEqual(["0:59", "0:05", "0:01", "0:00", "2:05"]);
  });

  test("code errors by code, with 1 try and 1 minute in the singular", () => {
    const error = (code: string, params?: Record<string, number>) => ({ code, message: "English from the API", params });
    expect(errorText(error("wrong", { tries_left: 2 }), "code")).toBe("This code is wrong. 2 tries left.");
    expect(errorText(error("wrong", { tries_left: 1 }), "code")).toBe("This code is wrong. 1 try left.");
    expect(errorText(error("too_many"), "code")).toBe("Too many wrong codes. Send a new code.");
    expect(errorText(error("expired"), "code")).toBe("This code has expired. Send a new code.");
    expect(tCount("auth.locked", 1)).toBe("Too many attempts. Try again in 1 minute.");
    expect(tCount("verify.intro", 15, { email: "ana@example.com" })).toBe("We sent a 6-digit code to ana@example.com. It is valid for 15 minutes.");
    setLanguage("fr");
    expect(tCount("verify.intro", 15, { email: "margot@example.com" })).toBe("Nous avons envoyé un code à 6 chiffres à margot@example.com. Il est valable 15 minutes.");
    expect(t("verify.resendIn", { time: "0:59" })).toBe("Envoyer un nouveau code dans 0:59");
  });

  test("the card texts for limits, mail and no answer", () => {
    expect(requestErrorText(new ApiError(429, {}, "too_many_requests"))).toBe("Too many requests. Try again later.");
    expect(requestErrorText(new ApiError(503, {}, "mail_unavailable"))).toBe("We could not send the email. Try again in a moment.");
    expect(requestErrorText(new ApiError(401, {}, "invalid_credentials"))).toBe("Email or password is wrong.");
    expect(requestErrorText(new TypeError("Failed to fetch"))).toMatch(/^Could not reach the API at /);
  });
});

describe("the web app's Content-Security-Policy", () => {
  test("scripts only from the app, requests to the app and the API, no plugins, no base", async () => {
    const { contentSecurityPolicy } = await import("../../../packages/app/src/web/contentSecurityPolicy");

    expect(contentSecurityPolicy("http://localhost:8080")).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:8080; object-src 'none'; base-uri 'none'",
    );
  });
});
