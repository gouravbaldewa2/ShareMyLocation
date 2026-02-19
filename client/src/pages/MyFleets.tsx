import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Car, Plus, Copy, Check, Trash2, Clock, ArrowLeft, Settings, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getSavedFleets, saveFleet, removeFleet, type SavedFleet } from "@/lib/savedFleets";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Fleet } from "@shared/schema";

export default function MyFleets() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [fleets, setFleets] = useState<SavedFleet[]>([]);
  const [adminCodeInput, setAdminCodeInput] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [addingByCode, setAddingByCode] = useState(false);

  useEffect(() => {
    setFleets(getSavedFleets());
  }, []);

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

  const [newFleetName, setNewFleetName] = useState("");

  const handleCreateFleet = () => {
    if (!newFleetName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your fleet.",
        variant: "destructive",
      });
      return;
    }
    createFleetMutation.mutate({ name: newFleetName.trim() });
  };

  const handleAddByAdminCode = async () => {
    const code = adminCodeInput.trim();
    if (!code) return;

    setAddingByCode(true);
    try {
      const response = await fetch(`/api/fleets/admin/${code}`);
      if (!response.ok) {
        toast({
          title: "Fleet not found",
          description: "No fleet found with that admin code. Check the code and try again.",
          variant: "destructive",
        });
        return;
      }
      const fleet: Fleet = await response.json();

      const existing = fleets.find(f => f.id === fleet.id);
      if (existing) {
        toast({
          title: "Already added",
          description: `"${fleet.name}" is already in your dashboard.`,
        });
        return;
      }

      saveFleet({
        id: fleet.id,
        name: fleet.name,
        adminCode: fleet.adminCode,
        createdAt: fleet.createdAt,
        expiresAt: fleet.expiresAt,
      });
      setFleets(getSavedFleets());
      setAdminCodeInput("");
      toast({
        title: "Fleet added!",
        description: `"${fleet.name}" has been added to your dashboard.`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to look up fleet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setAddingByCode(false);
    }
  };

  const handleRemoveFleet = (fleet: SavedFleet) => {
    removeFleet(fleet.id);
    setFleets(getSavedFleets());
    toast({
      title: "Fleet removed",
      description: `"${fleet.name}" has been removed from your dashboard. The fleet still exists — you can re-add it with the admin code.`,
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
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

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    if (diffMs <= 0) return "Expired";
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m left`;
    }
    return `${diffMins}m left`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Car className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-2" data-testid="text-title">
            My Fleets
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Manage all your fleets from one place
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Fleet
              </CardTitle>
              <CardDescription>
                Start a new fleet for your vehicles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-fleet-name">Fleet Name</Label>
                <Input
                  id="new-fleet-name"
                  placeholder="e.g., Resort Buggies"
                  value={newFleetName}
                  onChange={(e) => setNewFleetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFleet()}
                  data-testid="input-new-fleet-name"
                />
              </div>
              <Button
                onClick={handleCreateFleet}
                disabled={!newFleetName.trim() || createFleetMutation.isPending}
                className="w-full"
                data-testid="button-create-fleet"
              >
                {createFleetMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Fleet
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Add Existing Fleet
              </CardTitle>
              <CardDescription>
                Add a fleet you already created on another device
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-code">Admin Code</Label>
                <Input
                  id="admin-code"
                  placeholder="Paste admin code from URL"
                  value={adminCodeInput}
                  onChange={(e) => setAdminCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddByAdminCode()}
                  data-testid="input-admin-code"
                />
                <p className="text-xs text-muted-foreground">
                  The code at the end of your admin URL (after /fleet/admin/)
                </p>
              </div>
              <Button
                onClick={handleAddByAdminCode}
                disabled={!adminCodeInput.trim() || addingByCode}
                variant="outline"
                className="w-full"
                data-testid="button-add-fleet"
              >
                {addingByCode ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Looking up...
                  </>
                ) : (
                  "Add to Dashboard"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {fleets.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Car className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-medium mb-1">No fleets yet</p>
              <p className="text-muted-foreground">
                Create a new fleet or add an existing one using its admin code.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Fleets ({fleets.length})
            </h2>
            <div className="space-y-3">
              {fleets.map((fleet) => (
                <Card key={fleet.id} className="hover-elevate" data-testid={`fleet-card-${fleet.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-lg truncate" data-testid={`fleet-name-${fleet.id}`}>
                          {fleet.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeRemaining(fleet.expiresAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
                        <Link href={`/fleet/admin/${fleet.adminCode}`}>
                          <Button variant="default" size="sm" data-testid={`button-manage-${fleet.id}`}>
                            <Settings className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                        </Link>
                        <Link href={`/fleet/${fleet.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-guest-view-${fleet.id}`}>
                            <Users className="w-4 h-4 mr-1" />
                            Guest View
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(
                            `${window.location.origin}/fleet/${fleet.id}`,
                            `guest-${fleet.id}`
                          )}
                          title="Copy guest link"
                          data-testid={`button-copy-guest-${fleet.id}`}
                        >
                          {copied === `guest-${fleet.id}` ? (
                            <Check className="w-4 h-4 text-primary" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFleet(fleet)}
                          title="Remove from dashboard"
                          data-testid={`button-remove-${fleet.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
