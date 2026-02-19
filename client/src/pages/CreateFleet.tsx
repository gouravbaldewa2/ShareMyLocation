import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Car, Loader2, MapPin, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Fleet } from "@shared/schema";
import { saveFleet } from "@/lib/savedFleets";

export default function CreateFleet() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [fleetName, setFleetName] = useState("");

  const createFleetMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", "/api/fleets", data);
      return (await response.json()) as Fleet;
    },
    onSuccess: (fleet) => {
      saveFleet({
        id: fleet.id,
        name: fleet.name,
        adminCode: fleet.adminCode,
        createdAt: fleet.createdAt,
        expiresAt: fleet.expiresAt,
      });
      toast({
        title: "Fleet created!",
        description: "Your fleet has been set up. Now add your vehicles.",
      });
      navigate(`/fleet/admin/${fleet.adminCode}`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create fleet. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    if (!fleetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your fleet.",
        variant: "destructive",
      });
      return;
    }
    createFleetMutation.mutate({ name: fleetName.trim() });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
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
          <h1 className="text-4xl font-bold tracking-tight mb-2" data-testid="text-title">
            Fleet Tracker
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Track multiple vehicles on a single map. Perfect for resort buggies, golf carts, or delivery vehicles.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Create Your Fleet
            </CardTitle>
            <CardDescription>
              Give your fleet a name to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fleet-name">Fleet Name</Label>
              <Input
                id="fleet-name"
                placeholder="e.g., Resort Buggies, Golf Carts"
                value={fleetName}
                onChange={(e) => setFleetName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                data-testid="input-fleet-name"
              />
            </div>
            
            <Button
              onClick={handleCreate}
              disabled={!fleetName.trim() || createFleetMutation.isPending}
              className="w-full"
              size="lg"
              data-testid="button-create-fleet"
            >
              {createFleetMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Fleet
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-center">How it works</h2>
          <div className="grid gap-4">
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-medium">Create your fleet</p>
                <p className="text-sm text-muted-foreground">
                  Give your fleet a name (like "Resort Buggies")
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-medium">Add your vehicles</p>
                <p className="text-sm text-muted-foreground">
                  Add each buggy with a unique name (Buggy 1, Buggy 2, etc.)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-medium">Drivers share their location</p>
                <p className="text-sm text-muted-foreground">
                  Each driver opens the admin link on their phone and taps "Share"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                4
              </div>
              <div>
                <p className="font-medium">Guests see all vehicles</p>
                <p className="text-sm text-muted-foreground">
                  Share the guest link - they see all buggies on one map!
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Fleet links work for 24 hours. No app installation required!</p>
        </div>
      </div>
    </div>
  );
}
