import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import CreateTrip from "@/pages/CreateTrip";
import TripDetails from "@/pages/TripDetails";
import NotFound from "@/pages/not-found";
import landscapeVideo from "@assets/generated_videos/cinematic_aerial_landscape_of_mountains_and_oceans.mp4";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/create" component={CreateTrip} />
      <Route path="/trips/:id" component={TripDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="relative min-h-screen w-full bg-[#000814] overflow-hidden">
          {/* Background Video */}
          <div className="fixed inset-0 z-0">
            <video
              src={landscapeVideo}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover opacity-60"
            />
            {/* Overlay to ensure readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />
          </div>
          
          {/* Main Content */}
          <div className="relative z-10">
            <Toaster />
            <Router />
          </div>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
