import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { UserMenu } from "@/components/UserMenu";
import { NewsletterCapture } from "@/components/NewsletterCapture";
import {
  ArrowRight,
  Globe,
  ShieldCheck,
  Banknote,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Plane,
  Star,
  ChevronDown
} from "lucide-react";
import { useState, useEffect } from "react";

// Curated destination media - EXACT URLs from user's list
const DESTINATION_MEDIA = [
  // Budapest - User provided
  { id: 'budapest-1', name: 'Budapest, Hungary', type: 'image', url: 'https://images.pexels.com/photos/732057/pexels-photo-732057.jpeg?auto=compress&cs=tinysrgb&w=1920' },
  { id: 'budapest-2', name: 'Budapest, Hungary', type: 'image', url: 'https://images.pexels.com/photos/47727/budapest-church-architecture-matthias-church-47727.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // Sydney - User provided (1619854)
  { id: 'sydney-1', name: 'Sydney, Australia', type: 'image', url: 'https://images.pexels.com/photos/1619854/pexels-photo-1619854.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // New York - User provided (1239162)
  { id: 'nyc-1', name: 'New York, USA', type: 'image', url: 'https://images.pexels.com/photos/1239162/pexels-photo-1239162.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // Switzerland - User provided (2779863)
  { id: 'swiss-1', name: 'Switzerland', type: 'image', url: 'https://images.pexels.com/photos/2779863/pexels-photo-2779863.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // Canada/Banff - User provided (2662116)
  { id: 'canada-1', name: 'Banff, Canada', type: 'image', url: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // Singapore - User provided (777059)
  { id: 'singapore-1', name: 'Singapore', type: 'image', url: 'https://images.pexels.com/photos/777059/pexels-photo-777059.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // Thailand - User provided (33518325)
  { id: 'thailand-1', name: 'Thailand', type: 'image', url: 'https://images.pexels.com/photos/33518325/pexels-photo-33518325.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // Japan - User provided (248195)
  { id: 'japan-1', name: 'Japan', type: 'image', url: 'https://images.pexels.com/photos/248195/pexels-photo-248195.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // Dubai - Using proper Dubai image (Burj Khalifa)
  { id: 'dubai-1', name: 'Dubai, UAE', type: 'image', url: 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=1920' },

  // India/Madurai - User provided (30373182)
  { id: 'india-1', name: 'Madurai, India', type: 'image', url: 'https://images.pexels.com/photos/30373182/pexels-photo-30373182.jpeg?auto=compress&cs=tinysrgb&w=1920' },
];

// Shuffle array helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Popular destinations for quick selection
const POPULAR_DESTINATIONS = [
  { name: 'Tokyo', country: 'Japan', image: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.9 },
  { name: 'Paris', country: 'France', image: 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.8 },
  { name: 'Bali', country: 'Indonesia', image: 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.9 },
  { name: 'Rome', country: 'Italy', image: 'https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.7 },
  { name: 'Santorini', country: 'Greece', image: 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.9 },
  { name: 'Dubai', country: 'UAE', image: 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=800', rating: 4.6 },
];

export default function Home() {
  const [shuffledMedia, setShuffledMedia] = useState(() => shuffleArray(DESTINATION_MEDIA));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, setLocation] = useLocation();

  // Shuffle on mount
  useEffect(() => {
    setShuffledMedia(shuffleArray(DESTINATION_MEDIA));
  }, []);

  // Cycle through media
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = prev + 1;
        if (next >= shuffledMedia.length) {
          setShuffledMedia(shuffleArray(DESTINATION_MEDIA));
          return 0;
        }
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [shuffledMedia.length]);

  const currentMedia = shuffledMedia[currentIndex] || shuffledMedia[0];

  const handleDestinationClick = (destination: string) => {
    setLocation(`/create?destination=${encodeURIComponent(destination)}`);
  };

  const scrollToDestinations = () => {
    document.getElementById('destinations')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-lg font-bold font-display shadow-lg shadow-primary/30">
              V
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-white">VoyageAI</span>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Hero Section with Image/Video Background */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background - handles both images and videos */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMedia.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0"
            >
              {currentMedia.type === 'video' ? (
                // Video background
                <video
                  key={currentMedia.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                >
                  <source src={currentMedia.url} type="video/mp4" />
                </video>
              ) : (
                // Image with Ken Burns zoom animation
                <motion.div
                  initial={{ scale: 1 }}
                  animate={{ scale: 1.15 }}
                  transition={{ duration: 8, ease: "linear" }}
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${currentMedia.url})` }}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Overlays for better text readability */}
          <div className="absolute inset-0 bg-black/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-black/30" />
        </div>

        {/* Current Location Badge */}
        <motion.div
          key={currentMedia.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-24 right-8 z-20 hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20"
        >
          <MapPin className="w-3 h-3 text-white" />
          <span className="text-white text-sm font-medium">{currentMedia.name}</span>
        </motion.div>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium mb-8"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>AI-Powered Travel Planning</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-display font-extrabold text-white leading-[0.9] mb-6 drop-shadow-2xl">
              Where will your
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-400 to-accent">
                next adventure
              </span>
              <br />
              take you?
            </h1>

            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
              Tell us your dream destination. We'll analyze visa requirements,
              budget, safety — and craft your perfect itinerary.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <Link href="/create">
                <Button size="lg" className="w-full sm:w-auto min-w-[220px] text-lg px-8 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/30 text-white hover:bg-white/25 shadow-xl shadow-black/10">
                  <Plane className="mr-2 w-5 h-5" />
                  Plan Your Trip
                </Button>
              </Link>
              <Button
                size="lg"
                onClick={scrollToDestinations}
                className="w-full sm:w-auto min-w-[220px] text-lg px-8 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/30 text-white hover:bg-white/25 shadow-xl shadow-black/10"
              >
                Explore Destinations
                <ChevronDown className="ml-2 w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center justify-center gap-6 text-white/60 text-sm">
              <span className="flex items-center gap-1">
                <Globe className="w-4 h-4" />
                195+ Countries
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                50K+ Trips Planned
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                4.9 Rating
              </span>
            </div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </motion.div>
        </motion.div>
      </section>

      {/* Popular Destinations */}
      <section id="destinations" className="py-24 bg-slate-900">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Popular Destinations
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Get inspired by these trending destinations loved by travelers worldwide
            </p>
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
                className="group relative h-80 rounded-3xl overflow-hidden cursor-pointer"
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
                  <p className="text-white/70">{destination.country}</p>
                  <div className="mt-4 flex items-center gap-2 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-sm font-medium">Plan this trip</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-slate-950">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Plan your perfect trip in three simple steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <StepCard
              number="01"
              icon={<MapPin className="w-6 h-6" />}
              title="Enter Your Details"
              description="Tell us where you want to go, when, and your budget. We'll handle the rest."
              delay={0}
            />
            <StepCard
              number="02"
              icon={<ShieldCheck className="w-6 h-6" />}
              title="AI Analysis"
              description="Our AI checks visa requirements, analyzes safety, and validates your budget."
              delay={0.1}
            />
            <StepCard
              number="03"
              icon={<Calendar className="w-6 h-6" />}
              title="Get Your Itinerary"
              description="Receive a complete day-by-day plan with maps, costs, and local tips."
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
                Travel smarter with
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent"> AI insights</span>
              </h2>
              <p className="text-lg text-white/60 mb-8">
                Unlike other travel planners, we analyze the feasibility of your trip first — so you know what to expect before you book.
              </p>

              <div className="space-y-4">
                <FeatureItem
                  icon={<Globe className="w-5 h-5 text-blue-400" />}
                  title="Visa Intelligence"
                  description="Know your entry requirements based on your passport"
                />
                <FeatureItem
                  icon={<Banknote className="w-5 h-5 text-green-400" />}
                  title="Budget Analysis"
                  description="Realistic cost estimates for flights, hotels, and activities"
                />
                <FeatureItem
                  icon={<ShieldCheck className="w-5 h-5 text-rose-400" />}
                  title="Safety Assessment"
                  description="Real-time safety data and travel advisories"
                />
              </div>

              <Link href="/create">
                <Button size="lg" className="mt-8 rounded-full bg-primary hover:bg-primary/90 text-white">
                  Try It Free <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/20">
                <img
                  src="https://images.pexels.com/photos/3278215/pexels-photo-3278215.jpeg?auto=compress&cs=tinysrgb&w=1200"
                  alt="Travel planning"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="absolute bottom-6 left-6 right-6 bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-sm">Trip Score</p>
                      <p className="text-2xl font-bold text-white">92/100</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <span className="text-green-400 text-sm font-medium">Good to Go!</span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section with Live Background */}
      <section className="relative py-24 overflow-hidden">
        {/* Same cycling background as hero */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentMedia.id + '-cta'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
              className="absolute inset-0"
            >
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: 1.1 }}
                transition={{ duration: 8, ease: "linear" }}
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${currentMedia.url})` }}
              />
            </motion.div>
          </AnimatePresence>

          {/* Gradient overlay - blend from top (solid) to visible background to bottom (solid) */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-black/40 to-slate-950" />
        </div>

        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
              Ready to plan your next adventure?
            </h2>
            <p className="text-lg text-white/60 mb-10">
              Join thousands of travelers who plan smarter with VoyageAI
            </p>
            <Link href="/create">
              <Button size="lg" className="text-lg px-10 h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/30 text-white hover:bg-white/25 shadow-xl">
                Start Planning — It's Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <NewsletterCapture variant="card" source="homepage" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/10 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold font-display">
                V
              </div>
              <span className="font-display font-semibold text-white">VoyageAI</span>
            </div>
            <p className="text-white/40 text-sm">© 2024 VoyageAI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StepCard({ number, icon, title, description, delay }: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="relative p-8 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
    >
      <div className="absolute -top-4 -left-2 text-6xl font-display font-bold text-white/5">
        {number}
      </div>
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary mb-6">
          {icon}
        </div>
        <h3 className="text-xl font-display font-bold text-white mb-3">{title}</h3>
        <p className="text-white/60 leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold text-white mb-1">{title}</h4>
        <p className="text-white/60 text-sm">{description}</p>
      </div>
    </div>
  );
}
