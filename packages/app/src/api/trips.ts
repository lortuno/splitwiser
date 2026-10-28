import type { CreatedTrip, NewTrip, Trip, TripSummary } from "../dto";
import { request } from "./client";

export const listTrips = () => request<Trip[]>("/trips");

export const createTrip = (input: NewTrip) => request<CreatedTrip>("/trips", { method: "POST", body: input });

export const getTrip = (tripId: number) => request<Trip>(`/trips/${tripId}`);

export const getSummary = (tripId: number) => request<TripSummary>(`/trips/${tripId}/summary`);
