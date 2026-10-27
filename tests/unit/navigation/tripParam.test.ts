import { describe, expect, test } from "bun:test";

import { parseTripParam } from "../../../packages/app/src/navigation/tripParam";

describe("parseTripParam", () => {
  test("no trip parameter opens the default trip", () => {
    expect(parseTripParam("")).toEqual({ kind: "default" });
    expect(parseTripParam("?other=1")).toEqual({ kind: "default" });
  });

  test.each([
    ["?trip=4", 4],
    ["?trip=999", 999],
    ["?x=1&trip=12", 12],
  ])("%p opens trip %p", (search, id) => {
    expect(parseTripParam(search)).toEqual({ kind: "id", id });
  });

  test.each(["?trip=0", "?trip=-1", "?trip=abc", "?trip=1.5", "?trip=", "?trip=04", "?trip=1e3", "?trip=9999999999999999"])(
    "%p is not a trip id",
    (search) => {
      expect(parseTripParam(search)).toEqual({ kind: "invalid" });
    },
  );
});
