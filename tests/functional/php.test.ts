// `bun test` only runs Bun's own test runner, so the PHP suite is started from here.
import { expect, test } from "bun:test";

test("PHP API test suite", () => {
  const result = Bun.spawnSync(["php", "packages/api/tests/run.php"], {
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = result.stdout.toString() + result.stderr.toString();
  console.log(output);
  expect(result.exitCode).toBe(0);
  // Logins and sign-ups hash passwords with bcrypt, which is slow on purpose: the suite takes several seconds.
}, 60_000);
