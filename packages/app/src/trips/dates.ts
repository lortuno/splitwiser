import type { Trip } from "../dto";
import { formatDate } from "../i18n";

/** "1 Jun 2026 – 7 Jun 2026", or null for a group without dates (it then has no date line). */
export function dateRange(trip: Pick<Trip, "start_date" | "end_date">): string | null {
  return trip.start_date === null || trip.end_date === null
    ? null
    : `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`;
}

/**
 * The date a new expense starts with: today when it falls inside the group's dates, otherwise the nearest day of the
 * group (ISO dates compare as strings); today for a group without dates.
 */
export function newExpenseDate(today: string, trip: Pick<Trip, "start_date" | "end_date">): string {
  if (trip.start_date === null || trip.end_date === null) {
    return today;
  }
  return today < trip.start_date ? trip.start_date : today > trip.end_date ? trip.end_date : today;
}
