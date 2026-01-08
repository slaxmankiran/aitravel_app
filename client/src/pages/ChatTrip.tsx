import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { apiRequest } from "@/lib/queryClient";
import { useCreateTrip } from "@/hooks/use-trips";
import { type CreateTripRequest } from "@shared/schema";
import { trackTripEvent } from "@/lib/analytics";
import {
  Send,
  Sparkles,
  MapPin,
  Calendar,
  Users,
  Wallet,
  Plus,
  X,
  ChevronRight,
  Loader2,
  Car,
  Plane,
  Globe,
  AlertCircle,
  RotateCcw,
  Check,
  Flag,
  DollarSign
} from "lucide-react";

// Suggested prompts - certainty-focused, outcome-driven
const SUGGESTED_PROMPTS = [
  "Can I visit Japan in March with an Indian passport?",
  "7-day trip to Bali for 2 adults, $2000 budget",
  "Is Thailand visa-free for US citizens?",
  "Family trip to Dubai - what will it cost?",
  "Check if I can visit Schengen countries from India",
  "Weekend getaway to Singapore - feasibility check",
];

// Quick destination suggestions
const QUICK_DESTINATIONS = [
  { name: "Tokyo", country: "Japan", emoji: "🗼" },
  { name: "Paris", country: "France", emoji: "🗼" },
  { name: "Bali", country: "Indonesia", emoji: "🏝️" },
  { name: "Rome", country: "Italy", emoji: "🏛️" },
  { name: "Dubai", country: "UAE", emoji: "🏙️" },
  { name: "Santorini", country: "Greece", emoji: "🌅" },
];

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  tripData?: Partial<TripFormData>;
}

interface TripFormData {
  destinations: Array<{ city: string; country: string; days?: number }>;
  isRoadTrip: boolean;
  dateType: 'specific' | 'flexible';
  specificDates?: { from: Date; to: Date };
  flexibleMonth?: string;
  travelers: { adults: number; children: number; infants: number };
  budget?: number;
  currency: string;
  travelStyle: 'budget' | 'comfort' | 'luxury';
  keyDetails: string;
  passport: string;
}

// Chat stage state machine - wizard flow
type ChatStage =
  | 'collect_destination'
  | 'collect_dates'
  | 'collect_travelers'
  | 'collect_style'
  | 'collect_details'
  | 'ready_to_create';

// Stage order for progress tracking and guardrails
const STAGE_ORDER: ChatStage[] = [
  'collect_destination',
  'collect_dates',
  'collect_travelers',
  'collect_style',
  'collect_details',
  'ready_to_create'
];

const STAGE_LABELS: Record<ChatStage, string> = {
  'collect_destination': 'Destination',
  'collect_dates': 'Dates',
  'collect_travelers': 'Travelers',
  'collect_style': 'Style',
  'collect_details': 'Details',
  'ready_to_create': 'Ready'
};

// ============================================================================
// SINGLE SOURCE OF TRUTH: Step confirmation copy
// Used by both chat handlers and panel button handlers
// ============================================================================
type StepKey =
  | 'destination_added'
  | 'dates_flexible'
  | 'dates_specific'
  | 'travelers_solo'
  | 'travelers_couple'
  | 'travelers_family'
  | 'style_budget'
  | 'style_comfort'
  | 'style_luxury'
  | 'details_added'
  | 'ready';

interface StepCopy {
  message: string;
  suggestions: string[];
  nextStage: ChatStage;
}

const STEP_COPY: Record<StepKey, StepCopy> = {
  destination_added: {
    message: "When are you planning to travel?",
    suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    nextStage: 'collect_dates',
  },
  dates_flexible: {
    message: "Flexible dates — I'll optimize for deals and weather.\n\nHow many travelers?",
    suggestions: ["Just me (solo)", "2 adults", "Family with kids"],
    nextStage: 'collect_travelers',
  },
  dates_specific: {
    message: "Noted — you have specific dates in mind.\n\nHow many travelers?",
    suggestions: ["Just me (solo)", "2 adults", "Family with kids"],
    nextStage: 'collect_travelers',
  },
  travelers_solo: {
    message: "Solo trip — I'll tailor recommendations for single travelers.\n\nWhat's your travel style?",
    suggestions: ["Budget traveler", "Mid-range comfort", "Luxury experience"],
    nextStage: 'collect_style',
  },
  travelers_couple: {
    message: "Two adults — perfect for couples or friends.\n\nWhat's your travel style?",
    suggestions: ["Budget traveler", "Mid-range comfort", "Luxury experience"],
    nextStage: 'collect_style',
  },
  travelers_family: {
    message: "Family trip — I'll include kid-friendly activities.\n\nWhat's your travel style?",
    suggestions: ["Budget traveler", "Mid-range comfort", "Luxury experience"],
    nextStage: 'collect_style',
  },
  style_budget: {
    message: "Budget-conscious — I'll prioritize value.\n\nAnything specific you want to do or see? (Optional)",
    suggestions: ["Skip for now", "I have specific interests"],
    nextStage: 'collect_details',
  },
  style_comfort: {
    message: "Comfort — a great balance of quality and value.\n\nAnything specific you want to do or see? (Optional)",
    suggestions: ["Skip for now", "I have specific interests"],
    nextStage: 'collect_details',
  },
  style_luxury: {
    message: "Luxury — I'll find premium experiences.\n\nAnything specific you want to do or see? (Optional)",
    suggestions: ["Skip for now", "I have specific interests"],
    nextStage: 'collect_details',
  },
  details_added: {
    message: "Perfect — I've noted your interests.\n\nYou're all set! Click **Plan My Trip** to check feasibility and get your personalized itinerary.",
    suggestions: [],
    nextStage: 'ready_to_create',
  },
  ready: {
    message: "You're ready! Click **Plan My Trip** to check feasibility and generate your personalized trip plan.",
    suggestions: [],
    nextStage: 'ready_to_create',
  },
};

// Helper to get canonical destination key for deduplication
const getDestinationKey = (city: string, country: string): string => {
  return `${city.toLowerCase().trim()}-${country.toLowerCase().trim()}`;
};

// ============================================================================
// BUDGET CALCULATION HELPERS
// ============================================================================
const BUDGET_CONFIG = {
  perPerson: {
    budget: 1500,
    comfort: 3000,
    luxury: 5000,
  },
  minPerPerson: 500,
  maxPerPerson: 15000,
  infantMultiplier: 0.2, // Infants cost ~20% of adult
  childMultiplier: 0.7,  // Children cost ~70% of adult
};

function calculateBudget(
  style: 'budget' | 'comfort' | 'luxury',
  adults: number,
  children: number,
  infants: number
): number {
  const base = BUDGET_CONFIG.perPerson[style];
  const total =
    base * adults +
    base * BUDGET_CONFIG.childMultiplier * children +
    base * BUDGET_CONFIG.infantMultiplier * infants;

  // Clamp to min/max
  const groupSize = adults + children + infants;
  const min = BUDGET_CONFIG.minPerPerson * groupSize;
  const max = BUDGET_CONFIG.maxPerPerson * groupSize;

  return Math.round(Math.max(min, Math.min(max, total)));
}

// ============================================================================
// PASSPORT HELPERS
// ============================================================================
const COMMON_PASSPORTS: Record<string, string> = {
  'US': 'United States',
  'UK': 'United Kingdom',
  'IN': 'India',
  'CN': 'China',
  'CA': 'Canada',
  'AU': 'Australia',
  'DE': 'Germany',
  'FR': 'France',
  'JP': 'Japan',
  'BR': 'Brazil',
  'MX': 'Mexico',
  'PH': 'Philippines',
  'NG': 'Nigeria',
  'PK': 'Pakistan',
  'BD': 'Bangladesh',
};

// ============================================================================
// DATE HELPERS
// ============================================================================
function getDefaultDatesString(isFlexible: boolean, preferredMonth?: string): string {
  if (!isFlexible && preferredMonth) {
    return preferredMonth;
  }

  // For flexible dates, generate a reasonable default range
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() + 1); // Next month

  // Format as "Month YYYY, 7 days"
  const monthName = startDate.toLocaleString('en-US', { month: 'long' });
  const year = startDate.getFullYear();

  return `${monthName} ${year}, 7 days`;
}

