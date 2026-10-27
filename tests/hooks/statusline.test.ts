import { afterEach, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseChecks, renderLine } from "../../.claude/statusline";
import { remind } from "../../.claude/hooks/progress-reminder";

const script = resolve(import.meta.dir, "../../.claude/statusline.ts");
const fixtures = resolve(import.meta.dir, "fixtures/statusline");
const transcript = join(fixtures, "transcript.jsonl");
const tokenFields = { context_window: { total_input_tokens: 30000, total_output_tokens: 1200 } };
const percentFields = {
  context_window: { total_input_tokens: 30000, total_output_tokens: 1200, used_percentage: 40.6 },
  rate_limits: { five_hour: { used_percentage: 33.5, resets_at: 1793000000 } },
};

const run = (stdin: string, cwd = fixtures) => {
  const result = Bun.spawnSync(["bun", script], { stdin: new TextEncoder().encode(stdin), cwd });
  return { out: result.stdout.toString(), code: result.exitCode };
};
const statusFor = (fixture: string, extra: object = {}) =>
  run(JSON.stringify({ model: { display_name: "Opus" }, workspace: { project_dir: join(fixtures, fixture) }, transcript_path: transcript, ...extra })).out;

describe("status line per fixture", () => {
  test.each([
    ["no-spec", "no active spec · 48.2k tok · Opus"],
    ["no-progress", "no active spec · 48.2k tok · Opus"],
    ["zero-done", "01-trip-view  [░░░░░░░░░░░░░░░░] 0/16 · 100% left · 48.2k tok · Opus"],
    ["six-done", "01-trip-view  [██████░░░░░░░░░░] 6/16 · 62% left · 48.2k tok · Opus"],
    ["all-done", "no active spec · 48.2k tok · Opus"],
    ["malformed", "01-trip-view  [████░░░░░░░░░░░░] 4/16 · 75% left · 48.2k tok · Opus"],
    ["older-epic-active", "01-trip-view  [██░░░░░░░░░░░░░░] 2/16 · 88% left · 48.2k tok · Opus"],
  ])("%s", (fixture, expected) => {
    expect(statusFor(fixture)).toBe(`${expected}\n`);
  });

  test("the checks are counted from the specification, not hardcoded", () => {
    const spec = readFileSync(join(fixtures, "six-done/specs/01-trip-view-specification.md"), "utf8");
    const checks = parseChecks(spec);
    expect(checks.map((check) => check.nr)).toEqual([...Array(16)].map((_, i) => i + 1));
    expect(checks[3].text).toBe("**Check 4.** Open `/?trip=4`. The screen shows trip 4, and this second line belongs to the same check.");
  });
});

describe("tokens", () => {
  test("stdin with token fields: the transcript total wins, because context_window is only the current context", () => {
    expect(statusFor("six-done", tokenFields)).toContain("· 48.2k tok ·");
  });

  test("stdin with token fields and no readable transcript: falls back to context_window", () => {
    expect(statusFor("six-done", { ...tokenFields, transcript_path: join(fixtures, "missing.jsonl") })).toContain("· 31.2k tok ·");
  });

  test("stdin without token fields: sums the transcript", () => {
    expect(statusFor("six-done")).toContain("· 48.2k tok ·");
  });

  test("stdin without token fields or transcript", () => {
    expect(run(JSON.stringify({ workspace: { project_dir: join(fixtures, "no-spec") } })).out).toBe("no active spec · 0 tok\n");
  });

  test("large counts", () => {
    expect(renderLine(null, { tokens: 999, model: "Opus" })).toBe("no active spec · 999 tok · Opus");
    expect(renderLine(null, { tokens: 1_234_567, model: "Opus" })).toBe("no active spec · 1.23M tok · Opus");
  });
});

