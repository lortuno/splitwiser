// Architecture rule 2: JS dependencies live only in the root package.json.
// Pure decision logic for the PreToolUse hook in dependency-guard.ts.
import { posix as path } from "node:path";

export type HookInput = {
  tool_name: string;
  tool_input: { file_path?: string; command?: string };
  cwd: string;
};

export type Decision = { block: false } | { block: true; reason: string };

const ALLOW: Decision = { block: false };
const MANAGERS = new Set(["bun", "npm", "pnpm", "yarn"]);
const INSTALL_VERBS = new Set(["add", "a", "install", "i", "in"]);
const WORKSPACE_FLAGS = new Set(["--filter", "-F", "--workspace"]);
const DIR_FLAGS = new Set(["--cwd", "--prefix", "--dir", "-C", "-w", "--workdir"]);

const block = (what: string): Decision => ({
  block: true,
  reason:
    `Blocked: ${what}. JS dependencies live only in the root package.json ` +
    `(rule 2 in specs/guidelines/architecture.md). Add it at the repo root instead, ` +
    `and list it under Inventory in the same commit (rule 11).`,
});

const isInPackages = (absPath: string, projectDir: string): boolean => {
  const rel = path.relative(projectDir, absPath);
  return rel.startsWith("packages/") && !rel.split("/").includes("node_modules");
};

const isPackageManifest = (absPath: string, projectDir: string): boolean =>
  isInPackages(absPath, projectDir) && path.basename(absPath) === "package.json";

const unquote = (token: string): string => token.replace(/^['"]|['"]$/g, "");

// Returns the reason an install segment targets a package, or null if it targets the root.
const installTarget = (tokens: string[], dir: string, projectDir: string): string | null => {
  const managerAt = tokens.findIndex((t, i) => MANAGERS.has(path.basename(t)) && INSTALL_VERBS.has(tokens[i + 1] ?? ""));
  if (managerAt === -1) return null;
  // Flags before the manager count too, e.g. `docker compose run -w <dir> app bun add x`.
  for (let i = 0; i < tokens.length; i++) {
    const [flag, inline] = tokens[i].split("=", 2);
    const value = inline ?? tokens[i + 1] ?? "";
    if (WORKSPACE_FLAGS.has(flag)) return `installing into a workspace package (${flag})`;
    if (DIR_FLAGS.has(flag) && isInPackages(path.resolve(dir, value), projectDir)) {
      return `installing into ${value} (${flag})`;
    }
  }
  if (isInPackages(dir, projectDir)) return `installing from inside ${path.relative(projectDir, dir)}/`;
  return null;
};

const decideCommand = (command: string, cwd: string, projectDir: string): Decision => {
  let dir = cwd;
  for (const segment of command.split(/&&|\|\||[;|\n]/)) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean).map(unquote);
    if (tokens[0] === "cd") {
      dir = path.resolve(dir, tokens[1] ?? projectDir);
      continue;
    }
    const target = installTarget(tokens, dir, projectDir);
    if (target) return block(target);
    const manifest = tokens.find((t) => isPackageManifest(path.resolve(dir, t.replace(/^>+/, "")), projectDir));
    if (manifest && /(^|\s)(>>?|tee|cp|mv|touch|sed\s+-i)/.test(segment)) {
      return block(`writing ${path.relative(projectDir, path.resolve(dir, manifest.replace(/^>+/, "")))}`);
    }
  }
  return ALLOW;
};

export const decide = (input: HookInput, projectDir: string): Decision => {
  const { tool_name, tool_input, cwd } = input;
  if ((tool_name === "Edit" || tool_name === "Write") && tool_input.file_path) {
    const target = path.resolve(cwd, tool_input.file_path);
    return isPackageManifest(target, projectDir)
      ? block(`editing ${path.relative(projectDir, target)}`)
      : ALLOW;
  }
  if (tool_name === "Bash" && tool_input.command) {
    return decideCommand(tool_input.command, cwd, projectDir);
  }
  return ALLOW;
};
