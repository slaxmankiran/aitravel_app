/**
 * ChatTripV2.tsx
 *
 * Mindtrip-style chat planning experience.
 * - Top summary pills showing trip state at a glance
 * - Clean centered chat area with narrative-only messages
 * - Modal pickers for structured inputs (no parsing needed)
 * - VoyageAI-specific: Passport for visa intelligence
 */

import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCreateTrip } from "@/hooks/use-trips";
import { type CreateTripRequest } from "@shared/schema";
import { trackTripEvent, startNewFlow } from "@/lib/analytics";
import { useToast } from "@/hooks/use-toast";
import {
  TripSummaryPills,
  DatePickerModal,
  TravelersModal,
  StyleModal,
  DestinationModal,
  type DateSelection,
  type TravelersData,
  type TravelStyle,
  type StyleData,
  type DestinationData,
} from "@/components/chat";
import {
  Check,
  Sparkles,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Plane,
} from "lucide-react";
import { Link } from "wouter";
import { COUNTRIES, searchCountries } from "@/lib/travelData";

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  type: 'assistant' | 'system';
  content: string;
  timestamp: Date;
  // Optional category for replaceable messages
  category?: 'destination' | 'passport' | 'date' | 'travelers' | 'style';
}

interface TripState {
  destinations: Array<{ city: string; country: string }>;
  dateType: 'specific' | 'flexible';
  startDate?: Date;
  endDate?: Date;
  numDays?: number;
  preferredMonth?: string;
  travelers: TravelersData;
  travelStyle: TravelStyle;
  currency: string;
  customBudget?: number;
  passport: string;
  keyDetails: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDateDisplay(state: TripState): string | undefined {
  if (state.dateType === 'flexible') {
    if (state.preferredMonth) {
      return `${state.numDays || 5} days in ${state.preferredMonth}`;
    }
    return `${state.numDays || 5} days, flexible`;
  }
  if (state.startDate && state.endDate) {
    const start = state.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const end = state.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${start} - ${end}`;
  }
  return undefined;
}

function getDestinationDisplay(destinations: Array<{ city: string; country: string }>): string {
  if (destinations.length === 0) return '';
  // Single destination only (multi-city coming soon)
  return destinations[0].city;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ChatTripV2() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const createTrip = useCreateTrip();
  const { toast } = useToast();

  // Parse URL params for destination prefill
  const urlParams = new URLSearchParams(searchString);
  const prefillDestination = urlParams.get('destination');

  // Trip state
  const [tripState, setTripState] = useState<TripState>(() => {
    const initialDests: Array<{ city: string; country: string }> = [];
    if (prefillDestination) {
      const parts = prefillDestination.split(',').map(s => s.trim());
      if (parts[0]) {
        initialDests.push({ city: parts[0], country: parts[1] || '' });
      }
    }
    return {
      destinations: initialDests,
      dateType: 'flexible',
      numDays: 5,
      travelers: { adults: 1, children: 0, infants: 0 },
      travelStyle: 'comfort',
      currency: 'USD',
      passport: '', // Empty by default - user must select for visa intelligence
      keyDetails: '',
    };
  });

  // Modal states
  const [destinationModalOpen, setDestinationModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [travelersModalOpen, setTravelersModalOpen] = useState(false);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [passportModalOpen, setPassportModalOpen] = useState(false);

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passportSearch, setPassportSearch] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: prefillDestination
        ? `**${prefillDestination}** — great choice! I'll help you plan this trip.\n\nClick any field above to add your trip details, or just hit **Plan My Trip** when you're ready.`
        : "Where are you dreaming of going?\n\nClick **Where** above to pick a destination, or just tell me about your trip.",
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const flowCompletedRef = useRef(false);

  // Analytics
  useEffect(() => {
    startNewFlow();
    trackTripEvent(0, 'create_started', {}, {}, 'chat');
  }, []);

  // Abandonment tracking
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!flowCompletedRef.current) {
        const payload = JSON.stringify({
          event: 'planning_mode_abandoned',
          ts: new Date().toISOString(),
          tripId: 0,
          page: 'chat',
          data: {
            mode: 'chat',
            hadDestination: tripState.destinations.length > 0,
          }
        });
        navigator.sendBeacon('/api/analytics/trip-events', new Blob([payload], { type: 'application/json' }));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (!flowCompletedRef.current) {
        trackTripEvent(0, 'planning_mode_abandoned', {
          mode: 'chat',
          hadDestination: tripState.destinations.length > 0,
        }, {}, 'chat');
      }
    };
  }, [tripState.destinations]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  // Ready to submit when destination AND passport are set
  const isReady = tripState.destinations.length > 0 && tripState.passport !== '';

  // Track if we've entered quiet mode (persists through state changes)
  // Once ready, we enter quiet mode and stay there - no more narrative messages
  const [enteredQuietMode, setEnteredQuietMode] = useState(false);

  // Enter quiet mode when ready (one-way transition)
  useEffect(() => {
    if (isReady && !enteredQuietMode) {
      setEnteredQuietMode(true);
    }
  }, [isReady, enteredQuietMode]);

  const addNarrativeMessage = (content: string, category?: Message['category']) => {
    // In quiet mode, suppress general narrative messages
    // But allow updates to key fields (destination, passport) by replacing old messages
    if (enteredQuietMode && !category) return;

    setMessages(prev => {
      // If this message has a category, replace any existing message with same category
      if (category) {
        const filtered = prev.filter(m => m.category !== category);
        return [...filtered, {
          id: Date.now().toString(),
          type: 'assistant' as const,
          content,
          timestamp: new Date(),
          category,
        }];
      }

      // Otherwise just add the message
      return [...prev, {
        id: Date.now().toString(),
        type: 'assistant' as const,
        content,
        timestamp: new Date(),
      }];
    });
  };

  const handleDestinationConfirm = (data: DestinationData) => {
    setTripState(prev => ({
      ...prev,
      destinations: data.destinations,
      keyDetails: data.keyDetails || prev.keyDetails,
    }));

    const destDisplay = data.destinations.map(d => d.city).join(', ');
    addNarrativeMessage(
      `**${destDisplay}** added to your trip!${data.keyDetails ? " I've noted your preferences." : ""}`,
      'destination'
    );
  };

  const handleDateConfirm = (data: DateSelection) => {
    setTripState(prev => ({
      ...prev,
      dateType: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      numDays: data.numDays,
      preferredMonth: data.preferredMonth,
    }));

    if (data.type === 'flexible') {
      addNarrativeMessage(
        `**${data.numDays} days${data.preferredMonth ? ` in ${data.preferredMonth}` : ', flexible'}** — I'll optimize for deals and weather.`,
        'date'
      );
    } else if (data.startDate && data.endDate) {
      const start = data.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const end = data.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      addNarrativeMessage(`**${start} - ${end}** — dates locked in.`, 'date');
    }
  };

  const handleTravelersConfirm = (data: TravelersData) => {
    setTripState(prev => ({
      ...prev,
      travelers: data,
    }));

    const total = data.adults + data.children + data.infants;
    const desc = total === 1 ? "Solo trip" :
                 data.children > 0 || data.infants > 0 ? "Family trip" :
                 data.adults === 2 ? "Couple's trip" : `Group of ${total}`;
    addNarrativeMessage(`**${desc}** — I'll tailor recommendations accordingly.`, 'travelers');
  };

  const handleStyleConfirm = (data: StyleData) => {
    setTripState(prev => ({
      ...prev,
      travelStyle: data.style,
      currency: data.currency,
      customBudget: data.customBudget,
    }));

    const labels: Record<TravelStyle, string> = { budget: 'Budget', comfort: 'Comfort', luxury: 'Luxury', custom: 'Custom' };
    const styleLabel = labels[data.style];
    const currencyNote = data.currency !== 'USD' ? ` (${data.currency})` : '';
    const budgetNote = data.style === 'custom' && data.customBudget ? ` — ${data.currency} ${data.customBudget.toLocaleString()} budget` : '';
    addNarrativeMessage(`**${styleLabel}** style selected${budgetNote}${currencyNote} — costs adjusted.`, 'style');
  };

  const handlePassportConfirm = (code: string) => {
    setTripState(prev => ({
      ...prev,
      passport: code,
    }));
    setPassportModalOpen(false);

    const country = COUNTRIES.find(p => p.code === code)?.name || code;
    addNarrativeMessage(
      `**${country} passport** — I'll check visa requirements for your destinations.`,
      'passport'
    );
  };

  const handleSubmit = async () => {
    if (tripState.destinations.length === 0) {
      addNarrativeMessage("Please add at least one destination before I can plan your trip.");
      setDestinationModalOpen(true);
      return;
    }

    if (!tripState.passport) {
      addNarrativeMessage("Please select your **passport** so I can check visa requirements.");
      setPassportModalOpen(true);
      return;
    }

    setIsSubmitting(true);

    // Build trip request
    const destString = tripState.destinations.map(d => `${d.city}, ${d.country}`).join(' → ');
    const groupSize = tripState.travelers.adults + tripState.travelers.children + tripState.travelers.infants;

    // Calculate dates string
    let datesString = '';
    if (tripState.dateType === 'flexible') {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() + 1);
      const monthName = tripState.preferredMonth || startDate.toLocaleString('en-US', { month: 'long' });
      datesString = `${monthName} ${startDate.getFullYear()}, ${tripState.numDays || 7} days`;
    } else if (tripState.startDate && tripState.endDate) {
      const start = tripState.startDate.toLocaleDateString('en-US');
      const end = tripState.endDate.toLocaleDateString('en-US');
      datesString = `${start} - ${end}`;
    }

    // Ensure dates are set (fallback to flexible 7 days if specific dates not selected)
    if (!datesString) {
      const now = new Date();
      const fallbackMonth = now.toLocaleString('en-US', { month: 'long' });
      datesString = `${fallbackMonth} ${now.getFullYear()}, 7 days`;
    }

    // Calculate budget based on style (or use custom budget)
    let budget: number;
    if (tripState.travelStyle === 'custom' && tripState.customBudget) {
      budget = tripState.customBudget;
    } else {
      const budgetBase: Record<string, number> = { budget: 1500, comfort: 3000, luxury: 5000, custom: 3000 };
      budget = (budgetBase[tripState.travelStyle] || 3000) * groupSize;
    }

    const tripRequest: CreateTripRequest = {
      passport: tripState.passport,
      origin: '',
      destination: destString,
      dates: datesString,
      adults: tripState.travelers.adults,
      children: tripState.travelers.children,
      infants: tripState.travelers.infants,
      groupSize,
      budget,
      currency: tripState.currency,
      travelStyle: tripState.travelStyle === 'comfort' ? 'standard' : (tripState.travelStyle === 'custom' ? 'custom' : tripState.travelStyle),
      // interests is an array field; convert keyDetails string to array or omit
      interests: tripState.keyDetails ? [tripState.keyDetails] : undefined,
      // Track that this trip was created from the chat flow
      createdFrom: 'chat',
    };

    createTrip.mutate(tripRequest, {
      onSuccess: (response) => {
        flowCompletedRef.current = true;
        trackTripEvent(response.id, 'chat_plan_success', {
          destination: destString,
          budget,
          groupSize,
        });
        // Show "saved for later" toast
        toast({
          title: "Trip saved!",
          description: "Find it anytime in My Trips.",
        });
        setLocation(`/trips/${response.id}/feasibility`);
      },
      onError: (error: any) => {
        setIsSubmitting(false);
        trackTripEvent(0, 'chat_plan_failed', {
          errorType: error?.message || 'unknown',
          destination: destString,
        });
        // Use toast instead of chat message - errors shouldn't pollute the narrative
        toast({
          title: "Couldn't create trip",
          description: error?.message || "Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  // Save preferences on blur - no chat affordance, just silent save
  const handleNotesSave = () => {
    if (!inputValue.trim()) return;

    const trimmed = inputValue.trim();

    // Store as key details silently
    setTripState(prev => ({
      ...prev,
      keyDetails: prev.keyDetails ? `${prev.keyDetails}\n${trimmed}` : trimmed,
    }));

    // Show subtle toast feedback, not a chat message
    toast({
      title: "Preferences saved",
      description: trimmed.length > 40 ? trimmed.slice(0, 40) + "..." : trimmed,
      duration: 2000,
    });

    setInputValue("");
  };

  // Legacy submit handler (for Enter key - now redirects to blur behavior)
  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleNotesSave();
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold">
              V
            </div>
            <span className="font-display font-semibold text-slate-800">VoyageAI</span>
          </Link>

          <Button
            onClick={handleSubmit}
            disabled={!isReady || isSubmitting}
            className={`rounded-full px-6 transition-all ${
              isReady
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Plan My Trip
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Summary Pills */}
      <TripSummaryPills
        destination={getDestinationDisplay(tripState.destinations)}
        dateType={tripState.dateType}
        dateDisplay={formatDateDisplay(tripState)}
        travelers={tripState.travelers}
        travelStyle={tripState.travelStyle}
        passport={tripState.passport}
        currency={tripState.currency}
        onDestinationClick={() => setDestinationModalOpen(true)}
        onDateClick={() => setDateModalOpen(true)}
        onTravelersClick={() => setTravelersModalOpen(true)}
        onStyleClick={() => setStyleModalOpen(true)}
        onPassportClick={() => setPassportModalOpen(true)}
      />

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Welcome illustration */}
            {messages.length <= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <Plane className="w-12 h-12 text-amber-600" />
                </div>
              </motion.div>
            )}

            {/* Messages */}
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center"
                >
                  <div className="max-w-md text-center">
                    <p className="text-slate-700 text-lg leading-relaxed whitespace-pre-line"
                       dangerouslySetInnerHTML={{
                         __html: msg.content
                           .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900">$1</strong>')
                       }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Notes input - not a chat, just annotation */}
          <div className="p-4 border-t bg-white">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={handleNotesSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNotesSave();
                  }
                }}
                placeholder={
                  enteredQuietMode
                    ? "Optional notes (saved automatically)"
                    : tripState.destinations.length === 0
                    ? "Or describe your ideal trip..."
                    : !tripState.passport
                    ? "Select your passport above for visa checks"
                    : "Add preferences..."
                }
                className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:border-slate-300 focus:outline-none transition-all text-sm bg-slate-50"
              />
              {/* Subtle checkmark indicator when there's content */}
              {inputValue.trim() && (
                <button
                  type="button"
                  onClick={handleNotesSave}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                >
                  <Check className="w-4 h-4 text-slate-600" />
                </button>
              )}
            </div>
            {enteredQuietMode && (
              <p className="text-xs text-slate-400 mt-2 text-center">
                Everything is set. Click <strong>Plan My Trip</strong> when ready.
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <DestinationModal
        isOpen={destinationModalOpen}
        onClose={() => setDestinationModalOpen(false)}
        onConfirm={handleDestinationConfirm}
        initialData={{
          destinations: tripState.destinations,
          keyDetails: tripState.keyDetails,
        }}
      />

      <DatePickerModal
        isOpen={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        onConfirm={handleDateConfirm}
        initialData={{
          type: tripState.dateType,
          startDate: tripState.startDate,
          endDate: tripState.endDate,
          numDays: tripState.numDays,
          preferredMonth: tripState.preferredMonth,
        }}
      />

      <TravelersModal
        isOpen={travelersModalOpen}
        onClose={() => setTravelersModalOpen(false)}
        onConfirm={handleTravelersConfirm}
        initialData={tripState.travelers}
      />

      <StyleModal
        isOpen={styleModalOpen}
        onClose={() => setStyleModalOpen(false)}
        onConfirm={handleStyleConfirm}
        initialStyle={tripState.travelStyle}
        initialCurrency={tripState.currency}
        initialCustomBudget={tripState.customBudget}
      />

      {/* Passport Modal with search */}
      <AnimatePresence>
        {passportModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => {
              setPassportModalOpen(false);
              setPassportSearch("");
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
            >
              <div className="p-4 border-b text-center">
                <h2 className="text-lg font-semibold text-slate-900">Your Passport</h2>
                <p className="text-sm text-slate-500">For visa requirement checks</p>
              </div>
              {/* Search input */}
              <div className="px-4 pt-4">
                <input
                  type="text"
                  value={passportSearch}
                  onChange={(e) => setPassportSearch(e.target.value)}
                  placeholder="Search country..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:outline-none text-sm"
                  autoFocus
                />
              </div>
              <div className="p-4 max-h-72 overflow-y-auto">
                {searchCountries(passportSearch).map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => {
                      handlePassportConfirm(opt.code);
                      setPassportSearch("");
                    }}
                    className={`w-full p-3 rounded-xl text-left mb-2 transition-all flex items-center gap-3 ${
                      tripState.passport === opt.code
                        ? 'bg-emerald-50 border-2 border-emerald-500'
                        : 'bg-slate-50 hover:bg-slate-100 border-2 border-transparent'
                    }`}
                  >
                    <span className="text-xl">{opt.flag}</span>
                    <span className="font-medium">{opt.name}</span>
                  </button>
                ))}
                {searchCountries(passportSearch).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No countries found
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
