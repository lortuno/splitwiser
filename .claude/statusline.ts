// Status line: progress of the active epic and the tokens this session has used, on one line.
// Reads the status line JSON from stdin and prints e.g.
//   01-trip-view  [██████░░░░░░░░░░] 6/16 checks · 62% left · 48.2k tokens · Opus
// Never fails: on any error it still prints a short line and exits 0.
// The pure parts are exported for tests and for .claude/hooks/progress-reminder.ts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MAX_WIDTH = 100;
const BAR_WIDTH = 16;
const SPEC = /^(\d+)-(.+)-specification\.md$/;
const CHECK = /^(\d+)\.\s+(.*)$/;
const TICK = /^- \[([ xX])\] (\d+)\.(\s|$)/;

export type Check = { nr: number; text: string };
export type Epic = {
  label: string;
  specPath: string;
  progressPath: string;
  hasProgress: boolean;
  checks: Check[];
  done: number;
};

// The numbered items under "## Acceptance checks", each joined into one line.
export const parseChecks = (spec: string): Check[] => {
  const checks: Check[] = [];
  let inSection = false;
  let current: Check | null = null;
  for (const line of spec.split("\n")) {
    if (line.startsWith("## ")) {
      inSection = /^## Acceptance checks\s*$/.test(line);
      current = null;
      continue;
    }
    if (!inSection) continue;
    const item = line.match(CHECK);
    if (item) {
      current = { nr: Number(item[1]), text: item[2].trim() };
      checks.push(current);
    } else if (current && /^\s+\S/.test(line)) {
      current.text += ` ${line.trim()}`;
    } else {
      current = null;
    }
  }
  return checks;
};

// Number of distinct checks ticked "- [x] N." with N one of the spec's checks; anything else is ignored.
export const countDone = (progress: string, checks: Check[]): number => {
  const known = new Set(checks.map((check) => check.nr));
  const done = new Set<number>();
  for (const line of progress.split("\n")) {
    const tick = line.trim().match(TICK);
    if (tick && tick[1] !== " " && known.has(Number(tick[2]))) done.add(Number(tick[2]));
  }
  return done.size;
};

export const progressFile = (label: string, checks: Check[]): string =>
  [
    `# ${label}: progress`,
    "",
    "Tick a check only after it passes in the browser and its test is green.",
    "",
    ...checks.map((check) => `- [ ] ${check.nr}. ${check.text}`),
    "",
  ].join("\n");

// Specs in specs/, newest (highest number) first.
const specs = (root: string): { label: string; nr: number; file: string }[] => {
  const dir = join(root, "specs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((file) => ({ file, match: file.match(SPEC) }))
    .filter((entry) => entry.match !== null)
    .map(({ file, match }) => ({ file, nr: Number(match![1]), label: `${match![1]}-${match![2]}` }))
    .sort((a, b) => b.nr - a.nr || b.label.localeCompare(a.label));
};

// The newest spec with acceptance checks that are not all ticked yet. A missing progress file counts as 0 done;
// the Stop hook creates it, the status line only reads.
export const activeEpic = (root: string): Epic | null => {
  for (const spec of specs(root)) {
    const specPath = join(root, "specs", spec.file);
    const progressPath = join(root, "specs", `${spec.label}-progress.md`);
    const checks = parseChecks(readFileSync(specPath, "utf8"));
    if (checks.length === 0) continue;
    const hasProgress = existsSync(progressPath);
    const done = hasProgress ? countDone(readFileSync(progressPath, "utf8"), checks) : 0;
    if (done < checks.length) return { label: spec.label, specPath, progressPath, hasProgress, checks, done };
  }
  return null;
};

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

const sumUsage = (usage: Usage): number =>
  (usage.input_tokens ?? 0) +
  (usage.output_tokens ?? 0) +
  (usage.cache_creation_input_tokens ?? 0) +
  (usage.cache_read_input_tokens ?? 0);

// Input + output + cache tokens of every API response in a transcript (JSONL). A response that is split
// over several lines (one per content block) repeats the same usage, so each message id counts once.
export const transcriptTokens = (jsonl: string): number => {
  const seen = new Set<string>();
  let total = 0;
  for (const line of jsonl.split("\n")) {
    if (!line.includes('"usage"')) continue;
    try {
      const entry = JSON.parse(line);
      const usage: Usage | undefined = entry?.message?.usage;
      if (!usage) continue;
      const id = entry.message.id ?? entry.requestId ?? entry.uuid;
      if (id !== undefined) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      total += sumUsage(usage);
    } catch {
      // A partly written last line or a malformed entry: skip it.
    }
  }
  return total;
};

export type StatusInput = {
  model?: { display_name?: string };
  workspace?: { project_dir?: string };
  cwd?: string;
  transcript_path?: string;
  context_window?: { total_input_tokens?: number; total_output_tokens?: number };
};

// The status line JSON has no session total (context_window.* is only what is in the context right now),
// so the transcript is summed. context_window is the fallback when the transcript cannot be read.
export const sessionTokens = (input: StatusInput): number => {
  if (input.transcript_path) {
    try {
      return transcriptTokens(readFileSync(input.transcript_path, "utf8"));
    } catch {
      // Not readable (yet): fall through.
    }
  }
  const window = input.context_window;
  return (window?.total_input_tokens ?? 0) + (window?.total_output_tokens ?? 0);
};

export const formatTokens = (tokens: number): string => {
  if (tokens < 1_000) return String(tokens);
  if (tokens < 1_000_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
};

// Rounds a/b to a whole number, halves to even: 10/16 of 100 = 62.5 → 62.
const roundHalfEven = (numerator: number, denominator: number): number => {
  const quotient = Math.floor(numerator / denominator);
  const twice = 2 * (numerator - quotient * denominator);
  if (twice > denominator) return quotient + 1;
  if (twice === denominator) return quotient + (quotient % 2);
  return quotient;
};

const fit = (text: string, width: number): string => {
  const chars = [...text];
  return chars.length <= width ? text : `${chars.slice(0, Math.max(0, width - 1)).join("")}…`;
};

type Shown = { label: string; done: number; total: number };

export const renderLine = (epic: Shown | null, tokens: number, model?: string): string => {
  const tail = [`${formatTokens(tokens)} tokens`, ...(model ? [model] : [])].join(" · ");
  if (!epic) return fit(`no active spec · ${tail}`, MAX_WIDTH);
  const filled = roundHalfEven(epic.done * BAR_WIDTH, epic.total);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const left = roundHalfEven((epic.total - epic.done) * 100, epic.total);
  const rest = `  [${bar}] ${epic.done}/${epic.total} checks · ${left}% left · ${tail}`;
  const label = fit(epic.label, Math.max(8, MAX_WIDTH - [...rest].length));
  return fit(label + rest, MAX_WIDTH);
};

export const statusLine = (raw: string, fallbackRoot: string): string => {
  let input: StatusInput = {};
  try {
    input = JSON.parse(raw) ?? {};
  } catch {
    // No or broken JSON: show what the files say.
  }
  const tokens = sessionTokens(input);
  const model = input.model?.display_name;
  try {
    const epic = activeEpic(input.workspace?.project_dir ?? input.cwd ?? fallbackRoot);
    if (!epic?.hasProgress) return renderLine(null, tokens, model);
    return renderLine({ label: epic.label, done: epic.done, total: epic.checks.length }, tokens, model);
  } catch {
    return renderLine(null, tokens, model);
  }
};

if (import.meta.main) {
  let line: string;
  try {
    line = statusLine(await Bun.stdin.text(), process.cwd());
  } catch {
    line = "status line error";
  }
  console.log(line);
}
