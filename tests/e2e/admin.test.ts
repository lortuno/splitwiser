// Acceptance checks for epic 7 (specs/accounts/07-admin-account-specification.md) in Chromium at 390x844.
// The checks run in order on one fresh seed: the admin creates trip 9 with Ana (check 4), which check 5 uses, and is
// renamed and switched to Spanish in check 6.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import {
  API_URL,
  euro,
  firstStartLog,
  fromMenu,
  initDb,
  logInWithForm,
  mailsTo,
  menuButton,
  menuItem,
  newMail,
  open,
  shot,
  startServers,
  stopServers,
  TOKEN_KEY,
  tokenFor,
  VIEWPORT,
  visible,
} from "./harness";

beforeAll(startServers);
afterAll(stopServers);

const ADMIN_EMAIL = "admin@travel.local";
const ADMIN_PASSWORD = "admin123";
const EMPTY = 'You are not on any group yet. Start one with "+ New group", or ask a friend to add you with your email.';

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const field = (page: Page, label: string, index = 0) => page.getByLabel(label, { exact: true }).nth(index);

/** The trip names on "My groups", top to bottom. */
async function tripCards(page: Page): Promise<string[]> {
  await page.getByText(/^Logged in as /).waitFor();
  return page.getByRole("button", { name: /Total/ }).evaluateAll((cards) => cards.map((card) => card.querySelector("div")?.textContent ?? ""));
}

async function me(page: Page) {
  const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
  return (await (await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })).json()) as {
    id: number;
    display_name: string;
    language: string;
  };
}

async function logOut(page: Page) {
  await fromMenu(page, "Log out");
  await button(page, "Log in").waitFor();
}

describe("epic 7: admin account in the seed (390x844)", () => {
  test("checks 1 to 3: log in as admin, email as typed, wrong password and taken email", async () => {
    const page = await open("/");
    await logInWithForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await visible(page, "Logged in as Admin");
    await visible(page, EMPTY);
    const newTrip = (await button(page, "+ New group").boundingBox())!;
    expect(VIEWPORT.height - (newTrip.y + newTrip.height)).toBeLessThanOrEqual(16);
    await menuButton(page).click();
    await menuItem(page, "Settings").waitFor();
    await menuItem(page, "Log out").waitFor();
    await page.keyboard.press("Escape");
    await shot(page, "e7-01-admin-empty-trips");

    await logOut(page);
    await logInWithForm(page, "  ADMIN@Travel.local ", ADMIN_PASSWORD);
    await visible(page, "Logged in as Admin");

    await logOut(page);
    await logInWithForm(page, ADMIN_EMAIL, "admin1234");
    await visible(page, "Email or password is wrong.");
    await button(page, "No account yet? Sign up").click();
    await field(page, "Your name").fill("Someone");
    await field(page, "Email").fill(ADMIN_EMAIL);
    await field(page, "Password (at least 8 characters)").fill("travel-demo-2026");
    const before = (await mailsTo(ADMIN_EMAIL)).length;
    await button(page, "Create account").click();
    await visible(page, "Check your email"); // as for any email (feature 8)
    const mail = await newMail(ADMIN_EMAIL, before);
    expect(mail.subject).toBe("You already have an account");
    expect(mail.text).not.toMatch(/^\s+\d{6}\s*$/m);
    expect((await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })).status).toBe(200);
    await page.close();
  }, 30_000);

  test("checks 4 and 5: the admin creates a trip with Ana, and Ana sees it", async () => {
    const page = await open("/");
    await logInWithForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await button(page, "+ New group").click();
    await field(page, "Group name").fill("Team lunch");
    await field(page, "Start date").fill("2026-11-03");
    await field(page, "End date").fill("2026-11-03");
    await field(page, "Name").fill("Ana");
    await field(page, "Email (optional)").fill("ana@example.com");
    await button(page, "Create group").click();
    await visible(page, "Team lunch");
    await visible(page, euro("0,00"));
    await visible(page, "3 Nov 2026 – 3 Nov 2026 · 0 expenses");
    await visible(page, "2 people");
    expect(new URL(page.url()).search).toBe("?trip=9");
    await shot(page, "e7-04-admin-created-trip");

    await button(page, "‹ My groups").click();
    await logOut(page);
    await logInWithForm(page, "ana@example.com");
    expect(await tripCards(page)).toEqual(["Team lunch", "Madrid weekend", "Lisbon & Porto"]);
    for (const total of ["0,00", "78,30", "1.915,57"]) await visible(page, euro(total));
    await page.getByText("Team lunch", { exact: true }).click();
    await visible(page, "2 people");
    await page.close();
  }, 30_000);

  test("check 6: a restart keeps the admin's changes", async () => {
    const page = await open("/");
    await logInWithForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await fromMenu(page, "Settings");
    await field(page, "Name").fill("Laura");
    await button(page, "Save").click();
    await visible(page, "Logged in as Laura");
    await fromMenu(page, "Settings");
    await page.getByRole("button", { name: "Language: English", exact: true }).click();
    await page.getByRole("radio", { name: "Español", exact: true }).click();
    await visible(page, "Ajustes");

    expect(initDb()).toContain("Admin account exists, left unchanged.");
    await page.reload();
    await visible(page, "Sesión iniciada como Laura");
    expect((await me(page)).language).toBe("es");
    expect((await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })).status).toBe(200);
    await page.close();
  }, 30_000);

  test("check 7: the start log on a fresh database, then on the next start", () => {
    expect(firstStartLog).toContain("Database created and seeded.");
    expect(firstStartLog).toContain("Admin account created: admin@travel.local");
    expect(initDb()).toContain("Admin account exists, left unchanged.");
  });

  // Ana is on "Team lunch" since check 4, so Chloé (also on Madrid and Lisbon) shows the unchanged demo trips.
  test("check 8: the demo accounts are unchanged", async () => {
    const page = await open("/");
    await logInWithForm(page, "chloe@example.com");
    expect(await tripCards(page)).toEqual(["Madrid weekend", "Lisbon & Porto"]);
    await page.close();

    const id = async (token: string) => ((await (await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { id: number; display_name: string; language: string });
    expect((await id(await tokenFor("ana@example.com"))).id).toBe(1);
    const admin = await id(await tokenFor(ADMIN_EMAIL, ADMIN_PASSWORD));
    expect(admin.id).toBe(11);
  });
});
