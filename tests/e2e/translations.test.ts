// Acceptance checks for epic 6 (specs/06-translations-specification.md) in Chromium at 390x844.
// The checks run in order on one fresh seed: Ana's account goes French (check 3), Spanish (check 8) and French again
// (check 10); Hugo's goes French in check 15, which check 17 relies on. A "fresh browser" is a new page with nothing
// stored (harness `open`).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Page } from "playwright";

import { API_URL, DEMO_PASSWORD, TOKEN_KEY, VIEWPORT, euro, noSidewaysScroll, open, openAs, sameRow, shot, startServers, stopServers, tokenFor, visible } from "./harness";

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
    await visible(page, "Log in to see your trips.");
    for (const name of ["English", "Español", "Français"]) {
      expect((await radio(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    expect(await radio(page, "English").isChecked()).toBe(true);
    expect(await pageLang(page)).toBe("en");
    await shot(page, "e6-01-login-english");

    await radio(page, "Français").click();
    for (const value of ["Frais de voyage", "Connectez-vous pour voir vos voyages.", "Se connecter", `Pas encore de compte${NNBSP}? S’inscrire`]) {
      await visible(page, value);
    }
    expect(await radio(page, "Français").isChecked()).toBe(true);
    expect(await pageLang(page)).toBe("fr");
    await shot(page, "e6-02-login-french");
    await page.reload();
    await visible(page, "Se connecter");
    await page.close();
  }, 30_000);

  test("checks 3 and 4: log in in French, the trip view in French", async () => {
    const page = await open("/");
    await radio(page, "Français").click();
    await logIn(page, "ana@example.com", FR);
    await visible(page, "Mes voyages");
    await button(page, "Paramètres").waitFor();
    await button(page, "Déconnexion").waitFor();
    await visible(page, "Madrid weekend");
    expect(await accountLanguage(page)).toBe("fr");

    await text(page, "Lisbon & Porto").click();
    await visible(page, "Total des dépenses");
    expect(await sameRow(page, "‹ Mes voyages", "Marquer payé")).toBe(true);
    for (const value of [euro("1.915,57"), "1 juin 2026 – 7 juin 2026 · 20 dépenses", "4 personnes", "Qui doit à qui", "Voyage", "Soldes", "+ Dépense"]) {
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
    await page.getByRole("tab", { name: "Voyage" }).click();
    await button(page, "Marquer payé").click();
    await visible(page, `Marquer ce voyage comme payé${NNBSP}?`);
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
    await button(page, "Paramètres").click();
    await visible(page, "Paramètres");
    expect(await page.getByLabel("Nom", { exact: true }).inputValue()).toBe("Ana");
    await visible(page, "Langue");
    expect(await radio(page, "Français").isChecked()).toBe(true);
    await button(page, "Enregistrer").waitFor();
    await shot(page, "e6-08-settings-french");

    await radio(page, "Español").click();
    await visible(page, "Ajustes");
    await visible(page, "Idioma");
    await button(page, "Guardar").waitFor();
    expect(await accountLanguage(page)).toBe("es");
    await page.reload();
    await visible(page, "Mis viajes");

    const token = (await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY))!;
    await patchMe(token, { language: "fr" });
    await page.reload();
    await visible(page, "Mes voyages");
    await patchMe(token, { language: "es" });
    await page.reload();
    await visible(page, "Mis viajes");
    await page.close();
  }, 30_000);

  test("checks 9 and 10: the account's language follows Ana; a pick on Login wins", async () => {
    const page = await open("/");
    await visible(page, "Log in");
    await logIn(page, "ana@example.com", EN);
    await visible(page, "Mis viajes");
    await button(page, "Cerrar sesión").click();
    await button(page, "Iniciar sesión").waitFor();
    await page.close();

    const other = await open("/");
    await radio(other, "Français").click();
    await logIn(other, "ana@example.com", FR);
    await visible(other, "Mes voyages");
    expect(await accountLanguage(other)).toBe("fr");
    await other.close();
  }, 30_000);

  test("check 11: Spanish walk with a sum error", async () => {
    const page = await open("/");
    await radio(page, "Español").click();
    await logIn(page, "ben@example.com", ES);
    await text(page, "Lisbon & Porto").click();
    await visible(page, "Gasto total del viaje");
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
    await button(page, "‹ Mis viajes").click();
    await button(page, "Ajustes").click();
    expect(await radio(page, "Español").isChecked()).toBe(true);
    await page.close();
  }, 30_000);

  test("check 12: sign up in French", async () => {
    const page = await open("/");
    await radio(page, "Français").click();
    await button(page, `Pas encore de compte${NNBSP}? S’inscrire`).click();
    await visible(page, "Créer un compte");
    await page.getByLabel("Votre nom", { exact: true }).fill("Lena");
    await page.getByLabel("E-mail", { exact: true }).fill("lena@example.com");
    await page.getByLabel("Mot de passe (8 caractères minimum)", { exact: true }).fill(DEMO_PASSWORD);
    await button(page, "Créer le compte").click();
    await visible(page, "Mes voyages");
    expect(await accountLanguage(page)).toBe("fr");

    await button(page, "Déconnexion").click();
    await button(page, `Pas encore de compte${NNBSP}? S’inscrire`).click();
    await page.getByLabel("Votre nom", { exact: true }).fill("Ana");
    await page.getByLabel("E-mail", { exact: true }).fill("ana@example.com");
    await page.getByLabel("Mot de passe (8 caractères minimum)", { exact: true }).fill(DEMO_PASSWORD);
    await button(page, "Créer le compte").click();
    await visible(page, "Cet e-mail a déjà un compte.");
    await page.close();
  }, 30_000);

  test("check 13: plurals", async () => {
    const eva = await open("/");
    await radio(eva, "Français").click();
    await logIn(eva, "eva@example.com", FR);
    await text(eva, "Empty weekend").click();
    await visible(eva, "10 janv. 2026 – 12 janv. 2026 · 0 dépense");
    await visible(eva, "3 personnes");
    await button(eva, "‹ Mes voyages").click();
    await button(eva, "Paramètres").click();
    await radio(eva, "Español").click();
    await button(eva, "‹ Mis viajes").click();
    await text(eva, "Empty weekend").click();
    await visible(eva, "10 ene 2026 – 12 ene 2026 · 0 gastos");
    await visible(eva, "3 personas");
    await eva.close();

    const jon = await open("/");
    await radio(jon, "Français").click();
    await logIn(jon, "jon@example.com", FR);
    await text(jon, "Three-way taxi").click();
    await visible(jon, "5 mars 2026 – 5 mars 2026 · 1 dépense");
    await jon.close();
  }, 30_000);

  test("check 14: saving the language fails, nothing changes", async () => {
    const page = await openAs("hugo@example.com", "/");
    await button(page, "Settings").click();
    await page.route(`${API_URL}/**`, (route) => route.abort());
    await radio(page, "Français").click();
    await visible(page, `Could not reach the API at ${API_URL}.`);
    expect(await radio(page, "English").isChecked()).toBe(true);
    await visible(page, "Settings");
    await shot(page, "e6-14-language-save-failed");
    await page.unroute(`${API_URL}/**`);
    await radio(page, "Français").click();
    await visible(page, "Paramètres");
    expect(await accountLanguage(page)).toBe("fr");
    await radio(page, "English").click();
    await visible(page, "Settings");
    expect(await accountLanguage(page)).toBe("en");
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
    await button(page, "‹ My trips").click();
    await button(page, "Settings").click();
    await radio(page, "Français").click();
    await visible(page, "Paramètres");
    await button(page, "‹ Mes voyages").click();
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

    const signUp = async (body: Record<string, string>) =>
      (await (await fetch(`${API_URL}/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()) as { user: { language: string } };
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
});
