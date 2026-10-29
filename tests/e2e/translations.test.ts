// Acceptance checks for epic 6 (specs/translations/06-translations-specification.md) in Chromium at 390x844.
// The checks run in order on one fresh seed: Ana's account goes French (check 3), Spanish (check 8) and French again
// (check 10); Hugo's goes French in check 15, which check 17 relies on. A "fresh browser" is a new page with nothing
// stored (harness `open`).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import {
  API_URL,
  codeIn,
  confirmCodeFromEmail,
  DEMO_PASSWORD,
  euro,
  fromMenu,
  languageFromMenu,
  mailsTo,
  menuButton,
  menuItem,
  newMail,
  noSidewaysScroll,
  open,
  openAs,
  sameRow,
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

const NNBSP = " ";
/** English texts that must not appear anywhere in the French walk. */
const ENGLISH = ["Save", "Cancel", "Paid by", "Recorded by", "Who owes whom", "Balances", "expenses", "people", "Settings",
  "Log out", "Mark as paid", "Add expense"];
const FR_MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const radio = (page: Page, name: string) => page.getByRole("radio", { name, exact: true });
const text = (page: Page, value: string) => page.getByText(value, { exact: true });
/** Picks a language in the menu of the app bar ("Tap a language" in the checks). */
const pickLanguage = languageFromMenu;
/** The language the menu button shows: its name ends in it ("Menu, language: English"). */
const shownLanguage = async (page: Page) => (await menuButton(page).getAttribute("aria-label"))!.split(/:\s/).pop();
/** The dropdown under "Language" in Settings; its name is "Language: English" in whatever language the screen shows. */
const settingsDropdown = (page: Page) => page.getByRole("button", { name: /^(?!Men[uú],).*:\s(English|Español|Français)$/ });
async function pickInSettings(page: Page, name: string) {
  await settingsDropdown(page).click();
  await radio(page, name).click();
}
const shownInSettings = async (page: Page) => (await settingsDropdown(page).getAttribute("aria-label"))!.split(/:\s/).pop();
/** Polls until `check` holds, for effects the app finishes in the background (a language sent again). */
async function eventually(check: () => Promise<boolean>) {
  for (let i = 0; i < 50 && !(await check()); i++) await Bun.sleep(100);
  return check();
}
const NOAH_TRIP = "Great tour of every UNESCO world heritage site in southern Europe by sleeper train";
/** A category chip by its label; person chips never share these names. */
const chip = (page: Page, label: string) => page.getByRole("checkbox", { name: new RegExp(`\\s${label}$`) });

/** Fills Login in whatever language it shows and logs in. */
async function logIn(page: Page, email: string, labels: { email: string; password: string; button: string }) {
  await page.getByLabel(labels.email, { exact: true }).fill(email);
  await page.getByLabel(labels.password, { exact: true }).fill(DEMO_PASSWORD);
  await button(page, labels.button).click();
}
const FR = { email: "E-mail", password: "Mot de passe", button: "Se connecter" };
const ES = { email: "Correo electrónico", password: "Contraseña", button: "Iniciar sesión" };
const EN = { email: "Email", password: "Password", button: "Log in" };

/** The language stored on the account of whoever is logged in on this page. */
async function accountLanguage(page: Page): Promise<string> {
  const token = await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY);
  const response = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } });
  return ((await response.json()) as { language: string }).language;
}

