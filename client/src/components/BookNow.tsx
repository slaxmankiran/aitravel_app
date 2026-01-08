import { motion } from "framer-motion";
import { Plane, Hotel, Compass, ExternalLink, Sparkles, TrendingDown, Clock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateBookingLinks, openAffiliateLink, type TripParams } from "@/lib/affiliate-links";
import type { Trip } from "@shared/schema";

// Provider logos/colors
const PROVIDER_STYLES: Record<string, { bg: string; text: string; icon?: string }> = {
  skyscanner: { bg: 'bg-[#0770e3]', text: 'text-white' },
  googleFlights: { bg: 'bg-white', text: 'text-gray-800' },
  kayak: { bg: 'bg-[#ff690f]', text: 'text-white' },
  booking: { bg: 'bg-[#003580]', text: 'text-white' },
  hostelworld: { bg: 'bg-[#f47521]', text: 'text-white' },
  expedia: { bg: 'bg-[#ffcc00]', text: 'text-gray-900' },
  viator: { bg: 'bg-[#2a2a2a]', text: 'text-white' },
  getYourGuide: { bg: 'bg-[#ff5533]', text: 'text-white' },
};

interface BookNowProps {
  trip: Trip;
  compact?: boolean;
}

export function BookNow({ trip, compact = false }: BookNowProps) {
  const tripParams: TripParams = {
    origin: trip.origin || '',
    destination: trip.destination,
    dates: trip.dates,
    adults: trip.adults || 1,
    children: trip.children || 0,
    infants: trip.infants || 0,
    currency: trip.currency || 'USD',
  };

  const links = generateBookingLinks(tripParams);

  const handleClick = (url: string, type: 'flight' | 'hotel' | 'activity', provider: string) => {
    openAffiliateLink(url, trip.id, type, provider);
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {links.flights.skyscanner && (
          <Button
            size="sm"
            className="bg-[#0770e3] hover:bg-[#0560c7] text-white"
            onClick={() => handleClick(links.flights.skyscanner!, 'flight', 'skyscanner')}
          >
            <Plane className="w-3 h-3 mr-1" /> Flights
          </Button>
        )}
        {links.hotels.booking && (
          <Button
            size="sm"
            className="bg-[#003580] hover:bg-[#002855] text-white"
            onClick={() => handleClick(links.hotels.booking!, 'hotel', 'booking')}
          >
            <Hotel className="w-3 h-3 mr-1" /> Hotels
          </Button>
        )}
        {links.activities.viator && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleClick(links.activities.viator!, 'activity', 'viator')}
          >
            <Compass className="w-3 h-3 mr-1" /> Activities
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-full px-4 py-1.5 mb-3">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span className="text-white/90 text-sm font-medium">Ready to Book?</span>
        </div>
        <h3 className="text-2xl font-display font-bold text-white mb-2">
          Book Your Trip
        </h3>
        <p className="text-white/60 text-sm max-w-md mx-auto">
          Compare prices across top travel sites and book directly. We've pre-filled your trip details!
        </p>
      </div>

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-6 text-white/50 text-xs">
        <span className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3" /> Best prices
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> Instant booking
        </span>
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3" /> Secure payments
        </span>
      </div>

      {/* Booking Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Flights Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-xl rounded-xl p-5 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-blue-500/20">
              <Plane className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Flights</h4>
              <p className="text-white/50 text-xs">Compare & book flights</p>
            </div>
          </div>

          <div className="space-y-2">
            {links.flights.skyscanner && (
              <BookingButton
                label="Skyscanner"
                sublabel="Best for comparing"
                provider="skyscanner"
                onClick={() => handleClick(links.flights.skyscanner!, 'flight', 'skyscanner')}
                recommended
              />
            )}
            {links.flights.googleFlights && (
              <BookingButton
                label="Google Flights"
                sublabel="Track price changes"
                provider="googleFlights"
                onClick={() => handleClick(links.flights.googleFlights!, 'flight', 'googleFlights')}
              />
            )}
            {links.flights.kayak && (
              <BookingButton
                label="Kayak"
                sublabel="Flexible dates"
                provider="kayak"
                onClick={() => handleClick(links.flights.kayak!, 'flight', 'kayak')}
              />
            )}
          </div>
        </motion.div>

        {/* Hotels Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-xl rounded-xl p-5 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-amber-500/20">
              <Hotel className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Hotels</h4>
              <p className="text-white/50 text-xs">Find perfect stays</p>
            </div>
          </div>

          <div className="space-y-2">
            {links.hotels.booking && (
              <BookingButton
                label="Booking.com"
                sublabel="Free cancellation"
                provider="booking"
                onClick={() => handleClick(links.hotels.booking!, 'hotel', 'booking')}
                recommended
              />
            )}
            {links.hotels.expedia && (
              <BookingButton
                label="Expedia"
                sublabel="Bundle & save"
                provider="expedia"
                onClick={() => handleClick(links.hotels.expedia!, 'hotel', 'expedia')}
              />
            )}
            {links.hotels.hostelworld && (
              <BookingButton
                label="Hostelworld"
                sublabel="Budget friendly"
                provider="hostelworld"
                onClick={() => handleClick(links.hotels.hostelworld!, 'hotel', 'hostelworld')}
              />
            )}
          </div>
        </motion.div>

        {/* Activities Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/10 backdrop-blur-xl rounded-xl p-5 border border-white/20"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-lg bg-purple-500/20">
              <Compass className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="font-semibold text-white">Activities</h4>
              <p className="text-white/50 text-xs">Tours & experiences</p>
            </div>
          </div>

          <div className="space-y-2">
            {links.activities.viator && (
              <BookingButton
                label="Viator"
                sublabel="TripAdvisor company"
                provider="viator"
                onClick={() => handleClick(links.activities.viator!, 'activity', 'viator')}
                recommended
              />
            )}
            {links.activities.getYourGuide && (
              <BookingButton
                label="GetYourGuide"
                sublabel="Skip-the-line tickets"
                provider="getYourGuide"
                onClick={() => handleClick(links.activities.getYourGuide!, 'activity', 'getYourGuide')}
              />
            )}
          </div>
        </motion.div>
      </div>

      {/* Disclaimer */}
      <p className="text-center text-white/40 text-xs">
        Prices may vary. We may earn a commission from bookings made through these links at no extra cost to you.
      </p>
    </div>
  );
}

