import React from "react";
import { Switch, Route, Redirect, useParams, useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { MobileNav } from "@/components/MobileNav";
import {
  PageTransition,
  SlideUpTransition,
  ZoomTransition,
  FadeScaleTransition,
} from "@/components/transitions";
import Home from "@/pages/Home";
import CreateTrip from "@/pages/CreateTrip";
import ChatTrip from "@/pages/ChatTrip";
import ChatTripV2 from "@/pages/ChatTripV2";
import TripResultsV1 from "@/pages/TripResultsV1";
import TripShareView from "@/pages/TripShareView";
import { TripExport } from "@/pages/TripExport";
import { TripCompareExport } from "@/pages/TripCompareExport";
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

/**
 * AnimatedRouter - Routes with page transitions
 *
 * Transition types by route:
 * - Home, Explore, Saved, Inspiration: fadeScale (default)
 * - Create, Chat: slideUp (elevated feel)
 * - Trip Results: zoomIn (cinematic, immersive)
 * - Exports: fade (utility pages)
 */
function AnimatedRouter() {
  const [location] = useLocation();

  // Extract base path for route key (strip query params)
  const routeKey = location.split('?')[0];

  return (
    <AnimatePresence mode="wait">
      <Switch location={location} key={routeKey}>
        {/* Home - Apple-like fade + scale */}
        <Route path="/">
          <FadeScaleTransition>
            <Home />
          </FadeScaleTransition>
        </Route>

        {/* Demo - Cinematic zoom */}
        <Route path="/demo">
          <ZoomTransition>
            <DemoTrip />
          </ZoomTransition>
        </Route>

        {/* Create Flow - Slide up (elevated modal feel) */}
        <Route path="/create">
          <SlideUpTransition>
            <CreateTrip />
          </SlideUpTransition>
        </Route>

        {/* Chat - Slide up */}
        <Route path="/chat">
          <SlideUpTransition>
            <ChatTripV2 />
          </SlideUpTransition>
        </Route>

        {/* Share View - Cinematic zoom */}
        <Route path="/share/:tripId">
          <ZoomTransition>
            <TripShareView />
          </ZoomTransition>
        </Route>

        {/* Legacy Chat */}
        <Route path="/chat-legacy">
          <SlideUpTransition>
            <ChatTrip />
          </SlideUpTransition>
        </Route>

        {/* Export Pages - Simple fade (utility) */}
        <Route path="/trips/:id/export/compare">
          <PageTransition type="fade">
            <TripCompareExport />
          </PageTransition>
        </Route>

        <Route path="/trips/:id/export">
          <PageTransition type="fade">
            <TripExport />
          </PageTransition>
        </Route>

        {/* Feasibility Results - Slide up */}
        <Route path="/trips/:id/feasibility">
          <SlideUpTransition>
            <FeasibilityResults />
          </SlideUpTransition>
        </Route>

        {/* Trip Results - Cinematic zoom (immersive) */}
        <Route path="/trips/:id/results-v1">
          <ZoomTransition>
            <TripResultsV1 />
          </ZoomTransition>
        </Route>

        {/* Trip Redirect */}
        <Route path="/trips/:id">
          <TripRedirect />
        </Route>

        {/* My Trips - Fade + scale */}
        <Route path="/trips">
          <FadeScaleTransition>
            <MyTrips />
          </FadeScaleTransition>
        </Route>

        {/* Discovery Pages - Fade + scale */}
        <Route path="/explore">
          <FadeScaleTransition>
            <Explore />
          </FadeScaleTransition>
        </Route>

        <Route path="/saved">
          <FadeScaleTransition>
            <Saved />
          </FadeScaleTransition>
        </Route>

        <Route path="/inspiration">
          <FadeScaleTransition>
            <Inspiration />
          </FadeScaleTransition>
        </Route>

        {/* 404 - Simple fade */}
        <Route>
          <PageTransition type="fade">
            <NotFound />
          </PageTransition>
        </Route>
      </Switch>
    </AnimatePresence>
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
          <AnimatedRouter />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
