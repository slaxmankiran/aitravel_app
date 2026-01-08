import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import {
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Wallet,
  Clock,
  Star,
  Heart,
  ChevronRight,
  Plane,
  Sun,
  Snowflake,
  Mountain,
  Palmtree,
  Building,
  Camera,
  Utensils
} from "lucide-react";
import { useState } from "react";

// Curated trip ideas/templates
const TRIP_TEMPLATES = [
  {
    id: 1,
    title: "Cherry Blossom Japan",
    tagline: "Experience sakura season",
    destinations: ["Tokyo", "Kyoto", "Osaka"],
    duration: "10 days",
    bestTime: "Late March - Early April",
    budget: "$3,500",
    style: "Cultural",
    image: "https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Ueno Park cherry blossoms", "Fushimi Inari Shrine", "Osaka street food"],
    rating: 4.9,
    reviews: 2847,
    category: "seasonal",
  },
  {
    id: 2,
    title: "Italian Romance",
    tagline: "La dolce vita awaits",
    destinations: ["Rome", "Florence", "Venice", "Amalfi Coast"],
    duration: "14 days",
    bestTime: "May - September",
    budget: "$4,200",
    style: "Romantic",
    image: "https://images.pexels.com/photos/1797161/pexels-photo-1797161.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Colosseum at sunset", "Uffizi Gallery", "Gondola ride", "Positano views"],
    rating: 4.8,
    reviews: 3156,
    category: "romantic",
  },
  {
    id: 3,
    title: "Southeast Asia Explorer",
    tagline: "Temples, beaches & street food",
    destinations: ["Bangkok", "Chiang Mai", "Bali", "Singapore"],
    duration: "21 days",
    bestTime: "November - February",
    budget: "$2,800",
    style: "Adventure",
    image: "https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Grand Palace", "Elephant sanctuary", "Ubud rice terraces", "Marina Bay"],
    rating: 4.9,
    reviews: 4521,
    category: "adventure",
  },
  {
    id: 4,
    title: "Greek Island Hopping",
    tagline: "Sun, sea & ancient history",
    destinations: ["Athens", "Santorini", "Mykonos", "Crete"],
    duration: "12 days",
    bestTime: "June - September",
    budget: "$3,800",
    style: "Beach & Culture",
    image: "https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Acropolis", "Oia sunset", "Beach clubs", "Knossos Palace"],
    rating: 4.8,
    reviews: 2934,
    category: "beach",
  },
  {
    id: 5,
    title: "Northern Lights Quest",
    tagline: "Chase the aurora borealis",
    destinations: ["Reykjavik", "Tromso", "Rovaniemi"],
    duration: "8 days",
    bestTime: "September - March",
    budget: "$4,500",
    style: "Adventure",
    image: "https://images.pexels.com/photos/1933239/pexels-photo-1933239.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Golden Circle", "Dog sledding", "Ice hotels", "Northern Lights"],
    rating: 4.9,
    reviews: 1876,
    category: "seasonal",
  },
  {
    id: 6,
    title: "Dubai Luxury Escape",
    tagline: "Opulence in the desert",
    destinations: ["Dubai", "Abu Dhabi"],
    duration: "7 days",
    bestTime: "November - March",
    budget: "$5,500",
    style: "Luxury",
    image: "https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Burj Khalifa", "Desert safari", "Palm Jumeirah", "Sheikh Zayed Mosque"],
    rating: 4.7,
    reviews: 2145,
    category: "luxury",
  },
  {
    id: 7,
    title: "New Zealand Adventure",
    tagline: "Middle Earth awaits",
    destinations: ["Auckland", "Queenstown", "Rotorua", "Milford Sound"],
    duration: "14 days",
    bestTime: "December - February",
    budget: "$4,800",
    style: "Adventure",
    image: "https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Hobbiton", "Bungee jumping", "Geothermal pools", "Fjord cruise"],
    rating: 4.9,
    reviews: 1654,
    category: "adventure",
  },
  {
    id: 8,
    title: "Paris & French Riviera",
    tagline: "Art, fashion & Mediterranean sun",
    destinations: ["Paris", "Nice", "Monaco", "Cannes"],
    duration: "10 days",
    bestTime: "May - October",
    budget: "$4,000",
    style: "Romantic",
    image: "https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Eiffel Tower", "Louvre Museum", "Promenade des Anglais", "Monte Carlo Casino"],
    rating: 4.8,
    reviews: 3678,
    category: "romantic",
  },
  {
    id: 9,
    title: "Morocco Discovery",
    tagline: "Colors of the Maghreb",
    destinations: ["Marrakech", "Fes", "Sahara Desert", "Chefchaouen"],
    duration: "9 days",
    bestTime: "March - May, September - November",
    budget: "$2,200",
    style: "Cultural",
    image: "https://images.pexels.com/photos/3889843/pexels-photo-3889843.jpeg?auto=compress&cs=tinysrgb&w=800",
    highlights: ["Jemaa el-Fnaa", "Medina exploration", "Desert camping", "Blue city"],
    rating: 4.7,
    reviews: 1987,
    category: "cultural",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Ideas", icon: Sparkles },
  { id: "romantic", label: "Romantic", icon: Heart },
  { id: "adventure", label: "Adventure", icon: Mountain },
  { id: "beach", label: "Beach", icon: Palmtree },
  { id: "cultural", label: "Cultural", icon: Camera },
  { id: "luxury", label: "Luxury", icon: Star },
  { id: "seasonal", label: "Seasonal", icon: Snowflake },
];

