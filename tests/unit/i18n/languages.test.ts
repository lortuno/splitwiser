import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  applyAccountLanguage,
  dropPendingLanguage,
  pendingLanguage,
  savePendingLanguage,
  switchLanguage,
} from "../../../packages/app/src/api/language";
import { signUp, updateMe } from "../../../packages/app/src/api/auth";
import { clearToken, setToken } from "../../../packages/app/src/api/session";
import type { User } from "../../../packages/app/src/dto";
import { formatDate, getLanguage, setLanguage, t, takePickedLanguage, tCount } from "../../../packages/app/src/i18n";
import { errorText } from "../../../packages/app/src/i18n/errors";
import { LANGUAGE_KEY } from "../../../packages/app/src/i18n/language";

const NBSP = "\u00A0";
const realFetch = globalThis.fetch;
let calls: { url: string; method: string; body: unknown }[];

function answer(status: number, body: unknown) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body === undefined ? undefined : JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

const ana = (language: User["language"]): User => ({ id: 1, display_name: "Ana", email: "ana@example.com", language });

beforeEach(() => {
  calls = [];
  setToken("abc");
  takePickedLanguage();
  setLanguage("en");
});

afterEach(() => {
  globalThis.fetch = realFetch;
  dropPendingLanguage();
  delete (globalThis as { localStorage?: unknown }).localStorage;
  clearToken();
  takePickedLanguage();
  setLanguage("en");
});

describe("plurals and dates per language", () => {
  test("French uses the singular for 0 and 1, English and Spanish only for 1", () => {
    const counts = (lang: "en" | "es" | "fr") => {
      setLanguage(lang);
      return [0, 1, 20].map((n) => tCount("trip.expenseCount", n));
    };
    expect(counts("en")).toEqual(["0 expenses", "1 expense", "20 expenses"]);
    expect(counts("es")).toEqual(["0 gastos", "1 gasto", "20 gastos"]);
    expect(counts("fr")).toEqual(["0 dépense", "1 dépense", "20 dépenses"]);
  });

  test("dates keep day month year with the language's months", () => {
    expect(["en", "es", "fr"].map((lang) => (setLanguage(lang as "en"), formatDate("2026-06-01")))).toEqual([
      "1 Jun 2026", "1 jun 2026", "1 juin 2026",
    ]);
    setLanguage("fr");
    expect(formatDate("2026-10-28")).toBe("28 oct. 2026");
  });
});

describe("error texts from code and params", () => {
  const error = (code: string, params?: Record<string, number>) => ({ code, message: "English from the API", params });

  test("one key per code, with the field only deciding fill-in versus choose-a-person", () => {
    expect(errorText(error("required"), "name")).toBe("Fill in this field.");
    expect(errorText(error("required"), "display_name")).toBe("Fill in this field.");
    expect(errorText(error("required"), "paid_by")).toBe("Choose at least one person.");
    expect(errorText(error("required"), "split")).toBe("Choose at least one person.");
    expect(errorText(error("invalid_amount"), "paid_by.12")).toBe("Enter an amount greater than 0.");
    expect(errorText(error("duplicate"), "people.3.name")).toBe("This is already on the group.");
    expect(errorText(error("duplicate_email"), "people.0.email")).toBe("This is already on the group.");
    expect(errorText(error("duplicate"), "paid_by")).toBe("Check this field.");
  });

  test("params fill the placeholders, amounts formatted by the app", () => {
    expect(errorText(error("too_long", { max: 80 }), "name")).toBe("Use at most 80 characters.");
    expect(errorText(error("too_short", { min: 8 }), "password")).toBe("Use at least 8 characters.");
    expect(errorText(error("too_many", { max: 20 }), "people")).toBe("A group can have at most 20 people.");
    expect(errorText(error("sum_mismatch", { sum_cents: 4500, amount_cents: 5000 }), "paid_by")).toBe(
      `Amounts add up to 45,00${NBSP}€ but the expense is 50,00${NBSP}€.`,
    );
    expect(errorText(error("sum_mismatch", { sum_basis_points: 9000, total_basis_points: 10000 }), "split")).toBe(
      `Percentages add up to 90,00${NBSP}% instead of 100,00${NBSP}%.`,
    );
    setLanguage("es");
    expect(errorText(error("sum_mismatch", { sum_cents: 4500, amount_cents: 5000 }), "paid_by")).toBe(
      `Los importes suman 45,00${NBSP}€ pero el gasto es de 50,00${NBSP}€.`,
    );
  });

  test("split values by the kind of value; unknown codes fall back to the API message", () => {
    expect(errorText(error("invalid_value"), "split.3", "exact")).toBe("Enter an amount greater than 0.");
    expect(errorText(error("invalid_value"), "split.3", "percentage")).toBe("Enter a percentage like 33,33.");
    expect(errorText(error("invalid_value"), "split.3", "shares")).toBe("Enter a whole number.");
    expect(errorText(error("brand_new_code"), "name")).toBe("English from the API");
    expect(errorText(undefined, "name")).toBeUndefined();
  });

  test("every code the API sends has a text in every language, never the API message", () => {
    const codes = ["required", "too_long", "too_short", "too_many", "invalid_date", "before_start", "invalid_amount",
      "too_large", "invalid_email", "taken", "too_few", "duplicate", "duplicate_email", "sum_mismatch", "invalid_value",
      "invalid_credentials", "trip_paid", "not_a_member", "invalid_type", "invalid_category", "invalid_language"];
    for (const lang of ["en", "es", "fr"] as const) {
      setLanguage(lang);
      for (const code of codes) {
        const text = errorText(error(code, { max: 1, min: 1, sum_cents: 1, amount_cents: 1 }), "people.0.name", "exact");
        expect(text === "English from the API" || text === undefined || text.includes("{")).toBe(false);
      }
    }
  });
});

