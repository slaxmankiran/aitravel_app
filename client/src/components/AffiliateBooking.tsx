import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Plane,
  Hotel,
  Car,
  Ticket,
  Shield,
  CheckCircle,
  Star,
  Clock,
  TrendingDown,
  Zap,
  ChevronRight,
  Info
} from "lucide-react";

// Affiliate partner configurations
const AFFILIATE_PARTNERS = {
  flights: [
    { name: 'Skyscanner', logo: '/partners/skyscanner.svg', commission: '2-5%', url: 'https://www.skyscanner.com' },
    { name: 'Kayak', logo: '/partners/kayak.svg', commission: '1-3%', url: 'https://www.kayak.com' },
    { name: 'Google Flights', logo: '/partners/google.svg', commission: '0%', url: 'https://www.google.com/flights' },
  ],
  hotels: [
    { name: 'Booking.com', logo: '/partners/booking.svg', commission: '4-6%', url: 'https://www.booking.com' },
    { name: 'Hotels.com', logo: '/partners/hotels.svg', commission: '4%', url: 'https://www.hotels.com' },
    { name: 'Agoda', logo: '/partners/agoda.svg', commission: '5-7%', url: 'https://www.agoda.com' },
  ],
  activities: [
    { name: 'Viator', logo: '/partners/viator.svg', commission: '8%', url: 'https://www.viator.com' },
    { name: 'GetYourGuide', logo: '/partners/gyg.svg', commission: '8%', url: 'https://www.getyourguide.com' },
    { name: 'Klook', logo: '/partners/klook.svg', commission: '3-5%', url: 'https://www.klook.com' },
  ],
  cars: [
    { name: 'Rentalcars.com', logo: '/partners/rentalcars.svg', commission: '5%', url: 'https://www.rentalcars.com' },
    { name: 'Discover Cars', logo: '/partners/discovercars.svg', commission: '6%', url: 'https://www.discovercars.com' },
  ],
};

// Booking Card with Affiliate Link
interface BookingCardProps {
  type: 'flight' | 'hotel' | 'activity' | 'car';
  title: string;
  subtitle: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  image?: string;
  bookingUrl: string;
  partner: string;
  dealTag?: string;
  features?: string[];
}

