// Stop hook: during an epic build, reminds Claude to tick the build steps that are done and the checks that
// passed in specs/{category}/{nr}-{name}-progress.md. It only reminds; it never ticks anything. It creates the progress
// file (all unticked) from the specification when it is missing, and never edits the specification.
// "During an epic build" means: this session works on an epic that is not done (see sessionEpic), and this
// turn changed files under packages/ or tests/ without touching the progress file. That way the reminder comes once per turn of work, not on
// every answer.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { epicProgress, progressFile, sessionEpic } from "../statusline";

export type StopInput = { cwd?: string; transcript_path?: string; stop_hook_active?: boolean };

const WATCHED = ["packages", "tests"];
const SKIP = new Set(["node_modules", ".expo", "dist", "dist-native", "web-build", "var", "test-results"]);

// Newest modification time of any file under dir, in ms.
const newestChange = (dir: string): number => {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name) || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestChange(path));
    else if (entry.isFile()) newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
};

// When the current turn started: the timestamp of the last prompt the user typed (tool results also
// arrive as "user" entries and are skipped). 0 when the transcript cannot be read.
export const turnStart = (jsonl: string): number => {
  let start = 0;
  for (const line of jsonl.split("\n")) {
    if (!line.includes('"type":"user"')) continue;
    try {
      const entry = JSON.parse(line);
      const content = entry?.message?.content;
      const typed = typeof content === "string" || (Array.isArray(content) && content.some((block) => block?.type === "text"));
      if (entry.type === "user" && !entry.isMeta && typed) start = Date.parse(entry.timestamp) || start;
    } catch {
      // Malformed line: skip it.
    }
  }
  return start;
};

const readTurnStart = (path?: string): number => {
  try {
    return path ? turnStart(readFileSync(path, "utf8")) : 0;
  } catch {
    return 0;
  }
};

// The reminder for Claude, or null when there is nothing to remind of.
export const remind = (input: StopInput, root: string): string | null => {
  if (input.stop_hook_active) return null;
  const epic = sessionEpic(root, input.transcript_path);
  if (!epic) return null;
  const { done, total } = epicProgress(epic);
  if (done === total) return null;
  if (!epic.hasProgress) writeFileSync(epic.progressPath, progressFile(epic.label, epic.steps, epic.checks));
  const changed = Math.max(0, ...WATCHED.map((dir) => join(root, dir)).filter(existsSync).map(newestChange));
  const since = Math.max(readTurnStart(input.transcript_path), statSync(epic.progressPath).mtimeMs);
  if (changed <= since) return null;
  return (
    `Epic ${epic.label}: ${epic.stepsDone}/${epic.steps.length} build steps and ${epic.done}/${epic.checks.length} ` +
    `acceptance checks are ticked in ${relative(root, epic.progressPath)}, and this turn changed code or tests. ` +
    `For each step (${epic.steps.join(", ")}) that is now built, change "- [ ] Step" to "- [x] Step". For each ` +
    `check that now passes in the browser and whose test is green, change "- [ ] N." to "- [x] N.". Add a missing ` +
    `step line unticked. Leave everything else unticked and do not edit the specification. If nothing is done, ` +
    `say so and stop.`
  );
};

if (import.meta.main) {
  try {
    const input: StopInput = JSON.parse(await Bun.stdin.text());
    const reminder = remind(input, process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
    if (reminder) {
      console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "Stop", additionalContext: reminder } }));
    }
  } catch {
    // A reminder is never worth blocking the session for.
  }
}
