import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertLocationSchema, 
  locationUpdateSchema,
  insertFleetSchema,
  insertVehicleSchema,
  vehicleUpdateSchema
} from "@shared/schema";
import { log } from "./index";

// Track WebSocket connections by location ID
const locationSubscribers = new Map<string, Set<WebSocket>>();
const sharerConnections = new Map<string, WebSocket>();

// Track WebSocket connections for fleets
const fleetSubscribers = new Map<string, Set<WebSocket>>();
const vehicleSharerConnections = new Map<string, WebSocket>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    let subscribedLocationId: string | null = null;
    let sharingLocationId: string | null = null;
    let subscribedFleetId: string | null = null;
    let sharingVehicleId: string | null = null;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "subscribe" && message.locationId) {
          // Viewer subscribing to location updates
          const locId: string = message.locationId;
          subscribedLocationId = locId;
          
          if (!locationSubscribers.has(locId)) {
            locationSubscribers.set(locId, new Set());
          }
          locationSubscribers.get(locId)!.add(ws);
          
          log(`Viewer subscribed to location ${locId}`, "websocket");
          
          // Send current location immediately
          const location = await storage.getLocation(locId);
          if (location) {
            ws.send(JSON.stringify({ type: "location", data: location }));
          }
        } else if (message.type === "share" && message.locationId) {
          // Sharer starting to broadcast
          const locId: string = message.locationId;
          sharingLocationId = locId;
          sharerConnections.set(locId, ws);
          log(`Sharer started broadcasting location ${locId}`, "websocket");
        } else if (message.type === "update" && sharingLocationId) {
          // Sharer sending location update
          const parsed = locationUpdateSchema.safeParse(message.data);
          if (!parsed.success) return;

          const updated = await storage.updateLocation(sharingLocationId, parsed.data);
          if (!updated) return;

          // Broadcast to all subscribers
          const subscribers = locationSubscribers.get(sharingLocationId);
          if (subscribers) {
            const updateMessage = JSON.stringify({ type: "location", data: updated });
            subscribers.forEach((subscriber) => {
              if (subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(updateMessage);
              }
            });
          }
        } else if (message.type === "stop" && sharingLocationId) {
          // Sharer stopped sharing
          const location = await storage.getLocation(sharingLocationId);
          if (location) {
            await storage.updateLocation(sharingLocationId, {
              latitude: location.latitude,
              longitude: location.longitude,
            });
          }
          
          // Notify subscribers
          const subscribers = locationSubscribers.get(sharingLocationId);
          if (subscribers) {
            const stopMessage = JSON.stringify({ type: "stopped" });
            subscribers.forEach((subscriber) => {
              if (subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(stopMessage);
              }
            });
          }
          
          sharerConnections.delete(sharingLocationId);
          sharingLocationId = null;
        }
        
        // Fleet-related messages
        else if (message.type === "subscribeFleet" && message.fleetId) {
          const fleetId: string = message.fleetId;
          subscribedFleetId = fleetId;
          
          if (!fleetSubscribers.has(fleetId)) {
            fleetSubscribers.set(fleetId, new Set());
          }
          fleetSubscribers.get(fleetId)!.add(ws);
          
          log(`Viewer subscribed to fleet ${fleetId}`, "websocket");
          
          // Send current vehicles immediately
          const vehicles = await storage.getVehiclesByFleet(fleetId);
          ws.send(JSON.stringify({ type: "vehicles", data: vehicles }));
        } else if (message.type === "shareVehicle" && message.vehicleId) {
          // Vehicle driver starting to broadcast
          const vehicleId: string = message.vehicleId;
          sharingVehicleId = vehicleId;
          vehicleSharerConnections.set(vehicleId, ws);
          
          // Mark vehicle as live
          await storage.updateVehicleLiveStatus(vehicleId, true);
          
          log(`Vehicle ${vehicleId} started sharing`, "websocket");
        } else if (message.type === "updateVehicle" && sharingVehicleId) {
          // Vehicle sending location update
          const parsed = vehicleUpdateSchema.safeParse(message.data);
          if (!parsed.success) return;

          const updated = await storage.updateVehicle(sharingVehicleId, parsed.data);
          if (!updated) return;

          // Broadcast to all fleet subscribers
          const fleetId = updated.fleetId;
          const subscribers = fleetSubscribers.get(fleetId);
          if (subscribers) {
            const updateMessage = JSON.stringify({ type: "vehicleUpdate", data: updated });
            subscribers.forEach((subscriber) => {
              if (subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(updateMessage);
              }
            });
          }
        } else if (message.type === "stopVehicle" && sharingVehicleId) {
          // Vehicle stopped sharing
          const vehicle = await storage.getVehicle(sharingVehicleId);
          if (vehicle) {
            await storage.updateVehicleLiveStatus(sharingVehicleId, false);
            
            // Notify fleet subscribers
            const subscribers = fleetSubscribers.get(vehicle.fleetId);
            if (subscribers) {
              const stopMessage = JSON.stringify({ type: "vehicleStopped", data: { vehicleId: sharingVehicleId } });
              subscribers.forEach((subscriber) => {
                if (subscriber.readyState === WebSocket.OPEN) {
                  subscriber.send(stopMessage);
                }
              });
            }
          }
          
          vehicleSharerConnections.delete(sharingVehicleId);
          sharingVehicleId = null;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", async () => {
      // Clean up subscriber
      if (subscribedLocationId) {
        const subscribers = locationSubscribers.get(subscribedLocationId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            locationSubscribers.delete(subscribedLocationId);
          }
        }
      }
      
      // Clean up sharer and notify subscribers
      if (sharingLocationId) {
        sharerConnections.delete(sharingLocationId);
        const subscribers = locationSubscribers.get(sharingLocationId);
        if (subscribers) {
          const stopMessage = JSON.stringify({ type: "stopped" });
          subscribers.forEach((subscriber) => {
            if (subscriber.readyState === WebSocket.OPEN) {
              subscriber.send(stopMessage);
            }
          });
        }
        log(`Sharer disconnected from location ${sharingLocationId}`, "websocket");
      }
      
      // Clean up fleet subscriber
      if (subscribedFleetId) {
        const subscribers = fleetSubscribers.get(subscribedFleetId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            fleetSubscribers.delete(subscribedFleetId);
          }
        }
      }
      
      // Clean up vehicle sharer
      if (sharingVehicleId) {
        const vehicle = await storage.getVehicle(sharingVehicleId);
        if (vehicle) {
          await storage.updateVehicleLiveStatus(sharingVehicleId, false);
          
          // Notify fleet subscribers
          const subscribers = fleetSubscribers.get(vehicle.fleetId);
          if (subscribers) {
            const stopMessage = JSON.stringify({ type: "vehicleStopped", data: { vehicleId: sharingVehicleId } });
            subscribers.forEach((subscriber) => {
              if (subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(stopMessage);
              }
            });
          }
        }
        vehicleSharerConnections.delete(sharingVehicleId);
        log(`Vehicle ${sharingVehicleId} disconnected`, "websocket");
      }
    });
  });

  // Create a new shared location
  app.post("/api/locations", async (req, res) => {
    try {
      const parsed = insertLocationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid location data" });
      }

      const location = await storage.createLocation(parsed.data);
      return res.status(201).json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      return res.status(500).json({ error: "Failed to create location" });
    }
  });

  // Get a shared location by ID
  app.get("/api/locations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const location = await storage.getLocation(id);

      if (!location) {
        return res.status(404).json({ error: "Location not found or expired" });
      }

      return res.json(location);
    } catch (error) {
      console.error("Error fetching location:", error);
      return res.status(500).json({ error: "Failed to fetch location" });
    }
  });

  // Delete a shared location
  app.delete("/api/locations/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteLocation(id);

      if (!deleted) {
        return res.status(404).json({ error: "Location not found" });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting location:", error);
      return res.status(500).json({ error: "Failed to delete location" });
    }
  });

  // Fleet routes
  app.post("/api/fleets", async (req, res) => {
    try {
      const parsed = insertFleetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid fleet data" });
      }

      const fleet = await storage.createFleet(parsed.data);
      return res.status(201).json(fleet);
    } catch (error) {
      console.error("Error creating fleet:", error);
      return res.status(500).json({ error: "Failed to create fleet" });
    }
  });

  app.get("/api/fleets/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const fleet = await storage.getFleet(id);

      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found or expired" });
      }

      // Don't expose adminCode in public endpoint
      const { adminCode, ...publicFleet } = fleet;
      return res.json(publicFleet);
    } catch (error) {
      console.error("Error fetching fleet:", error);
      return res.status(500).json({ error: "Failed to fetch fleet" });
    }
  });

  app.get("/api/fleets/admin/:adminCode", async (req, res) => {
    try {
      const { adminCode } = req.params;
      const fleet = await storage.getFleetByAdminCode(adminCode);

      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found or expired" });
      }

      return res.json(fleet);
    } catch (error) {
      console.error("Error fetching fleet:", error);
      return res.status(500).json({ error: "Failed to fetch fleet" });
    }
  });

  // Vehicle routes
  app.post("/api/vehicles", async (req, res) => {
    try {
      const parsed = insertVehicleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid vehicle data" });
      }

      // Verify fleet exists
      const fleet = await storage.getFleet(parsed.data.fleetId);
      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }

      const vehicle = await storage.createVehicle(parsed.data);
      return res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      return res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.get("/api/fleets/:fleetId/vehicles", async (req, res) => {
    try {
      const { fleetId } = req.params;
      const fleet = await storage.getFleet(fleetId);

      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found or expired" });
      }

      const vehicles = await storage.getVehiclesByFleet(fleetId);
      return res.json(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      return res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const vehicle = await storage.getVehicle(id);

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      return res.json(vehicle);
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      return res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  app.delete("/api/vehicles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteVehicle(id);

      if (!deleted) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      return res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // Get vehicle by share code (for driver page)
  app.get("/api/vehicles/share/:shareCode", async (req, res) => {
    try {
      const { shareCode } = req.params;
      const vehicle = await storage.getVehicleByShareCode(shareCode);

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      // Also get fleet info for context
      const fleet = await storage.getFleet(vehicle.fleetId);
      if (!fleet) {
        return res.status(404).json({ error: "Fleet expired" });
      }

      return res.json({ vehicle, fleetName: fleet.name, fleetId: fleet.id });
    } catch (error) {
      console.error("Error fetching vehicle by share code:", error);
      return res.status(500).json({ error: "Failed to fetch vehicle" });
    }
  });

  return httpServer;
}
