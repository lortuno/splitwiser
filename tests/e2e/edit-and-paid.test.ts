// Acceptance checks for epic 4 (specs/04-edit-expenses-and-mark-as-paid-specification.md) in Chromium at 390x844.
// The checks run in order on one fresh seed: checks 4–14 build on each other (Madrid is edited, marked as paid and
// reopened; Lisbon is marked as paid in check 13 and reopened in check 17).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import { API_URL, NBSP, VIEWPORT, euro, openAs, sameRow, shot, startServers, stopServers, tokenFor, visible } from "./harness";

beforeAll(startServers);
afterAll(stopServers);

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const text = (page: Page, value: string | RegExp) =>
  typeof value === "string" ? page.getByText(value, { exact: true }) : page.getByText(value);
const amountField = (page: Page) => page.getByPlaceholder("0,00").first();
const nameField = (page: Page) => page.getByPlaceholder("Dinner at the harbour");

/** "28 Oct 2026": the browser's local date, as the paid card shows it. */
const today = (page: Page) =>
  page.evaluate(() => {
    const now = new Date();
    const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][now.getMonth()];
    return `${now.getDate()} ${month} ${now.getFullYear()}`;
  });

/** Logs in as `email` and opens the trip from "My trips". */
async function openTrip(email: string, tripName: string): Promise<Page> {
  const page = await openAs(email, "/");
  await text(page, tripName).click();
  await visible(page, "Total trip spend");
  return page;
}

async function openExpense(page: Page, name: string) {
  await text(page, name).click();
  await visible(page, "Edit expense");
}

async function expenseIds(tripId: number, token: string): Promise<Record<string, number>> {
  const response = await fetch(`${API_URL}/trips/${tripId}/expenses`, { headers: { Authorization: `Bearer ${token}` } });
  const expenses = (await response.json()) as { id: number; name: string }[];
  return Object.fromEntries(expenses.map((e) => [e.name, e.id]));
}

async function api(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await response.json().catch(() => null)) as { error?: { code: string } } | null;
  return [response.status, data?.error?.code ?? null];
}

