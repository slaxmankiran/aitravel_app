import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import CreateTrip from "@/pages/CreateTrip";
import TripDetails from "@/pages/TripDetails";
import NotFound from "@/pages/not-found";
import { EarthGlobe } from "@/components/EarthGlobe";
import { Canvas } from "@react-three/fiber";

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
          {/* Background Animation */}
          <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
            <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} intensity={1} />
              <EarthGlobe />
            </Canvas>
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