export default function ChatTrip() {
  const [, setLocation] = useLocation();
  const createTrip = useCreateTrip(); // Hook to submit trip
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Tell me where you want to go. I'll check visa requirements, estimate costs, and build your itinerary - but only if the trip is actually possible.",
      timestamp: new Date(),
      suggestions: SUGGESTED_PROMPTS.slice(0, 3),
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tripData, setTripData] = useState<Partial<TripFormData>>({
    destinations: [],
    isRoadTrip: false,
    dateType: 'specific',
    travelers: { adults: 1, children: 0, infants: 0 },
    currency: 'USD',
    travelStyle: 'comfort',
    keyDetails: '',
    passport: 'US', // Default passport - can be changed in panel
  });
  const [showTripPanel, setShowTripPanel] = useState(true); // Always show panel
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());
  const [chatStage, setChatStage] = useState<ChatStage>('collect_destination');
  const [passportConfirmed, setPassportConfirmed] = useState(false); // Track if user confirmed passport
  const [showPassportPicker, setShowPassportPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // =========================================================================
  // EDGE-CASE FIX 1 & 2: Deduplication for emitStepConfirm
  // Prevents chat spam from rapid clicks or panel actions
  // =========================================================================
  const lastEmittedRef = useRef<{ stepKey: string; timestamp: number } | null>(null);
  const EMIT_DEBOUNCE_MS = 1000; // Ignore same step within 1 second

  // Helper to add destination with deduplication
  const addDestination = (city: string, country: string) => {
    const newKey = getDestinationKey(city, country);
    setTripData(prev => {
      const existingDests = prev.destinations || [];
      // Check if destination already exists
      const exists = existingDests.some(d => getDestinationKey(d.city, d.country) === newKey);
      if (exists) {
        return prev; // Don't add duplicate
      }
      return {
        ...prev,
        destinations: [...existingDests, { city, country }],
      };
    });
    setRecentlyUpdated(new Set(['destinations']));
  };

  // Helper to add chat message (for panel sync)
  const addAssistantMessage = (content: string, suggestions: string[] = []) => {
    const msg: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content,
      timestamp: new Date(),
      suggestions,
    };
    setMessages(prev => [...prev, msg]);
  };

  // =========================================================================
  // SINGLE SOURCE OF TRUTH: emitStepConfirm helper
  // Updates state AND posts to chat in one call - used by both chat and panel
  // EDGE-CASE FIX 1: Idempotent - ignores duplicate calls within debounce window
  // =========================================================================
  const emitStepConfirm = (stepKey: StepKey, updatedFields?: Set<string>) => {
    const copy = STEP_COPY[stepKey];
    if (!copy) return;

    // DEDUPE: Check if same step was emitted recently
    const now = Date.now();
    if (lastEmittedRef.current) {
      const { stepKey: lastStep, timestamp } = lastEmittedRef.current;
      if (lastStep === stepKey && now - timestamp < EMIT_DEBOUNCE_MS) {
        // Skip duplicate - just update visual indicator
        if (updatedFields) {
          setRecentlyUpdated(updatedFields);
        }
        return;
      }
    }

    // Record this emission
    lastEmittedRef.current = { stepKey, timestamp: now };

    // Update stage
    setChatStage(copy.nextStage);

    // Mark fields as updated (for visual indicator)
    if (updatedFields) {
      setRecentlyUpdated(updatedFields);
    }

    // Post to chat
    addAssistantMessage(copy.message, copy.suggestions);
  };

  // Helper to get current stage index for progress tracking
  const getStageIndex = (stage: ChatStage): number => {
    return STAGE_ORDER.indexOf(stage);
  };

  // Check if a stage is complete (past current stage)
  const isStageComplete = (stage: ChatStage): boolean => {
    return getStageIndex(stage) < getStageIndex(chatStage);
  };

  // Check if a stage is current or past (can be edited)
  const canEditStage = (stage: ChatStage): boolean => {
    return getStageIndex(stage) <= getStageIndex(chatStage);
  };

  // =========================================================================
  // EDGE-CASE FIX 3: Cascade reset when upstream fields change
  // Prevents invalid state when user removes destination, dates, etc.
  // =========================================================================
  const cascadeResetFromStage = (fromStage: ChatStage) => {
    const stageIdx = getStageIndex(fromStage);

    // Reset all downstream state based on stage
    setTripData(prev => {
      const updated = { ...prev };

      if (stageIdx <= getStageIndex('collect_destination')) {
        // Reset everything downstream of destination
        updated.dateType = 'specific';
        updated.flexibleMonth = undefined;
        updated.travelers = { adults: 1, children: 0, infants: 0 };
        updated.travelStyle = 'comfort';
        updated.keyDetails = '';
      } else if (stageIdx <= getStageIndex('collect_dates')) {
        // Reset everything downstream of dates
        updated.travelers = { adults: 1, children: 0, infants: 0 };
        updated.travelStyle = 'comfort';
        updated.keyDetails = '';
      } else if (stageIdx <= getStageIndex('collect_travelers')) {
        // Reset everything downstream of travelers
        updated.travelStyle = 'comfort';
        updated.keyDetails = '';
      } else if (stageIdx <= getStageIndex('collect_style')) {
        // Reset only details
        updated.keyDetails = '';
      }

      return updated;
    });

    // Reset stage to the specified stage
    setChatStage(fromStage);
  };

  // =========================================================================
  // EDGE-CASE FIX 5: Pre-submit validation
  // Returns null if valid, or error message if invalid
  // =========================================================================
  const validateTripPayload = (): string | null => {
    const primaryDest = getPrimaryDestination();
    if (!primaryDest) {
      return "I need a destination first. Where would you like to go?";
    }

    const adults = tripData.travelers?.adults || 0;
    const groupSize = adults + (tripData.travelers?.children || 0) + (tripData.travelers?.infants || 0);

    if (groupSize === 0 || adults === 0) {
      return "I need to know who's traveling. How many adults are going?";
    }

    if (!tripData.travelStyle) {
      return "What's your travel style? Budget, comfort, or luxury?";
    }

    // Date type should be set (default is 'specific')
    if (!tripData.dateType) {
      return "When are you planning to travel?";
    }

    return null; // Valid
  };

  // Reset everything for "Start over"
  const handleStartOver = () => {
    setTripData({
      destinations: [],
      isRoadTrip: false,
      dateType: 'specific',
      travelers: { adults: 1, children: 0, infants: 0 },
      currency: 'USD',
      travelStyle: 'comfort',
      keyDetails: '',
      passport: 'US',
    });
    setChatStage('collect_destination');
    setPassportConfirmed(false);
    setShowPassportPicker(false);
    setIsSubmitting(false);
    lastEmittedRef.current = null; // Clear deduplication state
    // EDGE-CASE FIX: Clean single message, not multiple intro messages
    setMessages([
      {
        id: Date.now().toString(),
        type: 'assistant',
        content: "Alright. Let's start fresh. Where do you want to go?",
        timestamp: new Date(),
        suggestions: ["Tokyo", "Bali", "Paris"],
      }
    ]);
    setRecentlyUpdated(new Set());
  };

  // Calculate what's missing for the CTA
  // EDGE-CASE FIX 4: Details is optional - don't include in missing requirements
  const getMissingRequirements = (): string[] => {
    const missing: string[] = [];
    if (!tripData.destinations?.length) missing.push('destination');
    // Only show dates as missing if we haven't moved past that stage
    if (getStageIndex(chatStage) < getStageIndex('collect_travelers')) {
      if (chatStage === 'collect_dates') missing.push('travel dates');
    }
    // Only show travelers as missing if we haven't moved past that stage
    if (getStageIndex(chatStage) < getStageIndex('collect_style')) {
      if (chatStage === 'collect_travelers') missing.push('travelers');
    }
    // Details is optional - never show as missing
    return missing;
  };

  // Compute budget for display
  const getComputedBudget = (): { total: number; perPerson: number; groupSize: number } => {
    const adults = tripData.travelers?.adults || 1;
    const children = tripData.travelers?.children || 0;
    const infants = tripData.travelers?.infants || 0;
    const style = tripData.travelStyle || 'comfort';
    const groupSize = adults + children + infants;
    const total = calculateBudget(style, adults, children, infants);
    const perPerson = groupSize > 0 ? Math.round(total / groupSize) : total;
    return { total, perPerson, groupSize };
  };

  // Get primary destination (first one)
  const getPrimaryDestination = () => {
    const dests = tripData.destinations || [];
    return dests[0] || null;
  };

  // Get additional destinations (if multi-city)
  const getAdditionalDestinations = () => {
    const dests = tripData.destinations || [];
    return dests.slice(1);
  };

  // Clear "recently updated" indicator after 2 seconds
  useEffect(() => {
    if (recentlyUpdated.size > 0) {
      const timer = setTimeout(() => setRecentlyUpdated(new Set()), 2000);
      return () => clearTimeout(timer);
    }
  }, [recentlyUpdated]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // =========================================================================
  // FIX 1: Stage-aware free-text routing (before LLM)
  // EDGE-CASE FIX 2: Handle out-of-order intent gracefully
  // =========================================================================
  const handleStageInput = (content: string): boolean => {
    const lower = content.toLowerCase();

    // -----------------------------------------------------------------------
    // EDGE-CASE FIX 2: Handle out-of-order style intent
    // If user mentions style keywords before they're at that stage, acknowledge
    // and store intent, but don't jump stages
    // -----------------------------------------------------------------------
    const styleMatch = lower.match(/\b(budget|cheap|luxury|premium|comfort|mid-?range)\b/i);
    if (styleMatch && getStageIndex(chatStage) < getStageIndex('collect_style')) {
      const styleIntent = styleMatch[1].toLowerCase();
      const mappedStyle = styleIntent.includes('budget') || styleIntent.includes('cheap') ? 'budget' :
                          styleIntent.includes('luxury') || styleIntent.includes('premium') ? 'luxury' : 'comfort';

      // Store intent for later
      setTripData(prev => ({ ...prev, travelStyle: mappedStyle }));
      setRecentlyUpdated(new Set(['style']));

      // Respond smartly based on current stage
      if (chatStage === 'collect_dates') {
        addAssistantMessage(
          `Got it — ${mappedStyle} style noted! We'll finalize that after we set dates.\n\nWhen are you planning to travel?`,
          ["I'm flexible with dates", "Traveling next month"]
        );
        return true;
      } else if (chatStage === 'collect_travelers') {
        addAssistantMessage(
          `Got it — ${mappedStyle} style noted! We'll finalize that after travelers.\n\nHow many people are going?`,
          ["Just me (solo)", "2 adults", "Family with kids"]
        );
        return true;
      }
    }

    switch (chatStage) {
      case 'collect_dates':
        // Handle month mentions or date-related input
        if (lower.match(/month|january|february|march|april|may|june|july|august|september|october|november|december|next week|next month|this month/i)) {
          setTripData(prev => ({ ...prev, flexibleMonth: content, dateType: 'flexible' }));
          setRecentlyUpdated(new Set(['dates']));
          addAssistantMessage(
            `Got it — I'll plan around ${content}. I'll check weather and events for the best timing.\n\nHow many travelers?`,
            ["Just me (solo)", "2 adults", "Family with kids"]
          );
          setChatStage('collect_travelers');
          return true;
        }
        // Handle specific date patterns
        if (lower.match(/\d{1,2}[\/-]\d{1,2}|\d{4}|specific|exact/i)) {
          setTripData(prev => ({ ...prev, dateType: 'specific' }));
          setRecentlyUpdated(new Set(['dates']));
          addAssistantMessage(
            "Noted — you have specific dates in mind. You can set exact dates in the panel.\n\nHow many travelers?",
            ["Just me (solo)", "2 adults", "Family with kids"]
          );
          setChatStage('collect_travelers');
          return true;
        }
        return false;

      case 'collect_travelers':
        // Handle traveler counts
        const soloMatch = lower.match(/solo|just me|alone|by myself|1 person|one person/i);
        const coupleMatch = lower.match(/2 adults?|two adults?|couple|partner|us two/i);
        const familyMatch = lower.match(/family|kids?|children|with my|(\d+)\s*adults?\s*(\d+)?\s*(kids?|children)?/i);

        if (soloMatch) {
          setTripData(prev => ({ ...prev, travelers: { adults: 1, children: 0, infants: 0 } }));
          setRecentlyUpdated(new Set(['travelers']));
          addAssistantMessage(
            "Solo trip — got it! I'll tailor recommendations for single travelers.\n\nWhat's your travel style?",
            ["Budget traveler", "Mid-range comfort", "Luxury experience"]
          );
          setChatStage('collect_style');
          return true;
        }
        if (coupleMatch) {
          setTripData(prev => ({ ...prev, travelers: { adults: 2, children: 0, infants: 0 } }));
          setRecentlyUpdated(new Set(['travelers']));
          addAssistantMessage(
            "Two adults — perfect for couples or friends.\n\nWhat's your travel style?",
            ["Budget traveler", "Mid-range comfort", "Luxury experience"]
          );
          setChatStage('collect_style');
          return true;
        }
        if (familyMatch) {
          setTripData(prev => ({ ...prev, travelers: { adults: 2, children: 2, infants: 0 } }));
          setRecentlyUpdated(new Set(['travelers']));
          addAssistantMessage(
            "Family trip! I'll include kid-friendly activities. Adjust exact numbers in the panel.\n\nWhat's your travel style?",
            ["Budget traveler", "Mid-range comfort", "Luxury experience"]
          );
          setChatStage('collect_style');
          return true;
        }
        return false;

      case 'collect_style':
        // Handle style mentions
        if (lower.match(/budget|cheap|backpack|hostel|save money/i)) {
          setTripData(prev => ({ ...prev, travelStyle: 'budget' }));
          setRecentlyUpdated(new Set(['style']));
          addAssistantMessage(
            "Budget-conscious — I'll prioritize value.\n\nAnything specific you want to do or see?",
            ["Continue to trip planning", "I have specific interests"]
          );
          setChatStage('collect_details');
          return true;
        }
        if (lower.match(/comfort|mid-?range|moderate|normal|standard/i)) {
          setTripData(prev => ({ ...prev, travelStyle: 'comfort' }));
          setRecentlyUpdated(new Set(['style']));
          addAssistantMessage(
            "Comfort — a great balance of quality and value.\n\nAnything specific you want to do or see?",
            ["Continue to trip planning", "I have specific interests"]
          );
          setChatStage('collect_details');
          return true;
        }
        if (lower.match(/luxury|premium|5 star|five star|high-?end|splurge/i)) {
          setTripData(prev => ({ ...prev, travelStyle: 'luxury' }));
          setRecentlyUpdated(new Set(['style']));
          addAssistantMessage(
            "Luxury it is — I'll find premium experiences.\n\nAnything specific you want to do or see?",
            ["Continue to trip planning", "I have specific interests"]
          );
          setChatStage('collect_details');
          return true;
        }
        return false;

      case 'collect_details':
        // Any free text at this stage is interests/details
        setTripData(prev => ({ ...prev, keyDetails: content }));
        setRecentlyUpdated(new Set(['details']));
        addAssistantMessage(
          "Perfect — I've noted your interests. I'll tailor the itinerary to match.\n\nYou're all set! Click **Create Itinerary** to check feasibility and get your personalized plan.",
          []
        );
        setChatStage('ready_to_create');
        return true;

      case 'ready_to_create':
        // At this stage, just remind them to click Create
        addAssistantMessage(
          "You're ready! Click **Create Itinerary** in the panel to check feasibility and generate your personalized trip plan.",
          []
        );
        return true;

      default:
        return false;
    }
  };

  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");

    // =========================================================================
    // FIX 1: Stage-aware routing BEFORE calling LLM
    // =========================================================================
    if (chatStage !== 'collect_destination') {
      const handled = handleStageInput(content);
      if (handled) {
        return; // Deterministic response already sent
      }
    }

    setIsLoading(true);

    try {
      // Extract trip details from user message (only for destination stage)
      const extracted = extractTripDetails(content);

      // Update trip data with extracted info (with deduplication)
      if (extracted.destinations && extracted.destinations.length > 0) {
        extracted.destinations.forEach(d => addDestination(d.city, d.country));

        // Update other extracted fields
        setTripData(prev => ({
          ...prev,
          ...(extracted.travelStyle && { travelStyle: extracted.travelStyle }),
          ...(extracted.isRoadTrip !== undefined && { isRoadTrip: extracted.isRoadTrip }),
          ...(extracted.travelers && { travelers: extracted.travelers }),
        }));

        // Advance to next stage if we got destination
        if (chatStage === 'collect_destination') {
          setChatStage('collect_dates');
        }
      }

      // =========================================================================
      // FIX 2: Only call LLM/generateAssistantResponse for destination stage
      // =========================================================================
      let aiResponse = '';
      let suggestions: string[] = [];

      if (chatStage === 'collect_destination') {
        // Try AI API for destination stage
        try {
          const chatHistory = messages.map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.content
          }));

          const response = await fetch('/api/chat/trip-planning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: content,
              chatHistory,
              tripContext: tripData,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            aiResponse = data.response || generateAssistantResponse(content, extracted);
            suggestions = data.suggestions || generateFollowUpSuggestions(extracted);
          } else {
            aiResponse = generateAssistantResponse(content, extracted);
            suggestions = generateFollowUpSuggestions(extracted);
          }
        } catch {
          aiResponse = generateAssistantResponse(content, extracted);
          suggestions = generateFollowUpSuggestions(extracted);
        }
      } else {
        // Non-destination stage fallback (shouldn't reach here often due to handleStageInput)
        aiResponse = "Got it! Let's keep going. What else would you like to add?";
        suggestions = [];
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        suggestions,
        tripData: extracted,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      // Fallback response on error
      const extracted = extractTripDetails(content);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: generateAssistantResponse(content, extracted),
        timestamp: new Date(),
        suggestions: generateFollowUpSuggestions(extracted),
        tripData: extracted,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Extract trip details from user message
  const extractTripDetails = (message: string): Partial<TripFormData> => {
    const lower = message.toLowerCase();
    const result: Partial<TripFormData> = { destinations: [] };

    // Extract destinations
    const destinations: Array<{ city: string; country: string }> = [];
    QUICK_DESTINATIONS.forEach(dest => {
      if (lower.includes(dest.name.toLowerCase()) || lower.includes(dest.country.toLowerCase())) {
        destinations.push({ city: dest.name, country: dest.country });
      }
    });

    // Common destinations not in quick list
    const commonDests: Record<string, string> = {
      'new york': 'USA', 'london': 'UK', 'barcelona': 'Spain', 'amsterdam': 'Netherlands',
      'bangkok': 'Thailand', 'singapore': 'Singapore', 'sydney': 'Australia',
      'maldives': 'Maldives', 'switzerland': 'Switzerland', 'new zealand': 'New Zealand',
      'vietnam': 'Vietnam', 'thailand': 'Thailand', 'japan': 'Japan', 'korea': 'South Korea',
    };

    Object.entries(commonDests).forEach(([city, country]) => {
      if (lower.includes(city)) {
        destinations.push({ city: city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), country });
      }
    });

    result.destinations = destinations;

    // Extract travel style
    if (lower.includes('budget') || lower.includes('cheap') || lower.includes('backpack')) {
      result.travelStyle = 'budget';
    } else if (lower.includes('luxury') || lower.includes('premium') || lower.includes('5 star') || lower.includes('honeymoon')) {
      result.travelStyle = 'luxury';
    }

    // Extract road trip
    if (lower.includes('road trip') || lower.includes('roadtrip') || lower.includes('drive')) {
      result.isRoadTrip = true;
    }

    // Extract duration
    const daysMatch = lower.match(/(\d+)\s*(day|night)/);
    const weeksMatch = lower.match(/(\d+)\s*week/);
    if (daysMatch) {
      // Will be used for date estimation
    }

    // Extract travelers
    if (lower.includes('family')) {
      result.travelers = { adults: 2, children: 2, infants: 0 };
    } else if (lower.includes('couple') || lower.includes('romantic') || lower.includes('honeymoon')) {
      result.travelers = { adults: 2, children: 0, infants: 0 };
    } else if (lower.includes('solo')) {
      result.travelers = { adults: 1, children: 0, infants: 0 };
    }

    return result;
  };

  // Generate assistant response based on extracted data - with explicit acknowledgment
  const generateAssistantResponse = (userMessage: string, extracted: Partial<TripFormData>): string => {
    const dests = extracted.destinations || [];
    const lower = userMessage.toLowerCase();

    // Handle date flexibility response
    if (lower.includes('flexible') && lower.includes('date')) {
      setRecentlyUpdated(new Set(['dates']));
      return "Got it — I've marked your dates as flexible. This gives us more options for finding the best deals and weather.\n\nHow many travelers will be joining? (e.g., 2 adults, 1 child)";
    }

    // Handle "next month" or specific timing
    if (lower.includes('next month') || lower.includes('traveling next')) {
      setRecentlyUpdated(new Set(['dates']));
      return "Okay, I've noted you're looking at next month. I'll check visa processing times to make sure that's feasible.\n\nHow many people are traveling?";
    }

    if (dests.length > 0) {
      const destNames = dests.map(d => d.city).join(', ');
      // Mark destination as recently updated
      setRecentlyUpdated(new Set(['destinations']));

      let response = `Got it — I've added ${destNames} to your trip. `;

      if (extracted.isRoadTrip) {
        response += "A road trip sounds exciting! ";
      }

      if (extracted.travelStyle === 'luxury') {
        response += "I'll find you the best luxury experiences. ";
      } else if (extracted.travelStyle === 'budget') {
        response += "I'll help you make the most of your budget. ";
      }

      response += "\n\nWhen are you planning to travel? You can give me specific dates or just tell me which month works best.";
      return response;
    }

    if (lower.includes('help') || lower.includes('how')) {
      return "I can help you plan the perfect trip! Just tell me:\n\n• Where you want to go (one or multiple cities)\n• When you're traveling\n• Who's coming with you\n• Your budget and travel style\n\nI'll check visa requirements and estimate costs as we go.";
    }

    return "I didn't catch a specific destination. Where would you like to go? You can mention cities or countries, and I'll check if it's feasible for your passport.";
  };

  // Generate follow-up suggestions
  const generateFollowUpSuggestions = (extracted: Partial<TripFormData>): string[] => {
    const dests = extracted.destinations || [];

    if (dests.length > 0) {
      return [
        "I'm flexible with dates",
        "Traveling next month",
        "Add another destination",
      ];
    }

    return [
      "Suggest popular destinations",
      "I want a beach vacation",
      "Looking for adventure",
    ];
  };

  // Quick reply handlers - deterministic, no LLM call
  // Uses addDestination helper for deduplication, setChatStage for wizard flow
  const QUICK_REPLY_HANDLERS: Record<string, {
    update?: () => void;
    response: string;
    suggestions: string[];
  }> = {
    // === DATE STAGE ===
    "I'm flexible with dates": {
      update: () => {
        setTripData(prev => ({ ...prev, dateType: 'flexible' }));
        setRecentlyUpdated(new Set(['dates']));
        setChatStage('collect_travelers');
      },
      response: "Got it — I've marked your dates as flexible. This gives us more options for finding the best deals and weather.\n\nHow many travelers will be joining?",
      suggestions: ["Just me (solo)", "2 adults", "Family with kids"],
    },
    "Traveling next month": {
      update: () => {
        setTripData(prev => ({ ...prev, dateType: 'specific', flexibleMonth: 'next' }));
        setRecentlyUpdated(new Set(['dates']));
        setChatStage('collect_travelers');
      },
      response: "Noted — you're looking at next month. I'll check visa processing times to make sure that's feasible.\n\nHow many people are traveling?",
      suggestions: ["Just me (solo)", "2 adults", "Family with kids"],
    },
    "Add another destination": {
      update: () => {
        setChatStage('collect_destination');
      },
      response: "Sure! Where else would you like to visit? I can check if multi-city trips make sense for visa and timing.",
      suggestions: ["Tokyo", "Bali", "Paris"],
    },

    // === TRAVELERS STAGE ===
    "Just me (solo)": {
      update: () => {
        setTripData(prev => ({ ...prev, travelers: { adults: 1, children: 0, infants: 0 } }));
        setRecentlyUpdated(new Set(['travelers']));
        setChatStage('collect_style');
      },
      response: "Solo trip — got it! I'll tailor recommendations for single travelers.\n\nWhat's your travel style?",
      suggestions: ["Budget traveler", "Mid-range comfort", "Luxury experience"],
    },
    "2 adults": {
      update: () => {
        setTripData(prev => ({ ...prev, travelers: { adults: 2, children: 0, infants: 0 } }));
        setRecentlyUpdated(new Set(['travelers']));
        setChatStage('collect_style');
      },
      response: "Two adults — perfect for couples or friends traveling together.\n\nWhat's your travel style?",
      suggestions: ["Budget traveler", "Mid-range comfort", "Luxury experience"],
    },
    "Family with kids": {
      update: () => {
        setTripData(prev => ({ ...prev, travelers: { adults: 2, children: 2, infants: 0 } }));
        setRecentlyUpdated(new Set(['travelers']));
        setChatStage('collect_style');
      },
      response: "Family trip! I'll include kid-friendly activities and accommodations.\n\nYou can adjust the exact number of children in the panel. What's your travel style?",
      suggestions: ["Budget traveler", "Mid-range comfort", "Luxury experience"],
    },

    // === STYLE STAGE ===
    "Budget traveler": {
      update: () => {
        setTripData(prev => ({ ...prev, travelStyle: 'budget' }));
        setRecentlyUpdated(new Set(['style']));
        setChatStage('collect_details');
      },
      response: "Budget-conscious — I'll prioritize value and help you make the most of every dollar.\n\nAnything specific you want to do or see?",
      suggestions: ["Continue to trip planning", "I have specific interests"],
    },
    "Mid-range comfort": {
      update: () => {
        setTripData(prev => ({ ...prev, travelStyle: 'comfort' }));
        setRecentlyUpdated(new Set(['style']));
        setChatStage('collect_details');
      },
      response: "Comfort — a great balance of quality and value.\n\nAnything specific you want to do or see?",
      suggestions: ["Continue to trip planning", "I have specific interests"],
    },
    "Luxury experience": {
      update: () => {
        setTripData(prev => ({ ...prev, travelStyle: 'luxury' }));
        setRecentlyUpdated(new Set(['style']));
        setChatStage('collect_details');
      },
      response: "Luxury it is — I'll find premium experiences and top-rated stays.\n\nAnything specific you want to do or see?",
      suggestions: ["Continue to trip planning", "I have specific interests"],
    },

    // === DETAILS STAGE (optional - can skip) ===
    "I have specific interests": {
      update: () => {
        setChatStage('collect_details');
      },
      response: "Great! Type your interests below — things like:\n\n• **Activities**: hiking, scuba diving, cooking classes\n• **Food**: street food, fine dining, vegan options\n• **Vibes**: romantic, family-friendly, off-the-beaten-path\n• **Must-sees**: specific landmarks or experiences\n\nI'll tailor your itinerary to match.",
      suggestions: [],
    },
    "Continue to trip planning": {
      update: () => {
        setChatStage('ready_to_create');
      },
      response: "Perfect! You're all set. Click **Plan My Trip** to check feasibility and get your personalized plan.",
      suggestions: [],
    },
    // EDGE-CASE FIX 4: Allow skipping details (optional step)
    "Skip for now": {
      update: () => {
        setChatStage('ready_to_create');
      },
      response: "No problem! I'll create a balanced itinerary. Click **Plan My Trip** when you're ready.",
      suggestions: [],
    },

    // === PASSPORT CONFIRMATION ===
    "Yes, that's correct": {
      update: () => {
        setPassportConfirmed(true);
      },
      response: "Great! Click **Plan My Trip** to check feasibility and generate your itinerary.",
      suggestions: [],
    },
    "I need to change my passport": {
      update: () => {
        setShowPassportPicker(true);
      },
      response: "No problem! Select your passport country in the panel on the right, then click **Plan My Trip**.",
      suggestions: [],
    },

    // === RETRY ===
    "Try again": {
      update: () => {
        setIsSubmitting(false);
      },
      response: "Ready when you are! Click **Plan My Trip** to try again.",
      suggestions: [],
    },

    // === DESTINATION DISCOVERY ===
    "Suggest popular destinations": {
      response: "Here are some popular destinations based on current travel trends:\n\n🗼 **Tokyo** - Culture, food, and tech\n🏝️ **Bali** - Beaches and wellness\n🗼 **Paris** - Romance and history\n🏙️ **Dubai** - Luxury and adventure\n\nTap one to start, or tell me your own destination.",
      suggestions: ["Tokyo", "Bali", "Paris", "Dubai"],
    },
    "I want a beach vacation": {
      response: "Beach vibes! Here are some top beach destinations:\n\n🏝️ **Bali** - Surfing, temples, rice terraces\n🇹🇭 **Thailand** - Islands, street food\n🇲🇻 **Maldives** - Ultimate overwater luxury\n🇬🇷 **Santorini** - Dramatic cliffs, sunsets\n\nWhich sounds good?",
      suggestions: ["Bali", "Thailand", "Maldives"],
    },
    "Looking for adventure": {
      response: "Adventure seeker! Here are some thrilling options:\n\n🏔️ **New Zealand** - Bungee, hiking, LOTR landscapes\n🇵🇪 **Peru** - Machu Picchu, Amazon\n🇮🇸 **Iceland** - Glaciers, volcanoes, northern lights\n🇿🇦 **South Africa** - Safari, diving\n\nWhat catches your eye?",
      suggestions: ["New Zealand", "Iceland", "South Africa"],
    },

    // === DESTINATION QUICK REPLIES (with deduplication) ===
    "Tokyo": {
      update: () => {
        addDestination('Tokyo', 'Japan');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Tokyo, Japan** to your trip! A fantastic choice for culture, food, and tech.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Bali": {
      update: () => {
        addDestination('Bali', 'Indonesia');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Bali, Indonesia** to your trip! Perfect for beaches, temples, and wellness.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Paris": {
      update: () => {
        addDestination('Paris', 'France');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Paris, France** to your trip! The city of lights awaits.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Dubai": {
      update: () => {
        addDestination('Dubai', 'UAE');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Dubai, UAE** to your trip! Luxury, adventure, and futuristic architecture.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Thailand": {
      update: () => {
        addDestination('Bangkok', 'Thailand');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Bangkok, Thailand** to your trip! Amazing food, temples, and island hopping nearby.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Maldives": {
      update: () => {
        addDestination('Malé', 'Maldives');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Maldives** to your trip! Ultimate paradise with overwater villas.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "New Zealand": {
      update: () => {
        addDestination('Auckland', 'New Zealand');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **New Zealand** to your trip! Adventure awaits with stunning landscapes.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Iceland": {
      update: () => {
        addDestination('Reykjavik', 'Iceland');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Iceland** to your trip! Glaciers, volcanoes, and northern lights.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "South Africa": {
      update: () => {
        addDestination('Cape Town', 'South Africa');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **South Africa** to your trip! Safari, wine country, and stunning coastline.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Rome": {
      update: () => {
        addDestination('Rome', 'Italy');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Rome, Italy** to your trip! Ancient history, incredible food, and timeless art.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
    "Santorini": {
      update: () => {
        addDestination('Santorini', 'Greece');
        setChatStage('collect_dates');
      },
      response: "Got it — I've added **Santorini, Greece** to your trip! Stunning sunsets and iconic blue domes.\n\nWhen are you planning to travel?",
      suggestions: ["I'm flexible with dates", "Traveling next month", "Add another destination"],
    },
  };

  // Handle quick reply - deterministic, no LLM
  const handleQuickReply = (suggestion: string) => {
    const handler = QUICK_REPLY_HANDLERS[suggestion];

    // If no handler, fall back to regular message
    if (!handler) {
      handleSendMessage(suggestion);
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: suggestion,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Run state update if any
    if (handler.update) {
      handler.update();
    }

    // Add deterministic assistant response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: handler.response,
        timestamp: new Date(),
        suggestions: handler.suggestions,
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 300); // Small delay for natural feel
  };

  // Handle clicking a quick destination pill (uses deduped addDestination + chat message)
  const handleQuickDestinationClick = (city: string, country: string) => {
    // Check if already exists
    const existingDests = tripData.destinations || [];
    const newKey = getDestinationKey(city, country);
    const exists = existingDests.some(d => getDestinationKey(d.city, d.country) === newKey);

    if (exists) {
      // Already have this destination - just confirm
      addAssistantMessage(`**${city}** is already in your trip! Would you like to add a different destination?`, ["Bali", "Paris", "Dubai"]);
      return;
    }

    // Add destination with deduplication
    addDestination(city, country);
    setChatStage('collect_dates');

    // Add chat message
    const userMsg: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: `I want to visit ${city}, ${country}`,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      addAssistantMessage(
        `Got it — I've added **${city}, ${country}** to your trip!\n\nWhen are you planning to travel?`,
        ["I'm flexible with dates", "Traveling next month", "Add another destination"]
      );
    }, 300);
  };

  // Remove destination (with chat sync + cascade reset)
  const removeDestination = (index: number) => {
    const removed = tripData.destinations?.[index];
    const remainingCount = (tripData.destinations?.length || 0) - 1;

    setTripData(prev => ({
      ...prev,
      destinations: prev.destinations?.filter((_, i) => i !== index) || [],
    }));

    // EDGE-CASE FIX 3: If no destinations left, cascade reset everything downstream
    if (remainingCount <= 0) {
      cascadeResetFromStage('collect_destination');
    }

    // Optional: confirm in chat
    if (removed) {
      addAssistantMessage(`Removed **${removed.city}** from your trip.`, []);
    }
  };

  // =========================================================================
  // CREATE TRIP - with all guardrails matching /create page behavior
  // =========================================================================
  const handleCreateTrip = () => {
    // -------------------------------------------------------------------
    // EDGE-CASE FIX 5: Pre-submit validation (always validate, even if CTA shows "Ready")
    // This catches state changes during async updates
    // -------------------------------------------------------------------
    const validationError = validateTripPayload();
    if (validationError) {
      addAssistantMessage(validationError, ["Tokyo", "Bali", "Paris"]);
      return;
    }

    // -------------------------------------------------------------------
    // Get validated values (safe after validation passes)
    // -------------------------------------------------------------------
    const primaryDest = getPrimaryDestination()!; // Safe - validated above
    const adults = tripData.travelers?.adults || 1;
    const children = tripData.travelers?.children || 0;
    const infants = tripData.travelers?.infants || 0;
    const groupSize = adults + children + infants;

    // -------------------------------------------------------------------
    // VALIDATION: Passport confirmation (if still default)
    // -------------------------------------------------------------------
    if (!passportConfirmed && tripData.passport === 'US') {
      // Soft confirmation - show in chat
      addAssistantMessage(
        `I'll check visa requirements using a **${COMMON_PASSPORTS[tripData.passport || 'US']} passport**. Is that correct?\n\nIf not, change it in the panel before continuing.`,
        ["Yes, that's correct", "I need to change my passport"]
      );
      setPassportConfirmed(true); // Mark as shown, allow next click to proceed
      return;
    }

    // -------------------------------------------------------------------
    // PREVENT DOUBLE SUBMISSION
    // -------------------------------------------------------------------
    if (isSubmitting || createTrip.isPending) return;

    // -------------------------------------------------------------------
    // ANALYTICS: Track click
    // -------------------------------------------------------------------
    trackTripEvent(0, 'chat_plan_clicked', {
      destination: `${primaryDest.city}, ${primaryDest.country}`,
      passport: tripData.passport,
      travelStyle: tripData.travelStyle,
      groupSize,
      hasAdditionalDestinations: getAdditionalDestinations().length > 0,
    });

    setIsSubmitting(true);

    // -------------------------------------------------------------------
    // FIX 1: DESTINATION MAPPING - Use only primary destination
    // Put additional destinations in notes/interests
    // -------------------------------------------------------------------
    const destString = `${primaryDest.city}, ${primaryDest.country}`;
    const additionalDests = getAdditionalDestinations();
    let interestsText = tripData.keyDetails || '';

    if (additionalDests.length > 0) {
      const additionalNote = `Also considering: ${additionalDests.map(d => `${d.city}, ${d.country}`).join(', ')}`;
      interestsText = interestsText ? `${interestsText}. ${additionalNote}` : additionalNote;
    }

    // -------------------------------------------------------------------
    // FIX 2: DATES MAPPING - Generate real dates instead of "Flexible dates"
    // -------------------------------------------------------------------
    const isFlexible = tripData.dateType === 'flexible';
    const datesString = getDefaultDatesString(isFlexible, tripData.flexibleMonth);

    // -------------------------------------------------------------------
    // FIX 3: BUDGET GUARDRAILS - Use proper calculation with infant handling
    // -------------------------------------------------------------------
    const style = tripData.travelStyle || 'comfort';
    const budget = calculateBudget(style, adults, children, infants);

    // -------------------------------------------------------------------
    // FIX 4: INTERESTS MAPPING - Keep as text, don't force array
    // Only split if contains commas and looks like a list
    // -------------------------------------------------------------------
    let interests: string[] | undefined;
    if (interestsText) {
      const hasCommas = interestsText.includes(',');
      const isShortItems = interestsText.split(',').every(s => s.trim().length < 50);
      if (hasCommas && isShortItems) {
        // Looks like a list: "food, temples, beaches"
        interests = interestsText.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        // Keep as single text item
        interests = [interestsText];
      }
    }

    // -------------------------------------------------------------------
    // BUILD TRIP REQUEST
    // -------------------------------------------------------------------
    // Add flexibility note to interests if flexible dates
    if (isFlexible && interests) {
      interests.push('Flexible dates - optimize for best weather and deals');
    } else if (isFlexible) {
      interests = ['Flexible dates - optimize for best weather and deals'];
    }

    const tripRequest: CreateTripRequest = {
      passport: tripData.passport || 'US',
      destination: destString,
      dates: datesString,
      budget,
      currency: tripData.currency || 'USD',
      groupSize,
      adults,
      children,
      infants,
      travelStyle: style,
      interests,
    };

    // -------------------------------------------------------------------
    // SUBMIT THE TRIP
    // -------------------------------------------------------------------
    createTrip.mutate(tripRequest, {
      onSuccess: (response) => {
        // Analytics: track success
        trackTripEvent(response.id, 'chat_plan_success', {
          destination: destString,
          budget,
          groupSize,
        });

        console.log("Trip created from chat:", response);
        // Navigate to feasibility check page (same as /create)
        setLocation(`/trips/${response.id}/feasibility`);
      },
      onError: (error: any) => {
        // Analytics: track failure
        trackTripEvent(0, 'chat_plan_failed', {
          errorType: error?.message || 'unknown',
          destination: destString,
        });

        console.error("Failed to create trip:", error);
        setIsSubmitting(false);

        // -------------------------------------------------------------------
        // FIX 6: ERROR HANDLING - Mirror /create behavior
        // -------------------------------------------------------------------
        const errorMessage = error?.message?.toLowerCase() || '';

        if (errorMessage.includes('validation') || errorMessage.includes('required')) {
          addAssistantMessage(
            "Some required information is missing. Please check that you have a destination, dates, and traveler count set.",
            []
          );
        } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          addAssistantMessage(
            "Connection issue. Please check your internet and try again.",
            ["Try again"]
          );
        } else {
          addAssistantMessage(
            "Sorry, there was an error creating your trip. Please try again or use the [form-based creator](/create).",
            ["Try again"]
          );
        }
      },
    });
  };

  // Handle "Yes, that's correct" for passport confirmation
  const handlePassportConfirm = () => {
    setPassportConfirmed(true);
    addAssistantMessage(
      "Great! Click **Plan My Trip** to check feasibility and generate your itinerary.",
      []
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 md:ml-[240px] flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg text-slate-900">Plan Your Trip</h1>
                <p className="text-sm text-slate-500">Start a new trip or continue planning</p>
              </div>
            </div>
            {/* Skip to forms link */}
            <a
              href="/create"
              className="text-sm text-slate-400 hover:text-amber-600 transition-colors"
            >
              Prefer forms? →
            </a>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : ''}`}>
                    {message.type === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-xs font-medium text-slate-500">VoyageAI</span>
                      </div>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {/* Suggestions - handled deterministically via handleQuickReply */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleQuickReply(suggestion)}
                            className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-600 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* What VoyageAI will do - Outcome preview */}
          {messages.length <= 2 && (
            <div className="px-6 pb-4">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 rounded-xl p-4 mb-4">
                <p className="text-sm font-medium text-slate-700 mb-2">What VoyageAI will do:</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500">✓</span>
                    <span>Check visa and entry requirements for your passport</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500">✓</span>
                    <span>Validate timing and flag any risks</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500">✓</span>
                    <span>Estimate real costs based on your budget</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="text-emerald-500">✓</span>
                    <span>Generate a day-by-day itinerary (if feasible)</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-emerald-200/50">
                  Chat naturally — I'll fill in trip details as we go.
                </p>
              </div>
            </div>
          )}

          {/* Quick Destinations */}
          {messages.length <= 2 && (
            <div className="px-6 pb-4">
              <p className="text-sm text-slate-500 mb-3">Popular destinations:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.name}
                    onClick={() => handleQuickDestinationClick(dest.name, dest.country)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                  >
                    <span>{dest.emoji}</span>
                    <span className="text-sm font-medium text-slate-700">{dest.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area - FIX 5: Lock when ready_to_create */}
          <div className="bg-white border-t border-slate-200 p-4">
            {chatStage === 'ready_to_create' ? (
              // Locked state - prompt to click Create
              <div className="flex items-center justify-center gap-3 py-2">
                <div className="flex items-center gap-2 text-emerald-600">
                  <span className="text-lg">✓</span>
                  <span className="font-medium">Ready to go!</span>
                </div>
                <span className="text-slate-400">→</span>
                <span className="text-slate-600">Click <strong>Create Itinerary</strong> in the panel</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }}
                className="flex items-center gap-3"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    chatStage === 'collect_destination' ? "Where do you want to go? (e.g., Japan, Bali, Paris)" :
                    chatStage === 'collect_dates' ? "When? (e.g., March, next month, flexible)" :
                    chatStage === 'collect_travelers' ? "Who's traveling? (e.g., 2 adults, family with kids)" :
                    chatStage === 'collect_style' ? "What style? (e.g., budget, comfort, luxury)" :
                    chatStage === 'collect_details' ? "Any specific interests? (e.g., food tours, hiking, museums)" :
                    "Type a message..."
                  }
                  className="flex-1 px-4 py-3 bg-slate-100 border-0 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="w-12 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white p-0"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Trip Details Panel - Always visible */}
        <div className="w-[380px] bg-white border-l border-slate-200 flex-shrink-0 hidden lg:block">
          <div className="h-full flex flex-col">
            {/* Panel Header with Progress Tracker */}
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-lg text-slate-900">Your Trip</h2>
                {tripData.destinations?.length ? (
                  <button
                    onClick={handleStartOver}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
                    title="Start over"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Start over
                  </button>
                ) : null}
              </div>

              {/* Progress Steps */}
              <div className="flex items-center gap-1">
                {STAGE_ORDER.slice(0, 5).map((stage, i) => {
                  const isComplete = isStageComplete(stage);
                  const isCurrent = stage === chatStage;
                  const isPending = getStageIndex(stage) > getStageIndex(chatStage);

                  return (
                    <div key={stage} className="flex items-center flex-1">
                      <div
                        className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold transition-all ${
                          isComplete
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                            ? 'bg-amber-500 text-white ring-2 ring-amber-200'
                            : 'bg-slate-200 text-slate-400'
                        }`}
                        title={STAGE_LABELS[stage]}
                      >
                        {isComplete ? <Check className="w-3 h-3" /> : i + 1}
                      </div>
                      {i < 4 && (
                        <div className={`flex-1 h-0.5 mx-1 ${isComplete ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {chatStage === 'ready_to_create'
                  ? 'Ready to plan!'
                  : `Step ${getStageIndex(chatStage) + 1}: ${STAGE_LABELS[chatStage]}`
                }
              </p>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Destinations */}
                  <div className={`transition-all duration-300 ${recentlyUpdated.has('destinations') ? 'ring-2 ring-emerald-400 ring-offset-2 rounded-xl' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        Destinations
                        {recentlyUpdated.has('destinations') && (
                          <span className="text-xs text-emerald-500 font-medium ml-1">✓ Updated</span>
                        )}
                      </label>
                      {tripData.destinations && tripData.destinations.length > 1 && (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={tripData.isRoadTrip}
                            onChange={(e) => setTripData(prev => ({ ...prev, isRoadTrip: e.target.checked }))}
                            className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                          />
                          <Car className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">Road Trip</span>
                        </label>
                      )}
                    </div>

                    <div className="space-y-2">
                      {tripData.destinations?.map((dest, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                        >
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center text-sm font-bold">
                            {i + 1}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{dest.city}</p>
                            <p className="text-xs text-slate-500">{dest.country}</p>
                          </div>
                          <button
                            onClick={() => removeDestination(i)}
                            className="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      <button
                        onClick={() => inputRef.current?.focus()}
                        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:border-amber-300 hover:text-amber-600 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">Add destination</span>
                      </button>
                    </div>
                  </div>

                  {/* Date Type - with stage guardrails */}
                  <div className={`transition-all duration-300 ${!canEditStage('collect_dates') ? 'opacity-40 pointer-events-none' : ''} ${recentlyUpdated.has('dates') ? 'ring-2 ring-emerald-400 ring-offset-2 rounded-xl p-2 -m-2' : ''}`}>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      When
                      {!canEditStage('collect_dates') && (
                        <span className="text-xs text-slate-400 font-normal ml-1">(pick destination first)</span>
                      )}
                      {recentlyUpdated.has('dates') && (
                        <span className="text-xs text-emerald-500 font-medium ml-1">✓ Updated</span>
                      )}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (!canEditStage('collect_dates')) return;
                          if (tripData.dateType !== 'specific') {
                            setTripData(prev => ({ ...prev, dateType: 'specific' }));
                            emitStepConfirm('dates_specific', new Set(['dates']));
                          }
                        }}
                        disabled={!canEditStage('collect_dates')}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          tripData.dateType === 'specific'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        } ${!canEditStage('collect_dates') ? 'cursor-not-allowed' : ''}`}
                      >
                        Specific dates
                      </button>
                      <button
                        onClick={() => {
                          if (!canEditStage('collect_dates')) return;
                          if (tripData.dateType !== 'flexible') {
                            setTripData(prev => ({ ...prev, dateType: 'flexible' }));
                            emitStepConfirm('dates_flexible', new Set(['dates']));
                          }
                        }}
                        disabled={!canEditStage('collect_dates')}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          tripData.dateType === 'flexible'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        } ${!canEditStage('collect_dates') ? 'cursor-not-allowed' : ''}`}
                      >
                        I'm flexible
                      </button>
                    </div>

                    {tripData.dateType === 'flexible' && canEditStage('collect_dates') && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-600">
                          Tell me which month works best for you, and I'll suggest the ideal dates based on weather and events.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Travelers - with stage guardrails */}
                  <div className={`transition-all duration-300 ${!canEditStage('collect_travelers') ? 'opacity-40 pointer-events-none' : ''} ${recentlyUpdated.has('travelers') ? 'ring-2 ring-emerald-400 ring-offset-2 rounded-xl p-2 -m-2' : ''}`}>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-amber-500" />
                      Travelers
                      {!canEditStage('collect_travelers') && (
                        <span className="text-xs text-slate-400 font-normal ml-1">(pick dates first)</span>
                      )}
                      {recentlyUpdated.has('travelers') && (
                        <span className="text-xs text-emerald-500 font-medium ml-1">✓ Updated</span>
                      )}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 mb-1">Adults</p>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setTripData(prev => ({
                              ...prev,
                              travelers: {
                                ...prev.travelers!,
                                adults: Math.max(1, (prev.travelers?.adults || 1) - 1)
                              }
                            }))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-sm"
                          >
                            -
                          </button>
                          <span className="font-bold text-slate-900">{tripData.travelers?.adults || 1}</span>
                          <button
                            onClick={() => setTripData(prev => ({
                              ...prev,
                              travelers: {
                                ...prev.travelers!,
                                adults: (prev.travelers?.adults || 1) + 1
                              }
                            }))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 mb-1">Children</p>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setTripData(prev => ({
                              ...prev,
                              travelers: {
                                ...prev.travelers!,
                                children: Math.max(0, (prev.travelers?.children || 0) - 1)
                              }
                            }))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-sm"
                          >
                            -
                          </button>
                          <span className="font-bold text-slate-900">{tripData.travelers?.children || 0}</span>
                          <button
                            onClick={() => setTripData(prev => ({
                              ...prev,
                              travelers: {
                                ...prev.travelers!,
                                children: (prev.travelers?.children || 0) + 1
                              }
                            }))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <p className="text-xs text-slate-500 mb-1">Infants</p>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setTripData(prev => ({
                              ...prev,
                              travelers: {
                                ...prev.travelers!,
                                infants: Math.max(0, (prev.travelers?.infants || 0) - 1)
                              }
                            }))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-sm"
                          >
                            -
                          </button>
                          <span className="font-bold text-slate-900">{tripData.travelers?.infants || 0}</span>
                          <button
                            onClick={() => setTripData(prev => ({
                              ...prev,
                              travelers: {
                                ...prev.travelers!,
                                infants: (prev.travelers?.infants || 0) + 1
                              }
                            }))}
                            className="w-6 h-6 rounded-full bg-white border border-slate-200 text-slate-600 text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Travel Style - with stage guardrails */}
                  <div className={`transition-all duration-300 ${!canEditStage('collect_style') ? 'opacity-40 pointer-events-none' : ''} ${recentlyUpdated.has('style') ? 'ring-2 ring-emerald-400 ring-offset-2 rounded-xl p-2 -m-2' : ''}`}>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Wallet className="w-4 h-4 text-amber-500" />
                      Travel Style
                      {!canEditStage('collect_style') && (
                        <span className="text-xs text-slate-400 font-normal ml-1">(set travelers first)</span>
                      )}
                      {recentlyUpdated.has('style') && (
                        <span className="text-xs text-emerald-500 font-medium ml-1">✓ Updated</span>
                      )}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'budget', label: 'Budget', emoji: '🎒', stepKey: 'style_budget' as StepKey },
                        { value: 'comfort', label: 'Comfort', emoji: '🧳', stepKey: 'style_comfort' as StepKey },
                        { value: 'luxury', label: 'Luxury', emoji: '✨', stepKey: 'style_luxury' as StepKey },
                      ].map((style) => (
                        <button
                          key={style.value}
                          onClick={() => {
                            if (!canEditStage('collect_style')) return;
                            if (tripData.travelStyle !== style.value) {
                              setTripData(prev => ({ ...prev, travelStyle: style.value as any }));
                              emitStepConfirm(style.stepKey, new Set(['style']));
                            }
                          }}
                          disabled={!canEditStage('collect_style')}
                          className={`p-3 rounded-xl border-2 text-center transition-colors ${
                            tripData.travelStyle === style.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-slate-200 hover:border-slate-300'
                          } ${!canEditStage('collect_style') ? 'cursor-not-allowed' : ''}`}
                        >
                          <div className="text-2xl mb-1">{style.emoji}</div>
                          <div className="text-xs font-medium text-slate-700">{style.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key Details - with stage guardrails */}
                  <div className={`transition-all duration-300 ${!canEditStage('collect_details') ? 'opacity-40 pointer-events-none' : ''}`}>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-amber-500" />
                      Key Details
                      {!canEditStage('collect_details') && (
                        <span className="text-xs text-slate-400 font-normal ml-1">(set style first)</span>
                      )}
                    </label>
                    <textarea
                      value={tripData.keyDetails}
                      onChange={(e) => setTripData(prev => ({ ...prev, keyDetails: e.target.value }))}
                      onBlur={() => {
                        // When user finishes typing details, advance to ready_to_create
                        if (tripData.keyDetails?.trim() && chatStage === 'collect_details') {
                          emitStepConfirm('details_added', new Set(['details']));
                        }
                      }}
                      placeholder="Any specific interests, dietary requirements, accessibility needs, must-see places..."
                      disabled={!canEditStage('collect_details')}
                      className="w-full p-3 bg-slate-50 border-0 rounded-xl text-slate-900 placeholder:text-slate-400 resize-none h-24 focus:ring-2 focus:ring-amber-500 focus:outline-none disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* =========================================================
                      FIX 5: PASSPORT SECTION - Always visible
                      ========================================================= */}
                  <div className={`transition-all duration-300 ${recentlyUpdated.has('passport') ? 'ring-2 ring-emerald-400 ring-offset-2 rounded-xl p-2 -m-2' : ''}`}>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Flag className="w-4 h-4 text-amber-500" />
                      Passport
                      {!passportConfirmed && tripData.passport === 'US' && (
                        <span className="text-xs text-amber-500 font-normal ml-1">(confirm before planning)</span>
                      )}
                      {recentlyUpdated.has('passport') && (
                        <span className="text-xs text-emerald-500 font-medium ml-1">✓ Updated</span>
                      )}
                    </label>

                    {showPassportPicker ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(COMMON_PASSPORTS).slice(0, 9).map(([code, name]) => (
                            <button
                              key={code}
                              onClick={() => {
                                setTripData(prev => ({ ...prev, passport: code }));
                                setPassportConfirmed(true);
                                setShowPassportPicker(false);
                                setRecentlyUpdated(new Set(['passport']));
                                addAssistantMessage(`Passport updated to **${name}**. I'll check visa requirements accordingly.`, []);
                              }}
                              className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                                tripData.passport === code
                                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              {code}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowPassportPicker(false)}
                          className="w-full text-xs text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPassportPicker(true)}
                        className="w-full p-3 bg-slate-50 rounded-xl text-left flex items-center justify-between hover:bg-slate-100 transition-colors"
                      >
                        <div>
                          <span className="font-medium text-slate-900">
                            {COMMON_PASSPORTS[tripData.passport || 'US'] || tripData.passport}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">({tripData.passport})</span>
                        </div>
                        <span className="text-xs text-amber-600">Change</span>
                      </button>
                    )}
                  </div>

                  {/* =========================================================
                      FIX 3: BUDGET PREVIEW - Show estimated budget
                      ========================================================= */}
                  {tripData.destinations?.length ? (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-medium text-slate-700">Estimated Budget</span>
                      </div>
                      {(() => {
                        const { total, perPerson, groupSize } = getComputedBudget();
                        const currency = tripData.currency || 'USD';
                        const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });

                        return (
                          <div className="space-y-1">
                            <div className="flex items-baseline justify-between">
                              <span className="text-2xl font-bold text-emerald-700">
                                {formatter.format(total)}
                              </span>
                              <span className="text-xs text-slate-500">total</span>
                            </div>
                            {groupSize > 1 && (
                              <p className="text-xs text-slate-500">
                                ~{formatter.format(perPerson)} per person • {groupSize} travelers
                              </p>
                            )}
                            <p className="text-xs text-slate-400 mt-2">
                              Based on {tripData.travelStyle || 'comfort'} style. Final costs calculated after feasibility check.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                </div>

            {/* Create Button - Staged CTA with missing hints */}
            <div className="p-4 border-t border-slate-100">
              {(() => {
                const missing = getMissingRequirements();
                const isReady = tripData.destinations?.length && chatStage !== 'collect_destination';
                const canSubmit = tripData.destinations?.length && !isSubmitting && !createTrip.isPending;

                return (
                  <>
                    <Button
                      onClick={handleCreateTrip}
                      disabled={!canSubmit}
                      className={`w-full h-12 rounded-xl font-semibold transition-all ${
                        isReady
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting || createTrip.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Planning Your Trip...
                        </>
                      ) : isReady ? (
                        <>
                          Plan My Trip
                          <ChevronRight className="w-5 h-5 ml-2" />
                        </>
                      ) : (
                        'Complete the steps above'
                      )}
                    </Button>

                    {/* Missing requirements hint */}
                    {missing.length > 0 && (
                      <p className="text-xs text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Still need: {missing.join(', ')}
                      </p>
                    )}

                    {/* Ready state encouragement */}
                    {isReady && !isSubmitting && !createTrip.isPending && (
                      <p className="text-xs text-emerald-500 text-center mt-2 flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" />
                        Ready! Click to check feasibility
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