async function patchMe(token: string, body: unknown) {
  const response = await fetch(`${API_URL}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: (await response.json()) as Record<string, any> };
}

const pageLang = (page: Page) => page.evaluate(() => document.documentElement.lang);
const frenchToday = (page: Page) =>
  page.evaluate((months) => {
    const now = new Date();
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }, FR_MONTHS);

async function noEnglish(page: Page) {
  const body = await page.evaluate(() => document.body.innerText);
  return ENGLISH.filter((word) => new RegExp(`\\b${word}\\b`).test(body));
}

/** Waits until exactly this category chip is selected (suggestions arrive about 300 ms after typing). */
async function selected(page: Page, label: string) {
  for (let i = 0; i < 30 && !(await chip(page, label).isChecked()); i++) await Bun.sleep(100);
  return chip(page, label).isChecked();
}

describe("epic 6: translations (390x844)", () => {
  test("checks 1 and 2: Login starts in English, then switches to French and stays after a reload", async () => {
    const page = await open("/");
    await visible(page, "Travel expenses");
    await visible(page, "Log in to see your groups.");
    const dropdown = (await menuButton(page).boundingBox())!;
    expect(dropdown.height).toBeGreaterThanOrEqual(48);
    expect(dropdown.y).toBeLessThan((await text(page, "Travel expenses").boundingBox())!.y);
    expect(VIEWPORT.width - (dropdown.x + dropdown.width)).toBeLessThanOrEqual(16);
    expect(await shownLanguage(page)).toBe("English");
    await menuButton(page).click();
    for (const name of ["English", "Español", "Français"]) {
      expect((await radio(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    expect(await radio(page, "English").isChecked()).toBe(true);
    expect(await page.getByRole("menuitem").count()).toBe(0);
    await shot(page, "e6-01-login-language-menu");
    await page.keyboard.press("Escape");
    await radio(page, "English").waitFor({ state: "detached" });
    expect(await pageLang(page)).toBe("en");
    await shot(page, "e6-01-login-english");

    await pickLanguage(page, "Français");
    for (const value of ["Frais de voyage", "Connectez-vous pour voir vos groupes.", "Se connecter", `Pas encore de compte${NNBSP}? S’inscrire`]) {
      await visible(page, value);
    }
    expect(await shownLanguage(page)).toBe("Français");
    expect(await pageLang(page)).toBe("fr");
    await shot(page, "e6-02-login-french");
    await page.reload();
    await visible(page, "Se connecter");
    await page.close();
  }, 30_000);

  test("checks 3 and 4: log in in French, the trip view in French", async () => {
    const page = await open("/");
    await pickLanguage(page, "Français");
    await logIn(page, "ana@example.com", FR);
    await visible(page, "Mes groupes");
    await visible(page, "Madrid weekend");
    expect(await button(page, "Paramètres").count()).toBe(0);
    expect(await button(page, "Déconnexion").count()).toBe(0);
    expect(await shownLanguage(page)).toBe("Français");
    await menuButton(page).click();
    await menuItem(page, "Paramètres").waitFor();
    await menuItem(page, "Déconnexion").waitFor();
    await page.keyboard.press("Escape");
    expect(await accountLanguage(page)).toBe("fr");

    await text(page, "Lisbon & Porto").click();
    await visible(page, "Total des dépenses");
    expect((await menuButton(page).boundingBox())!.y).toBeLessThan((await text(page, "‹ Mes groupes").boundingBox())!.y);
    expect(await sameRow(page, "‹ Mes groupes", "Marquer payé")).toBe(true);
    for (const value of [euro("1.915,57"), "1 juin 2026 – 7 juin 2026 · 20 dépenses", "4 personnes", "Qui doit à qui", "Groupe", "Soldes", "+ Dépense"]) {
      await visible(page, value);
    }
    for (const [who, amount] of [["Ana paie Ben", "63,75"], ["David paie Ben", "27,65"], ["David paie Chloé", "27,07"]]) {
      expect(await sameRow(page, who, euro(amount))).toBe(true);
    }
    await visible(page, "7 juin 2026 · Payé par David");
    expect(await page.locator('[aria-label^="Transport, Taxi to Porto airport"]').count()).toBe(1);
    expect(await noEnglish(page)).toEqual([]);
    expect(await noSidewaysScroll(page)).toBe(true);
    await shot(page, "e6-04-trip-view-french");
    await page.close();
  }, 30_000);

  test("checks 5 to 7: add and edit forms, balances and mark as paid in French", async () => {
    const page = await openAs("ana@example.com", "/?trip=7");
    await visible(page, "Total des dépenses");
    await button(page, "+ Dépense").click();
    await visible(page, "Nouvelle dépense");
    await button(page, "Annuler").waitFor();
    for (const label of ["Repas", "Autre"]) await chip(page, label).waitFor();
    for (const name of ["Égal", "Montants", "Pourcent.", "Parts"]) {
      expect((await radio(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    for (const box of await Promise.all((await page.getByRole("checkbox").all()).map((c) => c.boundingBox()))) {
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    const save = (await button(page, "Enregistrer").boundingBox())!;
    expect(VIEWPORT.height - (save.y + save.height)).toBeLessThanOrEqual(16);
    await button(page, "Enregistrer").click();
    for (const value of ["Remplissez ce champ.", "Saisissez un montant supérieur à 0.", "Choisissez au moins une personne.", "Corrigez les champs en rouge."]) {
      await visible(page, value);
    }
    expect(await noEnglish(page)).toEqual([]);
    await shot(page, "e6-05-add-form-errors-french");
    await button(page, "Annuler").click();

    await text(page, "Tapas at Mercado de San Miguel").click();
    await visible(page, "Modifier la dépense");
    await button(page, "Enregistrer les modifications").waitFor();
    expect(await chip(page, "Repas").isChecked()).toBe(true);
    await button(page, "Annuler").click();
    await visible(page, euro("78,30"));

    await page.getByRole("tab", { name: "Soldes" }).click();
    for (const value of [euro("-9,15"), euro("+9,15"), euro("30,00"), euro("39,15")]) await visible(page, value);
    expect(await page.getByText(/^Payé\s/).count()).toBe(2);
    expect(await page.getByText(/^Part\s/).count()).toBe(2);
    expect(await sameRow(page, "Ana paie Chloé", euro("9,15"))).toBe(true);
    await page.getByRole("tab", { name: "Groupe" }).click();
    await button(page, "Marquer payé").click();
    await visible(page, `Marquer ce groupe comme payé${NNBSP}?`);
    expect(await sameRow(page, "Ana paie Chloé", euro("9,15"))).toBe(true);
    await button(page, "Marquer payé").click();
    await visible(page, "✓ Payé");
    await visible(page, `Marqué comme payé par Ana le ${await frenchToday(page)}.`);
    await button(page, "Rouvrir").waitFor();
    expect(await noEnglish(page)).toEqual([]);
    await shot(page, "e6-07-paid-french");
    await page.close();
  }, 30_000);

  test("check 8: Settings in French, switch to Spanish, and the database decides at start", async () => {
    const page = await openAs("ana@example.com", "/");
    await fromMenu(page, "Paramètres");
    await visible(page, "Paramètres");
    expect(await page.getByLabel("Nom", { exact: true }).inputValue()).toBe("Ana");
    await visible(page, "Langue");
    expect(await shownInSettings(page)).toBe("Français");
    await button(page, "Enregistrer").waitFor();
    await menuButton(page).click();
    await menuItem(page, "Déconnexion").waitFor();
    expect(await menuItem(page, "Paramètres").count()).toBe(0);
    await page.keyboard.press("Escape");
    await shot(page, "e6-08-settings-french");

    await pickInSettings(page, "Español");
    await visible(page, "Ajustes");
    await visible(page, "Idioma");
    await button(page, "Guardar").waitFor();
    expect(await shownLanguage(page)).toBe("Español");
    expect(await accountLanguage(page)).toBe("es");
    await page.reload();
    await visible(page, "Mis grupos");

    const token = (await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY))!;
    await patchMe(token, { language: "fr" });
    await page.reload();
    await visible(page, "Mes groupes");
    await patchMe(token, { language: "es" });
    await page.reload();
    await visible(page, "Mis grupos");
    await page.close();
  }, 30_000);

  test("checks 9 and 10: the account's language follows Ana; a pick on Login wins", async () => {
    const page = await open("/");
    await visible(page, "Log in");
    await logIn(page, "ana@example.com", EN);
    await visible(page, "Mis grupos");
    await fromMenu(page, "Cerrar sesión");
    await button(page, "Iniciar sesión").waitFor();
    await page.close();

    const other = await open("/");
    await pickLanguage(other, "Français");
    await logIn(other, "ana@example.com", FR);
    await visible(other, "Mes groupes");
    expect(await accountLanguage(other)).toBe("fr");
    await other.close();
  }, 30_000);

  test("check 11: Spanish walk with a sum error", async () => {
    const page = await open("/");
    await pickLanguage(page, "Español");
    await logIn(page, "ben@example.com", ES);
    await text(page, "Lisbon & Porto").click();
    await visible(page, "Gasto total");
    await visible(page, euro("1.915,57"));
    expect(await sameRow(page, "Ana paga a Ben", euro("63,75"))).toBe(true);
    await button(page, "+ Gasto").click();
    await page.getByPlaceholder("Cena en el puerto").fill("Cena");
    await page.getByPlaceholder("0,00").first().fill("50,00");
    await page.getByRole("checkbox", { name: "Ana" }).nth(0).click();
    await page.getByRole("checkbox", { name: "Ben" }).nth(0).click();
    await page.getByLabel("Ana", { exact: true }).first().fill("20,00");
    await page.getByLabel("Ben", { exact: true }).first().fill("25,00");
    await button(page, "Guardar gasto").click();
    await visible(page, `Los importes suman ${euro("45,00")} pero el gasto es de ${euro("50,00")}.`);
    await shot(page, "e6-11-spanish-sum-error");
    await button(page, "Cancelar").click();
    await visible(page, euro("1.915,57"));
    await button(page, "‹ Mis grupos").click();
    await fromMenu(page, "Ajustes");
    expect(await shownInSettings(page)).toBe("Español");
    await page.close();
  }, 30_000);

  test("check 12: sign up in French", async () => {
    const page = await open("/");
    await pickLanguage(page, "Français");
    await button(page, `Pas encore de compte${NNBSP}? S’inscrire`).click();
    await visible(page, "Créer un compte");
    await page.getByLabel("Votre nom", { exact: true }).fill("Lena");
    await page.getByLabel("E-mail", { exact: true }).fill("lena@example.com");
    await page.getByLabel("Mot de passe (8 caractères minimum)", { exact: true }).fill(DEMO_PASSWORD);
    const before = (await mailsTo("lena@example.com")).length;
    await button(page, "Créer le compte").click();
    await visible(page, "Consultez vos e-mails");
    expect((await newMail("lena@example.com", before)).subject).toBe("Confirmez votre adresse e-mail");
    await confirmCodeFromEmail(page, "lena@example.com", before, "Confirmer");
    await visible(page, "Mes groupes");
    expect(await accountLanguage(page)).toBe("fr");

    await fromMenu(page, "Déconnexion");
    await button(page, `Pas encore de compte${NNBSP}? S’inscrire`).click();
    await page.getByLabel("Votre nom", { exact: true }).fill("Ana");
    await page.getByLabel("E-mail", { exact: true }).fill("ana@example.com");
    await page.getByLabel("Mot de passe (8 caractères minimum)", { exact: true }).fill(DEMO_PASSWORD);
    const anaBefore = (await mailsTo("ana@example.com")).length;
    await button(page, "Créer le compte").click();
    await visible(page, "Consultez vos e-mails");
    expect((await newMail("ana@example.com", anaBefore)).subject).toBe("Vous avez déjà un compte");
    await page.close();
  }, 30_000);

  test("check 13: plurals", async () => {
    const eva = await open("/");
    await pickLanguage(eva, "Français");
    await logIn(eva, "eva@example.com", FR);
    await text(eva, "Empty weekend").click();
    await visible(eva, "10 janv. 2026 – 12 janv. 2026 · 0 dépense");
    await visible(eva, "3 personnes");
    await button(eva, "‹ Mes groupes").click();
    await pickLanguage(eva, "Español");
    await text(eva, "Empty weekend").click();
    await visible(eva, "10 ene 2026 – 12 ene 2026 · 0 gastos");
    await visible(eva, "3 personas");
    await eva.close();

    const jon = await open("/");
    await pickLanguage(jon, "Français");
    await logIn(jon, "jon@example.com", FR);
    await text(jon, "Three-way taxi").click();
    await visible(jon, "5 mars 2026 – 5 mars 2026 · 1 dépense");
    await jon.close();
  }, 30_000);

  test("check 14: saving the language fails, the app keeps it and retries", async () => {
    const page = await openAs("hugo@example.com", "/");
    await visible(page, "My groups");
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await pickLanguage(page, "Français");
    await visible(page, "Mes groupes");
    expect(await shownLanguage(page)).toBe("Français");
    expect(await page.getByText(/Impossible de joindre|Could not reach/).count()).toBe(0);
    expect(await accountLanguage(page)).toBe("en");
    await shot(page, "e6-14-language-kept-unsaved");

    // Sent again at the next screen change.
    await page.unroute(`${API_URL}/**`);
    await text(page, "Even split").click();
    await visible(page, "Total des dépenses");
    expect(await eventually(async () => (await accountLanguage(page)) === "fr")).toBe(true);

    await page.route(`${API_URL}/**`, (route) => route.abort());
    await button(page, "‹ Mes groupes").click();
    await fromMenu(page, "Paramètres");
    await pickInSettings(page, "English");
    await visible(page, "Settings");
    expect(await page.getByText(/Could not reach/).count()).toBe(0);
    await page.unroute(`${API_URL}/**`);
    await page.reload();
    await visible(page, "Mes groupes");

    await pickLanguage(page, "English");
    await visible(page, "My groups");
    expect(await eventually(async () => (await accountLanguage(page)) === "en")).toBe(true);
    await page.close();
  }, 30_000);

  test("check 15: network error in the expense form, in English and French", async () => {
    const page = await openAs("hugo@example.com", "/");
    const attempt = async (labels: { add: string; save: string; cancel: string; payer: string }) => {
      await text(page, "Even split").click();
      await button(page, labels.add).click();
      await page.getByPlaceholder(/./).first().fill("Coffee");
      await page.getByPlaceholder("0,00").first().fill("10,00");
      await page.getByRole("checkbox", { name: "Hugo" }).nth(0).click();
      await page.route(`${API_URL}/**`, (route) => route.abort());
      await button(page, labels.save).click();
    };
    await attempt({ add: "+ Add expense", save: "Save expense", cancel: "Cancel", payer: "Hugo" });
    await visible(page, `Could not reach the API at ${API_URL}.`);
    expect(await page.getByPlaceholder("0,00").first().inputValue()).toBe("10,00");
    await page.unroute(`${API_URL}/**`);
    await button(page, "Cancel").click();
    await button(page, "‹ My groups").click();
    await pickLanguage(page, "Français");
    await visible(page, "Mes groupes");
    await attempt({ add: "+ Dépense", save: "Enregistrer", cancel: "Annuler", payer: "Hugo" });
    await visible(page, `Impossible de joindre l’API à ${API_URL}.`);
    await page.unroute(`${API_URL}/**`);
    await page.close();
  }, 30_000);

  test("check 16: the API", async () => {
    const olga = await tokenFor("olga@example.com");
    const invalid = await patchMe(olga, { language: "de" });
    expect([invalid.status, invalid.data.errors.language.code]).toEqual([422, "invalid_language"]);
    const spanish = await patchMe(olga, { language: "es" });
    expect([spanish.status, spanish.data.language, spanish.data.display_name]).toEqual([200, "es", "Olga"]);
    const empty = await patchMe(olga, {});
    expect([empty.status, empty.data.errors.display_name.code]).toEqual([422, "required"]);
    const long = await patchMe(olga, { display_name: "x".repeat(61) });
    expect([long.data.errors.display_name.code, long.data.errors.display_name.params]).toEqual(["too_long", { max: 60 }]);

    const postJson = (path: string, body: Record<string, string>) =>
      fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    // Sign-up answers 202; the user comes with the code from the email (feature 8).
    const signUp = async (body: Record<string, string>) => {
      const before = (await mailsTo(body.email)).length;
      expect((await postJson("/auth/signup", body)).status).toBe(202);
      const code = codeIn(await newMail(body.email, before));
      return (await (await postJson("/auth/verify", { email: body.email, code })).json()) as { user: { language: string } };
    };
    expect((await signUp({ display_name: "Kai", email: "kai@example.com", password: DEMO_PASSWORD, language: "fr" })).user.language).toBe("fr");
    expect((await signUp({ display_name: "Max", email: "max@example.com", password: DEMO_PASSWORD })).user.language).toBe("en");

    const ana = await tokenFor("ana@example.com");
    const members = ((await (await fetch(`${API_URL}/trips/1`, { headers: { Authorization: `Bearer ${ana}` } })).json()) as { members: { id: number }[] }).members;
    const post = async (body: unknown) =>
      (await (await fetch(`${API_URL}/trips/1/expenses`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ana}` }, body: JSON.stringify(body),
      })).json()) as { errors: Record<string, { params?: Record<string, number> }> };
    const base = { name: "Cena", date: "2026-06-02", amount_cents: 5000 };
    const paid = await post({ ...base, paid_by: [{ person_id: members[0].id, amount_cents: 2000 }, { person_id: members[1].id, amount_cents: 2500 }], split: { type: "equal", between: [{ person_id: members[0].id, value: null }] } });
    expect(paid.errors.paid_by.params).toEqual({ sum_cents: 4500, amount_cents: 5000 });
    const percent = await post({ ...base, paid_by: [{ person_id: members[0].id, amount_cents: 5000 }], split: { type: "percentage", between: [{ person_id: members[0].id, value: 5000 }, { person_id: members[1].id, value: 4000 }] } });
    expect(percent.errors.split.params).toEqual({ sum_basis_points: 9000, total_basis_points: 10000 });
  });

  test("check 17: French category suggestions", async () => {
    const page = await openAs("hugo@example.com", "/");
    await text(page, "Even split").click();
    await button(page, "+ Dépense").click();
    for (const [name, label] of [["Dîner au restaurant", "Repas"], ["Essence Total", "Carburant"], ["Péage autoroute", "Transport"], ["Total", "Autre"]]) {
      await page.getByPlaceholder("Dîner sur le port").fill(name);
      await Bun.sleep(600);
      expect(await selected(page, label)).toBe(true);
    }
    await button(page, "Annuler").click();
    await page.close();
  }, 30_000);

  test("check 20: the menu on every screen", async () => {
    const page = await openAs("noah@example.com", "/");
    const atTop = async () => {
      const box = (await menuButton(page).boundingBox())!;
      expect(box.y).toBeLessThan(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
      expect(await shownLanguage(page)).toBe("English");
      expect(await button(page, "Log out").count()).toBe(0);
    };
    await visible(page, "My groups");
    await atTop();
    await text(page, NOAH_TRIP).first().click();
    await visible(page, "Total spent");
    await atTop();
    await menuButton(page).click();
    for (const name of ["English", "Español", "Français"]) await radio(page, name).waitFor();
    for (const name of ["Settings", "Log out"]) {
      expect((await menuItem(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    await shot(page, "e6-20-menu-trip-view");
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Balances" }).click();
    await atTop();
    await page.getByRole("tab", { name: "Group" }).click();
    await button(page, "+ Add expense").click();
    await visible(page, "Add expense");
    await atTop();
    await button(page, "Cancel").click();
    await button(page, "‹ My groups").click();
    await button(page, "+ New group").click();
    await visible(page, "New group");
    await atTop();
    await button(page, "‹ My groups").click();
    await fromMenu(page, "Settings");
    await visible(page, "This is how you appear on all your groups.");
    await atTop();
    await button(page, "‹ My groups").click();
    await visible(page, "My groups");
    await page.close();
  }, 30_000);

  test("check 21: Discard your changes? on Log out", async () => {
    const page = await openAs("noah@example.com", "/");
    await text(page, NOAH_TRIP).first().click();
    await button(page, "+ Add expense").click();
    const name = page.getByPlaceholder(/./).first();
    await name.fill("Taxi");
    await pickLanguage(page, "Español");
    await visible(page, "Nuevo gasto");
    expect(await name.inputValue()).toBe("Taxi");
    expect(await text(page, "¿Descartar los cambios?").count()).toBe(0);
    await pickLanguage(page, "English");
    await visible(page, "Add expense");

    await fromMenu(page, "Log out");
    await visible(page, "Discard your changes?");
    await visible(page, "What you entered on this screen will be lost.");
    await button(page, "Discard and log out").waitFor();
    await button(page, "Keep editing").waitFor();
    await shot(page, "e6-21-discard-log-out");
    await button(page, "Keep editing").click();
    await text(page, "Discard your changes?").waitFor({ state: "detached" });
    expect(await name.inputValue()).toBe("Taxi");

    await fromMenu(page, "Log out");
    await button(page, "Discard and log out").click();
    await visible(page, "Log in to see your groups.");
    await page.close();
  }, 30_000);

  test("check 22: Discard your changes? on Settings, only with changes", async () => {
    const page = await openAs("noah@example.com", "/");
    await button(page, "+ New group").click();
    await visible(page, "New group");
    await fromMenu(page, "Settings");
    await visible(page, "This is how you appear on all your groups.");
    expect(await text(page, "Discard your changes?").count()).toBe(0);

    await button(page, "‹ My groups").click();
    await button(page, "+ New group").click();
    const tripName = page.getByLabel("Group name", { exact: true });
    await tripName.fill("Rome");
    await fromMenu(page, "Settings");
    await button(page, "Discard and open Settings").waitFor();
    await page.keyboard.press("Escape");
    await text(page, "Discard your changes?").waitFor({ state: "detached" });
    expect(await tripName.inputValue()).toBe("Rome");
    await fromMenu(page, "Settings");
    await button(page, "Discard and open Settings").click();
    await text(page, "Discard your changes?").waitFor({ state: "detached" });
    await visible(page, "This is how you appear on all your groups.");

    const name = page.getByLabel("Name", { exact: true });
    await name.fill("Noah B");
    await fromMenu(page, "Log out");
    await button(page, "Discard and log out").waitFor();
    await page.mouse.click(VIEWPORT.width / 2, 20);
    await text(page, "Discard your changes?").waitFor({ state: "detached" });
    expect(await name.inputValue()).toBe("Noah B");
    await name.fill("Noah");
    await fromMenu(page, "Log out");
    await visible(page, "Log in to see your groups.");
    await page.close();
  }, 30_000);
});
