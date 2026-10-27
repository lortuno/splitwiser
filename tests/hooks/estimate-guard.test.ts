import { describe, expect, test } from "bun:test";
import { checkLog, decide } from "../../.claude/hooks/estimate-rule";

const root = "/repo";
const header = "# Estimates\n\n| Date | Feature | Estimate (h) | Actual (h) |\n|---|---|---|---|\n";
const empty = header;
const closed = `${header}| 2026-10-20 | Blue theme | 2 | 1.5 |\n`;
const open = `${closed}| 2026-10-27 | Export CSV | 6 | |\n`;

const bash = (command: string, log: string, cwd = root) => decide({ tool_name: "Bash", tool_input: { command }, cwd }, root, log);
const write = (file_path: string, log: string, cwd = root) => decide({ tool_name: "Write", tool_input: { file_path, content: "x" }, cwd }, root, log);
const editLog = (old_string: string, new_string: string, log: string) =>
  decide({ tool_name: "Edit", tool_input: { file_path: "/repo/docs/estimates.md", old_string, new_string }, cwd: root }, root, log);

describe("estimate guard blocks feature work without an open estimate", () => {
  test.each([[empty], [closed]])("Write and Edit under packages/ and tests/", (log) => {
    const decision = write("/repo/packages/app/src/theme.ts", log);
    expect(decision.block).toBe(true);
    if (decision.block) expect(decision.reason).toContain("docs/estimates.md");
    expect(write("tests/unit/format.test.ts", closed).block).toBe(true);
    expect(write("src/App.tsx", closed, "/repo/packages/app").block).toBe(true);
  });

  test.each([
    ["sed -i '' 's/a/b/' packages/app/src/theme.ts"],
    ["echo x > packages/app/src/new.ts"],
    ["python3 -c \"open('packages/app/src/theme.ts','w').write('')\""],
    ["rm tests/unit/old.test.ts"],
    ["git checkout -- packages/api/src/Money.php"],
  ])("%s", (command) => {
    expect(bash(command, closed).block).toBe(true);
  });

  test("writing from inside packages/", () => {
    expect(bash("touch new.ts", closed, "/repo/packages/app/src").block).toBe(true);
  });
});

describe("estimate guard allows", () => {
  test("feature work while an estimate is open", () => {
    expect(write("/repo/packages/app/src/theme.ts", open).block).toBe(false);
    expect(bash("sed -i '' 's/a/b/' packages/app/src/theme.ts", open).block).toBe(false);
  });

  test.each([
    ["grep -rn accent packages/app/src 2>/dev/null"],
    ["docker compose run --rm app bun test tests/unit 2>&1 | tail -5"],
    ["cat packages/app/src/theme.ts"],
    ["git diff packages/"],
  ])("read-only command without an estimate: %s", (command) => {
    expect(bash(command, closed).block).toBe(false);
  });

  test("changes outside packages/ and tests/ without an estimate", () => {
    expect(write("/repo/README.md", closed).block).toBe(false);
    expect(write("/repo/.claude/hooks/x.ts", closed).block).toBe(false);
  });
});

describe("estimates log", () => {
  test("a new estimate after the previous one is closed", () => {
    expect(editLog("| 1.5 |\n", "| 1.5 |\n| 2026-10-27 | Export CSV | 6 | |\n", closed).block).toBe(false);
  });

  test("recording the actual hours of the open row", () => {
    expect(editLog("| 6 | |", "| 6 | 7.5 |", open).block).toBe(false);
  });

  test("blocks a second open estimate", () => {
    const decision = editLog("| 6 | |\n", "| 6 | |\n| 2026-10-28 | Dark mode | 3 | |\n", open);
    expect(decision.block).toBe(true);
    if (decision.block) expect(decision.reason).toContain("Export CSV");
  });

  test.each([
    ["changing an estimate", "| Blue theme | 2 |", "| Blue theme | 1 |"],
    ["changing recorded actual hours", "| 2 | 1.5 |", "| 2 | 3 |"],
    ["removing a row", "| 2026-10-20 | Blue theme | 2 | 1.5 |\n", ""],
  ])("blocks %s", (_, from, to) => {
    expect(editLog(from, to, open).block).toBe(true);
  });

  test.each([
    ["| 27.10.2026 | X | 4 | |"],
    ["| 2026-10-27 |  | 4 | |"],
    ["| 2026-10-27 | X | 0 | |"],
    ["| 2026-10-27 | X | four | |"],
    ["| 2026-10-27 | X | 4 | -1 |"],
    ["| 2026-10-27 | X | 4 |"],
  ])("rejects malformed row %s", (row) => {
    expect(checkLog(closed, `${closed}${row}\n`)).not.toBeNull();
  });

  test("blocks shell writes to the log", () => {
    expect(bash("echo '| 2026-10-27 | X | 4 | |' >> docs/estimates.md", closed).block).toBe(true);
  });
});
