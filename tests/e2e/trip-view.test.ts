// Acceptance checks for epic 1 (specs/trips/01-trip-at-a-glance-specification.md) in Chromium at 390x844.
// Since epic 2 every trip needs a login: each check logs in as the trip's owner (see Seeder::ACCOUNTS).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  API_URL,
  NBSP,
  VIEWPORT,
  WEB_URL,
  aboveTheFold,
  browser,
  euro,
  noSidewaysScroll,
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

/** The demo account that is a member of each seeded trip. */
const OWNER: Record<string, string> = {
  "1": "ana@example.com",
  "2": "eva@example.com",
  "3": "hugo@example.com",
  "4": "jon@example.com",
  "5": "noah@example.com",
  "6": "olga@example.com",
};

/** Opens `/?trip={id}` logged in as that trip's owner. */
const open = (path: string) => openAs(OWNER[new URLSearchParams(path.split("?")[1]).get("trip") ?? "1"] ?? OWNER["1"], path);

/** A new page logged in as Ana, before the app has started. */
async function pageAsAna() {
  const token = await tokenFor(OWNER["1"]);
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${WEB_URL}/favicon.ico`);
  await page.evaluate((value) => localStorage.setItem("travel-expenses.token", value), token);
  return page;
}

describe("epic 1: trip at a glance (390x844)", () => {
  test("check 1: demo trip shows the total and who owes whom above the fold", async () => {
    const page = await open("/?trip=1");
    await visible(page, euro("1.915,57"));
    for (const text of ["Lisbon & Porto", "Total trip spend", "1 Jun 2026 – 7 Jun 2026 · 20 expenses", "4 people", "Who owes whom"]) {
      await visible(page, text);
    }
    for (const [who, amount] of [
      ["Ana pays Ben", "63,75"],
      ["David pays Ben", "27,65"],
      ["David pays Chloé", "27,07"],
    ]) {
      await visible(page, who);
      expect(await aboveTheFold(page, who)).toBe(true);
      expect(await page.getByText(euro(amount), { exact: true }).count()).toBeGreaterThan(0);
    }
    expect(await aboveTheFold(page, euro("1.915,57"))).toBe(true);
    expect(await page.getByText(/^Show all/).count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, "01-demo-trip");
    await page.close();
  }, 30_000);

  test("check 2: the demo trip lists 20 expenses, newest first", async () => {
    const page = await open("/?trip=1");
    await visible(page, "Taxi to Porto airport");
    // The list renders lazily: scroll the last row into view until all 20 are there.
    const rows = page.getByText(/^Recorded by /);
    for (let attempt = 0; attempt < 10 && (await rows.count()) < 20; attempt++) {
      await rows.last().scrollIntoViewIfNeeded();
      await page.mouse.wheel(0, VIEWPORT.height);
      await Bun.sleep(200);
    }
    expect(await rows.count()).toBe(20);
    expect(await sameRow(page, "Taxi to Porto airport", euro("31,50"))).toBe(true);
    const details = await page.getByText(/ · Paid by /).allTextContents();
    expect(details[0]).toBe("7 Jun 2026 · Paid by David");
    const days = details.map((detail) => Number(detail.split(" ")[0]));
    expect(days).toEqual([...days].sort((a, b) => b - a));
    expect(await noSidewaysScroll(page)).toBe(true);
    await page.close();
  }, 30_000);

  test("check 3: the tab bar", async () => {
    const page = await open("/?trip=1");
    await visible(page, euro("1.915,57"));
    const trip = page.getByRole("tab", { name: "Trip" });
    const balances = page.getByRole("tab", { name: "Balances" });
    const add = page.getByRole("button", { name: "+ Add expense" });
    expect(await trip.getAttribute("aria-selected")).toBe("true");
    expect(await balances.getAttribute("aria-selected")).toBe("false");
    const [tripBox, balancesBox, addBox] = await Promise.all([trip.boundingBox(), balances.boundingBox(), add.boundingBox()]);
    expect(addBox!.height).toBeGreaterThan(tripBox!.height);
    expect(addBox!.height).toBeGreaterThan(balancesBox!.height);
    // Only the bar's own padding lies between the button and the bottom of the screen.
    expect(VIEWPORT.height - (addBox!.y + addBox!.height)).toBeLessThanOrEqual(8);
    await page.close();
  }, 30_000);

  test("check 4: transfer rows are not buttons", async () => {
    const page = await open("/?trip=1");
    await visible(page, "Ana pays Ben");
    expect(await page.getByRole("button", { name: /Ana pays Ben/ }).count()).toBe(0);
    await page.getByText("Ana pays Ben", { exact: true }).click();
    await Bun.sleep(300);
    expect(await page.getByRole("tab", { name: "Trip" }).getAttribute("aria-selected")).toBe("true");
    await visible(page, "Total trip spend");
    expect(new URL(page.url()).search).toBe("?trip=1");
    await page.close();
  }, 30_000);

  test("check 5: balances of the demo trip", async () => {
    const page = await open("/?trip=1");
    await visible(page, euro("1.915,57"));
    await page.getByRole("tab", { name: "Balances" }).click();
    for (const [name, net] of [
      ["Ana", "-63,75"],
      ["Ben", "+91,40"],
      ["Chloé", "+27,07"],
      ["David", "-54,72"],
    ]) {
      await visible(page, euro(net));
      expect(await sameRow(page, name, euro(net))).toBe(true);
    }
    for (const [who, amount] of [
      ["Ana pays Ben", "63,75"],
      ["David pays Ben", "27,65"],
      ["David pays Chloé", "27,07"],
    ]) {
      expect(await sameRow(page, who, euro(amount))).toBe(true);
    }
    expect(await page.getByText(/ pays /).count()).toBe(3);
    await page.close();
  }, 30_000);

  test("check 6: a trip with no expenses", async () => {
    const page = await open("/?trip=2");
    await visible(page, "Empty weekend");
    await visible(page, euro("0,00"));
    await visible(page, "10 Jan 2026 – 12 Jan 2026 · 0 expenses");
    await visible(page, "3 people");
    await visible(page, "No expenses yet. Tap + Add expense to record the first one.");
    expect(await page.getByText("Who owes whom", { exact: true }).count()).toBe(0);
    await shot(page, "06-empty-trip");
    await page.close();
  }, 30_000);

  test("check 7: everyone is already even", async () => {
    const page = await open("/?trip=3");
    await visible(page, euro("80,00"));
    await visible(page, "Everyone is settled up.");
    expect(await page.getByText(/ pays /).count()).toBe(0);
    expect(await page.getByText(euro("40,00"), { exact: true }).count()).toBe(2);
    await shot(page, "07-even-trip");
    await page.close();
  }, 30_000);

  test("check 9: very large amounts and long names", async () => {
    const page = await open("/?trip=5");
    const total = page.getByText(euro(`2,34${NBSP}M`), { exact: true });
    await total.waitFor();
    const totalBox = await total.boundingBox();
    expect(totalBox!.height).toBeLessThan(44 * 1.6); // one line at hero size
    await visible(page, "1 Apr 2026 – 30 Apr 2026 · 3 expenses");
    await visible(page, "2 people");
    await visible(page, "Maximiliane Alexandra von Hohenzollern-Sigmaringen pays Noah");
    const transferAmount = await page.getByText(euro("1.172.839,46"), { exact: true }).boundingBox();
    expect(transferAmount!.height).toBeLessThan(16 * 1.6); // amount on one line
    expect(await page.getByText(euro("1.000.000,00"), { exact: true }).count()).toBe(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await shot(page, "09-large-amounts-long-names");
    await page.close();
  }, 30_000);

  test("checks 10 and 11: more than three transfers, then Show all", async () => {
    const page = await open("/?trip=6");
    await visible(page, euro("90,00"));
    await visible(page, "Quinn pays Olga");
    await visible(page, "Rosa pays Olga");
    await visible(page, "Sam pays Olga");
    expect(await page.getByText("Tara pays Paul", { exact: true }).count()).toBe(0);
    await visible(page, "Show all 4");
    await shot(page, "10-more-than-three-transfers");
    await page.getByText("Show all 4", { exact: true }).click();
    await visible(page, "Tara pays Paul");
    // The Balances tab is open: its heading appears next to the tab label.
    expect(await page.getByText("Balances", { exact: true }).count()).toBe(2);
    await page.close();
  }, 30_000);

  test("check 12: unknown trip, then back to My trips", async () => {
    const page = await open("/?trip=999");
    await visible(page, "This trip does not exist.");
    await shot(page, "12-unknown-trip");
    await page.getByText("Go to My trips", { exact: true }).click();
    await visible(page, "Lisbon & Porto");
    await visible(page, euro("1.915,57"));
    expect(new URL(page.url()).search).toBe("");
    await page.close();
  }, 30_000);

  test("check 13: invalid trip ids never reach the API", async () => {
    for (const value of ["abc", "0"]) {
      const page = await pageAsAna();
      const tripCalls: string[] = [];
      page.on("request", (request) => {
        if (request.url().startsWith(`${API_URL}/trips`)) tripCalls.push(request.url());
      });
      await page.goto(`${WEB_URL}/?trip=${value}`);
      await visible(page, "This trip does not exist.");
      expect(tripCalls).toEqual([]);
      await page.close();
    }
  }, 30_000);

  test("check 14: API unreachable, then Try again", async () => {
    const page = await pageAsAna();
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await page.goto(`${WEB_URL}/?trip=1`);
    await visible(page, `Could not reach the API at ${API_URL}.`);
    await shot(page, "14-api-unreachable");
    await page.unroute(`${API_URL}/**`);
    await page.getByText("Try again", { exact: true }).click();
    await visible(page, euro("1.915,57"));
    await page.close();
  }, 30_000);

  // Runs last: it adds an expense to trip 4. Also covers check 8 (uneven cents) before the add.
  test("checks 8 and 15: uneven cents, and the hero updates after adding an expense", async () => {
    const page = await open("/?trip=4");
    await visible(page, "5 Mar 2026 – 5 Mar 2026 · 1 expense");
    await visible(page, "Kim pays Jon");
    await visible(page, "Lea pays Jon");
    expect(await page.getByText(euro("3,33"), { exact: true }).count()).toBe(2);
    await page.getByRole("tab", { name: "Balances" }).click();
    for (const [name, net] of [
      ["Jon", "+6,66"],
      ["Kim", "-3,33"],
      ["Lea", "-3,33"],
    ]) {
      await visible(page, euro(net));
      expect(await sameRow(page, name, euro(net))).toBe(true);
    }
    await page.getByRole("tab", { name: "Trip" }).click();
    await visible(page, euro("10,00"));

    await page.getByText("+ Add expense", { exact: true }).click();
    // Person chips appear twice, in order: Paid by, Split between (all selected by default). Jon records it.
    const kim = page.getByRole("checkbox", { name: "Kim" });
    await page.getByPlaceholder("Dinner at the harbour").fill("Coffee");
    await page.getByPlaceholder("0,00").first().fill("3,00");
    await kim.nth(0).click();
    await page.getByText("Save expense", { exact: true }).click();

    await visible(page, euro("13,00"));
    await visible(page, "5 Mar 2026 – 5 Mar 2026 · 2 expenses");
    await visible(page, "Lea pays Jon");
    await visible(page, euro("4,33"));
    await visible(page, euro("1,33"));
    const lea = await page.getByText("Lea pays Jon", { exact: true }).boundingBox();
    const kimRow = await page.getByText("Kim pays Jon", { exact: true }).boundingBox();
    expect(lea!.y).toBeLessThan(kimRow!.y);
    await page.close();
  }, 30_000);
});
