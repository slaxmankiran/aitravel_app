/**
 * Travel Insurance Component
 * Get quotes and purchase travel insurance through affiliate links
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  ShieldCheck,
  Star,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
  Heart,
  Plane,
  Briefcase,
  Clock,
  Users,
  DollarSign,
  Info,
} from 'lucide-react';

interface InsuranceQuote {
  providerId: string;
  providerName: string;
  providerLogo: string;
  planName: string;
  price: number;
  currency: string;
  pricePerDay: number;
  coverage: {
    medical: number;
    tripCancellation: number;
    baggage: number;
    travelDelay: number;
    emergencyEvacuation: number;
  };
  features: string[];
  rating: number;
  reviews: number;
  affiliateUrl: string;
  recommended?: boolean;
}

interface TravelInsuranceProps {
  tripId: number;
  destination: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  tripCost?: number;
}

type CoverageType = 'basic' | 'standard' | 'premium';

const COVERAGE_INFO: Record<CoverageType, { name: string; description: string; icon: any }> = {
  basic: {
    name: 'Basic',
    description: 'Essential emergency coverage',
    icon: Shield,
  },
  standard: {
    name: 'Standard',
    description: 'Comprehensive protection',
    icon: ShieldCheck,
  },
  premium: {
    name: 'Premium',
    description: 'Maximum coverage + CFAR',
    icon: Star,
  },
};

export function TravelInsurance({
  tripId,
  destination,
  startDate,
  endDate,
  travelers = 1,
  tripCost = 2000,
}: TravelInsuranceProps) {
  const [quotes, setQuotes] = useState<InsuranceQuote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [coverageType, setCoverageType] = useState<CoverageType>('standard');
  const [showDetails, setShowDetails] = useState(false);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [travelerAges, setTravelerAges] = useState<number[]>(
    Array(travelers).fill(30)
  );
  const { toast } = useToast();

  const fetchQuotes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/insurance/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          destination,
          startDate,
          endDate,
          travelers: travelerAges.map(age => ({ age })),
          tripCost,
          coverageType,
        }),
      });

      if (!res.ok) throw new Error('Failed to get quotes');

      const data = await res.json();
      setQuotes(data.quotes || []);
    } catch (err) {
      console.error('Insurance quote error:', err);
      toast({
        title: 'Error',
        description: 'Failed to get insurance quotes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const trackClick = async (providerId: string, price: number) => {
    try {
      await fetch('/api/insurance/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, tripId, quotePrice: price }),
      });
    } catch (err) {
      // Silent fail for analytics
    }
  };

  const handleGetQuote = (quote: InsuranceQuote) => {
    trackClick(quote.providerId, quote.price);
    window.open(quote.affiliateUrl, '_blank', 'noopener,noreferrer');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate trip days
  const tripDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  return (
    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Travel Insurance</h3>
            <p className="text-xs text-slate-400">
              Protect your {tripDays}-day trip to {destination}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-slate-400 hover:text-white"
        >
          {showDetails ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Coverage Type Selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.keys(COVERAGE_INFO) as CoverageType[]).map((type) => {
          const info = COVERAGE_INFO[type];
          const Icon = info.icon;
          return (
            <button
              key={type}
              onClick={() => {
                setCoverageType(type);
                setQuotes([]); // Clear quotes when changing type
              }}
              className={`p-3 rounded-xl border transition-all ${
                coverageType === type
                  ? 'bg-emerald-500/20 border-emerald-500 text-white'
                  : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500'
              }`}
            >
              <Icon className={`w-5 h-5 mx-auto mb-1 ${
                coverageType === type ? 'text-emerald-500' : ''
              }`} />
              <p className="text-sm font-medium">{info.name}</p>
              <p className="text-xs opacity-70">{info.description}</p>
            </button>
          );
        })}
      </div>

      {/* Traveler Ages (expandable) */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 p-4 bg-slate-700/50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-white">Traveler Ages</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {travelerAges.map((age, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Traveler {idx + 1}:</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={age}
                      onChange={(e) => {
                        const newAges = [...travelerAges];
                        newAges[idx] = parseInt(e.target.value) || 30;
                        setTravelerAges(newAges);
                        setQuotes([]); // Clear quotes when changing ages
                      }}
                      className="w-16 px-2 py-1 bg-slate-600 border-none rounded text-white text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <Info className="w-3 h-3" />
                <span>Ages affect pricing. Travelers 65+ have higher premiums.</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Get Quotes Button */}
      {quotes.length === 0 && (
        <Button
          onClick={fetchQuotes}
          disabled={isLoading}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Getting Quotes...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Get Insurance Quotes
            </>
          )}
        </Button>
      )}

      {/* Quotes List */}
      <AnimatePresence>
        {quotes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {quotes.map((quote, idx) => (
              <QuoteCard
                key={quote.providerId}
                quote={quote}
                isExpanded={expandedQuote === quote.providerId}
                onToggle={() => setExpandedQuote(
                  expandedQuote === quote.providerId ? null : quote.providerId
                )}
                onSelect={() => handleGetQuote(quote)}
                delay={idx * 0.1}
                formatCurrency={formatCurrency}
              />
            ))}

            <button
              onClick={() => setQuotes([])}
              className="w-full text-center text-sm text-slate-400 hover:text-white mt-4"
            >
              Change options & get new quotes
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trust Badges */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-500" />
            Licensed Providers
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-500" />
            Secure Checkout
          </span>
          <span className="flex items-center gap-1">
            <Check className="w-3 h-3 text-emerald-500" />
            24/7 Support
          </span>
        </div>
      </div>
    </div>
  );
}

