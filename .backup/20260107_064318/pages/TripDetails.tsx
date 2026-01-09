import { useParams, Link } from "wouter";
import { useTrip } from "@/hooks/use-trips";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Download, Share2, Check, MapPin, Calendar, Users, Wallet, Plane, FileText, Map as MapIcon, DollarSign, ClipboardList, ChevronRight, CheckCircle, AlertTriangle, XCircle, TrendingUp, TrendingDown, Navigation, Globe, Hotel, Sparkles, CircleCheck, Pencil, ShoppingCart, ExternalLink, Train, Bus, Car, Clock, Zap } from "lucide-react";
import { FeasibilityReportView } from "@/components/FeasibilityReport";
import { ItineraryTimeline } from "@/components/ItineraryTimeline";
import { ItineraryMap } from "@/components/ItineraryMap";
import { CostBreakdown } from "@/components/CostBreakdown";
import { BookNow } from "@/components/BookNow";
import { TripChat } from "@/components/TripChat";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Progress step icons
const PROGRESS_ICONS = [
  { icon: Globe, label: "Starting" },
  { icon: FileText, label: "Feasibility" },
  { icon: Train, label: "Transport" },  // Changed from Plane/Flights
  { icon: Hotel, label: "Hotels" },
  { icon: ClipboardList, label: "Itinerary" },
  { icon: Sparkles, label: "Finalizing" },
  { icon: CircleCheck, label: "Complete" },
];

