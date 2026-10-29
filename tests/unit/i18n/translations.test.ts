// The translation rules of specs/guidelines/ui.md ("Translations"), one test each, so the translation files stay
// small and maintainable: one key per distinct text, placeholders for dynamic values, no unused keys, the same keys in
// every language, and no text outside the translation files.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { en } from "../../../packages/app/src/i18n/en";
import { es } from "../../../packages/app/src/i18n/es";
import { fr } from "../../../packages/app/src/i18n/fr";

const SRC = join(import.meta.dir, "../../../packages/app/src");
const TRANSLATION_FILES = ["i18n/en.ts", "i18n/es.ts", "i18n/fr.ts"];
/** Texts allowed to be equal in English under two keys, each with a reason. Starts empty on purpose. */
const SAME_TEXT_ALLOWED: string[] = [];
/** Keys built at run time: their prefix (or suffix) is enough for them to count as used. */
const BUILT_PREFIXES = ["category.", "month.", "split."];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

const sources = sourceFiles(SRC)
  .filter((path) => !TRANSLATION_FILES.some((file) => path.endsWith(file)))
  .map((path) => ({ path: path.slice(SRC.length + 1), text: readFileSync(path, "utf8") }));
const allSource = sources.map((s) => s.text).join("\n");
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translation rules", () => {
  test("1. one key per distinct text: no two English keys share a value", () => {
    const byText = new Map<string, string[]>();
    for (const [key, text] of Object.entries(en)) {
      byText.set(text, [...(byText.get(text) ?? []), key]);
    }
    const duplicates = [...byText].filter(([text, keys]) => keys.length > 1 && !SAME_TEXT_ALLOWED.includes(text));
    expect(duplicates).toEqual([]);
  });

  test("2. no sentence glued from two t() calls", () => {
    const glued = sources.filter(
      (s) => /\bt\([^)]*\)\s*\+\s*t\(/.test(s.text) || /`[^`]*\$\{t\([^`]*\$\{t\([^`]*`/.test(s.text),
    );
    expect(glued.map((s) => s.path)).toEqual([]);
  });

  test("3. no unused keys", () => {
    const unused = Object.keys(en).filter((key) => {
      if (BUILT_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
      const base = key.endsWith(".one") ? key.slice(0, -".one".length) : key;
      return !allSource.includes(`"${base}"`);
    });
    expect(unused).toEqual([]);
  });

  test("4. Spanish and French have the same keys, in the same order, no empty value, the same placeholders", () => {
    for (const messages of [es, fr]) {
      expect(Object.keys(messages)).toEqual(Object.keys(en));
      const problems = Object.entries(en).flatMap(([key, english]) => {
        const text = messages[key as keyof typeof en];
        if (text.trim() === "") return [`${key}: empty`];
        return placeholders(text).join() === placeholders(english).join() ? [] : [`${key}: ${placeholders(text)} ≠ ${placeholders(english)}`];
      });
      expect(problems).toEqual([]);
    }
  });

  test("5. no text literals in JSX outside the translation files", () => {
    const literals = sources
      .filter((s) => s.path.endsWith(".tsx"))
      .flatMap((s) =>
        s.text.split("\n").flatMap((line, i) => {
          // A tag closes with ">" right after its name or last attribute; " > " and "=>" are comparisons and arrows.
          const found = [...line.matchAll(/(?<![\s=])>([^<>{}=]*[A-Za-zÀ-ÿ][^<>{}=]*)</g)].map((m) => m[1].trim()).filter(Boolean);
          return found.map((text) => `${s.path}:${i + 1} "${text}"`);
        }),
      );
    expect(literals).toEqual([]);
  });

  test("6. keys are grouped by screen, with common.* and error.*", () => {
    const groups = [...new Set(Object.keys(en).map((key) => key.split(".")[0]))];
    expect(groups).toContain("common");
    expect(groups).toContain("error");
    // Each group's keys sit together in the file, so a translator sees one screen at a time.
    const order = Object.keys(en).map((key) => key.split(".")[0]);
    expect(order.filter((group, i) => i === 0 || group !== order[i - 1])).toEqual(groups);
  });

  test("the error keys of the specifications (epic 6, then feature 8 without error.taken)", () => {
    expect(Object.keys(en).filter((key) => key.startsWith("error."))).toEqual([
      "error.required", "error.choosePerson", "error.tooLong", "error.tooShort", "error.invalidDate", "error.beforeStart",
      "error.invalidAmount", "error.tooLarge", "error.invalidEmail", "error.alreadyOnTrip", "error.tooFew",
      "error.tooMany", "error.sumMismatch", "error.percentMismatch", "error.invalid",
      "error.codeWrong.one", "error.codeWrong", "error.codeTooMany", "error.codeExpired", "error.tooManyRequests", "error.mailUnavailable",
    ]);
  });

  test("the duplicates of epic 5 are merged into common.*", () => {
    for (const gone of ["add.cancel", "markPaid.cancel", "add.saving", "yourName.saving", "trip.markPaid", "markPaid.confirm",
      "trip.paid", "trips.paid", "tabs.balances", "balances.title", "newTrip.personName", "yourName.name", "trips.yourName",
      "yourName.title", "app.loadFailed"]) {
      expect(gone in en).toBe(false);
    }
  });
});
