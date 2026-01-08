import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { UserMenu } from "@/components/UserMenu";
import { NewsletterCapture } from "@/components/NewsletterCapture";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import { trackTripEvent } from "@/lib/analytics";
import {
  MapPin,
  Calendar,
  ChevronRight,
  Globe,
  Star,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Users,
  DollarSign,
  Clock,
  FileText
} from "lucide-react";

// Landmark images for artistic collage
const LANDMARKS = [
  { id: 'eiffel', name: 'Paris', image: 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=600', position: 'top-[15%] left-[5%]', size: 'w-32 h-44', rotation: '-rotate-6' },
  { id: 'colosseum', name: 'Rome', image: 'https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=600', position: 'top-[8%] right-[8%]', size: 'w-36 h-48', rotation: 'rotate-3' },
  { id: 'santorini', name: 'Santorini', image: 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=600', position: 'bottom-[20%] left-[3%]', size: 'w-40 h-52', rotation: 'rotate-6' },
  { id: 'dubai', name: 'Dubai', image: 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=600', position: 'bottom-[15%] right-[5%]', size: 'w-36 h-48', rotation: '-rotate-3' },
  { id: 'tokyo', name: 'Tokyo', image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=600', position: 'top-[40%] left-[8%]', size: 'w-28 h-36', rotation: '-rotate-12' },
  { id: 'bali', name: 'Bali', image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=600', position: 'top-[35%] right-[3%]', size: 'w-32 h-40', rotation: 'rotate-12' },
];

// Cloud SVG component
function Cloud({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 100" fill="currentColor">
      <ellipse cx="60" cy="60" rx="50" ry="35" />
      <ellipse cx="100" cy="50" rx="45" ry="30" />
      <ellipse cx="140" cy="55" rx="40" ry="28" />
      <ellipse cx="80" cy="45" rx="35" ry="25" />
      <ellipse cx="120" cy="60" rx="30" ry="22" />
    </svg>
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

  // Track landing page view
  useEffect(() => {
    trackTripEvent(0, 'landing_viewed', {}, undefined, 'home');
  }, []);

  const handleDestinationClick = (destination: string) => {
    setLocation(`/create?destination=${encodeURIComponent(destination)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-amber-100/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg font-bold font-display shadow-lg shadow-amber-500/30">
              V
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-slate-800">VoyageAI</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/trips" className="text-slate-600 hover:text-slate-900 font-medium hidden md:block">
              My Trips
            </Link>
            <Link href="/explore" className="text-slate-600 hover:text-slate-900 font-medium hidden md:block">
              Explore
            </Link>
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Hero Section - MindTrip-inspired bold design */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Warm gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-100 via-orange-100 to-yellow-100" />

        {/* Floating clouds */}
        <Cloud className="absolute top-20 left-10 w-48 h-24 text-white/60 animate-pulse" />
        <Cloud className="absolute top-32 right-20 w-64 h-32 text-white/50" />
        <Cloud className="absolute bottom-40 left-20 w-56 h-28 text-white/40" />
        <Cloud className="absolute bottom-20 right-10 w-40 h-20 text-white/30" />

        {/* Artistic landmark collage - hidden on mobile */}
        <div className="absolute inset-0 hidden lg:block">
          {LANDMARKS.map((landmark, index) => (
            <motion.div
              key={landmark.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.6 }}
              className={`absolute ${landmark.position} ${landmark.size} ${landmark.rotation} rounded-2xl overflow-hidden shadow-2xl shadow-black/20 hover:scale-105 transition-transform cursor-pointer border-4 border-white`}
              onClick={() => handleDestinationClick(landmark.name)}
            >
              <img
                src={landmark.image}
                alt={landmark.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end p-3">
                <span className="text-white text-sm font-semibold">{landmark.name}</span>
              </div>
            </motion.div>
          ))}
        </div>

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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-emerald-200 text-emerald-700 text-sm font-medium mb-8 shadow-lg"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Certainty Engine Powered</span>
            </motion.div>

            {/* Bold headline - Certainty-first (Sharpened) */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl lg:text-7xl font-display font-black text-slate-900 leading-[1] mb-6 tracking-tight"
            >
              Know if you can go.
              <br />
              Know what it costs.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500">
                Then plan.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg md:text-xl text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed"
            >
              Visa requirements, real costs, and timing risks — checked before your itinerary is built.
            </motion.p>

            {/* Search Bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="max-w-xl mx-auto mb-8"
            >
              <SearchAutocomplete
                placeholder="Where do you want to go?"
                size="lg"
                showTrending={true}
              />
            </motion.div>

            {/* Or Divider */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center gap-4 mb-6 max-w-md mx-auto"
            >
              <div className="flex-1 h-px bg-slate-300" />
              <span className="text-slate-400 text-sm font-medium">or</span>
              <div className="flex-1 h-px bg-slate-300" />
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/create">
                <Button
                  size="lg"
                  className="min-w-[240px] text-lg px-8 h-14 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl shadow-emerald-600/30 font-semibold"
                >
                  <ShieldCheck className="mr-2 w-5 h-5" />
                  Check Trip Feasibility
                </Button>
              </Link>
              <Link href="/demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="min-w-[220px] text-lg px-8 h-14 rounded-full bg-white/80 backdrop-blur-sm border-2 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 shadow-lg font-semibold"
                >
                  See Example Trip
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>

            {/* Concrete Example - makes promise visceral */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="mt-6 text-slate-500 text-sm"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100/80 rounded-lg border border-slate-200">
                <span className="font-medium text-slate-600">Example:</span>
                <span>Indian passport → Japan → Feb 2026</span>
                <span className="text-slate-400">•</span>
                <span className="text-amber-600 font-medium">Visa required. Apply by Jan 30.</span>
                <span className="text-slate-400">•</span>
                <span>Est. ₹1.55–1.75L</span>
              </span>
            </motion.div>

            {/* Product proof badges (intelligence-based, not vanity metrics) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75 }}
              className="flex flex-wrap items-center justify-center gap-4 mt-8 text-slate-600 text-xs"
            >
              <span className="flex items-center gap-2 bg-white/70 px-3 py-1.5 rounded-full border border-slate-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Visa requirements checked first
              </span>
              <span className="flex items-center gap-2 bg-white/70 px-3 py-1.5 rounded-full border border-slate-200">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Costs from real market data
              </span>
              <span className="flex items-center gap-2 bg-white/70 px-3 py-1.5 rounded-full border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Timing risks shown upfront
              </span>
            </motion.div>
          </motion.div>

          {/* Output Preview - THE PROOF */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="mt-12"
          >
            <p className="text-slate-500 text-sm mb-4 text-center">What you'll get:</p>
            <OutputPreview />
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
            className="w-6 h-10 rounded-full border-2 border-slate-300 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          </motion.div>
        </motion.div>
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
            <Link href="/create">
              <Button
                size="lg"
                className="text-lg px-10 h-16 rounded-full bg-white text-slate-900 hover:bg-white/90 shadow-xl font-semibold"
              >
                <ShieldCheck className="mr-2 w-5 h-5" />
                Check Trip Feasibility
              </Button>
            </Link>
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
