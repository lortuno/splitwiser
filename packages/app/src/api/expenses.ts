import type { CategorySuggestion, Expense, NewExpense, SplitShare, TripSummary } from "../dto";
import { request } from "./client";

export const listExpenses = (tripId: number) => request<Expense[]>(`/trips/${tripId}/expenses`);

/** Saves the expense; the response carries the updated trip summary. */
export const createExpense = (tripId: number, expense: NewExpense) =>
  request<{ expense: Expense; summary: TripSummary }>(`/trips/${tripId}/expenses`, { method: "POST", body: expense });

/** Saves changes to an expense; the response carries the updated trip summary. The recorder never changes. */
export const updateExpense = (tripId: number, expenseId: number, expense: NewExpense) =>
  request<{ expense: Expense; summary: TripSummary }>(`/trips/${tripId}/expenses/${expenseId}`, { method: "PUT", body: expense });

/** Asks the API to calculate the split without saving anything. */
export const previewSplit = (tripId: number, expense: NewExpense) =>
  request<{ split_between: SplitShare[] }>(`/trips/${tripId}/expenses?dry_run=1`, { method: "POST", body: expense });

/** The category the API suggests for a name: learned from the trip's own expenses first, then from keywords. */
export const suggestCategory = (tripId: number, name: string) =>
  request<CategorySuggestion>(`/trips/${tripId}/category-suggestion?name=${encodeURIComponent(name)}`);
