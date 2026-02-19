import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { 
  Car, Plus, Copy, Check, Loader2, ExternalLink, Trash2, 
  MapPin, Link as LinkIcon, Home, Map, Clock 
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FleetMapView } from "@/components/FleetMapView";
import { useFleetViewer } from "@/hooks/use-fleet-websocket";
import { useTimeAgoMap } from "@/hooks/use-time-ago";
import type { Fleet, Vehicle } from "@shared/schema";

export default function FleetAdmin() {
  const params = useParams<{ adminCode: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newVehicleName, setNewVehicleName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(true);

  const { data: fleet, isLoading, error } = useQuery<Fleet>({
    queryKey: ["/api/fleets/admin", params.adminCode],
    queryFn: async () => {
      const response = await fetch(`/api/fleets/admin/${params.adminCode}`);
      if (!response.ok) throw new Error("Fleet not found");
      return response.json();
    },
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ["/api/fleets", fleet?.id, "vehicles"],
    queryFn: async () => {
      const response = await fetch(`/api/fleets/${fleet!.id}/vehicles`);
      if (!response.ok) throw new Error("Failed to fetch vehicles");
      return response.json();
    },
    enabled: !!fleet?.id,
    refetchInterval: 5000,
  });

  const { vehicles: liveVehicles, isConnected: wsConnected } = useFleetViewer(fleet?.id || null, vehicles);
  const liveCount = liveVehicles.filter((v) => v.isLive).length;
  const hasLocations = liveVehicles.some((v) => v.latitude != null && v.longitude != null);

  const timeAgoDates: Record<string, string | null | undefined> = {};
  liveVehicles.forEach((v) => {
    timeAgoDates[v.id] = v.lastUpdated as string | null | undefined;
  });
  const timeAgoTexts = useTimeAgoMap(timeAgoDates, 10000);

  const createVehicleMutation = useMutation({
    mutationFn: async (data: { fleetId: string; name: string }) => {
      const response = await apiRequest("POST", "/api/vehicles", data);
      return (await response.json()) as Vehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets", fleet?.id, "vehicles"] });
      setNewVehicleName("");
      toast({
        title: "Vehicle added",
        description: "New vehicle has been added to your fleet.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add vehicle. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      await apiRequest("DELETE", `/api/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets", fleet?.id, "vehicles"] });
      toast({
        title: "Vehicle removed",
        description: "Vehicle has been removed from your fleet.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove vehicle.",
        variant: "destructive",
      });
    },
  });

  const handleAddVehicle = () => {
    if (!fleet || !newVehicleName.trim()) return;
    createVehicleMutation.mutate({
      fleetId: fleet.id,
      name: newVehicleName.trim(),
    });
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
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
            <Button onClick={() => navigate("/fleet")} data-testid="button-create-fleet">
              Create New Fleet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const viewerLink = `${window.location.origin}/fleet/${fleet.id}`;
  const adminLink = `${window.location.origin}/fleet/admin/${fleet.adminCode}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
          </Link>
          <Link href="/fleets">
            <Button variant="ghost" size="sm" data-testid="button-back-fleets">
              <Car className="w-4 h-4 mr-2" />
              My Fleets
            </Button>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Car className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2" data-testid="text-fleet-title">
            {fleet.name}
          </h1>
          <p className="text-muted-foreground text-lg">
            Fleet Management Dashboard
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Share Links
              </CardTitle>
              <CardDescription>
                Share the viewer link with guests to see all buggies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label data-testid="label-viewer-link">Guest View Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={viewerLink}
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-viewer-link"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(viewerLink, "viewer")}
                    data-testid="button-copy-viewer"
                  >
                    {copied === "viewer" ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with resort guests
                </p>
              </div>
              
              <div className="space-y-2">
                <Label data-testid="label-admin-link">Admin Link (keep private)</Label>
                <div className="flex gap-2">
                  <Input
                    value={adminLink}
                    readOnly
                    className="font-mono text-sm"
                    data-testid="input-admin-link"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(adminLink, "admin")}
                    data-testid="button-copy-admin"
                  >
                    {copied === "admin" ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Bookmark this link to manage vehicles
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Vehicle
              </CardTitle>
              <CardDescription>
                Add a new buggy to your fleet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle-name">Vehicle Name</Label>
                <Input
                  id="vehicle-name"
                  placeholder="e.g., Buggy 1, Cart A"
                  value={newVehicleName}
                  onChange={(e) => setNewVehicleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddVehicle()}
                  data-testid="input-vehicle-name"
                />
              </div>
              <Button
                onClick={handleAddVehicle}
                disabled={!newVehicleName.trim() || createVehicleMutation.isPending}
                className="w-full"
                data-testid="button-add-vehicle"
              >
                {createVehicleMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Vehicle
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5" />
              Vehicles ({vehicles.length})
            </CardTitle>
            <CardDescription>
              Manage your fleet vehicles and start live tracking from each device
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vehicles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Car className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No vehicles yet. Add your first buggy above!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                    data-testid={`vehicle-item-${vehicle.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: vehicle.color }}
                      />
                      <div>
                        <p className="font-medium">{vehicle.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(() => {
                            const lv = liveVehicles.find(v => v.id === vehicle.id);
                            const ago = timeAgoTexts[vehicle.id];
                            return lv?.isLive ? (
                              <span className="flex items-center gap-1 flex-wrap">
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                  </span>
                                  Live
                                </span>
                                {ago && (
                                  <span className="flex items-center gap-1 text-muted-foreground" data-testid={`time-ago-${vehicle.id}`}>
                                    <Clock className="w-3 h-3" />
                                    {ago}
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 flex-wrap">
                                <span>Offline</span>
                                {ago && (
                                  <span className="flex items-center gap-1" data-testid={`time-ago-${vehicle.id}`}>
                                    <Clock className="w-3 h-3" />
                                    last seen {ago}
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`${window.location.origin}/vehicle/share/${vehicle.shareCode}`, `driver-${vehicle.id}`)}
                        data-testid={`button-copy-driver-link-${vehicle.id}`}
                      >
                        {copied === `driver-${vehicle.id}` ? (
                          <Check className="w-4 h-4 mr-1 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4 mr-1" />
                        )}
                        Driver Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteVehicleMutation.mutate(vehicle.id)}
                        disabled={deleteVehicleMutation.isPending}
                        data-testid={`button-delete-${vehicle.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Map className="w-5 h-5" />
                  Live Map
                  {liveCount > 0 && (
                    <span className="text-sm font-normal text-primary">
                      ({liveCount} live)
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Real-time view of all vehicle positions
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {wsConnected && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Connected
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMapExpanded(!mapExpanded)}
                  data-testid="button-toggle-map"
                >
                  {mapExpanded ? "Collapse" : "Expand"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {mapExpanded && (
            <CardContent>
              <div className="relative rounded-md overflow-hidden" style={{ height: "400px" }}>
                <FleetMapView vehicles={liveVehicles} interactive />
                {!hasLocations && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center p-4 bg-background/90 backdrop-blur-sm rounded-lg">
                      <Car className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No vehicles sharing yet
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>

        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => window.open(viewerLink, "_blank")}
            data-testid="button-preview"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Preview Guest View
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Fleet expires in 24 hours. Copy each vehicle's "Driver Link" and send to the driver.</p>
          <p>Drivers open their link and tap "Start Sharing" to broadcast their location.</p>
        </div>
      </div>
    </div>
  );
}
