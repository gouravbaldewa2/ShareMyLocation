import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import Home from "@/pages/Home";
import ViewLocation from "@/pages/ViewLocation";
import CreateFleet from "@/pages/CreateFleet";
import FleetAdmin from "@/pages/FleetAdmin";
import FleetView from "@/pages/FleetView";
import VehicleShare from "@/pages/VehicleShare";
import MyFleets from "@/pages/MyFleets";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/view/:id" component={ViewLocation} />
      <Route path="/fleet" component={CreateFleet} />
      <Route path="/fleets" component={MyFleets} />
      <Route path="/fleet/admin/:adminCode" component={FleetAdmin} />
      <Route path="/fleet/:id" component={FleetView} />
      <Route path="/vehicle/share/:shareCode" component={VehicleShare} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <div className="fixed top-4 right-4 z-50">
            <ThemeToggle />
          </div>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
