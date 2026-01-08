import { Switch, Route, Redirect, useParams } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { MobileNav } from "@/components/MobileNav";
import Home from "@/pages/Home";
import CreateTrip from "@/pages/CreateTrip";
import ChatTrip from "@/pages/ChatTrip";
import TripResultsV1 from "@/pages/TripResultsV1";
// Note: TripDetails is deprecated in favor of TripResultsV1
import FeasibilityResults from "@/pages/FeasibilityResults";
import MyTrips from "@/pages/MyTrips";
import Explore from "@/pages/Explore";
import Saved from "@/pages/Saved";
import Inspiration from "@/pages/Inspiration";
import NotFound from "@/pages/not-found";

// Redirect /trips/:id to /trips/:id/results-v1
function TripRedirect() {
  const params = useParams<{ id: string }>();
  return <Redirect to={`/trips/${params.id}/results-v1`} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create" component={CreateTrip} />
      <Route path="/chat" component={ChatTrip} />
      <Route path="/trips/:id/feasibility" component={FeasibilityResults} />
      <Route path="/trips/:id/results-v1" component={TripResultsV1} />
      <Route path="/trips/:id" component={TripRedirect} />
      <Route path="/trips" component={MyTrips} />
      <Route path="/explore" component={Explore} />
      <Route path="/saved" component={Saved} />
      <Route path="/inspiration" component={Inspiration} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <AuthModal />
          <MobileNav />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
