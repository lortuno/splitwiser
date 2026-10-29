// Acceptance checks for epic 3 (specs/groups/03-create-a-group-specification.md) in Chromium at 390x844.
// The checks run in order on one fresh seed: checks 2–4 create group 9, which checks 5 and 6 use; check 12 renames Ana.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import {
  API_URL,
  VIEWPORT,
  euro,
  fromMenu,
  logInWithForm,
  menuButton,
  menuItem,
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

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const field = (page: Page, label: string, index = 0) => page.getByLabel(label, { exact: true }).nth(index);

/** The trip names on "My groups", top to bottom. */
async function tripCards(page: Page): Promise<string[]> {
  await page.getByText(/^Logged in as /).waitFor();
  return page.getByRole("button", { name: /Total/ }).evaluateAll((cards) =>
    cards.map((card) => card.querySelector("div")?.textContent ?? ""),
  );
}

/** Opens "New group" from "My groups". */
async function openNewTrip(page: Page) {
  await button(page, "+ New group").click();
  await visible(page, "New group");
}

async function fillTrip(page: Page, name: string, start: string, end: string) {
  await field(page, "Group name").fill(name);
  await field(page, "Start date").fill(start);
  await field(page, "End date").fill(end);
}

describe("epic 3: create a group (390x844)", () => {
  test("check 1: My groups has + New group at the bottom", async () => {
    const page = await openAs("ana@example.com", "/");
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Lisbon & Porto"]);
    const newTrip = await button(page, "+ New group").boundingBox();
    expect(newTrip!.height).toBeGreaterThanOrEqual(56);
    expect(newTrip!.width).toBeGreaterThan(VIEWPORT.width - 40);
    expect(VIEWPORT.height - (newTrip!.y + newTrip!.height)).toBeLessThanOrEqual(16);
    await menuButton(page).click();
    for (const name of ["Settings", "Log out"]) {
      expect((await menuItem(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    await page.keyboard.press("Escape");
    await shot(page, "e3-01-my-trips-new-trip");
    await page.close();
  }, 30_000);

  test("checks 2 and 3: the form, then a trip with three people", async () => {
    const page = await openAs("ana@example.com", "/");
    await openNewTrip(page);
    await visible(page, "‹ My groups");
    expect(await field(page, "Group name").inputValue()).toBe("");
    await visible(page, "Dates (optional)");
    expect(await field(page, "Start date").inputValue()).toBe("");
    expect(await field(page, "End date").inputValue()).toBe("");
    await visible(page, "Ana (you)");
    expect(await page.getByLabel("Name", { exact: true }).count()).toBe(1);
    expect(await button(page, "Remove").count()).toBe(1);
    await button(page, "+ Add person").waitFor();
    const create = await button(page, "Create group").boundingBox();
    expect(create!.height).toBeGreaterThanOrEqual(56);
    expect(VIEWPORT.height - (create!.y + create!.height)).toBeLessThanOrEqual(16);
    await shot(page, "e3-02-new-trip-form");

    await fillTrip(page, "Summer in Sicily", "2026-07-10", "2026-07-17");
    await field(page, "Name", 0).fill("Ben");
    await field(page, "Email (optional)", 0).fill("  BEN@Example.com ");
    await button(page, "+ Add person").click();
    await field(page, "Name", 1).fill("Grandma");
    await button(page, "Create group").click();

    await visible(page, "Summer in Sicily");
    await visible(page, euro("0,00"));
    await visible(page, "10 Jul 2026 – 17 Jul 2026 · 0 expenses");
    await visible(page, "3 people");
    await visible(page, "No expenses yet. Tap + Add expense to record the first one.");
    expect(await page.getByText("Who owes whom", { exact: true }).count()).toBe(0);
    expect(new URL(page.url()).search).toBe("?trip=9");
    await shot(page, "e3-03-empty-trip-view");
    await page.getByRole("tab", { name: "Balances" }).click();
    await visible(page, "Everyone is settled up.");
    expect(await page.getByText(euro("0,00"), { exact: true }).count()).toBeGreaterThanOrEqual(3);
    await page.close();
  }, 30_000);

  test("check 4: first expense with an uneven split and a name-only member", async () => {
    const page = await openAs("ana@example.com", "/?trip=9");
    await visible(page, "Summer in Sicily");
    await page.getByText("+ Add expense", { exact: true }).click();
    await visible(page, "Add expense");
    // Person chips appear twice, in order: Paid by, Split between (all selected by default).
    for (const name of ["Ana", "Ben", "Grandma"]) {
      expect(await page.getByRole("checkbox", { name }).count()).toBe(2);
    }
    await page.getByPlaceholder("Dinner at the harbour").fill("Dinner");
    await page.getByPlaceholder("2026-06-01").fill("2026-07-10");
    await page.getByPlaceholder("0,00").first().fill("10,00");
    await page.getByRole("checkbox", { name: "Ana" }).nth(0).click();
    await page.getByText("Save expense", { exact: true }).click();

    await visible(page, "10 Jul 2026 – 17 Jul 2026 · 1 expense");
    expect(await sameRow(page, "Ben pays Ana", euro("3,33"))).toBe(true);
    expect(await sameRow(page, "Grandma pays Ana", euro("3,33"))).toBe(true);
    await page.getByRole("tab", { name: "Balances" }).click();
    await visible(page, euro("+6,66"));
    expect(await page.getByText(euro("-3,33"), { exact: true }).count()).toBe(2);

    await page.getByRole("tab", { name: "Group" }).click();
    await button(page, "‹ My groups").click();
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Summer in Sicily", "Lisbon & Porto"]);
    await visible(page, euro("10,00"));
    await page.close();
  }, 30_000);

  test("check 5: Ben, linked by email, sees the trip", async () => {
    const page = await open("/");
    await logInWithForm(page, "ben@example.com");
    expect(await tripCards(page)).toEqual(["Summer in Sicily", "Lisbon & Porto"]);
    await page.getByText("Summer in Sicily", { exact: true }).click();
    expect(await sameRow(page, "Ben pays Ana", euro("3,33"))).toBe(true);
    await page.close();
  }, 30_000);

  test("check 6: Chloé was not added and is not a member", async () => {
    const page = await openAs("chloe@example.com", "/");
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Lisbon & Porto"]);
    await page.close();
    const direct = await openAs("chloe@example.com", "/?trip=9");
    await visible(direct, "You are not a member of this group.");
    await direct.close();
  }, 30_000);

  test("check 7: validation errors under each field, nothing saved", async () => {
    const page = await openAs("ana@example.com", "/");
    await openNewTrip(page);
    await field(page, "Start date").fill("2026-07-17");
    await field(page, "End date").fill("2026-07-10");
    await field(page, "Name", 0).fill("ana");
    await field(page, "Email (optional)", 0).fill("ana@example.com");
    await button(page, "+ Add person").click();
    await field(page, "Name", 1).fill("Ben");
    await field(page, "Email (optional)", 1).fill("ben@x");
    await button(page, "+ Add person").click();
    await field(page, "Name", 2).fill("ben");
    await button(page, "Create group").click();

    // Since epic 6 errors share one text per code: two duplicate names and one duplicate email.
    await visible(page, "Fill in this field.");
    await visible(page, "The end date is before the start.");
    expect(await page.getByText("This is already on the group.", { exact: true }).count()).toBe(3);
    await visible(page, "Enter an email like ana@example.com.");
    await visible(page, "Please fix the fields marked in red.");
    await shot(page, "e3-07-validation-errors");

    await button(page, "‹ My groups").click();
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Summer in Sicily", "Lisbon & Porto"]);
    await page.close();
  }, 30_000);

  test("check 8: at least one more person", async () => {
    const page = await openAs("ana@example.com", "/");
    await openNewTrip(page);
    await field(page, "Group name").fill("Solo");
    await button(page, "Remove").click();
    expect(await page.getByLabel("Name", { exact: true }).count()).toBe(0);
    await button(page, "Create group").click();
    await visible(page, "Add at least one more person.");
    await button(page, "‹ My groups").click();
    expect((await tripCards(page)).length).toBe(3);
    await page.close();
  }, 30_000);

  test("check 9: 20 people and 80 characters at most", async () => {
    const page = await openAs("ana@example.com", "/");
    await openNewTrip(page);
    for (let i = 1; i < 19; i++) {
      await button(page, "+ Add person").click();
    }
    expect(await page.getByLabel("Name", { exact: true }).count()).toBe(19);
    expect(await button(page, "+ Add person").count()).toBe(0);

    const long = "A very long trip name that keeps going until it has exactly eighty characters ok";
    expect(long.length).toBe(80);
    await fillTrip(page, `${long}!`, "", "");
    for (let i = 0; i < 19; i++) {
      await field(page, "Name", i).fill(`Person ${i + 1}`);
    }
    await button(page, "Create group").click();
    await visible(page, "Use at most 80 characters.");

    await field(page, "Group name").fill(long);
    await button(page, "Create group").click();
    await visible(page, "20 people");
    await visible(page, "0 expenses"); // no dates before it
    expect(new URL(page.url()).search).toBe("?trip=10");
    const header = await page.getByText(long, { exact: true }).first().boundingBox();
    expect(header!.height).toBeLessThan(20 * 1.6); // one line with "…"
    expect(await noSidewaysScroll(page)).toBe(true);

    await button(page, "‹ My groups").click();
    const card = await page.getByText(long, { exact: true }).boundingBox();
    expect(card!.height).toBeLessThan(16 * 1.6 * 2 + 1); // at most 2 lines
    expect(await noSidewaysScroll(page)).toBe(true);
    await page.close();
  }, 60_000);

  test("check 10: a pending invite is linked at sign-up", async () => {
    const page = await open("/");
    await button(page, "No account yet? Sign up").click();
    await field(page, "Your name").fill("Inés García");
    await field(page, "Email").fill("ines@example.com");
    await field(page, "Password (at least 8 characters)").fill("long-enough-1");
    await button(page, "Create account").click();

    await visible(page, "Logged in as Inés García");
    expect(await tripCards(page)).toEqual(["Ski week"]);
    await visible(page, "19 Dec 2026 – 26 Dec 2026");
    await visible(page, euro("300,00"));
    await shot(page, "e3-10-invite-linked-at-sign-up");
    await page.getByText("Ski week", { exact: true }).click();
    expect(await sameRow(page, "Inés García pays Pia", euro("100,00"))).toBe(true);
    expect(await sameRow(page, "Grandpa pays Pia", euro("100,00"))).toBe(true);
    await page.close();
  }, 30_000);

  test("check 11: the new empty-list text", async () => {
    const page = await open("/");
    await button(page, "No account yet? Sign up").click();
    await field(page, "Your name").fill("Zoe");
    await field(page, "Email").fill("zoe@example.com");
    await field(page, "Password (at least 8 characters)").fill("long-enough-1");
    await button(page, "Create account").click();
    await visible(page, 'You are not on any group yet. Start one with "+ New group", or ask a friend to add you with your email.');
    await button(page, "+ New group").waitFor();
    await page.close();
  }, 30_000);

  test("check 12: Your name renames Ana on every trip", async () => {
    const page = await openAs("ana@example.com", "/");
    await fromMenu(page, "Settings");
    const name = field(page, "Name");
    expect(await name.inputValue()).toBe("Ana");
    await name.fill("");
    await button(page, "Save").click();
    await visible(page, "Fill in this field.");
    await name.fill("Ana María");
    await shot(page, "e3-12-your-name");
    await button(page, "Save").click();

    await visible(page, "Logged in as Ana María");
    await page.getByText("Lisbon & Porto", { exact: true }).click();
    expect(await sameRow(page, "Ana María pays Ben", euro("63,75"))).toBe(true);
    await page.close();

    const ben = await openAs("ben@example.com", "/?trip=9");
    expect(await sameRow(ben, "Ben pays Ana María", euro("3,33"))).toBe(true);
    await ben.close();

    // "Recorded by" comes from the API: check the Lisbon expense list directly.
    const expenses = await (
      await fetch(`${API_URL}/trips/1/expenses`, { headers: { Authorization: `Bearer ${await tokenFor("ana@example.com")}` } })
    ).json();
    const taxi = expenses.find((e: { name: string }) => e.name === "Airport taxi to Alfama");
    expect(taxi.recorded_by.name).toBe("Ana María");
  }, 30_000);

  // Before check 13, which saves one more group: "Gifts for Ben" is group 11, as in the spec.
  test("check 16: a group without dates", async () => {
    const page = await openAs("ana@example.com", "/");
    await openNewTrip(page);
    await field(page, "Group name").fill("Gifts for Ben");
    await field(page, "Name", 0).fill("Chloé");
    await field(page, "Email (optional)", 0).fill("chloe@example.com");
    await button(page, "Create group").click();

    await visible(page, "Gifts for Ben");
    await visible(page, euro("0,00"));
    await visible(page, "0 expenses");
    await visible(page, "2 people");
    expect(new URL(page.url()).search).toBe("?trip=11");
    await shot(page, "e3-16-group-without-dates");

    const today = await page.evaluate(() => {
      const now = new Date();
      return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
    });
    await page.getByText("+ Add expense", { exact: true }).click();
    expect(await page.getByPlaceholder("2026-06-01").inputValue()).toBe(today);
    await page.getByPlaceholder("Dinner at the harbour").fill("Book");
    await page.getByPlaceholder("0,00").first().fill("40,00");
    await page.getByRole("checkbox", { name: "Ana María" }).nth(0).click();
    await page.getByText("Save expense", { exact: true }).click();
    await visible(page, "1 expense");
    expect(await sameRow(page, "Chloé pays Ana María", euro("20,00"))).toBe(true);

    await button(page, "‹ My groups").click();
    const long = "A very long trip name that keeps going until it has exactly eighty characters ok";
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Summer in Sicily", "Lisbon & Porto", "Gifts for Ben", long]);
    await page.close();
  }, 30_000);

  test("check 17: one date without the other", async () => {
    const page = await openAs("ana@example.com", "/");
    await openNewTrip(page);
    await fillTrip(page, "Half dates", "2026-08-01", "");
    await field(page, "Name", 0).fill("Zed");
    await button(page, "Create group").click();
    await visible(page, "Enter a date as YYYY-MM-DD.");
    await fillTrip(page, "Half dates", "", "2026-08-01");
    await button(page, "Create group").click();
    await visible(page, "Enter a date as YYYY-MM-DD.");
    await button(page, "‹ My groups").click();
    expect((await tripCards(page)).length).toBe(5);
    await page.close();
  }, 30_000);

  test("check 13: API unreachable on Create group and Save", async () => {
    const page = await openAs("ana@example.com", "/");
    await openNewTrip(page);
    await fillTrip(page, "Offline trip", "2026-08-10", "2026-08-12");
    await field(page, "Name", 0).fill("Ben");
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await button(page, "Create group").click();
    await visible(page, `Could not reach the API at ${API_URL}.`);
    await button(page, "Create group").waitFor();
    expect(await field(page, "Group name").inputValue()).toBe("Offline trip");
    await shot(page, "e3-13-api-unreachable-new-trip");

    await page.unroute(`${API_URL}/**`);
    await button(page, "Create group").click();
    await visible(page, "Offline trip");
    await visible(page, "2 people");

    await button(page, "‹ My groups").click();
    await fromMenu(page, "Settings");
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await button(page, "Save").click();
    await visible(page, `Could not reach the API at ${API_URL}.`);
    await button(page, "Save").waitFor();
    await page.unroute(`${API_URL}/**`);
    await page.close();
  }, 30_000);

  test("check 18: the API takes groups without dates", async () => {
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${await tokenFor("ana@example.com")}` };
    const create = (body: object) =>
      fetch(`${API_URL}/trips`, { method: "POST", headers, body: JSON.stringify({ name: "API group", people: [{ name: "Zed" }], ...body }) });

    for (const body of [{ start_date: null, end_date: null }, {}]) {
      const response = await create(body);
      expect(response.status).toBe(201);
      const { trip } = await response.json();
      expect([trip.start_date, trip.end_date]).toEqual([null, null]);
    }
    const half = await create({ start_date: "2026-08-01" });
    expect(half.status).toBe(422);
    expect((await half.json()).errors.end_date.code).toBe("invalid_date");

    const listed: { start_date: string | null }[] = await (await fetch(`${API_URL}/trips`, { headers })).json();
    const firstDateless = listed.findIndex((trip) => trip.start_date === null);
    expect(listed.slice(firstDateless).every((trip) => trip.start_date === null)).toBe(true);
  });

  test("check 14: POST /trips and PATCH /me need a token", async () => {
    for (const [method, path] of [
      ["POST", "/trips"],
      ["PATCH", "/me"],
    ]) {
      const response = await fetch(`${API_URL}${path}`, { method, headers: { "Content-Type": "application/json" }, body: "{}" });
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthenticated");
    }
  });
});