export function BookingCard({
  type,
  title,
  subtitle,
  price,
  originalPrice,
  currency = 'USD',
  rating,
  reviewCount,
  image,
  bookingUrl,
  partner,
  dealTag,
  features = [],
}: BookingCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const typeIcons = {
    flight: <Plane className="w-5 h-5" />,
    hotel: <Hotel className="w-5 h-5" />,
    activity: <Ticket className="w-5 h-5" />,
    car: <Car className="w-5 h-5" />,
  };

  const typeColors = {
    flight: 'from-blue-500 to-indigo-600',
    hotel: 'from-amber-500 to-orange-600',
    activity: 'from-green-500 to-emerald-600',
    car: 'from-purple-500 to-violet-600',
  };

  const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(p);
  };

  // Track affiliate click
  const handleBookingClick = () => {
    // In production, this would track the click for analytics
    console.log(`Affiliate click: ${partner} - ${type} - ${title}`);
    window.open(bookingUrl, '_blank');
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
    >
      {/* Image/Header */}
      <div className="relative h-32">
        {image ? (
          <img src={image} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${typeColors[type]} flex items-center justify-center`}>
            <div className="text-white/80">{typeIcons[type]}</div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Deal Tag */}
        {dealTag && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
              {dealTag}
            </span>
          </div>
        )}

        {/* Discount Badge */}
        {discount > 0 && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center gap-1">
              <TrendingDown className="w-3 h-3" />
              {discount}% OFF
            </span>
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-slate-700 flex items-center gap-1">
            {typeIcons[type]}
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-900 mb-1 line-clamp-1">{title}</h3>
        <p className="text-sm text-slate-500 mb-3 line-clamp-1">{subtitle}</p>

        {/* Rating */}
        {rating && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-medium text-slate-700">{rating}</span>
            </div>
            {reviewCount && (
              <span className="text-xs text-slate-400">({reviewCount.toLocaleString()} reviews)</span>
            )}
          </div>
        )}

        {/* Features */}
        {features.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {features.slice(0, 3).map((feature, i) => (
              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
                {feature}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="flex items-end justify-between mb-4">
          <div>
            {originalPrice && (
              <span className="text-sm text-slate-400 line-through mr-2">
                {formatPrice(originalPrice)}
              </span>
            )}
            <span className="text-2xl font-bold text-slate-900">{formatPrice(price)}</span>
            <span className="text-xs text-slate-500 ml-1">
              {type === 'hotel' ? '/night' : type === 'car' ? '/day' : ''}
            </span>
          </div>
        </div>

        {/* Book Button */}
        <Button
          onClick={handleBookingClick}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl"
        >
          Book on {partner}
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>

        {/* Partner Info */}
        <p className="text-xs text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" />
          Secure booking via {partner}
        </p>
      </div>
    </motion.div>
  );
}

// Price Comparison Widget
interface PriceComparisonProps {
  type: 'flight' | 'hotel' | 'activity' | 'car';
  destination: string;
  prices: Array<{
    partner: string;
    price: number;
    url: string;
    features?: string[];
    recommended?: boolean;
  }>;
  currency?: string;
}

export function PriceComparison({ type, destination, prices, currency = 'USD' }: PriceComparisonProps) {
  const sortedPrices = [...prices].sort((a, b) => a.price - b.price);
  const lowestPrice = sortedPrices[0]?.price || 0;

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(p);
  };

  const typeLabels = {
    flight: 'Flights',
    hotel: 'Hotels',
    activity: 'Activities',
    car: 'Car Rentals',
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Compare {typeLabels[type]}</h3>
            <p className="text-sm text-slate-500">{destination}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">From</p>
            <p className="text-lg font-bold text-green-600">{formatPrice(lowestPrice)}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {sortedPrices.map((item, index) => (
          <motion.a
            key={item.partner}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                index === 0 ? 'bg-green-100' : 'bg-slate-100'
              }`}>
                {index === 0 ? (
                  <Zap className="w-5 h-5 text-green-600" />
                ) : (
                  <span className="text-sm font-bold text-slate-400">{index + 1}</span>
                )}
              </div>
              <div>
                <p className="font-medium text-slate-900 flex items-center gap-2">
                  {item.partner}
                  {item.recommended && (
                    <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                      Recommended
                    </span>
                  )}
                </p>
                {item.features && (
                  <p className="text-xs text-slate-500">{item.features.join(' • ')}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={`font-bold ${index === 0 ? 'text-green-600' : 'text-slate-900'}`}>
                  {formatPrice(item.price)}
                </p>
                {index === 0 && (
                  <p className="text-xs text-green-600">Best price</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </motion.a>
        ))}
      </div>

      <div className="p-3 bg-slate-50 text-center">
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
          <Info className="w-3 h-3" />
          Prices updated in real-time. We may earn a commission.
        </p>
      </div>
    </div>
  );
}

// Quick Book Banner - For prominent monetization
interface QuickBookBannerProps {
  destination: string;
  dates?: string;
  className?: string;
}

export function QuickBookBanner({ destination, dates, className = '' }: QuickBookBannerProps) {
  const bookingLinks = [
    { name: 'Flights', icon: <Plane className="w-4 h-4" />, url: `https://www.skyscanner.com/transport/flights/anywhere/${destination.toLowerCase().replace(/\s+/g, '-')}/` },
    { name: 'Hotels', icon: <Hotel className="w-4 h-4" />, url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}` },
    { name: 'Activities', icon: <Ticket className="w-4 h-4" />, url: `https://www.viator.com/searchResults/all?text=${encodeURIComponent(destination)}` },
    { name: 'Cars', icon: <Car className="w-4 h-4" />, url: `https://www.rentalcars.com/search-results?location=${encodeURIComponent(destination)}` },
  ];

  return (
    <div className={`bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-white">Quick Book</h3>
          <p className="text-sm text-white/80">Best prices for {destination}</p>
        </div>
        <Shield className="w-6 h-6 text-white/60" />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {bookingLinks.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
          >
            <div className="text-white">{link.icon}</div>
            <span className="text-xs text-white font-medium">{link.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
