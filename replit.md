# ShareMyLocation

## Overview

ShareMyLocation is a web application that allows users to share their real-time location with others through a simple, shareable link. The app uses browser geolocation to capture coordinates, stores them temporarily on the server, and generates unique links that recipients can use to view the shared location on an interactive map. Links expire after 24 hours for privacy.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management and data fetching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Map Integration**: Leaflet.js for interactive map display with OpenStreetMap tiles

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **API Design**: RESTful endpoints under `/api` prefix
- **Build**: esbuild for server bundling, Vite for client bundling

### Data Storage
- **Current Implementation**: In-memory storage using a Map data structure (`MemStorage` class)
- **Schema Definition**: Drizzle ORM with Zod for validation (PostgreSQL configured but not actively used)
- **Data Model**: Locations with id, latitude, longitude, optional name, createdAt, expiresAt, isLive, and lastUpdated timestamps
- **Expiration**: Locations automatically expire after 24 hours
- **Live Updates**: WebSocket server enables real-time location broadcasting

### WebSocket Architecture
- **Protocol**: WebSocket server at `/ws` endpoint for real-time bidirectional communication
- **Message Types**: subscribe, share, update, stop, location, stopped
- **Live Sharing Flow**: Sharer connects → sends "share" message → broadcasts updates via "update" messages
- **Viewing Flow**: Viewer connects → sends "subscribe" message → receives "location" updates

### Key Design Patterns
- **Shared Types**: Common schema definitions in `/shared` directory used by both client and server
- **Storage Interface**: `IStorage` interface allows swapping storage implementations
- **API Client**: Centralized `apiRequest` function for consistent API calls with error handling
- **WebSocket Hooks**: Custom React hooks (useLocationSharer, useLocationViewer) for WebSocket management

### Project Structure
```
├── client/          # React frontend application
│   └── src/
│       ├── components/  # UI components including shadcn/ui
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # Utility functions and API client
│       └── pages/       # Route components
├── server/          # Express backend
├── shared/          # Shared types and schemas
└── migrations/      # Database migrations (for future PostgreSQL use)
```

## External Dependencies

### Frontend Services
- **OpenStreetMap**: Map tile provider via Leaflet.js (no API key required)
- **Google Maps**: External links for navigation (opens in new tab)

### Database
- **PostgreSQL**: Configured via `DATABASE_URL` environment variable using Drizzle ORM
- **Drizzle Kit**: Database migration tooling with `db:push` command

### Third-Party Libraries
- **Radix UI**: Headless UI primitives for accessible components
- **Leaflet**: Interactive mapping library
- **nanoid**: Unique ID generation for location share links
- **Zod**: Runtime schema validation for API requests

## Fleet Tracking Feature

### Overview
The app now supports tracking multiple vehicles (like resort buggies) on a single shared map.

### Fleet Data Model
- **Fleet**: id, name, createdAt, expiresAt, adminCode (for management)
- **Vehicle**: id, fleetId, name, color (auto-assigned), shareCode (unique per vehicle), latitude, longitude, isLive, lastUpdated

### Fleet Routes
- `/fleet` - Create a new fleet
- `/fleets` - My Fleets dashboard (view/manage all saved fleets)
- `/fleet/admin/:adminCode` - Fleet management dashboard (add vehicles, copy driver links)
- `/fleet/:id` - Guest view showing all vehicles on one map
- `/vehicle/share/:shareCode` - Driver's page to control their vehicle's location sharing

### My Fleets Dashboard
- Fleet admin codes are saved to localStorage (`sharemylocation_fleets` key)
- Auto-saved when creating a fleet (from both CreateFleet and MyFleets pages)
- Users can add existing fleets by pasting their admin code
- Fleets can be removed from the dashboard (doesn't delete the fleet itself)
- Expired fleets are automatically cleaned up from localStorage
- localStorage utility: `client/src/lib/savedFleets.ts`

### Fleet Workflow
1. Admin creates a fleet and adds vehicles
2. Admin copies each vehicle's unique "Driver Link" and sends to the respective driver
3. Drivers open their link and tap "Start Sharing" to broadcast their location
4. Guests view all active vehicles on the shared fleet map

### Fleet API Endpoints
- `POST /api/fleets` - Create fleet
- `GET /api/fleets/:id` - Get public fleet info
- `GET /api/fleets/admin/:adminCode` - Get fleet by admin code
- `POST /api/vehicles` - Add vehicle to fleet
- `GET /api/vehicles/share/:shareCode` - Get vehicle by shareCode (for driver page)
- `GET /api/fleets/:fleetId/vehicles` - Get all vehicles in fleet
- `DELETE /api/vehicles/:id` - Remove vehicle

### Fleet WebSocket Messages
- `subscribeFleet` - Subscribe to all vehicle updates in a fleet
- `shareVehicle` - Start broadcasting vehicle location
- `updateVehicle` - Send vehicle location update
- `stopVehicle` - Stop broadcasting
- `vehicles` - Initial list of all vehicles
- `vehicleUpdate` - Real-time vehicle position update
- `vehicleStopped` - Vehicle stopped sharing