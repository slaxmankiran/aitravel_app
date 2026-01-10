/**
 * DestinationModal.tsx
 *
 * Mindtrip-style destination picker with autocomplete.
 * Clean modal with destination input and optional key details.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Search, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DestinationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: DestinationData) => void;
  initialData?: DestinationData;
}

export interface DestinationData {
  destinations: Array<{ city: string; country: string }>;
  keyDetails?: string;
}

// Popular destinations for quick selection
const POPULAR_DESTINATIONS = [
  { city: "Tokyo", country: "Japan", emoji: "🗼" },
  { city: "Paris", country: "France", emoji: "🗼" },
  { city: "Bali", country: "Indonesia", emoji: "🏝️" },
  { city: "Rome", country: "Italy", emoji: "🏛️" },
  { city: "Bangkok", country: "Thailand", emoji: "🛕" },
  { city: "Dubai", country: "UAE", emoji: "🏙️" },
  { city: "Barcelona", country: "Spain", emoji: "⛪" },
  { city: "London", country: "UK", emoji: "🎡" },
];

// Major cities for autocomplete
const CITY_DATABASE = [
  { city: "Tokyo", country: "Japan" },
  { city: "Paris", country: "France" },
  { city: "London", country: "United Kingdom" },
  { city: "New York", country: "USA" },
  { city: "Dubai", country: "UAE" },
  { city: "Singapore", country: "Singapore" },
  { city: "Bangkok", country: "Thailand" },
  { city: "Barcelona", country: "Spain" },
  { city: "Rome", country: "Italy" },
  { city: "Bali", country: "Indonesia" },
  { city: "Amsterdam", country: "Netherlands" },
  { city: "Sydney", country: "Australia" },
  { city: "Istanbul", country: "Turkey" },
  { city: "Hong Kong", country: "China" },
  { city: "Los Angeles", country: "USA" },
  { city: "Seoul", country: "South Korea" },
  { city: "Mumbai", country: "India" },
  { city: "Berlin", country: "Germany" },
  { city: "Vienna", country: "Austria" },
  { city: "Prague", country: "Czech Republic" },
  { city: "Lisbon", country: "Portugal" },
  { city: "Athens", country: "Greece" },
  { city: "Santorini", country: "Greece" },
  { city: "Kyoto", country: "Japan" },
  { city: "Osaka", country: "Japan" },
  { city: "Chiang Mai", country: "Thailand" },
  { city: "Phuket", country: "Thailand" },
  { city: "Maldives", country: "Maldives" },
  { city: "Cancun", country: "Mexico" },
  { city: "Miami", country: "USA" },
];

export function DestinationModal({
  isOpen,
  onClose,
  onConfirm,
  initialData,
}: DestinationModalProps) {
  const [searchValue, setSearchValue] = useState("");
  const [destinations, setDestinations] = useState<Array<{ city: string; country: string }>>(
    initialData?.destinations || []
  );
  const [keyDetails, setKeyDetails] = useState(initialData?.keyDetails || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setDestinations(initialData.destinations);
        setKeyDetails(initialData.keyDetails || "");
      }
      setSearchValue("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  const handleConfirm = () => {
    if (destinations.length === 0) return;
    onConfirm({ destinations, keyDetails });
    onClose();
  };

  const filteredCities = CITY_DATABASE.filter(
    (city) =>
      (city.city.toLowerCase().includes(searchValue.toLowerCase()) ||
        city.country.toLowerCase().includes(searchValue.toLowerCase())) &&
      !destinations.some((d) => d.city === city.city && d.country === city.country)
  ).slice(0, 6);

  const addDestination = (city: string, country: string) => {
    if (!destinations.some((d) => d.city === city && d.country === country)) {
      setDestinations([...destinations, { city, country }]);
    }
    setSearchValue("");
    setShowSuggestions(false);
  };

  const removeDestination = (index: number) => {
    setDestinations(destinations.filter((_, i) => i !== index));
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900">Where to?</h2>
            </div>
            <div className="w-7" /> {/* Spacer */}
          </div>

          {/* Content */}
          <div className="p-6 flex-1 overflow-y-auto">
            {/* Destination Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Destination
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchValue}
                    onChange={(e) => {
                      setSearchValue(e.target.value);
                      setShowSuggestions(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowSuggestions(searchValue.length > 0)}
                    placeholder="Where are you headed?"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                  />

                  {/* Autocomplete suggestions */}
                  {showSuggestions && filteredCities.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                      {filteredCities.map((city) => (
                        <button
                          key={`${city.city}-${city.country}`}
                          onClick={() => addDestination(city.city, city.country)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors"
                        >
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <div>
                            <span className="font-medium text-slate-900">{city.city}</span>
                            <span className="text-slate-500">, {city.country}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected destinations */}
              {destinations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {destinations.map((dest, index) => (
                    <div
                      key={`${dest.city}-${dest.country}-${index}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-medium text-slate-700">
                        {dest.city}, {dest.country}
                      </span>
                      <button
                        onClick={() => removeDestination(index)}
                        className="p-0.5 hover:bg-slate-200 rounded-full"
                      >
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Popular destinations */}
              {destinations.length === 0 && searchValue === "" && (
                <div>
                  <p className="text-sm text-slate-500 mb-3">Popular destinations</p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_DESTINATIONS.map((dest) => (
                      <button
                        key={`${dest.city}-${dest.country}`}
                        onClick={() => addDestination(dest.city, dest.country)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-full text-sm transition-colors"
                      >
                        <span>{dest.emoji}</span>
                        <span className="text-slate-700">{dest.city}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Key details (optional) */}
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Key details <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={keyDetails}
                  onChange={(e) => setKeyDetails(e.target.value)}
                  placeholder="Tell us what you know so far — travel companions, budget, must-dos, preferences"
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all resize-none text-sm"
                />
                <p className="text-xs text-slate-400 text-right mt-1">
                  {keyDetails.length}/500 characters
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              onClick={handleConfirm}
              disabled={destinations.length === 0}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 rounded-xl text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {destinations.length === 0 ? 'Select a destination' : 'Continue'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
