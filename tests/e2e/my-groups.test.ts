// Acceptance checks 22–31 of epic 2 ("I owe" / "I'm owed" and the "Paid groups" section) in Chromium at 390x844.
// The checks run in order on their own fresh seed: check 23 marks Madrid as paid and reopens it, check 25 adds group 9.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import {
  API_URL,
  confirmCodeFromEmail,
  euro,
  mailsTo,
  noSidewaysScroll,
  open,
  openAs,
  shot,
  startServers,
  stopServers,
  visible,
} from "./harness";

beforeAll(startServers);
afterAll(stopServers);

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const text = (page: Page, value: string) => page.getByText(value, { exact: true });
const field = (page: Page, label: string, index = 0) => page.getByLabel(label, { exact: true }).nth(index);
/** One half of the summary; its accessible name starts with its label. */
const half = (page: Page, label: "I owe" | "I'm owed") => page.getByRole("button", { name: new RegExp(`^${label}`) });
/** The card of a group on "My groups" (a button containing its name). */
const card = (page: Page, name: string) => page.getByRole("button").filter({ hasText: name }).last();
const paidRow = (page: Page) => page.getByRole("button", { name: /^Paid groups/ });

async function myGroups(email: string): Promise<Page> {
  const page = await openAs(email, "/");
  await page.getByText(/^Logged in as /).waitFor();
  return page;
}

/** True when the summary half shows exactly this amount. */
const halfShows = async (page: Page, label: "I owe" | "I'm owed", amount: string) =>
  (await half(page, label).getByText(euro(amount), { exact: true }).count()) === 1;

/** True when the card shows `label` with `amount` (position line or transfer row). */
const cardShows = async (page: Page, name: string, label: string, amount: string) =>
  (await card(page, name).getByText(label, { exact: true }).count()) === 1 &&
  (await card(page, name).getByText(euro(amount), { exact: true }).count()) === 1;

async function backToMyGroups(page: Page) {
  await button(page, "‹ My groups").click();
  await page.getByText(/^Logged in as /).waitFor();
}

