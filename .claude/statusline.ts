// Status line: progress of this session's epic (see sessionEpic) and the tokens this session has used, on one line.
// Progress is the ticked build steps plus the ticked acceptance checks in specs/{category}/{nr}-{name}-progress.md, out of
// the spec's build sections plus its acceptance checks. It is read again on every refresh, so each tick moves the bar.
// Reads the status line JSON from stdin and prints e.g.
//   01-trip-view  [██████░░░░░░░░░░] 8/21 · 62% left · 48.2k tok · 34% session · 41% ctx · Opus
// Never fails: on any error it still prints a short line and exits 0.
// The pure parts are exported for tests and for .claude/hooks/progress-reminder.ts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export const MAX_WIDTH = 100;
const BAR_WIDTH = 16;
const SPEC = /^(\d+)-(.+)-specification\.md$/;
const CHECK = /^(\d+)\.\s+(.*)$/;
const TICK = /^- \[([ xX])\] (\d+)\.(\s|$)/;
const STEP_TICK = /^- \[[xX]\] (.+?)\s*$/;
// The build sections of a specification, in the order the /spec skill writes them. Each one the spec has is a step.
const STEPS = ["Screens", "Data", "API", "Seed data", "Tests"];

export type Check = { nr: number; text: string };
export type Epic = {
  label: string;
  specPath: string;
  progressPath: string;
  hasProgress: boolean;
  steps: string[];
  stepsDone: number;
  checks: Check[];
  done: number;
};

// Steps and checks together: what the bar shows.
export const epicProgress = (epic: Epic): { done: number; total: number } => ({
  done: epic.stepsDone + epic.done,
  total: epic.steps.length + epic.checks.length,
});

