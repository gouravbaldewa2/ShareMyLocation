import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import ViewLocation from "@/pages/ViewLocation";
import CreateFleet from "@/pages/CreateFleet";
import FleetAdmin from "@/pages/FleetAdmin";
import FleetView from "@/pages/FleetView";
import VehicleShare from "@/pages/VehicleShare";
import MyFleets from "@/pages/MyFleets";
import NotFound from "@/pages/not-found";

// Redirect to /login if user is not authenticated
function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F0F14] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00B4D8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  return <Component />;
}

// Top-right header: theme toggle + user avatar / sign-in button
function HeaderControls() {
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      <ThemeToggle />
      {!isLoading && (
        <>
          {user ? (
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border-2 border-[#00B4D8] cursor-pointer"
                  title={`Signed in as ${user.name}`}
                  onClick={() => logout()}
                />
              ) : (
                <button
                  onClick={() => logout()}
                  className="w-8 h-8 rounded-full bg-[#00B4D8] flex items-center justify-center text-white text-sm font-bold cursor-pointer border-2 border-[#00B4D8]"
                  title={`Signed in as ${user.name} — click to sign out`}
                >
                  {user.name.charAt(0).toUpperCase()}
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={login}
              className="px-3 py-1.5 text-sm font-semibold rounded-full bg-[#00B4D8] text-[#0F0F14] hover:bg-[#00c9f0] transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/view/:id" component={ViewLocation} />
      <Route path="/fleet">
        {() => <ProtectedRoute component={CreateFleet} />}
      </Route>
      <Route path="/fleets">
        {() => <ProtectedRoute component={MyFleets} />}
      </Route>
      <Route path="/fleet/admin/:adminCode">
        {() => <ProtectedRoute component={FleetAdmin} />}
      </Route>
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
          <AuthProvider>
            <HeaderControls />
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
