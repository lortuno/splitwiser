// PreToolUse hook: reads the tool call from stdin, exits 2 with a reason when it starts feature work
// without an open estimate, or breaks the estimate table of a specification.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decide, SPEC_FILE, type HookInput, type Specs } from "./estimate-rule";

const input: HookInput = JSON.parse(await Bun.stdin.text());
const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd;
// specs/ is mounted read-only at SPECS_DIR when the hook runs in Docker.
const specsDir = process.env.SPECS_DIR ?? join(projectDir, "specs");
const specs: Specs = {};
if (existsSync(specsDir)) {
  // Category folders included: specs/translations/06-translations-specification.md.
  for (const file of readdirSync(specsDir, { recursive: true }) as string[]) {
    if (SPEC_FILE.test(`specs/${file}`)) specs[`specs/${file}`] = readFileSync(join(specsDir, file), "utf8");
  }
}
const decision = decide(input, projectDir, specs);

if (decision.block) {
  console.error(decision.reason);
  process.exit(2);
}
