// Estimates rule (AGENTS.md): no feature work without an open estimate in docs/estimates.md, and no
// new estimate until the previous one has its actual hours. Pure decision logic for estimate-guard.ts.
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

export const ESTIMATES_FILE = "docs/estimates.md";
const GUARDED = ["packages/", "tests/"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HOURS = /^\d+(\.\d+)?$/;

const ALLOW: Decision = { block: false };
const SEE = `See "Estimates" in AGENTS.md.`;

type Row = { cells: string[]; date: string; feature: string; estimate: string; actual: string };

const parse = (text: string): Row[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .slice(2) // header and separator
    .map((line) => {
      const cells = line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
      const [date = "", feature = "", estimate = "", actual = ""] = cells;
      return { cells, date, feature, estimate, actual };
    });

const isHours = (value: string): boolean => HOURS.test(value) && Number(value) > 0;

const openRows = (text: string): Row[] => parse(text).filter((row) => row.actual === "");

// Returns why the change from `before` to `after` breaks the log, or null if it is fine.
export const checkLog = (before: string, after: string): string | null => {
  const rows = parse(after);
  for (const row of rows) {
    const label = row.feature || row.cells.join(" | ");
    if (row.cells.length !== 4) return `"${label}" must have 4 columns: Date | Feature | Estimate (h) | Actual (h)`;
    if (!DATE.test(row.date)) return `"${label}" needs a date as YYYY-MM-DD`;
    if (row.feature === "") return `a row has no feature name`;
    if (!isHours(row.estimate)) return `"${label}" needs an estimate in hours greater than 0`;
    if (row.actual !== "" && !isHours(row.actual)) return `"${label}" needs actual hours greater than 0, or empty while in progress`;
  }
  const open = rows.filter((row) => row.actual === "");
  if (open.length > 1) {
    return `"${open[0].feature}" is still open; record its actual hours before estimating a new feature`;
  }
  const previous = parse(before);
  for (const [i, old] of previous.entries()) {
    const now = rows[i];
    if (!now || now.date !== old.date || now.feature !== old.feature || now.estimate !== old.estimate) {
      return `rows are append-only; the estimate for "${old.feature}" cannot be changed or removed`;
    }
    if (old.actual !== "" && now.actual !== old.actual) {
      return `the actual hours for "${old.feature}" are already recorded and cannot be changed`;
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
    `Blocked: ${what} is feature work and needs an open estimate first. Append a row to ` +
    `${ESTIMATES_FILE} with the date, the feature and the estimated development hours, ` +
    `leaving Actual empty. ${SEE}`,
});

const badLog = (problem: string): Decision => ({
  block: true,
  reason: `Blocked: ${ESTIMATES_FILE} change rejected: ${problem}. ${SEE}`,
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

const mentionsGuarded = (command: string): boolean =>
  GUARDED.some((dir) => new RegExp(`(^|[\\s'"=/])${dir}`).test(command));

export const decide = (input: HookInput, projectDir: string, estimates: string): Decision => {
  const { tool_name, tool_input, cwd } = input;
  const hasOpen = openRows(estimates).length > 0;

  if ((tool_name === "Edit" || tool_name === "Write") && tool_input.file_path) {
    const rel = relative(projectDir, cwd, tool_input.file_path);
    if (rel === ESTIMATES_FILE) {
      const { content = "", old_string = "", new_string = "", replace_all } = tool_input;
      const after =
        tool_name === "Write"
          ? content
          : replace_all
            ? estimates.split(old_string).join(new_string)
            : estimates.replace(old_string, () => new_string);
      const problem = checkLog(estimates, after);
      return problem ? badLog(problem) : ALLOW;
    }
    return isGuarded(rel) && !hasOpen ? noEstimate(`changing ${rel}`) : ALLOW;
  }

  if (tool_name === "Bash" && tool_input.command && writes(tool_input.command)) {
    const { command } = tool_input;
    if (command.includes(ESTIMATES_FILE) || command.includes("estimates.md")) {
      return badLog("edit it with the Edit or Write tool so the change can be checked");
    }
    const insideGuarded = isGuarded(`${path.relative(projectDir, cwd)}/`);
    if (!hasOpen && (insideGuarded || mentionsGuarded(command))) {
      return noEstimate("a shell command that writes under packages/ or tests/");
    }
  }
  return ALLOW;
};
