import type { Express, Request, Response } from "express";
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

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Track WebSocket connections by location ID
const locationSubscribers = new Map<string, Set<WebSocket>>();

// Track WebSocket connections for fleets
const fleetSubscribers = new Map<string, Set<WebSocket>>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws) => {
    // A socket may subscribe more than once; track every subscription it holds
    // so none of them is stranded in a Set when the socket closes.
    const subscribedLocationIds = new Set<string>();
    const subscribedFleetIds = new Set<string>();
    let sharingLocationId: string | null = null;
    let sharingVehicleId: string | null = null;

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === "subscribe" && message.locationId) {
          // Viewer subscribing to location updates
          const locId: string = message.locationId;
          subscribedLocationIds.add(locId);

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
          // Sharer stopped sharing — the location is no longer live
          await storage.setLocationLiveStatus(sharingLocationId, false);

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

          sharingLocationId = null;
        }

        // Fleet-related messages
        else if (message.type === "subscribeFleet" && message.fleetId) {
          const fleetId: string = message.fleetId;
          subscribedFleetIds.add(fleetId);

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

          sharingVehicleId = null;
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", async () => {
      // Clean up subscriber
      for (const locId of Array.from(subscribedLocationIds)) {
        const subscribers = locationSubscribers.get(locId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            locationSubscribers.delete(locId);
          }
        }
      }

      // Clean up sharer and notify subscribers
      if (sharingLocationId) {
        // A dropped sharer connection ends the live share just like an explicit stop
        await storage.setLocationLiveStatus(sharingLocationId, false);

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

      // Clean up fleet subscribers
      for (const fleetId of Array.from(subscribedFleetIds)) {
        const subscribers = fleetSubscribers.get(fleetId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            fleetSubscribers.delete(fleetId);
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
        log(`Vehicle ${sharingVehicleId} disconnected`, "websocket");
      }
    });
  });

  // Serve Android App Links verification file
  app.get("/.well-known/assetlinks.json", (req: Request, res: Response) => {
    res.json([{
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.sharemylocation.app",
        sha256_cert_fingerprints: [
          "23:7F:3E:DD:0F:28:C0:27:A5:0C:2D:9A:DF:F8:42:52:D8:41:F5:CE:EE:B9:04:FB:83:DF:05:3A:B5:8F:82:BA"
        ]
      }
    }]);
  });

  // Deep Link Web Fallback for /share/:code
  app.get("/share/:code", (req: Request, res: Response) => {
    // The code is attacker-controlled: percent-encode it for the URL it lands in,
    // then escape what remains so it cannot break out of the href attribute.
    const code = escapeHtmlAttribute(encodeURIComponent(req.params.code as string));
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Join Fleet on Orbit</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta property="og:title" content="Join Fleet on Orbit" />
        <meta property="og:description" content="You've been invited to track a fleet's live location. Install Orbit to join." />
        <meta property="og:image" content="https://diplomatic-learning-production-f128.up.railway.app/orbit_icon.png" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0F0F14; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .container { max-width: 400px; padding: 24px; }
          h1 { color: #00B4D8; margin-bottom: 8px; }
          p { color: #888; margin-bottom: 32px; line-height: 1.5; }
          .btn { background-color: #00B4D8; color: #0F0F14; padding: 16px 32px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 18px; display: inline-block; transition: transform 0.2s; }
          .btn:hover { transform: scale(1.05); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Orbit</h1>
          <p>You've been invited to track a fleet's live location. Install Orbit to join.</p>
          <a class="btn" href="https://play.google.com/store/apps/details?id=com.sharemylocation.app&referrer=fleetCode%3D${code}">
            Download Orbit
          </a>
        </div>
      </body>
      </html>
    `);
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
      return res.status(201).json({ ...fleet, vehicles: [] });
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

      const vehicles = await storage.getVehiclesByFleet(id);

      // Don't expose adminCode in public endpoint
      const { adminCode, ...publicFleet } = fleet;
      return res.json({ ...publicFleet, vehicles });
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

      const vehicles = await storage.getVehiclesByFleet(fleet.id);

      return res.json({ ...fleet, vehicles });
    } catch (error) {
      console.error("Error fetching fleet:", error);
      return res.status(500).json({ error: "Failed to fetch fleet" });
    }
  });

  app.delete("/api/fleets/admin/:adminCode", async (req, res) => {
    try {
      const adminCode = req.params.adminCode as string;
      const fleet = await storage.getFleetByAdminCode(adminCode);

      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found or expired" });
      }

      await storage.deleteFleet(fleet.id);

      return res.json({ success: true, message: "Fleet deleted" });
    } catch (error) {
      console.error("Error deleting fleet:", error);
      return res.status(500).json({ error: "Failed to delete fleet" });
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
