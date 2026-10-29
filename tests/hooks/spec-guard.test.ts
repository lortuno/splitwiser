import { describe, expect, test } from "bun:test";
import { decide, lastRound, type Files } from "../../.claude/hooks/spec-rule";

const root = "/repo";
const BRAIN = "specs/translations/06-translations-brainstorming.md";
const SPEC = "specs/translations/06-translations-specification.md";
const PROGRESS = "specs/translations/06-translations-progress.md";

const round = (n: number, ticked = true, body = "### Q1. Which languages?\n- [x] English, Spanish, French (Recommended)\n") =>
  `## Round ${n}\n\n${body}\n- [${ticked ? "x" : " "}] Round ${n} answered\n`;
const wireframe = "```\n+---------+\n| English |\n+---------+\n```\n";
const answered = `What exists today: English only.\n\n${round(1)}\n${wireframe}\n${round(2)}`;
const spec = [
  "# Epic 6: Translations — specification",
  "## Goal",
  "Three languages.",
  "## Screens",
  "## Data",
  "## API",
  "## Seed data",
  "## Tests",
  "## Acceptance checks",
  "1. Login shows English.",
  "2. Settings switches to Spanish.",
  "## Out of scope",
  "## Check on iOS and Android",
  "",
].join("\n\n");
const files: Files = { [BRAIN]: answered, [SPEC]: spec, [PROGRESS]: "- [x] 1.\n" };

const write = (file: string, content: string, current = files, loop = false) =>
  decide({ tool_name: "Write", tool_input: { file_path: `/repo/${file}`, content }, cwd: root }, root, current, { loop });
const edit = (file: string, old_string: string, new_string: string, current = files, loop = false) =>
  decide({ tool_name: "Edit", tool_input: { file_path: `/repo/${file}`, old_string, new_string }, cwd: root }, root, current, { loop });
const bash = (command: string, cwd = root, current = files) =>
  decide({ tool_name: "Bash", tool_input: { command }, cwd }, root, current);
const reason = (decision: ReturnType<typeof decide>) => (decision.block ? decision.reason : "");

describe("layout: one living specification per feature, in its category folder", () => {
  test("changing the existing specification in place", () => {
    expect(edit(SPEC, "Three languages.", "Four languages.").block).toBe(false);
    expect(edit(PROGRESS, "- [x] 1.", "- [ ] 1.").block).toBe(false);
  });

  test("a new feature in an existing or a new category", () => {
    expect(write("specs/expenses/08-export-csv-brainstorming.md", round(1, false)).block).toBe(false);
    expect(write("specs/ui-design/08-dark-mode-brainstorming.md", round(1, false)).block).toBe(false);
  });

  test.each([
    ["directly in specs/", "specs/08-export-csv-specification.md"],
    ["a category with capitals", "specs/UI/08-dark-mode-specification.md"],
    ["a one-digit number", "specs/expenses/8-export-csv-brainstorming.md"],
    ["no number", "specs/expenses/export-csv-specification.md"],
    ["two folders deep", "specs/expenses/csv/08-export-csv-specification.md"],
  ])("blocks a file %s", (_, file) => {
    const decision = write(file, "x");
    expect(decision.block).toBe(true);
    expect(reason(decision)).toContain("specs/{category}/{nr}-{name}-");
  });

  test("blocks a second spec for a feature that has one, in any category or under any number", () => {
    const decision = write("specs/ui-design/09-translations-specification.md", spec);
    expect(reason(decision)).toContain(`already has its spec in specs/translations/06-translations-*.md`);
    expect(write("specs/translations/09-translations-brainstorming.md", round(1, false)).block).toBe(true);
  });

  test("blocks a new feature that reuses another feature's number", () => {
    expect(reason(write("specs/translations/06-language-dropdown-brainstorming.md", round(1, false)))).toContain("number 06");
  });

  test.each(["translations-v2", "translations-new", "language-picker-update", "languages-changes", "dropdown-2026-10-28"])(
    "blocks a feature named like a copy or a version: %s",
    (name) => {
      expect(reason(write(`specs/translations/08-${name}-brainstorming.md`, round(1, false)))).toContain("edits its existing specification");
    },
  );

  test.each([
    ["a Changes section", "## Changes\n\n- 2026-10-28: four languages"],
    ["a change log", "## Changelog\n\nFour languages."],
    ["a History section", "### History\n\nWas three languages."],
    ["an Update section", "## Update 2026-10-28\n\nFour languages."],
    ["struck-through text", "~~Three~~ Four languages."],
  ])("blocks %s in a specification", (_, text) => {
    expect(reason(edit(SPEC, "Three languages.", text))).toContain("source of truth");
  });

  test("a change heading belongs in the brainstorming file, not the specification", () => {
    expect(edit(BRAIN, round(2), `${round(2)}\n# Change: dropdown\n\n${round(3, false)}`).block).toBe(false);
  });

  test("other files under specs/ are not feature files", () => {
    expect(write("specs/roadmap.md", "## Changes").block).toBe(false);
    expect(write("specs/trips/01-trip-at-a-glance-testplan.md", "x").block).toBe(false);
    expect(write("packages/app/src/App.tsx", "x").block).toBe(false);
  });
});

