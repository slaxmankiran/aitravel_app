import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { UserMenu } from "@/components/UserMenu";
import { NewsletterCapture } from "@/components/NewsletterCapture";
import { trackTripEvent } from "@/lib/analytics";
import { usePlanningMode, getPlanningRoute } from "@/hooks/usePlanningMode";
import {
  MapPin,
  Calendar,
  ChevronRight,
  Star,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  DollarSign,
  Clock,
  FileText,
  MessageSquare,
  ClipboardList
} from "lucide-react";

// Background images for animated carousel
const BACKGROUND_IMAGES = [
  { url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&h=1080&fit=crop', name: 'Paris' },
  { url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&h=1080&fit=crop', name: 'Tokyo' },
  { url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&h=1080&fit=crop', name: 'Bali' },
  { url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1920&h=1080&fit=crop', name: 'Rome' },
  { url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1920&h=1080&fit=crop', name: 'Dubai' },
  { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&h=1080&fit=crop', name: 'Maldives' },
];

// Animated background carousel
function BackgroundCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence mode="sync">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img
            src={BACKGROUND_IMAGES[currentIndex].url}
            alt={BACKGROUND_IMAGES[currentIndex].name}
            className="w-full h-full object-cover"
          />
        </motion.div>
      </AnimatePresence>
      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
      {/* Warm tint overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/20 via-transparent to-orange-900/20" />
    </div>
  );
}

// Output Preview Card - shows what users will actually get
function OutputPreview() {
  return (
    <Link href="/demo">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="bg-slate-900 rounded-2xl p-5 shadow-2xl shadow-slate-900/30 border border-slate-700/50 text-left max-w-sm mx-auto cursor-pointer hover:scale-[1.02] transition-transform group"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
              V
            </div>
            <span className="text-white font-semibold text-sm">7 Days in Thailand</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-400 text-xs font-medium">85 Certainty</span>
          </div>
        </div>

        {/* Cost Bar */}
        <div className="bg-slate-800 rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-xs">Estimated Total</span>
            <span className="text-white font-bold">$858</span>
          </div>
          <div className="flex gap-1 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 w-[15%]" title="Flights" />
            <div className="bg-purple-500 w-[14%]" title="Hotels" />
            <div className="bg-emerald-500 w-[59%]" title="Activities" />
            <div className="bg-amber-500 w-[12%]" title="Food" />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-slate-500">
            <span>Flights</span>
            <span>Hotels</span>
            <span>Activities</span>
            <span>Food</span>
          </div>
        </div>

        {/* Day 1 Preview */}
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-medium">Day 1 • Bangkok</div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400">
              <Clock className="w-3 h-3" />
            </div>
            <span className="text-white/90 text-xs">Arrive at Suvarnabhumi Airport</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400">
              <MapPin className="w-3 h-3" />
            </div>
            <span className="text-white/90 text-xs">Wat Pho Temple</span>
            <span className="text-emerald-400 text-xs ml-auto">$10</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400">
              <MapPin className="w-3 h-3" />
            </div>
            <span className="text-white/90 text-xs">Sanam Luang Park</span>
            <span className="text-emerald-400 text-xs ml-auto">Free</span>
          </div>
        </div>

        {/* CTA hint */}
        <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-center gap-2 text-slate-400 text-xs group-hover:text-white transition-colors">
          <span>View full itinerary</span>
          <ArrowRight className="w-3 h-3" />
        </div>
      </motion.div>
    </Link>
  );
}

// Popular destinations for quick selection
const POPULAR_DESTINATIONS = [
  { name: 'Tokyo', country: 'Japan', image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.9, description: 'Ancient temples meet neon lights' },
  { name: 'Paris', country: 'France', image: 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.8, description: 'The city of love and lights' },
  { name: 'Bali', country: 'Indonesia', image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.9, description: 'Tropical paradise awaits' },
  { name: 'Rome', country: 'Italy', image: 'https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.7, description: 'Walk through history' },
  { name: 'Santorini', country: 'Greece', image: 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.9, description: 'Stunning sunsets and white houses' },
  { name: 'Dubai', country: 'UAE', image: 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.6, description: 'Luxury in the desert' },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { mode, setMode, isLoaded } = usePlanningMode("chat"); // Default to chat for new users

  // Track landing page view
  useEffect(() => {
    trackTripEvent(0, 'landing_viewed', {}, undefined, 'landing');
  }, []);

  const handleDestinationClick = (destination: string) => {
    // For destination cards, default to chat for new users (guided experience)
    // If user has a preference, use that instead
    const preferredMode = isLoaded && mode ? mode : "chat";
    const route = getPlanningRoute(preferredMode, destination);
    trackTripEvent(0, 'planning_mode_selected', {
      mode: preferredMode,
      destination,
      source: 'destination_card',
      isFirstTime: !isLoaded || mode === "form" // track if this was defaulted
    });
    setMode(preferredMode); // Remember preference
    setLocation(route);
  };

  const handlePlanningChoice = (selectedMode: "chat" | "form") => {
    const route = getPlanningRoute(selectedMode);
    trackTripEvent(0, 'planning_mode_selected', {
      mode: selectedMode,
      source: 'hero_cta'
    });
    setMode(selectedMode); // Remember preference
    setLocation(route);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Navigation - Glass style */}
      <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold font-display shadow-lg shadow-amber-500/30">
              V
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-white">VoyageAI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/trips" className="text-white/80 hover:text-white font-medium hidden md:block transition-colors">
              My Trips
            </Link>
            <Link href="/explore" className="text-white/80 hover:text-white font-medium hidden md:block transition-colors">
              Explore
            </Link>
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Hero Section - Cinematic with animated background */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Animated background carousel */}
        <BackgroundCarousel />

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium mb-8 shadow-lg"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Certainty Engine Powered</span>
            </motion.div>

            {/* Bold headline - Certainty-first (Sharpened) */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl lg:text-7xl font-display font-black text-white leading-[1] mb-6 tracking-tight drop-shadow-lg"
            >
              Know if you can go.
              <br />
              Know what it costs.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-400">
                Then plan.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg md:text-xl text-white/90 mb-10 max-w-xl mx-auto leading-relaxed drop-shadow"
            >
              Visa requirements, real costs, and timing risks — checked before your itinerary is built.
            </motion.p>

            {/* Split CTA Buttons - Planning Mode Choice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="flex flex-col items-center"
            >
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-3">
                {/* Chat-first */}
                <Button
                  size="lg"
                  onClick={() => handlePlanningChoice("chat")}
                  className="min-w-[220px] text-lg px-8 h-14 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-600/30 font-semibold"
                >
                  <MessageSquare className="mr-2 w-5 h-5" />
                  Plan with Chat
                </Button>

                {/* Form-first */}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => handlePlanningChoice("form")}
                  className="min-w-[220px] text-lg px-8 h-14 rounded-full bg-white/80 backdrop-blur-sm border-2 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 shadow-lg font-semibold"
                >
                  <ClipboardList className="mr-2 w-5 h-5" />
                  Plan with Form
                </Button>
              </div>

              {/* Microcopy explaining the choice */}
              <p className="text-white/70 text-sm text-center max-w-md">
                Chat guides you step by step. Form is faster if you know your details.
              </p>

              {/* Demo link - secondary */}
              <Link href="/demo" className="mt-4">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  See Example Trip
                  <ArrowRight className="ml-1 w-4 h-4" />
                </Button>
              </Link>
            </motion.div>

          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white/60" />
          </motion.div>
        </motion.div>
      </section>

      {/* Below-the-fold preview section - scrolls into view */}
      <section className="relative py-24 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzNCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20" />

        <div className="relative z-10 container mx-auto px-4">
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
              What you'll actually get
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              A complete travel report with visa requirements, real costs, and a day-by-day itinerary.
            </p>
          </motion.div>

          {/* Concrete Example */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-white/80 text-sm text-center mb-10"
          >
            <span className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <span className="font-medium text-white">Example:</span>
              <span>Indian passport → Japan → Feb 2026</span>
              <span className="text-white/50">•</span>
              <span className="text-amber-400 font-medium">Visa required. Apply by Jan 30.</span>
              <span className="text-white/50">•</span>
              <span>Est. ₹1.55–1.75L</span>
            </span>
          </motion.div>

          {/* Output Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <OutputPreview />
          </motion.div>

          {/* Product proof badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center justify-center gap-4 mt-12 text-white text-xs"
          >
            <span className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Visa requirements checked first
            </span>
            <span className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Costs from real market data
            </span>
            <span className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/20">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Timing risks shown upfront
            </span>
          </motion.div>
        </div>
      </section>

      {/* How It Works - Certainty-first */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-4">
              Certainty before planning
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              We check if your trip is actually possible before wasting your time on an itinerary.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Step 1 - Trip Input (show form-like artifact) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative p-6 rounded-2xl bg-white border border-slate-200 shadow-lg"
            >
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white text-sm font-bold">1</div>
              <div className="mt-2 mb-4">
                <h3 className="text-lg font-display font-bold text-slate-900">Tell us your trip</h3>
                <p className="text-slate-500 text-sm mt-1">30 seconds to enter details</p>
              </div>
              {/* Mini form artifact */}
              <div className="space-y-2 bg-slate-50 rounded-xl p-3">
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 text-sm">Thailand</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 text-sm">Feb 15-22, 2026</span>
                </div>
                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 text-sm">India passport</span>
                </div>
              </div>
            </motion.div>

            {/* Step 2 - Feasibility Check (show certainty score artifact) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative p-6 rounded-2xl bg-white border border-slate-200 shadow-lg"
            >
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">2</div>
              <div className="mt-2 mb-4">
                <h3 className="text-lg font-display font-bold text-slate-900">We check feasibility</h3>
                <p className="text-slate-500 text-sm mt-1">Instant certainty analysis</p>
              </div>
              {/* Certainty score artifact */}
              <div className="bg-slate-900 rounded-xl p-4 text-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-xs">Certainty Score</span>
                  <span className="text-2xl font-bold text-emerald-400">85</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Visa</span>
                    <span className="text-amber-400">Required • Apply by Jan 30</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Budget</span>
                    <span className="text-emerald-400">Within range</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Safety</span>
                    <span className="text-emerald-400">Safe destination</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Step 3 - Itinerary (show day card artifact) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative p-6 rounded-2xl bg-white border border-slate-200 shadow-lg"
            >
              <div className="absolute -top-4 left-6 w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white text-sm font-bold">3</div>
              <div className="mt-2 mb-4">
                <h3 className="text-lg font-display font-bold text-slate-900">Generate itinerary</h3>
                <p className="text-slate-500 text-sm mt-1">Day-by-day with real costs</p>
              </div>
              {/* Day card artifact */}
              <div className="bg-slate-900 rounded-xl p-3 text-white">
                <div className="text-xs text-slate-400 mb-2">Day 1 • Bangkok</div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs bg-slate-800 rounded px-2 py-1.5">
                    <span className="text-white/80">Wat Pho Temple</span>
                    <span className="text-emerald-400">$10</span>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-slate-800 rounded px-2 py-1.5">
                    <span className="text-white/80">Grand Palace</span>
                    <span className="text-emerald-400">$30</span>
                  </div>
                  <div className="flex items-center justify-between text-xs bg-slate-800 rounded px-2 py-1.5">
                    <span className="text-white/80">Chinatown Food Tour</span>
                    <span className="text-emerald-400">$15</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-700 flex justify-between text-xs">
                  <span className="text-slate-400">Day total</span>
                  <span className="text-white font-medium">$55</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Value props */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm text-slate-700">No more visa surprises</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm text-slate-700">Real costs, not estimates</span>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm text-slate-700">Timing warnings upfront</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Popular Destinations */}
      <section className="py-24 bg-slate-50">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-end justify-between mb-12"
          >
            <div>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 mb-4">
                Trending destinations
              </h2>
              <p className="text-lg text-slate-500">
                Where travelers are going this season
              </p>
            </div>
            <Link href="/explore" className="hidden md:flex items-center gap-2 text-amber-600 hover:text-amber-700 font-semibold">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {POPULAR_DESTINATIONS.map((destination, index) => (
              <motion.button
                key={destination.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleDestinationClick(`${destination.name}, ${destination.country}`)}
                className="group relative h-80 rounded-3xl overflow-hidden cursor-pointer text-left"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${destination.image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-white/90 text-sm">{destination.rating}</span>
                  </div>
                  <h3 className="text-2xl font-display font-bold text-white mb-1">
                    {destination.name}
                  </h3>
                  <p className="text-white/70 text-sm">{destination.description}</p>
                  <div className="mt-4 flex items-center gap-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-medium">Plan this trip</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="mt-8 text-center md:hidden">
            <Link href="/explore">
              <Button variant="outline" className="rounded-full">
                View all destinations <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-display font-bold text-white mb-6">
              Can you actually go?
            </h2>
            <p className="text-xl text-white/80 mb-10">
              Find out in 30 seconds. Enter your trip details and get instant feasibility results.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => handlePlanningChoice("chat")}
                className="text-lg px-8 h-14 rounded-full bg-white text-slate-900 hover:bg-white/90 shadow-xl font-semibold"
              >
                <MessageSquare className="mr-2 w-5 h-5" />
                Plan with Chat
              </Button>
              <Button
                size="lg"
                onClick={() => handlePlanningChoice("form")}
                className="text-lg px-8 h-14 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 text-white hover:bg-white/30 font-semibold"
              >
                <ClipboardList className="mr-2 w-5 h-5" />
                Plan with Form
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <NewsletterCapture variant="card" source="homepage" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold font-display">
                V
              </div>
              <span className="font-display font-semibold text-white">VoyageAI</span>
            </div>
            <div className="flex items-center gap-6 text-slate-400 text-sm">
              <Link href="/demo" className="hover:text-white transition-colors">Example Trip</Link>
              <Link href="/create" className="hover:text-white transition-colors">Plan a Trip</Link>
              <Link href="/explore" className="hover:text-white transition-colors">Explore</Link>
            </div>
            <p className="text-slate-500 text-sm">© 2026 VoyageAI. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
