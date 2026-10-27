import { describe, expect, test } from "bun:test";
import { decide } from "../.claude/hooks/dependency-rule";

const root = "/repo";
const bash = (command: string, cwd = root) => decide({ tool_name: "Bash", tool_input: { command }, cwd }, root);
const write = (tool_name: string, file_path: string, cwd = root) => decide({ tool_name, tool_input: { file_path }, cwd }, root);

describe("dependency guard blocks package installs", () => {
  test.each([
    ["bun add lodash --cwd packages/app"],
    ["bun add --cwd=packages/app lodash"],
    ["bun add lodash --filter app"],
    ["npm install lodash --workspace=packages/app"],
    ["npm i lodash --prefix packages/app"],
    ["pnpm add lodash -C packages/api"],
    ["cd packages/app && bun add lodash"],
    ["cd /repo/packages/app; npm install lodash"],
    ["docker compose run --rm -w /repo/packages/app app bun add lodash"],
    ["echo '{}' > packages/app/package.json"],
  ])("%s", (command) => {
    const decision = bash(command);
    expect(decision.block).toBe(true);
    if (decision.block) expect(decision.reason).toContain("specs/guidelines/architecture.md");
  });

  test("install while the shell is inside packages/", () => {
    expect(bash("bun add lodash", "/repo/packages/app").block).toBe(true);
  });

  test("Write and Edit of a package manifest", () => {
    expect(write("Write", "/repo/packages/app/package.json").block).toBe(true);
    expect(write("Edit", "packages/api/package.json").block).toBe(true);
    expect(write("Edit", "package.json", "/repo/packages/app").block).toBe(true);
  });
});

describe("dependency guard allows root installs", () => {
  test.each([
    ["bun add lodash"],
    ["bun install"],
    ["npm install lodash"],
    ["docker compose run --rm app bun add lodash"],
    ["cd packages/app && cd ../.. && bun add lodash"],
    ["cd packages/app && bun test"],
    ["cat packages/app/package.json"],
  ])("%s", (command) => {
    expect(bash(command).block).toBe(false);
  });

  test("Write and Edit of the root manifest and package sources", () => {
    expect(write("Edit", "/repo/package.json").block).toBe(false);
    expect(write("Edit", "../../package.json", "/repo/packages/app").block).toBe(false);
    expect(write("Write", "/repo/packages/app/src/App.tsx").block).toBe(false);
    expect(write("Write", "/repo/node_modules/expo/package.json").block).toBe(false);
  });
});
