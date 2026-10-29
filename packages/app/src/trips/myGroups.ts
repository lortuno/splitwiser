import type { Debts, DebtTransfer, Trip } from "../dto";

/** The two filters on "My groups": groups where I owe money, or where I am owed money. */
export type DebtFilter = "owe" | "owed";

/** My position on an open group's card: an amount from the API, or settled. */
export type Position = { kind: "owe" | "owed"; cents: number } | { kind: "settled" };

/** Open groups and paid groups, each in the order of GET /trips. */
export function splitByPaid(trips: Trip[]): { open: Trip[]; paid: Trip[] } {
  return { open: trips.filter((trip) => !trip.paid), paid: trips.filter((trip) => trip.paid) };
}

/** The card's position line; an open group without an entry in GET /me/debts is settled. */
export function positionOf(trip: Trip, debts: Debts): Position {
  const group = debts.groups.find((entry) => entry.trip_id === trip.id);
  if (group === undefined) {
    return { kind: "settled" };
  }
  return group.owe_cents > 0 ? { kind: "owe", cents: group.owe_cents } : { kind: "owed", cents: group.owed_cents };
}

/** The filtered view: groups with a transfer in that direction, in the order of GET /trips, with those transfers. */
export function filteredGroups(trips: Trip[], debts: Debts, filter: DebtFilter): { trip: Trip; transfers: DebtTransfer[] }[] {
  const direction = filter === "owe" ? "pay" : "receive";
  return trips.flatMap((trip) => {
    const transfers = debts.groups.find((entry) => entry.trip_id === trip.id)?.transfers.filter((t) => t.direction === direction) ?? [];
    return transfers.length === 0 ? [] : [{ trip, transfers }];
  });
}
