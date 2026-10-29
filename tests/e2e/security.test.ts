// Acceptance checks 1–12 of feature 8, security, in Chromium at 390x844, with the e2e durations of the harness (code
// 60 s, lock 60 s, 5 s between codes), so check 8's lock reads "1 minute". Codes are read from Mailpit. Check 13 is the
// whole e2e run, check 14 the PHP suite, check 15 tests/functional/audit.test.ts.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import {
  API_URL,
  browser,
  codeIn,
  euro,
  languageFromMenu,
  logInWithForm,
  mailsTo,
  newMail,
  open,
  openAs,
  restartApi,
  sameRow,
  shot,
  startServers,
  stopServers,
  VIEWPORT,
  visible,
  WEB_URL,
} from "./harness";

beforeAll(startServers);
afterAll(stopServers);

const NNBSP = " ";
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

/** From Login: opens Sign-up, fills it and taps "Create account" (English labels). Returns the emails before. */
async function signUp(page: Page, name: string, email: string, password: string): Promise<number> {
  await button(page, "No account yet? Sign up").click();
  await field(page, "Your name").fill(name);
  await field(page, "Email").fill(email);
  await field(page, "Password (at least 8 characters)").fill(password);
  const before = (await mailsTo(email)).length;
  await button(page, "Create account").click();
  return before;
}

async function enterCode(page: Page, code: string, confirm = "Confirm") {
  await page.getByLabel(/^(Code|Código)$/).fill(code);
  await button(page, confirm).click();
}

/** A 6-digit code that is not `code`. */
const otherThan = (code: string) => (code === "000000" ? "111111" : "000000");

