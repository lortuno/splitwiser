import { describe, expect, test } from "bun:test";
import { checkLog, decide, parse, type Specs } from "../../.claude/hooks/estimate-rule";

const root = "/repo";
const intro = "# 03 Create a trip\n\nSource: `specs/roadmap.md`, epic 3.\n\n";
const header = "## Estimate\n\n| Date | Task | Estimate (h) | Actual (h) |\n|---|---|---|---|\n";
const goal = "\n## Goal\n\n| Field | Rule |\n|---|---|\n| Name | required |\n";
const spec = (rows = "") => `${intro}${header}${rows}${goal}`;
const empty = spec();
const closed = spec("| 2026-10-20 | Blue theme | 2 | 1.5 |\n");
const open = spec("| 2026-10-20 | Blue theme | 2 | 1.5 |\n| 2026-10-27 | Export CSV | 6 | |\n");

const SPEC = "specs/03-create-a-trip-specification.md";
const OTHER = "specs/04-edit-expenses-specification.md";
const only = (text: string): Specs => ({ [SPEC]: text });

const bash = (command: string, specs: Specs, cwd = root) => decide({ tool_name: "Bash", tool_input: { command }, cwd }, root, specs);
const write = (file_path: string, specs: Specs, cwd = root) =>
  decide({ tool_name: "Write", tool_input: { file_path, content: "x" }, cwd }, root, specs);
const editSpec = (old_string: string, new_string: string, specs: Specs, file = SPEC) =>
  decide({ tool_name: "Edit", tool_input: { file_path: `/repo/${file}`, old_string, new_string }, cwd: root }, root, specs);

describe("estimate guard blocks feature work without an open estimate", () => {
  test.each([[{}], [only(empty)], [only(closed)]])("Write and Edit under packages/ and tests/", (specs) => {
    const decision = write("/repo/packages/app/src/theme.ts", specs);
    expect(decision.block).toBe(true);
    if (decision.block) expect(decision.reason).toContain("## Estimate");
    expect(write("tests/unit/format.test.ts", specs).block).toBe(true);
    expect(write("src/App.tsx", specs, "/repo/packages/app").block).toBe(true);
  });

  test.each([
    ["sed -i '' 's/a/b/' packages/app/src/theme.ts"],
    ["echo x > packages/app/src/new.ts"],
    ["python3 -c \"open('packages/app/src/theme.ts','w').write('')\""],
    ["rm tests/unit/old.test.ts"],
    ["git checkout -- packages/api/src/Money.php"],
  ])("%s", (command) => {
    expect(bash(command, only(closed)).block).toBe(true);
  });

  test("writing from inside packages/", () => {
    expect(bash("touch new.ts", only(closed), "/repo/packages/app/src").block).toBe(true);
  });

  test("an open row outside the Estimate section does not count", () => {
    const stray = `${closed}\n## Notes\n\n| Date | Task | Estimate (h) | Actual (h) |\n|---|---|---|---|\n| 2026-10-27 | X | 4 | |\n`;
    expect(write("/repo/packages/app/src/theme.ts", only(stray)).block).toBe(true);
  });
});

describe("estimate guard allows", () => {
  test("feature work while an estimate is open", () => {
    expect(write("/repo/packages/app/src/theme.ts", only(open)).block).toBe(false);
    expect(bash("sed -i '' 's/a/b/' packages/app/src/theme.ts", only(open)).block).toBe(false);
  });

  test("feature work while an estimate is open in any spec", () => {
    expect(write("/repo/packages/app/src/theme.ts", { [SPEC]: closed, [OTHER]: open }).block).toBe(false);
  });

  test.each([
    ["grep -rn accent packages/app/src 2>/dev/null"],
    ["docker compose run --rm app bun test tests/unit 2>&1 | tail -5"],
    ["cat packages/app/src/theme.ts"],
    ["git diff packages/"],
  ])("read-only command without an estimate: %s", (command) => {
    expect(bash(command, only(closed)).block).toBe(false);
  });

  test("changes outside packages/ and tests/ without an estimate", () => {
    expect(write("/repo/README.md", only(closed)).block).toBe(false);
    expect(write("/repo/.claude/hooks/x.ts", only(closed)).block).toBe(false);
  });
});

