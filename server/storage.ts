import { 
  type Location, type InsertLocation, type LocationUpdate,
  type Fleet, type InsertFleet, type Vehicle, type InsertVehicle, type VehicleUpdate
} from "@shared/schema";
import { nanoid } from "nanoid";

const VEHICLE_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

export interface IStorage {
  getLocation(id: string): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: string, update: LocationUpdate): Promise<Location | undefined>;
  deleteLocation(id: string): Promise<boolean>;
  
  // Fleet methods
  getFleet(id: string): Promise<Fleet | undefined>;
  getFleetByAdminCode(adminCode: string): Promise<Fleet | undefined>;
  createFleet(fleet: InsertFleet): Promise<Fleet>;
  
  // Vehicle methods
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehicleByShareCode(shareCode: string): Promise<Vehicle | undefined>;
  getVehiclesByFleet(fleetId: string): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, update: VehicleUpdate): Promise<Vehicle | undefined>;
  updateVehicleLiveStatus(id: string, isLive: boolean): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private locations: Map<string, Location>;
  private fleets: Map<string, Fleet>;
  private vehicles: Map<string, Vehicle>;

  constructor() {
    this.locations = new Map();
    this.fleets = new Map();
    this.vehicles = new Map();
  }

  async getLocation(id: string): Promise<Location | undefined> {
    const location = this.locations.get(id);
    if (!location) return undefined;

    if (location.expiresAt) {
      const expiresAt = new Date(location.expiresAt);
      if (expiresAt < new Date()) {
        this.locations.delete(id);
        return undefined;
      }
    }

    return location;
  }

  async createLocation(insertLocation: InsertLocation): Promise<Location> {
    const id = nanoid(10);
    const now = new Date();
    const expiryMinutes = insertLocation.expiresInMinutes || 1440; // Default 24 hours
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);

    const location: Location = {
      id,
      latitude: insertLocation.latitude,
      longitude: insertLocation.longitude,
      name: insertLocation.name,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isLive: insertLocation.isLive || false,
      lastUpdated: now.toISOString(),
    };

    this.locations.set(id, location);
    return location;
  }

  async updateLocation(id: string, update: LocationUpdate): Promise<Location | undefined> {
    const location = await this.getLocation(id);
    if (!location) return undefined;

    const updatedLocation: Location = {
      ...location,
      latitude: update.latitude,
      longitude: update.longitude,
      lastUpdated: new Date().toISOString(),
    };

    this.locations.set(id, updatedLocation);
    return updatedLocation;
  }

  async deleteLocation(id: string): Promise<boolean> {
    return this.locations.delete(id);
  }

  // Fleet methods
  async getFleet(id: string): Promise<Fleet | undefined> {
    const fleet = this.fleets.get(id);
    if (!fleet) return undefined;

    const expiresAt = new Date(fleet.expiresAt);
    if (expiresAt < new Date()) {
      this.fleets.delete(id);
      // Also delete associated vehicles
      const vehicleEntries = Array.from(this.vehicles.entries());
      for (const [vehicleId, vehicle] of vehicleEntries) {
        if (vehicle.fleetId === id) {
          this.vehicles.delete(vehicleId);
        }
      }
      return undefined;
    }

    return fleet;
  }

  async getFleetByAdminCode(adminCode: string): Promise<Fleet | undefined> {
    const fleets = Array.from(this.fleets.values());
    for (const fleet of fleets) {
      if (fleet.adminCode === adminCode) {
        const expiresAt = new Date(fleet.expiresAt);
        if (expiresAt >= new Date()) {
          return fleet;
        }
      }
    }
    return undefined;
  }

  async createFleet(insertFleet: InsertFleet): Promise<Fleet> {
    const id = nanoid(8);
    const adminCode = nanoid(12);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const fleet: Fleet = {
      id,
      name: insertFleet.name,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      adminCode,
    };

    this.fleets.set(id, fleet);
    return fleet;
  }

  // Vehicle methods
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async getVehicleByShareCode(shareCode: string): Promise<Vehicle | undefined> {
    const vehicles = Array.from(this.vehicles.values());
    return vehicles.find(v => v.shareCode === shareCode);
  }

  async getVehiclesByFleet(fleetId: string): Promise<Vehicle[]> {
    const fleet = await this.getFleet(fleetId);
    if (!fleet) return [];

    const vehicles: Vehicle[] = [];
    const allVehicles = Array.from(this.vehicles.values());
    for (const vehicle of allVehicles) {
      if (vehicle.fleetId === fleetId) {
        vehicles.push(vehicle);
      }
    }
    return vehicles;
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const id = nanoid(10);
    const shareCode = nanoid(12);
    
    // Get existing vehicles to determine color
    const existingVehicles = await this.getVehiclesByFleet(insertVehicle.fleetId);
    const colorIndex = existingVehicles.length % VEHICLE_COLORS.length;
    
    const vehicle: Vehicle = {
      id,
      fleetId: insertVehicle.fleetId,
      name: insertVehicle.name,
      color: insertVehicle.color || VEHICLE_COLORS[colorIndex],
      shareCode,
      isLive: false,
    };

    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: string, update: VehicleUpdate): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return undefined;

    const updatedVehicle: Vehicle = {
      ...vehicle,
      latitude: update.latitude,
      longitude: update.longitude,
      lastUpdated: new Date().toISOString(),
    };

    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }

  async updateVehicleLiveStatus(id: string, isLive: boolean): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return undefined;

    const updatedVehicle: Vehicle = {
      ...vehicle,
      isLive,
      lastUpdated: new Date().toISOString(),
    };

    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    return this.vehicles.delete(id);
  }
}

export const storage = new MemStorage();