describe("epic 2: I owe, I'm owed and paid groups (390x844)", () => {
  test("check 22: what I owe, at a glance", async () => {
    const page = await myGroups("ana@example.com");
    expect(await halfShows(page, "I owe", "72,90")).toBe(true);
    expect(await halfShows(page, "I'm owed", "0,00")).toBe(true);
    const owe = (await half(page, "I owe").boundingBox())!;
    const owed = (await half(page, "I'm owed").boundingBox())!;
    expect(owe.height).toBeGreaterThanOrEqual(48);
    expect(owed.height).toBeGreaterThanOrEqual(48);
    expect(Math.abs(owe.y - owed.y)).toBeLessThan(2); // side by side
    expect(await cardShows(page, "Madrid weekend", "You owe", "9,15")).toBe(true);
    expect(await cardShows(page, "Lisbon & Porto", "You owe", "63,75")).toBe(true);
    expect(await paidRow(page).count()).toBe(0);
    await shot(page, "e2-22-i-owe-at-a-glance");
    await page.close();
  }, 30_000);

  test("check 23: paid groups fold away", async () => {
    const page = await myGroups("ana@example.com");
    await text(page, "Madrid weekend").click();
    await button(page, "Mark as paid").click();
    await button(page, "Mark as paid").click();
    await button(page, "Reopen").waitFor();
    await backToMyGroups(page);

    expect(await halfShows(page, "I owe", "63,75")).toBe(true);
    expect(await text(page, "Madrid weekend").count()).toBe(0);
    await text(page, "Lisbon & Porto").waitFor();
    expect((await paidRow(page).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(await paidRow(page).getByText("Paid groups (1)", { exact: true }).count()).toBe(1);
    expect(await paidRow(page).getByText("▸", { exact: true }).count()).toBe(1);

    await paidRow(page).click();
    await text(page, "Madrid weekend").waitFor();
    expect(await card(page, "Madrid weekend").getByText("✓ Paid", { exact: true }).count()).toBe(1);
    expect(await card(page, "Madrid weekend").getByText(euro("78,30"), { exact: true }).count()).toBe(1);
    expect(await card(page, "Madrid weekend").getByText("You owe", { exact: true }).count()).toBe(0);
    expect(await paidRow(page).getByText("▾", { exact: true }).count()).toBe(1);
    await shot(page, "e2-23-paid-groups-open");
    await paidRow(page).click();
    expect(await text(page, "Madrid weekend").count()).toBe(0);

    await text(page, "Lisbon & Porto").click();
    await backToMyGroups(page);
    expect(await paidRow(page).getByText("▸", { exact: true }).count()).toBe(1);
    expect(await text(page, "Madrid weekend").count()).toBe(0);

    await paidRow(page).click();
    await text(page, "Madrid weekend").click();
    await button(page, "Reopen").click();
    await button(page, "Mark as paid").waitFor();
    await backToMyGroups(page);
    expect(await cardShows(page, "Madrid weekend", "You owe", "9,15")).toBe(true);
    expect(await halfShows(page, "I owe", "72,90")).toBe(true);
    expect(await paidRow(page).count()).toBe(0);
    await page.close();
  }, 30_000);

  test("check 24: the I owe and I'm owed filters", async () => {
    const page = await myGroups("ana@example.com");
    await half(page, "I owe").click();
    await visible(page, "I owe ✓");
    await visible(page, "Groups where you owe money");
    expect(await cardShows(page, "Madrid weekend", "You pay Chloé", "9,15")).toBe(true);
    expect(await cardShows(page, "Lisbon & Porto", "You pay Ben", "63,75")).toBe(true);
    expect(await text(page, "Total").count()).toBe(0);
    await shot(page, "e2-24-i-owe-filter");

    await half(page, "I'm owed").click();
    await visible(page, "Nobody owes you.");
    await half(page, "I'm owed").click();
    await text(page, "Total").first().waitFor();
    expect(await text(page, "Groups where you are owed money").count()).toBe(0);

    await half(page, "I owe").click();
    await text(page, "Lisbon & Porto").click();
    await backToMyGroups(page);
    expect(await text(page, "Groups where you owe money").count()).toBe(0);
    expect(await text(page, "I owe ✓").count()).toBe(0);
    await text(page, "Total").first().waitFor();
    await page.close();
  }, 30_000);

  test("check 25: owing and owed at once", async () => {
    const page = await myGroups("ana@example.com");
    await button(page, "+ New group").click();
    await field(page, "Group name").fill("Coffee club");
    await field(page, "Name", 0).fill("Ben");
    await field(page, "Email (optional)", 0).fill("ben@example.com");
    await button(page, "Create group").click();
    await visible(page, "Coffee club");
    await page.getByText("+ Add expense", { exact: true }).click();
    await page.getByPlaceholder("Dinner at the harbour").fill("Coffee");
    await page.getByPlaceholder("0,00").first().fill("10,00");
    await page.getByRole("checkbox", { name: "Ana" }).nth(0).click();
    await page.getByText("Save expense", { exact: true }).click();
    await visible(page, "Ben pays Ana");
    await backToMyGroups(page);

    expect(await halfShows(page, "I owe", "72,90")).toBe(true);
    expect(await halfShows(page, "I'm owed", "5,00")).toBe(true);
    expect(await cardShows(page, "Coffee club", "You're owed", "5,00")).toBe(true);
    await half(page, "I'm owed").click();
    expect(await cardShows(page, "Coffee club", "Ben pays you", "5,00")).toBe(true);
    await page.close();

    const ben = await myGroups("ben@example.com");
    expect(await halfShows(ben, "I owe", "5,00")).toBe(true);
    expect(await halfShows(ben, "I'm owed", "91,40")).toBe(true);
    await ben.close();
  }, 30_000);

  test("check 26: three people owe me in one group", async () => {
    const page = await myGroups("olga@example.com");
    expect(await halfShows(page, "I'm owed", "50,00")).toBe(true);
    await half(page, "I'm owed").click();
    expect(await card(page, "Big group").getByText(euro("20,00"), { exact: true }).count()).toBe(2); // Quinn and Rosa
    expect(await card(page, "Big group").getByText("Quinn pays you", { exact: true }).count()).toBe(1);
    expect(await card(page, "Big group").getByText("Rosa pays you", { exact: true }).count()).toBe(1);
    expect(await cardShows(page, "Big group", "Sam pays you", "10,00")).toBe(true);
    await page.close();
  }, 30_000);

  test("check 27: uneven cents", async () => {
    const page = await myGroups("jon@example.com");
    expect(await halfShows(page, "I'm owed", "6,66")).toBe(true);
    await half(page, "I'm owed").click();
    expect(await card(page, "Three-way taxi").getByText(euro("3,33"), { exact: true }).count()).toBe(2);
    expect(await card(page, "Three-way taxi").getByText("Kim pays you", { exact: true }).count()).toBe(1);
    expect(await card(page, "Three-way taxi").getByText("Lea pays you", { exact: true }).count()).toBe(1);
    await page.close();
  }, 30_000);

  test("check 28: everyone settled", async () => {
    const page = await myGroups("hugo@example.com");
    expect(await halfShows(page, "I owe", "0,00")).toBe(true);
    expect(await halfShows(page, "I'm owed", "0,00")).toBe(true);
    expect(await card(page, "Even split").getByText("Settled", { exact: true }).count()).toBe(1);
    await half(page, "I owe").click();
    await visible(page, "You don't owe anyone.");
    await half(page, "I'm owed").click();
    await visible(page, "Nobody owes you.");
    await page.close();
  }, 30_000);

  test("check 29: long name, very large amount", async () => {
    const page = await myGroups("noah@example.com");
    const amount = half(page, "I'm owed").getByText(euro("1.172.839,46"), { exact: true });
    expect((await amount.boundingBox())!.height).toBeLessThan(16 * 1.6); // one line
    await half(page, "I'm owed").click();
    const row = text(page, "Maximiliane Alexandra von Hohenzollern-Sigmaringen pays you");
    expect((await row.boundingBox())!.height).toBeLessThan(16 * 1.6 * 2 + 1); // at most 2 lines
    const rowAmount = card(page, "Great tour").getByText(euro("1.172.839,46"), { exact: true });
    expect((await rowAmount.boundingBox())!.height).toBeLessThan(16 * 1.6);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, "e2-29-long-name-large-amount");
    await page.close();
  }, 30_000);

  test("check 30: no groups, no summary", async () => {
    const page = await open("/");
    await button(page, "No account yet? Sign up").click();
    await field(page, "Your name").fill("Yara");
    await field(page, "Email").fill("yara@example.com");
    await field(page, "Password (at least 8 characters)").fill("long-enough-1");
    const before = (await mailsTo("yara@example.com")).length;
    await button(page, "Create account").click();
    await confirmCodeFromEmail(page, "yara@example.com", before);
    await visible(page, 'You are not on any group yet. Start one with "+ New group", or ask a friend to add you with your email.');
    expect(await half(page, "I owe").count()).toBe(0);
    expect(await half(page, "I'm owed").count()).toBe(0);
    await page.close();
  }, 30_000);

  test("check 31: API unreachable", async () => {
    const page = await myGroups("ana@example.com");
    const message = `Could not reach the API at ${API_URL}.`;
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await page.reload();
    await visible(page, message);
    await button(page, "Try again").waitFor();
    await shot(page, "e2-31-api-unreachable");
    await page.unroute(`${API_URL}/**`);

    await page.reload();
    await page.getByText(/^Logged in as /).waitFor();
    await page.route(`${API_URL}/me/debts`, (route) => route.abort());
    await half(page, "I owe").waitFor();
    await text(page, "Lisbon & Porto").click();
    await button(page, "‹ My groups").click();
    await visible(page, message);
    await page.unroute(`${API_URL}/me/debts`);
    await button(page, "Try again").click();
    await half(page, "I owe").waitFor();
    expect(await halfShows(page, "I owe", "72,90")).toBe(true);
    expect(await cardShows(page, "Lisbon & Porto", "You owe", "63,75")).toBe(true);
    await page.close();

    const response = await fetch(`${API_URL}/me/debts`);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthenticated");
  }, 30_000);
});
