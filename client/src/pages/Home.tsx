import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { UserMenu } from "@/components/UserMenu";
import { NewsletterCapture } from "@/components/NewsletterCapture";
import { SearchAutocomplete } from "@/components/SearchAutocomplete";
import {
  MessageCircle,
  Play,
  MapPin,
  Calendar,
  Users,
  Sparkles,
  ChevronRight,
  Globe,
  Star,
  ArrowRight,
  Search,
  ShieldCheck,
  Clock,
  DollarSign,
  CheckCircle
} from "lucide-react";
import { useState } from "react";

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
  const [showVideo, setShowVideo] = useState(false);

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

            {/* Bold headline - Certainty-first */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl lg:text-8xl font-display font-black text-slate-900 leading-[0.9] mb-8 tracking-tight"
            >
              Know if you can go
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500">
                before you plan.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xl md:text-2xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed"
            >
              VoyageAI checks visa rules, timing, and real trip costs before building your itinerary.
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
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="min-w-[220px] text-lg px-8 h-14 rounded-full bg-white/80 backdrop-blur-sm border-2 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300 shadow-lg font-semibold"
              >
                See How It Works
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
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

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-6 mt-12 text-slate-500 text-sm"
            >
              <span className="flex items-center gap-2 bg-white/60 px-4 py-2 rounded-full">
                <Globe className="w-4 h-4" />
                195+ Countries
              </span>
              <span className="flex items-center gap-2 bg-white/60 px-4 py-2 rounded-full">
                <Users className="w-4 h-4" />
                50K+ Trips Planned
              </span>
              <span className="flex items-center gap-2 bg-white/60 px-4 py-2 rounded-full">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                4.9 Rating
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              number="1"
              icon={<MapPin className="w-6 h-6" />}
              title="Tell us your trip"
              description="Enter destination, dates, passport, and budget. Takes 30 seconds."
              color="from-slate-400 to-slate-600"
            />
            <StepCard
              number="2"
              icon={<ShieldCheck className="w-6 h-6" />}
              title="We check feasibility"
              description="Visa rules, processing times, budget realism, safety - answered instantly."
              color="from-emerald-400 to-teal-500"
            />
            <StepCard
              number="3"
              icon={<Calendar className="w-6 h-6" />}
              title="Generate itinerary"
              description="Only after feasibility is verified, we build a day-by-day plan with real costs."
              color="from-teal-400 to-cyan-500"
            />
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
              <a href="#" className="hover:text-white transition-colors">About</a>
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-slate-500 text-sm">© 2024 VoyageAI. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Video Modal */}
      {showVideo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowVideo(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg opacity-70">Demo video coming soon</p>
              </div>
            </div>
            <button
              onClick={() => setShowVideo(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
            >
              ✕
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function StepCard({ number, icon, title, description, color }: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative p-8 rounded-3xl bg-white border border-slate-100 shadow-lg shadow-slate-100/50 hover:shadow-xl transition-shadow"
    >
      <div className={`absolute -top-5 left-8 w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white font-bold shadow-lg`}>
        {number}
      </div>
      <div className="mt-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 mb-6">
          {icon}
        </div>
        <h3 className="text-xl font-display font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-500 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
