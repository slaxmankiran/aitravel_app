import React from "react";
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
import ChatTripV2 from "@/pages/ChatTripV2";
import TripResultsV1 from "@/pages/TripResultsV1";
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

// Demo page - fetches demo trip from API with fallback
function DemoTrip() {
  const [demoTripData, setDemoTripData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [tracked, setTracked] = React.useState(false);

  React.useEffect(() => {
    // Fetch demo trip from dedicated endpoint
    fetch('/api/demo-trip')
      .then(res => res.json())
      .then(data => {
        setDemoTripData(data);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to trip 2 if endpoint fails
        setDemoTripData({ id: 2 });
        setLoading(false);
      });
  }, []);

  // Track demo opened event once data is loaded
  React.useEffect(() => {
    if (demoTripData && !tracked) {
      import('@/lib/analytics').then(({ trackTripEvent }) => {
        trackTripEvent(
          demoTripData.id > 0 ? demoTripData.id : 0,
          'demo_opened',
          { destination: demoTripData.destination },
          undefined,
          'demo'
        );
      });
      setTracked(true);
    }
  }, [demoTripData, tracked]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If fallback data (id === -1), pass the full data directly
  // Otherwise use the trip ID to fetch from API
  return (
    <TripResultsV1
      tripIdOverride={demoTripData?.id > 0 ? demoTripData.id : 2}
      tripDataOverride={demoTripData?.id < 0 ? demoTripData : undefined}
      isDemo={true}
    />
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/demo" component={DemoTrip} />
      <Route path="/create" component={CreateTrip} />
      <Route path="/chat" component={ChatTripV2} />
      <Route path="/chat-legacy" component={ChatTrip} />
      <Route path="/trips/:id/feasibility" component={FeasibilityResults} />
      {/* @ts-expect-error - TripResultsV1 has optional props that are unused in this route */}
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
