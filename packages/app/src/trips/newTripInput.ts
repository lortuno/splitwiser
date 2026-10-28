import type { NewTrip } from "../dto";

/** What the "New trip" form holds while it is being filled in. The creator is not part of it. */
export interface NewTripForm {
  name: string;
  startDate: string;
  endDate: string;
  people: { name: string; email: string }[];
}

/**
 * The POST /trips body for the form: text trimmed, an empty email sent as null, people in form order.
 * Validation (required fields, dates, duplicates) is left to the API.
 */
export function newTripBody(form: NewTripForm): NewTrip {
  return {
    name: form.name.trim(),
    start_date: form.startDate.trim(),
    end_date: form.endDate.trim(),
    people: form.people.map((person) => {
      const email = person.email.trim();
      return { name: person.name.trim(), email: email === "" ? null : email };
    }),
  };
}

/** Today's date on this device as YYYY-MM-DD (local time, not UTC). */
export function todayIso(now: Date = new Date()): string {
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
}
