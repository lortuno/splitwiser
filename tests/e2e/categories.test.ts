// Acceptance checks for epic 5 (specs/05-expense-categories-specification.md) in Chromium at 390x844.
// The checks run in order on one fresh seed: checks 5–10 build on each other (Madrid gets "Dinner and wine", Tapas
// becomes Drinks, then Madrid is marked as paid).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import { API_URL, NBSP, euro, noSidewaysScroll, openAs, sameRow, shot, startServers, stopServers, tokenFor, visible } from "./harness";

beforeAll(startServers);
afterAll(stopServers);

const CATEGORY_CHIPS = [
  "🍴 Food", "🛒 Groceries", "🍺 Drinks", "☕ Coffee", "⛽ Fuel", "🚕 Transport", "✈️ Flights", "🏨 Lodging",
  "🎟️ Activities", "🛍️ Shopping", "🧾 Other",
];

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const text = (page: Page, value: string | RegExp) =>
  typeof value === "string" ? page.getByText(value, { exact: true }) : page.getByText(value);
/** A category chip by its label ("Fuel"); person chips never share these names. */
const chip = (page: Page, label: string) => page.getByRole("checkbox", { name: new RegExp(`\\s${label}$`) });
/** An expense row by the start of its accessible label ("Transport, Taxi to Porto airport"). */
const row = (page: Page, labelStart: string) => page.locator(`[aria-label^="${labelStart}"]`).first();
const nameField = (page: Page) => page.getByPlaceholder("Dinner at the harbour");

/** Waits until exactly this category chip is selected (suggestions arrive about 300 ms after typing). */
async function selected(page: Page, label: string, timeout = 3_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await chip(page, label).isChecked()) return true;
    await Bun.sleep(100);
  }
  return chip(page, label).isChecked();
}

async function openTrip(email: string, tripName: string): Promise<Page> {
  const page = await openAs(email, "/");
  await text(page, tripName).click();
  await visible(page, "Total trip spend");
  return page;
}

async function openAdd(page: Page) {
  await page.getByText("+ Add expense", { exact: true }).click();
  await visible(page, "Add expense");
}

async function api(path: string, token: string | null, init: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: response.status, data: (await response.json().catch(() => null)) as Record<string, any> | null };
}