describe("layout: shell commands", () => {
  test.each([
    [`sed -i '' 's/Three/Four/' ${SPEC}`],
    [`echo '## Round 3' >> ${BRAIN}`],
    [`git mv ${SPEC} specs/ui-design/ && echo done`],
  ])("blocks %s", (command) => {
    expect(reason(bash(command))).toContain("Edit or Write tool");
  });

  test("moving a feature to another category with git mv", () => {
    expect(bash(`git mv ${BRAIN} ${SPEC} ${PROGRESS} specs/ui-design/`).block).toBe(false);
    const relative = "git mv 06-translations-brainstorming.md 06-translations-specification.md 06-translations-progress.md ../ui-design/";
    expect(bash(relative, "/repo/specs/translations").block).toBe(false);
  });

  test("renaming a feature one file at a time, inside its folder", () => {
    expect(bash(`git mv ${SPEC} specs/translations/06-languages-specification.md`).block).toBe(false);
    const halfway = { [BRAIN]: answered, "specs/translations/06-languages-specification.md": spec, [PROGRESS]: "" };
    expect(bash(`git mv ${BRAIN} specs/translations/06-languages-brainstorming.md`, root, halfway).block).toBe(false);
  });

  test("a rename still cannot take another feature's number or name, or split a feature across folders", () => {
    const other = { ...files, "specs/expenses/04-edit-expenses-specification.md": spec };
    expect(bash(`git mv ${SPEC} specs/translations/04-translations-specification.md`, root, other).block).toBe(true);
    expect(bash(`git mv ${SPEC} specs/translations/06-edit-expenses-specification.md`, root, other).block).toBe(true);
    expect(bash(`git mv ${SPEC} specs/i18n/06-languages-specification.md`).block).toBe(true);
  });

  test("moving a flat spec into its category folder", () => {
    expect(bash("git mv specs/08-export-specification.md specs/expenses/", root, {}).block).toBe(false);
  });

  test.each([
    ["out of the category folders", `git mv ${SPEC} specs/`],
    ["to a bad name", `git mv ${SPEC} specs/translations/translations-specification.md`],
    ["away from its brainstorming file", `git mv ${SPEC} specs/ui-design/`],
  ])("blocks git mv %s", (_, command) => {
    expect(bash(command).block).toBe(true);
  });

  test("read-only commands", () => {
    expect(bash(`cat ${SPEC}`).block).toBe(false);
    expect(bash(`grep -rn Round specs/translations/`).block).toBe(false);
  });
});

