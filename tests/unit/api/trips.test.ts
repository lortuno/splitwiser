import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { updateMe } from "../../../packages/app/src/api/auth";
import { createTrip } from "../../../packages/app/src/api/trips";
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
    answer(200, { id: 1, display_name: "Ana María", email: "ana@example.com" });

    const user = await updateMe("Ana María");

    expect(user.display_name).toBe("Ana María");
    expect(calls[0].url.endsWith("/me")).toBe(true);
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({ display_name: "Ana María" });
  });
});