// Hook to fetch progress
function useTripProgress(tripId: number, isProcessing: boolean) {
  return useQuery({
    queryKey: ['trip-progress', tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/progress`);
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    enabled: isProcessing && !!tripId,
    refetchInterval: isProcessing ? 500 : false, // Poll every 500ms while processing
  });
}

// Currency symbol mapping - supports all 28 currencies
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', KRW: '₩', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  MXN: '$', BRL: 'R$', AED: 'د.إ', SAR: '﷼', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
};

function getCurrencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[currency || 'USD'] || currency || '$';
}

// Curated high-quality Pexels images for destinations
const DESTINATION_IMAGES: Record<string, string> = {
  // Asia & Pacific
  'tokyo': 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'japan': 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'kyoto': 'https://images.pexels.com/photos/1440476/pexels-photo-1440476.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'osaka': 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'seoul': 'https://images.pexels.com/photos/237211/pexels-photo-237211.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'korea': 'https://images.pexels.com/photos/237211/pexels-photo-237211.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'bangkok': 'https://images.pexels.com/photos/1031659/pexels-photo-1031659.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'thailand': 'https://images.pexels.com/photos/1682748/pexels-photo-1682748.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'phuket': 'https://images.pexels.com/photos/1430672/pexels-photo-1430672.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'singapore': 'https://images.pexels.com/photos/777059/pexels-photo-777059.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'bali': 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'indonesia': 'https://images.pexels.com/photos/2166559/pexels-photo-2166559.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'vietnam': 'https://images.pexels.com/photos/2835436/pexels-photo-2835436.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'hanoi': 'https://images.pexels.com/photos/2835436/pexels-photo-2835436.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'ho chi minh': 'https://images.pexels.com/photos/2835436/pexels-photo-2835436.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'kuala lumpur': 'https://images.pexels.com/photos/22804/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=1920',
  'malaysia': 'https://images.pexels.com/photos/22804/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=1920',
  'hong kong': 'https://images.pexels.com/photos/1738986/pexels-photo-1738986.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'manila': 'https://images.pexels.com/photos/2850347/pexels-photo-2850347.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'philippines': 'https://images.pexels.com/photos/2850347/pexels-photo-2850347.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'india': 'https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'delhi': 'https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'mumbai': 'https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'jaipur': 'https://images.pexels.com/photos/3581364/pexels-photo-3581364.jpeg?auto=compress&cs=tinysrgb&w=1920',

  // Oceania - New Zealand & Australia
  'wellington': 'https://images.pexels.com/photos/5169056/pexels-photo-5169056.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'auckland': 'https://images.pexels.com/photos/5169050/pexels-photo-5169050.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'new zealand': 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'queenstown': 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'sydney': 'https://images.pexels.com/photos/995764/pexels-photo-995764.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'melbourne': 'https://images.pexels.com/photos/1968631/pexels-photo-1968631.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'australia': 'https://images.pexels.com/photos/2193300/pexels-photo-2193300.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'brisbane': 'https://images.pexels.com/photos/2193300/pexels-photo-2193300.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'perth': 'https://images.pexels.com/photos/2193300/pexels-photo-2193300.jpeg?auto=compress&cs=tinysrgb&w=1920',

  // Europe
  'paris': 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'france': 'https://images.pexels.com/photos/699466/pexels-photo-699466.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'nice': 'https://images.pexels.com/photos/699466/pexels-photo-699466.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'london': 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'uk': 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'edinburgh': 'https://images.pexels.com/photos/5006822/pexels-photo-5006822.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'scotland': 'https://images.pexels.com/photos/5006822/pexels-photo-5006822.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'rome': 'https://images.pexels.com/photos/532263/pexels-photo-532263.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'italy': 'https://images.pexels.com/photos/1701595/pexels-photo-1701595.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'venice': 'https://images.pexels.com/photos/1796715/pexels-photo-1796715.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'florence': 'https://images.pexels.com/photos/2422461/pexels-photo-2422461.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'milan': 'https://images.pexels.com/photos/1701595/pexels-photo-1701595.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'barcelona': 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'spain': 'https://images.pexels.com/photos/3757144/pexels-photo-3757144.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'madrid': 'https://images.pexels.com/photos/3757144/pexels-photo-3757144.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'berlin': 'https://images.pexels.com/photos/109629/pexels-photo-109629.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'germany': 'https://images.pexels.com/photos/109629/pexels-photo-109629.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'munich': 'https://images.pexels.com/photos/109629/pexels-photo-109629.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'amsterdam': 'https://images.pexels.com/photos/2031706/pexels-photo-2031706.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'netherlands': 'https://images.pexels.com/photos/2031706/pexels-photo-2031706.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'prague': 'https://images.pexels.com/photos/2346216/pexels-photo-2346216.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'czech': 'https://images.pexels.com/photos/2346216/pexels-photo-2346216.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'vienna': 'https://images.pexels.com/photos/2351425/pexels-photo-2351425.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'austria': 'https://images.pexels.com/photos/2351425/pexels-photo-2351425.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'budapest': 'https://images.pexels.com/photos/63328/budapest-hungary-tourism-europe-63328.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'hungary': 'https://images.pexels.com/photos/63328/budapest-hungary-tourism-europe-63328.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'lisbon': 'https://images.pexels.com/photos/1534560/pexels-photo-1534560.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'portugal': 'https://images.pexels.com/photos/1534560/pexels-photo-1534560.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'porto': 'https://images.pexels.com/photos/1534560/pexels-photo-1534560.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'switzerland': 'https://images.pexels.com/photos/1586298/pexels-photo-1586298.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'zurich': 'https://images.pexels.com/photos/1586298/pexels-photo-1586298.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'geneva': 'https://images.pexels.com/photos/1586298/pexels-photo-1586298.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'greece': 'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'athens': 'https://images.pexels.com/photos/772689/pexels-photo-772689.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'santorini': 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'mykonos': 'https://images.pexels.com/photos/1010657/pexels-photo-1010657.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'istanbul': 'https://images.pexels.com/photos/3889704/pexels-photo-3889704.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'turkey': 'https://images.pexels.com/photos/3889704/pexels-photo-3889704.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'copenhagen': 'https://images.pexels.com/photos/2563683/pexels-photo-2563683.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'denmark': 'https://images.pexels.com/photos/2563683/pexels-photo-2563683.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'stockholm': 'https://images.pexels.com/photos/3274978/pexels-photo-3274978.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'sweden': 'https://images.pexels.com/photos/3274978/pexels-photo-3274978.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'oslo': 'https://images.pexels.com/photos/1559821/pexels-photo-1559821.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'norway': 'https://images.pexels.com/photos/1559821/pexels-photo-1559821.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'reykjavik': 'https://images.pexels.com/photos/2563681/pexels-photo-2563681.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'iceland': 'https://images.pexels.com/photos/2563681/pexels-photo-2563681.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'dublin': 'https://images.pexels.com/photos/2416653/pexels-photo-2416653.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'ireland': 'https://images.pexels.com/photos/2416653/pexels-photo-2416653.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'brussels': 'https://images.pexels.com/photos/2587166/pexels-photo-2587166.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'belgium': 'https://images.pexels.com/photos/2587166/pexels-photo-2587166.jpeg?auto=compress&cs=tinysrgb&w=1920',

  // Americas
  'new york': 'https://images.pexels.com/photos/802024/pexels-photo-802024.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'los angeles': 'https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'san francisco': 'https://images.pexels.com/photos/1006965/pexels-photo-1006965.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'las vegas': 'https://images.pexels.com/photos/415999/pexels-photo-415999.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'miami': 'https://images.pexels.com/photos/421655/pexels-photo-421655.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'chicago': 'https://images.pexels.com/photos/1823681/pexels-photo-1823681.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'seattle': 'https://images.pexels.com/photos/2539665/pexels-photo-2539665.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'hawaii': 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'honolulu': 'https://images.pexels.com/photos/3601425/pexels-photo-3601425.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'canada': 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'toronto': 'https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'vancouver': 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'montreal': 'https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'mexico': 'https://images.pexels.com/photos/3290068/pexels-photo-3290068.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'cancun': 'https://images.pexels.com/photos/3290068/pexels-photo-3290068.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'mexico city': 'https://images.pexels.com/photos/3290068/pexels-photo-3290068.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'rio': 'https://images.pexels.com/photos/1008155/pexels-photo-1008155.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'brazil': 'https://images.pexels.com/photos/1008155/pexels-photo-1008155.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'buenos aires': 'https://images.pexels.com/photos/1060803/pexels-photo-1060803.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'argentina': 'https://images.pexels.com/photos/1060803/pexels-photo-1060803.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'lima': 'https://images.pexels.com/photos/2929906/pexels-photo-2929906.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'peru': 'https://images.pexels.com/photos/2929906/pexels-photo-2929906.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'bogota': 'https://images.pexels.com/photos/2929906/pexels-photo-2929906.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'colombia': 'https://images.pexels.com/photos/2929906/pexels-photo-2929906.jpeg?auto=compress&cs=tinysrgb&w=1920',

  // Middle East & Africa
  'dubai': 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'abu dhabi': 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'uae': 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'doha': 'https://images.pexels.com/photos/3551203/pexels-photo-3551203.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'qatar': 'https://images.pexels.com/photos/3551203/pexels-photo-3551203.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'tel aviv': 'https://images.pexels.com/photos/3355379/pexels-photo-3355379.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'israel': 'https://images.pexels.com/photos/3355379/pexels-photo-3355379.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'jerusalem': 'https://images.pexels.com/photos/3355379/pexels-photo-3355379.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'cairo': 'https://images.pexels.com/photos/3243027/pexels-photo-3243027.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'egypt': 'https://images.pexels.com/photos/3243027/pexels-photo-3243027.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'marrakech': 'https://images.pexels.com/photos/3889891/pexels-photo-3889891.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'morocco': 'https://images.pexels.com/photos/3889891/pexels-photo-3889891.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'cape town': 'https://images.pexels.com/photos/963713/pexels-photo-963713.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'south africa': 'https://images.pexels.com/photos/963713/pexels-photo-963713.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'johannesburg': 'https://images.pexels.com/photos/963713/pexels-photo-963713.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'nairobi': 'https://images.pexels.com/photos/3889742/pexels-photo-3889742.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'kenya': 'https://images.pexels.com/photos/3889742/pexels-photo-3889742.jpeg?auto=compress&cs=tinysrgb&w=1920',

  // Island destinations
  'maldives': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'fiji': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'mauritius': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=1920',
  'seychelles': 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=1920',

  'default': 'https://images.pexels.com/photos/3155666/pexels-photo-3155666.jpeg?auto=compress&cs=tinysrgb&w=1920',
};

// Category fallback images for unknown destinations - provides variety without API calls
const CATEGORY_FALLBACKS: Record<string, string> = {
  beach: 'https://images.pexels.com/photos/1287460/pexels-photo-1287460.jpeg?auto=compress&cs=tinysrgb&w=1920',
  tropical: 'https://images.pexels.com/photos/1682748/pexels-photo-1682748.jpeg?auto=compress&cs=tinysrgb&w=1920',
  mountain: 'https://images.pexels.com/photos/1659438/pexels-photo-1659438.jpeg?auto=compress&cs=tinysrgb&w=1920',
  city: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=1920',
  european: 'https://images.pexels.com/photos/2082103/pexels-photo-2082103.jpeg?auto=compress&cs=tinysrgb&w=1920',
  asian: 'https://images.pexels.com/photos/2506923/pexels-photo-2506923.jpeg?auto=compress&cs=tinysrgb&w=1920',
  desert: 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg?auto=compress&cs=tinysrgb&w=1920',
  island: 'https://images.pexels.com/photos/1430672/pexels-photo-1430672.jpeg?auto=compress&cs=tinysrgb&w=1920',
  africa: 'https://images.pexels.com/photos/3889742/pexels-photo-3889742.jpeg?auto=compress&cs=tinysrgb&w=1920',
  americas: 'https://images.pexels.com/photos/802024/pexels-photo-802024.jpeg?auto=compress&cs=tinysrgb&w=1920',
};

// Keywords for categorizing unknown destinations
// Note: Order matters! More specific categories should come first
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // Mountain destinations (check first - Nepal, Bhutan are Himalayan, not generic "Asian")
  mountain: ['mountain', 'alps', 'himalaya', 'andes', 'rockies', 'peak', 'summit', 'ski', 'highland', 'valley',
             'nepal', 'kathmandu', 'pokhara', 'bhutan', 'thimphu', 'tibet', 'lhasa', 'everest', 'annapurna'],
  beach: ['beach', 'coast', 'bay', 'cove', 'playa', 'praia', 'shore', 'seaside', 'reef'],
  tropical: ['tropical', 'caribbean', 'pacific', 'tahiti', 'polynesia', 'bahamas', 'jamaica', 'aruba', 'curacao', 'palm'],
  island: ['island', 'isle', 'archipelago', 'atoll', 'cay', 'key', 'maldives', 'fiji', 'bora bora'],
  european: ['europe', 'poland', 'croatia', 'romania', 'bulgaria', 'serbia', 'ukraine', 'baltic', 'slovakia', 'slovenia'],
  asian: ['china', 'taiwan', 'cambodia', 'laos', 'myanmar', 'sri lanka', 'bangladesh', 'mongolia', 'vietnam', 'hanoi'],
  desert: ['desert', 'sahara', 'arabia', 'oman', 'jordan', 'petra', 'bedouin', 'sand', 'dune'],
  africa: ['africa', 'tanzania', 'uganda', 'rwanda', 'ethiopia', 'ghana', 'senegal', 'safari', 'serengeti', 'zanzibar'],
  americas: ['america', 'caribbean', 'costa rica', 'panama', 'chile', 'ecuador', 'bolivia', 'paraguay', 'uruguay', 'cuba'],
};

/**
 * Smart destination image lookup with category-based fallbacks
 * Priority: Exact match → Partial match → Category fallback → Default
 */
function getDestinationImage(destination: string): string {
  const destLower = destination.toLowerCase();

  // 1. FAST PATH: Check hardcoded images (instant, ~100 popular destinations)
  for (const [key, url] of Object.entries(DESTINATION_IMAGES)) {
    if (key !== 'default' && destLower.includes(key)) return url;
  }

  // 2. SMART FALLBACK: Categorize the destination and use appropriate fallback
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => destLower.includes(keyword))) {
      return CATEGORY_FALLBACKS[category];
    }
  }

  // 3. DEFAULT: Beautiful generic travel image
  return DESTINATION_IMAGES['default'];
}

/**
 * AI-Powered Dynamic Destination Image Hook
 * Uses AI to suggest the most iconic landmark for each destination
 * Priority: Local hardcoded (for speed) → AI-powered Unsplash (for accuracy)
 */
function useDynamicDestinationImage(destination: string | undefined) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [landmark, setLandmark] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!destination) return;

    // Don't show local image first - wait for AI to provide the correct one
    // This prevents the "flash" of wrong image before the AI image loads
    setIsLoading(true);
    setImageUrl(null);

    // Fetch AI-suggested landmark image for the destination
    fetch(`/api/destination-image?destination=${encodeURIComponent(destination)}`)
      .then(res => res.json())
      .then(data => {
        if (data.imageUrl) {
          // AI found a relevant image - use it!
          setImageUrl(data.imageUrl);
          setLandmark(data.landmark || '');
          console.log(`[AI Image] ${destination} → ${data.landmark}: ${data.searchTerm}`);
        } else {
          // Fallback to local image only if AI returns nothing
          const localImage = getDestinationImage(destination);
          setImageUrl(localImage);
        }
      })
      .catch(err => {
        console.log('AI image fetch failed, using local fallback:', err);
        // Fallback to local hardcoded image
        const localImage = getDestinationImage(destination);
        setImageUrl(localImage);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [destination]);

  return {
    imageUrl: imageUrl || DESTINATION_IMAGES['default'],
    landmark,
    isLoading
  };
}

type SectionType = 'analysis' | 'map' | 'budget' | 'itinerary' | 'booking' | null;

// Animated background with floating travel icons
function AnimatedBackground() {
  const icons = [
    { icon: Plane, delay: 0, x: 10, y: 20 },
    { icon: Globe, delay: 1, x: 85, y: 15 },
    { icon: MapPin, delay: 0.5, x: 70, y: 75 },
    { icon: Calendar, delay: 1.5, x: 15, y: 80 },
    { icon: Wallet, delay: 2, x: 50, y: 10 },
    { icon: Hotel, delay: 0.8, x: 25, y: 50 },
    { icon: Sparkles, delay: 1.2, x: 80, y: 45 },
    { icon: Navigation, delay: 1.8, x: 40, y: 85 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated gradient overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-emerald-500/10"
        animate={{
          opacity: [0.3, 0.5, 0.3],
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* Floating icons */}
      {icons.map((item, idx) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={idx}
            className="absolute"
            style={{ left: `${item.x}%`, top: `${item.y}%` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: [0.15, 0.3, 0.15],
              y: [-20, 20, -20],
              rotate: [-10, 10, -10],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 6 + idx * 0.5,
              delay: item.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Icon className="w-8 h-8 md:w-12 md:h-12 text-white/20" />
          </motion.div>
        );
      })}

      {/* Traveling plane animation */}
      <motion.div
        className="absolute"
        initial={{ left: '-10%', top: '30%' }}
        animate={{ left: '110%', top: '25%' }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 3,
        }}
      >
        <Plane className="w-6 h-6 text-white/30 transform -rotate-12" />
      </motion.div>

      {/* Second plane going opposite direction */}
      <motion.div
        className="absolute"
        initial={{ right: '-10%', top: '60%' }}
        animate={{ right: '110%', top: '55%' }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "linear",
          delay: 5,
          repeatDelay: 4,
        }}
      >
        <Plane className="w-5 h-5 text-white/20 transform rotate-[168deg]" />
      </motion.div>

      {/* Pulsing circles */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
          style={{ width: 100 + i * 100, height: 100 + i * 100 }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 4,
            delay: i * 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Travel tips that rotate while waiting
const TRAVEL_TIPS = [
  "Pack a portable charger - you'll thank yourself later!",
  "Take photos of your passport and travel documents",
  "Learn a few phrases in the local language",
  "Book popular attractions in advance to skip lines",
  "Try local street food for authentic experiences",
  "Keep copies of important documents in your email",
  "Download offline maps before you go",
  "Check visa requirements at least 3 months ahead",
  "Travel insurance can save you thousands",
  "Early morning is the best time for tourist spots",
];

// Progress indicator component
function ProgressIndicator({ step, message, details, elapsed, percentComplete }: {
  step: number;
  message: string;
  details?: string;
  elapsed: number;
  percentComplete: number;
}) {
  // Rotate travel tips every 5 seconds
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TRAVEL_TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 text-center border border-white/20 relative z-10">
      {/* Modern compact step indicators */}
      <div className="flex justify-center items-center gap-1 mb-5">
        {PROGRESS_ICONS.slice(0, 6).map((item, idx) => {
          const Icon = item.icon;
          const isActive = idx === step;
          const isComplete = idx < step;
          return (
            <motion.div
              key={idx}
              className="flex items-center"
              initial={{ opacity: 0.5 }}
              animate={{ opacity: isComplete || isActive ? 1 : 0.4 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step pill */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all ${
                isComplete ? 'bg-emerald-500/20' :
                isActive ? 'bg-primary/20 ring-2 ring-primary/50' :
                'bg-white/5'
              }`}>
                {isComplete ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-white/40'}`} />
                )}
                <span className={`text-[11px] font-medium hidden sm:inline ${
                  isActive ? 'text-white' : isComplete ? 'text-emerald-300' : 'text-white/40'
                }`}>
                  {item.label}
                </span>
              </div>
              {/* Connector */}
              {idx < 5 && (
                <div className={`w-3 h-0.5 mx-0.5 rounded ${isComplete ? 'bg-emerald-400/50' : 'bg-white/10'}`} />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Animated spinner */}
      <motion.div
        className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-emerald-400/10 flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
      >
        {step < 6 ? (
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        ) : (
          <CircleCheck className="w-8 h-8 text-emerald-400" />
        )}
      </motion.div>

      {/* Progress bar */}
      <div className="w-full max-w-sm mx-auto h-1.5 bg-white/10 rounded-full mb-3 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-blue-400 to-emerald-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentComplete}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Status text */}
      <motion.h2
        key={message}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl font-bold text-white mb-2"
      >
        {message}
      </motion.h2>
      {details && (
        <motion.p
          key={details}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/60 text-sm mb-2"
        >
          {details}
        </motion.p>
      )}
      <p className="text-white/40 text-xs">
        {elapsed > 0 ? `${elapsed}s elapsed` : 'Starting...'} • {percentComplete}% complete
      </p>

      {/* Travel tip */}
      <motion.div
        className="mt-6 pt-6 border-t border-white/10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p className="text-white/40 text-xs mb-2">💡 Travel Tip</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-white/70 text-sm italic"
          >
            "{TRAVEL_TIPS[tipIndex]}"
          </motion.p>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default function TripDetails() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { data: trip, isLoading, error, refetch } = useTrip(Number(id));
  const [copied, setCopied] = useState(false);
  const [highlightedLocation, setHighlightedLocation] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<SectionType>(null);
  const [localItinerary, setLocalItinerary] = useState<any>(null);
  const [localBudgetBreakdown, setLocalBudgetBreakdown] = useState<any>(null);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [updateKey, setUpdateKey] = useState(0); // Force re-render key
  const [showUpdateAnimation, setShowUpdateAnimation] = useState(false); // Animation trigger for updates
  const [selectedTransportMode, setSelectedTransportMode] = useState<string | null>(null); // User-selected transport mode
  const [selectedFoods, setSelectedFoods] = useState<Map<string, any>>(new Map()); // User-selected food spots
  const { toast } = useToast();

  // Only reset local state when navigating to a different trip (id changes)
  // Don't reset when trip data is refetched - we want to keep chat updates
  useEffect(() => {
    setLocalItinerary(null);
    setLocalBudgetBreakdown(null);
  }, [id]);

  // Handle real-time updates from chat assistant
  const handleTripUpdate = useCallback((updatedData: {
    itinerary?: any;
    budgetBreakdown?: any;
    mapMarkers?: any[];
  }) => {
    console.log('[TripDetails] Received update from chat:', updatedData);

    // Immediately update local state for instant UI feedback
    if (updatedData.itinerary) {
      setLocalItinerary(updatedData.itinerary);

      // Prefer costBreakdown from itinerary (has full details including transportOptions)
      // Merge with budgetBreakdown for updated totals
      const itineraryCostBreakdown = updatedData.itinerary?.costBreakdown;
      if (itineraryCostBreakdown) {
        // Merge budget totals from budgetBreakdown with detailed fields from itinerary
        const mergedBreakdown = {
          ...itineraryCostBreakdown,
          ...(updatedData.budgetBreakdown ? {
            totalSpent: updatedData.budgetBreakdown.totalSpent,
            grandTotal: updatedData.budgetBreakdown.grandTotal || updatedData.budgetBreakdown.totalSpent,
            remaining: updatedData.budgetBreakdown.remaining,
            percentUsed: updatedData.budgetBreakdown.percentUsed,
            perPerson: updatedData.budgetBreakdown.perPerson,
            perDay: updatedData.budgetBreakdown.perDay,
            budgetStatus: updatedData.budgetBreakdown.budgetStatus,
          } : {}),
        };
        setLocalBudgetBreakdown(mergedBreakdown);
        console.log('[TripDetails] Updated budget breakdown with merged data:', mergedBreakdown);
      } else if (updatedData.budgetBreakdown) {
        setLocalBudgetBreakdown(updatedData.budgetBreakdown);
      }
    } else if (updatedData.budgetBreakdown) {
      // No itinerary update, just budget breakdown - merge with existing
      setLocalBudgetBreakdown((prev: any) => prev ? { ...prev, ...updatedData.budgetBreakdown } : updatedData.budgetBreakdown);
    }

    // Trigger update animation
    setShowUpdateAnimation(true);
    setTimeout(() => setShowUpdateAnimation(false), 2000); // Animation lasts 2 seconds

    // Force component re-render
    setUpdateKey(prev => prev + 1);

    // Invalidate and refetch the trip query to sync with server
    queryClient.invalidateQueries({ queryKey: ['/api/trips/:id', Number(id)] });
    refetch();
  }, [refetch, queryClient, id]);

  // Check if trip is still being processed
  const isProcessing = trip?.feasibilityStatus === 'pending' ||
    (trip?.feasibilityStatus === 'yes' && !trip?.itinerary) ||
    (trip?.feasibilityStatus === 'warning' && !trip?.itinerary);

  // Fetch progress while processing
  const { data: progress } = useTripProgress(Number(id), isProcessing);

  const handleLocationSelect = useCallback((locationId: string) => {
    setHighlightedLocation(locationId);
    // Map is now side-by-side with itinerary, no need to switch sections
    // The highlighted location will automatically zoom/highlight on the map
  }, []);

  // Handle user food selection - adds meal to itinerary and updates budget
  const handleFoodSelect = useCallback((day: number, food: any) => {
    const key = `${day}-${food.meal}`;

    setSelectedFoods(prev => {
      const newMap = new Map(prev);
      if (newMap.has(key) && newMap.get(key)?.name === food.name) {
        // Deselect if same food is clicked again
        newMap.delete(key);
        toast({
          title: "Meal removed",
          description: `${food.name} removed from Day ${day}`,
        });
      } else {
        // Select new food
        newMap.set(key, food);
        toast({
          title: "Meal added!",
          description: `${food.name} added to Day ${day} ${food.meal}`,
        });
      }
      return newMap;
    });

    // Trigger animation
    setShowUpdateAnimation(true);
    setTimeout(() => setShowUpdateAnimation(false), 2000);
    setUpdateKey(prev => prev + 1);
  }, [toast]);

  // Handle user transport mode selection - recalculates budget AND updates itinerary
  const handleTransportSelect = useCallback((selectedOption: any) => {
    // Compute current state inside callback
    const currentItinerary = localItinerary || trip?.itinerary as any;
    const currentCostBreakdown = localBudgetBreakdown || currentItinerary?.costBreakdown;

    if (!currentCostBreakdown?.transportOptions?.options) return;

    const transportOptions = currentCostBreakdown.transportOptions.options;
    const selectedMode = selectedOption.mode;
    const selectedCost = selectedOption.estimatedCost;
    const selectedDuration = selectedOption.duration;

    // Determine the arrival/departure point based on transport mode
    const getTransportHub = (mode: string, destination: string) => {
      const city = destination?.split(',')[0]?.trim() || destination;
      const baseMode = mode.toLowerCase().replace(/[^a-z]/g, '');

      if (baseMode.includes('train') || baseMode.includes('rail')) {
        return {
          type: 'Railway Station',
          name: `${city} Railway Station`,
          // Common railway station coordinates for major Indian cities
          getCoords: () => {
            const stationCoords: Record<string, { lat: number; lng: number }> = {
              'vijayawada': { lat: 16.5175, lng: 80.6167 },
              'mumbai': { lat: 18.9402, lng: 72.8356 }, // CST
              'delhi': { lat: 28.6421, lng: 77.2190 }, // New Delhi
              'chennai': { lat: 13.0827, lng: 80.2707 },
              'kolkata': { lat: 22.5551, lng: 88.3512 }, // Howrah
              'bangalore': { lat: 12.9778, lng: 77.5713 },
              'hyderabad': { lat: 17.4319, lng: 78.5016 },
              'goa': { lat: 15.2713, lng: 73.9572 }, // Madgaon
              'tirupati': { lat: 13.6328, lng: 79.4192 },
              'lucknow': { lat: 26.8310, lng: 80.9163 },
              'jaipur': { lat: 26.9202, lng: 75.7873 },
              'hampi': { lat: 15.3317, lng: 76.4614 }, // Hospet
              'agra': { lat: 27.1883, lng: 78.0049 },
            };
            const cityLower = city.toLowerCase();
            return stationCoords[cityLower] || null;
          }
        };
      } else if (baseMode.includes('bus')) {
        return {
          type: 'Bus Station',
          name: `${city} Bus Stand`,
          getCoords: () => {
            const busCoords: Record<string, { lat: number; lng: number }> = {
              'vijayawada': { lat: 16.5065, lng: 80.6462 },
              'mumbai': { lat: 19.0176, lng: 72.8562 },
              'delhi': { lat: 28.6328, lng: 77.2205 }, // ISBT
              'goa': { lat: 15.4989, lng: 73.8278 }, // Panaji
              'tirupati': { lat: 13.6356, lng: 79.4236 },
              'hampi': { lat: 15.3350, lng: 76.4600 },
            };
            const cityLower = city.toLowerCase();
            return busCoords[cityLower] || null;
          }
        };
      } else if (baseMode.includes('cab') || baseMode.includes('ola') || baseMode.includes('taxi')) {
        return {
          type: 'Pickup Point',
          name: `${city} City Center`,
          getCoords: () => null
        };
      }
      // Default to airport for flights
      return {
        type: 'Airport',
        name: `${city} Airport`,
        getCoords: () => null
      };
    };

    const destinationHub = getTransportHub(selectedMode, trip?.destination || '');
    const originHub = getTransportHub(selectedMode, trip?.origin || '');

    // Calculate the difference between current transport and new transport
    const currentTransportCost = currentCostBreakdown.flights?.total || 0;
    const costDifference = selectedCost - currentTransportCost;

    // Update transport options to mark selected one
    const updatedTransportOptions = transportOptions.map((opt: any) => ({
      ...opt,
      selected: opt.mode === selectedMode,
      recommended: false, // Clear recommended when user makes manual selection
    }));

    // Update itinerary activities to reflect new transport mode
    let updatedDays = currentItinerary?.days || [];
    let removedTransferCost = 0; // Track removed airport transfer costs

    if (updatedDays.length > 0) {
      updatedDays = updatedDays.map((day: any, dayIdx: number) => {
        const updatedActivities = day.activities?.map((activity: any) => {
          const activityLower = (activity.name || '').toLowerCase();
          const locationLower = (activity.location || '').toLowerCase();

          // Check if this is an arrival/departure activity that needs updating
          const isArrival = activityLower.includes('arrive') || activityLower.includes('arrival');
          const isDepart = activityLower.includes('depart') || activityLower.includes('departure');
          const isAirportActivity = activityLower.includes('airport') || locationLower.includes('airport');

          if ((isArrival || isDepart) && isAirportActivity) {
            const hub = isArrival ? destinationHub : originHub;
            const hubCoords = hub.getCoords();

            // If switching away from flight, remove airport transfer cost (typically ₹180-500)
            const oldCost = activity.cost || 0;
            if (!selectedMode.toLowerCase().includes('flight') && oldCost > 0) {
              removedTransferCost += oldCost;
            }

            return {
              ...activity,
              name: isArrival ? `Arrive at ${hub.name}` : `Depart from ${hub.name}`,
              location: hub.name,
              // Set cost to 0 for train/bus (no transfer needed), keep for flights
              cost: selectedMode.toLowerCase().includes('flight') ? oldCost : 0,
              coordinates: hubCoords ? hubCoords : activity.coordinates,
            };
          }
          return activity;
        }) || [];

        return { ...day, activities: updatedActivities };
      });
    }

    // Adjust grand total to account for removed transfer costs
    const adjustedCostDifference = costDifference - removedTransferCost;

    // Create updated cost breakdown
    const updatedBreakdown = {
      ...currentCostBreakdown,
      flights: {
        ...currentCostBreakdown.flights,
        total: selectedCost,
        perPerson: Math.round(selectedCost / (trip?.groupSize || 1)),
        airline: selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1),
        duration: selectedDuration,
        note: `${selectedMode.toLowerCase().includes('flight') ? 'Round-trip flights' : selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1) + ' travel'} from ${trip?.origin}`,
        selectedMode: selectedMode,
      },
      transportOptions: {
        ...currentCostBreakdown.transportOptions,
        selectedMode: selectedMode,
        options: updatedTransportOptions,
      },
      grandTotal: (currentCostBreakdown.grandTotal || 0) + adjustedCostDifference,
      perPerson: Math.round(((currentCostBreakdown.grandTotal || 0) + adjustedCostDifference) / (trip?.groupSize || 1)),
    };

    // Update local state
    setSelectedTransportMode(selectedMode);
    setLocalBudgetBreakdown(updatedBreakdown);

    // Update itinerary with new cost breakdown AND updated activities
    if (currentItinerary) {
      const updatedItinerary = {
        ...currentItinerary,
        days: updatedDays,
        costBreakdown: updatedBreakdown,
      };
      setLocalItinerary(updatedItinerary);
    }

    // Show update animation
    setShowUpdateAnimation(true);
    setTimeout(() => setShowUpdateAnimation(false), 2000);
    setUpdateKey(prev => prev + 1);

    // Show toast notification with details about what changed
    const transferNote = removedTransferCost > 0 ? ` (saved ${currentCostBreakdown.currencySymbol}${removedTransferCost} on transfers)` : '';
    toast({
      title: `Transport updated to ${selectedMode}`,
      description: `New estimated total: ${currentCostBreakdown.currencySymbol}${updatedBreakdown.grandTotal.toLocaleString()}${transferNote}`,
    });

  }, [localBudgetBreakdown, trip, localItinerary, toast]);

  // Extract data for preview cards (use local updates for immediate feedback)
  const itineraryData = localItinerary || trip?.itinerary as any;
  const feasibilityReport = trip?.feasibilityReport as any;
  const costBreakdown = localBudgetBreakdown || itineraryData?.costBreakdown;

  const daysCount = itineraryData?.days?.length || 0;
  const activitiesCount = itineraryData?.days?.reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0) || 0;
  const locationsCount = itineraryData?.days?.reduce((sum: number, d: any) =>
    sum + (d.activities?.filter((a: any) => a.coordinates?.lat).length || 0), 0) || 0;

  // Use dynamic hook for destination image - hybrid approach:
  // Instant for popular destinations, API-enhanced for unknown ones
  const { imageUrl: backgroundUrl, isLoading: imageIsLoading } = useDynamicDestinationImage(trip?.destination);

  // Preload background image
  useEffect(() => {
    if (backgroundUrl) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = backgroundUrl;
    }
  }, [backgroundUrl]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Trip to ${trip?.destination}`,
          text: `Check out my trip plan to ${trip?.destination}!`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        toast({ title: "Link copied!", description: "Trip URL copied to clipboard" });
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const handleExport = () => {
    if (!trip) return;
    const exportData = {
      destination: trip.destination,
      dates: trip.dates,
      budget: trip.budget,
      groupSize: trip.groupSize,
      passport: trip.passport,
      feasibilityStatus: trip.feasibilityStatus,
      feasibilityReport: trip.feasibilityReport,
      itinerary: trip.itinerary,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trip-${trip.destination.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${trip.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Exported!", description: "Trip data downloaded as JSON" });
  };

  const handleExportPDF = () => {
    if (!trip) return;

    const itinerary = localItinerary || trip.itinerary as any;
    const breakdown = localBudgetBreakdown || itinerary?.costBreakdown;
    const feasibility = trip.feasibilityReport as any;
    const currencySymbol = breakdown?.currencySymbol || getCurrencySymbol(trip.currency ?? undefined);
    const exportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const daysCount = itinerary?.days?.length || 0;
    const activitiesCount = itinerary?.days?.reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0) || 0;

    // Create professional printable HTML content
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trip to ${trip.destination} - VoyageAI Travel Plan</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a2e; line-height: 1.6; background: #fff; }

          /* Cover Page */
          .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 60px 40px; page-break-after: always; }
          .logo { font-size: 32px; font-weight: 700; letter-spacing: -1px; margin-bottom: 60px; }
          .logo span { background: white; color: #667eea; padding: 8px 16px; border-radius: 12px; margin-right: 10px; }
          .cover h1 { font-size: 48px; font-weight: 700; margin-bottom: 20px; text-shadow: 0 2px 20px rgba(0,0,0,0.2); }
          .cover .subtitle { font-size: 20px; opacity: 0.9; margin-bottom: 40px; }
          .cover-meta { display: flex; gap: 30px; font-size: 16px; opacity: 0.9; }
          .cover-meta span { display: flex; align-items: center; gap: 8px; }
          .cover-footer { margin-top: auto; padding-top: 60px; font-size: 14px; opacity: 0.7; }

          /* Content Pages */
          .content { padding: 50px; }
          .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 2px solid #667eea; }
          .page-header .brand { font-weight: 600; color: #667eea; font-size: 14px; }
          .page-header .page-title { font-size: 12px; color: #888; }

          .section { margin-bottom: 40px; }
          .section-title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
          .section-title::before { content: ''; width: 4px; height: 24px; background: linear-gradient(135deg, #667eea, #764ba2); border-radius: 2px; }

          /* Trip Overview */
          .overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .overview-item { background: linear-gradient(135deg, #f8f9ff 0%, #f0f2ff 100%); padding: 20px; border-radius: 12px; text-align: center; border: 1px solid #e8e8ff; }
          .overview-item .icon { font-size: 24px; margin-bottom: 8px; }
          .overview-item .value { font-size: 24px; font-weight: 700; color: #667eea; }
          .overview-item .label { font-size: 12px; color: #666; margin-top: 4px; }

          /* Budget Section */
          .budget-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
          .budget-card { background: #f8f9fa; padding: 20px; border-radius: 12px; border-left: 4px solid #667eea; }
          .budget-card .label { font-size: 13px; color: #666; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
          .budget-card .amount { font-size: 28px; font-weight: 700; color: #1a1a2e; margin-top: 5px; }
          .budget-card .note { font-size: 12px; color: #888; margin-top: 5px; }
          .budget-total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; text-align: center; margin-top: 20px; }
          .budget-total .label { font-size: 14px; opacity: 0.9; }
          .budget-total .amount { font-size: 36px; font-weight: 700; margin-top: 5px; }
          .budget-total .status { font-size: 14px; margin-top: 10px; padding: 5px 15px; background: rgba(255,255,255,0.2); border-radius: 20px; display: inline-block; }

          /* Itinerary */
          .day-section { margin-bottom: 30px; page-break-inside: avoid; }
          .day-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 20px; border-radius: 12px 12px 0 0; display: flex; justify-content: space-between; align-items: center; }
          .day-header h3 { font-size: 18px; font-weight: 600; }
          .day-header .date { font-size: 14px; opacity: 0.9; }
          .day-activities { background: #f8f9fa; border-radius: 0 0 12px 12px; overflow: hidden; }
          .activity-item { padding: 15px 20px; display: flex; align-items: flex-start; gap: 15px; border-bottom: 1px solid #eee; }
          .activity-item:last-child { border-bottom: none; }
          .activity-time { background: #667eea; color: white; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; min-width: 70px; text-align: center; }
          .activity-details { flex: 1; }
          .activity-name { font-weight: 600; color: #1a1a2e; font-size: 15px; }
          .activity-location { font-size: 13px; color: #666; margin-top: 3px; }
          .activity-cost { font-weight: 700; color: #059669; font-size: 15px; }

          /* Feasibility */
          .feasibility-card { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px; }
          .feasibility-card.warning { background: #fffbeb; border-color: #fde68a; }
          .feasibility-card.danger { background: #fef2f2; border-color: #fecaca; }
          .feasibility-status { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
          .feasibility-summary { font-size: 14px; color: #444; }

          /* Footer */
          .page-footer { text-align: center; padding: 30px; border-top: 1px solid #eee; margin-top: 40px; font-size: 12px; color: #888; }
          .page-footer .brand { color: #667eea; font-weight: 600; }

          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .cover { min-height: auto; padding: 40px; }
          }
        </style>
      </head>
      <body>
        <!-- Cover Page -->
        <div class="cover">
          <div class="logo"><span>V</span>VoyageAI</div>
          <h1>${trip.destination}</h1>
          <p class="subtitle">Your Personalized Travel Plan</p>
          <div class="cover-meta">
            <span>📅 ${trip.dates}</span>
            <span>👥 ${trip.groupSize} Traveler${trip.groupSize > 1 ? 's' : ''}</span>
            <span>🗓️ ${daysCount} Days</span>
            <span>📍 ${activitiesCount} Activities</span>
          </div>
          <div class="cover-footer">
            <p>Generated on ${exportDate}</p>
            <p>AI-Powered Travel Planning by VoyageAI</p>
          </div>
        </div>

        <!-- Trip Overview -->
        <div class="content">
          <div class="page-header">
            <div class="brand">VoyageAI Travel Plan</div>
            <div class="page-title">${trip.destination} • ${trip.dates}</div>
          </div>

          <div class="section">
            <div class="section-title">Trip Overview</div>
            <div class="overview-grid">
              <div class="overview-item">
                <div class="icon">📍</div>
                <div class="value">${trip.destination.split(',')[0]}</div>
                <div class="label">Destination</div>
              </div>
              <div class="overview-item">
                <div class="icon">🗓️</div>
                <div class="value">${daysCount}</div>
                <div class="label">Days</div>
              </div>
              <div class="overview-item">
                <div class="icon">👥</div>
                <div class="value">${trip.groupSize}</div>
                <div class="label">Travelers</div>
              </div>
              <div class="overview-item">
                <div class="icon">💰</div>
                <div class="value">${trip.travelStyle === 'custom' ? `${currencySymbol}${trip.budget?.toLocaleString()}` : (trip.travelStyle === 'budget' ? 'Budget' : trip.travelStyle === 'standard' ? 'Comfort' : trip.travelStyle === 'luxury' ? 'Luxury' : `${currencySymbol}${trip.budget?.toLocaleString()}`)}</div>
                <div class="label">${trip.travelStyle === 'custom' ? 'Budget' : 'Travel Style'}</div>
              </div>
            </div>
          </div>

          ${feasibility ? `
          <div class="section">
            <div class="section-title">Trip Feasibility Analysis</div>
            <div class="feasibility-card ${feasibility.overall === 'warning' ? 'warning' : feasibility.overall === 'no' ? 'danger' : ''}">
              <div class="feasibility-status">
                ${feasibility.overall === 'yes' ? '✅ Trip is Feasible' : feasibility.overall === 'warning' ? '⚠️ Some Considerations' : '❌ Not Recommended'}
              </div>
              <div class="feasibility-summary">${feasibility.summary || ''}</div>
            </div>
          </div>
          ` : ''}

          ${breakdown ? `
          <div class="section">
            <div class="section-title">Budget Breakdown</div>
            <div class="budget-grid">
              ${breakdown.flights ? `
              <div class="budget-card">
                <div class="label">✈️ Flights</div>
                <div class="amount">${currencySymbol}${breakdown.flights.total?.toLocaleString() || 0}</div>
                <div class="note">${breakdown.flights.note || 'Round-trip flights'}</div>
              </div>` : ''}
              ${breakdown.accommodation ? `
              <div class="budget-card">
                <div class="label">🏨 Accommodation</div>
                <div class="amount">${currencySymbol}${breakdown.accommodation.total?.toLocaleString() || 0}</div>
                <div class="note">${breakdown.accommodation.nights || daysCount - 1} nights</div>
              </div>` : ''}
              ${breakdown.food ? `
              <div class="budget-card">
                <div class="label">🍽️ Food & Dining</div>
                <div class="amount">${currencySymbol}${breakdown.food.total?.toLocaleString() || 0}</div>
                <div class="note">${currencySymbol}${breakdown.food.perDay || Math.round((breakdown.food.total || 0) / daysCount)} per day</div>
              </div>` : ''}
              ${breakdown.activities ? `
              <div class="budget-card">
                <div class="label">🎯 Activities</div>
                <div class="amount">${currencySymbol}${breakdown.activities.total?.toLocaleString() || 0}</div>
                <div class="note">Tours, attractions & experiences</div>
              </div>` : ''}
              ${breakdown.localTransport ? `
              <div class="budget-card">
                <div class="label">🚕 Local Transport</div>
                <div class="amount">${currencySymbol}${breakdown.localTransport.total?.toLocaleString() || 0}</div>
                <div class="note">Metro, taxis, buses</div>
              </div>` : ''}
              ${breakdown.misc ? `
              <div class="budget-card">
                <div class="label">📦 Miscellaneous</div>
                <div class="amount">${currencySymbol}${breakdown.misc.total?.toLocaleString() || 0}</div>
                <div class="note">Tips, souvenirs, extras</div>
              </div>` : ''}
            </div>
            <div class="budget-total">
              <div class="label">Total Estimated Cost</div>
              <div class="amount">${currencySymbol}${(breakdown.grandTotal || breakdown.totalSpent || 0).toLocaleString()}</div>
              ${trip.travelStyle === 'custom'
                ? `<div class="status">${breakdown.budgetStatus === 'within_budget' ? '✓ Within Budget' : breakdown.budgetStatus === 'tight' ? '⚡ Tight Budget' : '⚠️ Over Budget'}</div>`
                : `<div class="status" style="background: rgba(255,255,255,0.3);">${trip.travelStyle === 'budget' ? '💰 Budget Travel' : trip.travelStyle === 'luxury' ? '✨ Luxury Travel' : '🎯 Comfort Travel'}</div>`
              }
            </div>
          </div>
          ` : ''}

          ${itinerary?.days?.length > 0 ? `
          <div class="section" style="page-break-before: always;">
            <div class="section-title">Day-by-Day Itinerary</div>
            ${itinerary.days.map((day: any, index: number) => `
              <div class="day-section">
                <div class="day-header">
                  <h3>Day ${day.day || day.dayNumber || index + 1}: ${day.title || 'Exploring ' + trip.destination}</h3>
                  <div class="date">${day.date || ''}</div>
                </div>
                <div class="day-activities">
                  ${(day.activities || []).map((act: any) => `
                    <div class="activity-item">
                      <div class="activity-time">${act.time || '—'}</div>
                      <div class="activity-details">
                        <div class="activity-name">${act.name || act.title || act.description || 'Activity'}</div>
                        <div class="activity-location">${act.location || ''}</div>
                      </div>
                      ${act.estimatedCost || act.cost ? `<div class="activity-cost">${currencySymbol}${act.estimatedCost || act.cost}</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div class="page-footer">
            <p>This travel plan was generated by <span class="brand">VoyageAI</span></p>
            <p>AI-Powered Travel Planning • voyageai.com</p>
            <p style="margin-top: 10px;">Generated on ${exportDate} • Trip ID: #${trip.id}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
    toast({ title: "PDF Export", description: "Print dialog opened - select 'Save as PDF'" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <Plane className="w-16 h-16 text-primary" />
        </motion.div>
        <motion.h2
          className="text-2xl font-display font-bold text-white mt-6"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          Planning Your Adventure...
        </motion.h2>
        <p className="text-slate-400 max-w-md text-center mt-3">
          Analyzing visa requirements, checking prices, and crafting your perfect itinerary
        </p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Colorful travel-themed gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600" />

        {/* Animated floating travel icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating airplane */}
          <div className="absolute top-[10%] left-[10%] text-6xl opacity-20 animate-bounce" style={{ animationDuration: '3s' }}>
            ✈️
          </div>
          {/* Floating compass */}
          <div className="absolute top-[20%] right-[15%] text-5xl opacity-25 animate-pulse" style={{ animationDuration: '2s' }}>
            🧭
          </div>
          {/* Floating map */}
          <div className="absolute bottom-[25%] left-[8%] text-5xl opacity-20 animate-bounce" style={{ animationDuration: '4s', animationDelay: '1s' }}>
            🗺️
          </div>
          {/* Floating suitcase */}
          <div className="absolute bottom-[15%] right-[20%] text-6xl opacity-25 animate-pulse" style={{ animationDuration: '2.5s' }}>
            🧳
          </div>
          {/* Floating globe */}
          <div className="absolute top-[50%] left-[5%] text-4xl opacity-15 animate-spin" style={{ animationDuration: '20s' }}>
            🌍
          </div>
          {/* Floating passport */}
          <div className="absolute top-[60%] right-[8%] text-5xl opacity-20 animate-bounce" style={{ animationDuration: '3.5s' }}>
            🛂
          </div>
          {/* Question marks floating */}
          <div className="absolute top-[35%] left-[25%] text-3xl opacity-30 animate-ping" style={{ animationDuration: '2s' }}>
            ❓
          </div>
          <div className="absolute bottom-[40%] right-[30%] text-4xl opacity-25 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}>
            ❓
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-yellow-300/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-15%] left-[-10%] w-80 h-80 bg-blue-400/20 rounded-full blur-3xl" />

        {/* Content card */}
        <div className="relative z-10 text-center bg-white/10 backdrop-blur-xl rounded-3xl p-12 mx-4 border border-white/20 shadow-2xl max-w-md">
          {/* Lost traveler illustration */}
          <div className="text-8xl mb-6 animate-bounce" style={{ animationDuration: '2s' }}>
            🏝️
          </div>
          <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Trip Not Found</h1>
          <p className="text-white/80 mb-8 text-lg">
            Oops! This trip seems to have wandered off the map. It doesn't exist or has been removed.
          </p>
          <Link href="/">
            <Button className="bg-white text-purple-600 hover:bg-white/90 font-semibold px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105">
              <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isFeasible = trip.feasibilityStatus === 'yes' || trip.feasibilityStatus === 'warning';

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Full-Page Fixed Background */}
      <div className="fixed inset-0 z-0">
        <div
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 animate-pulse" />
        )}
        {/* Reduced overlay for brighter backgrounds - was bg-black/60 */}
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
      </div>

      {/* Fixed Header */}
      <header className="relative z-50 bg-black/20 backdrop-blur-md flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer group">
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold font-display shadow-lg group-hover:bg-white/30 transition-colors">
                  V
                </div>
                <span className="font-display font-semibold text-lg tracking-tight text-white/90 group-hover:text-white transition-colors hidden sm:block">VoyageAI</span>
              </div>
            </Link>

            {/* Actions - Consistent styling */}
            <div className="flex items-center gap-2">
              {/* Home Button */}
              <Link href="/">
                <Button size="sm" variant="ghost" className="bg-white/10 text-white hover:bg-white/20 rounded-full px-3 backdrop-blur-sm border border-white/10">
                  <ArrowLeft className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>

              {/* Edit Trip */}
              <Link href={`/create?edit=${trip.id}&passport=${encodeURIComponent(trip.passport || '')}&origin=${encodeURIComponent(trip.origin || '')}&destination=${encodeURIComponent(trip.destination || '')}&dates=${encodeURIComponent(trip.dates || '')}&budget=${trip.budget || ''}&currency=${trip.currency || 'USD'}&adults=${trip.adults || 1}&children=${trip.children || 0}&infants=${trip.infants || 0}`}>
                <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white rounded-full px-3 backdrop-blur-sm border border-white/10">
                  <Pencil className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Edit</span>
                </Button>
              </Link>

              {/* Share Button */}
              <Button size="sm" variant="ghost" className="bg-white/10 text-white hover:bg-white/20 rounded-full px-3 backdrop-blur-sm border border-white/10" onClick={handleShare}>
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline ml-1">Share</span>
              </Button>

              {/* Export to PDF Button */}
              <Button size="sm" variant="ghost" className="bg-white/10 text-white hover:bg-white/20 rounded-full px-3 backdrop-blur-sm border border-white/10" onClick={handleExportPDF}>
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">PDF</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0 p-4 overflow-auto custom-scrollbar">
        <div className="container mx-auto max-w-6xl">
          <AnimatePresence mode="wait">
            {/* Preview Cards Grid - Show when no section is expanded */}
            {expandedSection === null && (
              <motion.div
                key="cards"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                {/* Hero Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 mb-4">
                    <Plane className="w-4 h-4 text-white" />
                    <span className="text-white/90 text-sm font-medium">Your Trip Plan</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.3)' }}>
                    {trip.destination}
                  </h1>
                  <div className="flex items-center justify-center gap-6 text-white/80 text-sm">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {trip.dates}
                    </span>
                    <span className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      {costBreakdown?.travelers?.note || `${trip.groupSize} traveler${trip.groupSize > 1 ? 's' : ''}`}
                    </span>
                    <span className="flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      {trip.travelStyle === 'custom'
                        ? `${getCurrencySymbol(trip.currency ?? undefined)}${trip.budget.toLocaleString()} budget`
                        : `${trip.travelStyle === 'budget' ? 'Budget' : trip.travelStyle === 'standard' ? 'Comfort' : trip.travelStyle === 'luxury' ? 'Luxury' : trip.travelStyle} travel`}
                    </span>
                  </div>
                </motion.div>

                {isProcessing ? (
                  <div className="relative">
                    {/* Animated background while processing */}
                    <AnimatedBackground />
                    <ProgressIndicator
                      step={progress?.step ?? 0}
                      message={progress?.message ?? "Analyzing your trip..."}
                      details={progress?.details}
                      elapsed={progress?.elapsed ?? 0}
                      percentComplete={progress?.percentComplete ?? 0}
                    />
                  </div>
                ) : (
                  /* Preview Cards Grid */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Analysis Card */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      onClick={() => setExpandedSection('analysis')}
                      className="group bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all text-left"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl bg-emerald-500/20">
                          <FileText className="w-6 h-6 text-emerald-400" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Trip Analysis</h3>
                      <p className="text-white/60 text-sm mb-4">Visa requirements, safety info, and trip feasibility</p>
                      {/* Status Preview */}
                      <div className="flex items-center gap-2">
                        {trip.feasibilityStatus === 'yes' && (
                          <>
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                            <span className="text-emerald-400 font-medium">Good to Go!</span>
                            {feasibilityReport?.score && (
                              <span className="ml-auto bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-medium">
                                {feasibilityReport.score}/100
                              </span>
                            )}
                          </>
                        )}
                        {trip.feasibilityStatus === 'warning' && (
                          <>
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                            <span className="text-amber-400 font-medium">Some Considerations</span>
                          </>
                        )}
                        {trip.feasibilityStatus === 'no' && (
                          <>
                            <XCircle className="w-5 h-5 text-red-400" />
                            <span className="text-red-400 font-medium">Issues Found</span>
                          </>
                        )}
                      </div>
                    </motion.button>

                    {/* Budget Card */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onClick={() => isFeasible && setExpandedSection('budget')}
                      disabled={!isFeasible}
                      className={`group bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 transition-all text-left ${
                        isFeasible ? 'hover:bg-white/20 hover:border-white/30' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl bg-amber-500/20">
                          <DollarSign className="w-6 h-6 text-amber-400" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Budget Breakdown</h3>
                      <p className="text-white/60 text-sm mb-4">Estimated costs and money-saving tips</p>
                      {/* Budget Preview */}
                      {costBreakdown ? (
                        <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-500 ${
                          showUpdateAnimation ? 'bg-emerald-500/30 ring-2 ring-emerald-400/50 animate-pulse' : ''
                        }`}>
                          <div>
                            <span className={`text-2xl font-bold transition-all duration-300 ${showUpdateAnimation ? 'text-emerald-300' : 'text-white'}`}>
                              {costBreakdown.currencySymbol || getCurrencySymbol(trip.currency ?? undefined)}{costBreakdown.grandTotal?.toLocaleString()}
                            </span>
                            <span className="text-white/60 text-sm ml-2">estimated</span>
                          </div>
                          {/* Only show budget comparison for custom budget trips */}
                          {trip.travelStyle === 'custom' && costBreakdown.budgetStatus === 'within_budget' && (
                            <span className="flex items-center gap-1 text-emerald-400 text-sm">
                              <TrendingDown className="w-4 h-4" /> Under budget
                            </span>
                          )}
                          {trip.travelStyle === 'custom' && costBreakdown.budgetStatus === 'over_budget' && (
                            <span className="flex items-center gap-1 text-red-400 text-sm">
                              <TrendingUp className="w-4 h-4" /> Over budget
                            </span>
                          )}
                          {/* For non-custom styles, show travel style badge */}
                          {trip.travelStyle !== 'custom' && (
                            <span className={`flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
                              trip.travelStyle === 'budget' ? 'bg-emerald-500/20 text-emerald-400' :
                              trip.travelStyle === 'luxury' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {trip.travelStyle === 'budget' ? 'Budget' : trip.travelStyle === 'luxury' ? 'Luxury' : 'Comfort'}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
                          <span className="text-white/60 text-sm">Calculating costs...</span>
                        </div>
                      )}
                    </motion.button>

                    {/* Transport Options Card - Getting There */}
                    {costBreakdown?.transportOptions && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 backdrop-blur-xl rounded-2xl p-6 border border-cyan-400/20"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-cyan-500/20">
                              {costBreakdown.transportOptions.primaryMode === 'train' ? (
                                <Train className="w-6 h-6 text-cyan-400" />
                              ) : costBreakdown.transportOptions.primaryMode === 'bus' ? (
                                <Bus className="w-6 h-6 text-cyan-400" />
                              ) : (
                                <Plane className="w-6 h-6 text-cyan-400" />
                              )}
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">Getting There</h3>
                              <p className="text-white/60 text-xs">{costBreakdown.transportOptions.distanceCategory} {costBreakdown.transportOptions.isDomestic ? 'domestic' : 'international'} journey</p>
                            </div>
                          </div>
                        </div>

                        {/* Transport Options Comparison - CLICKABLE */}
                        <p className="text-[10px] text-white/40 mb-2 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Click to select transport mode & update budget
                        </p>
                        <div className="space-y-2">
                          {costBreakdown.transportOptions.options?.slice(0, 3).map((opt: any, idx: number) => {
                            const isCheapest = costBreakdown.transportOptions.options.every((o: any) => opt.estimatedCost <= o.estimatedCost);
                            const isFastest = costBreakdown.transportOptions.options.every((o: any) =>
                              parseFloat(opt.duration) <= parseFloat(o.duration));
                            const isSelected = opt.selected || (selectedTransportMode === opt.mode) ||
                              (!selectedTransportMode && costBreakdown.transportOptions.selectedMode === opt.mode);
                            const TransportIcon = opt.mode.toLowerCase().includes('train') ? Train :
                              opt.mode.toLowerCase().includes('bus') ? Bus :
                              opt.mode.toLowerCase().includes('cab') || opt.mode.toLowerCase().includes('taxi') ? Car : Plane;

                            return (
                              <button
                                key={idx}
                                onClick={() => handleTransportSelect(opt)}
                                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-500/30 border-2 border-emerald-400/50 ring-2 ring-emerald-500/20'
                                    : opt.recommended
                                    ? 'bg-cyan-500/20 border border-cyan-400/30 hover:bg-cyan-500/30'
                                    : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <TransportIcon className={`w-5 h-5 ${isSelected ? 'text-emerald-400' : opt.recommended ? 'text-cyan-400' : 'text-white/60'}`} />
                                  <div className="text-left">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-medium ${isSelected ? 'text-emerald-300' : opt.recommended ? 'text-cyan-300' : 'text-white/80'}`}>
                                        {opt.mode}
                                      </span>
                                      {isSelected && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center gap-0.5">
                                          <Check className="w-2.5 h-2.5" /> Selected
                                        </span>
                                      )}
                                      {isCheapest && !isSelected && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                                          Cheapest
                                        </span>
                                      )}
                                      {isFastest && !isCheapest && !isSelected && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                                          Fastest
                                        </span>
                                      )}
                                      {opt.recommended && !isSelected && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/30 text-cyan-300">
                                          AI Pick
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-white/50">{opt.duration}</span>
                                  </div>
                                </div>
                                <span className={`font-bold ${isSelected ? 'text-emerald-300' : opt.recommended ? 'text-cyan-300' : 'text-white/70'}`}>
                                  {costBreakdown.currencySymbol}{opt.estimatedCost?.toLocaleString()}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Recommendation */}
                        <p className="text-xs text-white/50 mt-3 italic">
                          {costBreakdown.transportOptions.recommendation}
                        </p>

                        {/* Local Transport Preview */}
                        {costBreakdown.localTransport?.options && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-xs text-white/60 mb-2">Local transport at destination:</p>
                            <div className="flex flex-wrap gap-1">
                              {costBreakdown.localTransport.options.slice(0, 4).map((opt: string, idx: number) => (
                                <span key={idx} className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70">
                                  {opt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Getting Around Card - Local Transport & Connectivity */}
                    {costBreakdown?.bookingApps && costBreakdown.bookingApps.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-emerald-900/40 to-teal-900/40 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/30"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-emerald-500/20">
                              <Navigation className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-white">Getting Around</h3>
                              <p className="text-white/60 text-xs">Book local transport & stay connected</p>
                            </div>
                          </div>
                        </div>

                        {/* Transport Booking Apps */}
                        <div className="space-y-3">
                          {costBreakdown.bookingApps.map((modeApps: any, idx: number) => (
                            <div key={idx} className="bg-white/5 rounded-lg p-3">
                              <p className="text-xs text-emerald-300 font-medium mb-2 uppercase tracking-wide">
                                {modeApps.mode}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {modeApps.apps?.slice(0, 3).map((app: any, appIdx: number) => (
                                  <a
                                    key={appIdx}
                                    href={app.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 rounded-full text-xs text-white hover:bg-emerald-500/40 transition-colors"
                                  >
                                    <span>{app.name}</span>
                                    <ExternalLink className="w-3 h-3 text-emerald-300" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Mobile/SIM Plans */}
                        {costBreakdown.mobilePlans && costBreakdown.mobilePlans.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-xs text-white/60 mb-2 flex items-center gap-1">
                              <Globe className="w-3 h-3" /> Stay Connected - Tourist SIM Cards
                            </p>
                            <div className="grid gap-2">
                              {costBreakdown.mobilePlans.slice(0, 2).map((plan: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">{plan.provider}</span>
                                    <span className="text-white/50">{plan.data || plan.plan}</span>
                                  </div>
                                  <span className="text-emerald-400 font-semibold">{plan.price}</span>
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-white/40 mt-2 italic">Buy at airport or train station for best rates</p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* Itinerary Card */}
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      onClick={() => isFeasible && setExpandedSection('itinerary')}
                      disabled={!isFeasible}
                      className={`group bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 transition-all text-left ${
                        isFeasible ? 'hover:bg-white/20 hover:border-white/30' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl bg-purple-500/20">
                          <ClipboardList className="w-6 h-6 text-purple-400" />
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">Day-by-Day Itinerary</h3>
                      <p className="text-white/60 text-sm mb-4">Complete daily schedule with activities and meals</p>
                      {/* Itinerary Preview */}
                      <div className={`flex items-center gap-4 px-3 py-2 rounded-lg transition-all duration-500 ${
                        showUpdateAnimation ? 'bg-emerald-500/30 ring-2 ring-emerald-400/50 animate-pulse' : ''
                      }`}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-purple-400" />
                          <span className={`text-sm transition-all duration-300 ${showUpdateAnimation ? 'text-emerald-300 font-semibold' : 'text-white/80'}`}>{daysCount} days</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Plane className="w-4 h-4 text-purple-400" />
                          <span className={`text-sm transition-all duration-300 ${showUpdateAnimation ? 'text-emerald-300 font-semibold' : 'text-white/80'}`}>{activitiesCount} activities</span>
                        </div>
                      </div>
                    </motion.button>
                  </div>
                )}

                {/* Book Now Section - Full width below cards */}
                {!isProcessing && isFeasible && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6"
                  >
                    <motion.button
                      onClick={() => setExpandedSection('booking')}
                      className="w-full group bg-gradient-to-r from-emerald-500/20 to-blue-500/20 backdrop-blur-xl rounded-2xl p-6 border border-emerald-400/30 hover:border-emerald-400/50 transition-all text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-500">
                            <ShoppingCart className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white mb-1">Ready to Book?</h3>
                            <p className="text-white/60 text-sm">Compare prices on flights, hotels & activities</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:flex items-center gap-2">
                            <span className="px-2 py-1 bg-white/10 rounded text-white/80 text-xs">Skyscanner</span>
                            <span className="px-2 py-1 bg-white/10 rounded text-white/80 text-xs">Booking.com</span>
                            <span className="px-2 py-1 bg-white/10 rounded text-white/80 text-xs">Viator</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-emerald-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Expanded Section View */}
            {expandedSection !== null && (
              <motion.div
                key={expandedSection}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {/* Back Button */}
                <button
                  onClick={() => setExpandedSection(null)}
                  className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Overview</span>
                </button>

                {/* Analysis Section */}
                {expandedSection === 'analysis' && (
                  <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
                    <FeasibilityReportView trip={trip} />
                  </div>
                )}

                {/* Budget Section */}
                {expandedSection === 'budget' && isFeasible && (
                  <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20">
                    <CostBreakdown
                      key={`budget-${updateKey}`}
                      trip={localItinerary ? { ...trip, itinerary: localItinerary } : trip}
                      budgetOverride={localBudgetBreakdown}
                    />
                  </div>
                )}

                {/* Itinerary Section with Map */}
                {expandedSection === 'itinerary' && isFeasible && (
                  <div className="flex gap-4" style={{ height: 'calc(100vh - 180px)' }}>
                    {/* Left: Scrollable Itinerary - hide when map is expanded */}
                    {!isMapExpanded && (
                      <div className="flex-1 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 flex flex-col overflow-hidden">
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-3 rounded-t-2xl flex items-center justify-between flex-shrink-0">
                          <div>
                            <h3 className="text-lg font-display font-bold text-white">Day-by-Day Itinerary</h3>
                            <p className="text-slate-300 text-xs flex items-center gap-1">
                              <Plane className="w-3 h-3" /> AI Generated • Click activity to view on map
                            </p>
                          </div>
                          <div className="text-white/60 text-sm">{daysCount} days</div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                          <ItineraryTimeline
                            key={`itinerary-${updateKey}`}
                            trip={localItinerary ? { ...trip, itinerary: localItinerary } : trip}
                            highlightedLocation={highlightedLocation}
                            onActivityClick={handleLocationSelect}
                            onFoodSelect={handleFoodSelect}
                            selectedFoods={selectedFoods}
                          />
                        </div>
                      </div>
                    )}

                    {/* Right: Map - expands to full width when isMapExpanded */}
                    <div className={`${isMapExpanded ? 'flex-1' : 'w-[45%]'} bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 overflow-hidden hidden lg:flex flex-col`}>
                      <div className="bg-gradient-to-r from-blue-900 to-slate-800 px-5 py-3 flex items-center justify-between flex-shrink-0">
                        <div>
                          <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                            <MapIcon className="w-5 h-5" /> Trip Map
                          </h3>
                          <p className="text-slate-300 text-xs">{locationsCount} locations • Click to explore</p>
                        </div>
                      </div>
                      <div className="flex-1 p-2">
                        <ItineraryMap
                          key={`map-${updateKey}`}
                          trip={localItinerary ? { ...trip, itinerary: localItinerary } : trip}
                          highlightedLocation={highlightedLocation}
                          onLocationSelect={handleLocationSelect}
                          isExpanded={isMapExpanded}
                          onExpandToggle={() => setIsMapExpanded(!isMapExpanded)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Booking Section */}
                {expandedSection === 'booking' && isFeasible && (
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                    <BookNow trip={trip} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.5);
        }
      `}</style>

      {/* AI Chat Assistant */}
      {!isProcessing && isFeasible && (
        <TripChat
          tripId={trip.id}
          destination={trip.destination}
          tripContext={{
            destination: trip.destination,
            dates: trip.dates,
            budget: trip.budget,
            currency: trip.currency || 'USD',
            travelers: trip.groupSize,
          }}
          onTripUpdate={handleTripUpdate}
        />
      )}
    </div>
  );
}
