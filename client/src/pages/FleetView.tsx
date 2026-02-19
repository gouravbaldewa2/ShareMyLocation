import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { Car, Loader2, MapPin, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { FleetMapView } from "@/components/FleetMapView";
import { useFleetViewer } from "@/hooks/use-fleet-websocket";
import { useTimeAgoMap } from "@/hooks/use-time-ago";
import type { Fleet, Vehicle } from "@shared/schema";

export default function FleetView() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  const { data: fleet, isLoading: fleetLoading, error } = useQuery<Fleet>({
    queryKey: ["/api/fleets", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/fleets/${params.id}`);
      if (!response.ok) throw new Error("Fleet not found");
      return response.json();
    },
  });

  const { data: initialVehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/fleets", params.id, "vehicles"],
    queryFn: async () => {
      const response = await fetch(`/api/fleets/${params.id}/vehicles`);
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      return response.json();
    },
    enabled: !!params.id,
  });

  const { vehicles, isConnected, refresh, lastRefresh } = useFleetViewer(params.id || null, initialVehicles);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const timeAgoDates: Record<string, string | null | undefined> = {};
  vehicles.forEach((v: Vehicle) => {
    timeAgoDates[v.id] = v.lastUpdated as string | null | undefined;
  });
  const timeAgoTexts = useTimeAgoMap(timeAgoDates, 10000);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };
  
  const liveCount = vehicles.filter((v: Vehicle) => v.isLive).length;
  const hasLocations = vehicles.some((v: Vehicle) => v.latitude != null && v.longitude != null);

  if (fleetLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !fleet) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Fleet Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This fleet may have expired or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold truncate" data-testid="text-fleet-name">
                  {fleet.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} 
                  {liveCount > 0 && (
                    <span className="text-green-600 dark:text-green-400 ml-1">
                      ({liveCount} live)
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {isConnected && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh"
                title={lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString()}` : undefined}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 relative min-h-0">
        <FleetMapView vehicles={vehicles} interactive />
        {!hasLocations && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
            <div className="text-center p-6 bg-background/90 backdrop-blur-sm rounded-lg shadow-lg pointer-events-auto">
              <Car className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-lg font-semibold mb-2">Waiting for Vehicles</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-3">
                No vehicles are sharing their location yet. Once a driver starts sharing, their position will appear here.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh-empty"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        )}
      </main>

      {vehicles.length > 0 && (
        <footer className="border-t bg-background p-3 shrink-0">
          <div className="container mx-auto">
            <div className="flex flex-wrap gap-2 justify-center">
              {vehicles.map((vehicle: Vehicle) => {
                const ago = timeAgoTexts[vehicle.id];
                return (
                  <div
                    key={vehicle.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-sm"
                    data-testid={`legend-${vehicle.id}`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ 
                        backgroundColor: vehicle.color,
                        opacity: vehicle.isLive ? 1 : 0.4,
                      }}
                    />
                    <span className={vehicle.isLive ? '' : 'text-muted-foreground'}>
                      {vehicle.name}
                    </span>
                    {vehicle.isLive && (
                      <span className="relative flex h-2 w-2 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    )}
                    {ago && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`time-ago-${vehicle.id}`}>
                        <Clock className="w-3 h-3" />
                        {ago}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
