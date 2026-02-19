import { useState, useEffect } from "react";
import { MapPin, Share2, Copy, Check, Loader2, Navigation, Radio, Square, Car, Trash2, ExternalLink, Clock } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapView } from "@/components/MapView";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocationSharer } from "@/hooks/use-websocket";
import { getSavedShares, saveShare, removeShare, updateShareLiveStatus, type SavedShare } from "@/lib/savedShares";
import type { Location } from "@shared/schema";
import { EXPIRY_OPTIONS } from "@shared/schema";

export default function Home() {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [sharedLocationId, setSharedLocationId] = useState<string | null>(null);
  const { toast } = useToast();

  const { startSharing, stopSharing, isSharing, connectionStatus, currentPosition } = useLocationSharer(sharedLocationId);
  const [shouldStartSharing, setShouldStartSharing] = useState(false);
  const [savedShares, setSavedShares] = useState<SavedShare[]>([]);
  const [expiryMinutes, setExpiryMinutes] = useState<number>(1440); // Default 24 hours

  useEffect(() => {
    setSavedShares(getSavedShares());
  }, []);

  const createLocationMutation = useMutation({
    mutationFn: async (data: { latitude: number; longitude: number; name?: string; isLive?: boolean; expiresInMinutes?: number }) => {
      const response = await apiRequest("POST", "/api/locations", data);
      return (await response.json()) as Location;
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/view/${data.id}`;
      setShareLink(link);
      setSharedLocationId(data.id);
      if (isLiveMode) {
        setShouldStartSharing(true);
      }
      
      const newShare: SavedShare = {
        id: data.id,
        link,
        name: locationName || "My Location",
        isLive: isLiveMode,
        createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      saveShare(newShare);
      setSavedShares(getSavedShares());
      
      toast({
        title: "Location shared!",
        description: isLiveMode 
          ? "Your live location is now being shared. Keep this page open!"
          : "Your shareable link is ready.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create share link. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Start live sharing when location ID is set and live mode is enabled
  useEffect(() => {
    if (shouldStartSharing && sharedLocationId && isLiveMode && !isSharing) {
      startSharing();
      setShouldStartSharing(false);
    }
  }, [shouldStartSharing, sharedLocationId, isLiveMode, isSharing, startSharing]);

  const getMyLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Not supported",
        description: "Your browser doesn't support location services.",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setGettingLocation(false);
        toast({
          title: "Location found!",
          description: "Your current location has been detected.",
        });
      },
      (error) => {
        setGettingLocation(false);
        let message = "Unable to get your location.";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Location access was denied. Please enable it in your browser settings.";
        }
        toast({
          title: "Location error",
          description: message,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleShare = () => {
    if (!location) {
      toast({
        title: "No location",
        description: "Please get your location first.",
        variant: "destructive",
      });
      return;
    }

    createLocationMutation.mutate({
      latitude: location.lat,
      longitude: location.lng,
      name: locationName || undefined,
      isLive: isLiveMode,
      expiresInMinutes: expiryMinutes,
    });
  };

  const handleStopSharing = () => {
    if (sharedLocationId) {
      updateShareLiveStatus(sharedLocationId, false);
      setSavedShares(getSavedShares());
    }
    stopSharing();
    setSharedLocationId(null);
    setShareLink(null);
    toast({
      title: "Stopped sharing",
      description: "Your live location is no longer being shared.",
    });
  };

  const handleDeleteShare = async (shareId: string) => {
    try {
      await apiRequest("DELETE", `/api/locations/${shareId}`);
    } catch {
      // Link may already be expired on server, but we can still remove locally
    }
    removeShare(shareId);
    setSavedShares(getSavedShares());
    toast({
      title: "Share deleted",
      description: "The share link has been removed.",
    });
  };

  const handleCopyShareLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
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

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m left`;
    }
    return `${diffMins}m left`;
  };

  const copyToClipboard = async () => {
    if (!shareLink) return;
    
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2" data-testid="text-title">
            Share My Location
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Share your current location with anyone through a simple link. No apps required!
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Your Location
              </CardTitle>
              <CardDescription>
                Get your current location to share with others
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={getMyLocation}
                disabled={gettingLocation || isSharing}
                className="w-full"
                size="lg"
                data-testid="button-get-location"
              >
                {gettingLocation ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Getting location...
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-2" />
                    Get My Location
                  </>
                )}
              </Button>

              {location && (
                <div className="space-y-4">
                  <div className="h-48 rounded-md overflow-hidden border">
                    <MapView
                      latitude={currentPosition?.lat ?? location.lat}
                      longitude={currentPosition?.lng ?? location.lng}
                      name={locationName || "My Location"}
                    />
                  </div>
                  {isSharing && currentPosition && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                      Map updates as you move
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground">Latitude</span>
                      <p className="font-mono font-medium" data-testid="text-latitude">
                        {(currentPosition?.lat ?? location.lat).toFixed(6)}
                      </p>
                    </div>
                    <div className="p-3 bg-muted rounded-md">
                      <span className="text-muted-foreground">Longitude</span>
                      <p className="font-mono font-medium" data-testid="text-longitude">
                        {(currentPosition?.lng ?? location.lng).toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                Share Link
              </CardTitle>
              <CardDescription>
                Give your location a name and generate a shareable link
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location-name" data-testid="label-location-name">Location Name (optional)</Label>
                <Input
                  id="location-name"
                  placeholder="e.g., Meeting Point, My Office"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  disabled={isSharing}
                  data-testid="input-location-name"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                <div className="flex items-center gap-2">
                  <Radio className={`w-4 h-4 ${isLiveMode ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">Live Location</p>
                    <p className="text-xs text-muted-foreground">Updates in real-time while you move</p>
                  </div>
                </div>
                <Switch
                  checked={isLiveMode}
                  onCheckedChange={setIsLiveMode}
                  disabled={isSharing}
                  data-testid="switch-live-mode"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiry-duration" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Link Expires In
                </Label>
                <Select
                  value={expiryMinutes.toString()}
                  onValueChange={(value) => setExpiryMinutes(Number(value))}
                  disabled={isSharing}
                >
                  <SelectTrigger id="expiry-duration" data-testid="select-expiry">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isSharing ? (
                <Button
                  onClick={handleShare}
                  disabled={!location || createLocationMutation.isPending}
                  className="w-full"
                  size="lg"
                  data-testid="button-share"
                >
                  {createLocationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating link...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      {isLiveMode ? "Start Live Sharing" : "Generate Share Link"}
                    </>
                  )}
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

              {shareLink && (
                <div className="space-y-3 pt-4 border-t" data-testid="container-share-result">
                  {isSharing && isLiveMode && (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        {connectionStatus === 'connected' && (
                          <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Sending live updates
                          </span>
                        )}
                        {connectionStatus === 'connecting' && (
                          <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Reconnecting...
                          </span>
                        )}
                        {connectionStatus === 'disconnected' && (
                          <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            Disconnected - reconnecting soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Keep this page open to share your live location
                      </p>
                    </>
                  )}
                  <Label data-testid="label-share-link">Your shareable link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={shareLink}
                      readOnly
                      className="font-mono text-sm"
                      data-testid="input-share-link"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={copyToClipboard}
                      data-testid="button-copy-link"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground" data-testid="text-share-hint">
                    Share this link with friends via WhatsApp, SMS, or any messenger!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Your location is only shared when you click the share button.</p>
          <p>Links expire based on your selected duration and don't require any app to view.</p>
        </div>

        {savedShares.length > 0 && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Share2 className="w-5 h-5" />
                  My Active Shares
                </CardTitle>
                <CardDescription>
                  Manage your shared location links
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {savedShares.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-md gap-3"
                      data-testid={`share-item-${share.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{share.name}</p>
                          {share.isLive && (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                              </span>
                              Live
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeRemaining(share.expiresAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyShareLink(share.link)}
                          title="Copy link"
                          data-testid={`button-copy-share-${share.id}`}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <a href={share.link} target="_blank" rel="noopener noreferrer">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Open link"
                            data-testid={`button-open-share-${share.id}`}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteShare(share.id)}
                          title="Delete share"
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-share-${share.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="mt-8 pt-8 border-t">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              Need to track multiple vehicles on the same map?
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link href="/fleets">
                <Button variant="outline" size="lg" data-testid="button-my-fleets">
                  <Car className="w-4 h-4 mr-2" />
                  My Fleets
                </Button>
              </Link>
              <Link href="/fleet">
                <Button variant="outline" size="lg" data-testid="button-fleet">
                  <Car className="w-4 h-4 mr-2" />
                  Create Fleet Tracker
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
