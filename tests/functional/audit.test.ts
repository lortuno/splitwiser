// Feature 8, check 15: the PHP and JS dependencies have no known vulnerability (`composer audit`, `bun audit`).
import { expect, test } from "bun:test";

const ROOT = `${import.meta.dir}/../..`;

function audit(cmd: string[], cwd: string) {
  const result = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  const output = result.stdout.toString() + result.stderr.toString();
  console.log(output);
  return result.exitCode;
}

test("composer audit: no vulnerable PHP package", () => {
  expect(audit(["composer", "audit", "--locked", "--no-interaction"], `${ROOT}/packages/api`)).toBe(0);
}, 60_000);

test("bun audit: no vulnerable JS package", () => {
  expect(audit(["bun", "audit"], ROOT)).toBe(0);
}, 60_000);