describe("share of the session limit and the context window", () => {
  test("both percentages, rounded", () => {
    expect(statusFor("six-done", percentFields)).toBe(
      "01-trip-view  [██████░░░░░░░░░░] 6/16 · 62% left · 48.2k tok · 34% session · 41% ctx · Opus\n",
    );
  });

  test("without an active spec", () => {
    expect(statusFor("no-spec", percentFields)).toBe("no active spec · 48.2k tok · 34% session · 41% ctx · Opus\n");
  });

  test("left out when the input has none: API key accounts have no rate limits, the context is null at first", () => {
    const input = { context_window: { used_percentage: null }, rate_limits: { five_hour: {} } };
    expect(statusFor("six-done", input)).toBe("01-trip-view  [██████░░░░░░░░░░] 6/16 · 62% left · 48.2k tok · Opus\n");
    expect(renderLine(null, { tokens: 5, contextPct: 0 })).toBe("no active spec · 5 tok · 0% ctx");
  });
});

describe("never breaks the terminal", () => {
  test.each([[""], ["not json"], ["null"], ['{"workspace":{"project_dir":"/does/not/exist"}}']])("stdin %p", (stdin) => {
    const { out, code } = run(stdin, join(fixtures, "no-spec"));
    expect(code).toBe(0);
    expect(out).toBe("no active spec · 0 tok\n");
  });

  test("never wider than 100 characters", () => {
    const usage = { tokens: 123_456_789, sessionPct: 100, contextPct: 100, model: "Opus 5.5 (1M context)" };
    const line = renderLine({ label: `07-${"a-very-long-epic-name-".repeat(5)}`, done: 3, total: 16 }, usage);
    expect([...line].length).toBeLessThanOrEqual(100);
    expect(line).toContain("[███░░░░░░░░░░░░░] 3/16 · 81% left · 123.46M tok · 100% session · 100% ctx");
  });
});

describe("Stop hook reminder", () => {
  let root = "";
  const progress = () => join(root, "specs/01-trip-view-progress.md");
  const code = () => join(root, "packages/app/src/App.tsx");
  const at = (file: string, ms: number) => utimesSync(file, ms / 1000, ms / 1000);
  const transcriptFrom = (ms: number) => {
    const path = join(root, "transcript.jsonl");
    writeFileSync(path, `${JSON.stringify({ type: "user", timestamp: new Date(ms).toISOString(), message: { content: "go" } })}\n`);
    return path;
  };
  const setup = (fixture: string) => {
    root = mkdtempSync(join(tmpdir(), "statusline-"));
    cpSync(join(fixtures, fixture), root, { recursive: true });
    mkdirSync(join(root, "packages/app/src"), { recursive: true });
    writeFileSync(code(), "x");
  };
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test("creates a missing progress file from the specification, all unticked", () => {
    setup("no-progress");
    remind({}, root);
    const text = readFileSync(progress(), "utf8");
    expect(text.match(/^- \[ \] \d+\. /gm)?.length).toBe(16);
    expect(text).not.toContain("- [x]");
    expect(readFileSync(join(root, "specs/01-trip-view-specification.md"), "utf8")).toBe(
      readFileSync(join(fixtures, "no-progress/specs/01-trip-view-specification.md"), "utf8"),
    );
  });

  test("reminds when this turn changed code and the progress file was not updated", () => {
    setup("six-done");
    at(progress(), 1_000_000);
    at(code(), 3_000_000);
    const reminder = remind({ transcript_path: transcriptFrom(2_000_000) }, root);
    expect(reminder).toContain("6/16");
    expect(reminder).toContain("specs/01-trip-view-progress.md");
    expect(readFileSync(progress(), "utf8")).toBe(readFileSync(join(fixtures, "six-done/specs/01-trip-view-progress.md"), "utf8"));
  });

  test("stays quiet when the code changed before this turn", () => {
    setup("six-done");
    at(progress(), 1_000_000);
    at(code(), 2_000_000);
    expect(remind({ transcript_path: transcriptFrom(3_000_000) }, root)).toBeNull();
  });

  test("stays quiet once the progress file is updated", () => {
    setup("six-done");
    at(code(), 2_000_000);
    at(progress(), 3_000_000);
    expect(remind({ transcript_path: transcriptFrom(1_000_000) }, root)).toBeNull();
  });

  test("stays quiet while already continuing because of a Stop hook", () => {
    setup("six-done");
    at(progress(), 1_000_000);
    expect(remind({ stop_hook_active: true }, root)).toBeNull();
  });

  test("stays quiet without an active epic", () => {
    setup("all-done");
    at(progress(), 1_000_000);
    expect(remind({}, root)).toBeNull();
  });
});
