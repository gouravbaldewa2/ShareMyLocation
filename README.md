# ShareMyLocation

Share your real-time location with anyone through a simple, shareable link. No app installation required — works entirely in the browser.

## Features

### Individual Location Sharing
- **Static Snapshot**: Share your current location as a one-time pin on a map
- **Live Tracking**: Share your real-time location that updates as you move
- **Customizable Expiry**: Links expire after 15 minutes to 24 hours (your choice)
- **Shareable Links**: Send via WhatsApp, SMS, or any messenger

### Fleet Tracking
Track multiple vehicles on a single shared map — perfect for resort buggies, golf carts, or delivery vehicles.

- **Create Fleets**: Group vehicles under a single fleet with a shared guest view
- **Driver Links**: Each driver gets a unique link to broadcast their vehicle's location
- **Guest Map**: One link shows all active vehicles on a live map
- **Admin Dashboard**: Manage vehicles, copy driver links, and monitor status
- **My Fleets Dashboard**: Manage all your fleets from one central page

### How Fleet Tracking Works
1. **Create a fleet** — give it a name like "Resort Buggies"
2. **Add vehicles** — add each buggy with a unique name
3. **Send driver links** — each driver opens their link and taps "Start Sharing"
4. **Share the guest link** — guests see all active vehicles on one map

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express.js, TypeScript
- **Maps**: Leaflet.js with OpenStreetMap tiles (free, no API key needed)
- **Real-time**: WebSocket for live location updates
- **Routing**: Wouter (client-side), Express (server-side)
- **State Management**: TanStack React Query

## Getting Started

### Prerequisites
- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/gouravbaldewa2/ShareMyLocation.git
cd ShareMyLocation
npm install
```

### Running Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

## Project Structure

```
├── client/              # React frontend
│   └── src/
│       ├── components/  # UI components (MapView, FleetMapView, etc.)
│       ├── hooks/       # Custom hooks (WebSocket, theme, time-ago)
│       ├── lib/         # Utilities (API client, localStorage helpers)
│       └── pages/       # Route pages
├── server/              # Express backend
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # In-memory data storage
│   └── websocket.ts     # WebSocket server
├── shared/              # Shared types and schemas
│   └── schema.ts        # Zod schemas for validation
└── migrations/          # Database migrations (future use)
```

## Key Routes

| Route | Description |
|-------|-------------|
| `/` | Home — share your individual location |
| `/view/:id` | View a shared location |
| `/fleet` | Create a new fleet |
| `/fleets` | My Fleets dashboard |
| `/fleet/admin/:adminCode` | Fleet admin panel |
| `/fleet/:id` | Guest fleet map view |
| `/vehicle/share/:shareCode` | Driver sharing page |

## License

MIT