// Individual booking button component
function BookingButton({
  label,
  sublabel,
  provider,
  onClick,
  recommended = false,
}: {
  label: string;
  sublabel: string;
  provider: string;
  onClick: () => void;
  recommended?: boolean;
}) {
  const style = PROVIDER_STYLES[provider] || { bg: 'bg-white', text: 'text-gray-800' };

  return (
    <button
      onClick={onClick}
      className={`w-full group relative flex items-center justify-between p-3 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${style.bg} ${style.text}`}
    >
      <div className="text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          {recommended && (
            <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
              TOP PICK
            </span>
          )}
        </div>
        <span className="text-xs opacity-70">{sublabel}</span>
      </div>
      <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// Booking app interface from AI-generated data
interface BookingApp {
  name: string;
  url: string;
  note: string;
}

interface BookingAppsGroup {
  mode: string;
  apps: BookingApp[];
}

// Inline booking buttons for cost breakdown
export function InlineBookingButtons({
  trip,
  type,
  bookingApps,
  selectedMode
}: {
  trip: Trip;
  type: 'flights' | 'hotels' | 'activities';
  bookingApps?: BookingAppsGroup[];
  selectedMode?: string;
}) {
  const tripParams: TripParams = {
    origin: trip.origin || '',
    destination: trip.destination,
    dates: trip.dates,
    adults: trip.adults || 1,
    children: trip.children || 0,
    infants: trip.infants || 0,
    currency: trip.currency || 'USD',
  };

  const links = generateBookingLinks(tripParams);

  const handleClick = (url: string, linkType: 'flight' | 'hotel' | 'activity', provider: string) => {
    openAffiliateLink(url, trip.id, linkType, provider);
  };

  // For travel/flights: use AI-generated booking apps based on selected transport mode
  if (type === 'flights' && bookingApps && selectedMode) {
    // Find booking apps for the selected transport mode
    const modeApps = bookingApps.find(group =>
      group.mode.toLowerCase() === selectedMode.toLowerCase()
    );

    if (modeApps && modeApps.apps.length > 0) {
      return (
        <div className="flex flex-wrap gap-2 mt-3">
          {modeApps.apps.slice(0, 3).map((app, idx) => (
            <Button
              key={app.name}
              size="sm"
              className={idx === 0
                ? "bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                : "bg-slate-700 hover:bg-slate-800 text-white text-xs h-8"
              }
              onClick={() => window.open(app.url, '_blank')}
              title={app.note}
            >
              <ExternalLink className="w-3 h-3 mr-1" /> {app.name}
            </Button>
          ))}
        </div>
      );
    }
  }

  // Default flight booking links
  if (type === 'flights') {
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {links.flights.skyscanner && (
          <Button
            size="sm"
            className="bg-[#0770e3] hover:bg-[#0560c7] text-white text-xs h-8"
            onClick={() => handleClick(links.flights.skyscanner!, 'flight', 'skyscanner')}
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Skyscanner
          </Button>
        )}
        {links.flights.googleFlights && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => handleClick(links.flights.googleFlights!, 'flight', 'googleFlights')}
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Google Flights
          </Button>
        )}
      </div>
    );
  }

  if (type === 'hotels') {
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {links.hotels.booking && (
          <Button
            size="sm"
            className="bg-[#003580] hover:bg-[#002855] text-white text-xs h-8"
            onClick={() => handleClick(links.hotels.booking!, 'hotel', 'booking')}
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Booking.com
          </Button>
        )}
        {links.hotels.expedia && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => handleClick(links.hotels.expedia!, 'hotel', 'expedia')}
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Expedia
          </Button>
        )}
      </div>
    );
  }

  if (type === 'activities') {
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {links.activities.viator && (
          <Button
            size="sm"
            className="bg-[#2a2a2a] hover:bg-[#1a1a1a] text-white text-xs h-8"
            onClick={() => handleClick(links.activities.viator!, 'activity', 'viator')}
          >
            <ExternalLink className="w-3 h-3 mr-1" /> Viator
          </Button>
        )}
        {links.activities.getYourGuide && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8"
            onClick={() => handleClick(links.activities.getYourGuide!, 'activity', 'getYourGuide')}
          >
            <ExternalLink className="w-3 h-3 mr-1" /> GetYourGuide
          </Button>
        )}
      </div>
    );
  }

  return null;
}
