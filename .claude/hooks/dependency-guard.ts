// PreToolUse hook: reads the tool call from stdin, exits 2 with a reason when it adds a
// dependency to a package instead of the root package.json.
import { decide, type HookInput } from "./dependency-rule";

const input: HookInput = JSON.parse(await Bun.stdin.text());
const decision = decide(input, process.env.CLAUDE_PROJECT_DIR ?? input.cwd);

if (decision.block) {
  console.error(decision.reason);
  process.exit(2);
}
