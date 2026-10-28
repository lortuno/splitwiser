// Estimates rule (AGENTS.md): every feature keeps its estimates in the "## Estimate" table of its own
// specification. No feature work without an open estimate in some specification, and no new estimate in a
// specification until its previous one has its actual hours. Specifications are independent, so several
// features can be estimated at the same time. Pure decision logic for estimate-guard.ts.
import { posix as path } from "node:path";
import type { Decision } from "./dependency-rule";

export type HookInput = {
  tool_name: string;
  tool_input: {
    file_path?: string;
    command?: string;
    content?: string;
    old_string?: string;
    new_string?: string;
    replace_all?: boolean;
  };
  cwd: string;
};

// Specification files by path relative to the project ("specs/accounts/02-login-specification.md") and their text.
export type Specs = Record<string, string>;

// Directly in specs/ or in a category folder; spec-rule.ts decides where a specification may live.
export const SPEC_FILE = /^specs\/(?:[^/]+\/)?[^/]+-specification\.md$/;
export const TOOLING_SPEC = "specs/tooling/00-tooling-specification.md";
const HEADING = "## Estimate";
const GUARDED = ["packages/", "tests/"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOURS = /^\d+(\.\d+)?$/;

const ALLOW: Decision = { block: false };
const SEE = `See "Estimates" in AGENTS.md.`;

type Row = { cells: string[]; date: string; task: string; estimate: string; actual: string };

// The lines of the "## Estimate" section, up to the next heading of the same or a higher level.
const section = (spec: string): string[] => {
  const lines = spec.split("\n").map((line) => line.trim());
  const start = lines.indexOf(HEADING);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line));
  return end === -1 ? rest : rest.slice(0, end);
};

export const parse = (spec: string): Row[] =>
  section(spec)
    .filter((line) => line.startsWith("|"))
    .slice(2) // header and separator
    .map((line) => {
      const cells = line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const [date = "", task = "", estimate = "", actual = ""] = cells;
      return { cells, date, task, estimate, actual };
    });

const isHours = (value: string): boolean => HOURS.test(value) && Number(value) > 0;

const hasOpenRow = (specs: Specs): boolean =>
  Object.values(specs).some((spec) => parse(spec).some((row) => row.actual === ""));

// Returns why the change of a specification from `before` to `after` breaks its estimate table, or null.
export const checkLog = (before: string, after: string): string | null => {
  const rows = parse(after);
  for (const row of rows) {
    const label = row.task || row.cells.join(" | ");
    if (row.cells.length !== 4) return `"${label}" must have 4 columns: Date | Task | Estimate (h) | Actual (h)`;
    if (!DATE.test(row.date)) return `"${label}" needs a date as YYYY-MM-DD`;
    if (row.task === "") return `a row has no task`;
    if (!isHours(row.estimate)) return `"${label}" needs an estimate in hours greater than 0`;
    if (row.actual !== "" && !isHours(row.actual)) return `"${label}" needs actual hours greater than 0, or empty while in progress`;
  }
  const open = rows.filter((row) => row.actual === "");
  if (open.length > 1) {
    return `"${open[0].task}" is still open; record its actual hours before estimating another task of this feature`;
  }
  // Rows that were not 4 columns wide before (an older table layout) can be rewritten.
  for (const [i, old] of parse(before).filter((row) => row.cells.length === 4).entries()) {
    const now = rows[i];
    if (!now || now.date !== old.date || now.task !== old.task || now.estimate !== old.estimate) {
      return `rows are append-only; the estimate for "${old.task}" cannot be changed or removed`;
    }
    if (old.actual !== "" && now.actual !== old.actual) {
      return `the actual hours for "${old.task}" are already recorded and cannot be changed`;
    }
  }
  return null;
};

const relative = (projectDir: string, cwd: string, file: string): string =>
  path.relative(projectDir, path.resolve(cwd, file));

const isGuarded = (rel: string): boolean => GUARDED.some((dir) => rel.startsWith(dir));

const noEstimate = (what: string): Decision => ({
  block: true,
  reason:
    `Blocked: ${what} is feature work and needs an open estimate first. Append a row to the ` +
    `"${HEADING}" table of the feature's specs/{category}/{nr}-{name}-specification.md (work outside an epic: ` +
    `${TOOLING_SPEC}) with the date, the task and the estimated development hours, leaving Actual empty. ${SEE}`,
});

const badLog = (rel: string, problem: string): Decision => ({
  block: true,
  reason: `Blocked: estimate in ${rel} rejected: ${problem}. ${SEE}`,
});

// Best effort: does this shell command write files? Harmless redirects are removed first.
export const writes = (command: string): boolean => {
  const stripped = command.replace(/\d*>&\d+|\d*>\s*\/dev\/null|=>|->/g, "");
  return (
    stripped.includes(">") ||
    /(^|[\s;&|(`])(rm|cp|mv|touch|tee|ln|truncate|patch|dd)\s/.test(stripped) ||
    /\b(sed|perl)\s+(-\w+\s+)*-\w*i/.test(stripped) ||
    /open\([^)]*['"][wa]|writeFile|write_text|file_put_contents/.test(stripped) ||
    /\bgit\s+(apply|checkout|restore|stash|reset)\b/.test(stripped)
  );
};

// A single "git mv [options] <source>... <target>" with nothing chained to it, or null. A move keeps the
// content, so specifications may be moved between category folders this way.
export const gitMove = (command: string): { sources: string[]; target: string } | null => {
  if (/[;&|<>`$()\n]/.test(command)) return null;
  const words = command.trim().split(/\s+/);
  if (words[0] !== "git" || words[1] !== "mv") return null;
  const paths = words.slice(2).filter((word) => !word.startsWith("-"));
  if (paths.length < 2) return null;
  return { sources: paths.slice(0, -1), target: paths[paths.length - 1] };
};

const mentionsGuarded = (command: string): boolean =>
  GUARDED.some((dir) => new RegExp(`(^|[\\s'"=/])${dir}`).test(command));

export const decide = (input: HookInput, projectDir: string, specs: Specs): Decision => {
  const { tool_name, tool_input, cwd } = input;
  const hasOpen = hasOpenRow(specs);

  if ((tool_name === "Edit" || tool_name === "Write") && tool_input.file_path) {
    const rel = relative(projectDir, cwd, tool_input.file_path);
    if (SPEC_FILE.test(rel)) {
      const before = specs[rel] ?? "";
      const { content = "", old_string = "", new_string = "", replace_all } = tool_input;
      const after =
        tool_name === "Write"
          ? content
          : replace_all
            ? before.split(old_string).join(new_string)
            : before.replace(old_string, () => new_string);
      const problem = checkLog(before, after);
      return problem ? badLog(rel, problem) : ALLOW;
    }
    return isGuarded(rel) && !hasOpen ? noEstimate(`changing ${rel}`) : ALLOW;
  }

  if (tool_name === "Bash" && tool_input.command && writes(tool_input.command)) {
    const { command } = tool_input;
    if (command.includes("-specification.md") && !gitMove(command)) {
      return badLog("a specification", "edit it with the Edit or Write tool so its estimates can be checked");
    }
    const insideGuarded = isGuarded(`${path.relative(projectDir, cwd)}/`);
    if (!hasOpen && (insideGuarded || mentionsGuarded(command))) {
      return noEstimate("a shell command that writes under packages/ or tests/");
    }
  }
  return ALLOW;
};
