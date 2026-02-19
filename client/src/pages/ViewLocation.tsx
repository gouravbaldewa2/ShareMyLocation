import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { MapPin, Navigation, Clock, ExternalLink, Loader2, AlertCircle, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapView } from "@/components/MapView";
import { useLocationViewer } from "@/hooks/use-websocket";
import type { Location } from "@shared/schema";

export default function ViewLocation() {
  const [, params] = useRoute("/view/:id");
  const locationId = params?.id || null;

  const { data: initialLocation, isLoading, error } = useQuery<Location>({
    queryKey: ["/api/locations", locationId],
    enabled: !!locationId,
  });

  const { location, isLive, isConnected, refresh, lastRefresh } = useLocationViewer(locationId, initialLocation || null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const displayLocation = location || initialLocation;

  const openInMaps = () => {
    if (!displayLocation) return;
    const url = `https://www.google.com/maps?q=${displayLocation.latitude},${displayLocation.longitude}`;
    window.open(url, "_blank");
  };

  const openDirections = () => {
    if (!displayLocation) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${displayLocation.latitude},${displayLocation.longitude}`;
    window.open(url, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="container-loading">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground" data-testid="text-loading">Loading location...</p>
        </div>
      </div>
    );
  }

  if (error || !displayLocation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2" data-testid="text-error-title">Location Not Found</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-error-message">
              This location link may have expired or doesn't exist. Links are valid for 24 hours.
            </p>
            <Button asChild>
              <a href="/" data-testid="link-share-location">Share Your Location</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const createdDate = new Date(displayLocation.createdAt);
  const formattedDate = createdDate.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lastUpdatedDate = displayLocation.lastUpdated ? new Date(displayLocation.lastUpdated) : null;
  const formattedLastUpdated = lastUpdatedDate ? lastUpdatedDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
            <MapPin className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1" data-testid="text-location-title">
            {displayLocation.name || "Shared Location"}
          </h1>
          <div className="flex flex-col items-center gap-2">
            <p className="text-muted-foreground flex items-center justify-center gap-2" data-testid="text-shared-date">
              <Clock className="w-4 h-4" />
              Shared on {formattedDate}
            </p>
            <div className="flex items-center gap-3">
              {isLive && (
                <div className="flex items-center gap-2 text-primary text-sm font-medium" data-testid="indicator-live">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  Live
                  {formattedLastUpdated && (
                    <span className="text-muted-foreground font-normal">
                      (updated: {formattedLastUpdated})
                    </span>
                  )}
                </div>
              )}
              {isConnected && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Connected
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                data-testid="button-refresh"
                title={lastRefresh ? `Last refreshed: ${lastRefresh.toLocaleTimeString()}` : undefined}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <Card className="mb-6">
          <CardContent className="p-0">
            <div className="h-[400px] w-full">
              <MapView
                latitude={displayLocation.latitude}
                longitude={displayLocation.longitude}
                name={displayLocation.name}
                interactive
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                Coordinates
                {isLive && <Radio className="w-3 h-3 text-primary" />}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Latitude</p>
                  <p className="font-mono font-medium" data-testid="text-view-latitude">
                    {displayLocation.latitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Longitude</p>
                  <p className="font-mono font-medium" data-testid="text-view-longitude">
                    {displayLocation.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Quick Actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                onClick={openInMaps}
                className="w-full"
                variant="outline"
                data-testid="button-open-maps"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Google Maps
              </Button>
              <Button
                onClick={openDirections}
                className="w-full"
                data-testid="button-get-directions"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Get Directions
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button variant="ghost" asChild>
            <a href="/" data-testid="link-share-own-location">
              <MapPin className="w-4 h-4 mr-2" />
              Share Your Own Location
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