describe("estimate table of a specification", () => {
  test("only rows of the Estimate section are parsed", () => {
    expect(parse(open).map((row) => row.task)).toEqual(["Blue theme", "Export CSV"]);
    expect(parse("# Spec\n\n## Goal\n\n| A | B |\n|---|---|\n| 1 | 2 |\n")).toEqual([]);
  });

  test("a new estimate after the previous one is closed", () => {
    expect(editSpec("| 1.5 |\n", "| 1.5 |\n| 2026-10-27 | Export CSV | 6 | |\n", only(closed)).block).toBe(false);
  });

  test("adding the Estimate section to a spec without one", () => {
    const decision = editSpec("## Goal", `${header}| 2026-10-27 | Build the epic | 3 | |\n\n## Goal`, { [SPEC]: `${intro}${goal}` });
    expect(decision.block).toBe(false);
  });

  test("a new estimate in one spec while another spec has an open row", () => {
    const specs = { [SPEC]: open, [OTHER]: closed };
    expect(editSpec("| 1.5 |\n", "| 1.5 |\n| 2026-10-27 | Dark mode | 3 | |\n", specs, OTHER).block).toBe(false);
  });

  test("recording the actual hours of the open row", () => {
    expect(editSpec("| 6 | |", "| 6 | 7.5 |", only(open)).block).toBe(false);
  });

  test("rewriting an older 2-column table into the new layout", () => {
    const old = `${intro}## Estimate\n\n| Estimated (h) | Actual (h) |\n|---|---|\n| 2 | 0.6 |\n${goal}`;
    const decision = editSpec(
      "| Estimated (h) | Actual (h) |\n|---|---|\n| 2 | 0.6 |",
      "| Date | Task | Estimate (h) | Actual (h) |\n|---|---|---|---|\n| 2026-10-27 | Build the epic | 2 | 0.6 |",
      only(old),
    );
    expect(decision.block).toBe(false);
  });

  test("blocks a second open estimate in the same spec", () => {
    const decision = editSpec("| 6 | |\n", "| 6 | |\n| 2026-10-28 | Dark mode | 3 | |\n", only(open));
    expect(decision.block).toBe(true);
    if (decision.block) {
      expect(decision.reason).toContain("Export CSV");
      expect(decision.reason).toContain(SPEC);
    }
  });

  test.each([
    ["changing an estimate", "| Blue theme | 2 |", "| Blue theme | 1 |"],
    ["changing recorded actual hours", "| 2 | 1.5 |", "| 2 | 3 |"],
    ["removing a row", "| 2026-10-20 | Blue theme | 2 | 1.5 |\n", ""],
    ["removing the section", header, ""],
  ])("blocks %s", (_, from, to) => {
    expect(editSpec(from, to, only(open)).block).toBe(true);
  });

  test("tables outside the Estimate section can change freely", () => {
    expect(editSpec("| Name | required |", "| Name | optional |", only(open)).block).toBe(false);
  });

  test.each([
    ["| 27.10.2026 | X | 4 | |"],
    ["| 2026-10-27 |  | 4 | |"],
    ["| 2026-10-27 | X | 0 | |"],
    ["| 2026-10-27 | X | four | |"],
    ["| 2026-10-27 | X | 4 | -1 |"],
    ["| 2026-10-27 | X | 4 |"],
  ])("rejects malformed row %s", (row) => {
    expect(checkLog(closed, closed.replace("| 1.5 |\n", `| 1.5 |\n${row}\n`))).not.toBeNull();
  });

  test("blocks shell writes to a specification", () => {
    expect(bash(`echo '| 2026-10-27 | X | 4 | |' >> ${SPEC}`, only(closed)).block).toBe(true);
    expect(bash(`sed -i '' 's/| 6 | |/| 6 | 1 |/' ${SPEC}`, only(open)).block).toBe(true);
    expect(bash(`git mv ${SPEC} specs/trips/ && echo '| x |' >> specs/trips/03-create-a-trip-specification.md`, only(open)).block).toBe(true);
  });

  test("a plain git mv moves a specification, because it keeps its estimates", () => {
    expect(bash(`git mv ${SPEC} specs/trips/`, only(open)).block).toBe(false);
  });

  test("specifications in category folders count", () => {
    const inFolder = "specs/trips/03-create-a-trip-specification.md";
    expect(write("/repo/packages/app/src/theme.ts", { [inFolder]: open }).block).toBe(false);
    expect(editSpec("| Blue theme | 2 |", "| Blue theme | 1 |", { [inFolder]: open }, inFolder).block).toBe(true);
  });
});
