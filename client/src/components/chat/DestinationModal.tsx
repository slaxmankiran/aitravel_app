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
import { POPULAR_DESTINATIONS, MAJOR_CITIES, searchCities } from "@/lib/travelData";

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

  // Use searchCities from shared travelData for comprehensive autocomplete
  const filteredCities = searchCities(searchValue).slice(0, 8);

  // Single destination selection - replaces existing
  const selectDestination = (city: string, country: string) => {
    setDestinations([{ city, country }]);
    setSearchValue("");
    setShowSuggestions(false);
  };

  const clearDestination = () => {
    setDestinations([]);
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
              {/* Show selected destination OR search input */}
              {destinations.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Your destination
                  </label>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{destinations[0].city}</p>
                        <p className="text-sm text-slate-500">{destinations[0].country}</p>
                      </div>
                    </div>
                    <button
                      onClick={clearDestination}
                      className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
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
                            onClick={() => selectDestination(city.city, city.country)}
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
              )}

              {/* Popular destinations - only show when no destination selected */}
              {destinations.length === 0 && searchValue === "" && (
                <div>
                  <p className="text-sm text-slate-500 mb-3">Popular destinations</p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_DESTINATIONS.map((dest) => (
                      <button
                        key={`${dest.city}-${dest.country}`}
                        onClick={() => selectDestination(dest.city, dest.country)}
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
