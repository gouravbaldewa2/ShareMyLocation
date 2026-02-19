import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Vehicle } from "@shared/schema";

interface FleetMapViewProps {
  vehicles: Vehicle[];
  interactive?: boolean;
}

function createVehicleIcon(color: string, name: string, isLive: boolean) {
  const opacity = isLive ? 1 : 0.5;
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        position: relative;
        width: 44px;
        height: 44px;
        opacity: ${opacity};
      ">
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, ${color} 0%, ${adjustColor(color, -20)} 100%);
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 12px;
            height: 12px;
            background: white;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
        <div style="
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          background: ${color};
          color: white;
          font-size: 10px;
          font-weight: bold;
          padding: 1px 6px;
          border-radius: 8px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
        ">${name}</div>
      </div>
    `,
    iconSize: [44, 52],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  });
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function FleetMapView({ vehicles, interactive = true }: FleetMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const hasFittedBoundsRef = useRef(false);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: interactive,
        dragging: interactive,
        touchZoom: interactive,
        doubleClickZoom: interactive,
        scrollWheelZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
      }).setView([20, 0], 2);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapInstanceRef.current);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current.clear();
        hasFittedBoundsRef.current = false;
      }
    };
  }, [interactive]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentMarkers = markersRef.current;
    const vehicleIds = new Set(vehicles.map(v => v.id));

    currentMarkers.forEach((marker, id) => {
      if (!vehicleIds.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    });

    const bounds: L.LatLngBounds = L.latLngBounds([]);
    let hasValidLocations = false;

    vehicles.forEach((vehicle) => {
      if (vehicle.latitude != null && vehicle.longitude != null) {
        hasValidLocations = true;
        const latLng: L.LatLngTuple = [vehicle.latitude, vehicle.longitude];
        bounds.extend(latLng);

        const existingMarker = currentMarkers.get(vehicle.id);
        
        if (existingMarker) {
          existingMarker.setLatLng(latLng);
          existingMarker.setIcon(createVehicleIcon(vehicle.color, vehicle.name, vehicle.isLive));
          existingMarker.getPopup()?.setContent(createPopupContent(vehicle));
        } else {
          const marker = L.marker(latLng, {
            icon: createVehicleIcon(vehicle.color, vehicle.name, vehicle.isLive),
          }).addTo(map);
          
          marker.bindPopup(createPopupContent(vehicle));
          currentMarkers.set(vehicle.id, marker);
        }
      }
    });

    if (hasValidLocations && bounds.isValid() && !hasFittedBoundsRef.current) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const isSinglePoint = ne.lat === sw.lat && ne.lng === sw.lng;

      if (isSinglePoint) {
        map.setView(ne, 15);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
      hasFittedBoundsRef.current = true;
    }
  }, [vehicles]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    if (mapRef.current) {
      resizeObserver.observe(mapRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-full"
      style={{ minHeight: "300px" }}
      data-testid="fleet-map-view"
    />
  );
}

function createPopupContent(vehicle: Vehicle): string {
  const lastUpdated = vehicle.lastUpdated 
    ? new Date(vehicle.lastUpdated).toLocaleTimeString()
    : "Not yet shared";
  
  const liveStatus = vehicle.isLive 
    ? '<span style="color: #22c55e; font-weight: bold;">Live</span>'
    : '<span style="color: #6b7280;">Offline</span>';
  
  return `
    <div style="min-width: 120px;">
      <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${vehicle.name}</div>
      <div style="font-size: 12px; color: #666;">Status: ${liveStatus}</div>
      <div style="font-size: 11px; color: #888;">Updated: ${lastUpdated}</div>
    </div>
  `;
}
