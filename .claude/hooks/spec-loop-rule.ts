// The /spec loop (.claude/skills/spec/SKILL.md): one round of questions at a time, appended to
// specs/{nr}-{name}-brainstorming.md, and the user answers in the file before anything else happens.
// Pure decision logic for spec-loop-guard.ts. Blocks:
// - changing or removing anything already in a brainstorming file (append-only),
// - a new round, or any other addition, while the last round is not ticked "answered" by the user,
// - more than one round at a time, a round without its unticked "answered" line, or a ticked one,
// - the specification before every round is answered and a wireframe (or "No new screens.") was agreed,
// - a specification without the agreed sections, or with no numbered acceptance checks,
// - brainstorming or specification files named other than specs/{nr}-{name}-*.md with a two-digit {nr},
// - shell commands that write these files (use Edit or Write, so the change can be checked).
import { posix as path } from "node:path";
import type { Decision } from "./dependency-rule";
import { writes, type HookInput } from "./estimate-rule";

const SPEC_FILE = /^specs\/[^/]*-(brainstorming|specification)\.md$/;
const NAMED = /^specs\/(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)-(brainstorming|specification)\.md$/;
const ROUND = /^## Round (\d+)\s*$/gm;
const GATE = /^- \[( |x|X)\] Round (\d+) answered\b/gm;
const WIREFRAME = /^```|^No new screens\.?\s*$/m;

export const SPEC_SECTIONS = [
  "## Screens",
  "## Data",
  "## API",
  "## Seed data",
  "## Out of scope",
  "## Acceptance checks",
  "## Check on iOS and Android",
];

const ALLOW: Decision = { block: false };
const SEE = "See .claude/skills/spec/SKILL.md.";
const block = (problem: string): Decision => ({ block: true, reason: `Blocked: ${problem}. ${SEE}` });

const rounds = (text: string): number[] => [...text.matchAll(ROUND)].map((m) => Number(m[1]));
const gates = (text: string): { round: number; ticked: boolean }[] =>
  [...text.matchAll(GATE)].map((m) => ({ round: Number(m[2]), ticked: m[1] !== " " }));

/** The highest round in the file and whether the user has ticked it answered. */
export const lastRound = (text: string): { round: number; answered: boolean } => {
  const all = gates(text);
  if (all.length === 0) return { round: 0, answered: true };
  const last = all.reduce((a, b) => (b.round >= a.round ? b : a));
  return { round: last.round, answered: last.ticked };
};

// Why appending `after` to the brainstorming file `before` breaks the loop, or null.
export const checkBrainstorming = (before: string, after: string): string | null => {
  if (!after.startsWith(before)) {
    return "brainstorming files are append-only: a question or an answer already in the file cannot be changed or removed";
  }
  const added = after.slice(before.length);
  if (added.trim() === "") return null;
  const previous = lastRound(before);
  if (!previous.answered) {
    return `round ${previous.round} is not answered yet. Stop and wait until the user ticks "- [x] Round ${previous.round} answered" in the file`;
  }
  if (gates(added).some((gate) => gate.ticked)) {
    return "only the user ticks a round as answered";
  }
  const addedRounds = rounds(added);
  if (addedRounds.length > 1) return "append one round of questions at a time";
  if (addedRounds.length === 1) {
    const expected = previous.round + 1;
    if (addedRounds[0] !== expected) return `the next round is "## Round ${expected}"`;
    if (!gates(added).some((gate) => gate.round === expected && !gate.ticked)) {
      return `end round ${expected} with the line "- [ ] Round ${expected} answered" for the user to tick`;
    }
  } else if (before.trim() === "") {
    return 'a new brainstorming file starts with "## Round 1" and ends with "- [ ] Round 1 answered"';
  } else if (gates(added).length > 0) {
    return 'an "answered" line belongs at the end of its own "## Round N"';
  }
  return null;
};

// Why the specification `after` cannot be written next to `brainstorming`, or null.
export const checkSpecification = (brainstorming: string | null, after: string): string | null => {
  if (brainstorming === null) return "write the brainstorming file and get every round answered before the specification";
  const last = lastRound(brainstorming);
  if (last.round === 0) return "the brainstorming file has no answered rounds yet";
  if (!last.answered) return `round ${last.round} is not answered yet. Wait for the user before writing the specification`;
  if (!WIREFRAME.test(brainstorming)) {
    return 'the brainstorming file needs an ASCII wireframe of every new screen in a fenced block (or the line "No new screens.") that the user has answered';
  }
  const missing = SPEC_SECTIONS.filter((heading) => !new RegExp(`^${heading}\\s*$`, "m").test(after));
  if (missing.length > 0) return `the specification is missing: ${missing.join(", ")}`;
  const checks = after.split(/^## Acceptance checks\s*$/m)[1]?.split(/^## /m)[0] ?? "";
  if (!/^1\. /m.test(checks)) return 'list numbered acceptance checks ("1. ...") under "## Acceptance checks"';
  return null;
};

const relative = (projectDir: string, cwd: string, file: string): string =>
  path.relative(projectDir, path.resolve(cwd, file));

/** read(rel) returns the file's current content, or null when it does not exist. */
export const decide = (input: HookInput, projectDir: string, read: (rel: string) => string | null): Decision => {
  const { tool_name, tool_input, cwd } = input;

  if ((tool_name === "Edit" || tool_name === "Write") && tool_input.file_path) {
    const rel = relative(projectDir, cwd, tool_input.file_path);
    if (!SPEC_FILE.test(rel)) return ALLOW;
    const named = NAMED.exec(rel);
    if (!named) return block(`name it specs/{nr}-{name}-${rel.endsWith("brainstorming.md") ? "brainstorming" : "specification"}.md, {nr} with two digits and {name} a lowercase slug`);
    const [, nr, name, kind] = named;
    const before = read(rel) ?? "";
    const { content = "", old_string = "", new_string = "", replace_all } = tool_input;
    const after =
      tool_name === "Write"
        ? content
        : replace_all
          ? before.split(old_string).join(new_string)
          : before.replace(old_string, () => new_string);
    const problem =
      kind === "brainstorming"
        ? checkBrainstorming(before, after)
        : checkSpecification(read(`specs/${nr}-${name}-brainstorming.md`), after);
    return problem ? block(problem) : ALLOW;
  }

  if (tool_name === "Bash" && tool_input.command && writes(tool_input.command) && /-(brainstorming|specification)\.md/.test(tool_input.command)) {
    return block("change brainstorming and specification files with the Edit or Write tool, so the change can be checked");
  }
  return ALLOW;
};
