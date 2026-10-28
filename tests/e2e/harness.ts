// Shared by the e2e suites: a freshly seeded API on its own SQLite file, a static web export of the app that points at
// it, and Chromium at 390x844. The web export is built once per run; each suite gets a fresh seed in startServers().
// Screenshots are written to test-results/e2e/ (not committed).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const ROOT = join(import.meta.dir, "../..");
const API_PORT = 18080;
const WEB_PORT = 18081;
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const SHOTS = join(ROOT, "test-results/e2e");
export const NBSP = " ";
export const VIEWPORT = { width: 390, height: 844 };
export const DEMO_PASSWORD = "travel-demo-2026";
export const TOKEN_KEY = "travel-expenses.token";

export const euro = (text: string) => `${text}${NBSP}€`;

const work = mkdtempSync(join(tmpdir(), "e2e-"));
const env = { ...process.env, DB_PATH: join(work, "app.sqlite"), EXPO_PUBLIC_API_URL: API_URL };

function run(cmd: string[], cwd: string): string {
  const result = Bun.spawnSync(cmd, { cwd, env, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.toString();
}

// A production web build with the test API URL baked in, once for all suites.
run(["bunx", "expo", "export", "--platform", "web", "--output-dir", join(work, "web")], ROOT);

let api: ReturnType<typeof Bun.spawn> | undefined;
/** What the API's start step (bin/init-db.php) printed when startServers() created the fresh database. */
export let firstStartLog = "";
let web: ReturnType<typeof Bun.serve> | undefined;
export let browser: Browser;

/** Fresh seed, then the API, the web server and Chromium. Call in beforeAll. */
export async function startServers() {
  rmSync(join(work, "app.sqlite"), { force: true });
  firstStartLog = initDb();
  api = Bun.spawn(["php", "-S", `127.0.0.1:${API_PORT}`, "-t", "public", "public/index.php"], {
    cwd: join(ROOT, "packages/api"),
    env,
    stdout: "ignore",
    stderr: "ignore",
  });
  web = Bun.serve({
    port: WEB_PORT,
    hostname: "127.0.0.1",
    async fetch(request) {
      const file = Bun.file(join(work, "web", new URL(request.url).pathname));
      return new Response((await file.exists()) ? file : Bun.file(join(work, "web", "index.html")));
    },
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    const ready = await fetch(`${API_URL}/health`).then((r) => r.ok).catch(() => false);
    if (ready) break;
    await Bun.sleep(100);
  }
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
}

/** Runs the API's start step (bin/init-db.php) against the test database again, as a restart does; returns its log. */
export function initDb(): string {
  return run(["php", "bin/init-db.php"], join(ROOT, "packages/api"));
}

/** Call in afterAll. */
export async function stopServers() {
  await browser?.close();
  web?.stop(true);
  api?.kill();
  await api?.exited;
}

process.on("exit", () => rmSync(work, { recursive: true, force: true }));

/** Logs in through the API and returns the session token. */
export async function tokenFor(email: string, password = DEMO_PASSWORD): Promise<string> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return ((await response.json()) as { token: string }).token;
}

/** A new page with no stored session (a fresh browser profile). */
export async function open(path: string): Promise<Page> {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${WEB_URL}${path}`);
  return page;
}

/** A new page already logged in as `email` (the token is put in localStorage before the app starts). */
export async function openAs(email: string, path: string): Promise<Page> {
  const token = await tokenFor(email);
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${WEB_URL}/favicon.ico`);
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [TOKEN_KEY, token]);
  await page.goto(`${WEB_URL}${path}`);
  return page;
}

/** Fills the Login screen and taps "Log in". */
export async function logInWithForm(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/** The menu button in the app bar ("Menu, language: English", "Menú, idioma: …", "Menu, langue : …"). */
export const menuButton = (page: Page) => page.getByRole("button", { name: /^Men[uú],/ });

/** The rows of the open menu below the languages ("Settings", "Log out", in the language shown). */
export const menuItem = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });

/**
 * Opens the menu in the app bar and taps a row: "Settings" or "Log out" in the language shown. Waits until the menu is
 * gone: while it closes, focus returns to the menu button, and typing into a field in that moment is lost.
 */
export async function fromMenu(page: Page, name: string) {
  await menuButton(page).click();
  await menuItem(page, name).click();
  await menuItem(page, name).waitFor({ state: "detached" });
}

/** Opens the menu in the app bar and picks a language by its own name. */
export async function languageFromMenu(page: Page, name: string) {
  await menuButton(page).click();
  await page.getByRole("radio", { name, exact: true }).click();
  await page.getByRole("radio", { name, exact: true }).waitFor({ state: "detached" });
}

export const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

export const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).first().waitFor({ timeout: 10_000 });

export async function aboveTheFold(page: Page, text: string): Promise<boolean> {
  const box = await page.getByText(text, { exact: true }).first().boundingBox();
  return box !== null && box.y + box.height <= VIEWPORT.height;
}

// True when the first `left` text shares a row (vertical overlap) with any `right` text.
export async function sameRow(page: Page, left: string, right: string): Promise<boolean> {
  const a = await page.getByText(left, { exact: true }).first().boundingBox();
  for (const match of await page.getByText(right, { exact: true }).all()) {
    const b = await match.boundingBox();
    if (a !== null && b !== null && a.y < b.y + b.height && b.y < a.y + a.height) return true;
  }
  return false;
}

export const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
