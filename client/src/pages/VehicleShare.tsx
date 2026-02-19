import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Car, Radio, Square, Loader2, MapPin, Smartphone, Wifi, WifiOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useVehicleSharer } from "@/hooks/use-fleet-websocket";
import { useTimeAgo } from "@/hooks/use-time-ago";
import { MapView } from "@/components/MapView";
import type { Vehicle } from "@shared/schema";

interface VehicleShareData {
  vehicle: Vehicle;
  fleetName: string;
  fleetId: string;
}

export default function VehicleShare() {
  const params = useParams<{ shareCode: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const { data, isLoading, error } = useQuery<VehicleShareData>({
    queryKey: ["/api/vehicles/share", params.shareCode],
    queryFn: async () => {
      const response = await fetch(`/api/vehicles/share/${params.shareCode}`);
      if (!response.ok) throw new Error("Vehicle not found");
      return response.json();
    },
  });

  const { startSharing, stopSharing, isSharing, connectionStatus, currentPosition, wakeLockActive, wasReconnected, lastSentAt } = useVehicleSharer(data?.vehicle?.id || null);
  const lastSentAgo = useTimeAgo(lastSentAt, 5000);

  useEffect(() => {
    if (wasReconnected) {
      toast({
        title: "Reconnected",
        description: "Your location is being broadcast again.",
      });
    }
  }, [wasReconnected, toast]);

  const handleStartSharing = () => {
    startSharing();
    toast({
      title: "Sharing started",
      description: "Your location is now being broadcast to the fleet.",
    });
  };

  const handleStopSharing = () => {
    stopSharing();
    toast({
      title: "Sharing stopped",
      description: "Your location is no longer being broadcast.",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Vehicle Not Found</h2>
            <p className="text-muted-foreground mb-4">
              This link may have expired or the vehicle was removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { vehicle, fleetName } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="text-center mb-6">
          <div 
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: `${vehicle.color}20` }}
          >
            <Car className="w-8 h-8" style={{ color: vehicle.color }} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" data-testid="text-vehicle-name">
            {vehicle.name}
          </h1>
          <p className="text-muted-foreground">
            Fleet: {fleetName}
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="w-5 h-5" />
              Location Sharing
            </CardTitle>
            <CardDescription>
              {isSharing 
                ? "Your location is being broadcast to guests viewing the fleet map"
                : "Start sharing to let guests see your location on the fleet map"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSharing && (
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {connectionStatus === 'connected' && (
                    <span className="flex items-center gap-2 text-green-600 dark:text-green-400" data-testid="status-broadcasting">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      Broadcasting your location
                    </span>
                  )}
                  {connectionStatus === 'connecting' && (
                    <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400" data-testid="status-reconnecting">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Reconnecting...
                    </span>
                  )}
                  {connectionStatus === 'disconnected' && (
                    <span className="flex items-center gap-2 text-red-600 dark:text-red-400" data-testid="status-disconnected">
                      <WifiOff className="w-3 h-3" />
                      Disconnected - will retry automatically
                    </span>
                  )}
                </div>

                {lastSentAgo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="text-last-sent">
                    <Clock className="w-3 h-3" />
                    Last update sent {lastSentAgo}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Smartphone className="w-3 h-3" />
                  {wakeLockActive ? (
                    <span>Screen will stay on while sharing</span>
                  ) : (
                    <span>Keep your screen on for best results</span>
                  )}
                </div>
              </div>
            )}

            {isSharing && currentPosition && (
              <div className="rounded-md overflow-hidden border" style={{ height: "200px" }} data-testid="driver-map-preview">
                <MapView
                  latitude={currentPosition.latitude}
                  longitude={currentPosition.longitude}
                  name={vehicle.name}
                  interactive
                />
              </div>
            )}

            {!isSharing ? (
              <Button
                onClick={handleStartSharing}
                className="w-full"
                size="lg"
                data-testid="button-start-sharing"
              >
                <Radio className="w-4 h-4 mr-2" />
                Start Sharing Location
              </Button>
            ) : (
              <Button
                onClick={handleStopSharing}
                variant="destructive"
                className="w-full"
                size="lg"
                data-testid="button-stop-sharing"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Sharing
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p className="flex items-center justify-center gap-1">
            <Wifi className="w-3 h-3" />
            Keep this page open while driving
          </p>
          <p>Guests can view all vehicles at the fleet map.</p>
        </div>
      </div>
    </div>
  );
}
