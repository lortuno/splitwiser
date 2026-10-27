// PreToolUse hook: reads the tool call from stdin, exits 2 with a reason when it starts feature work
// without an open estimate, or breaks the estimates log.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decide, ESTIMATES_FILE, type HookInput } from "./estimate-rule";

const input: HookInput = JSON.parse(await Bun.stdin.text());
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
const file = process.env.ESTIMATES_PATH ?? join(projectDir, ESTIMATES_FILE);
const estimates = existsSync(file) ? readFileSync(file, "utf8") : "";
const decision = decide(input, projectDir, estimates);

if (decision.block) {
  console.error(decision.reason);
  process.exit(2);
}