describe("epic 4: edit expenses and mark a trip as paid (390x844)", () => {
  test("check 1: open trip view with tappable rows", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await button(page, "‹ My trips").waitFor();
    const markPaid = await button(page, "Mark as paid").boundingBox();
    expect(markPaid!.height).toBeGreaterThanOrEqual(48);
    // Since epic 5 a row's name starts with its category ("Food, Tapas at …").
    for (const name of [/^\w+, Tapas at Mercado de San Miguel/, /^\w+, Prado Museum tickets/]) {
      const row = page.getByRole("button", { name });
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    expect(await text(page, "›").count()).toBe(2);
    expect(await text(page, "Edited").count()).toBe(0);
    await button(page, "+ Add expense").waitFor();
    await shot(page, "e4-01-open-trip-view");
    await page.close();
  }, 30_000);

  test("checks 2 and 3: the prefilled edit form, then a save without changes", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openExpense(page, "Tapas at Mercado de San Miguel");
    expect(await nameField(page).inputValue()).toBe("Tapas at Mercado de San Miguel");
    expect(await page.getByPlaceholder("2026-06-01").inputValue()).toBe("2026-09-12");
    expect(await amountField(page).inputValue()).toBe("48,30");
    // Person chips appear twice, in order: Paid by, Split between.
    expect(await page.getByRole("checkbox", { name: "Chloé" }).nth(0).isChecked()).toBe(true);
    expect(await page.getByRole("checkbox", { name: "Ana" }).nth(0).isChecked()).toBe(false);
    expect(await page.getByRole("checkbox", { name: "Ana" }).nth(1).isChecked()).toBe(true);
    expect(await page.getByRole("checkbox", { name: "Chloé" }).nth(1).isChecked()).toBe(true);
    expect(await page.getByRole("radio", { name: "Equally" }).isChecked()).toBe(true);
    // The split preview: one row each for Ana and Chloé.
    await visible(page, euro("24,15"));
    expect(await text(page, euro("24,15")).count()).toBe(2);
    const save = await button(page, "Save changes").boundingBox();
    expect(save!.height).toBeGreaterThanOrEqual(56);
    expect(VIEWPORT.height - (save!.y + save!.height)).toBeLessThanOrEqual(16);
    expect(await page.getByRole("tab").count()).toBe(0);
    await shot(page, "e4-02-edit-form-prefilled");

    await button(page, "Save changes").click();
    await visible(page, euro("78,30"));
    expect(await sameRow(page, "Ana pays Chloé", euro("9,15"))).toBe(true);
    expect(await text(page, "Edited").count()).toBe(0);
    await page.close();
  }, 30_000);

  test("check 4: edit the amount", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openExpense(page, "Tapas at Mercado de San Miguel");
    await amountField(page).fill("50,01");
    await button(page, "Save changes").click();

    await visible(page, euro("80,01"));
    expect(await sameRow(page, "Ana pays Chloé", euro("10,01"))).toBe(true);
    expect(await sameRow(page, "Tapas at Mercado de San Miguel", euro("50,01"))).toBe(true);
    await visible(page, "Recorded by Chloé · Split between 2");
    expect(await text(page, "Edited").count()).toBe(1);
    await shot(page, "e4-04-edited-amount");
    await page.getByRole("tab", { name: "Balances" }).click();
    await visible(page, euro("-10,01"));
    await visible(page, euro("+10,01"));
    await page.close();
  }, 30_000);

  test("check 5: edit the split type", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openExpense(page, "Prado Museum tickets");
    await page.getByRole("radio", { name: "Percent" }).click();
    await page.getByLabel("Ana", { exact: true }).fill("70");
    await page.getByLabel("Chloé", { exact: true }).fill("30");
    await visible(page, euro("21,00"));
    await visible(page, euro("9,00"));
    await button(page, "Save changes").click();

    await visible(page, euro("80,01"));
    expect(await sameRow(page, "Ana pays Chloé", euro("16,01"))).toBe(true);
    expect(await text(page, "Edited").count()).toBe(2);
    await visible(page, "Recorded by Ana · Split between 2");
    await button(page, "‹ My trips").click();
    expect(await sameRow(page, "Total", euro("80,01"))).toBe(true);
    await page.close();
  }, 30_000);

  test("check 6: an invalid edit shows the add form's messages, Cancel keeps the expense", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openExpense(page, "Prado Museum tickets");
    await nameField(page).fill("");
    await amountField(page).fill("0");
    await button(page, "Save changes").click();
    await visible(page, "Enter a name for the expense.");
    await visible(page, "Enter an amount greater than 0.");
    await button(page, "Cancel").click();

    await visible(page, euro("80,01"));
    expect(await sameRow(page, "Prado Museum tickets", euro("30,00"))).toBe(true);
    await page.close();
  }, 30_000);

  test("checks 7 to 9: confirm, mark as paid, the paid trip view and its balances", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await button(page, "Mark as paid").click();
    for (const value of [
      "Mark this trip as paid?",
      "These payments will be treated as done:",
      "Nobody can add or change expenses until the trip is reopened.",
    ]) {
      await visible(page, value);
    }
    expect(await sameRow(page, "Ana pays Chloé", euro("16,01"))).toBe(true);
    const confirm = await button(page, "Mark as paid").boundingBox();
    expect(confirm!.height).toBeGreaterThanOrEqual(56);
    expect((await button(page, "Cancel").boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(await page.getByRole("tab").count()).toBe(0);
    await shot(page, "e4-07-mark-paid-confirmation");
    await button(page, "Cancel").click();
    await visible(page, "Who owes whom");
    await button(page, "+ Add expense").waitFor();
    await button(page, "Mark as paid").click();

    await button(page, "Mark as paid").click();
    await visible(page, "✓ Paid");
    await visible(page, `Marked as paid by Ana on ${await today(page)}.`);
    await visible(page, euro("80,01"));
    expect(await text(page, "Who owes whom").count()).toBe(0);
    await button(page, "Reopen").waitFor();
    expect(await page.getByRole("tab").count()).toBe(2);
    expect(await button(page, "+ Add expense").count()).toBe(0);
    expect(await text(page, "Edited").count()).toBe(2);
    expect(await text(page, "›").count()).toBe(0);
    await text(page, "Tapas at Mercado de San Miguel").click();
    await Bun.sleep(300);
    expect(await text(page, "Edit expense").count()).toBe(0);
    await shot(page, "e4-08-paid-trip-view");

    await page.getByRole("tab", { name: "Balances" }).click();
    for (const amount of ["30,00", "46,01", "50,01", "34,00"]) {
      await visible(page, euro(amount));
    }
    expect(await text(page, "Settled").count()).toBe(2);
    await visible(page, "Everyone is settled up.");
    expect(await text(page, /16,01/).count()).toBe(0);
    await shot(page, "e4-09-paid-balances");
    await page.close();
  }, 30_000);

  test("check 10: My trips shows paid", async () => {
    const page = await openAs("ana@example.com", "/");
    await visible(page, "Madrid weekend");
    expect(await text(page, "✓ Paid").count()).toBe(1);
    expect(await sameRow(page, "Madrid weekend", "✓ Paid")).toBe(true);
    expect(await sameRow(page, "Total", euro("80,01"))).toBe(true);
    await page.close();
  }, 30_000);

  test("check 11: another member sees the paid trip", async () => {
    const page = await openTrip("chloe@example.com", "Madrid weekend");
    await visible(page, `Marked as paid by Ana on ${await today(page)}.`);
    await button(page, "Reopen").waitFor();
    await page.close();
  }, 30_000);

  test("check 12: the API locks a paid trip", async () => {
    const chloe = await tokenFor("chloe@example.com");
    const { "Tapas at Mercado de San Miguel": tapas } = await expenseIds(7, chloe);
    const body = {
      name: "Churros",
      date: "2026-09-13",
      amount_cents: 600,
      paid_by: [{ person_id: 1, amount_cents: 600 }],
      split: { type: "equal", between: [{ person_id: 1, value: null }] },
    };
    expect(await api("POST", "/trips/7/expenses", chloe, body)).toEqual([409, "trip_paid"]);
    expect(await api("POST", "/trips/7/expenses?dry_run=1", chloe, body)).toEqual([409, "trip_paid"]);
    expect(await api("PUT", `/trips/7/expenses/${tapas}`, chloe, body)).toEqual([409, "trip_paid"]);
    expect(await api("POST", "/trips/7/paid", chloe)).toEqual([409, "already_paid"]);
  });

  test("check 13: the trip is marked as paid while someone edits", async () => {
    const ben = await openTrip("ben@example.com", "Lisbon & Porto");
    await openExpense(ben, "Taxi to Porto airport");

    const ana = await openTrip("ana@example.com", "Lisbon & Porto");
    await button(ana, "Mark as paid").click();
    await button(ana, "Mark as paid").click();
    await visible(ana, "✓ Paid");
    await ana.close();

    await amountField(ben).fill("32,00");
    await button(ben, "Save changes").click();
    await visible(ben, "This trip is marked as paid. Reopen it to make changes.");
    expect(await amountField(ben).inputValue()).toBe("32,00");
    await shot(ben, "e4-13-paid-while-editing");
    await button(ben, "Cancel").click();
    await visible(ben, `Marked as paid by Ana on ${await today(ben)}.`);
    expect(await sameRow(ben, "Taxi to Porto airport", euro("31,50"))).toBe(true);
    await ben.close();
  }, 30_000);

  test("check 14: reopen", async () => {
    const page = await openTrip("chloe@example.com", "Madrid weekend");
    await button(page, "Reopen").click();
    await visible(page, "Who owes whom");
    expect(await sameRow(page, "Ana pays Chloé", euro("16,01"))).toBe(true);
    await button(page, "+ Add expense").waitFor();
    expect(await text(page, "›").count()).toBe(2);
    expect(await text(page, "Edited").count()).toBe(2);
    await button(page, "Mark as paid").waitFor();
    expect(await api("POST", "/trips/7/reopen", await tokenFor("chloe@example.com"))).toEqual([409, "already_open"]);
    await button(page, "‹ My trips").click();
    await visible(page, "Madrid weekend");
    expect(await text(page, "✓ Paid").count()).toBe(1); // Lisbon, marked in check 13
    expect(await sameRow(page, "Madrid weekend", "✓ Paid")).toBe(false);
    await page.close();
  }, 30_000);

  test("check 15: paid with nothing to settle", async () => {
    const page = await openTrip("eva@example.com", "Empty weekend");
    await button(page, "Mark as paid").click();
    await visible(page, "Everyone is settled up.");
    expect(await text(page, "These payments will be treated as done:").count()).toBe(0);
    await button(page, "Mark as paid").click();
    await visible(page, "✓ Paid");
    await visible(page, euro("0,00"));
    await visible(page, `Marked as paid by Eva on ${await today(page)}.`);
    await page.close();
  }, 30_000);

  test("check 16: the very large amount saves unchanged", async () => {
    const page = await openAs("noah@example.com", "/?trip=5");
    await visible(page, "Private jet charter");
    await openExpense(page, "Private jet charter");
    expect(await amountField(page).inputValue()).toBe("1000000,00");
    await button(page, "Save changes").click();
    await visible(page, euro(`2,34${NBSP}M`));
    expect(await sameRow(page, "Private jet charter", euro("1.000.000,00"))).toBe(true);
    expect(await text(page, "Edited").count()).toBe(0);
    await page.close();
  }, 30_000);

  test("check 17: API unreachable on save, mark as paid and reopen", async () => {
    const page = await openTrip("ana@example.com", "Madrid weekend");
    await openExpense(page, "Prado Museum tickets");
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await button(page, "Save changes").click();
    await visible(page, "TypeError: Failed to fetch");
    expect(await nameField(page).inputValue()).toBe("Prado Museum tickets");
    await page.unroute(`${API_URL}/**`);
    await button(page, "Save changes").click();
    await visible(page, "Total trip spend");

    await button(page, "Mark as paid").click();
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await button(page, "Mark as paid").click();
    await visible(page, `Could not reach the API at ${API_URL}.`);
    await shot(page, "e4-17-api-unreachable-mark-paid");
    await page.unroute(`${API_URL}/**`);
    await button(page, "Cancel").click();
    await button(page, "Mark as paid").waitFor();
    await visible(page, "Who owes whom");

    await button(page, "‹ My trips").click();
    await text(page, "Lisbon & Porto").click();
    await button(page, "Reopen").waitFor();
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await button(page, "Reopen").click();
    await visible(page, `Could not reach the API at ${API_URL}.`);
    await visible(page, "✓ Paid");
    await page.unroute(`${API_URL}/**`);
    await button(page, "Reopen").click();
    await button(page, "Mark as paid").waitFor();
    expect(await text(page, `Could not reach the API at ${API_URL}.`).count()).toBe(0);
    await visible(page, "Who owes whom");
    await page.close();
  }, 30_000);

  test("check 18: API errors", async () => {
    const ana = await tokenFor("ana@example.com");
    const { "Tapas at Mercado de San Miguel": tapas } = await expenseIds(7, ana);
    const body = { name: "Tapas" };
    expect(await api("PUT", `/trips/1/expenses/${tapas}`, ana, body)).toEqual([404, "not_found"]);
    expect(await api("PUT", `/trips/7/expenses/${tapas}`, await tokenFor("ben@example.com"), body)).toEqual([403, "not_a_member"]);
    for (const [method, path] of [
      ["PUT", `/trips/7/expenses/${tapas}`],
      ["POST", "/trips/7/paid"],
      ["POST", "/trips/7/reopen"],
    ]) {
      expect(await api(method, path, null, body)).toEqual([401, "unauthenticated"]);
    }
  });
});