describe("loop: one round at a time while /spec runs", () => {
  const open = `${answered}\n${round(3, false)}`;
  const loopEdit = (file: string, from: string, to: string, current = files) => edit(file, from, to, current, true);

  test("the last round is found", () => {
    expect(lastRound(answered)).toEqual({ round: 2, answered: true });
    expect(lastRound(open)).toEqual({ round: 3, answered: false });
    expect(lastRound("")).toEqual({ round: 0, answered: true });
    // Epic 1 was brainstormed before the "answered" line existed.
    expect(lastRound("## Round 1\n\n### Q1. Hero?\n\n### Round 1 answers\n")).toEqual({ round: 1, answered: true });
  });

  test("a change to a feature brainstormed before the answered line continues with round 2", () => {
    const legacy = { ...files, [BRAIN]: `## Round 1\n\n${wireframe}\n### Round 1 answers\n` };
    expect(loopEdit(BRAIN, "answers\n", `answers\n\n# Change: flags\n\n${round(2, false)}`, legacy).block).toBe(false);
    expect(loopEdit(SPEC, "Three languages.", "Four languages.", legacy).block).toBe(false);
  });

  test("a change starts with a new round in the same brainstorming file", () => {
    expect(loopEdit(BRAIN, round(2), `${round(2)}\n# Change: dropdown\n\n${round(3, false)}`).block).toBe(false);
  });

  test("blocks a round while the last one is not answered", () => {
    expect(reason(loopEdit(BRAIN, round(3, false), `${round(3, false)}\n${round(4, false)}`, { ...files, [BRAIN]: open }))).toContain(
      "round 3 is not answered yet",
    );
  });

  test.each([
    ["changing an answer", "English, Spanish, French", "English only"],
    ["removing a round", round(2), ""],
  ])("blocks %s (append-only)", (_, from, to) => {
    expect(reason(loopEdit(BRAIN, from, to))).toContain("append-only");
  });

  test.each([
    ["two rounds at once", `${round(3, false)}\n${round(4, false)}`, "one round of questions at a time"],
    ["a skipped number", round(4, false), '"## Round 3"'],
    ["a round without its answered line", "## Round 3\n\n### Q1. Flags?\n", "end round 3"],
    ["a round ticked by Claude", round(3, true), "only the user"],
  ])("blocks %s", (_, added, message) => {
    expect(reason(loopEdit(BRAIN, round(2), `${round(2)}\n${added}`))).toContain(message);
  });

  test("a new brainstorming file starts with round 1", () => {
    expect(write("specs/expenses/08-export-csv-brainstorming.md", round(1, false), files, true).block).toBe(false);
    expect(write("specs/expenses/08-export-csv-brainstorming.md", "Notes", files, true).block).toBe(true);
  });

  test("the specification changes once every round is answered", () => {
    expect(loopEdit(SPEC, "Three languages.", "Four languages.").block).toBe(false);
  });

  test("blocks a specification change while a round is open", () => {
    expect(reason(loopEdit(SPEC, "Three languages.", "Four languages.", { ...files, [BRAIN]: open }))).toContain("round 3 is not answered");
  });

  test("blocks a specification without its brainstorming, its sections or its checks", () => {
    expect(reason(write("specs/expenses/08-export-csv-specification.md", spec, files, true))).toContain("brainstorming file");
    expect(reason(loopEdit(SPEC, "## API", "## Endpoints"))).toContain("missing: ## API");
    expect(reason(loopEdit(SPEC, "1. Login shows English.\n\n2.", "-"))).toContain("numbered acceptance checks");
  });

  test("blocks a specification before a wireframe was agreed", () => {
    const noWireframe = { ...files, [BRAIN]: `${round(1)}\n${round(2)}` };
    expect(reason(loopEdit(SPEC, "Three languages.", "Four languages.", noWireframe))).toContain("wireframe");
  });

  test("a specification /spec never wrote (no brainstorming file, the tooling estimates) is not loop-checked", () => {
    const tooling = "specs/tooling/00-tooling-specification.md";
    expect(loopEdit(tooling, "x", "y", { ...files, [tooling]: "# Tooling\n\nx\n" }).block).toBe(false);
    expect(write("specs/tooling/09-new-specification.md", spec, files, true).block).toBe(true);
  });

  test("outside /spec the loop is not checked", () => {
    expect(edit(SPEC, "Three languages.", "Four languages.", { ...files, [BRAIN]: open }).block).toBe(false);
  });
});