describe("epic 5: expense categories and icons (390x844)", () => {
  test("check 1: icons on the trip view", async () => {
    const page = await openTrip("ana@example.com", "Lisbon & Porto");
    for (const [label, icon] of [
      ["Transport, Taxi to Porto airport", "🚕"],
      ["Lodging, Airbnb Porto, 3 nights", "🏨"],
      ["Groceries, Groceries at Pingo Doce", "🛒"],
      ["Drinks, Fado night drinks", "🍺"],
      ["Food, Dinner at the harbour", "🍴"],
      ["Shopping, Azulejo tile souvenir", "🛍️"],
    ]) {
      await row(page, label).scrollIntoViewIfNeeded();
      expect(await row(page, label).getByText(icon, { exact: true }).count()).toBe(1);
    }
    expect(await sameRow(page, "Taxi to Porto airport", euro("31,50"))).toBe(true);
    expect(await sameRow(page, "Taxi to Porto airport", "›")).toBe(true);
    expect(await noSidewaysScroll(page)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await row(page, "Transport, Taxi to Porto airport").scrollIntoViewIfNeeded();
    await shot(page, "e5-01-icons-on-trip-view");
    await page.close();
  }, 30_000);

  test("checks 2 and 3: the category section, then a suggestion despite a typo", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openAdd(page);
    await visible(page, "Category");
    await visible(page, "Pick a category, or type a name to get a suggestion.");
    const chips = page.getByRole("checkbox");
    const labels = (await chips.allTextContents()).slice(0, 11).map((label) => label.replace(/^✓ /, ""));
    expect(labels).toEqual(CATEGORY_CHIPS);
    for (let i = 0; i < 11; i++) {
      expect((await chips.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    expect(await chip(page, "Other").isChecked()).toBe(true);
    await shot(page, "e5-02-category-section");

    await nameField(page).fill("Gasolne Repsol");
    expect(await selected(page, "Fuel", 1_000)).toBe(true);
    await visible(page, "Suggested from the name. Tap to change.");
    await shot(page, "e5-03-suggestion-with-typo");
    await page.close();
  }, 30_000);

  test("check 4: languages, first word and no match", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openAdd(page);
    for (const [name, label] of [
      ["Abendessen im Hotel", "Food"],
      ["Hotel Abendessen", "Lodging"],
      ["Café con churros", "Coffee"],
      ["Airport taxi", "Transport"],
      ["Xyzzy", "Other"],
    ]) {
      await nameField(page).fill(name);
      await Bun.sleep(600);
      expect(await selected(page, label)).toBe(true);
    }
    await nameField(page).fill("Hotel");
    expect(await selected(page, "Lodging")).toBe(true);
    await nameField(page).fill("");
    expect(await selected(page, "Other")).toBe(true);
    await visible(page, "Pick a category, or type a name to get a suggestion.");
    await page.close();
  }, 30_000);

  test("checks 5 and 6: a tapped category sticks and is saved, then the trip learns", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openAdd(page);
    await nameField(page).fill("Dinner");
    expect(await selected(page, "Food")).toBe(true);
    await chip(page, "Drinks").click();
    await nameField(page).fill("Dinner and wine");
    await Bun.sleep(1_000);
    expect(await chip(page, "Drinks").isChecked()).toBe(true);
    await page.getByPlaceholder("2026-06-01").fill("2026-09-14");
    await page.getByPlaceholder("0,00").first().fill("20,00");
    await page.getByRole("checkbox", { name: "Ana" }).nth(0).click();
    await page.getByText("Save expense", { exact: true }).click();

    await visible(page, euro("98,30"));
    expect(await sameRow(page, "Chloé pays Ana", euro("0,85"))).toBe(true);
    expect(await sameRow(page, "Dinner and wine", euro("20,00"))).toBe(true);
    expect(await row(page, "Drinks, Dinner and wine").getByText("🍺", { exact: true }).count()).toBe(1);
    await shot(page, "e5-05-picked-category-saved");

    await openAdd(page);
    await nameField(page).fill("dinner and WINE");
    expect(await selected(page, "Drinks")).toBe(true);
    await button(page, "Cancel").click();
    await visible(page, euro("98,30"));
    await page.close();
  }, 30_000);

  test("check 7: learning stays in its trip", async () => {
    const page = await openTrip("ana@example.com", "Lisbon & Porto");
    await openAdd(page);
    await nameField(page).fill("Dinner and wine");
    expect(await selected(page, "Food")).toBe(true);
    await button(page, "Cancel").click();
    await page.close();
  }, 30_000);

  test("checks 8 to 10: change only the category, no re-suggestion when editing, icons on a paid trip", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await text(page, "Tapas at Mercado de San Miguel").click();
    await visible(page, "Edit expense");
    expect(await chip(page, "Food").isChecked()).toBe(true);
    await chip(page, "Drinks").click();
    await button(page, "Save changes").click();
    await visible(page, euro("98,30"));
    const tapas = row(page, "Drinks, Tapas at Mercado de San Miguel");
    expect(await tapas.getByText("🍺", { exact: true }).count()).toBe(1);
    expect(await tapas.getByText("Edited", { exact: true }).count()).toBe(1);
    expect(await sameRow(page, "Chloé pays Ana", euro("0,85"))).toBe(true);
    await shot(page, "e5-08-category-only-edit");

    await text(page, "Prado Museum tickets").click();
    await visible(page, "Edit expense");
    expect(await chip(page, "Activities").isChecked()).toBe(true);
    await nameField(page).fill("Prado dinner");
    await Bun.sleep(1_000);
    expect(await chip(page, "Activities").isChecked()).toBe(true);
    await button(page, "Cancel").click();
    const prado = row(page, "Activities, Prado Museum tickets");
    expect(await prado.getByText("🎟️", { exact: true }).count()).toBe(1);
    expect(await prado.getByText("Edited", { exact: true }).count()).toBe(0);

    await button(page, "Mark as paid").click();
    await button(page, "Mark as paid").click();
    await visible(page, "✓ Paid");
    for (const [label, icon] of [
      ["Drinks, Dinner and wine", "🍺"],
      ["Activities, Prado Museum tickets", "🎟️"],
      ["Drinks, Tapas at Mercado de San Miguel", "🍺"],
    ]) {
      expect(await row(page, label).getByText(icon, { exact: true }).count()).toBe(1);
    }
    expect(await text(page, "›").count()).toBe(0);
    await page.close();
  }, 30_000);

  test("check 11: long name and very large amount", async () => {
    const page = await openAs("noah@example.com", "/?trip=5");
    const sleeper = page.getByText(/^Overnight sleeper train/);
    await sleeper.waitFor();
    expect(await row(page, "Transport, Overnight sleeper train").getByText("🚕", { exact: true }).count()).toBe(1);
    const box = (await sleeper.boundingBox())!;
    expect(box.height).toBeGreaterThan(16 * 1.6); // more than one line
    expect(box.height).toBeLessThan(16 * 3); // at most two
    const amount = (await text(page, euro("345.678,91")).boundingBox())!;
    expect(amount.y).toBeLessThan(box.y + box.height / 2); // on the first line
    expect(await row(page, "Flights, Private jet charter").getByText("✈️", { exact: true }).count()).toBe(1);
    expect(await row(page, "Activities, Yacht week").getByText("🎟️", { exact: true }).count()).toBe(1);
    await visible(page, euro(`2,34${NBSP}M`));
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, "e5-11-long-name-large-amount");
    await page.close();
  }, 30_000);

  test("check 12: the screen reader label", async () => {
    const page = await openTrip("ana@example.com", "Lisbon & Porto");
    const taxi = page.getByRole("button", { name: `Transport, Taxi to Porto airport, ${euro("31,50")}`, exact: true });
    expect(await taxi.count()).toBe(1);
    expect(await taxi.locator('[aria-hidden="true"]').getByText("🚕", { exact: true }).count()).toBe(1);
    await page.close();
  }, 30_000);

  test("check 13: API unreachable", async () => {
    const page = await openTrip("ben@example.com", "Lisbon & Porto");
    await openAdd(page);
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await nameField(page).fill("Taxi");
    await Bun.sleep(1_000);
    expect(await chip(page, "Other").isChecked()).toBe(true);
    expect(await text(page, /Could not reach|Failed to fetch/).count()).toBe(0);
    await page.getByPlaceholder("0,00").first().fill("10,00");
    await page.getByRole("checkbox", { name: "Ben" }).nth(0).click();
    await page.getByText("Save expense", { exact: true }).click();
    await visible(page, "TypeError: Failed to fetch");
    expect(await nameField(page).inputValue()).toBe("Taxi");
    await shot(page, "e5-13-api-unreachable");
    await page.unroute(`${API_URL}/**`);
    await nameField(page).fill("Taxi ");
    expect(await selected(page, "Transport")).toBe(true);
    await page.close();
  }, 30_000);

  test("check 14: the suggestion endpoint", async () => {
    const ana = await tokenFor("ana@example.com");
    expect((await api("/trips/1/category-suggestion?name=gasolne", ana)).data).toEqual({ category: "fuel", source: "keywords" });
    expect((await api("/trips/7/category-suggestion?name=Dinner%20and%20wine", ana)).data).toEqual({ category: "drinks", source: "trip" });
    expect((await api("/trips/1/category-suggestion?name=Xyzzy", ana)).data).toEqual({ category: "other", source: "none" });
    expect((await api("/trips/1/category-suggestion", ana)).data).toEqual({ category: "other", source: "none" });
    expect((await api("/trips/1/category-suggestion?name=x", null)).status).toBe(401);
    const unknown = await api("/trips/999/category-suggestion?name=x", ana);
    expect([unknown.status, unknown.data?.error.code]).toEqual([404, "not_found"]);
    const notMember = await api("/trips/7/category-suggestion?name=x", await tokenFor("ben@example.com"));
    expect([notMember.status, notMember.data?.error.code]).toEqual([403, "not_a_member"]);
  });

  test("check 15: categories on write", async () => {
    const hugo = await tokenFor("hugo@example.com");
    const members = (await api("/trips/3", hugo)).data!.members as { id: number }[];
    const body = {
      name: "Taxi",
      date: "2026-02-02",
      amount_cents: 1200,
      paid_by: [{ person_id: members[0].id, amount_cents: 1200 }],
      split: { type: "equal", between: members.map((m) => ({ person_id: m.id, value: null })) },
    };
    const invalid = await api("/trips/3/expenses", hugo, { method: "POST", body: { ...body, category: "pets" } });
    expect([invalid.status, invalid.data?.errors.category.code]).toEqual([422, "invalid_category"]);
    const created = await api("/trips/3/expenses", hugo, { method: "POST", body });
    expect([created.status, created.data?.expense.category]).toEqual([201, "transport"]);
    const id = created.data?.expense.id;
    const changed = await api(`/trips/3/expenses/${id}`, hugo, { method: "PUT", body: { ...body, category: "other" } });
    expect([changed.status, changed.data?.expense.category, changed.data?.expense.edited]).toEqual([200, "other", true]);
    const kept = await api(`/trips/3/expenses/${id}`, hugo, { method: "PUT", body });
    expect(kept.data?.expense.category).toBe("other");
  });

  test("check 16: seed categories", async () => {
    const ana = await tokenFor("ana@example.com");
    const categories = Object.fromEntries(
      ((await api("/trips/1/expenses", ana)).data as unknown as { name: string; category: string }[]).map((e) => [e.name, e.category]),
    );
    expect(categories).toEqual({
      "Airport taxi to Alfama": "transport",
      "Pastéis de Belém breakfast": "food",
      "Dinner at the harbour": "food",
      "Tram 28 tickets": "transport",
      "Museum tickets": "activities",
      "Groceries at Pingo Doce": "groceries",
      "Train to Sintra": "transport",
      "Pena Palace tickets": "activities",
      "Azulejo tile souvenir": "shopping",
      "Train to Porto": "transport",
      "Airbnb Porto, 3 nights": "lodging",
      "Fado night drinks": "drinks",
      "Port wine tasting": "drinks",
      "Livraria Lello entrance": "activities",
      "Francesinha lunch": "food",
      "Douro valley boat tour": "activities",
      "Sunscreen and pharmacy": "shopping",
      "Seafood dinner in Matosinhos": "food",
      "Metro day passes": "transport",
      "Taxi to Porto airport": "transport",
    });
  });
});
