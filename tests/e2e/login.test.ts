// Acceptance checks for epic 2 (specs/accounts/02-login-and-my-trips-specification.md) in Chromium at 390x844.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import {
  API_URL,
  DEMO_PASSWORD,
  TOKEN_KEY,
  VIEWPORT,
  WEB_URL,
  browser,
  euro,
  logInWithForm,
  noSidewaysScroll,
  open,
  openAs,
  sameRow,
  shot,
  startServers,
  stopServers,
  tokenFor,
  visible,
} from "./harness";

beforeAll(startServers);
afterAll(stopServers);

const search = (page: Page) => new URL(page.url()).search;

/** The trip names on "My trips", top to bottom. */
async function tripCards(page: Page): Promise<string[]> {
  await visible(page, "My trips");
  await page.getByText(/^Logged in as /).waitFor();
  return page.getByRole("button", { name: /Total/ }).evaluateAll((cards) =>
    cards.map((card) => card.querySelector("div")?.textContent ?? ""),
  );
}

async function logOutFromMyTrips(page: Page) {
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await visible(page, "Log in to see your trips.");
}

describe("epic 2: login and my trips (390x844)", () => {
  test("check 1: the login screen", async () => {
    const page = await open("/");
    await visible(page, "Travel expenses");
    await visible(page, "Log in to see your trips.");
    await page.getByLabel("Email", { exact: true }).waitFor();
    await page.getByLabel("Password", { exact: true }).waitFor();
    const logIn = await page.getByRole("button", { name: "Log in", exact: true }).boundingBox();
    const signUp = await page.getByRole("button", { name: "No account yet? Sign up" }).boundingBox();
    expect(logIn!.height).toBeGreaterThanOrEqual(56);
    expect(logIn!.width).toBeGreaterThan(VIEWPORT.width - 40);
    expect(signUp!.y).toBeGreaterThan(logIn!.y);
    expect(signUp!.height).toBeGreaterThanOrEqual(48);
    expect(VIEWPORT.height - (signUp!.y + signUp!.height)).toBeLessThanOrEqual(16);
    expect(await page.getByText(/€/).count()).toBe(0);
    await shot(page, "e2-01-login");
    await page.close();
  }, 30_000);

  test("checks 2 and 3: Ana's two trips, open one and go back", async () => {
    const page = await open("/");
    await logInWithForm(page, "ana@example.com");
    await visible(page, "Logged in as Ana");
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Lisbon & Porto"]);
    await visible(page, "12 Sep 2026 – 14 Sep 2026");
    await visible(page, "1 Jun 2026 – 7 Jun 2026");
    expect(await sameRow(page, "Total", euro("78,30"))).toBe(true);
    await visible(page, euro("1.915,57"));
    await page.getByRole("button", { name: "Log out", exact: true }).waitFor();
    expect(await page.getByRole("tab").count()).toBe(0);
    await shot(page, "e2-02-my-trips");

    await page.getByText("Lisbon & Porto", { exact: true }).click();
    await visible(page, "‹ My trips");
    await visible(page, euro("1.915,57"));
    for (const who of ["Ana pays Ben", "David pays Ben", "David pays Chloé"]) {
      await visible(page, who);
    }
    expect(search(page)).toBe("?trip=1");
    const back = await page.getByRole("button", { name: "‹ My trips" }).boundingBox();
    const name = await page.getByText("Lisbon & Porto", { exact: true }).boundingBox();
    expect(back!.height).toBeGreaterThanOrEqual(48);
    expect(back!.y).toBeLessThan(name!.y);

    await page.getByRole("button", { name: "‹ My trips" }).click();
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Lisbon & Porto"]);
    expect(search(page)).toBe("");
    await page.close();
  }, 30_000);

  test("check 4: the Madrid trip view", async () => {
    const page = await openAs("ana@example.com", "/");
    await page.getByText("Madrid weekend", { exact: true }).click();
    await visible(page, euro("78,30"));
    await visible(page, "12 Sep 2026 – 14 Sep 2026 · 2 expenses");
    await visible(page, "2 people");
    await visible(page, "Ana pays Chloé");
    expect(await sameRow(page, "Ana pays Chloé", euro("9,15"))).toBe(true);
    expect(await page.getByText(/ pays /).count()).toBe(1);
    await shot(page, "e2-04-madrid-trip");
    await page.close();
  }, 30_000);

  test("checks 5 and 6: Ben sees one trip and is not a member of Madrid", async () => {
    const page = await openAs("ana@example.com", "/");
    await visible(page, "Logged in as Ana");
    await logOutFromMyTrips(page);
    await logInWithForm(page, "ben@example.com");
    await visible(page, "Logged in as Ben");
    expect(await tripCards(page)).toEqual(["Lisbon & Porto"]);
    expect(await page.getByText("Madrid weekend", { exact: true }).count()).toBe(0);

    const statuses: number[] = [];
    page.on("response", (response) => {
      if (response.url() === `${API_URL}/trips/7`) statuses.push(response.status());
    });
    await page.goto(`${WEB_URL}/?trip=7`);
    await visible(page, "You are not a member of this trip.");
    expect(statuses).toContain(403);
    await shot(page, "e2-06-not-a-member");
    await page.getByText("Go to My trips", { exact: true }).click();
    expect(await tripCards(page)).toEqual(["Lisbon & Porto"]);
    expect(search(page)).toBe("");
    await page.close();
  }, 30_000);

  test("check 7: unknown and invalid trip ids", async () => {
    const page = await openAs("ben@example.com", "/?trip=999");
    await visible(page, "This trip does not exist.");
    await page.getByRole("button", { name: "Go to My trips" }).waitFor();

    const tripCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(`${API_URL}/trips/`)) tripCalls.push(request.url());
    });
    await page.goto(`${WEB_URL}/?trip=abc`);
    await visible(page, "This trip does not exist.");
    expect(tripCalls).toEqual([]);
    await page.close();
  }, 30_000);

  test("checks 8 and 9: wrong password, unknown email, loosely typed email", async () => {
    const page = await open("/");
    await logInWithForm(page, "ana@example.com", "wrong-password");
    await visible(page, "Email or password is wrong.");
    expect(await page.getByLabel("Email", { exact: true }).inputValue()).toBe("ana@example.com");
    await shot(page, "e2-08-wrong-password");

    await logInWithForm(page, "nobody@example.com", "anything-at-all");
    await visible(page, "Email or password is wrong.");

    await logInWithForm(page, "  ANA@Example.com ", DEMO_PASSWORD);
    await visible(page, "Logged in as Ana");
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Lisbon & Porto"]);
    await page.close();
  }, 30_000);

  test("checks 10 and 11: sign-up errors, then a new account with no trips", async () => {
    const page = await open("/");
    await page.getByRole("button", { name: "No account yet? Sign up" }).click();
    await visible(page, "Create an account");
    const name = page.getByLabel("Your name", { exact: true });
    const email = page.getByLabel("Email", { exact: true });
    const password = page.getByLabel("Password (at least 8 characters)", { exact: true });
    const create = page.getByRole("button", { name: "Create account" });

    await name.fill("Zoe");
    await email.fill("ana@example.com");
    await password.fill("short");
    await create.click();
    await visible(page, "This email already has an account.");
    await visible(page, "Use at least 8 characters.");
    expect(await email.inputValue()).toBe("ana@example.com");
    await shot(page, "e2-10-sign-up-errors");

    await name.fill("");
    await create.click();
    await visible(page, "Fill in this field.");
    await email.fill("zoe");
    await create.click();
    await visible(page, "Enter an email like ana@example.com.");

    await name.fill("Zoe");
    await email.fill("zoe@example.com");
    await password.fill("long-enough-1");
    await create.click();
    await visible(page, "Logged in as Zoe");
    // Text changed in epic 3 (specs/trips/03-create-a-trip-specification.md, check 11).
    const empty = 'You are not on any trip yet. Start one with "+ New trip", or ask a friend to add you with your email.';
    await visible(page, empty);
    await shot(page, "e2-11-sign-up-empty-list");

    await logOutFromMyTrips(page);
    await logInWithForm(page, "zoe@example.com", "long-enough-1");
    await visible(page, "Logged in as Zoe");
    await visible(page, empty);
    await page.close();
  }, 30_000);

  test("check 12: a long trip name and a large total in the list", async () => {
    const page = await openAs("noah@example.com", "/");
    const name = page.getByText("Great tour of every UNESCO world heritage site in southern Europe by sleeper train", { exact: true });
    await name.waitFor();
    const nameBox = await name.boundingBox();
    expect(nameBox!.height).toBeLessThanOrEqual(16 * 1.6 * 2); // at most two lines
    await visible(page, "1 Apr 2026 – 30 Apr 2026");
    const total = await page.getByText(euro("2.345.678,91"), { exact: true }).boundingBox();
    expect(total!.height).toBeLessThan(16 * 1.6); // one line
    expect(total!.x + total!.width).toBeGreaterThan(VIEWPORT.width - 60); // right-aligned
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, "e2-12-long-name-large-total");
    await page.close();
  }, 30_000);

  test("check 13: a zero total in the list", async () => {
    const page = await openAs("eva@example.com", "/");
    expect(await tripCards(page)).toEqual(["Empty weekend"]);
    await visible(page, "10 Jan 2026 – 12 Jan 2026");
    expect(await sameRow(page, "Total", euro("0,00"))).toBe(true);
    await page.close();
  }, 30_000);

  test("checks 16 and 17: reload keeps the session, logout ends it", async () => {
    const page = await open("/");
    await logInWithForm(page, "ana@example.com");
    await visible(page, "Logged in as Ana");
    await page.reload();
    await visible(page, "Logged in as Ana");
    expect(await page.getByText("Log in to see your trips.", { exact: true }).count()).toBe(0);

    const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
    expect(token).toHaveLength(64);
    await logOutFromMyTrips(page);
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
    const me = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect(me.status).toBe(401);
    expect(((await me.json()) as { error: { code: string } }).error.code).toBe("unauthenticated");
    await page.close();
  }, 30_000);

  test("check 18: the session ends while a trip is open", async () => {
    const page = await openAs("ana@example.com", "/");
    await page.getByText("Lisbon & Porto", { exact: true }).click();
    await visible(page, euro("1.915,57"));
    const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
    await fetch(`${API_URL}/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });

    await page.getByRole("button", { name: "‹ My trips" }).click();
    await visible(page, "Your session has ended. Please log in again.");
    expect(search(page)).toBe("");
    await shot(page, "e2-18-session-ended");
    await logInWithForm(page, "ana@example.com");
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Lisbon & Porto"]);

    // The other way in: a stored token the API does not know, then a reload.
    await page.evaluate((key) => localStorage.setItem(key, "x"), TOKEN_KEY);
    await page.reload();
    await visible(page, "Your session has ended. Please log in again.");
    await page.close();
  }, 30_000);

  test("check 19: a trip link opened while logged out opens after login", async () => {
    const page = await open("/?trip=1");
    await visible(page, "Log in to see your trips.");
    await logInWithForm(page, "ben@example.com");
    await visible(page, euro("1.915,57"));
    await visible(page, "‹ My trips");
    expect(search(page)).toBe("?trip=1");
    await page.close();
  }, 30_000);

  test("check 20: the API is unreachable on Login", async () => {
    const page = await open("/");
    await visible(page, "Log in to see your trips.");
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await logInWithForm(page, "ana@example.com");
    await visible(page, `Could not reach the API at ${API_URL}.`);
    await page.getByRole("button", { name: "Log in", exact: true }).waitFor();
    await shot(page, "e2-20-api-unreachable-login");

    await page.unroute(`${API_URL}/**`);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await visible(page, "Logged in as Ana");
    await page.close();
  }, 30_000);

  test("check 21: the health check needs no token", async () => {
    const response = await fetch(`${API_URL}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  // Changes the total of trip 1, so it runs after every check that shows it.
  test("check 15: recorded_by sent by the client is ignored", async () => {
    const token = await tokenFor("ana@example.com");
    const page = await openAs("ana@example.com", "/");
    await visible(page, "Logged in as Ana");
    const result = await page.evaluate(
      async ([api, value]) => {
        const headers = { Authorization: `Bearer ${value}`, "Content-Type": "application/json" };
        const trip = await (await fetch(`${api}/trips/1`, { headers })).json();
        const ids = Object.fromEntries(trip.members.map((m: { id: number; name: string }) => [m.name, m.id]));
        const response = await fetch(`${api}/trips/1/expenses`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: "Coffee",
            date: "2026-06-03",
            amount_cents: 200,
            recorded_by: ids.Ben,
            paid_by: [{ person_id: ids.Ana, amount_cents: 200 }],
            split: { type: "equal", between: trip.members.map((m: { id: number }) => ({ person_id: m.id, value: null })) },
          }),
        });
        return { status: response.status, recorder: (await response.json()).expense.recorded_by.name };
      },
      [API_URL, token],
    );
    expect(result).toEqual({ status: 201, recorder: "Ana" });
    await page.close();
  }, 30_000);

  // Runs last: it adds an expense to trip 7.
  test("check 14: an added expense is recorded as the logged-in person", async () => {
    const page = await openAs("ana@example.com", "/");
    await page.getByText("Madrid weekend", { exact: true }).click();
    await visible(page, euro("78,30"));
    await page.getByText("+ Add expense", { exact: true }).click();
    await visible(page, "Add expense");
    expect(await page.getByText("Recorded by", { exact: true }).count()).toBe(0);

    // Person chips appear twice, in order: Paid by, Split between (both selected by default).
    await page.getByPlaceholder("Dinner at the harbour").fill("Churros");
    await page.getByPlaceholder("0,00").first().fill("6,00");
    await page.getByRole("checkbox", { name: "Ana" }).nth(0).click();
    await page.getByText("Save expense", { exact: true }).click();

    await visible(page, euro("84,30"));
    await visible(page, "12 Sep 2026 – 14 Sep 2026 · 3 expenses");
    expect(await sameRow(page, "Ana pays Chloé", euro("6,15"))).toBe(true);
    expect(await sameRow(page, "Churros", euro("6,00"))).toBe(true);
    await visible(page, "Recorded by Ana · Split between 2");
    await shot(page, "e2-14-add-expense-as-me");

    await page.getByRole("button", { name: "‹ My trips" }).click();
    await visible(page, "Logged in as Ana");
    expect(await sameRow(page, "Total", euro("84,30"))).toBe(true);
    await page.close();
  }, 30_000);
});
