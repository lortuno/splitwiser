// Feature 8, check 15: the PHP and JS dependencies have no known vulnerability (`composer audit`, `bun audit`), except
// the accepted exceptions below, which mirror the "Accepted audit exceptions" table of the security specification.
// Any other advisory, a stale entry or a passed review date fails the run. Entries record roles, never names.
import { expect, test } from "bun:test";

const ROOT = `${import.meta.dir}/../..`;

interface AcceptedException {
  id: string;
  package: string;
  severity: "low" | "moderate" | "high" | "critical";
  comesFrom: string;
  why: string;
  accepted: { by: string; on: string };
  /** Link to the issue or PR with the Domain Lead's approval; null while it is pending. */
  domainLeadApproval: string | null;
  /** YYYY-MM-DD: on and after this day the run fails, so the exception is looked at again. */
  reviewBy: string;
}

export const ACCEPTED_EXCEPTIONS: AcceptedException[] = [
  {
    id: "GHSA-mrhx-c7xc-m3w5",
    package: "zod 3.25.76",
    severity: "high",
    comesFrom: "expo > @expo/cli",
    why:
      "Runs only in Expo's command-line tool on developer machines, on the project's own files; not in the shipped app " +
      "and no user input reaches it. The fix, zod 4.6.6, is a major version no Expo 58 release accepts. In bun.lock since the first commit.",
    accepted: { by: "feature owner", on: "2026-10-29" },
    domainLeadApproval: null,
    reviewBy: "2027-01-31",
  },
  {
    id: "GHSA-gcqx-w48m-w2h4",
    package: "deepmerge 4.3.1",
    severity: "low",
    comesFrom: "expo > @expo/config",
    why:
      "Build-time configuration merging of the project's own files; not in the shipped app. Blocked by @expo/config's " +
      "^4.3.1. In bun.lock since the first commit.",
    accepted: { by: "feature owner", on: "2026-10-29" },
    domainLeadApproval: null,
    reviewBy: "2027-01-31",
  },
];

function run(cmd: string[], cwd: string): { exitCode: number; output: string } {
  const result = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, output: result.stdout.toString() + result.stderr.toString() };
}

/** The advisory ids `bun audit` reports with no exception applied. */
function reportedAdvisoryIds(): Set<string> {
  const { output } = run(["bun", "audit", "--json"], ROOT);
  const report = JSON.parse(output.slice(output.indexOf("{"))) as Record<string, { url: string }[]>;
  return new Set(Object.values(report).flat().map((advisory) => advisory.url.split("/").pop()!));
}

const today = () => new Date().toISOString().slice(0, 10);

test("composer audit: no vulnerable PHP package", () => {
  const { exitCode, output } = run(["composer", "audit", "--locked", "--no-interaction"], `${ROOT}/packages/api`);
  console.log(output);
  expect(exitCode).toBe(0);
}, 60_000);

test("bun audit: no vulnerable JS package except the accepted exceptions", () => {
  const { exitCode, output } = run(["bun", "audit", ...ACCEPTED_EXCEPTIONS.map((e) => `--ignore=${e.id}`)], ROOT);
  console.log(output);
  expect(exitCode).toBe(0);
}, 60_000);

test("every accepted exception is complete, still needed and not past its review date", () => {
  const reported = reportedAdvisoryIds();
  for (const exception of ACCEPTED_EXCEPTIONS) {
    expect(exception.id).toMatch(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
    for (const field of [exception.package, exception.comesFrom, exception.why, exception.accepted.by, exception.accepted.on]) {
      expect(field.trim()).not.toBe("");
    }
    // Stale: the advisory is gone (e.g. after an Expo update), so the entry must be removed.
    expect(reported.has(exception.id), `${exception.id} is no longer reported: remove its exception`).toBe(true);
    expect(today() < exception.reviewBy, `${exception.id} passed its review date ${exception.reviewBy}: review it`).toBe(true);
    if (exception.domainLeadApproval === null) {
      console.log(`Waiting for Domain Lead approval: ${exception.id}`);
    }
  }
}, 60_000);
