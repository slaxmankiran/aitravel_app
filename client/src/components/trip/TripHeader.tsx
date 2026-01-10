import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Calendar,
  Users,
  DollarSign,
  ChevronDown,
  Flag,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Pencil,
  X,
  Plus,
  Minus
} from "lucide-react";

interface TripHeaderProps {
  destination: string;
  dates: string;
  travelers: { adults: number; children: number; infants: number };
  budget: number;
  currency: string;
  travelStyle: string;
  passport: string;
  onUpdate?: (field: string, value: any) => void;
}

// Visa status indicator
function getVisaStatus(passport: string, destination: string): {
  status: 'visa_free' | 'visa_on_arrival' | 'visa_required' | 'restricted';
  label: string;
  days?: number;
  color: string;
  icon: any;
} {
  // Simplified visa logic - in production this would call an API
  const visaFreeDestinations: Record<string, string[]> = {
    'United States': ['Japan', 'France', 'Italy', 'Germany', 'UK', 'Spain', 'Greece', 'Portugal', 'Netherlands', 'Singapore', 'South Korea'],
    'India': ['Thailand', 'Indonesia', 'Maldives', 'Nepal', 'Bhutan', 'Sri Lanka', 'Mauritius', 'Fiji', 'Jamaica'],
    'UK': ['Japan', 'France', 'Italy', 'Germany', 'Spain', 'Greece', 'Portugal', 'Netherlands', 'Singapore', 'USA'],
  };

  const voaDestinations: Record<string, string[]> = {
    'United States': ['Thailand', 'Indonesia', 'Vietnam', 'Cambodia', 'Turkey', 'Egypt', 'Kenya'],
    'India': ['UAE', 'Qatar', 'Jordan', 'Cambodia', 'Laos', 'Madagascar'],
    'UK': ['Thailand', 'Indonesia', 'Vietnam', 'Cambodia', 'Turkey', 'Egypt'],
  };

  const destLower = destination.toLowerCase();
  const passportCountries = visaFreeDestinations[passport] || [];
  const voaCountries = voaDestinations[passport] || [];

  // Check visa-free
  if (passportCountries.some(c => destLower.includes(c.toLowerCase()))) {
    return {
      status: 'visa_free',
      label: 'Visa Free',
      days: 90,
      color: 'text-green-600 bg-green-50 border-green-200',
      icon: CheckCircle,
    };
  }

  // Check VOA
  if (voaCountries.some(c => destLower.includes(c.toLowerCase()))) {
    return {
      status: 'visa_on_arrival',
      label: 'Visa on Arrival',
      days: 30,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
      icon: AlertTriangle,
    };
  }

  // Check restricted (Russia, North Korea, etc.)
  if (['russia', 'north korea', 'iran', 'syria'].some(c => destLower.includes(c))) {
    return {
      status: 'restricted',
      label: 'Travel Advisory',
      color: 'text-red-600 bg-red-50 border-red-200',
      icon: XCircle,
    };
  }

  // Default to visa required
  return {
    status: 'visa_required',
    label: 'Visa Required',
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    icon: AlertTriangle,
  };
}

export function TripHeader({
  destination,
  dates,
  travelers,
  budget,
  currency,
  travelStyle,
  passport,
  onUpdate,
}: TripHeaderProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempTravelers, setTempTravelers] = useState(travelers);

  const visaStatus = getVisaStatus(passport, destination);
  const VisaIcon = visaStatus.icon;

  const totalTravelers = travelers.adults + travelers.children + travelers.infants;

  const budgetLabels: Record<string, string> = {
    budget: '$ Budget',
    standard: '$$ Comfort',
    comfort: '$$ Comfort',
    luxury: '$$$ Luxury',
    custom: `${currency} ${budget.toLocaleString()}`,
  };

  const handleTravelerUpdate = () => {
    onUpdate?.('travelers', tempTravelers);
    setEditingField(null);
  };

  return (
    <div className="bg-white border-b border-slate-200">
      {/* Visa Alert Banner */}
      <div className={`px-4 py-2 flex items-center justify-between ${visaStatus.color} border-b`}>
        <div className="flex items-center gap-2">
          <VisaIcon className="w-4 h-4" />
          <span className="font-medium text-sm">{visaStatus.label}</span>
          {visaStatus.days && (
            <span className="text-sm opacity-80">• Up to {visaStatus.days} days</span>
          )}
          <span className="text-sm opacity-80">for {passport} passport holders</span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs h-7">
          View Details
        </Button>
      </div>

      {/* Trip Info Pills */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-2">
        {/* Destination */}
        <button
          onClick={() => setEditingField('destination')}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm font-medium text-slate-700 transition-colors"
        >
          <MapPin className="w-4 h-4 text-slate-500" />
          {destination}
        </button>

        {/* Dates */}
        <button
          onClick={() => setEditingField('dates')}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm font-medium text-slate-700 transition-colors"
        >
          <Calendar className="w-4 h-4 text-slate-500" />
          {dates}
        </button>

        {/* Travelers */}
        <button
          onClick={() => setEditingField('travelers')}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm font-medium text-slate-700 transition-colors"
        >
          <Users className="w-4 h-4 text-slate-500" />
          {totalTravelers} traveler{totalTravelers > 1 ? 's' : ''}
        </button>

        {/* Budget */}
        <button
          onClick={() => setEditingField('budget')}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm font-medium text-slate-700 transition-colors"
        >
          <DollarSign className="w-4 h-4 text-slate-500" />
          {budgetLabels[travelStyle] || budgetLabels.custom}
        </button>

        {/* Passport/Nationality */}
        <button
          onClick={() => setEditingField('passport')}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm font-medium text-slate-700 transition-colors"
        >
          <Flag className="w-4 h-4 text-slate-500" />
          {passport}
        </button>

        {/* More Options */}
        <button className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
          More
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Edit Modal for Travelers */}
      <AnimatePresence>
        {editingField === 'travelers' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingField(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-semibold text-lg text-slate-900">Who</h3>
                  <p className="text-sm text-slate-500">{tempTravelers.adults + tempTravelers.children + tempTravelers.infants} travelers</p>
                </div>
                <button
                  onClick={() => setEditingField(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Adults */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Adults</p>
                    <p className="text-sm text-slate-500">Ages 13 or above</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTempTravelers(prev => ({ ...prev, adults: Math.max(1, prev.adults - 1) }))}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{tempTravelers.adults}</span>
                    <button
                      onClick={() => setTempTravelers(prev => ({ ...prev, adults: prev.adults + 1 }))}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Children */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Children</p>
                    <p className="text-sm text-slate-500">Ages 2-12</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTempTravelers(prev => ({ ...prev, children: Math.max(0, prev.children - 1) }))}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{tempTravelers.children}</span>
                    <button
                      onClick={() => setTempTravelers(prev => ({ ...prev, children: prev.children + 1 }))}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Infants */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">Infants</p>
                    <p className="text-sm text-slate-500">Under 2</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setTempTravelers(prev => ({ ...prev, infants: Math.max(0, prev.infants - 1) }))}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">{tempTravelers.infants}</span>
                    <button
                      onClick={() => setTempTravelers(prev => ({ ...prev, infants: prev.infants + 1 }))}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleTravelerUpdate}
                className="w-full mt-6 bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
              >
                Update
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
