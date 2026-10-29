import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { getDebts, updateMe } from "../../../packages/app/src/api/auth";
import { suggestCategory, updateExpense } from "../../../packages/app/src/api/expenses";
import { createTrip, markPaid, reopenTrip } from "../../../packages/app/src/api/trips";
import { clearToken, setToken } from "../../../packages/app/src/api/session";

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
  setToken("abc");
});

afterEach(() => {
  globalThis.fetch = realFetch;
  clearToken();
});

describe("epic 3 requests", () => {
  test("createTrip posts the new trip to /trips and returns trip and summary", async () => {
    const created = { trip: { id: 9, name: "Summer in Sicily" }, summary: { total_cents: 0 } };
    answer(201, created);
    const input = { name: "Summer in Sicily", start_date: "2026-07-10", end_date: "2026-07-17", people: [{ name: "Ben", email: null }] };

    expect(await createTrip(input)).toEqual(created as never);
    expect(calls[0].url.endsWith("/trips")).toBe(true);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual(input);
  });

  test("updateMe sends PATCH /me with display_name", async () => {
    answer(200, { id: 1, display_name: "Ana María", email: "ana@example.com", language: "en" });

    const user = await updateMe({ display_name: "Ana María" });

    expect(user.display_name).toBe("Ana María");
    expect(calls[0].url.endsWith("/me")).toBe(true);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({ display_name: "Ana María" });
  });
});

describe("epic 4 requests", () => {
  test("updateExpense sends PUT /trips/{id}/expenses/{expenseId} with the form body", async () => {
    answer(200, { expense: { id: 21, edited: true }, summary: { total_cents: 8001 } });
    const input = {
      name: "Tapas",
      date: "2026-09-12",
      amount_cents: 5001,
      paid_by: [{ person_id: 3, amount_cents: 5001 }],
      split: { type: "equal" as const, between: [{ person_id: 1, value: null }] },
    };

    const result = await updateExpense(7, 21, input);

    expect(result.summary.total_cents).toBe(8001);
    expect(calls[0].url.endsWith("/trips/7/expenses/21")).toBe(true);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].body).toEqual(input);
  });

  test("markPaid and reopenTrip post without a body", async () => {
    answer(200, { summary: { paid: null } });

    await markPaid(7);
    await reopenTrip(7);

    expect(calls.map((c) => [c.method, c.url.replace(/^.*\/trips/, "/trips"), c.body])).toEqual([
      ["POST", "/trips/7/paid", undefined],
      ["POST", "/trips/7/reopen", undefined],
    ]);
  });
});

describe("epic 5 requests", () => {
  test("suggestCategory sends GET with the encoded name", async () => {
    answer(200, { category: "fuel", source: "keywords" });

    const result = await suggestCategory(7, "Gasolne & Repsol");

    expect(result).toEqual({ category: "fuel", source: "keywords" });
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url.endsWith("/trips/7/category-suggestion?name=Gasolne%20%26%20Repsol")).toBe(true);
  });
});

describe("I owe / I'm owed", () => {
  test("getDebts reads GET /me/debts", async () => {
    const debts = { owe_cents: 7290, owed_cents: 0, groups: [] };
    answer(200, debts);

    expect(await getDebts()).toEqual(debts);
    expect(calls[0].url.endsWith("/me/debts")).toBe(true);
    expect(calls[0].method).toBe("GET");
  });
});