function QuoteCard({
  quote,
  isExpanded,
  onToggle,
  onSelect,
  delay,
  formatCurrency,
}: {
  quote: InsuranceQuote;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  delay: number;
  formatCurrency: (n: number) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-xl border transition-all ${
        quote.recommended
          ? 'bg-emerald-500/10 border-emerald-500/50'
          : 'bg-slate-700/50 border-slate-600'
      }`}
    >
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden">
              <Shield className="w-6 h-6 text-slate-800" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{quote.providerName}</span>
                {quote.recommended && (
                  <span className="px-2 py-0.5 bg-emerald-500 rounded-full text-xs font-medium text-white">
                    Best Value
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{quote.planName}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xl font-bold text-white">{formatCurrency(quote.price)}</p>
            <p className="text-xs text-slate-400">{formatCurrency(quote.pricePerDay)}/day</p>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-sm text-white">{quote.rating}</span>
            <span className="text-xs text-slate-400">({quote.reviews.toLocaleString()} reviews)</span>
          </div>
          <button
            onClick={onToggle}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Coverage Details
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-slate-600">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <CoverageItem
                    icon={Heart}
                    label="Medical"
                    amount={formatCurrency(quote.coverage.medical)}
                  />
                  <CoverageItem
                    icon={Plane}
                    label="Trip Cancel"
                    amount={formatCurrency(quote.coverage.tripCancellation)}
                  />
                  <CoverageItem
                    icon={Briefcase}
                    label="Baggage"
                    amount={formatCurrency(quote.coverage.baggage)}
                  />
                  <CoverageItem
                    icon={Clock}
                    label="Travel Delay"
                    amount={formatCurrency(quote.coverage.travelDelay)}
                  />
                </div>

                <div className="space-y-1">
                  {quote.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <Button
          onClick={onSelect}
          className={`w-full mt-4 ${
            quote.recommended
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          Get This Quote
          <ExternalLink className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}

function CoverageItem({
  icon: Icon,
  label,
  amount,
}: {
  icon: any;
  label: string;
  amount: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-slate-400" />
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-white">{amount}</p>
      </div>
    </div>
  );
}

/**
 * Compact Insurance CTA for trip cards
 */
export function InsuranceCTA({
  destination,
  onClick,
}: {
  destination: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-all group"
    >
      <ShieldCheck className="w-4 h-4 text-emerald-500" />
      <span className="text-sm text-emerald-400">Protect your trip</span>
      <ExternalLink className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
