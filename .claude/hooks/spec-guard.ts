// PreToolUse hook: reads the tool call from stdin, exits 2 with a reason when it breaks the layout of specs/
// (one living specification per feature, in its category folder). Registered in .claude/settings.json; the /spec
// skill registers it again with --loop, which adds the rules of the brainstorming loop.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decide, FEATURE_FILE, type Files } from "./spec-rule";
import type { HookInput } from "./estimate-rule";

const input: HookInput = JSON.parse(await Bun.stdin.text());
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
// specs/ is mounted read-only at SPECS_DIR when the hook runs in Docker.
const specsDir = process.env.SPECS_DIR ?? join(projectDir, "specs");
const files: Files = {};
if (existsSync(specsDir)) {
  for (const file of readdirSync(specsDir, { recursive: true }) as string[]) {
    if (FEATURE_FILE.test(`specs/${file}`)) files[`specs/${file}`] = readFileSync(join(specsDir, file), "utf8");
  }
}

const decision = decide(input, projectDir, files, { loop: process.argv.includes("--loop") });
if (decision.block) {
  console.error(decision.reason);
  process.exit(2);
}
