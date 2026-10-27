// PreToolUse hook, registered by the /spec skill: reads the tool call from stdin, exits 2 with a reason
// when it breaks the brainstorming loop or writes a specification too early.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decide } from "./spec-loop-rule";
import type { HookInput } from "./estimate-rule";

const input: HookInput = JSON.parse(await Bun.stdin.text());
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
// specs/ is mounted read-only at SPECS_DIR when the hook runs in Docker.
const specsDir = process.env.SPECS_DIR ?? join(projectDir, "specs");
const read = (rel: string): string | null => {
  const file = join(specsDir, rel.replace(/^specs\//, ""));
  return existsSync(file) ? readFileSync(file, "utf8") : null;
};

const decision = decide(input, projectDir, read);
if (decision.block) {
  console.error(decision.reason);
  process.exit(2);
}
