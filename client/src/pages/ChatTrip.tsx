import { useState, useRef, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/Sidebar";
import { apiRequest } from "@/lib/queryClient";
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
  AlertCircle
} from "lucide-react";

// Suggested prompts for trip planning
const SUGGESTED_PROMPTS = [
  "Plan a romantic weekend in Paris",
  "Family vacation to Bali for 7 days",
  "Adventure trip to New Zealand",
  "Budget backpacking through Southeast Asia",
  "Luxury honeymoon in Maldives",
  "Road trip across Italy",
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

export default function ChatTrip() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "Hi! I'm your AI travel assistant. Tell me about your dream trip - where do you want to go, when, and what kind of experience are you looking for?",
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
    passport: '',
  });
  const [showTripPanel, setShowTripPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setIsLoading(true);

    try {
      // Extract trip details from user message
      const extracted = extractTripDetails(content);

      // Update trip data with extracted info
      if (extracted.destinations && extracted.destinations.length > 0) {
        setTripData(prev => ({
          ...prev,
          destinations: [...(prev.destinations || []), ...(extracted.destinations || [])],
          ...(extracted.travelStyle && { travelStyle: extracted.travelStyle }),
          ...(extracted.isRoadTrip !== undefined && { isRoadTrip: extracted.isRoadTrip }),
          ...(extracted.travelers && { travelers: extracted.travelers }),
        }));
        setShowTripPanel(true);
      }

      // Call AI API for intelligent response
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

      let aiResponse = '';
      let suggestions: string[] = [];

      if (response.ok) {
        const data = await response.json();
        aiResponse = data.response || generateAssistantResponse(content, extracted);
        suggestions = data.suggestions || generateFollowUpSuggestions(extracted);
      } else {
        // Fallback to local response generation
        aiResponse = generateAssistantResponse(content, extracted);
        suggestions = generateFollowUpSuggestions(extracted);
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

  // Generate assistant response based on extracted data
  const generateAssistantResponse = (userMessage: string, extracted: Partial<TripFormData>): string => {
    const dests = extracted.destinations || [];

    if (dests.length > 0) {
      const destNames = dests.map(d => d.city).join(', ');
      let response = `Great choice! ${destNames} ${dests.length > 1 ? 'are' : 'is'} amazing! `;

      if (extracted.isRoadTrip) {
        response += "A road trip sounds exciting! ";
      }

      if (extracted.travelStyle === 'luxury') {
        response += "I'll find you the best luxury experiences. ";
      } else if (extracted.travelStyle === 'budget') {
        response += "I'll help you make the most of your budget. ";
      }

      response += "\n\nWhen are you planning to travel? You can give me specific dates or just tell me which month works best for you.";
      return response;
    }

    if (userMessage.toLowerCase().includes('help') || userMessage.toLowerCase().includes('how')) {
      return "I can help you plan the perfect trip! Just tell me:\n\n• Where you want to go (one or multiple cities)\n• When you're traveling\n• Who's coming with you\n• Your budget and travel style\n\nOr simply describe your dream vacation and I'll take it from there!";
    }

    return "That sounds interesting! Could you tell me more about where you'd like to go? You can mention specific cities or countries, and I'll help plan your perfect itinerary.";
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

  // Add destination to trip
  const addDestination = (city: string, country: string) => {
    setTripData(prev => ({
      ...prev,
      destinations: [...(prev.destinations || []), { city, country }],
    }));
    setShowTripPanel(true);

    handleSendMessage(`I want to visit ${city}, ${country}`);
  };

  // Remove destination
  const removeDestination = (index: number) => {
    setTripData(prev => ({
      ...prev,
      destinations: prev.destinations?.filter((_, i) => i !== index) || [],
    }));
  };

  // Create the trip
  const handleCreateTrip = () => {
    const destinations = tripData.destinations || [];
    if (destinations.length === 0) return;

    // Navigate to the full create trip form with pre-filled data
    const destString = destinations.map(d => `${d.city}, ${d.country}`).join(' → ');
    setLocation(`/create?destination=${encodeURIComponent(destString)}&roadtrip=${tripData.isRoadTrip ? '1' : '0'}`);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 md:ml-[240px] flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg text-slate-900">Plan Your Trip</h1>
                <p className="text-sm text-slate-500">Chat with AI to create your perfect itinerary</p>
              </div>
            </div>
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

                    {/* Suggestions */}
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {message.suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(suggestion)}
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

          {/* Quick Destinations */}
          {messages.length <= 2 && (
            <div className="px-6 pb-4">
              <p className="text-sm text-slate-500 mb-3">Quick picks:</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.name}
                    onClick={() => addDestination(dest.name, dest.country)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                  >
                    <span>{dest.emoji}</span>
                    <span className="text-sm font-medium text-slate-700">{dest.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="bg-white border-t border-slate-200 p-4">
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
                placeholder="Describe your dream trip..."
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
          </div>
        </div>

        {/* Trip Details Panel */}
        <AnimatePresence>
          {showTripPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white border-l border-slate-200 overflow-hidden"
            >
              <div className="w-[380px] h-full flex flex-col">
                {/* Panel Header */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg text-slate-900">Your Trip</h2>
                  <button
                    onClick={() => setShowTripPanel(false)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Panel Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {/* Destinations */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-amber-500" />
                        Destinations
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

                  {/* Date Type */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      When
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setTripData(prev => ({ ...prev, dateType: 'specific' }))}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          tripData.dateType === 'specific'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        Specific dates
                      </button>
                      <button
                        onClick={() => setTripData(prev => ({ ...prev, dateType: 'flexible' }))}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                          tripData.dateType === 'flexible'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        I'm flexible
                      </button>
                    </div>

                    {tripData.dateType === 'flexible' && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                        <p className="text-sm text-slate-600">
                          Tell me which month works best for you, and I'll suggest the ideal dates based on weather and events.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Travelers */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-amber-500" />
                      Travelers
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

                  {/* Travel Style */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Wallet className="w-4 h-4 text-amber-500" />
                      Travel Style
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'budget', label: 'Budget', emoji: '🎒' },
                        { value: 'comfort', label: 'Comfort', emoji: '🧳' },
                        { value: 'luxury', label: 'Luxury', emoji: '✨' },
                      ].map((style) => (
                        <button
                          key={style.value}
                          onClick={() => setTripData(prev => ({ ...prev, travelStyle: style.value as any }))}
                          className={`p-3 rounded-xl border-2 text-center transition-colors ${
                            tripData.travelStyle === style.value
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="text-2xl mb-1">{style.emoji}</div>
                          <div className="text-xs font-medium text-slate-700">{style.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Key Details */}
                  <div>
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                      <Globe className="w-4 h-4 text-amber-500" />
                      Key Details
                    </label>
                    <textarea
                      value={tripData.keyDetails}
                      onChange={(e) => setTripData(prev => ({ ...prev, keyDetails: e.target.value }))}
                      placeholder="Any specific interests, dietary requirements, accessibility needs, must-see places..."
                      className="w-full p-3 bg-slate-50 border-0 rounded-xl text-slate-900 placeholder:text-slate-400 resize-none h-24 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Create Button */}
                <div className="p-4 border-t border-slate-100">
                  <Button
                    onClick={handleCreateTrip}
                    disabled={!tripData.destinations || tripData.destinations.length === 0}
                    className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold"
                  >
                    Create Itinerary
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
