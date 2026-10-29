import { describe, expect, test } from "bun:test";

import type { Debts, Trip } from "../../../packages/app/src/dto";
import { filteredGroups, positionOf, splitByPaid } from "../../../packages/app/src/trips/myGroups";

const trip = (id: number, paid = false): Trip => ({ id, name: `Group ${id}`, start_date: null, end_date: null, total_cents: 100, paid });
const ben = { id: 2, name: "Ben" };
const chloe = { id: 3, name: "Chloé" };

// Ana on a fresh seed after "Coffee club" (group 9): she owes on 7 and 1, and is owed on 9.
const debts: Debts = {
  owe_cents: 7290,
  owed_cents: 500,
  groups: [
    { trip_id: 7, owe_cents: 915, owed_cents: 0, transfers: [{ direction: "pay", person: chloe, amount_cents: 915 }] },
    { trip_id: 1, owe_cents: 6375, owed_cents: 0, transfers: [{ direction: "pay", person: ben, amount_cents: 6375 }] },
    { trip_id: 9, owe_cents: 0, owed_cents: 500, transfers: [{ direction: "receive", person: ben, amount_cents: 500 }] },
  ],
};

describe("splitByPaid", () => {
  test("keeps the order of GET /trips in both parts", () => {
    const { open, paid } = splitByPaid([trip(7, true), trip(1), trip(3, true), trip(9)]);
    expect(open.map((t) => t.id)).toEqual([1, 9]);
    expect(paid.map((t) => t.id)).toEqual([7, 3]);
  });
});

describe("positionOf", () => {
  test("owe or owed with the API's amount; a group without an entry is settled", () => {
    expect(positionOf(trip(1), debts)).toEqual({ kind: "owe", cents: 6375 });
    expect(positionOf(trip(9), debts)).toEqual({ kind: "owed", cents: 500 });
    expect(positionOf(trip(3), debts)).toEqual({ kind: "settled" });
  });
});

describe("filteredGroups", () => {
  const trips = [trip(7), trip(1), trip(3), trip(9)];

  test("I owe: the groups with a payment of mine, in list order, with those transfers", () => {
    expect(filteredGroups(trips, debts, "owe").map(({ trip, transfers }) => [trip.id, transfers.map((t) => t.person.name)])).toEqual([
      [7, ["Chloé"]],
      [1, ["Ben"]],
    ]);
  });

  test("I'm owed: only the groups where someone pays me; nothing when nobody does", () => {
    expect(filteredGroups(trips, debts, "owed").map(({ trip }) => trip.id)).toEqual([9]);
    expect(filteredGroups(trips, { owe_cents: 0, owed_cents: 0, groups: [] }, "owed")).toEqual([]);
  });
});
