import type { Trip, TripSummary } from "../dto";
import { request } from "./client";

export const listTrips = () => request<Trip[]>("/trips");

export const getTrip = (tripId: number) => request<Trip>(`/trips/${tripId}`);

export const getSummary = (tripId: number) => request<TripSummary>(`/trips/${tripId}/summary`);
