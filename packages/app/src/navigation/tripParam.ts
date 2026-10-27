// Which trip to open: `?trip={id}` on the web. Native apps have no URL and always open the default trip.

export type TripParam = { kind: "default" } | { kind: "id"; id: number } | { kind: "invalid" };

/** Reads `trip` from a query string such as "?trip=4". Only positive whole numbers are trip ids. */
export function parseTripParam(search: string): TripParam {
  const value = new URLSearchParams(search).get("trip");
  if (value === null) {
    return { kind: "default" };
  }
  return /^[1-9]\d{0,14}$/.test(value) ? { kind: "id", id: Number(value) } : { kind: "invalid" };
}