export const parseSteps = (spec: string): string[] => {
  const headings = new Set(spec.split("\n").map((line) => line.match(/^## (.+?)\s*$/)?.[1]));
  return STEPS.filter((step) => headings.has(step));
};

// Number of distinct steps ticked "- [x] Screens" (the step's name and nothing else); anything else is ignored.
export const countStepsDone = (progress: string, steps: string[]): number => {
  const done = new Set<string>();
  for (const line of progress.split("\n")) {
    const tick = line.trim().match(STEP_TICK);
    if (tick && steps.includes(tick[1])) done.add(tick[1]);
  }
  return done.size;
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

export const progressFile = (label: string, steps: string[], checks: Check[]): string =>
  [
    `# ${label}: progress`,
    "",
    "Tick a step as soon as it is built. Tick a check only after it passes in the browser and its test is green.",
    "",
    ...(steps.length > 0 ? ["## Steps", "", ...steps.map((step) => `- [ ] ${step}`), ""] : []),
    "## Acceptance checks",
    "",
    ...checks.map((check) => `- [ ] ${check.nr}. ${check.text}`),
    "",
  ].join("\n");

// Specs in specs/ and its category folders (specs/translations/06-translations-specification.md), newest
// (highest number) first. file is relative to specs/.
const specs = (root: string): { label: string; nr: number; file: string }[] => {
  const dir = join(root, "specs");
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => file.split("/").length <= 2)
    .map((file) => ({ file, match: basename(file).match(SPEC) }))
    .filter((entry) => entry.match !== null)
    .map(({ file, match }) => ({ file, nr: Number(match![1]), label: `${match![1]}-${match![2]}` }))
    .sort((a, b) => b.nr - a.nr || b.label.localeCompare(a.label));
};

// The epic with number nr, if its specification has acceptance checks. A missing progress file counts as
// 0 done; the Stop hook creates it, the status line only reads.
export const epicByNr = (root: string, nr: number): Epic | null => {
  const spec = specs(root).find((candidate) => candidate.nr === nr);
  if (!spec) return null;
  const specPath = join(root, "specs", spec.file);
  const progressPath = join(dirname(specPath), `${spec.label}-progress.md`);
  const text = readFileSync(specPath, "utf8");
  const checks = parseChecks(text);
  if (checks.length === 0) return null;
  const steps = parseSteps(text);
  const hasProgress = existsSync(progressPath);
  const progress = hasProgress ? readFileSync(progressPath, "utf8") : "";
  const done = countDone(progress, checks);
  const stepsDone = countStepsDone(progress, steps);
  return { label: spec.label, specPath, progressPath, hasProgress, steps, stepsDone, checks, done };
};

// "specs/expenses/02-export-progress.md", "/spec 2", "epic 2" or "feature 2".
const EPIC_REF =
  /specs\/(?:[\w-]+\/)?(\d+)-[\w-]+-(?:brainstorming|specification|progress)\.md|<command-name>\/spec<\/command-name>\s*<command-args>\s*(\d+)|\b(?:epic|feature)\s+#?(\d+)\b/gi;

const epicRefs = (text: string): number[] =>
  [...text.matchAll(EPIC_REF)].map((match) => Number(match[1] ?? match[2] ?? match[3]));

// The epic this session works on: the last one it referred to, in a prompt the user typed or in the input
// of a tool call. Tool results are skipped, because a listing of specs/ names every epic. /clear starts a
// new transcript, so a cleared session has no epic until it names one.
export const sessionEpicNr = (jsonl: string): number | null => {
  let nr: number | null = null;
  for (const line of jsonl.split("\n")) {
    try {
      const entry = JSON.parse(line);
      const content = entry?.message?.content;
      const texts: string[] = [];
      if (entry.type === "user" && !entry.isMeta) {
        if (typeof content === "string") texts.push(content);
        else if (Array.isArray(content))
          texts.push(...content.filter((block) => block?.type === "text").map((block) => String(block.text)));
      } else if (entry.type === "assistant" && Array.isArray(content)) {
        texts.push(...content.filter((block) => block?.type === "tool_use").map((block) => JSON.stringify(block.input ?? {})));
      }
      for (const ref of texts.flatMap(epicRefs)) nr = ref;
    } catch {
      // Empty, partly written or malformed line: skip it.
    }
  }
  return nr;
};

// The epic of the session whose transcript is at transcriptPath, or null when it has not named one (yet).
export const sessionEpic = (root: string, transcriptPath?: string): Epic | null => {
  if (!transcriptPath) return null;
  let nr: number | null;
  try {
    nr = sessionEpicNr(readFileSync(transcriptPath, "utf8"));
  } catch {
    return null;
  }
  return nr === null ? null : epicByNr(root, nr);
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
  context_window?: { total_input_tokens?: number; total_output_tokens?: number; used_percentage?: number | null };
  rate_limits?: { five_hour?: { used_percentage?: number | null } };
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

// Session tokens, the share of the 5-hour session limit and of the context window used, and the model.
// A percentage the input does not have (yet) is left out.
export type Consumption = { tokens: number; sessionPct?: number | null; contextPct?: number | null; model?: string };

const percent = (value: number | null | undefined, name: string): string[] =>
  typeof value === "number" && Number.isFinite(value) ? [`${Math.round(value)}% ${name}`] : [];

export const renderLine = (epic: Shown | null, usage: Consumption): string => {
  const tail = [
    `${formatTokens(usage.tokens)} tok`,
    ...percent(usage.sessionPct, "session"),
    ...percent(usage.contextPct, "ctx"),
    ...(usage.model ? [usage.model] : []),
  ].join(" · ");
  if (!epic) return fit(`no active spec · ${tail}`, MAX_WIDTH);
  const filled = roundHalfEven(epic.done * BAR_WIDTH, epic.total);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const left = roundHalfEven((epic.total - epic.done) * 100, epic.total);
  const rest = `  [${bar}] ${epic.done}/${epic.total} · ${left}% left · ${tail}`;
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
  const usage: Consumption = {
    tokens: sessionTokens(input),
    sessionPct: input.rate_limits?.five_hour?.used_percentage,
    contextPct: input.context_window?.used_percentage,
    model: input.model?.display_name,
  };
  try {
    const epic = sessionEpic(input.workspace?.project_dir ?? input.cwd ?? fallbackRoot, input.transcript_path);
    if (!epic?.hasProgress) return renderLine(null, usage);
    return renderLine({ label: epic.label, ...epicProgress(epic) }, usage);
  } catch {
    return renderLine(null, usage);
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
