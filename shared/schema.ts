import { z } from "zod";

export const locationSchema = z.object({
  id: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
  isLive: z.boolean().optional(),
  lastUpdated: z.string().optional(),
});

export const insertLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  isLive: z.boolean().optional(),
  expiresInMinutes: z.number().min(1).max(1440).optional(), // 1 min to 24 hours
});

export const EXPIRY_OPTIONS = [
  { label: "15 minutes", value: 15 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "12 hours", value: 720 },
  { label: "18 hours", value: 1080 },
  { label: "24 hours", value: 1440 },
] as const;

export const locationUpdateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export type Location = z.infer<typeof locationSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;

// Fleet schemas for tracking multiple vehicles
export const vehicleSchema = z.object({
  id: z.string(),
  fleetId: z.string(),
  name: z.string(),
  color: z.string(),
  shareCode: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  isLive: z.boolean(),
  lastUpdated: z.string().optional(),
});

export const fleetSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  adminCode: z.string(),
});

export const insertFleetSchema = z.object({
  name: z.string().min(1, "Fleet name is required"),
});

export const insertVehicleSchema = z.object({
  fleetId: z.string(),
  name: z.string().min(1, "Vehicle name is required"),
  color: z.string().optional(),
});

export const vehicleUpdateSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

export type Vehicle = z.infer<typeof vehicleSchema>;
export type Fleet = z.infer<typeof fleetSchema>;
export type InsertFleet = z.infer<typeof insertFleetSchema>;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type VehicleUpdate = z.infer<typeof vehicleUpdateSchema>;