describe("the language store", () => {
  test("switching sets the page language and keeps a device copy", () => {
    const stored: Record<string, string> = {};
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => stored[k] ?? null,
      setItem: (k: string, v: string) => void (stored[k] = v),
    };
    (globalThis as { document?: unknown }).document = { documentElement: { lang: "en" } };

    setLanguage("fr");

    expect(stored[LANGUAGE_KEY]).toBe("fr");
    expect((globalThis as unknown as { document: { documentElement: { lang: string } } }).document.documentElement.lang).toBe("fr");
    expect(t("common.cancel")).toBe("Annuler");
    delete (globalThis as { document?: unknown }).document;
  });

  test("blocked storage still switches for the visit", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    setLanguage("es");
    expect(getLanguage()).toBe("es");
  });

  test("a pick before login is reported once", () => {
    setLanguage("fr", { picked: true });
    expect(takePickedLanguage()).toBe("fr");
    expect(takePickedLanguage()).toBeNull();
  });
});

describe("the account's language at start and login", () => {
  test("without a pick, the stored language applies", async () => {
    setLanguage("fr");
    const who = await applyAccountLanguage(ana("es"));
    expect([who.language, getLanguage(), calls.length]).toEqual(["es", "es", 0]);
  });

  test("a pick on Login is recorded on the account first", async () => {
    setLanguage("fr", { picked: true });
    answer(200, ana("fr"));
    const who = await applyAccountLanguage(ana("es"));
    expect([who.language, getLanguage()]).toEqual(["fr", "fr"]);
    expect(calls[0]).toMatchObject({ method: "PATCH", body: { language: "fr" } });
  });

  test("when recording fails, the stored language is shown", async () => {
    setLanguage("fr", { picked: true });
    answer(500, {});
    const who = await applyAccountLanguage(ana("es"));
    expect([who.language, getLanguage()]).toEqual(["es", "es"]);
  });

  test("updateMe and signUp send the language", async () => {
    answer(200, ana("es"));
    await updateMe({ language: "es" });
    answer(201, { token: "t", user: ana("fr") });
    await signUp("Lena", "lena@example.com", "travel-demo-2026", "fr");
    expect(calls.map((c) => [c.method, c.body])).toEqual([
      ["PATCH", { language: "es" }],
      ["POST", { display_name: "Lena", email: "lena@example.com", password: "travel-demo-2026", language: "fr" }],
    ]);
  });
});

describe("a switch while logged in", () => {
  const unreachable = () => {
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? "GET", body: JSON.parse(String(init.body)) });
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
  };

  test("is shown at once and saved", async () => {
    answer(200, ana("fr"));
    const who = await switchLanguage("fr");
    expect([who?.language, getLanguage(), pendingLanguage()]).toEqual(["fr", "fr", null]);
    expect(calls[0]).toMatchObject({ method: "PATCH", body: { language: "fr" } });
  });

  test.each([
    ["the API cannot be reached", unreachable],
    ["the API fails", () => answer(500, {})],
  ])("stays on screen and is sent again at the next screen change when %s", async (_, fail) => {
    fail();
    expect(await switchLanguage("fr")).toBeNull();
    expect([getLanguage(), pendingLanguage()]).toEqual(["fr", "fr"]);
    answer(200, ana("fr"));
    expect((await savePendingLanguage())?.language).toBe("fr");
    expect(pendingLanguage()).toBeNull();
    expect(calls.map((c) => c.body)).toEqual([{ language: "fr" }, { language: "fr" }]);
  });

  test("a newer switch replaces the pending one", async () => {
    unreachable();
    await switchLanguage("fr");
    await switchLanguage("es");
    expect([getLanguage(), pendingLanguage()]).toEqual(["es", "es"]);
  });

  test("nothing pending, nothing sent", async () => {
    answer(200, ana("en"));
    expect(await savePendingLanguage()).toBeNull();
    expect(calls).toEqual([]);
  });

  test("a 401, a login or a log out drops the pending language", async () => {
    answer(401, { error: { code: "unauthenticated", message: "Log in again." } });
    await switchLanguage("fr");
    expect(pendingLanguage()).toBeNull();
    unreachable();
    await switchLanguage("es");
    await applyAccountLanguage(ana("fr"));
    expect([pendingLanguage(), getLanguage()]).toEqual([null, "fr"]);
    await switchLanguage("es");
    dropPendingLanguage();
    expect(pendingLanguage()).toBeNull();
  });
});