describe("feature 8: security (390x844)", () => {
  test("check 1: sign up in French", async () => {
    const page = await open("/");
    await languageFromMenu(page, "Français");
    await button(page, `Pas encore de compte${NNBSP}? S’inscrire`).click();
    await field(page, "Votre nom").fill("Margot");
    await field(page, "E-mail").fill("margot@example.com");
    await field(page, "Mot de passe (8 caractères minimum)").fill("long-enough-1");
    const before = (await mailsTo("margot@example.com")).length;
    await button(page, "Créer le compte").click();

    await visible(page, "Consultez vos e-mails");
    await visible(page, "Nous avons envoyé un code à 6 chiffres à margot@example.com. Il est valable 1 minute.");
    await page.getByText(/^Envoyer un nouveau code dans 0:0\d$/).waitFor();
    await button(page, "Confirmer").waitFor();
    const confirm = (await button(page, "Confirmer").boundingBox())!;
    expect(confirm.height).toBeGreaterThanOrEqual(56);
    expect(VIEWPORT.height - (confirm.y + confirm.height)).toBeLessThanOrEqual(16);
    const mail = await newMail("margot@example.com", before);
    expect(mail.subject).toBe("Confirmez votre adresse e-mail");
    expect(mail.subject).not.toMatch(/\d{6}/);
    expect(mail.text).toContain("Bonjour Margot,");
    await shot(page, "e8-01-check-your-email-fr");

    await enterCode(page, codeIn(mail), "Confirmer");
    await visible(page, "Connecté en tant que Margot");
    await page.close();
  }, 30_000);

  test("checks 2 and 3: three wrong codes, then a new code", async () => {
    const page = await open("/");
    const before = await signUp(page, "Nina", "nina@example.com", "long-enough-1");
    const first = codeIn(await newMail("nina@example.com", before));

    for (const message of ["This code is wrong. 2 tries left.", "This code is wrong. 1 try left.", "Too many wrong codes. Send a new code."]) {
      await enterCode(page, otherThan(first));
      await visible(page, message);
    }
    await shot(page, "e8-02-wrong-codes");
    await enterCode(page, first);
    await visible(page, "Too many wrong codes. Send a new code.");

    await button(page, "Send a new code").waitFor({ timeout: 10_000 });
    await button(page, "Send a new code").click();
    await visible(page, "We sent a new code.");
    expect(await page.getByLabel("Code", { exact: true }).inputValue()).toBe("");
    await page.getByText(/^Send a new code in 0:0[1-5]$/).waitFor();
    const second = codeIn(await newMail("nina@example.com", before + 1));
    if (second !== first) {
      await enterCode(page, first);
      await visible(page, "This code is wrong. 2 tries left.");
    }
    await enterCode(page, second);
    await visible(page, "Logged in as Nina");
    await page.close();
  }, 40_000);

  test("check 4: sign-up with an existing email", async () => {
    const page = await open("/");
    const before = await signUp(page, "Someone", "ana@example.com", "another-pass-1");
    await visible(page, "Check your email");
    const mail = await newMail("ana@example.com", before);
    expect([mail.subject, mail.text.startsWith("Hi Ana,")]).toEqual(["You already have an account", true]);
    expect(mail.text).not.toMatch(/^\s+\d{6}\s*$/m);
    await shot(page, "e8-04-existing-email");

    await button(page, "‹ Log in").click();
    await logInWithForm(page, "ana@example.com", "another-pass-1");
    await visible(page, "Email or password is wrong.");
    await logInWithForm(page, "ana@example.com", "travel-demo-2026");
    await visible(page, "Logged in as Ana");
    await page.close();
  }, 30_000);

  test("check 5: sign-up again before confirming", async () => {
    const page = await open("/");
    const before = await signUp(page, "Olaf", "olaf@example.com", "first-pass-1");
    await visible(page, "Check your email");
    await button(page, "‹ Log in").click();
    await signUp(page, "Olaf B", "olaf@example.com", "second-pass-1");
    await visible(page, "Check your email");
    await enterCode(page, codeIn(await newMail("olaf@example.com", before)));
    await visible(page, "Logged in as Olaf B");
    await page.close();

    const again = await open("/");
    await logInWithForm(again, "olaf@example.com", "first-pass-1");
    await visible(again, "Email or password is wrong.");
    await logInWithForm(again, "olaf@example.com", "second-pass-1");
    await visible(again, "Logged in as Olaf B");
    await again.close();
  }, 30_000);

  test("check 6: login to an unverified account", async () => {
    const page = await open("/");
    const before = await signUp(page, "Paula", "paula@example.com", "long-enough-1");
    await visible(page, "Check your email");
    await button(page, "‹ Log in").click();
    await logInWithForm(page, "paula@example.com", "wrong-pass-1");
    await visible(page, "Email or password is wrong.");
    await Bun.sleep(5_500); // the e2e gap between codes
    expect((await mailsTo("paula@example.com")).length).toBe(before + 1);

    await logInWithForm(page, "paula@example.com", "long-enough-1");
    await visible(page, "Check your email");
    const second = await newMail("paula@example.com", before + 1);
    await enterCode(page, codeIn(second));
    await visible(page, "Logged in as Paula");
    await page.close();
  }, 30_000);

  test("check 7: invites wait for the code", async () => {
    const page = await open("/");
    const before = await signUp(page, "Inés García", "ines@example.com", "long-enough-1");
    await visible(page, "Check your email");

    const pia = await openAs("pia@example.com", "/?trip=8");
    expect(await sameRow(pia, "Inés pays Pia", euro("100,00"))).toBe(true);
    await pia.close();

    await enterCode(page, codeIn(await newMail("ines@example.com", before)));
    await visible(page, "Logged in as Inés García");
    await visible(page, "Ski week");
    await visible(page, euro("300,00"));
    await shot(page, "e8-07-invite-after-code");
    await page.close();

    const piaAfter = await openAs("pia@example.com", "/?trip=8");
    expect(await sameRow(piaAfter, "Inés García pays Pia", euro("100,00"))).toBe(true);
    await piaAfter.close();
  }, 30_000);

  test("checks 8 and 9: three wrong passwords lock the login, and the lock ends", async () => {
    const page = await open("/");
    for (const [password, message] of [
      ["wrong-1", "Email or password is wrong."],
      ["wrong-2", "Email or password is wrong."],
      ["wrong-3", "Too many attempts. Try again in 1 minute."],
      ["travel-demo-2026", "Too many attempts. Try again in 1 minute."],
    ]) {
      await logInWithForm(page, "ben@example.com", password);
      await visible(page, message);
    }
    await shot(page, "e8-08-locked");
    for (const password of ["wrong-a", "wrong-b", "wrong-c"]) {
      await logInWithForm(page, "nobody@example.com", password);
    }
    await visible(page, "Too many attempts. Try again in 1 minute.");

    await Bun.sleep(61_000);
    await logInWithForm(page, "ben@example.com", "travel-demo-2026");
    await visible(page, "Logged in as Ben");
    await visible(page, euro("1.915,57"));
    await page.close();
  }, 90_000);

  test("check 10: a code expires", async () => {
    const page = await open("/");
    const before = await signUp(page, "Quentin", "quentin@example.com", "long-enough-1");
    const code = codeIn(await newMail("quentin@example.com", before));
    await Bun.sleep(61_000);
    await enterCode(page, code);
    await visible(page, "This code has expired. Send a new code.");
    await page.close();
  }, 90_000);

  test("check 11: API unreachable and mail down", async () => {
    const page = await open("/");
    await signUp(page, "Sam", "sam@example.com", "long-enough-1");
    await visible(page, "Check your email");
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await enterCode(page, "123456");
    await visible(page, `Could not reach the API at ${API_URL}.`);
    expect(await page.getByLabel("Code", { exact: true }).inputValue()).toBe("123456");
    await page.unroute(`${API_URL}/**`);
    await page.close();

    await restartApi({ MAILER_DSN: "smtp://127.0.0.1:1" });
    const down = await open("/");
    await signUp(down, "Rita", "rita@example.com", "long-enough-1");
    await visible(down, "We could not send the email. Try again in a moment.");
    expect(await field(down, "Email").inputValue()).toBe("rita@example.com");
    await shot(down, "e8-11-mail-down");
    const login = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "rita@example.com", password: "long-enough-1" }),
    });
    expect(login.status).toBe(401);

    await restartApi();
    await button(down, "Create account").click();
    await visible(down, "Check your email");
    await down.close();
  }, 40_000);

  test("check 12: security headers, CORS and the Content-Security-Policy", async () => {
    const health = await fetch(`${API_URL}/health`, { headers: { Origin: WEB_URL } });
    const unauthorised = await fetch(`${API_URL}/trips`, { headers: { Origin: "https://example.org" } });
    const preflight = await fetch(`${API_URL}/trips`, { method: "OPTIONS", headers: { Origin: WEB_URL } });
    for (const response of [health, unauthorised, preflight]) {
      expect([response.headers.get("x-content-type-options"), response.headers.get("referrer-policy"), response.headers.get("cache-control")])
        .toEqual(["nosniff", "no-referrer", "no-store"]);
    }
    expect(unauthorised.status).toBe(401);
    expect(health.headers.get("access-control-allow-origin")).toBe(WEB_URL);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(WEB_URL);
    expect(unauthorised.headers.get("access-control-allow-origin")).toBeNull();

    const page = await browser.newPage({ viewport: VIEWPORT });
    const violations: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });
    await page.goto(`${WEB_URL}/`);
    await visible(page, "Log in to see your groups.");
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content")).toContain(`connect-src 'self' ${API_URL}`);
    const ran = await page.evaluate(() => {
      const script = document.createElement("script");
      script.textContent = "window.__injected = true;";
      document.body.append(script);
      return (window as unknown as { __injected?: boolean }).__injected === true;
    });
    expect(ran).toBe(false);
    await Bun.sleep(200);
    expect(violations.length).toBeGreaterThan(0);
    await page.close();
  }, 30_000);
});
