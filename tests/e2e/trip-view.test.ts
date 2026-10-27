// Acceptance checks for epic 1 (specs/01-trip-at-a-glance-specification.md) in Chromium at 390x844.
// Self-contained: a freshly seeded API on its own SQLite file, and a static web export of the app that points at it.
// Screenshots are written to test-results/e2e/ (not committed).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const ROOT = join(import.meta.dir, "../..");
const API_PORT = 18080;
const WEB_PORT = 18081;
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const SHOTS = join(ROOT, "test-results/e2e");
const NBSP = " ";
const VIEWPORT = { width: 390, height: 844 };

const euro = (text: string) => `${text}${NBSP}€`;

const work = mkdtempSync(join(tmpdir(), "e2e-"));
const env = { ...process.env, DB_PATH: join(work, "app.sqlite"), EXPO_PUBLIC_API_URL: API_URL };

function run(cmd: string[], cwd: string) {
  const result = Bun.spawnSync(cmd, { cwd, env, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  }
}

// Fresh seed, then a production web build with the test API URL baked in.
run(["php", "bin/init-db.php"], join(ROOT, "packages/api"));
run(["bunx", "expo", "export", "--platform", "web", "--output-dir", join(work, "web")], ROOT);

let api: ReturnType<typeof Bun.spawn>;
let web: ReturnType<typeof Bun.serve>;
let browser: Browser;

beforeAll(async () => {
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
    const ready = await fetch(`${API_URL}/trips`).then((r) => r.ok).catch(() => false);
    if (ready) break;
    await Bun.sleep(100);
  }
  mkdirSync(SHOTS, { recursive: true });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  web?.stop(true);
  api?.kill();
  rmSync(work, { recursive: true, force: true });
});

async function open(path: string): Promise<Page> {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${WEB_URL}${path}`);
  return page;
}

const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });

const visible = (page: Page, text: string) => page.getByText(text, { exact: true }).first().waitFor({ timeout: 10_000 });

async function aboveTheFold(page: Page, text: string): Promise<boolean> {
  const box = await page.getByText(text, { exact: true }).first().boundingBox();
  return box !== null && box.y + box.height <= VIEWPORT.height;
}

describe("epic 1: trip at a glance (390x844)", () => {
  test("check 1: demo trip shows the total and who owes whom above the fold", async () => {
    const page = await open("/");
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

  test("check 12: unknown trip, then open the demo trip", async () => {
    const page = await open("/?trip=999");
    await visible(page, "This trip does not exist.");
    await shot(page, "12-unknown-trip");
    await page.getByText("Open the demo trip", { exact: true }).click();
    await visible(page, euro("1.915,57"));
    expect(new URL(page.url()).search).toBe("");
    await page.close();
  }, 30_000);

  test("check 13: invalid trip ids never reach the API", async () => {
    for (const value of ["abc", "0"]) {
      const page = await browser.newPage({ viewport: VIEWPORT });
      const apiCalls: string[] = [];
      page.on("request", (request) => {
        if (request.url().startsWith(API_URL)) apiCalls.push(request.url());
      });
      await page.goto(`${WEB_URL}/?trip=${value}`);
      await visible(page, "This trip does not exist.");
      expect(apiCalls).toEqual([]);
      await page.close();
    }
  }, 30_000);

  test("check 14: API unreachable, then Try again", async () => {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await page.goto(WEB_URL);
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

    await page.getByText("+ Add expense", { exact: true }).click();
    // Person chips appear three times, in order: Recorded by, Paid by, Split between (all selected by default).
    const kim = page.getByRole("checkbox", { name: "Kim" });
    await kim.nth(0).click();
    await page.getByPlaceholder("Dinner at the harbour").fill("Coffee");
    await page.getByPlaceholder("0,00").first().fill("3,00");
    await kim.nth(1).click();
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
