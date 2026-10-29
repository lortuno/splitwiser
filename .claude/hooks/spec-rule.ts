// The /spec rules (.claude/skills/spec/SKILL.md). Pure decision logic for spec-guard.ts.
//
// Layout, always (registered in .claude/settings.json): every feature has one living specification in its category
// folder, and it is the source of truth. A change to a feature edits that specification; git keeps the history.
// Blocks:
// - brainstorming, specification or progress files anywhere but specs/{category}/{nr}-{name}-{kind}.md, with
//   {category} and {name} lowercase slugs and {nr} two digits,
// - a new file for a feature that already has its files under another number, name or category,
// - a new feature whose name marks a copy or a version of another ("-v2", "-new", "-update", "-changes", ...),
// - a change log in a specification: a "## Changes", "## History" or "## Update" heading, or ~~struck-through~~ text,
// - shell commands that write brainstorming or specification files, except a plain "git mv" to a valid place.
//
// Loop, only while /spec runs (registered by the skill with --loop): one round of questions at a time, appended to
// the feature's brainstorming file, and the user answers in the file before anything else happens. Blocks:
// - changing or removing anything already in a brainstorming file (append-only),
// - a new round, or any other addition, while the last round is not ticked "answered" by the user,
// - more than one round at a time, a round without its unticked "answered" line, or a ticked one,
// - writing or changing the specification before every round is answered and a wireframe (or "No new screens.") was
//   agreed, or without the agreed sections and numbered acceptance checks.
import { posix as path } from "node:path";
import type { Decision } from "./dependency-rule";
import { gitMove, writes, type HookInput } from "./estimate-rule";

// Brainstorming, specification and progress files by path relative to the project
// ("specs/translations/06-translations-specification.md") and their text.
export type Files = Record<string, string>;

export const FEATURE_FILE = /^specs\/.*-(brainstorming|specification|progress)\.md$/;
const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
const NAMED = new RegExp(`^specs/(${SLUG})/(\\d{2})-(${SLUG})-(brainstorming|specification|progress)\\.md$`);
const CATEGORY_DIR = new RegExp(`^specs/${SLUG}$`);
const VERSIONED =
  /-(v\d+|new|old|copy|draft|final|update|updates|updated|change|changes|changed|revised|revision|rework|redesign|fix|fixes|amended|amendment|\d{4}-\d{2}-\d{2})$/;
const CHANGELOG = /^#{1,6}\s+(changes?|changed|change ?log|history|revisions?|updates?|updated|addendum|amendments?|errata)\b/im;
const STRUCK = /~~[^~\n]+~~/;
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

type Feature = { category: string; nr: string; name: string };

const ALLOW: Decision = { block: false };
const SEE = "See .claude/skills/spec/SKILL.md.";
const block = (problem: string): Decision => ({ block: true, reason: `Blocked: ${problem}. ${SEE}` });

const rounds = (text: string): number[] => [...text.matchAll(ROUND)].map((m) => Number(m[1]));
const gates = (text: string): { round: number; ticked: boolean }[] =>
  [...text.matchAll(GATE)].map((m) => ({ round: Number(m[2]), ticked: m[1] !== " " }));

/** The highest round in the file and whether the user has ticked it answered. A round without an "answered"
 *  line predates that line (epic 1) and counts as answered; new rounds cannot be appended without one. */
export const lastRound = (text: string): { round: number; answered: boolean } => {
  const round = Math.max(0, ...rounds(text), ...gates(text).map((gate) => gate.round));
  const own = gates(text).filter((gate) => gate.round === round);
  return { round, answered: own.length === 0 || own.some((gate) => gate.ticked) };
};

const feature = (rel: string): (Feature & { kind: string }) | null => {
  const named = NAMED.exec(rel);
  return named ? { category: named[1], nr: named[2], name: named[3], kind: named[4] } : null;
};

const folder = (f: Feature): string => `specs/${f.category}/${f.nr}-${f.name}`;

// Why a new file for `target` would start a second spec of an existing feature, or reuse another feature's number.
export const conflict = (target: Feature, files: Files): string | null => {
  for (const rel of Object.keys(files)) {
    const other = feature(rel);
    if (!other || (other.category === target.category && other.nr === target.nr && other.name === target.name)) continue;
    if (other.name === target.name) {
      return `the feature "${target.name}" already has its spec in ${folder(other)}-*.md. One feature has one specification: change that file instead of starting a new one`;
    }
    if (other.nr === target.nr) {
      return `number ${target.nr} already belongs to ${folder(other)}-*.md. Change that feature's files, or give a new feature the next free number`;
    }
  }
  return null;
};