export default function Inspiration() {
  const [, setLocation] = useLocation();
  const [activeCategory, setActiveCategory] = useState("all");
  const [savedTemplates, setSavedTemplates] = useState<Set<number>>(new Set());

  const filteredTemplates = activeCategory === "all"
    ? TRIP_TEMPLATES
    : TRIP_TEMPLATES.filter(t => t.category === activeCategory);

  const handleUseTemplate = (template: typeof TRIP_TEMPLATES[0]) => {
    const destinations = template.destinations.join(" → ");
    setLocation(`/chat?template=${template.id}&destinations=${encodeURIComponent(destinations)}`);
  };

  const toggleSave = (id: number) => {
    setSavedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <main className="flex-1 md:ml-[240px]">
        {/* Hero Header */}
        <header className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative px-8 py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-6 h-6" />
                <span className="text-white/80 font-medium">Curated by VoyageAI</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
                Get inspired
              </h1>
              <p className="text-xl text-white/80">
                Discover expertly crafted trip ideas. Pick one and customize it to make it yours.
              </p>
            </motion.div>
          </div>

          {/* Category Pills */}
          <div className="relative px-8 pb-6 flex gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all ${
                  activeCategory === category.id
                    ? 'bg-white text-slate-900'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <category.icon className="w-4 h-4" />
                {category.label}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
                {/* Image */}
                <div className="relative h-56">
                  <img
                    src={template.image}
                    alt={template.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Save Button */}
                  <button
                    onClick={() => toggleSave(template.id)}
                    className={`absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      savedTemplates.has(template.id)
                        ? 'bg-rose-500 text-white'
                        : 'bg-white/90 text-slate-600 hover:bg-white'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${savedTemplates.has(template.id) ? 'fill-current' : ''}`} />
                  </button>

                  {/* Rating Badge */}
                  <div className="absolute top-4 left-4 flex items-center gap-1 bg-white/90 rounded-full px-2 py-1">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-sm font-semibold text-slate-700">{template.rating}</span>
                    <span className="text-xs text-slate-500">({template.reviews.toLocaleString()})</span>
                  </div>

                  {/* Title Overlay */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white/70 text-sm mb-1">{template.tagline}</p>
                    <h3 className="text-xl font-display font-bold text-white">{template.title}</h3>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {/* Destinations */}
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                    <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span className="truncate">{template.destinations.join(" → ")}</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="text-center p-2 bg-slate-50 rounded-xl">
                      <Clock className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                      <p className="text-xs text-slate-500">Duration</p>
                      <p className="text-sm font-semibold text-slate-700">{template.duration}</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-xl">
                      <Wallet className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                      <p className="text-xs text-slate-500">From</p>
                      <p className="text-sm font-semibold text-slate-700">{template.budget}</p>
                    </div>
                    <div className="text-center p-2 bg-slate-50 rounded-xl">
                      <Sun className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                      <p className="text-xs text-slate-500">Style</p>
                      <p className="text-sm font-semibold text-slate-700">{template.style}</p>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">Highlights</p>
                    <div className="flex flex-wrap gap-1">
                      {template.highlights.slice(0, 3).map((highlight, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-full"
                        >
                          {highlight}
                        </span>
                      ))}
                      {template.highlights.length > 3 && (
                        <span className="px-2 py-1 bg-slate-100 text-slate-500 text-xs rounded-full">
                          +{template.highlights.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Best Time */}
                  <p className="text-xs text-slate-500 mb-4">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Best time: {template.bestTime}
                  </p>

                  {/* CTA */}
                  <Button
                    onClick={() => handleUseTemplate(template)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
                  >
                    Use This Template
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900 mb-2">
                No trips in this category yet
              </h3>
              <p className="text-slate-500">
                Check back soon for more inspiration!
              </p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
