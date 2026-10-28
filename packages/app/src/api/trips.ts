import type { CreatedTrip, NewTrip, Trip, TripSummary } from "../dto";
import { request } from "./client";

export const listTrips = () => request<Trip[]>("/trips");

export const createTrip = (input: NewTrip) => request<CreatedTrip>("/trips", { method: "POST", body: input });

export const getTrip = (tripId: number) => request<Trip>(`/trips/${tripId}`);

export const getSummary = (tripId: number) => request<TripSummary>(`/trips/${tripId}/summary`);

/** Marks the trip as paid: it then takes no new or edited expenses until someone reopens it. */
export const markPaid = (tripId: number) => request<{ summary: TripSummary }>(`/trips/${tripId}/paid`, { method: "POST" });

export const reopenTrip = (tripId: number) => request<{ summary: TripSummary }>(`/trips/${tripId}/reopen`, { method: "POST" });