// Why a file at `rel` (new when it is not in `files`) with the content `after` breaks the layout, or null.
export const checkLayout = (rel: string, files: Files, after: string | null): string | null => {
  const target = feature(rel);
  if (!target) {
    const kind = rel.match(FEATURE_FILE)?.[1] ?? "specification";
    return `name it specs/{category}/{nr}-{name}-${kind}.md: {category} a lowercase folder such as "translations" or "expenses", {nr} with two digits and {name} a lowercase slug`;
  }
  if (!(rel in files)) {
    if (VERSIONED.test(target.name)) {
      return `"${target.name}" reads like a copy or a version of a feature. A change to a feature edits its existing specification in place; git keeps the history`;
    }
    const problem = conflict(target, files);
    if (problem) return problem;
  }
  if (target.kind === "specification" && after !== null) {
    if (CHANGELOG.test(after) || STRUCK.test(after)) {
      return 'the specification is the source of truth and reads as if it had always been this way: no "Changes", "History" or "Update" sections and no ~~struck-through~~ text. Git keeps the history';
    }
  }
  return null;
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

// Why `git mv` of these sources to this target (relative to the project) breaks the layout, or null. A rename inside
// the feature's own folder leaves the feature's other files out of the conflict check, so a feature can be renamed one
// file at a time (01-trip-at-a-glance → 01-group-at-a-glance); another feature's number or name still conflicts, and
// a single file moved to another folder still splits the feature.
const checkMove = (sources: string[], target: string, files: Files): string | null => {
  const into = target.endsWith(".md") ? feature(target)?.category : null;
  const renamed = sources.map(feature).filter((f) => f !== null && f.category === into);
  const rest = Object.fromEntries(
    Object.entries(files).filter(([rel]) => {
      const f = feature(rel);
      return !sources.includes(rel) && !(f && renamed.some((m) => m!.category === f.category && m!.nr === f.nr && m!.name === f.name));
    }),
  );
  for (const source of sources) {
    if (!FEATURE_FILE.test(source)) continue;
    const destination = target.endsWith(".md") ? target : path.join(target, path.basename(source));
    if (!target.endsWith(".md") && !CATEGORY_DIR.test(target.replace(/\/$/, ""))) {
      return `move feature files into a category folder: specs/{category}/`;
    }
    const problem = checkLayout(destination, rest, files[source] ?? null);
    if (problem) return problem;
  }
  return null;
};

const relative = (projectDir: string, cwd: string, file: string): string =>
  path.relative(projectDir, path.resolve(cwd, file));

/** files: every brainstorming, specification and progress file under specs/. loop: the /spec loop runs. */
export const decide = (input: HookInput, projectDir: string, files: Files, { loop = false } = {}): Decision => {
  const { tool_name, tool_input, cwd } = input;

  if ((tool_name === "Edit" || tool_name === "Write") && tool_input.file_path) {
    const rel = relative(projectDir, cwd, tool_input.file_path);
    if (!FEATURE_FILE.test(rel)) return ALLOW;
    const before = files[rel] ?? "";
    const { content = "", old_string = "", new_string = "", replace_all } = tool_input;
    const after =
      tool_name === "Write"
        ? content
        : replace_all
          ? before.split(old_string).join(new_string)
          : before.replace(old_string, () => new_string);
    const layout = checkLayout(rel, files, after);
    if (layout) return block(layout);
    if (!loop) return ALLOW;
    const target = feature(rel)!;
    // A specification that exists without a brainstorming file was never written by /spec (the tooling estimates).
    if (target.kind === "specification" && rel in files && !(`${folder(target)}-brainstorming.md` in files)) return ALLOW;
    const problem =
      target.kind === "brainstorming"
        ? checkBrainstorming(before, after)
        : target.kind === "specification"
          ? checkSpecification(files[`${folder(target)}-brainstorming.md`] ?? null, after)
          : null;
    return problem ? block(problem) : ALLOW;
  }

  const command = tool_input.command;
  if (tool_name === "Bash" && command && writes(command) && /-(brainstorming|specification)\.md/.test(command)) {
    const move = gitMove(command);
    if (!move) return block("change brainstorming and specification files with the Edit or Write tool, so the change can be checked");
    const at = (file: string) => relative(projectDir, cwd, file);
    const problem = checkMove(move.sources.map(at), at(move.target), files);
    return problem ? block(problem) : ALLOW;
  }
  return ALLOW;
};
