import type { Express } from "express";
import type { Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { FeasibilityReport, VisaDetails, FEASIBILITY_SCHEMA_VERSION } from "@shared/schema";
import { getCorridorData, corridorToVisaDetails, generateEstimatedVisaDetails } from "./services/corridorData";
import { getAlternatives } from "./services/alternativesService";
import { searchFlights, type FlightResult } from "./services/flightApi";
import { searchHotels, type HotelResult } from "./services/hotelApi";
import {
  initializeAIAgent,
  getCoordinates as aiGetCoordinates,
  getAttractions as aiGetAttractions,
  getTransportOptions as aiGetTransportOptions,
  getDestinationImage as aiGetDestinationImage,
  getDestinationCategory as aiGetDestinationCategory,
} from "./services/aiAgent";
import authRouter from "./routes/auth";
import emailRouter from "./routes/email";
import chatRouter from "./routes/chat";
import priceAlertsRouter from "./routes/priceAlerts";
import templatesRouter from "./routes/templates";
import packingListRouter from "./routes/packingList";
import insuranceRouter from "./routes/insurance";
import collaborationRouter from "./routes/collaboration";
import weatherRouter from "./routes/weather";
import subscriptionsRouter from "./routes/subscriptions";
import changePlanRouter from "./routes/changePlan";
import fixOptionsRouter from "./routes/fixOptions";
import appliedPlansRouter from "./routes/appliedPlans";
import versionsRouter from "./routes/versions";
import { knowledgeRouter } from "./routes/knowledge";
import { mapboxRouter } from "./routes/mapbox";
import scrapeRouter from "./routes/scrape";
import { VisaFacts, computeVisaConfidence } from "@shared/knowledgeSchema";
import { db } from "./db";
import { knowledgeDocuments } from "@shared/knowledgeSchema";
import { generateEmbedding } from "./services/embeddings";
import { sql, desc, and, or, eq } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";
import { buildVisaEvidenceBundle, formatEvidenceBundleForPrompt } from "./services/evidenceBundle";
import {
  streamItineraryGeneration,
  resumeItineraryStream,
  setupSSEHeaders,
  sendSSE,
  createStreamAbortController,
  shouldUseStreaming,
  createSSEContext,
  cleanupSSEContext,
  parseLastEventId,
  createStreamMetrics,
  logStreamSummary,
  type StreamingItineraryInput,
  type ItineraryDay,
  type SSEContext,
  type StreamMetrics
} from "./services/streamingItinerary";
import {
  acquireItineraryLock,
  releaseItineraryLock,
  createLockContext,
  cleanupLockContext,
  type LockContext
} from "./services/itineraryLock";
import {
  sseProtection,
  tripCreationRateLimiter,
  getRateLimitMetrics,
  requireAdminToken,
} from "./middleware/rateLimiter";
import * as TripService from "./services/tripService";
import * as TransportService from "./services/transportService";
import * as VisaService from "./services/visaService";

// ============ FEASIBILITY ANALYTICS ============
// Decision-quality metrics for validation
interface FeasibilityAnalytics {
  totalChecks: number;
  verdicts: { GO: number; POSSIBLE: number; DIFFICULT: number; NO: number };
  hardBlockerReasons: Map<string, number>;
  softBlockerReasons: Map<string, number>;
  adjustTripClicks: number;
  overrideConfirmed: number;
  overrideCancelled: number;
  itinerariesWithOverride: number;
  topCorridors: Map<string, { total: number; blocked: number }>;
}

const feasibilityAnalytics: FeasibilityAnalytics = {
  totalChecks: 0,
  verdicts: { GO: 0, POSSIBLE: 0, DIFFICULT: 0, NO: 0 },
  hardBlockerReasons: new Map(),
  softBlockerReasons: new Map(),
  adjustTripClicks: 0,
  overrideConfirmed: 0,
  overrideCancelled: 0,
  itinerariesWithOverride: 0,
  topCorridors: new Map(),
};

// ============================================================================
// DEMO TRIP FALLBACK DATA - Used when no real demo trip exists
// ============================================================================
const DEMO_TRIP_FALLBACK = {
  id: -1, // Negative ID indicates fallback
  userId: null,
  passport: "India",
  residence: null,
  origin: null,
  destination: "Thailand",
  dates: "2026-02-15 to 2026-02-22",
  budget: 2000,
  currency: "USD",
  groupSize: 2,
  adults: 2,
  children: 0,
  infants: 0,
  travelStyle: "adventure",
  accommodationType: null,
  pacePreference: null,
  interests: null,
  feasibilityStatus: "yes",
  feasibilityReport: {
    score: 85,
    overall: "yes",
    summary: "Trip is possible with visa application required.",
    breakdown: {
      visa: { reason: "Visa required for Indian passport holders", status: "issue" },
      budget: { reason: "Budget is adequate for this trip", status: "ok", estimatedCost: 858 },
      safety: { reason: "Generally safe with normal precautions", status: "safe" },
      accessibility: { reason: "Thailand fully open to tourists", status: "accessible" },
    },
    visaDetails: {
      type: "embassy_visa",
      name: "Tourist Visa",
      required: true,
      processingDays: { minimum: 5, maximum: 15 },
      cost: { government: 50, service: 20, totalPerPerson: 70, currency: "USD" },
      timing: { urgency: "ok", hasEnoughTime: true, recommendation: "Apply within the next week." },
    },
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
  },
  itinerary: {
    days: [
      {
        day: 1,
        date: "2026-02-15",
        title: "Bangkok Arrival & Riverside Serenity",
        activities: [
          { time: "14:00", type: "transport", location: "Suvarnabhumi Airport", description: "Arrive at Bangkok Airport", estimatedCost: 10, coordinates: { lat: 13.6811, lng: 100.747 } },
          { time: "16:30", type: "activity", location: "Wat Pho (Temple of the Reclining Buddha)", description: "Explore Wat Pho", estimatedCost: 10, coordinates: { lat: 13.7466, lng: 100.493 } },
          { time: "18:00", type: "activity", location: "Sanam Luang Park", description: "Evening stroll at Sanam Luang", estimatedCost: 0, coordinates: { lat: 13.7539, lng: 100.492 } },
        ],
        localFood: [
          { meal: "lunch", name: "Thip Samai Pad Thai", cuisine: "Thai", estimatedCost: 8 },
          { meal: "dinner", name: "Jay Fai Street Food", cuisine: "Thai", estimatedCost: 12 },
        ],
      },
      {
        day: 2,
        date: "2026-02-16",
        title: "Royal Grandeur & Market Marvels",
        activities: [
          { time: "09:00", type: "activity", location: "Grand Palace", description: "Visit Grand Palace", estimatedCost: 30, coordinates: { lat: 13.7501, lng: 100.491 } },
          { time: "12:00", type: "activity", location: "Wat Arun", description: "Explore Temple of Dawn", estimatedCost: 6, coordinates: { lat: 13.7437, lng: 100.488 } },
          { time: "16:00", type: "activity", location: "Chatuchak Market", description: "Shop at weekend market", estimatedCost: 20, coordinates: { lat: 13.7986, lng: 100.551 } },
        ],
        localFood: [
          { meal: "breakfast", name: "On Lok Yun", cuisine: "Thai-Chinese", estimatedCost: 6 },
          { meal: "lunch", name: "Krua Apsorn", cuisine: "Thai", estimatedCost: 10 },
        ],
      },
      {
        day: 3,
        date: "2026-02-17",
        title: "Ayutthaya Ancient Wonders",
        activities: [
          { time: "08:00", type: "transport", location: "Bangkok to Ayutthaya", description: "Train to Ayutthaya", estimatedCost: 6, coordinates: { lat: 13.7384, lng: 100.513 } },
          { time: "10:00", type: "activity", location: "Wat Mahathat", description: "Famous Buddha head in tree roots", estimatedCost: 4, coordinates: { lat: 14.3572, lng: 100.567 } },
          { time: "14:30", type: "activity", location: "Wat Chaiwatthanaram", description: "Stunning riverside temple", estimatedCost: 4, coordinates: { lat: 14.3422, lng: 100.543 } },
        ],
        localFood: [
          { meal: "lunch", name: "Ayutthaya Floating Market", cuisine: "Thai", estimatedCost: 7 },
        ],
      },
      {
        day: 4,
        date: "2026-02-18",
        title: "Chiang Mai Temple Trails",
        activities: [
          { time: "08:00", type: "transport", location: "Bangkok to Chiang Mai", description: "Fly to Chiang Mai", estimatedCost: 80, coordinates: { lat: 13.6811, lng: 100.747 } },
          { time: "12:00", type: "activity", location: "Wat Phra Singh", description: "Visit Wat Phra Singh", estimatedCost: 4, coordinates: { lat: 18.7889, lng: 98.9806 } },
          { time: "14:00", type: "activity", location: "Wat Chedi Luang", description: "Ancient temple ruins", estimatedCost: 4, coordinates: { lat: 18.7875, lng: 98.9869 } },
        ],
        localFood: [
          { meal: "lunch", name: "Khao Soi Islam", cuisine: "Northern Thai", estimatedCost: 6 },
        ],
      },
      {
        day: 5,
        date: "2026-02-19",
        title: "Mountain Temples & Night Bazaar",
        activities: [
          { time: "09:00", type: "activity", location: "Doi Suthep", description: "Visit Wat Phra That Doi Suthep", estimatedCost: 10, coordinates: { lat: 18.8056, lng: 98.9217 } },
          { time: "15:00", type: "activity", location: "Wat Umong", description: "Forest temple with tunnels", estimatedCost: 20, coordinates: { lat: 18.7833, lng: 98.95 } },
          { time: "17:30", type: "activity", location: "Night Bazaar", description: "Evening shopping and food", estimatedCost: 20, coordinates: { lat: 18.7833, lng: 98.9986 } },
        ],
        localFood: [
          { meal: "dinner", name: "Night Bazaar Food Court", cuisine: "Thai", estimatedCost: 8 },
        ],
      },
      {
        day: 6,
        date: "2026-02-20",
        title: "Elephant Sanctuary & Cooking Class",
        activities: [
          { time: "08:00", type: "activity", location: "Elephant Nature Park", description: "Ethical elephant experience", estimatedCost: 80, coordinates: { lat: 19.1833, lng: 99.05 } },
          { time: "16:00", type: "activity", location: "Thai Cooking Class", description: "Learn to cook Thai dishes", estimatedCost: 40, coordinates: { lat: 18.7883, lng: 98.9853 } },
        ],
        localFood: [
          { meal: "dinner", name: "Your own cooking!", cuisine: "Thai", estimatedCost: 0 },
        ],
      },
      {
        day: 7,
        date: "2026-02-21",
        title: "Morning Markets & Farewell",
        activities: [
          { time: "08:00", type: "activity", location: "Warorot Market", description: "Local market experience", estimatedCost: 20, coordinates: { lat: 18.7889, lng: 99.0014 } },
          { time: "11:00", type: "transport", location: "Chiang Mai Airport", description: "Depart from Chiang Mai", estimatedCost: 10, coordinates: { lat: 18.7667, lng: 98.9667 } },
        ],
        localFood: [
          { meal: "breakfast", name: "Market food stalls", cuisine: "Thai", estimatedCost: 5 },
        ],
      },
    ],
    costBreakdown: {
      flights: 160,
      accommodation: 140,
      activities: 358,
      food: 120,
      localTransport: 80,
      total: 858,
      grandTotal: 858,
      perPerson: 429,
      currency: "USD",
    },
  },
  isPublic: false,
  isTemplate: false,
  templateName: null,
  templateDescription: null,
  templateCategory: null,
  useCount: 0,
  rating: null,
  ratingCount: 0,
  status: "draft",
  checklistProgress: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function trackFeasibilityVerdict(verdict: string, score: number, passport: string, destination: string, blockerReasons?: string[]) {
  feasibilityAnalytics.totalChecks++;

  // Track verdict
  if (score >= 80) feasibilityAnalytics.verdicts.GO++;
  else if (score >= 60) feasibilityAnalytics.verdicts.POSSIBLE++;
  else if (score >= 40) feasibilityAnalytics.verdicts.DIFFICULT++;
  else feasibilityAnalytics.verdicts.NO++;

  // Track corridor
  const corridor = `${passport}->${destination}`;
  const corridorStats = feasibilityAnalytics.topCorridors.get(corridor) || { total: 0, blocked: 0 };
  corridorStats.total++;
  if (verdict === 'no') corridorStats.blocked++;
  feasibilityAnalytics.topCorridors.set(corridor, corridorStats);

  // Log for debugging
  console.log(`[Analytics] Feasibility: ${verdict} (score: ${score}) for ${corridor}`);
}

function trackOverrideDecision(confirmed: boolean) {
  if (confirmed) {
    feasibilityAnalytics.overrideConfirmed++;
    feasibilityAnalytics.itinerariesWithOverride++;
    console.log(`[Analytics] Override confirmed (total: ${feasibilityAnalytics.overrideConfirmed})`);
  } else {
    feasibilityAnalytics.overrideCancelled++;
    console.log(`[Analytics] Override cancelled (total: ${feasibilityAnalytics.overrideCancelled})`);
  }
}

function getAnalyticsSummary() {
  const total = feasibilityAnalytics.totalChecks || 1;
  return {
    totalChecks: feasibilityAnalytics.totalChecks,
    verdictDistribution: {
      GO: `${((feasibilityAnalytics.verdicts.GO / total) * 100).toFixed(1)}%`,
      POSSIBLE: `${((feasibilityAnalytics.verdicts.POSSIBLE / total) * 100).toFixed(1)}%`,
      DIFFICULT: `${((feasibilityAnalytics.verdicts.DIFFICULT / total) * 100).toFixed(1)}%`,
      NO: `${((feasibilityAnalytics.verdicts.NO / total) * 100).toFixed(1)}%`,
    },
    overrideRate: feasibilityAnalytics.overrideConfirmed > 0
      ? `${((feasibilityAnalytics.overrideConfirmed / (feasibilityAnalytics.overrideConfirmed + feasibilityAnalytics.overrideCancelled)) * 100).toFixed(1)}%`
      : '0%',
    itinerariesWithRiskOverride: feasibilityAnalytics.itinerariesWithOverride,
    topCorridors: Array.from(feasibilityAnalytics.topCorridors.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([corridor, stats]) => ({
        corridor,
        total: stats.total,
        blockedRate: `${((stats.blocked / stats.total) * 100).toFixed(0)}%`
      })),
  };
}

// Visa functions moved to server/services/visaService.ts
// Import: import * as VisaService from "./services/visaService";
// Usage: VisaService.getVisaFactsFromKnowledge(), VisaService.convertVisaFactsToVisaDetails()

// ============ PROGRESS TRACKING SYSTEM ============
// In-memory store for tracking trip processing progress
interface TripProgress {
  step: number;
  message: string;
  details?: string;
  startedAt: number;
  updatedAt: number;
}

const tripProgressStore = new Map<number, TripProgress>();

// Progress step definitions
const PROGRESS_STEPS = {
  STARTING: { step: 0, message: "Starting analysis..." },
  FEASIBILITY: { step: 1, message: "Checking visa & feasibility" },
  FLIGHTS: { step: 2, message: "Finding best travel options" },
  HOTELS: { step: 3, message: "Finding accommodation" },
  ITINERARY: { step: 4, message: "Creating your itinerary" },
  FINALIZING: { step: 5, message: "Finalizing trip details" },
  COMPLETE: { step: 6, message: "Complete!" },
};

function updateProgress(tripId: number, stepInfo: { step: number; message: string }, details?: string) {
  const now = Date.now();
  const existing = tripProgressStore.get(tripId);
  tripProgressStore.set(tripId, {
    step: stepInfo.step,
    message: stepInfo.message,
    details,
    startedAt: existing?.startedAt || now,
    updatedAt: now,
  });
}

function clearProgress(tripId: number) {
  // Keep completed status for a while so UI can show completion
  setTimeout(() => tripProgressStore.delete(tripId), 30000);
}

// ============ DESTINATION COORDINATES LOOKUP ============
// Used for fallback itinerary when AI fails to provide coordinates
const DESTINATION_COORDINATES: Record<string, { lat: number; lng: number; attractions: Array<{ name: string; lat: number; lng: number }> }> = {
  'reykjavik': { lat: 64.1466, lng: -21.9426, attractions: [
    { name: 'Hallgrimskirkja', lat: 64.1417, lng: -21.9267 },
    { name: 'Harpa Concert Hall', lat: 64.1504, lng: -21.9327 },
    { name: 'Sun Voyager', lat: 64.1476, lng: -21.9223 },
    { name: 'Perlan', lat: 64.1291, lng: -21.9176 },
  ]},
  'iceland': { lat: 64.1466, lng: -21.9426, attractions: [
    { name: 'Blue Lagoon', lat: 63.8804, lng: -22.4495 },
    { name: 'Golden Circle', lat: 64.3271, lng: -20.1199 },
    { name: 'Thingvellir', lat: 64.2558, lng: -21.1299 },
  ]},
  'paris': { lat: 48.8566, lng: 2.3522, attractions: [
    { name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945 },
    { name: 'Louvre Museum', lat: 48.8606, lng: 2.3376 },
    { name: 'Notre-Dame', lat: 48.8530, lng: 2.3499 },
    { name: 'Champs-Élysées', lat: 48.8698, lng: 2.3078 },
  ]},
  'london': { lat: 51.5074, lng: -0.1278, attractions: [
    { name: 'Big Ben', lat: 51.5007, lng: -0.1246 },
    { name: 'Tower of London', lat: 51.5081, lng: -0.0759 },
    { name: 'British Museum', lat: 51.5194, lng: -0.1270 },
  ]},
  'tokyo': { lat: 35.6762, lng: 139.6503, attractions: [
    { name: 'Shibuya Crossing', lat: 35.6595, lng: 139.7004 },
    { name: 'Senso-ji Temple', lat: 35.7148, lng: 139.7967 },
    { name: 'Tokyo Tower', lat: 35.6586, lng: 139.7454 },
  ]},
  'new york': { lat: 40.7128, lng: -74.0060, attractions: [
    { name: 'Times Square', lat: 40.7580, lng: -73.9855 },
    { name: 'Central Park', lat: 40.7829, lng: -73.9654 },
    { name: 'Statue of Liberty', lat: 40.6892, lng: -74.0445 },
  ]},
  'dubai': { lat: 25.2048, lng: 55.2708, attractions: [
    { name: 'Burj Khalifa', lat: 25.1972, lng: 55.2744 },
    { name: 'Dubai Mall', lat: 25.1985, lng: 55.2796 },
    { name: 'Palm Jumeirah', lat: 25.1124, lng: 55.1390 },
  ]},
  'singapore': { lat: 1.3521, lng: 103.8198, attractions: [
    { name: 'Marina Bay Sands', lat: 1.2834, lng: 103.8607 },
    { name: 'Gardens by the Bay', lat: 1.2816, lng: 103.8636 },
    { name: 'Sentosa Island', lat: 1.2494, lng: 103.8303 },
  ]},
  'bangkok': { lat: 13.7563, lng: 100.5018, attractions: [
    { name: 'Grand Palace', lat: 13.7500, lng: 100.4914 },
    { name: 'Wat Arun', lat: 13.7437, lng: 100.4888 },
    { name: 'Chatuchak Market', lat: 13.7999, lng: 100.5503 },
  ]},
  'bali': { lat: -8.3405, lng: 115.0920, attractions: [
    { name: 'Tanah Lot', lat: -8.6212, lng: 115.0868 },
    { name: 'Ubud', lat: -8.5069, lng: 115.2625 },
    { name: 'Uluwatu Temple', lat: -8.8291, lng: 115.0849 },
  ]},
  'rome': { lat: 41.9028, lng: 12.4964, attractions: [
    { name: 'Colosseum', lat: 41.8902, lng: 12.4922 },
    { name: 'Vatican City', lat: 41.9029, lng: 12.4534 },
    { name: 'Trevi Fountain', lat: 41.9009, lng: 12.4833 },
  ]},
  'barcelona': { lat: 41.3851, lng: 2.1734, attractions: [
    { name: 'Sagrada Familia', lat: 41.4036, lng: 2.1744 },
    { name: 'Park Güell', lat: 41.4145, lng: 2.1527 },
    { name: 'La Rambla', lat: 41.3797, lng: 2.1746 },
  ]},
  'amsterdam': { lat: 52.3676, lng: 4.9041, attractions: [
    { name: 'Anne Frank House', lat: 52.3752, lng: 4.8840 },
    { name: 'Rijksmuseum', lat: 52.3600, lng: 4.8852 },
    { name: 'Van Gogh Museum', lat: 52.3584, lng: 4.8811 },
  ]},
  'santorini': { lat: 36.3932, lng: 25.4615, attractions: [
    { name: 'Oia Village', lat: 36.4612, lng: 25.3757 },
    { name: 'Fira Town', lat: 36.4166, lng: 25.4322 },
    { name: 'Red Beach', lat: 36.3478, lng: 25.3933 },
  ]},
  'maldives': { lat: 3.2028, lng: 73.2207, attractions: [
    { name: 'Male City', lat: 4.1755, lng: 73.5093 },
    { name: 'Maafushi Island', lat: 3.9408, lng: 73.4871 },
  ]},
  'sydney': { lat: -33.8688, lng: 151.2093, attractions: [
    { name: 'Sydney Opera House', lat: -33.8568, lng: 151.2153 },
    { name: 'Harbour Bridge', lat: -33.8523, lng: 151.2108 },
    { name: 'Bondi Beach', lat: -33.8908, lng: 151.2743 },
  ]},
  'vienna': { lat: 48.2082, lng: 16.3738, attractions: [
    { name: 'Schönbrunn Palace', lat: 48.1851, lng: 16.3122 },
    { name: 'St. Stephen Cathedral', lat: 48.2085, lng: 16.3731 },
    { name: 'Belvedere Palace', lat: 48.1915, lng: 16.3808 },
  ]},
};

/**
 * Get destination coordinates - UX-first approach
 * 1. INSTANT: Check hardcoded cache for popular destinations
 * 2. DYNAMIC: Use AI Agent for unknown destinations (still fast with caching)
 */
async function getDestinationCoords(destination: string): Promise<{ center: { lat: number; lng: number }; attractions: Array<{ name: string; lat: number; lng: number }> }> {
  const destLower = destination.toLowerCase();

  // FAST PATH: Check hardcoded cache first (instant, ~0ms)
  for (const [key, data] of Object.entries(DESTINATION_COORDINATES)) {
    if (destLower.includes(key)) {
      console.log(`[Coords] Cache HIT for ${destination} (hardcoded)`);
      return { center: { lat: data.lat, lng: data.lng }, attractions: data.attractions };
    }
  }

  // DYNAMIC PATH: Use AI Agent for unknown destinations
  console.log(`[Coords] Cache MISS for ${destination}, using AI Agent...`);
  try {
    // Get coordinates from AI Agent (uses Nominatim API + AI fallback + caching)
    const [coordsResult, attractionsResult] = await Promise.all([
      aiGetCoordinates(destination),
      aiGetAttractions(destination, 4),
    ]);

    if (coordsResult.lat !== 0 && coordsResult.lng !== 0) {
      const attractions = attractionsResult.attractions.map(a => ({
        name: a.name,
        lat: a.lat,
        lng: a.lng,
      }));
      console.log(`[Coords] AI Agent found ${destination}: (${coordsResult.lat}, ${coordsResult.lng}) with ${attractions.length} attractions`);
      return { center: { lat: coordsResult.lat, lng: coordsResult.lng }, attractions };
    }
  } catch (error) {
    console.log(`[Coords] AI Agent failed for ${destination}:`, error);
  }

  // FALLBACK: Return empty (UI will handle gracefully)
  console.log(`[Coords] No coordinates found for ${destination}`);
  return { center: { lat: 0, lng: 0 }, attractions: [] };
}

// Helper to parse date range string to start/end dates
function parseDateRange(dateStr: string): { startDate: string; endDate: string } | null {
  try {
    // Format 0: "2026-04-01 to 2026-04-15" (ISO format with 'to' separator)
    const toMatch = dateStr.match(/(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/);
    if (toMatch) {
      const [, startStr, endStr] = toMatch;
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { startDate: startStr, endDate: endStr };
      }
    }

    // Format 1: "Jan 15, 2026 - Jan 22, 2026"
    const parts = dateStr.split(' - ');
    if (parts.length === 2) {
      const start = new Date(parts[0].trim());
      const end = new Date(parts[1].trim());
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        };
      }
    }

    // Format 2: "June 15-22, 2026"
    const match = dateStr.match(/(\w+)\s+(\d+)-(\d+),?\s+(\d{4})/);
    if (match) {
      const [, month, startDay, endDay, year] = match;
      const start = new Date(`${month} ${startDay}, ${year}`);
      const end = new Date(`${month} ${endDay}, ${year}`);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        };
      }
    }

    // Format 3: "June 2026, 12 days" (flexible dates - assume 1st of month)
    const flexMatch = dateStr.match(/(\w+)\s+(\d{4}),?\s+(\d+)\s*days?/i);
    if (flexMatch) {
      const [, month, year, numDays] = flexMatch;
      const start = new Date(`${month} 1, ${year}`);
      if (!isNaN(start.getTime())) {
        const end = new Date(start);
        end.setDate(start.getDate() + parseInt(numDays) - 1);
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        };
      }
    }

    // Format 4: "1/15/2026 - 1/22/2026" (US date format)
    const usMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (usMatch) {
      const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = usMatch;
      const start = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay));
      const end = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay));
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// MVP CERTAINTY ENGINE HELPER FUNCTIONS
// ============================================================================

import type { VisaTiming, CertaintyScore, EntryCosts, ActionItem } from "@shared/schema";

// Affiliate links for monetization
const AFFILIATE_CONFIG = {
  visa: {
    ivisa: 'https://www.ivisa.com/?utm_source=voyageai&utm_medium=affiliate',
    visaHQ: 'https://www.visahq.com/?utm_source=voyageai',
  },
  insurance: {
    safetywing: 'https://safetywing.com/nomad-insurance/?referenceID=voyageai',
    worldNomads: 'https://www.worldnomads.com/?affiliate=voyageai',
  },
  flights: {
    skyscanner: 'https://www.skyscanner.com/?associate=voyageai',
    googleFlights: 'https://www.google.com/travel/flights',
  },
  hotels: {
    booking: 'https://www.booking.com/?aid=voyageai',
    agoda: 'https://www.agoda.com/?cid=voyageai',
  },
};

// NOTE: calculateVisaTiming, calculateCertaintyScore, calculateEntryCosts, generateActionItems
// have been removed - these functions were unused and duplicated client-side logic.

// Initialize AI client
let openai: OpenAI | null = null;
let aiModel = "gpt-4o";

if (process.env.DEEPSEEK_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
  aiModel = "deepseek-chat";
  // Initialize AI Agent for dynamic data fetching
  initializeAIAgent(process.env.DEEPSEEK_API_KEY, "https://api.deepseek.com", "deepseek-chat");
  console.log("AI Provider: Deepseek (with AI Agent)");
} else if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  // Initialize AI Agent for dynamic data fetching
  initializeAIAgent(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    "gpt-4o"
  );
  console.log("AI Provider: OpenAI (with AI Agent)");
} else {
  console.log("AI Provider: None (no API key configured)");
}

// Currency symbols mapping - supports all 28 currencies from CreateTrip
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', KRW: '₩', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  MXN: '$', BRL: 'R$', AED: 'د.إ', SAR: '﷼', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
};

// Fallback exchange rates from USD (used if API fails) - approximate rates
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149.5, CNY: 7.24, INR: 83.5, AUD: 1.53, CAD: 1.36,
  CHF: 0.88, KRW: 1320, SGD: 1.34, HKD: 7.82, NZD: 1.64, SEK: 10.5, NOK: 10.8, DKK: 6.9,
  MXN: 17.2, BRL: 4.95, AED: 3.67, SAR: 3.75, THB: 35.5, MYR: 4.72, IDR: 15600, PHP: 55.8,
  ZAR: 18.5, TRY: 32.5, RUB: 92, PLN: 4.0, CZK: 23.5, HUF: 360
};

// Cache for exchange rates (refreshed every hour)
let exchangeRateCache: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Fetch live exchange rates from Frankfurter API (free, no API key)
async function getExchangeRates(): Promise<Record<string, number>> {
  // Return cached rates if still valid
  if (exchangeRateCache && Date.now() - exchangeRateCache.timestamp < CACHE_DURATION) {
    return exchangeRateCache.rates;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.frankfurter.app/latest?from=USD', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const rates: Record<string, number> = { USD: 1, ...data.rates };
      exchangeRateCache = { rates, timestamp: Date.now() };
      console.log('[Currency] Fetched live exchange rates:', Object.keys(rates).length, 'currencies');
      return rates;
    }
  } catch (error) {
    console.error('[Currency] API error, using fallback rates:', error);
  }

  return FALLBACK_RATES;
}

// Sync version using cached rates (for use in loops)
function convertFromUSD(amountUSD: number, targetCurrency: string, rates: Record<string, number>): number {
  const rate = rates[targetCurrency] || FALLBACK_RATES[targetCurrency] || 1;
  return Math.round(amountUSD * rate);
}

// Transport functions moved to server/services/transportService.ts
// Import: import * as TransportService from "./services/transportService";
// Usage: TransportService.getSmartTransportRecommendations()

// ============ ITINERARY CACHE SYSTEM ============
// Cache stores itinerary templates by destination (without dates)
interface CachedItinerary {
  destination: string;
  days: Array<{
    dayNumber: number;
    title: string;
    activities: Array<{
      time: string;
      description: string;
      type: string;
      location: string;
      coordinates: { lat: number; lng: number };
    }>;
  }>;
}

const itineraryCache: Map<string, CachedItinerary> = new Map();

// Normalize destination name for cache key
function normalizeDestination(dest: string): string {
  return dest.toLowerCase()
    .replace(/,.*$/, '') // Remove country suffix
    .replace(/\s+/g, '_')
    .trim();
}

// Get cached itinerary and adjust dates
function getCachedItinerary(destination: string, startDate: string, numDays: number): any | null {
  const key = normalizeDestination(destination);
  const cached = itineraryCache.get(key);

  if (!cached) return null;

  // Adjust to requested number of days
  const templateDays = cached.days.slice(0, numDays);
  if (templateDays.length < numDays) {
    // Not enough days in cache, need AI generation
    return null;
  }

  // Adjust dates
  const start = new Date(startDate);
  const days = templateDays.map((day, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return {
      day: index + 1,
      date: date.toISOString().split('T')[0],
      title: day.title,
      activities: day.activities.map(a => ({ ...a })),
    };
  });

  console.log(`[Cache] HIT for ${destination} (${numDays} days)`);
  return { days };
}

// ============================================================================
// API TIMEOUT HELPER - For faster response times with fallbacks
// ============================================================================

const API_TIMEOUT_MS = 30000; // 30 second timeout for external APIs (flights, hotels)

// Wraps a promise with a timeout - returns fallback value if timeout exceeded
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallbackValue: T,
  operationName: string = 'Operation'
): Promise<{ result: T; timedOut: boolean }> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<{ result: T; timedOut: boolean }>((resolve) => {
    timeoutId = setTimeout(() => {
      console.log(`[Timeout] ${operationName} exceeded ${timeoutMs}ms - using fallback`);
      resolve({ result: fallbackValue, timedOut: true });
    }, timeoutMs);
  });

  const resultPromise = promise.then((result) => {
    clearTimeout(timeoutId);
    return { result, timedOut: false };
  }).catch((err) => {
    clearTimeout(timeoutId);
    console.error(`[Error] ${operationName} failed:`, err);
    return { result: fallbackValue, timedOut: false };
  });

  return Promise.race([resultPromise, timeoutPromise]);
}

// ============================================================================
// ITINERARY VARIETY VALIDATION
// ============================================================================

interface VarietyAnalysis {
  isValid: boolean;
  uniqueLocations: number;
  totalActivities: number;
  duplicateRate: number;
  repeatedLocations: string[];
  suggestion: string;
}

// Analyze itinerary for repetition - returns validation result
function analyzeItineraryVariety(itinerary: any): VarietyAnalysis {
  if (!itinerary?.days?.length) {
    return { isValid: true, uniqueLocations: 0, totalActivities: 0, duplicateRate: 0, repeatedLocations: [], suggestion: '' };
  }

  const locationCounts = new Map<string, number>();
  let totalActivities = 0;
  const activityTypes = new Map<string, number>(); // Debug: track what types we're seeing

  // Count all activity locations - be more permissive with type checking
  // Include activities that: have no type, have type='activity', or have unknown types
  // Exclude only: explicit meal, transport, lodging types
  const excludedTypes = new Set(['meal', 'transport', 'lodging', 'breakfast', 'lunch', 'dinner']);

  for (const day of itinerary.days) {
    for (const activity of day.activities || []) {
      const actType = (activity.type || 'unknown').toLowerCase();
      activityTypes.set(actType, (activityTypes.get(actType) || 0) + 1);

      // Count if has location AND is not an excluded type
      if (activity.location && !excludedTypes.has(actType)) {
        const normalizedLocation = activity.location.toLowerCase().trim();
        locationCounts.set(normalizedLocation, (locationCounts.get(normalizedLocation) || 0) + 1);
        totalActivities++;
      }
    }
  }

  // Debug: log what activity types we found
  console.log(`[Variety] Activity types found: ${Array.from(activityTypes.entries()).map(([t, c]) => `${t}:${c}`).join(', ')}`);
  console.log(`[Variety] Activities with locations (non-excluded): ${totalActivities}`);

  const uniqueLocations = locationCounts.size;
  const repeatedLocations = Array.from(locationCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([loc, count]) => `${loc} (${count}x)`)
    .slice(0, 10);

  // Calculate duplicate rate: how many activities are repeats
  const repeatCount = Array.from(locationCounts.values()).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const duplicateRate = totalActivities > 0 ? repeatCount / totalActivities : 0;

  // Valid if less than 30% duplicates AND at least 60% of days have unique main attractions
  const isValid = duplicateRate < 0.30 && uniqueLocations >= Math.min(itinerary.days.length * 0.6, 15);

  const suggestion = isValid ? '' :
    `Itinerary has ${(duplicateRate * 100).toFixed(0)}% duplicate locations. Need more variety.`;

  return { isValid, uniqueLocations, totalActivities, duplicateRate, repeatedLocations, suggestion };
}

// Generate avoidance list for retry prompt
function generateAvoidanceList(itinerary: any): string[] {
  const locations = new Set<string>();
  const excludedTypes = new Set(['meal', 'transport', 'lodging', 'breakfast', 'lunch', 'dinner']);

  for (const day of itinerary?.days || []) {
    for (const activity of day.activities || []) {
      const actType = (activity.type || 'unknown').toLowerCase();
      // Include all locations that aren't meals/transport/lodging
      if (activity.location && !excludedTypes.has(actType)) {
        locations.add(activity.location);
      }
    }
  }
  return Array.from(locations).slice(0, 20); // Top 20 most used
}

// Save itinerary to cache
function cacheItinerary(destination: string, itinerary: any): void {
  if (!itinerary?.days?.length) return;

  const key = normalizeDestination(destination);
  const cached: CachedItinerary = {
    destination,
    days: itinerary.days.map((day: any, index: number) => ({
      dayNumber: index + 1,
      title: day.title,
      activities: day.activities?.map((a: any) => ({
        time: a.time,
        description: a.description,
        type: a.type,
        location: a.location,
        coordinates: a.coordinates,
      })) || [],
    })),
  };

  itineraryCache.set(key, cached);
  console.log(`[Cache] Stored ${destination} (${cached.days.length} days)`);
}

// Pre-populate cache with popular destinations
function initializeItineraryCache(): void {
  // Singapore - 10 day template
  itineraryCache.set('singapore', {
    destination: 'Singapore',
    days: [
      { dayNumber: 1, title: 'Arrival & Marina Bay', activities: [
        { time: '14:00', description: 'Arrive Changi Airport', type: 'transport', location: 'Changi Airport', coordinates: { lat: 1.3644, lng: 103.9915 } },
        { time: '17:00', description: 'Marina Bay Sands', type: 'activity', location: 'Marina Bay Sands', coordinates: { lat: 1.2834, lng: 103.8607 } },
        { time: '20:00', description: 'Dinner at Lau Pa Sat', type: 'meal', location: 'Lau Pa Sat', coordinates: { lat: 1.2806, lng: 103.8505 } },
      ]},
      { dayNumber: 2, title: 'Gardens & Orchard', activities: [
        { time: '09:00', description: 'Gardens by the Bay', type: 'activity', location: 'Gardens by the Bay', coordinates: { lat: 1.2816, lng: 103.8636 } },
        { time: '13:00', description: 'Lunch at Satay by the Bay', type: 'meal', location: 'Satay by the Bay', coordinates: { lat: 1.2818, lng: 103.8652 } },
        { time: '16:00', description: 'Orchard Road shopping', type: 'activity', location: 'Orchard Road', coordinates: { lat: 1.3048, lng: 103.8318 } },
      ]},
      { dayNumber: 3, title: 'Sentosa Island', activities: [
        { time: '10:00', description: 'Universal Studios', type: 'activity', location: 'Universal Studios Singapore', coordinates: { lat: 1.254, lng: 103.8238 } },
        { time: '14:00', description: 'Lunch at Resorts World', type: 'meal', location: 'Resorts World Sentosa', coordinates: { lat: 1.2573, lng: 103.8213 } },
        { time: '17:00', description: 'Siloso Beach', type: 'activity', location: 'Siloso Beach', coordinates: { lat: 1.252, lng: 103.8107 } },
      ]},
      { dayNumber: 4, title: 'Cultural Heritage', activities: [
        { time: '09:00', description: 'Chinatown walk', type: 'activity', location: 'Chinatown', coordinates: { lat: 1.2838, lng: 103.8432 } },
        { time: '12:00', description: 'Lunch at Maxwell Food Centre', type: 'meal', location: 'Maxwell Food Centre', coordinates: { lat: 1.2804, lng: 103.8446 } },
        { time: '15:00', description: 'Little India exploration', type: 'activity', location: 'Little India', coordinates: { lat: 1.3066, lng: 103.8518 } },
      ]},
      { dayNumber: 5, title: 'Wildlife Day', activities: [
        { time: '09:00', description: 'Singapore Zoo', type: 'activity', location: 'Singapore Zoo', coordinates: { lat: 1.4043, lng: 103.793 } },
        { time: '13:00', description: 'Lunch at zoo', type: 'meal', location: 'Ah Meng Restaurant', coordinates: { lat: 1.4043, lng: 103.793 } },
        { time: '19:00', description: 'Night Safari', type: 'activity', location: 'Night Safari', coordinates: { lat: 1.4028, lng: 103.7881 } },
      ]},
      { dayNumber: 6, title: 'Museums & Art', activities: [
        { time: '10:00', description: 'National Museum', type: 'activity', location: 'National Museum of Singapore', coordinates: { lat: 1.2966, lng: 103.8485 } },
        { time: '13:00', description: 'Lunch at Bras Basah', type: 'meal', location: 'Bras Basah Complex', coordinates: { lat: 1.2975, lng: 103.8514 } },
        { time: '15:00', description: 'ArtScience Museum', type: 'activity', location: 'ArtScience Museum', coordinates: { lat: 1.2863, lng: 103.8593 } },
      ]},
      { dayNumber: 7, title: 'East Coast', activities: [
        { time: '10:00', description: 'East Coast Park cycling', type: 'activity', location: 'East Coast Park', coordinates: { lat: 1.3008, lng: 103.9123 } },
        { time: '13:00', description: 'Seafood lunch', type: 'meal', location: 'East Coast Lagoon', coordinates: { lat: 1.3065, lng: 103.9325 } },
        { time: '16:00', description: 'Katong heritage walk', type: 'activity', location: 'Katong', coordinates: { lat: 1.3052, lng: 103.9045 } },
      ]},
      { dayNumber: 8, title: 'Clarke Quay & River', activities: [
        { time: '11:00', description: 'Singapore River walk', type: 'activity', location: 'Singapore River', coordinates: { lat: 1.2882, lng: 103.8467 } },
        { time: '13:00', description: 'Lunch at Clarke Quay', type: 'meal', location: 'Clarke Quay', coordinates: { lat: 1.2905, lng: 103.8466 } },
        { time: '19:00', description: 'River cruise', type: 'activity', location: 'Clarke Quay Jetty', coordinates: { lat: 1.2905, lng: 103.8466 } },
      ]},
      { dayNumber: 9, title: 'Jewel & Shopping', activities: [
        { time: '10:00', description: 'Jewel Changi exploration', type: 'activity', location: 'Jewel Changi Airport', coordinates: { lat: 1.3602, lng: 103.9894 } },
        { time: '13:00', description: 'Lunch at Jewel', type: 'meal', location: 'Jewel Changi Airport', coordinates: { lat: 1.3602, lng: 103.9894 } },
        { time: '16:00', description: 'Last shopping at Bugis', type: 'activity', location: 'Bugis Junction', coordinates: { lat: 1.2998, lng: 103.8557 } },
      ]},
      { dayNumber: 10, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 1.2834, lng: 103.8607 } },
        { time: '11:00', description: 'Brunch before flight', type: 'meal', location: 'Changi Airport', coordinates: { lat: 1.3644, lng: 103.9915 } },
        { time: '14:00', description: 'Depart Singapore', type: 'transport', location: 'Changi Airport', coordinates: { lat: 1.3644, lng: 103.9915 } },
      ]},
    ],
  });

  // Paris - 10 day template
  itineraryCache.set('paris', {
    destination: 'Paris',
    days: [
      { dayNumber: 1, title: 'Arrival & Eiffel', activities: [
        { time: '14:00', description: 'Arrive Paris CDG', type: 'transport', location: 'Charles de Gaulle Airport', coordinates: { lat: 49.0097, lng: 2.5479 } },
        { time: '18:00', description: 'Eiffel Tower', type: 'activity', location: 'Eiffel Tower', coordinates: { lat: 48.8584, lng: 2.2945 } },
        { time: '20:30', description: 'Dinner in 7th', type: 'meal', location: 'Rue Cler', coordinates: { lat: 48.8566, lng: 2.3056 } },
      ]},
      { dayNumber: 2, title: 'Louvre & Tuileries', activities: [
        { time: '09:00', description: 'Louvre Museum', type: 'activity', location: 'Musée du Louvre', coordinates: { lat: 48.8606, lng: 2.3376 } },
        { time: '13:00', description: 'Lunch near Louvre', type: 'meal', location: 'Palais Royal', coordinates: { lat: 48.8637, lng: 2.3371 } },
        { time: '15:00', description: 'Tuileries Garden walk', type: 'activity', location: 'Jardin des Tuileries', coordinates: { lat: 48.8634, lng: 2.3275 } },
      ]},
      { dayNumber: 3, title: 'Montmartre', activities: [
        { time: '10:00', description: 'Sacré-Cœur Basilica', type: 'activity', location: 'Sacré-Cœur', coordinates: { lat: 48.8867, lng: 2.3431 } },
        { time: '12:30', description: 'Lunch in Montmartre', type: 'meal', location: 'Place du Tertre', coordinates: { lat: 48.8865, lng: 2.3409 } },
        { time: '15:00', description: 'Artist quarter walk', type: 'activity', location: 'Montmartre', coordinates: { lat: 48.8867, lng: 2.3431 } },
      ]},
      { dayNumber: 4, title: 'Champs-Élysées', activities: [
        { time: '10:00', description: 'Arc de Triomphe', type: 'activity', location: 'Arc de Triomphe', coordinates: { lat: 48.8738, lng: 2.295 } },
        { time: '12:00', description: 'Champs-Élysées walk', type: 'activity', location: 'Champs-Élysées', coordinates: { lat: 48.8698, lng: 2.3078 } },
        { time: '19:00', description: 'Seine River cruise', type: 'activity', location: 'Bateaux Mouches', coordinates: { lat: 48.8638, lng: 2.3051 } },
      ]},
      { dayNumber: 5, title: 'Versailles', activities: [
        { time: '09:00', description: 'Train to Versailles', type: 'transport', location: 'RER C', coordinates: { lat: 48.8049, lng: 2.1204 } },
        { time: '10:00', description: 'Palace of Versailles', type: 'activity', location: 'Château de Versailles', coordinates: { lat: 48.8049, lng: 2.1204 } },
        { time: '14:00', description: 'Lunch in Versailles', type: 'meal', location: 'Versailles town', coordinates: { lat: 48.8014, lng: 2.1301 } },
      ]},
      { dayNumber: 6, title: 'Latin Quarter', activities: [
        { time: '10:00', description: 'Notre-Dame area', type: 'activity', location: 'Île de la Cité', coordinates: { lat: 48.853, lng: 2.3499 } },
        { time: '13:00', description: 'Latin Quarter lunch', type: 'meal', location: 'Latin Quarter', coordinates: { lat: 48.8496, lng: 2.3459 } },
        { time: '15:00', description: 'Panthéon visit', type: 'activity', location: 'Panthéon', coordinates: { lat: 48.8462, lng: 2.346 } },
      ]},
      { dayNumber: 7, title: 'Le Marais', activities: [
        { time: '10:00', description: 'Le Marais walk', type: 'activity', location: 'Le Marais', coordinates: { lat: 48.8594, lng: 2.3622 } },
        { time: '13:00', description: 'Lunch in Marais', type: 'meal', location: "L'As du Fallafel", coordinates: { lat: 48.857, lng: 2.358 } },
        { time: '16:00', description: 'Centre Pompidou', type: 'activity', location: 'Centre Pompidou', coordinates: { lat: 48.8606, lng: 2.3522 } },
      ]},
      { dayNumber: 8, title: "Musée d'Orsay", activities: [
        { time: '09:30', description: "Musée d'Orsay", type: 'activity', location: "Musée d'Orsay", coordinates: { lat: 48.86, lng: 2.3266 } },
        { time: '13:00', description: 'Lunch at Saint-Germain', type: 'meal', location: 'Saint-Germain-des-Prés', coordinates: { lat: 48.8539, lng: 2.3338 } },
        { time: '16:00', description: 'Luxembourg Gardens', type: 'activity', location: 'Jardin du Luxembourg', coordinates: { lat: 48.8462, lng: 2.3371 } },
      ]},
      { dayNumber: 9, title: 'Shopping & Galleries', activities: [
        { time: '10:00', description: 'Galeries Lafayette', type: 'activity', location: 'Galeries Lafayette', coordinates: { lat: 48.8738, lng: 2.3318 } },
        { time: '13:00', description: 'Lunch at Opera', type: 'meal', location: 'Opera district', coordinates: { lat: 48.8719, lng: 2.3316 } },
        { time: '16:00', description: 'Palais Garnier tour', type: 'activity', location: 'Opéra Garnier', coordinates: { lat: 48.8719, lng: 2.3316 } },
      ]},
      { dayNumber: 10, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 48.8566, lng: 2.3522 } },
        { time: '11:00', description: 'Last café stop', type: 'meal', location: 'Saint-Michel', coordinates: { lat: 48.8534, lng: 2.3443 } },
        { time: '14:00', description: 'Depart Paris', type: 'transport', location: 'CDG Airport', coordinates: { lat: 49.0097, lng: 2.5479 } },
      ]},
    ],
  });

  // Tokyo - 10 day template
  itineraryCache.set('tokyo', {
    destination: 'Tokyo',
    days: [
      { dayNumber: 1, title: 'Arrival & Shinjuku', activities: [
        { time: '15:00', description: 'Arrive Narita/Haneda', type: 'transport', location: 'Tokyo Airport', coordinates: { lat: 35.7647, lng: 140.3864 } },
        { time: '18:00', description: 'Shinjuku exploration', type: 'activity', location: 'Shinjuku', coordinates: { lat: 35.6938, lng: 139.7034 } },
        { time: '20:00', description: 'Izakaya dinner', type: 'meal', location: 'Omoide Yokocho', coordinates: { lat: 35.6942, lng: 139.6993 } },
      ]},
      { dayNumber: 2, title: 'Shibuya & Harajuku', activities: [
        { time: '10:00', description: 'Shibuya Crossing', type: 'activity', location: 'Shibuya Crossing', coordinates: { lat: 35.6595, lng: 139.7004 } },
        { time: '13:00', description: 'Lunch in Shibuya', type: 'meal', location: 'Shibuya', coordinates: { lat: 35.6595, lng: 139.7004 } },
        { time: '15:00', description: 'Harajuku & Meiji Shrine', type: 'activity', location: 'Meiji Shrine', coordinates: { lat: 35.6764, lng: 139.6993 } },
      ]},
      { dayNumber: 3, title: 'Asakusa & Senso-ji', activities: [
        { time: '09:00', description: 'Senso-ji Temple', type: 'activity', location: 'Senso-ji', coordinates: { lat: 35.7148, lng: 139.7967 } },
        { time: '12:00', description: 'Lunch on Nakamise', type: 'meal', location: 'Nakamise Street', coordinates: { lat: 35.7118, lng: 139.7966 } },
        { time: '15:00', description: 'Tokyo Skytree', type: 'activity', location: 'Tokyo Skytree', coordinates: { lat: 35.7101, lng: 139.8107 } },
      ]},
      { dayNumber: 4, title: 'Akihabara & Ueno', activities: [
        { time: '10:00', description: 'Akihabara electronics', type: 'activity', location: 'Akihabara', coordinates: { lat: 35.7022, lng: 139.7744 } },
        { time: '13:00', description: 'Ramen lunch', type: 'meal', location: 'Akihabara', coordinates: { lat: 35.7022, lng: 139.7744 } },
        { time: '15:00', description: 'Ueno Park', type: 'activity', location: 'Ueno Park', coordinates: { lat: 35.7146, lng: 139.7732 } },
      ]},
      { dayNumber: 5, title: 'Tsukiji & Ginza', activities: [
        { time: '08:00', description: 'Tsukiji Outer Market', type: 'activity', location: 'Tsukiji Market', coordinates: { lat: 35.6654, lng: 139.7707 } },
        { time: '12:00', description: 'Sushi lunch', type: 'meal', location: 'Tsukiji', coordinates: { lat: 35.6654, lng: 139.7707 } },
        { time: '15:00', description: 'Ginza shopping', type: 'activity', location: 'Ginza', coordinates: { lat: 35.6717, lng: 139.765 } },
      ]},
      { dayNumber: 6, title: 'Day Trip: Nikko', activities: [
        { time: '08:00', description: 'Train to Nikko', type: 'transport', location: 'Nikko', coordinates: { lat: 36.7199, lng: 139.6983 } },
        { time: '10:30', description: 'Toshogu Shrine', type: 'activity', location: 'Nikko Toshogu', coordinates: { lat: 36.758, lng: 139.5988 } },
        { time: '13:00', description: 'Local lunch', type: 'meal', location: 'Nikko town', coordinates: { lat: 36.7199, lng: 139.6983 } },
      ]},
      { dayNumber: 7, title: 'Odaiba & Bay', activities: [
        { time: '10:00', description: 'TeamLab Borderless', type: 'activity', location: 'Odaiba', coordinates: { lat: 35.6267, lng: 139.7839 } },
        { time: '14:00', description: 'Lunch at Aqua City', type: 'meal', location: 'Aqua City Odaiba', coordinates: { lat: 35.6297, lng: 139.7751 } },
        { time: '17:00', description: 'Rainbow Bridge view', type: 'activity', location: 'Odaiba Beach', coordinates: { lat: 35.6267, lng: 139.7755 } },
      ]},
      { dayNumber: 8, title: 'Roppongi & Art', activities: [
        { time: '10:00', description: 'Mori Art Museum', type: 'activity', location: 'Roppongi Hills', coordinates: { lat: 35.6604, lng: 139.7292 } },
        { time: '13:00', description: 'Lunch in Roppongi', type: 'meal', location: 'Roppongi', coordinates: { lat: 35.6628, lng: 139.7315 } },
        { time: '16:00', description: 'Tokyo Tower', type: 'activity', location: 'Tokyo Tower', coordinates: { lat: 35.6586, lng: 139.7454 } },
      ]},
      { dayNumber: 9, title: 'Last Shopping', activities: [
        { time: '10:00', description: 'Ikebukuro shopping', type: 'activity', location: 'Ikebukuro', coordinates: { lat: 35.7295, lng: 139.7109 } },
        { time: '13:00', description: 'Department store lunch', type: 'meal', location: 'Ikebukuro', coordinates: { lat: 35.7295, lng: 139.7109 } },
        { time: '16:00', description: 'Tokyo Station area', type: 'activity', location: 'Tokyo Station', coordinates: { lat: 35.6812, lng: 139.7671 } },
      ]},
      { dayNumber: 10, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 35.6762, lng: 139.6503 } },
        { time: '10:30', description: 'Last convenience store', type: 'meal', location: 'Tokyo Station', coordinates: { lat: 35.6812, lng: 139.7671 } },
        { time: '13:00', description: 'Depart Tokyo', type: 'transport', location: 'Narita Airport', coordinates: { lat: 35.7647, lng: 140.3864 } },
      ]},
    ],
  });

  // Rome - 10 day template
  itineraryCache.set('rome', {
    destination: 'Rome',
    days: [
      { dayNumber: 1, title: 'Arrival & Centro', activities: [
        { time: '14:00', description: 'Arrive Rome FCO', type: 'transport', location: 'Fiumicino Airport', coordinates: { lat: 41.8003, lng: 12.2389 } },
        { time: '17:00', description: 'Trevi Fountain', type: 'activity', location: 'Trevi Fountain', coordinates: { lat: 41.9009, lng: 12.4833 } },
        { time: '20:00', description: 'Dinner in Trastevere', type: 'meal', location: 'Trastevere', coordinates: { lat: 41.8867, lng: 12.4692 } },
      ]},
      { dayNumber: 2, title: 'Colosseum & Forum', activities: [
        { time: '09:00', description: 'Colosseum tour', type: 'activity', location: 'Colosseum', coordinates: { lat: 41.8902, lng: 12.4922 } },
        { time: '13:00', description: 'Lunch near Forum', type: 'meal', location: 'Monti', coordinates: { lat: 41.8945, lng: 12.4923 } },
        { time: '15:00', description: 'Roman Forum walk', type: 'activity', location: 'Roman Forum', coordinates: { lat: 41.8925, lng: 12.4853 } },
      ]},
      { dayNumber: 3, title: 'Vatican City', activities: [
        { time: '08:30', description: 'Vatican Museums', type: 'activity', location: 'Vatican Museums', coordinates: { lat: 41.9065, lng: 12.4536 } },
        { time: '13:00', description: 'Lunch near Vatican', type: 'meal', location: 'Prati', coordinates: { lat: 41.9073, lng: 12.4619 } },
        { time: '15:00', description: "St. Peter's Basilica", type: 'activity', location: "St. Peter's Basilica", coordinates: { lat: 41.9022, lng: 12.4539 } },
      ]},
      { dayNumber: 4, title: 'Piazzas & Pantheon', activities: [
        { time: '10:00', description: 'Piazza Navona', type: 'activity', location: 'Piazza Navona', coordinates: { lat: 41.899, lng: 12.4731 } },
        { time: '12:00', description: 'Pantheon visit', type: 'activity', location: 'Pantheon', coordinates: { lat: 41.8986, lng: 12.4769 } },
        { time: '13:30', description: 'Lunch at Campo de Fiori', type: 'meal', location: 'Campo de Fiori', coordinates: { lat: 41.8956, lng: 12.4722 } },
      ]},
      { dayNumber: 5, title: 'Borghese & Spanish Steps', activities: [
        { time: '09:00', description: 'Borghese Gallery', type: 'activity', location: 'Galleria Borghese', coordinates: { lat: 41.9142, lng: 12.4922 } },
        { time: '13:00', description: 'Picnic in Villa Borghese', type: 'meal', location: 'Villa Borghese', coordinates: { lat: 41.9128, lng: 12.4853 } },
        { time: '16:00', description: 'Spanish Steps', type: 'activity', location: 'Spanish Steps', coordinates: { lat: 41.906, lng: 12.4828 } },
      ]},
      { dayNumber: 6, title: 'Day Trip: Pompeii', activities: [
        { time: '07:30', description: 'Train to Pompeii', type: 'transport', location: 'Roma Termini', coordinates: { lat: 41.9003, lng: 12.5022 } },
        { time: '10:30', description: 'Pompeii ruins', type: 'activity', location: 'Pompeii', coordinates: { lat: 40.7508, lng: 14.4869 } },
        { time: '14:00', description: 'Lunch in Pompeii', type: 'meal', location: 'Pompeii town', coordinates: { lat: 40.7508, lng: 14.4869 } },
      ]},
      { dayNumber: 7, title: 'Trastevere & Jewish Quarter', activities: [
        { time: '10:00', description: 'Trastevere morning walk', type: 'activity', location: 'Trastevere', coordinates: { lat: 41.8867, lng: 12.4692 } },
        { time: '13:00', description: 'Lunch in Trastevere', type: 'meal', location: 'Trastevere', coordinates: { lat: 41.8867, lng: 12.4692 } },
        { time: '16:00', description: 'Jewish Ghetto', type: 'activity', location: 'Jewish Ghetto', coordinates: { lat: 41.8925, lng: 12.4772 } },
      ]},
      { dayNumber: 8, title: 'Appian Way', activities: [
        { time: '09:00', description: 'Appian Way bike tour', type: 'activity', location: 'Via Appia Antica', coordinates: { lat: 41.8558, lng: 12.5189 } },
        { time: '13:00', description: 'Picnic on Appian', type: 'meal', location: 'Via Appia Antica', coordinates: { lat: 41.8558, lng: 12.5189 } },
        { time: '16:00', description: 'Catacombs visit', type: 'activity', location: 'Catacombs of San Callisto', coordinates: { lat: 41.8578, lng: 12.5153 } },
      ]},
      { dayNumber: 9, title: 'Shopping & Gelato', activities: [
        { time: '10:00', description: 'Via del Corso shopping', type: 'activity', location: 'Via del Corso', coordinates: { lat: 41.9022, lng: 12.4794 } },
        { time: '13:00', description: 'Final Roman lunch', type: 'meal', location: 'Centro Storico', coordinates: { lat: 41.8992, lng: 12.4731 } },
        { time: '16:00', description: 'Gelato tour', type: 'activity', location: 'Giolitti', coordinates: { lat: 41.8992, lng: 12.4786 } },
      ]},
      { dayNumber: 10, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 41.9009, lng: 12.4833 } },
        { time: '10:30', description: 'Last espresso', type: 'meal', location: "Sant'Eustachio", coordinates: { lat: 41.8983, lng: 12.4753 } },
        { time: '13:00', description: 'Depart Rome', type: 'transport', location: 'Fiumicino Airport', coordinates: { lat: 41.8003, lng: 12.2389 } },
      ]},
    ],
  });

  // Dubai - 8 day template
  itineraryCache.set('dubai', {
    destination: 'Dubai',
    days: [
      { dayNumber: 1, title: 'Arrival & Downtown', activities: [
        { time: '15:00', description: 'Arrive Dubai DXB', type: 'transport', location: 'Dubai Airport', coordinates: { lat: 25.2528, lng: 55.3644 } },
        { time: '19:00', description: 'Burj Khalifa sunset', type: 'activity', location: 'Burj Khalifa', coordinates: { lat: 25.1972, lng: 55.2744 } },
        { time: '21:00', description: 'Dubai Mall dinner', type: 'meal', location: 'Dubai Mall', coordinates: { lat: 25.1972, lng: 55.2795 } },
      ]},
      { dayNumber: 2, title: 'Old Dubai', activities: [
        { time: '09:00', description: 'Dubai Creek abra ride', type: 'activity', location: 'Dubai Creek', coordinates: { lat: 25.2697, lng: 55.2963 } },
        { time: '11:00', description: 'Gold & Spice Souks', type: 'activity', location: 'Deira Souks', coordinates: { lat: 25.2697, lng: 55.3 } },
        { time: '13:00', description: 'Arabic lunch', type: 'meal', location: 'Al Fahidi', coordinates: { lat: 25.2636, lng: 55.2972 } },
      ]},
      { dayNumber: 3, title: 'Palm & Beach', activities: [
        { time: '10:00', description: 'Atlantis Aquaventure', type: 'activity', location: 'Atlantis The Palm', coordinates: { lat: 25.1304, lng: 55.1172 } },
        { time: '14:00', description: 'Lunch at Atlantis', type: 'meal', location: 'Atlantis The Palm', coordinates: { lat: 25.1304, lng: 55.1172 } },
        { time: '17:00', description: 'JBR Beach walk', type: 'activity', location: 'JBR Beach', coordinates: { lat: 25.0762, lng: 55.1331 } },
      ]},
      { dayNumber: 4, title: 'Desert Safari', activities: [
        { time: '10:00', description: 'Morning at leisure', type: 'activity', location: 'Hotel', coordinates: { lat: 25.1972, lng: 55.2744 } },
        { time: '15:00', description: 'Desert Safari pickup', type: 'activity', location: 'Dubai Desert', coordinates: { lat: 24.9833, lng: 55.4667 } },
        { time: '20:00', description: 'BBQ dinner in desert', type: 'meal', location: 'Desert Camp', coordinates: { lat: 24.9833, lng: 55.4667 } },
      ]},
      { dayNumber: 5, title: 'Marina & Blue Waters', activities: [
        { time: '10:00', description: 'Dubai Marina walk', type: 'activity', location: 'Dubai Marina', coordinates: { lat: 25.0762, lng: 55.1404 } },
        { time: '13:00', description: 'Lunch at Marina', type: 'meal', location: 'Pier 7', coordinates: { lat: 25.0762, lng: 55.1404 } },
        { time: '17:00', description: 'Ain Dubai (Eye)', type: 'activity', location: 'Bluewaters Island', coordinates: { lat: 25.0786, lng: 55.1192 } },
      ]},
      { dayNumber: 6, title: 'Culture & Frame', activities: [
        { time: '09:00', description: 'Dubai Frame', type: 'activity', location: 'Dubai Frame', coordinates: { lat: 25.2354, lng: 55.3003 } },
        { time: '12:00', description: 'Lunch at City Walk', type: 'meal', location: 'City Walk', coordinates: { lat: 25.2094, lng: 55.2614 } },
        { time: '15:00', description: 'Museum of the Future', type: 'activity', location: 'Museum of the Future', coordinates: { lat: 25.2197, lng: 55.2806 } },
      ]},
      { dayNumber: 7, title: 'Shopping Day', activities: [
        { time: '10:00', description: 'Mall of Emirates', type: 'activity', location: 'Mall of the Emirates', coordinates: { lat: 25.1181, lng: 55.2006 } },
        { time: '14:00', description: 'Lunch at MOE', type: 'meal', location: 'Mall of the Emirates', coordinates: { lat: 25.1181, lng: 55.2006 } },
        { time: '17:00', description: 'Global Village', type: 'activity', location: 'Global Village', coordinates: { lat: 25.0717, lng: 55.3069 } },
      ]},
      { dayNumber: 8, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 25.1972, lng: 55.2744 } },
        { time: '10:30', description: 'Last shawarma', type: 'meal', location: 'Airport area', coordinates: { lat: 25.2528, lng: 55.3644 } },
        { time: '13:00', description: 'Depart Dubai', type: 'transport', location: 'Dubai Airport', coordinates: { lat: 25.2528, lng: 55.3644 } },
      ]},
    ],
  });

  // London - 10 day template
  itineraryCache.set('london', {
    destination: 'London',
    days: [
      { dayNumber: 1, title: 'Arrival & Westminster', activities: [
        { time: '14:00', description: 'Arrive London Heathrow', type: 'transport', location: 'Heathrow Airport', coordinates: { lat: 51.47, lng: -0.4543 } },
        { time: '17:00', description: 'Westminster Abbey area', type: 'activity', location: 'Westminster', coordinates: { lat: 51.4994, lng: -0.1273 } },
        { time: '20:00', description: 'Dinner in Soho', type: 'meal', location: 'Soho', coordinates: { lat: 51.5137, lng: -0.1337 } },
      ]},
      { dayNumber: 2, title: 'Royal London', activities: [
        { time: '10:00', description: 'Buckingham Palace', type: 'activity', location: 'Buckingham Palace', coordinates: { lat: 51.5014, lng: -0.1419 } },
        { time: '13:00', description: 'Lunch at St James', type: 'meal', location: "St James's Park", coordinates: { lat: 51.5025, lng: -0.1348 } },
        { time: '15:00', description: 'Tower of London', type: 'activity', location: 'Tower of London', coordinates: { lat: 51.5081, lng: -0.0759 } },
      ]},
      { dayNumber: 3, title: 'Museums Day', activities: [
        { time: '10:00', description: 'British Museum', type: 'activity', location: 'British Museum', coordinates: { lat: 51.5194, lng: -0.127 } },
        { time: '13:00', description: 'Lunch in Bloomsbury', type: 'meal', location: 'Bloomsbury', coordinates: { lat: 51.5194, lng: -0.127 } },
        { time: '15:00', description: 'Natural History Museum', type: 'activity', location: 'Natural History Museum', coordinates: { lat: 51.4967, lng: -0.1764 } },
      ]},
      { dayNumber: 4, title: 'South Bank', activities: [
        { time: '10:00', description: 'Tate Modern', type: 'activity', location: 'Tate Modern', coordinates: { lat: 51.5076, lng: -0.0994 } },
        { time: '13:00', description: 'Borough Market lunch', type: 'meal', location: 'Borough Market', coordinates: { lat: 51.5055, lng: -0.091 } },
        { time: '16:00', description: 'London Eye', type: 'activity', location: 'London Eye', coordinates: { lat: 51.5033, lng: -0.1196 } },
      ]},
      { dayNumber: 5, title: 'Harry Potter & Markets', activities: [
        { time: '09:00', description: 'Kings Cross Platform 9¾', type: 'activity', location: 'Kings Cross', coordinates: { lat: 51.5322, lng: -0.124 } },
        { time: '11:00', description: 'Camden Market', type: 'activity', location: 'Camden Market', coordinates: { lat: 51.5415, lng: -0.1463 } },
        { time: '14:00', description: 'Camden lunch', type: 'meal', location: 'Camden', coordinates: { lat: 51.5415, lng: -0.1463 } },
      ]},
      { dayNumber: 6, title: 'Greenwich', activities: [
        { time: '10:00', description: 'Thames boat to Greenwich', type: 'transport', location: 'Greenwich Pier', coordinates: { lat: 51.4826, lng: -0.0077 } },
        { time: '11:30', description: 'Royal Observatory', type: 'activity', location: 'Royal Observatory', coordinates: { lat: 51.4772, lng: -0.0015 } },
        { time: '14:00', description: 'Lunch in Greenwich', type: 'meal', location: 'Greenwich Market', coordinates: { lat: 51.4816, lng: -0.0085 } },
      ]},
      { dayNumber: 7, title: 'Notting Hill & Hyde Park', activities: [
        { time: '10:00', description: 'Notting Hill walk', type: 'activity', location: 'Notting Hill', coordinates: { lat: 51.5173, lng: -0.2017 } },
        { time: '12:00', description: 'Portobello Road Market', type: 'activity', location: 'Portobello Road', coordinates: { lat: 51.5194, lng: -0.2051 } },
        { time: '15:00', description: 'Hyde Park stroll', type: 'activity', location: 'Hyde Park', coordinates: { lat: 51.5073, lng: -0.1657 } },
      ]},
      { dayNumber: 8, title: 'Theatre & Covent Garden', activities: [
        { time: '11:00', description: 'Covent Garden', type: 'activity', location: 'Covent Garden', coordinates: { lat: 51.512, lng: -0.1227 } },
        { time: '13:00', description: 'Lunch at Covent Garden', type: 'meal', location: 'Covent Garden', coordinates: { lat: 51.512, lng: -0.1227 } },
        { time: '19:30', description: 'West End show', type: 'activity', location: 'West End', coordinates: { lat: 51.5115, lng: -0.128 } },
      ]},
      { dayNumber: 9, title: 'Day Trip: Stonehenge', activities: [
        { time: '08:00', description: 'Coach to Stonehenge', type: 'transport', location: 'Victoria Coach Station', coordinates: { lat: 51.4952, lng: -0.1486 } },
        { time: '11:00', description: 'Stonehenge visit', type: 'activity', location: 'Stonehenge', coordinates: { lat: 51.1789, lng: -1.8262 } },
        { time: '14:00', description: 'Lunch in Salisbury', type: 'meal', location: 'Salisbury', coordinates: { lat: 51.0688, lng: -1.7945 } },
      ]},
      { dayNumber: 10, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 51.5074, lng: -0.1278 } },
        { time: '10:30', description: 'Last fish & chips', type: 'meal', location: 'Central London', coordinates: { lat: 51.5074, lng: -0.1278 } },
        { time: '13:00', description: 'Depart London', type: 'transport', location: 'Heathrow Airport', coordinates: { lat: 51.47, lng: -0.4543 } },
      ]},
    ],
  });

  // Bangkok - 8 day template
  itineraryCache.set('bangkok', {
    destination: 'Bangkok',
    days: [
      { dayNumber: 1, title: 'Arrival & Khao San', activities: [
        { time: '15:00', description: 'Arrive Suvarnabhumi Airport', type: 'transport', location: 'Suvarnabhumi Airport', coordinates: { lat: 13.6900, lng: 100.7501 } },
        { time: '18:00', description: 'Khao San Road evening', type: 'activity', location: 'Khao San Road', coordinates: { lat: 13.7589, lng: 100.4974 } },
        { time: '20:00', description: 'Street food dinner', type: 'meal', location: 'Khao San Road', coordinates: { lat: 13.7589, lng: 100.4974 } },
      ]},
      { dayNumber: 2, title: 'Grand Palace & Temples', activities: [
        { time: '08:30', description: 'Grand Palace visit', type: 'activity', location: 'Grand Palace', coordinates: { lat: 13.7500, lng: 100.4913 } },
        { time: '12:00', description: 'Lunch near palace', type: 'meal', location: 'Tha Maharaj', coordinates: { lat: 13.7567, lng: 100.4881 } },
        { time: '14:00', description: 'Wat Pho temple', type: 'activity', location: 'Wat Pho', coordinates: { lat: 13.7465, lng: 100.4930 } },
      ]},
      { dayNumber: 3, title: 'Chatuchak & Shopping', activities: [
        { time: '09:00', description: 'Chatuchak Weekend Market', type: 'activity', location: 'Chatuchak Market', coordinates: { lat: 13.7999, lng: 100.5508 } },
        { time: '13:00', description: 'Market food court lunch', type: 'meal', location: 'Chatuchak Market', coordinates: { lat: 13.7999, lng: 100.5508 } },
        { time: '17:00', description: 'MBK Center shopping', type: 'activity', location: 'MBK Center', coordinates: { lat: 13.7448, lng: 100.5298 } },
      ]},
      { dayNumber: 4, title: 'Floating Markets', activities: [
        { time: '06:00', description: 'Damnoen Saduak Market', type: 'activity', location: 'Damnoen Saduak', coordinates: { lat: 13.5231, lng: 99.9578 } },
        { time: '12:00', description: 'Thai lunch at market', type: 'meal', location: 'Damnoen Saduak', coordinates: { lat: 13.5231, lng: 99.9578 } },
        { time: '17:00', description: 'Asiatique riverfront', type: 'activity', location: 'Asiatique', coordinates: { lat: 13.7049, lng: 100.5014 } },
      ]},
      { dayNumber: 5, title: 'Ayutthaya Day Trip', activities: [
        { time: '08:00', description: 'Train to Ayutthaya', type: 'transport', location: 'Hua Lamphong Station', coordinates: { lat: 13.7381, lng: 100.5173 } },
        { time: '10:00', description: 'Ancient temples tour', type: 'activity', location: 'Ayutthaya Historical Park', coordinates: { lat: 14.3532, lng: 100.5685 } },
        { time: '13:00', description: 'Local lunch', type: 'meal', location: 'Ayutthaya', coordinates: { lat: 14.3532, lng: 100.5685 } },
      ]},
      { dayNumber: 6, title: 'Modern Bangkok', activities: [
        { time: '10:00', description: 'Siam Paragon mall', type: 'activity', location: 'Siam Paragon', coordinates: { lat: 13.7466, lng: 100.5347 } },
        { time: '13:00', description: 'Food court lunch', type: 'meal', location: 'Siam Paragon', coordinates: { lat: 13.7466, lng: 100.5347 } },
        { time: '18:00', description: 'Rooftop bar sunset', type: 'activity', location: 'Sky Bar', coordinates: { lat: 13.7237, lng: 100.5168 } },
      ]},
      { dayNumber: 7, title: 'Spa & Culture', activities: [
        { time: '10:00', description: 'Thai massage & spa', type: 'activity', location: 'Wat Pho Massage', coordinates: { lat: 13.7465, lng: 100.4930 } },
        { time: '14:00', description: 'Jim Thompson House', type: 'activity', location: 'Jim Thompson House', coordinates: { lat: 13.7494, lng: 100.5278 } },
        { time: '19:00', description: 'Farewell dinner cruise', type: 'meal', location: 'Chao Phraya River', coordinates: { lat: 13.7400, lng: 100.5100 } },
      ]},
      { dayNumber: 8, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 13.7466, lng: 100.5347 } },
        { time: '11:00', description: 'Last pad thai', type: 'meal', location: 'Thip Samai', coordinates: { lat: 13.7556, lng: 100.5017 } },
        { time: '14:00', description: 'Depart Bangkok', type: 'transport', location: 'Suvarnabhumi Airport', coordinates: { lat: 13.6900, lng: 100.7501 } },
      ]},
    ],
  });

  // Bali - 10 day template
  itineraryCache.set('bali', {
    destination: 'Bali',
    days: [
      { dayNumber: 1, title: 'Arrival in Seminyak', activities: [
        { time: '14:00', description: 'Arrive Ngurah Rai Airport', type: 'transport', location: 'Ngurah Rai Airport', coordinates: { lat: -8.7467, lng: 115.1670 } },
        { time: '17:00', description: 'Seminyak Beach sunset', type: 'activity', location: 'Seminyak Beach', coordinates: { lat: -8.6914, lng: 115.1560 } },
        { time: '19:30', description: 'Dinner at Ku De Ta', type: 'meal', location: 'Ku De Ta', coordinates: { lat: -8.6890, lng: 115.1545 } },
      ]},
      { dayNumber: 2, title: 'Ubud Culture', activities: [
        { time: '08:00', description: 'Drive to Ubud', type: 'transport', location: 'Ubud', coordinates: { lat: -8.5069, lng: 115.2625 } },
        { time: '10:00', description: 'Tegallalang Rice Terraces', type: 'activity', location: 'Tegallalang', coordinates: { lat: -8.4312, lng: 115.2795 } },
        { time: '13:00', description: 'Lunch overlooking rice fields', type: 'meal', location: 'Tegallalang', coordinates: { lat: -8.4312, lng: 115.2795 } },
      ]},
      { dayNumber: 3, title: 'Ubud Temples & Art', activities: [
        { time: '09:00', description: 'Monkey Forest sanctuary', type: 'activity', location: 'Monkey Forest', coordinates: { lat: -8.5185, lng: 115.2587 } },
        { time: '12:00', description: 'Ubud Market lunch', type: 'meal', location: 'Ubud Market', coordinates: { lat: -8.5066, lng: 115.2621 } },
        { time: '15:00', description: 'Tirta Empul Temple', type: 'activity', location: 'Tirta Empul', coordinates: { lat: -8.4156, lng: 115.3153 } },
      ]},
      { dayNumber: 4, title: 'Mount Batur Sunrise', activities: [
        { time: '02:00', description: 'Mount Batur trek start', type: 'activity', location: 'Mount Batur', coordinates: { lat: -8.2421, lng: 115.3750 } },
        { time: '06:00', description: 'Sunrise at summit', type: 'activity', location: 'Mount Batur Summit', coordinates: { lat: -8.2421, lng: 115.3750 } },
        { time: '12:00', description: 'Hot springs relaxation', type: 'activity', location: 'Toya Devasya Hot Springs', coordinates: { lat: -8.2583, lng: 115.4003 } },
      ]},
      { dayNumber: 5, title: 'East Bali', activities: [
        { time: '09:00', description: 'Tirta Gangga Water Palace', type: 'activity', location: 'Tirta Gangga', coordinates: { lat: -8.4125, lng: 115.5875 } },
        { time: '12:00', description: 'Seaside lunch', type: 'meal', location: 'Candidasa', coordinates: { lat: -8.5078, lng: 115.5650 } },
        { time: '15:00', description: 'Lempuyang Temple Gates', type: 'activity', location: 'Lempuyang Temple', coordinates: { lat: -8.3906, lng: 115.6308 } },
      ]},
      { dayNumber: 6, title: 'Nusa Penida Day Trip', activities: [
        { time: '07:00', description: 'Boat to Nusa Penida', type: 'transport', location: 'Sanur Harbor', coordinates: { lat: -8.6917, lng: 115.2625 } },
        { time: '10:00', description: 'Kelingking Beach viewpoint', type: 'activity', location: 'Kelingking Beach', coordinates: { lat: -8.7527, lng: 115.4702 } },
        { time: '14:00', description: 'Crystal Bay snorkeling', type: 'activity', location: 'Crystal Bay', coordinates: { lat: -8.7161, lng: 115.4581 } },
      ]},
      { dayNumber: 7, title: 'Uluwatu & Beaches', activities: [
        { time: '10:00', description: 'Uluwatu Temple', type: 'activity', location: 'Uluwatu Temple', coordinates: { lat: -8.8294, lng: 115.0849 } },
        { time: '13:00', description: 'Beach club lunch', type: 'meal', location: 'Sundays Beach Club', coordinates: { lat: -8.8108, lng: 115.1150 } },
        { time: '18:00', description: 'Kecak dance at sunset', type: 'activity', location: 'Uluwatu Temple', coordinates: { lat: -8.8294, lng: 115.0849 } },
      ]},
      { dayNumber: 8, title: 'Canggu Vibes', activities: [
        { time: '09:00', description: 'Surf lesson', type: 'activity', location: 'Echo Beach', coordinates: { lat: -8.6553, lng: 115.1244 } },
        { time: '12:00', description: 'Healthy brunch', type: 'meal', location: 'Crate Cafe', coordinates: { lat: -8.6488, lng: 115.1361 } },
        { time: '17:00', description: 'Tanah Lot Temple sunset', type: 'activity', location: 'Tanah Lot', coordinates: { lat: -8.6214, lng: 115.0867 } },
      ]},
      { dayNumber: 9, title: 'Spa & Relaxation', activities: [
        { time: '10:00', description: 'Balinese spa treatment', type: 'activity', location: 'Seminyak Spa', coordinates: { lat: -8.6914, lng: 115.1560 } },
        { time: '14:00', description: 'Pool & beach afternoon', type: 'activity', location: 'Potato Head Beach Club', coordinates: { lat: -8.6847, lng: 115.1525 } },
        { time: '19:00', description: 'Farewell dinner', type: 'meal', location: 'La Lucciola', coordinates: { lat: -8.6878, lng: 115.1533 } },
      ]},
      { dayNumber: 10, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: -8.6914, lng: 115.1560 } },
        { time: '11:00', description: 'Last Bali coffee', type: 'meal', location: 'Revolver Espresso', coordinates: { lat: -8.6875, lng: 115.1642 } },
        { time: '14:00', description: 'Depart Bali', type: 'transport', location: 'Ngurah Rai Airport', coordinates: { lat: -8.7467, lng: 115.1670 } },
      ]},
    ],
  });

  // New York - 8 day template
  itineraryCache.set('new york', {
    destination: 'New York',
    days: [
      { dayNumber: 1, title: 'Arrival & Times Square', activities: [
        { time: '14:00', description: 'Arrive JFK Airport', type: 'transport', location: 'JFK Airport', coordinates: { lat: 40.6413, lng: -73.7781 } },
        { time: '18:00', description: 'Times Square lights', type: 'activity', location: 'Times Square', coordinates: { lat: 40.7580, lng: -73.9855 } },
        { time: '20:00', description: 'Broadway dinner', type: 'meal', location: 'Theater District', coordinates: { lat: 40.7590, lng: -73.9845 } },
      ]},
      { dayNumber: 2, title: 'Statue & Downtown', activities: [
        { time: '09:00', description: 'Statue of Liberty ferry', type: 'activity', location: 'Battery Park', coordinates: { lat: 40.6892, lng: -74.0445 } },
        { time: '13:00', description: 'Lunch in Financial District', type: 'meal', location: 'Stone Street', coordinates: { lat: 40.7041, lng: -74.0103 } },
        { time: '15:00', description: '9/11 Memorial', type: 'activity', location: '9/11 Memorial', coordinates: { lat: 40.7115, lng: -74.0134 } },
      ]},
      { dayNumber: 3, title: 'Central Park & Museums', activities: [
        { time: '09:00', description: 'Central Park walk', type: 'activity', location: 'Central Park', coordinates: { lat: 40.7829, lng: -73.9654 } },
        { time: '12:00', description: 'Met Museum visit', type: 'activity', location: 'Metropolitan Museum', coordinates: { lat: 40.7794, lng: -73.9632 } },
        { time: '19:00', description: 'Upper East Side dinner', type: 'meal', location: 'Upper East Side', coordinates: { lat: 40.7736, lng: -73.9566 } },
      ]},
      { dayNumber: 4, title: 'Brooklyn Day', activities: [
        { time: '10:00', description: 'Brooklyn Bridge walk', type: 'activity', location: 'Brooklyn Bridge', coordinates: { lat: 40.7061, lng: -73.9969 } },
        { time: '12:00', description: 'DUMBO exploration', type: 'activity', location: 'DUMBO', coordinates: { lat: 40.7033, lng: -73.9894 } },
        { time: '15:00', description: 'Williamsburg afternoon', type: 'activity', location: 'Williamsburg', coordinates: { lat: 40.7081, lng: -73.9571 } },
      ]},
      { dayNumber: 5, title: 'Empire State & Midtown', activities: [
        { time: '10:00', description: 'Empire State Building', type: 'activity', location: 'Empire State Building', coordinates: { lat: 40.7484, lng: -73.9857 } },
        { time: '13:00', description: 'Koreatown lunch', type: 'meal', location: 'Koreatown', coordinates: { lat: 40.7479, lng: -73.9877 } },
        { time: '16:00', description: 'Grand Central Terminal', type: 'activity', location: 'Grand Central', coordinates: { lat: 40.7527, lng: -73.9772 } },
      ]},
      { dayNumber: 6, title: 'High Line & Chelsea', activities: [
        { time: '10:00', description: 'High Line walk', type: 'activity', location: 'High Line', coordinates: { lat: 40.7480, lng: -74.0048 } },
        { time: '12:00', description: 'Chelsea Market lunch', type: 'meal', location: 'Chelsea Market', coordinates: { lat: 40.7424, lng: -74.0060 } },
        { time: '15:00', description: 'Hudson Yards', type: 'activity', location: 'Hudson Yards', coordinates: { lat: 40.7536, lng: -74.0019 } },
      ]},
      { dayNumber: 7, title: 'Broadway & Shopping', activities: [
        { time: '11:00', description: '5th Avenue shopping', type: 'activity', location: '5th Avenue', coordinates: { lat: 40.7549, lng: -73.9840 } },
        { time: '14:00', description: 'Rockefeller Center', type: 'activity', location: 'Rockefeller Center', coordinates: { lat: 40.7587, lng: -73.9787 } },
        { time: '20:00', description: 'Broadway show', type: 'activity', location: 'Broadway', coordinates: { lat: 40.7590, lng: -73.9845 } },
      ]},
      { dayNumber: 8, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 40.7580, lng: -73.9855 } },
        { time: '10:30', description: 'Last NYC bagel', type: 'meal', location: 'Russ & Daughters', coordinates: { lat: 40.7224, lng: -73.9879 } },
        { time: '14:00', description: 'Depart New York', type: 'transport', location: 'JFK Airport', coordinates: { lat: 40.6413, lng: -73.7781 } },
      ]},
    ],
  });

  // Barcelona - 7 day template
  itineraryCache.set('barcelona', {
    destination: 'Barcelona',
    days: [
      { dayNumber: 1, title: 'Arrival & Gothic Quarter', activities: [
        { time: '14:00', description: 'Arrive Barcelona El Prat', type: 'transport', location: 'El Prat Airport', coordinates: { lat: 41.2974, lng: 2.0833 } },
        { time: '17:00', description: 'Gothic Quarter walk', type: 'activity', location: 'Barri Gòtic', coordinates: { lat: 41.3833, lng: 2.1777 } },
        { time: '20:00', description: 'Tapas dinner', type: 'meal', location: 'El Born', coordinates: { lat: 41.3850, lng: 2.1825 } },
      ]},
      { dayNumber: 2, title: 'Gaudí Day', activities: [
        { time: '09:00', description: 'Sagrada Familia', type: 'activity', location: 'Sagrada Familia', coordinates: { lat: 41.4036, lng: 2.1744 } },
        { time: '13:00', description: 'Lunch in Eixample', type: 'meal', location: 'Eixample', coordinates: { lat: 41.3950, lng: 2.1620 } },
        { time: '15:00', description: 'Park Güell', type: 'activity', location: 'Park Güell', coordinates: { lat: 41.4145, lng: 2.1527 } },
      ]},
      { dayNumber: 3, title: 'La Rambla & Beach', activities: [
        { time: '10:00', description: 'La Boqueria Market', type: 'activity', location: 'La Boqueria', coordinates: { lat: 41.3816, lng: 2.1719 } },
        { time: '12:00', description: 'La Rambla stroll', type: 'activity', location: 'La Rambla', coordinates: { lat: 41.3797, lng: 2.1746 } },
        { time: '15:00', description: 'Barceloneta Beach', type: 'activity', location: 'Barceloneta', coordinates: { lat: 41.3758, lng: 2.1894 } },
      ]},
      { dayNumber: 4, title: 'Montjuïc', activities: [
        { time: '10:00', description: 'Montjuïc Castle', type: 'activity', location: 'Montjuïc Castle', coordinates: { lat: 41.3633, lng: 2.1658 } },
        { time: '13:00', description: 'Olympic Stadium area', type: 'activity', location: 'Olympic Stadium', coordinates: { lat: 41.3647, lng: 2.1556 } },
        { time: '21:00', description: 'Magic Fountain show', type: 'activity', location: 'Magic Fountain', coordinates: { lat: 41.3714, lng: 2.1519 } },
      ]},
      { dayNumber: 5, title: 'More Gaudí', activities: [
        { time: '10:00', description: 'Casa Batlló', type: 'activity', location: 'Casa Batlló', coordinates: { lat: 41.3917, lng: 2.1650 } },
        { time: '12:00', description: 'Casa Milà (La Pedrera)', type: 'activity', location: 'Casa Milà', coordinates: { lat: 41.3953, lng: 2.1619 } },
        { time: '14:00', description: 'Passeig de Gràcia lunch', type: 'meal', location: 'Passeig de Gràcia', coordinates: { lat: 41.3930, lng: 2.1635 } },
      ]},
      { dayNumber: 6, title: 'Day Trip: Montserrat', activities: [
        { time: '08:00', description: 'Train to Montserrat', type: 'transport', location: 'Montserrat', coordinates: { lat: 41.5933, lng: 1.8375 } },
        { time: '10:00', description: 'Montserrat Monastery', type: 'activity', location: 'Montserrat Monastery', coordinates: { lat: 41.5933, lng: 1.8375 } },
        { time: '13:00', description: 'Mountain lunch', type: 'meal', location: 'Montserrat', coordinates: { lat: 41.5933, lng: 1.8375 } },
      ]},
      { dayNumber: 7, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 41.3850, lng: 2.1734 } },
        { time: '10:30', description: 'Last paella', type: 'meal', location: 'Barceloneta', coordinates: { lat: 41.3758, lng: 2.1894 } },
        { time: '14:00', description: 'Depart Barcelona', type: 'transport', location: 'El Prat Airport', coordinates: { lat: 41.2974, lng: 2.0833 } },
      ]},
    ],
  });

  // Amsterdam - 6 day template
  itineraryCache.set('amsterdam', {
    destination: 'Amsterdam',
    days: [
      { dayNumber: 1, title: 'Arrival & Canal Ring', activities: [
        { time: '14:00', description: 'Arrive Schiphol Airport', type: 'transport', location: 'Schiphol Airport', coordinates: { lat: 52.3105, lng: 4.7683 } },
        { time: '17:00', description: 'Canal cruise', type: 'activity', location: 'Central Station', coordinates: { lat: 52.3791, lng: 4.9003 } },
        { time: '20:00', description: 'Dinner in Jordaan', type: 'meal', location: 'Jordaan', coordinates: { lat: 52.3747, lng: 4.8819 } },
      ]},
      { dayNumber: 2, title: 'Museums & Culture', activities: [
        { time: '09:00', description: 'Anne Frank House', type: 'activity', location: 'Anne Frank House', coordinates: { lat: 52.3752, lng: 4.8840 } },
        { time: '13:00', description: 'Lunch in Nine Streets', type: 'meal', location: 'De 9 Straatjes', coordinates: { lat: 52.3697, lng: 4.8847 } },
        { time: '15:00', description: 'Van Gogh Museum', type: 'activity', location: 'Van Gogh Museum', coordinates: { lat: 52.3584, lng: 4.8811 } },
      ]},
      { dayNumber: 3, title: 'Rijksmuseum & Vondelpark', activities: [
        { time: '09:30', description: 'Rijksmuseum visit', type: 'activity', location: 'Rijksmuseum', coordinates: { lat: 52.3600, lng: 4.8852 } },
        { time: '13:00', description: 'Museum Quarter lunch', type: 'meal', location: 'Museumplein', coordinates: { lat: 52.3579, lng: 4.8830 } },
        { time: '15:00', description: 'Vondelpark relaxation', type: 'activity', location: 'Vondelpark', coordinates: { lat: 52.3579, lng: 4.8686 } },
      ]},
      { dayNumber: 4, title: 'Neighborhoods', activities: [
        { time: '10:00', description: 'Albert Cuyp Market', type: 'activity', location: 'Albert Cuyp Market', coordinates: { lat: 52.3559, lng: 4.8947 } },
        { time: '13:00', description: 'De Pijp lunch', type: 'meal', location: 'De Pijp', coordinates: { lat: 52.3548, lng: 4.8936 } },
        { time: '16:00', description: 'NDSM Wharf art', type: 'activity', location: 'NDSM Wharf', coordinates: { lat: 52.4012, lng: 4.8914 } },
      ]},
      { dayNumber: 5, title: 'Day Trip: Zaanse Schans', activities: [
        { time: '09:00', description: 'Train to Zaanse Schans', type: 'transport', location: 'Zaanse Schans', coordinates: { lat: 52.4736, lng: 4.8183 } },
        { time: '10:00', description: 'Windmills exploration', type: 'activity', location: 'Zaanse Schans Windmills', coordinates: { lat: 52.4736, lng: 4.8183 } },
        { time: '14:00', description: 'Dutch cheese tasting', type: 'meal', location: 'Zaanse Schans', coordinates: { lat: 52.4736, lng: 4.8183 } },
      ]},
      { dayNumber: 6, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 52.3676, lng: 4.9041 } },
        { time: '10:30', description: 'Last stroopwafel', type: 'meal', location: 'Albert Cuyp Market', coordinates: { lat: 52.3559, lng: 4.8947 } },
        { time: '13:00', description: 'Depart Amsterdam', type: 'transport', location: 'Schiphol Airport', coordinates: { lat: 52.3105, lng: 4.7683 } },
      ]},
    ],
  });

  // Istanbul - 7 day template
  itineraryCache.set('istanbul', {
    destination: 'Istanbul',
    days: [
      { dayNumber: 1, title: 'Arrival & Sultanahmet', activities: [
        { time: '14:00', description: 'Arrive Istanbul Airport', type: 'transport', location: 'Istanbul Airport', coordinates: { lat: 41.2753, lng: 28.7519 } },
        { time: '18:00', description: 'Sultanahmet Square walk', type: 'activity', location: 'Sultanahmet', coordinates: { lat: 41.0082, lng: 28.9784 } },
        { time: '20:00', description: 'Turkish dinner', type: 'meal', location: 'Sultanahmet', coordinates: { lat: 41.0082, lng: 28.9784 } },
      ]},
      { dayNumber: 2, title: 'Hagia Sophia & Blue Mosque', activities: [
        { time: '09:00', description: 'Hagia Sophia visit', type: 'activity', location: 'Hagia Sophia', coordinates: { lat: 41.0086, lng: 28.9802 } },
        { time: '12:00', description: 'Lunch near mosque', type: 'meal', location: 'Sultanahmet', coordinates: { lat: 41.0054, lng: 28.9768 } },
        { time: '14:00', description: 'Blue Mosque', type: 'activity', location: 'Blue Mosque', coordinates: { lat: 41.0054, lng: 28.9768 } },
      ]},
      { dayNumber: 3, title: 'Topkapi & Grand Bazaar', activities: [
        { time: '09:00', description: 'Topkapi Palace', type: 'activity', location: 'Topkapi Palace', coordinates: { lat: 41.0115, lng: 28.9833 } },
        { time: '13:00', description: 'Palace gardens lunch', type: 'meal', location: 'Topkapi', coordinates: { lat: 41.0115, lng: 28.9833 } },
        { time: '15:00', description: 'Grand Bazaar shopping', type: 'activity', location: 'Grand Bazaar', coordinates: { lat: 41.0108, lng: 28.9680 } },
      ]},
      { dayNumber: 4, title: 'Bosphorus Cruise', activities: [
        { time: '10:00', description: 'Bosphorus boat tour', type: 'activity', location: 'Eminönü Pier', coordinates: { lat: 41.0175, lng: 28.9714 } },
        { time: '14:00', description: 'Fish lunch on water', type: 'meal', location: 'Bosphorus', coordinates: { lat: 41.0850, lng: 29.0550 } },
        { time: '17:00', description: 'Dolmabahçe Palace', type: 'activity', location: 'Dolmabahçe Palace', coordinates: { lat: 41.0392, lng: 29.0003 } },
      ]},
      { dayNumber: 5, title: 'Asian Side', activities: [
        { time: '10:00', description: 'Ferry to Kadıköy', type: 'transport', location: 'Kadıköy', coordinates: { lat: 40.9906, lng: 29.0236 } },
        { time: '11:00', description: 'Kadıköy Market', type: 'activity', location: 'Kadıköy Market', coordinates: { lat: 40.9906, lng: 29.0236 } },
        { time: '15:00', description: 'Moda neighborhood walk', type: 'activity', location: 'Moda', coordinates: { lat: 40.9833, lng: 29.0283 } },
      ]},
      { dayNumber: 6, title: 'Spice Bazaar & Galata', activities: [
        { time: '10:00', description: 'Spice Bazaar', type: 'activity', location: 'Spice Bazaar', coordinates: { lat: 41.0167, lng: 28.9708 } },
        { time: '13:00', description: 'Karaköy lunch', type: 'meal', location: 'Karaköy', coordinates: { lat: 41.0219, lng: 28.9756 } },
        { time: '15:00', description: 'Galata Tower sunset', type: 'activity', location: 'Galata Tower', coordinates: { lat: 41.0256, lng: 28.9742 } },
      ]},
      { dayNumber: 7, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: 41.0082, lng: 28.9784 } },
        { time: '10:30', description: 'Last Turkish breakfast', type: 'meal', location: 'Karaköy', coordinates: { lat: 41.0219, lng: 28.9756 } },
        { time: '14:00', description: 'Depart Istanbul', type: 'transport', location: 'Istanbul Airport', coordinates: { lat: 41.2753, lng: 28.7519 } },
      ]},
    ],
  });

  // Sydney - 8 day template
  itineraryCache.set('sydney', {
    destination: 'Sydney',
    days: [
      { dayNumber: 1, title: 'Arrival & Harbour', activities: [
        { time: '08:00', description: 'Arrive Sydney Airport', type: 'transport', location: 'Sydney Airport', coordinates: { lat: -33.9399, lng: 151.1753 } },
        { time: '14:00', description: 'Circular Quay walk', type: 'activity', location: 'Circular Quay', coordinates: { lat: -33.8610, lng: 151.2108 } },
        { time: '18:00', description: 'Opera House exterior', type: 'activity', location: 'Sydney Opera House', coordinates: { lat: -33.8568, lng: 151.2153 } },
      ]},
      { dayNumber: 2, title: 'Opera House & Rocks', activities: [
        { time: '10:00', description: 'Opera House tour', type: 'activity', location: 'Sydney Opera House', coordinates: { lat: -33.8568, lng: 151.2153 } },
        { time: '13:00', description: 'The Rocks lunch', type: 'meal', location: 'The Rocks', coordinates: { lat: -33.8594, lng: 151.2081 } },
        { time: '15:00', description: 'Harbour Bridge walk', type: 'activity', location: 'Harbour Bridge', coordinates: { lat: -33.8523, lng: 151.2108 } },
      ]},
      { dayNumber: 3, title: 'Bondi to Coogee', activities: [
        { time: '09:00', description: 'Bondi Beach morning', type: 'activity', location: 'Bondi Beach', coordinates: { lat: -33.8915, lng: 151.2767 } },
        { time: '11:00', description: 'Coastal walk to Coogee', type: 'activity', location: 'Bondi to Coogee Walk', coordinates: { lat: -33.9200, lng: 151.2575 } },
        { time: '14:00', description: 'Coogee Beach lunch', type: 'meal', location: 'Coogee Beach', coordinates: { lat: -33.9200, lng: 151.2575 } },
      ]},
      { dayNumber: 4, title: 'Blue Mountains Day Trip', activities: [
        { time: '07:00', description: 'Train to Katoomba', type: 'transport', location: 'Blue Mountains', coordinates: { lat: -33.7139, lng: 150.3119 } },
        { time: '10:00', description: 'Three Sisters lookout', type: 'activity', location: 'Three Sisters', coordinates: { lat: -33.7325, lng: 150.3125 } },
        { time: '13:00', description: 'Mountain village lunch', type: 'meal', location: 'Katoomba', coordinates: { lat: -33.7139, lng: 150.3119 } },
      ]},
      { dayNumber: 5, title: 'Taronga Zoo & Manly', activities: [
        { time: '09:00', description: 'Ferry to Taronga Zoo', type: 'activity', location: 'Taronga Zoo', coordinates: { lat: -33.8436, lng: 151.2411 } },
        { time: '14:00', description: 'Ferry to Manly', type: 'transport', location: 'Manly', coordinates: { lat: -33.7969, lng: 151.2875 } },
        { time: '16:00', description: 'Manly Beach sunset', type: 'activity', location: 'Manly Beach', coordinates: { lat: -33.7969, lng: 151.2875 } },
      ]},
      { dayNumber: 6, title: 'Darling Harbour', activities: [
        { time: '10:00', description: 'SEA LIFE Aquarium', type: 'activity', location: 'SEA LIFE Sydney', coordinates: { lat: -33.8700, lng: 151.2022 } },
        { time: '13:00', description: 'Darling Harbour lunch', type: 'meal', location: 'Darling Harbour', coordinates: { lat: -33.8731, lng: 151.1989 } },
        { time: '16:00', description: 'Barangaroo waterfront', type: 'activity', location: 'Barangaroo', coordinates: { lat: -33.8608, lng: 151.2017 } },
      ]},
      { dayNumber: 7, title: 'Markets & Culture', activities: [
        { time: '09:00', description: 'Paddington Markets', type: 'activity', location: 'Paddington', coordinates: { lat: -33.8844, lng: 151.2267 } },
        { time: '12:00', description: 'Surry Hills brunch', type: 'meal', location: 'Surry Hills', coordinates: { lat: -33.8850, lng: 151.2117 } },
        { time: '15:00', description: 'Art Gallery of NSW', type: 'activity', location: 'Art Gallery of NSW', coordinates: { lat: -33.8689, lng: 151.2172 } },
      ]},
      { dayNumber: 8, title: 'Departure', activities: [
        { time: '09:00', description: 'Hotel checkout', type: 'activity', location: 'Hotel', coordinates: { lat: -33.8688, lng: 151.2093 } },
        { time: '10:30', description: 'Last flat white', type: 'meal', location: 'The Rocks', coordinates: { lat: -33.8594, lng: 151.2081 } },
        { time: '14:00', description: 'Depart Sydney', type: 'transport', location: 'Sydney Airport', coordinates: { lat: -33.9399, lng: 151.1753 } },
      ]},
    ],
  });

  // Maldives - 7 day template
  itineraryCache.set('maldives', {
    destination: 'Maldives',
    days: [
      { dayNumber: 1, title: 'Arrival in Paradise', activities: [
        { time: '12:00', description: 'Arrive Malé Airport', type: 'transport', location: 'Velana International Airport', coordinates: { lat: 4.1918, lng: 73.5290 } },
        { time: '14:00', description: 'Speedboat to resort', type: 'transport', location: 'Resort Island', coordinates: { lat: 4.2500, lng: 73.5500 } },
        { time: '19:00', description: 'Beach dinner', type: 'meal', location: 'Resort Beach', coordinates: { lat: 4.2500, lng: 73.5500 } },
      ]},
      { dayNumber: 2, title: 'Island Relaxation', activities: [
        { time: '08:00', description: 'Sunrise yoga', type: 'activity', location: 'Beach', coordinates: { lat: 4.2500, lng: 73.5500 } },
        { time: '10:00', description: 'Snorkeling house reef', type: 'activity', location: 'House Reef', coordinates: { lat: 4.2510, lng: 73.5520 } },
        { time: '14:00', description: 'Overwater villa lunch', type: 'meal', location: 'Overwater Restaurant', coordinates: { lat: 4.2505, lng: 73.5510 } },
      ]},
      { dayNumber: 3, title: 'Water Sports Day', activities: [
        { time: '09:00', description: 'Jet ski adventure', type: 'activity', location: 'Water Sports Center', coordinates: { lat: 4.2500, lng: 73.5500 } },
        { time: '12:00', description: 'Beachside lunch', type: 'meal', location: 'Beach Bar', coordinates: { lat: 4.2500, lng: 73.5500 } },
        { time: '15:00', description: 'Parasailing', type: 'activity', location: 'Lagoon', coordinates: { lat: 4.2500, lng: 73.5500 } },
      ]},
      { dayNumber: 4, title: 'Diving Experience', activities: [
        { time: '08:00', description: 'Scuba diving trip', type: 'activity', location: 'Dive Site', coordinates: { lat: 4.2300, lng: 73.5700 } },
        { time: '13:00', description: 'Lunch at resort', type: 'meal', location: 'Main Restaurant', coordinates: { lat: 4.2500, lng: 73.5500 } },
        { time: '16:00', description: 'Sunset dolphin cruise', type: 'activity', location: 'Open Ocean', coordinates: { lat: 4.2200, lng: 73.5400 } },
      ]},
      { dayNumber: 5, title: 'Malé Day Trip', activities: [
        { time: '09:00', description: 'Speedboat to Malé', type: 'transport', location: 'Malé', coordinates: { lat: 4.1755, lng: 73.5093 } },
        { time: '10:00', description: 'Malé city tour', type: 'activity', location: 'Malé', coordinates: { lat: 4.1755, lng: 73.5093 } },
        { time: '13:00', description: 'Local Maldivian lunch', type: 'meal', location: 'Malé', coordinates: { lat: 4.1755, lng: 73.5093 } },
      ]},
      { dayNumber: 6, title: 'Spa & Romance', activities: [
        { time: '10:00', description: 'Couples spa treatment', type: 'activity', location: 'Overwater Spa', coordinates: { lat: 4.2510, lng: 73.5515 } },
        { time: '14:00', description: 'Private sandbank picnic', type: 'meal', location: 'Private Sandbank', coordinates: { lat: 4.2400, lng: 73.5600 } },
        { time: '19:00', description: 'Underwater restaurant dinner', type: 'meal', location: 'Underwater Restaurant', coordinates: { lat: 4.2505, lng: 73.5505 } },
      ]},
      { dayNumber: 7, title: 'Departure', activities: [
        { time: '07:00', description: 'Sunrise breakfast', type: 'meal', location: 'Beach', coordinates: { lat: 4.2500, lng: 73.5500 } },
        { time: '10:00', description: 'Resort checkout', type: 'activity', location: 'Resort', coordinates: { lat: 4.2500, lng: 73.5500 } },
        { time: '14:00', description: 'Depart Maldives', type: 'transport', location: 'Velana Airport', coordinates: { lat: 4.1918, lng: 73.5290 } },
      ]},
    ],
  });

  console.log(`[Cache] Initialized with ${itineraryCache.size} destinations: ${Array.from(itineraryCache.keys()).join(', ')}`);
}

// Initialize cache on startup
initializeItineraryCache();

// Safe JSON parser with fallback - handles truncated JSON from AI responses
function safeJsonParse(text: string, fallback: any = {}): any {
  if (!text || text.trim() === '') return fallback;

  // Debug: log response length and ending
  const responseLen = text.length;
  const lastChars = text.slice(-100);
  console.log(`[JSON Parse] Response length: ${responseLen}, ends with: ${lastChars.replace(/\n/g, '\\n')}`);

  try {
    // Try direct parse first
    const result = JSON.parse(text);
    console.log(`[JSON Parse] Direct parse SUCCESS - ${result.days?.length || 0} days`);
    return result;
  } catch (directError: any) {
    console.log(`[JSON Parse] Direct parse failed: ${directError.message?.substring(0, 100)}`);

    // Try to extract JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {}
    }

    // Try to find JSON object in text
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // Try multiple repair strategies for truncated JSON
        let truncated = objectMatch[0];

        // Strategy 1: Aggressively clean trailing incomplete content
        // Remove incomplete number values (e.g., "lat": 40.0799, <- cut off)
        truncated = truncated.replace(/,\s*$/, ''); // trailing comma
        truncated = truncated.replace(/:\s*-?\d+\.?\d*\s*$/, ': 0'); // incomplete number at end
        truncated = truncated.replace(/:\s*-?\d+\.?\d*,\s*$/, ': 0,'); // incomplete number before comma

        // Remove incomplete string values
        truncated = truncated.replace(/:\s*"[^"]*$/, ': ""'); // incomplete string

        // Remove incomplete objects/arrays at the end (more aggressive)
        // Pattern: trailing incomplete nested structures
        truncated = truncated.replace(/,\s*\{[^{}]*$/, ''); // incomplete object at end
        truncated = truncated.replace(/,\s*\[[^\[\]]*$/, ''); // incomplete array at end
        truncated = truncated.replace(/,\s*"[^"]*"\s*:\s*\{[^{}]*$/, ''); // incomplete property with object
        truncated = truncated.replace(/,\s*"[^"]*"\s*:\s*\[[^\[\]]*$/, ''); // incomplete property with array
        truncated = truncated.replace(/,\s*"[^"]*"\s*:?\s*$/, ''); // incomplete property name

        // Clean up any double commas or trailing commas before brackets
        truncated = truncated.replace(/,\s*,/g, ',');
        truncated = truncated.replace(/,\s*\]/g, ']');
        truncated = truncated.replace(/,\s*\}/g, '}');

        // Count and balance brackets
        const openBraces = (truncated.match(/\{/g) || []).length;
        const closeBraces = (truncated.match(/\}/g) || []).length;
        const openBrackets = (truncated.match(/\[/g) || []).length;
        const closeBrackets = (truncated.match(/\]/g) || []).length;

        // Close brackets in correct order (inner first)
        for (let i = 0; i < openBrackets - closeBrackets; i++) truncated += ']';
        for (let i = 0; i < openBraces - closeBraces; i++) truncated += '}';

        try {
          const repaired = JSON.parse(truncated);
          console.log('[JSON Repair] Successfully repaired truncated JSON');
          return repaired;
        } catch (e1) {
          // Strategy 2: Try to find the last complete day object
          const dayPattern = /\{"day":\d+[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
          const dayMatches = truncated.match(dayPattern);
          if (dayMatches && dayMatches.length > 0) {
            try {
              const repairedDays = `{"days":[${dayMatches.join(',')}]}`;
              const parsed = JSON.parse(repairedDays);
              console.log(`[JSON Repair] Extracted ${parsed.days.length} complete day objects`);
              return parsed;
            } catch {}
          }

          // Strategy 3: Find complete activity objects and reconstruct
          const activityPattern = /\{"time":"[^"]+","description":"[^"]+","type":"[^"]+","location":"[^"]+","coordinates":\{"lat":-?\d+\.?\d*,"lng":-?\d+\.?\d*\}(?:,"estimatedCost":\d+)?\}/g;
          const activityMatches = text.match(activityPattern);
          if (activityMatches && activityMatches.length >= 3) {
            // Group activities into days (roughly 4 per day)
            const days: any[] = [];
            const activitiesPerDay = 4;
            for (let i = 0; i < activityMatches.length; i += activitiesPerDay) {
              const dayActivities = activityMatches.slice(i, i + activitiesPerDay);
              days.push({
                day: days.length + 1,
                date: "",
                title: `Day ${days.length + 1}`,
                activities: dayActivities.map(a => JSON.parse(a))
              });
            }
            if (days.length > 0) {
              console.log(`[JSON Repair] Reconstructed ${days.length} days from ${activityMatches.length} activities`);
              return { days };
            }
          }
        }
      }
    }

    console.error('[JSON Repair] All repair strategies failed, using fallback. First 500 chars:', text.substring(0, 500));
    return fallback;
  }
}

// ============================================================================
// DESTINATION IMAGE FETCHING - Stores AI-fetched image URL for My Trips cards
// ============================================================================
async function fetchAndStoreDestinationImage(tripId: number, destination: string): Promise<void> {
  try {
    console.log(`[DestImage] Fetching image for trip ${tripId}: ${destination}`);
    const result = await aiGetDestinationImage(destination);

    if (result.imageUrl) {
      // Store the image URL directly in the trip record
      await storage.updateTrip(tripId, { destinationImageUrl: result.imageUrl } as any);
      console.log(`[DestImage] Stored image for trip ${tripId}: ${result.landmark} → ${result.imageUrl.slice(0, 60)}...`);
    } else {
      console.log(`[DestImage] No image found for trip ${tripId}: ${destination}`);
    }
  } catch (error) {
    console.error(`[DestImage] Error fetching image for trip ${tripId}:`, error);
  }
}

// Background processor for trip analysis
// ============================================================================
// TWO-STAGE PROCESSING: Stage 1 - Feasibility Only (Fast, 5-8 seconds)
// ============================================================================
async function processFeasibilityOnly(tripId: number, input: any) {
  const startTime = Date.now();
  console.log(`[Stage1] Starting feasibility check for trip ${tripId}`);
  updateProgress(tripId, PROGRESS_STEPS.STARTING, "Checking if your trip is possible...");

  try {
    // Validate trip duration
    const dates = parseDateRange(input.dates);
    if (dates) {
      const tripDuration = Math.ceil((new Date(dates.endDate).getTime() - new Date(dates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (tripDuration > 60) {
        console.log(`[Stage1] Trip ${tripId} rejected: ${tripDuration} days is too long`);
        const now = new Date().toISOString();
        await storage.updateTripFeasibility(tripId, "no", {
          schemaVersion: FEASIBILITY_SCHEMA_VERSION,
          overall: "no",
          score: 0,
          breakdown: {
            accessibility: { status: "impossible", reason: `${tripDuration}-day trip exceeds maximum supported duration of 60 days` },
            visa: { status: "ok", reason: "N/A - trip too long" },
            budget: { status: "ok", estimatedCost: 0, reason: "N/A - trip too long" },
            safety: { status: "safe", reason: "N/A - trip too long" }
          },
          summary: `A ${tripDuration}-day trip is too long for detailed planning. Please plan trips of 60 days or less.`,
          generatedAt: now,
        });
        clearProgress(tripId);
        return;
      }
    }

    if (!openai) {
      console.log(`[Stage1] No AI provider, cannot check feasibility`);
      clearProgress(tripId);
      return;
    }

    const residenceCountry = input.residence || input.passport;
    const hasResidency = input.residence && input.residence !== input.passport;
    const originCity = input.origin || residenceCountry;
    const currency = input.currency || 'USD';
    const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

    const isCustomBudget = input.travelStyle === 'custom';
    const travelStyleLabel = input.travelStyle === 'budget' ? 'Budget' :
                             input.travelStyle === 'standard' ? 'Comfort' :
                             input.travelStyle === 'luxury' ? 'Luxury' : 'Custom';

    const budgetInfo = isCustomBudget
      ? `${currencySymbol}${input.budget} ${currency} budget`
      : `${travelStyleLabel} travel style (AI will calculate appropriate costs)`;

    const budgetInstruction = isCustomBudget
      ? `"budget":{"status":"ok|tight|impossible","estimatedCost":number,"reason":"brief in ${currency}"}`
      : `"budget":{"status":"ok","estimatedCost":0,"reason":"${travelStyleLabel} travel - costs calculated by AI"}`;

    // ============ RAG VISA LOOKUP (Stage 1) ============
    let ragVisaFacts: VisaFacts | null = null;
    let ragVisaDetails: VisaDetails | null = null;

    // Extract country code from passport/destination
    const passportCodeMap: Record<string, string> = {
      india: "IN", indian: "IN", us: "US", usa: "US", "united states": "US",
      uk: "GB", "united kingdom": "GB", australia: "AU", canada: "CA",
      germany: "DE", france: "FR", japan: "JP", china: "CN", singapore: "SG",
    };
    const destCodeMap: Record<string, string> = {
      thailand: "TH", japan: "JP", singapore: "SG", uae: "AE", dubai: "AE",
      indonesia: "ID", bali: "ID", maldives: "MV", "sri lanka": "LK",
      vietnam: "VN", malaysia: "MY", india: "IN", usa: "US", uk: "GB",
      france: "FR", germany: "DE", italy: "IT", spain: "ES", australia: "AU",
    };

    const passportCode = passportCodeMap[input.passport.toLowerCase()] || input.passport.toUpperCase().slice(0, 2);
    const destCode = destCodeMap[input.destination.toLowerCase().split(",")[0].trim()] ||
                     input.destination.toUpperCase().slice(0, 2);

    try {
      ragVisaFacts = await VisaService.getVisaFactsFromKnowledge(passportCode, destCode);
      if (ragVisaFacts) {
        ragVisaDetails = VisaService.convertVisaFactsToVisaDetails(ragVisaFacts);
        console.log(`[Stage1-RAG] Using cited visa data for ${passportCode} → ${destCode}: ${ragVisaFacts.visaStatus}`);
      }
    } catch (ragError) {
      console.warn(`[Stage1-RAG] Visa lookup failed, falling back to AI:`, ragError);
    }

    // Build evidence bundle for AI prompt (token-efficient, prevents hallucination)
    const visaEvidenceBundle = ragVisaFacts
      ? buildVisaEvidenceBundle({ visaFacts: ragVisaFacts })
      : null;

    const evidenceBundleText = visaEvidenceBundle
      ? `\n=== VISA EVIDENCE (use these facts, do not invent) ===\n${formatEvidenceBundleForPrompt(visaEvidenceBundle)}\n===`
      : '';

    const visaInstructionForAI = ragVisaFacts
      ? `"visa": {"status": "${ragVisaFacts.visaStatus === 'visa_free' ? 'ok' : 'issue'}", "reason": "Use summary from evidence bundle"}`
      : `"visa": {"status": "ok|issue", "reason": "Use 'ok' ONLY if NO visa required. Use 'issue' if ANY visa needed."}`;

    const confidenceWarning = visaEvidenceBundle?.confidence === 'low'
      ? '\nIMPORTANT: Visa confidence is LOW. You MUST mention "verify with official sources" in summary.'
      : '';

    const feasibilityPrompt = `CRITICAL: Determine if this trip is POSSIBLE. JSON only, no markdown.

Trip Request: ${originCity} → ${input.destination}
Passport: ${input.passport}. Residence: ${residenceCountry}${hasResidency ? " (PR)" : ""}.
Travel dates: ${input.dates}, ${input.groupSize} travelers, ${budgetInfo}.
${evidenceBundleText}${confidenceWarning}

CHECK IN ORDER:
1. ACCESSIBILITY: Is ${input.destination} accessible to regular tourists? (Not war zones, closed countries, restricted areas)
${ragVisaFacts ? '2. VISA: Use the VISA EVIDENCE provided above. Do not guess or invent facts.' : '2. VISA: What visa requirements for ' + input.passport + ' passport holders?'}
3. SAFETY: Current safety conditions?
${isCustomBudget ? '4. BUDGET: Is the budget realistic?' : ''}

Return JSON:
{
  "overall": "yes|no|warning",
  "score": 0-100,
  "breakdown": {
    "accessibility": {"status": "accessible|restricted|impossible", "reason": "brief"},
    ${visaInstructionForAI},
    ${budgetInstruction},
    "safety": {"status": "safe|caution|danger", "reason": "brief"}
  },
  "summary": "1-2 sentences about trip feasibility"
}`;

    updateProgress(tripId, PROGRESS_STEPS.FEASIBILITY, `Checking ${input.passport} passport requirements for ${input.destination}`);

    const feasibilityResponse = await openai.chat.completions.create({
      model: aiModel,
      messages: [
        { role: "system", content: "Travel analyst. Concise JSON responses only." },
        { role: "user", content: feasibilityPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 400,
    });

    const report = safeJsonParse(feasibilityResponse.choices[0].message.content || "{}", {
      overall: "warning",
      score: 50,
      breakdown: {
        accessibility: { status: "accessible", reason: "Accessibility check pending" },
        visa: { status: "issue", reason: "Unable to analyze visa requirements" },
        budget: { status: "ok", estimatedCost: 0, reason: "Budget analysis pending" },
        safety: { status: "safe", reason: "Safety analysis pending" }
      },
      summary: "Analysis incomplete - please refresh"
    }) as FeasibilityReport;

    // ============ GENERATE VISA DETAILS (SERVER = SINGLE SOURCE OF TRUTH) ============
    // Priority: 1) RAG (cited) → 2) Corridor (curated) → 3) AI (estimated)
    // Calculate days until trip
    let daysUntilTrip = 30; // Default fallback
    if (dates) {
      const tripDate = new Date(dates.startDate);
      const today = new Date();
      daysUntilTrip = Math.max(0, Math.ceil((tripDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Extract destination country from destination string (e.g., "Tokyo, Japan" -> "Japan")
    const destinationParts = input.destination.split(',');
    const destinationCountry = destinationParts.length > 1
      ? destinationParts[destinationParts.length - 1].trim()
      : input.destination;

    let visaDetails: VisaDetails | null = null;

    // PRIORITY 1: Use RAG visa details if available (cited from knowledge base)
    if (ragVisaDetails) {
      visaDetails = ragVisaDetails;
      console.log(`[Stage1] Using RAG cited visa data for ${passportCode} → ${destCode} (confidence: ${visaDetails.confidenceLevel}, ${visaDetails.sources?.length || 0} citations)`);
    } else {
      // PRIORITY 2: Try corridor lookup (curated data)
      const corridorData = getCorridorData(input.passport, destinationCountry);

      if (corridorData) {
        console.log(`[Stage1] Using curated corridor data for ${input.passport} → ${destinationCountry}`);
        visaDetails = corridorToVisaDetails(corridorData, daysUntilTrip);
      } else {
        // PRIORITY 3: Generate estimated visa details from AI response
        const visaInfo = report.breakdown?.visa;
        const visaRequired = visaInfo?.status === 'issue';
        const visaReason = visaInfo?.reason || '';

        // Determine visa type from AI response
        let visaType: VisaDetails['type'] = 'embassy_visa';
        const reasonLower = visaReason.toLowerCase();
        if (reasonLower.includes('e-visa') || reasonLower.includes('evisa')) {
          visaType = 'e_visa';
        } else if (reasonLower.includes('on arrival') || reasonLower.includes('on-arrival')) {
          visaType = 'visa_on_arrival';
        } else if (reasonLower.includes('visa-free') || reasonLower.includes('no visa') || !visaRequired) {
          visaType = 'visa_free';
        }

        visaDetails = generateEstimatedVisaDetails(
          visaRequired,
          visaType,
          visaReason,
          daysUntilTrip,
          destinationCountry
        );
        console.log(`[Stage1] Using estimated visa data for ${input.passport} → ${destinationCountry} (confidence: ${visaDetails.confidenceLevel})`);
      }
    }

    // Attach visa details and metadata to report
    report.visaDetails = visaDetails || undefined;
    const now = new Date();
    report.schemaVersion = FEASIBILITY_SCHEMA_VERSION;
    report.generatedAt = now.toISOString();
    report.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // +7 days

    // ============ CONFIDENCE-BASED SCORE ADJUSTMENT ============
    // Cap the score and verdict based on visa confidence level
    // - high: normal score (no change)
    // - medium: reduce score by 10%, add warning
    // - low: reduce by 25%, cap overall at "yes" (POSSIBLE), add verification warning
    const confidence = visaDetails?.confidenceLevel || 'low';
    const originalScore = report.score;

    if (confidence === 'medium') {
      report.score = Math.round(report.score * 0.9);
      if (report.breakdown?.visa) {
        report.breakdown.visa.reason = `${report.breakdown.visa.reason} (limited sources - verify before booking)`;
      }
    } else if (confidence === 'low') {
      report.score = Math.min(Math.round(report.score * 0.75), 70); // Cap at 70 max
      if (report.overall === 'yes' && report.score < 70) {
        report.overall = 'warning';
      }
      report.summary = `${report.summary} Verify visa requirements with official sources.`;
      if (report.breakdown?.visa) {
        report.breakdown.visa.status = 'issue';
        report.breakdown.visa.reason = `${report.breakdown.visa.reason} (UNVERIFIED - requires confirmation)`;
      }
      // Mark visa type as requires_verification for low confidence with no sources
      if (visaDetails && (!visaDetails.sources || visaDetails.sources.length === 0)) {
        visaDetails.type = 'requires_verification';
      }
    }

    if (originalScore !== report.score) {
      console.log(`[Stage1] Score adjusted: ${originalScore} → ${report.score} (confidence: ${confidence})`);
    }

    await storage.updateTripFeasibility(tripId, report.overall, report);
    console.log(`[Stage1] Feasibility: ${report.overall} (score: ${report.score}) in ${Date.now() - startTime}ms`);

    // Track analytics
    trackFeasibilityVerdict(report.overall, report.score, input.passport, input.destination);

    // Fetch and cache destination image (non-blocking)
    fetchAndStoreDestinationImage(tripId, input.destination).catch(err => {
      console.error(`[Stage1] Failed to fetch destination image:`, err);
    });

    // Stage 1 complete - feasibility is ready
    updateProgress(tripId, { step: 2, message: "Feasibility check complete" }, "Ready for your decision");
    clearProgress(tripId);

  } catch (error) {
    console.error(`[Stage1] Error checking feasibility for trip ${tripId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const now = new Date().toISOString();
    await storage.updateTripFeasibility(tripId, "error", {
      schemaVersion: FEASIBILITY_SCHEMA_VERSION,
      overall: "warning",
      score: 50,
      breakdown: {
        accessibility: { status: "accessible", reason: "Could not verify accessibility" },
        visa: { status: "issue", reason: "Could not verify visa requirements - please check manually" },
        budget: { status: "ok", estimatedCost: 0, reason: "Budget analysis unavailable" },
        safety: { status: "safe", reason: "Could not verify safety - please check travel advisories" }
      },
      summary: "We couldn't fully analyze this trip. Please verify visa and safety requirements before booking.",
      generatedAt: now,
    }, errorMessage);
    clearProgress(tripId);
  }
}

// ============================================================================
// TWO-STAGE PROCESSING: Stage 2 - Generate Itinerary (Called on user action)
// ============================================================================
async function generateItineraryForTrip(tripId: number, options?: { riskOverride?: boolean }) {
  const startTime = Date.now();
  const riskOverride = options?.riskOverride || false;
  console.log(`[Stage2] Starting itinerary generation for trip ${tripId}${riskOverride ? ' (RISK OVERRIDE)' : ''}`);

  try {
    // Get the trip data
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      console.error(`[Stage2] Trip ${tripId} not found`);
      return;
    }

    // Check if feasibility was done
    if (!trip.feasibilityReport || trip.feasibilityStatus === 'pending') {
      console.error(`[Stage2] Trip ${tripId} has no feasibility report`);
      return;
    }

    // Check if trip is feasible (allow override for soft blockers)
    const report = trip.feasibilityReport as FeasibilityReport;
    if (report.overall === 'no' && !riskOverride) {
      console.log(`[Stage2] Trip ${tripId} not feasible, skipping itinerary`);
      return;
    }

    // Build input object from trip data
    const input = {
      passport: trip.passport,
      origin: trip.origin,
      destination: trip.destination,
      dates: trip.dates,
      budget: trip.budget,
      currency: trip.currency || 'USD',
      groupSize: trip.groupSize,
      adults: trip.adults,
      children: trip.children,
      infants: trip.infants,
      travelStyle: trip.travelStyle || 'standard',
      residence: trip.residence,
    };

    // Now call the original background processor but skip feasibility (already done)
    // Pass riskOverride flag to generate risk-aware itinerary
    await processTripInBackground(tripId, input, true, riskOverride); // Pass flag to skip feasibility + risk override

  } catch (error) {
    console.error(`[Stage2] Error generating itinerary for trip ${tripId}:`, error);
  }
}

// Original full background processor (now with optional skip feasibility flag)
async function processTripInBackground(tripId: number, input: any, skipFeasibility: boolean = false, riskOverride: boolean = false) {
  const startTime = Date.now();
  console.log(`[Background] Starting analysis for trip ${tripId}${skipFeasibility ? ' (skipping feasibility)' : ''}${riskOverride ? ' (RISK-AWARE MODE)' : ''}`);
  updateProgress(tripId, PROGRESS_STEPS.STARTING, "Initializing...");

  try {
    // Validate trip duration - block extremely long trips (60+ days)
    const dates = parseDateRange(input.dates);
    if (dates) {
      const tripDuration = Math.ceil((new Date(dates.endDate).getTime() - new Date(dates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (tripDuration > 60) {
        console.log(`[Background] Trip ${tripId} rejected: ${tripDuration} days is too long`);
        const now = new Date().toISOString();
        await storage.updateTripFeasibility(tripId, "no", {
          schemaVersion: FEASIBILITY_SCHEMA_VERSION,
          overall: "no",
          score: 0,
          breakdown: {
            accessibility: { status: "impossible", reason: `${tripDuration}-day trip exceeds maximum supported duration of 60 days` },
            visa: { status: "ok", reason: "N/A - trip too long" },
            budget: { status: "ok", estimatedCost: 0, reason: "N/A - trip too long" },
            safety: { status: "safe", reason: "N/A - trip too long" }
          },
          summary: `A ${tripDuration}-day trip is too long for detailed planning. Please plan trips of 60 days or less, or break your journey into multiple shorter trips.`,
          generatedAt: now,
        });
        updateProgress(tripId, { step: -1, message: "Trip too long" }, `${tripDuration} days exceeds 60-day limit`);
        clearProgress(tripId);
        return;
      }
    }

    if (!openai) {
      console.log(`[Background] No AI provider, skipping analysis`);
      updateProgress(tripId, PROGRESS_STEPS.COMPLETE, "No AI configured");
      clearProgress(tripId);
      return;
    }

    const residenceCountry = input.residence || input.passport;
    const hasResidency = input.residence && input.residence !== input.passport;
    const originCity = input.origin || residenceCountry;
    const currency = input.currency || 'USD';
    const currencySymbol = CURRENCY_SYMBOLS[currency] || currency;

    // ============ FULLY DYNAMIC AI-DRIVEN FEASIBILITY ============
    // NO hardcoded lists - AI determines everything dynamically
    // AI will check: accessibility, visa, safety, budget feasibility

    // STEP 1: Smart feasibility check - AI determines if travel is even possible
    // This happens BEFORE any flight/hotel/activity searches
    const isCustomBudget = input.travelStyle === 'custom';
    const travelStyleLabel = input.travelStyle === 'budget' ? 'Budget' :
                             input.travelStyle === 'standard' ? 'Comfort' :
                             input.travelStyle === 'luxury' ? 'Luxury' : 'Custom';

    const budgetInfo = isCustomBudget
      ? `${currencySymbol}${input.budget} ${currency} budget`
      : `${travelStyleLabel} travel style (AI will calculate appropriate costs)`;

    const budgetInstruction = isCustomBudget
      ? `"budget":{"status":"ok|tight|impossible","estimatedCost":number,"reason":"brief in ${currency}"}`
      : `"budget":{"status":"ok","estimatedCost":0,"reason":"${travelStyleLabel} travel - costs calculated by AI"}`;

    // ============ RAG VISA LOOKUP ============
    // Fetch cited visa data from knowledge base BEFORE AI check
    let ragVisaFacts: VisaFacts | null = null;
    let ragVisaDetails: VisaDetails | null = null;

    // Extract country code from passport (e.g., "India" -> "IN")
    const passportCodeMap: Record<string, string> = {
      india: "IN", indian: "IN", us: "US", usa: "US", "united states": "US",
      uk: "GB", "united kingdom": "GB", australia: "AU", canada: "CA",
      germany: "DE", france: "FR", japan: "JP", china: "CN", singapore: "SG",
    };
    const destCodeMap: Record<string, string> = {
      thailand: "TH", japan: "JP", singapore: "SG", uae: "AE", dubai: "AE",
      indonesia: "ID", bali: "ID", maldives: "MV", "sri lanka": "LK",
      vietnam: "VN", malaysia: "MY", india: "IN", usa: "US", uk: "GB",
      france: "FR", germany: "DE", italy: "IT", spain: "ES", australia: "AU",
    };

    const passportCode = passportCodeMap[input.passport.toLowerCase()] || input.passport.toUpperCase().slice(0, 2);
    const destCode = destCodeMap[input.destination.toLowerCase().split(",")[0].trim()] ||
                     input.destination.toUpperCase().slice(0, 2);

    try {
      ragVisaFacts = await VisaService.getVisaFactsFromKnowledge(passportCode, destCode);
      if (ragVisaFacts) {
        ragVisaDetails = VisaService.convertVisaFactsToVisaDetails(ragVisaFacts);
        console.log(`[RAG] Using cited visa data for ${passportCode} → ${destCode}: ${ragVisaFacts.visaStatus}`);
      }
    } catch (ragError) {
      console.warn(`[RAG] Visa lookup failed, falling back to AI:`, ragError);
    }

    // Build evidence bundle for AI prompt (token-efficient, prevents hallucination)
    const visaEvidenceBundle = ragVisaFacts
      ? buildVisaEvidenceBundle({ visaFacts: ragVisaFacts })
      : null;

    const evidenceBundleText = visaEvidenceBundle
      ? `\n=== VISA EVIDENCE (use these facts, do not invent) ===\n${formatEvidenceBundleForPrompt(visaEvidenceBundle)}\n===`
      : '';

    const visaInstructionForAI = ragVisaFacts
      ? `"visa": {"status": "${ragVisaFacts.visaStatus === 'visa_free' ? 'ok' : 'issue'}", "reason": "Use summary from evidence bundle"}`
      : `"visa": {"status": "ok|issue", "reason": "brief visa info. CRITICAL: Use 'ok' ONLY if NO visa required. Use 'issue' if ANY visa/permit is needed"}`;

    const confidenceWarning = visaEvidenceBundle?.confidence === 'low'
      ? '\nIMPORTANT: Visa confidence is LOW. You MUST mention "verify with official sources" in summary.'
      : '';

    // Enhanced feasibility prompt that checks accessibility FIRST
    const feasibilityPrompt = `CRITICAL: First determine if this trip is even POSSIBLE. JSON only, no markdown.

Trip Request: ${originCity} → ${input.destination}
Passport: ${input.passport}. Residence: ${residenceCountry}${hasResidency ? " (PR)" : ""}.
Travel dates: ${input.dates}, ${input.groupSize} travelers, ${budgetInfo}.
${evidenceBundleText}${confidenceWarning}

STEP 1 - ACCESSIBILITY CHECK (most important):
- Is ${input.destination} a real, accessible tourist destination?
- Can regular tourists travel there? (Not war zones, closed countries, restricted areas, uninhabited regions)
- Are there commercial flights/transport available from ${originCity}?
- Examples of INACCESSIBLE destinations: Antarctica (requires expedition), North Korea (closed), war zones, uninhabited islands

STEP 2 - If accessible, check:
${ragVisaFacts ? '- Use VISA EVIDENCE above. Do not guess or invent visa facts.' : `- Visa requirements for ${input.passport} passport holders visiting ${input.destination}`}
- Safety conditions for tourists
${isCustomBudget ? '- Budget feasibility' : '- Skip budget analysis (travel style selected)'}

CRITICAL RULES:
- If destination is NOT accessible to regular tourists → overall: "no", score: 0-20
- If destination requires special permits/expeditions (like Antarctica) → overall: "no"
- If destination is a conflict zone → overall: "no"
- Only return "yes" or "warning" if regular commercial travel is possible
${visaEvidenceBundle?.confidence === 'low' ? '- If visa confidence is low, include "verify visa requirements" in summary' : ''}

Return JSON:
{
  "overall": "yes|no|warning",
  "score": 0-100,
  "breakdown": {
    "accessibility": {
      "status": "accessible|restricted|impossible",
      "reason": "Can tourists visit? Are there commercial transport options?"
    },
    ${visaInstructionForAI},
    ${budgetInstruction},
    "safety": {"status": "safe|caution|danger", "reason": "brief safety info"}
  },
  "summary": "1-2 sentences. If not accessible, explain WHY and suggest alternatives."
}`;

    // ============================================================================
    // PARALLEL SPECULATIVE EXECUTION - Start ALL tasks simultaneously
    // This dramatically improves response time by not waiting for feasibility
    // If trip is infeasible, we simply discard the other results
    // ============================================================================

    // If skipFeasibility is true (Stage 2), load existing report instead of running AI check
    let report!: FeasibilityReport; // Definite assignment - always assigned in both branches
    if (skipFeasibility) {
      console.log(`[Background] Skipping feasibility (Stage 2) - loading existing report...`);
      const existingTrip = await storage.getTrip(tripId);
      if (!existingTrip?.feasibilityReport) {
        console.error(`[Background] No existing feasibility report for trip ${tripId}`);
        return;
      }
      report = existingTrip.feasibilityReport as FeasibilityReport;
      console.log(`[Background] Using existing feasibility: ${report.overall} (score: ${report.score})`);
    }

    console.log(`[Background] Starting PARALLEL execution for faster results...`);
    if (!skipFeasibility) {
      updateProgress(tripId, PROGRESS_STEPS.FEASIBILITY, `Checking ${input.passport} passport requirements for ${input.destination}`);
    } else {
      updateProgress(tripId, PROGRESS_STEPS.FLIGHTS, `Planning your ${input.destination} adventure...`);
    }

    // Pre-calculate dates and trip parameters BEFORE parallel execution
    // (dates already parsed above for duration validation)
    const numDays = dates ? Math.ceil((new Date(dates.endDate).getTime() - new Date(dates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 7;
    const numNights = Math.max(numDays - 1, 1);
    const departureDate = dates?.startDate || new Date().toISOString().split('T')[0];
    const returnDate = dates?.endDate || new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const datesInPast = dates ? new Date(dates.startDate) < new Date() : false;

    // Determine budget tier EARLY for parallel tasks
    const budgetTier = input.travelStyle === 'luxury' ? 'luxury' :
                       input.travelStyle === 'standard' ? 'standard' : 'budget';

    // SPECULATIVE: Start transport recommendation early (lightweight, fast)
    const transportRecPromise = TransportService.getSmartTransportRecommendations(
      originCity || 'Unknown',
      input.destination,
      input.budget,
      currency,
      input.groupSize,
      budgetTier
    );

    // Conditionally run feasibility check or use existing report
    let transportRec: Awaited<ReturnType<typeof TransportService.getSmartTransportRecommendations>>;

    if (!skipFeasibility) {
      // Start feasibility check (will complete first, ~2-3 seconds)
      const feasibilityPromise = (async () => {
        const feasibilityResponse = await openai.chat.completions.create({
          model: aiModel,
          messages: [
            { role: "system", content: "Travel analyst. Concise JSON responses only." },
            { role: "user", content: feasibilityPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 350,
        });

        return safeJsonParse(feasibilityResponse.choices[0].message.content || "{}", {
          overall: "warning",
          score: 50,
          breakdown: {
            accessibility: { status: "accessible", reason: "Accessibility check pending" },
            visa: { status: "issue", reason: "Unable to analyze visa requirements" },
            budget: { status: "ok", estimatedCost: 0, reason: "Budget analysis pending" },
            safety: { status: "safe", reason: "Safety analysis pending" }
          },
          summary: "Analysis incomplete - please refresh"
        }) as FeasibilityReport;
      })();

      // Wait for feasibility + transport recommendation (both are fast ~2-5 seconds)
      const [feasibilityResult, transportResult] = await Promise.all([feasibilityPromise, transportRecPromise]);
      report = feasibilityResult;
      transportRec = transportResult;

      // Add schema metadata
      const now = new Date();
      report.schemaVersion = FEASIBILITY_SCHEMA_VERSION;
      report.generatedAt = now.toISOString();
      report.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Attach RAG visa details with citations if available
      if (ragVisaDetails) {
        report.visaDetails = ragVisaDetails;
        console.log(`[RAG] Attached visa details to report: ${ragVisaDetails.type} (${ragVisaDetails.confidenceLevel} confidence, ${ragVisaDetails.sources?.length || 0} citations)`);
      }

      // ============ CONFIDENCE-BASED SCORE ADJUSTMENT ============
      // Same rules as Stage 1 flow
      const confidence = report.visaDetails?.confidenceLevel || 'low';
      const originalScore = report.score;

      if (confidence === 'medium') {
        report.score = Math.round(report.score * 0.9);
        if (report.breakdown?.visa) {
          report.breakdown.visa.reason = `${report.breakdown.visa.reason} (limited sources - verify before booking)`;
        }
      } else if (confidence === 'low') {
        report.score = Math.min(Math.round(report.score * 0.75), 70);
        if (report.overall === 'yes' && report.score < 70) {
          report.overall = 'warning';
        }
        report.summary = `${report.summary} Verify visa requirements with official sources.`;
        if (report.breakdown?.visa) {
          report.breakdown.visa.status = 'issue';
          report.breakdown.visa.reason = `${report.breakdown.visa.reason} (UNVERIFIED - requires confirmation)`;
        }
        if (report.visaDetails && (!report.visaDetails.sources || report.visaDetails.sources.length === 0)) {
          report.visaDetails.type = 'requires_verification';
        }
      }

      if (originalScore !== report.score) {
        console.log(`[Background] Score adjusted: ${originalScore} → ${report.score} (confidence: ${confidence})`);
      }

      await storage.updateTripFeasibility(tripId, report.overall, report);
      console.log(`[Background] Feasibility: ${report.overall} (score: ${report.score})${ragVisaDetails ? ' [RAG visa]' : ''} in ${Date.now() - startTime}ms`);
    } else {
      // Stage 2: Just wait for transport recommendation
      transportRec = await transportRecPromise;
    }

    // ============ SMART EARLY EXIT FOR INFEASIBLE TRIPS ============
    if (report.overall === "no") {
      console.log(`[Background] Trip NOT FEASIBLE: ${report.summary}`);
      updateProgress(tripId, PROGRESS_STEPS.COMPLETE, "Trip not feasible - see details");
      clearProgress(tripId);
      console.log(`[Background] Trip ${tripId} completed (infeasible) in ${Date.now() - startTime}ms`);
      return;
    }

    // STEP 2: Trip is feasible - continue with parallel itinerary/transport/hotel generation
    if (report.overall === "yes" || report.overall === "warning") {
      // Variables already calculated above: dates, numDays, numNights, departureDate, returnDate, datesInPast, budgetTier, transportRec

      if (datesInPast) {
        console.log(`[Background] Trip dates are in the past (${departureDate}), using estimates only`);
      }

      // Check cache first for itinerary
      const cachedItinerary = getCachedItinerary(input.destination, departureDate, numDays);

      // Log transport info (already fetched in parallel above)
      const userTravelStyle = input.travelStyle as 'budget' | 'standard' | 'luxury' | null;
      console.log(`[Background] Transport: ${transportRec.primaryMode} (${transportRec.distanceCategory}, ${transportRec.isDomestic ? 'domestic' : 'international'}), Budget tier: ${budgetTier}${userTravelStyle ? ' (user selected)' : ' (auto-detected)'}`);

      // Continue with parallel itinerary/flights/hotels processing
      console.log(`[Background] Starting parallel itinerary + API processing...`);

      // Update progress - show transport options based on travel style
      const isCustomBudget = input.travelStyle === 'custom';
      const routeText = `${input.origin || 'Origin'} → ${input.destination}`;

      let progressDetail: string;
      if (isCustomBudget) {
        // Custom budget - show the actual budget and optimized options
        const budgetDisplay = `${currencySymbol}${input.budget.toLocaleString()}`;
        progressDetail = `Within ${budgetDisplay}: Finding best options • ${routeText}`;
      } else {
        // Travel style selected - show style-specific options
        const travelStyleText = budgetTier === 'budget' ? 'Budget-friendly' :
                                budgetTier === 'luxury' ? 'Premium' : 'Best value';
        const transportOptions = budgetTier === 'budget' ? 'Buses, trains & budget flights' :
                                 budgetTier === 'luxury' ? 'Flights & private transfers' :
                                 'Flights, trains & buses';
        progressDetail = `${travelStyleText}: ${transportOptions} • ${routeText}`;
      }
      updateProgress(tripId, PROGRESS_STEPS.FLIGHTS, progressDetail);

      // ============================================================================
      // PROGRESSIVE LOADING - Each task saves partial results as it completes
      // This allows the UI to show data incrementally instead of waiting for everything
      // ============================================================================

      // Track completion for progressive updates
      let itineraryComplete = false;
      let flightsComplete = false;
      let hotelsComplete = false;

      // Wrapper to track and log completion
      const trackProgress = (taskName: string) => {
        if (taskName === 'itinerary') itineraryComplete = true;
        if (taskName === 'flights') flightsComplete = true;
        if (taskName === 'hotels') hotelsComplete = true;

        const completed = [itineraryComplete, flightsComplete, hotelsComplete].filter(Boolean).length;
        console.log(`[Progressive] ${taskName} complete (${completed}/3 tasks done)`);

        // Update progress based on what's done
        if (itineraryComplete && !flightsComplete && !hotelsComplete) {
          updateProgress(tripId, PROGRESS_STEPS.HOTELS, "Itinerary ready! Fetching prices...");
        } else if (completed === 2) {
          updateProgress(tripId, PROGRESS_STEPS.ITINERARY, "Almost done! Finalizing details...");
        }
      };

      const [itineraryResult, flightResult, hotelResult] = await Promise.all([
        // AI Itinerary generation (or use cache) - wrapped with progress tracking
        (async () => {
          // Use cache if available
          if (cachedItinerary) {
            trackProgress('itinerary');
            return cachedItinerary;
          }

          // Generate with AI - scale tokens based on trip length
          console.log(`[Cache] MISS for ${input.destination}, generating ${numDays} days with AI...`);

          // Get local transport info for the prompt
          const localTransport = transportRec.intraCityTransport.options.slice(0, 3).join(', ');

          // Determine arrival mode text
          const arrivalMode = transportRec.primaryMode === 'flight' ? 'airport' :
                             transportRec.primaryMode === 'train' ? 'railway station' :
                             transportRec.primaryMode === 'bus' ? 'bus station' : 'station';
          const arrivalTransport = transportRec.primaryMode === 'flight' ? 'flight' :
                                   transportRec.primaryMode === 'train' ? 'train' : 'bus/car';

          // Dynamic travel style guidance - AI will determine costs based on destination
          const travelStyleGuideMap: Record<string, string> = {
            budget: `BUDGET TRAVEL: Choose the CHEAPEST options available in ${input.destination}.
- Meals: Street food, local eateries, food stalls, markets (typical local budget meal price)
- Activities: FREE attractions (parks, temples, beaches, markets, walking tours, public spaces)
- Transport: Public buses, metro, shared auto/rickshaw, walking
- Focus on authentic local experiences that cost little or nothing`,
            standard: `STANDARD/COMFORT TRAVEL: Mid-range options in ${input.destination}.
- Meals: Local restaurants, cafes, mid-range dining
- Activities: Mix of free and paid attractions, popular tourist sites
- Transport: Taxi/Uber for convenience, some public transport
- Balance of comfort and value`,
            luxury: `LUXURY TRAVEL: Premium experiences in ${input.destination}.
- Meals: Fine dining, upscale restaurants, hotel restaurants
- Activities: Private tours, exclusive experiences, VIP access, spa/wellness
- Transport: Private car, premium taxi services
- Focus on comfort and exclusive experiences`
          };
          const travelStyleGuide = travelStyleGuideMap[budgetTier] || travelStyleGuideMap.standard;

          // Add budget constraint for custom budgets
          // Use fallback rates for prompt (actual conversion happens later with live rates)
          const fallbackRate = FALLBACK_RATES[currency] || 1;
          const budgetInUSD = Math.round(input.budget / fallbackRate);
          const isCustomBudget = input.travelStyle === 'custom';
          const budgetConstraint = isCustomBudget
            ? `\nUSER'S EXACT BUDGET: ~$${budgetInUSD} USD total for ${input.groupSize} traveler(s), ${numDays} days.
This includes ALL costs: activities, food, and local transport (accommodation & intercity travel handled separately).
If budget is tight, prioritize: FREE activities, cheap street food, walking/public transport.
Target daily expenses: ~$${Math.round(budgetInUSD * 0.3 / numDays)} USD/day for activities+food+local transport.`
            : '';

          // For longer trips (8+ days), add extra diversity guidance
          const longTripGuidance = numDays >= 8 ? `
LONG TRIP GUIDANCE (${numDays} days):
- Explore DIFFERENT neighborhoods/districts each day
- Include day trips to nearby towns/attractions (within 1-3 hours)
- Mix of: historical sites, nature spots, local markets, cultural experiences, leisure time
- Consider: cooking classes, local workshops, cycling tours, river/boat trips
- Allow 1-2 "relaxed" days with fewer activities for rest` : '';

          const itineraryPrompt = `Create a realistic ${numDays}-day ${input.destination} travel itinerary for ${input.groupSize} traveler(s).

TRAVEL STYLE: ${budgetTier.toUpperCase()}
${travelStyleGuide}${budgetConstraint}

OUTPUT FORMAT (JSON):
{"days":[{
  "day":1,
  "date":"${departureDate}",
  "title":"Unique Thematic Title",
  "activities":[{"time":"09:00","description":"Specific place name","type":"activity","location":"Place name","coordinates":{"lat":0.0,"lng":0.0},"estimatedCost":15,"transportMode":"walk|metro|taxi"}],
  "localFood":[{"meal":"breakfast|lunch|dinner","name":"Restaurant Name","cuisine":"Cuisine type","priceRange":"$|$$|$$$","estimatedCost":12,"note":"Why visit"}]
}]}

CRITICAL RULES - VARIETY & NO REPETITION:
- NEVER repeat the same attraction/location across different days
- NEVER cycle through the same 3-4 places repeatedly
- Each day must visit UNIQUE locations not seen on other days
- For ${numDays} days, you need at least ${Math.min(numDays * 3, 50)} DIFFERENT unique places
${longTripGuidance}

DAY TITLE RULES (MANDATORY):
- Each title MUST be creative and thematic: "Imperial Grandeur & Coffee Culture", "Danube Dreams", "Art Nouveau Discovery"
- FORBIDDEN: "Day 2 in Vienna", "Exploring Vienna", "Vienna Day 3", or any generic title
- Titles should hint at what makes that day special

ACTIVITY RULES - BE REALISTIC & PRACTICAL:
- Activities are ONLY sightseeing, attractions, experiences - NO meals
- Type must be "activity" or "transport" - NEVER "meal"

PRACTICAL PACING (CRITICAL - DON'T OVERWHELM TRAVELERS):
- Full day: MAX 3-4 quality activities (not 6-8 rushed ones)
- Half day (arrival/departure): MAX 1-2 activities
- Day 1: Arrive around 14:00, check-in, then 1-2 LIGHT nearby activities only
- Last day: 1 quick morning activity near hotel, checkout by 11:00, departure
- Allow 1.5-2 hours per major attraction (museums, palaces)
- Allow 30-60 mins for smaller attractions (viewpoints, temples)
- Include realistic TIME GAPS for travel between locations

GEOGRAPHIC CLUSTERING (DON'T ZIGZAG):
- Group nearby attractions on the same day
- Morning: One area of the city
- Afternoon: Adjacent or same area
- Don't send travelers across the city multiple times per day

LOCAL FOOD RULES:
- Each day needs 2-3 food recommendations in localFood array
- MUST be SPECIFIC real restaurants/cafes in ${input.destination}
- Include local specialties, hidden gems, not just tourist spots
- priceRange: $ = budget, $$ = mid-range, $$$ = upscale
- note: Brief reason to visit (famous for X, best Y, local favorite)

REQUIREMENTS:
1. ACTIVITY NAMES: Real specific place names - NOT "Visit museum" but "Kunsthistorisches Museum"
2. estimatedCost (MANDATORY - NEVER leave as 0 or omit!):
   EVERY activity MUST have a realistic USD cost. Research actual 2024 prices!
   - FREE attractions (public parks, free churches, viewpoints): 0
   - Budget attractions (local temples, small museums): 2-8
   - Standard attractions (major museums, tours): 10-25
   - Premium attractions (shows, exclusive tours): 25-60
   - Transport activities (taxi/auto transfer): 5-15
   - Meals: 5-15 for budget, 15-30 for mid-range, 30-80 for luxury
   EXAMPLE COSTS for Rome: Colosseum €18 (~$20), Vatican €20 (~$22), Borghese €15 (~$17)
   DO NOT return estimatedCost: 0 for paid attractions! Only FREE public spaces should be 0.
3. coordinates: Real GPS coordinates for ${input.destination} locations
4. transportMode: How to reach (${localTransport}, walk, taxi)
5. descriptions: Concise 2-5 words
6. ${numDays > 7 ? 'Include day trips to nearby towns/attractions' : ''}

LOCAL FOOD estimatedCost (MANDATORY):
Each food item MUST have an estimatedCost in USD based on priceRange:
- $ (budget): 5-12 USD per person
- $$ (mid-range): 15-30 USD per person
- $$$ (upscale): 35-80 USD per person
NEVER leave estimatedCost as 0 for food!

IMPORTANT: Research REAL restaurants and local food spots in ${input.destination}. Generic "Local Restaurant" is NOT acceptable.`;

          // Scale tokens: ~350 tokens per day (increased for localFood array), minimum 4000, maximum 12000
          const maxTokens = Math.max(4000, Math.min(12000, numDays * 350));

          const systemPrompt = `You are a travel planning expert specializing in creating REALISTIC, PRACTICAL itineraries.

CRITICAL - YOUR EXPERTISE:
- Deep knowledge of local attractions, hidden gems, and authentic experiences
- Understand REALISTIC travel times and pacing for real travelers
- Know opening hours, best times to visit, and practical logistics
- Create itineraries that are ACHIEVABLE, not exhausting tourist marathons

PRACTICAL REALISM (MOST IMPORTANT):
- Travelers need REST - don't pack every hour with activities
- Consider TRAVEL TIME between locations (30 mins - 1 hour in most cities)
- Major attractions take 1.5-2 hours to properly enjoy
- First day: Travelers are tired from journey - keep it light
- Last day: Need time for checkout, packing, getting to station/airport
- A relaxed 3-activity day > a rushed 6-activity day

VARIETY REQUIREMENTS:
- NEVER repeat attractions - each place appears ONLY ONCE
- For long trips (7+ days): include day trips, different neighborhoods, varied experiences
- Each day should have a unique character and theme

DAY TITLES:
- Be creative and evocative: "Habsburg Splendor", "Bohemian Rhapsody", "Markets & Modernism"
- NEVER generic: "Day 2", "Exploring City", "City Tour"

ACTIVITIES vs FOOD:
- "activities" array: sightseeing, attractions, experiences, hotel check-in/out
  - Use type: "activity" for sightseeing/attractions
  - Use type: "transport" for airport arrivals/departures, transfers
  - Use type: "lodging" for hotel check-in (Day 1) and check-out (last day)
- "localFood" array: Specific restaurant/cafe recommendations for each day
- NEVER put meals in activities array

IMPORTANT: Include at least 1 "lodging" type activity:
- Day 1: Hotel check-in (type: "lodging")
- Last day: Hotel check-out (type: "lodging")

FOOD RECOMMENDATIONS:
- Name REAL, specific restaurants/cafes that locals love
- Include cuisine type, price range, and why it's special
- Mix: iconic spots + hidden gems + local favorites

Output compact JSON only, no markdown.`;

          // Compact Text Format Parser - converts pipe-delimited text to JSON (saves 60-70% tokens)
          // Format: D|day|date|title (day line) and A|time|name|desc|type|cost|duration|location|lat|lng (activity line)
          const parseCompactFormat = (text: string, startDate: string): any => {
            const lines = text.trim().split('\n').filter(line => line.trim());
            const days: any[] = [];
            let currentDay: any = null;

            for (const line of lines) {
              const parts = line.split('|').map(p => p.trim());

              if (parts[0] === 'D' && parts.length >= 4) {
                // Day line: D|day_num|date|title
                if (currentDay) days.push(currentDay);
                const dayNum = parseInt(parts[1]) || days.length + 1;
                const dayDate = new Date(startDate);
                dayDate.setDate(dayDate.getDate() + dayNum - 1);

                currentDay = {
                  day: dayNum,
                  date: parts[2] || dayDate.toISOString().split('T')[0],
                  title: parts[3] || `Day ${dayNum}`,
                  activities: []
                };
              } else if (parts[0] === 'A' && parts.length >= 8 && currentDay) {
                // Activity line: A|time|name|desc|type|cost|duration|location|lat|lng
                currentDay.activities.push({
                  time: parts[1] || '09:00',
                  name: parts[2] || 'Activity',
                  description: parts[3] || parts[2] || 'Activity',
                  type: parts[4] || 'activity',
                  estimatedCost: parseFloat(parts[5]) || 20,
                  duration: parts[6] || '2 hours',
                  location: parts[7] || parts[2],
                  coordinates: {
                    lat: parseFloat(parts[8]) || 0,
                    lng: parseFloat(parts[9]) || 0
                  }
                });
              }
            }

            if (currentDay) days.push(currentDay);
            return { days };
          };

          // Detect if response is compact format or JSON
          const parseItineraryResponse = (text: string, startDate: string): any => {
            const trimmed = text.trim();

            // Check if it starts with D| (compact format)
            if (trimmed.startsWith('D|') || trimmed.match(/^D\|\d/)) {
              console.log(`[Format] Detected COMPACT format (${trimmed.length} chars)`);
              const result = parseCompactFormat(trimmed, startDate);
              console.log(`[Format] Parsed ${result.days?.length || 0} days from compact format`);
              return result;
            }

            // Otherwise try JSON
            console.log(`[Format] Detected JSON format (${trimmed.length} chars)`);
            return safeJsonParse(trimmed, { days: [] });
          };

          // Helper function to generate itinerary with optional avoidance list
          const generateItinerary = async (avoidLocations: string[] = [], useCompactFormat: boolean = false): Promise<{ result: any; rawResponse: string }> => {
            const avoidanceClause = avoidLocations.length > 0
              ? `\n\nCRITICAL - DO NOT USE THESE LOCATIONS (already visited): ${avoidLocations.join(', ')}\nYou MUST find DIFFERENT attractions, neighborhoods, day trips, and hidden gems.`
              : '';

            // Compact format prompt - 60-70% fewer tokens than JSON
            // Token comparison: JSON ~100 tokens/activity vs Compact ~30 tokens/activity
            const compactPrompt = `Create ${numDays}-day itinerary for ${input.destination}. Start date: ${departureDate}.

USE THIS COMPACT FORMAT (pipe-delimited, one line per item):
D|day_num|date|title
A|time|name|description|type|cost|duration|location|lat|lng

Types: activity, meal, transport, lodging
Example:
D|1|2026-02-20|Arrival Day
A|14:00|Airport Arrival|Land and transfer to hotel|transport|30|1h|Airport|26.85|80.95
A|15:00|Hotel Check-in|Check into accommodation|lodging|0|30min|Hotel Name|26.84|80.92
A|19:00|Welcome Dinner|Local cuisine|meal|25|2h|Restaurant Name|26.84|80.91
D|2|2026-02-21|Exploration
A|09:00|Temple Visit|Historic temple tour|activity|15|2h|Temple Name|26.86|80.93

Include 3-4 activities per day. Use REAL coordinates for ${input.destination}.
Style: ${input.travelStyle || 'standard'}. Currency: ${currency}.
Return ONLY the compact format, no JSON, no markdown.`;

            const finalPrompt = useCompactFormat
              ? compactPrompt
              : itineraryPrompt + avoidanceClause;

            const response = await openai!.chat.completions.create({
              model: aiModel,
              messages: [
                { role: "system", content: useCompactFormat ? "You are a travel planner. Return compact pipe-delimited format only, no JSON." : systemPrompt },
                { role: "user", content: finalPrompt }
              ],
              // Only use json_object for JSON format, not for compact
              ...(useCompactFormat ? {} : { response_format: { type: "json_object" as const } }),
              temperature: useCompactFormat ? 0.3 : (avoidLocations.length > 0 ? 0.7 : 0.4),
              max_tokens: useCompactFormat ? Math.min(maxTokens, 4000) : maxTokens, // Compact needs fewer tokens
            });

            const rawContent = response.choices[0].message.content || "";
            const tokenUsage = response.usage;

            if (tokenUsage) {
              console.log(`[Tokens] ${useCompactFormat ? 'COMPACT' : 'JSON'} format - Input: ${tokenUsage.prompt_tokens}, Output: ${tokenUsage.completion_tokens}, Total: ${tokenUsage.total_tokens}`);
            }

            return {
              result: parseItineraryResponse(rawContent, departureDate),
              rawResponse: rawContent
            };
          };

          // Agentic AI fallback - uses AI to generate a basic itinerary when main request fails
          const generateAgenticFallback = async (): Promise<any> => {
            console.log(`[Agentic Fallback] Generating AI-powered fallback itinerary for ${input.destination}`);

            try {
              // Ask AI for key attractions first
              const attractionsResponse = await openai!.chat.completions.create({
                model: aiModel,
                messages: [
                  { role: "system", content: "You are a travel expert. Return valid JSON only." },
                  { role: "user", content: `List the top 10 must-visit attractions in ${input.destination} with their GPS coordinates.
Return JSON: {"attractions": [{"name": "Place name", "lat": 0.0, "lng": 0.0, "type": "museum/temple/park/market/landmark", "typicalCost": 20}]}` }
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
                max_tokens: 2000,
              });

              const attractionsData = safeJsonParse(attractionsResponse.choices[0].message.content || "{}", { attractions: [] });
              const attractions = attractionsData.attractions || [];

              console.log(`[Agentic Fallback] AI found ${attractions.length} attractions for ${input.destination}`);

              if (attractions.length === 0) {
                return { days: [] };
              }

              // Build itinerary from attractions
              const startDate = new Date(departureDate);
              const days = [];

              for (let i = 0; i < numDays; i++) {
                const date = new Date(startDate);
                date.setDate(startDate.getDate() + i);
                const isFirstDay = i === 0;
                const isLastDay = i === numDays - 1;

                // Distribute attractions across days
                const dayAttractions = attractions.slice(
                  Math.floor(i * attractions.length / numDays),
                  Math.floor((i + 1) * attractions.length / numDays)
                );

                const activities = [];
                const times = ['09:00', '11:00', '14:00', '16:00'];

                dayAttractions.forEach((attr: any, idx: number) => {
                  if (idx < 4) {
                    activities.push({
                      time: times[idx],
                      name: attr.name,
                      description: `Visit ${attr.name}`,
                      type: attr.type || 'activity',
                      estimatedCost: attr.typicalCost || 20,
                      duration: '2 hours',
                      location: attr.name,
                      coordinates: { lat: attr.lat, lng: attr.lng }
                    });
                  }
                });

                // Add hotel check-in on first day
                if (isFirstDay) {
                  activities.push({
                    time: '15:00',
                    name: 'Hotel Check-in',
                    description: 'Check into accommodation',
                    type: 'lodging',
                    estimatedCost: 0,
                    duration: '30 min',
                    location: 'Hotel',
                    coordinates: dayAttractions[0] ? { lat: dayAttractions[0].lat, lng: dayAttractions[0].lng } : { lat: 0, lng: 0 }
                  });
                }

                // Add hotel check-out on last day
                if (isLastDay) {
                  activities.push({
                    time: '10:00',
                    name: 'Hotel Check-out',
                    description: 'Check out and prepare for departure',
                    type: 'lodging',
                    estimatedCost: 0,
                    duration: '30 min',
                    location: 'Hotel',
                    coordinates: dayAttractions[0] ? { lat: dayAttractions[0].lat, lng: dayAttractions[0].lng } : { lat: 0, lng: 0 }
                  });
                }

                // Add at least one meal
                if (activities.length > 0) {
                  activities.push({
                    time: '12:30',
                    name: 'Local lunch',
                    description: `Enjoy local cuisine in ${input.destination}`,
                    type: 'meal',
                    estimatedCost: 15,
                    duration: '1 hour',
                    location: `Restaurant near ${dayAttractions[0]?.name || input.destination}`,
                    coordinates: dayAttractions[0] ? { lat: dayAttractions[0].lat, lng: dayAttractions[0].lng } : { lat: 0, lng: 0 }
                  });
                }

                // Sort by time
                activities.sort((a, b) => a.time.localeCompare(b.time));

                days.push({
                  day: i + 1,
                  date: date.toISOString().split('T')[0],
                  title: isFirstDay ? 'Arrival & Exploration' : isLastDay ? 'Final Day & Departure' : `Day ${i + 1}: ${dayAttractions[0]?.name || input.destination}`,
                  activities
                });
              }

              console.log(`[Agentic Fallback] Successfully generated ${days.length}-day itinerary with ${days.reduce((sum, d) => sum + d.activities.length, 0)} activities`);
              return { days };

            } catch (error) {
              console.error(`[Agentic Fallback] Error:`, error);
              return { days: [] };
            }
          };

          // ============================================================================
          // CHUNKED PARALLEL GENERATION - For long trips (8+ days)
          // Instead of one 12000-token call taking 60+ seconds,
          // we make 3-4 parallel calls of ~2000 tokens each, taking ~15-20 seconds total
          // ============================================================================
          const generateChunkedItinerary = async (): Promise<any> => {
            const CHUNK_SIZE = 4; // Days per batch
            const numChunks = Math.ceil(numDays / CHUNK_SIZE);

            console.log(`[Chunked] Generating ${numDays} days in ${numChunks} parallel batches of ${CHUNK_SIZE} days`);
            updateProgress(tripId, { step: 4, message: "Creating itinerary" }, `Generating ${numChunks} sections in parallel...`);

            // Create chunk promises
            const chunkPromises = Array.from({ length: numChunks }, async (_, chunkIndex) => {
              const startDay = chunkIndex * CHUNK_SIZE + 1;
              const endDay = Math.min((chunkIndex + 1) * CHUNK_SIZE, numDays);
              const chunkDays = endDay - startDay + 1;

              // Calculate date for this chunk
              const chunkStartDate = new Date(departureDate);
              chunkStartDate.setDate(chunkStartDate.getDate() + startDay - 1);
              const chunkDateStr = chunkStartDate.toISOString().split('T')[0];

              // Determine what phase this chunk is in
              const isFirstChunk = chunkIndex === 0;
              const isLastChunk = chunkIndex === numChunks - 1;
              const phaseNote = isFirstChunk
                ? "Day 1 is ARRIVAL: travelers arrive around 14:00, hotel check-in, 1-2 light activities only."
                : isLastChunk
                  ? `Day ${endDay} is DEPARTURE: morning checkout by 11:00, 1 quick activity, then head to airport/station.`
                  : `These are MID-TRIP days: full exploration, 3-4 activities per day.`;

              const chunkPrompt = `Generate days ${startDay}-${endDay} of a ${numDays}-day ${input.destination} itinerary.

CRITICAL CONTEXT:
- Total trip: ${numDays} days (${departureDate} to ${returnDate})
- This chunk: Days ${startDay}-${endDay} (${chunkDays} days starting ${chunkDateStr})
- ${phaseNote}
- Travel style: ${budgetTier.toUpperCase()}
- Local transport: ${localTransport}

OUTPUT FORMAT (JSON):
{"days":[{
  "day":${startDay},
  "date":"${chunkDateStr}",
  "title":"Creative Thematic Title",
  "activities":[{"time":"09:00","description":"Specific place","type":"activity","location":"Place name","coordinates":{"lat":0.0,"lng":0.0},"estimatedCost":15,"transportMode":"walk"}],
  "localFood":[{"meal":"lunch","name":"Restaurant","cuisine":"Local","priceRange":"$$","estimatedCost":20,"note":"Why visit"}]
}]}

RULES:
- ${chunkDays} days total (${startDay} to ${endDay})
- 3-4 activities per day (less for arrival/departure)
- Real GPS coordinates for ${input.destination}
- Real restaurant names
- Creative day titles (NOT "Day X")
- Costs in USD

${budgetTier === 'budget' ? 'Focus on FREE attractions, street food, public transport.' : budgetTier === 'luxury' ? 'Focus on premium experiences, fine dining, private transport.' : 'Balance of quality attractions and good value.'}`;

              const chunkStart = Date.now();

              try {
                // More generous token limit to avoid truncation
                // Each day needs ~600 tokens for complete JSON with activities + localFood
                const chunkMaxTokens = Math.max(2500, chunkDays * 600);

                const response = await openai!.chat.completions.create({
                  model: aiModel,
                  messages: [
                    { role: "system", content: "You are a travel planner. Return valid JSON only. Be concise but complete." },
                    { role: "user", content: chunkPrompt }
                  ],
                  response_format: { type: "json_object" },
                  temperature: 0.4,
                  max_tokens: chunkMaxTokens,
                });

                const chunkMs = Date.now() - chunkStart;
                console.log(`[Chunked] Batch ${chunkIndex + 1}/${numChunks} (days ${startDay}-${endDay}) completed in ${chunkMs}ms`);

                const content = response.choices[0].message.content || "{}";
                return safeJsonParse(content, { days: [] });
              } catch (error) {
                console.error(`[Chunked] Batch ${chunkIndex + 1} failed:`, error);
                return { days: [] };
              }
            });

            // Run ALL chunks in parallel
            const startParallel = Date.now();
            const chunkResults = await Promise.all(chunkPromises);
            const parallelMs = Date.now() - startParallel;

            // Merge all days
            const allDays: any[] = [];
            for (const chunk of chunkResults) {
              if (chunk.days?.length > 0) {
                allDays.push(...chunk.days);
              }
            }

            // Sort by day number to ensure order
            allDays.sort((a, b) => a.day - b.day);

            console.log(`[Chunked] All ${numChunks} batches completed in ${parallelMs}ms (${allDays.length} days total)`);

            return { days: allDays };
          };

          // Decide generation strategy based on trip length
          const USE_CHUNKED_THRESHOLD = 8; // Use chunked for trips 8+ days
          let result: any;
          let rawResponse = "";

          if (numDays >= USE_CHUNKED_THRESHOLD) {
            // FAST PATH: Chunked parallel generation for long trips
            console.log(`[Itinerary] Using CHUNKED parallel generation for ${numDays}-day trip`);
            result = await generateChunkedItinerary();

            // Fallback to single-call if chunked failed
            if (!result.days || result.days.length < numDays * 0.5) {
              console.log(`[Itinerary] Chunked generation incomplete (${result.days?.length || 0}/${numDays} days), falling back to single call`);
              const fallback = await generateItinerary();
              result = fallback.result;
              rawResponse = fallback.rawResponse;
            }
          } else {
            // STANDARD PATH: Single call for short trips (faster for <8 days)
            console.log(`[Itinerary] Using SINGLE call for ${numDays}-day trip`);
            const singleResult = await generateItinerary();
            result = singleResult.result;
            rawResponse = singleResult.rawResponse;
          }

          // Check if first attempt succeeded (for both chunked and single)
          if (!result.days || result.days.length === 0) {
            console.log(`[Itinerary] Attempt 1 FAILED - Empty days array`);
            console.log(`[Itinerary] Raw response length: ${rawResponse.length} chars`);
            console.log(`[Itinerary] Raw response preview: ${rawResponse.substring(0, 500)}...`);
            console.log(`[Itinerary] Raw response end: ...${rawResponse.substring(Math.max(0, rawResponse.length - 200))}`);

            // Attempt 2: COMPACT FORMAT (60-70% fewer tokens, faster response)
            console.log(`[Itinerary] Attempt 2: COMPACT format for ${input.destination} (token-efficient)`);
            const retry1 = await generateItinerary([], true); // true = use compact format
            result = retry1.result;

            if (!result.days || result.days.length === 0) {
              console.log(`[Itinerary] Attempt 2 FAILED - Compact format empty`);
              console.log(`[Itinerary] Compact response: ${retry1.rawResponse.substring(0, 400)}...`);

              // Attempt 3: Agentic AI fallback (asks for attractions, then builds itinerary)
              console.log(`[Itinerary] Attempt 3: Agentic AI fallback`);
              result = await generateAgenticFallback();

              if (result.days?.length > 0) {
                console.log(`[Itinerary] Agentic fallback SUCCESS - ${result.days.length} days generated`);
              } else {
                console.log(`[Itinerary] All AI attempts failed - will use coordinate-based placeholder`);
              }
            } else {
              console.log(`[Itinerary] Attempt 2 SUCCESS - ${result.days.length} days from COMPACT format`);
            }
          } else {
            console.log(`[Itinerary] Attempt 1 SUCCESS - ${result.days.length} days generated`);
          }

          // Validate variety for trips longer than 5 days (only if we have days)
          if (result.days?.length > 5) {
            const varietyCheck = analyzeItineraryVariety(result);
            console.log(`[Variety Check] ${input.destination}: ${varietyCheck.uniqueLocations} unique locations, ${(varietyCheck.duplicateRate * 100).toFixed(0)}% duplicates`);

            if (!varietyCheck.isValid) {
              console.log(`[Variety Check] FAILED - Regenerating with avoidance list...`);
              console.log(`[Variety Check] Repeated locations: ${varietyCheck.repeatedLocations.join(', ')}`);

              // Generate avoidance list from first attempt
              const avoidList = generateAvoidanceList(result);

              // Retry with explicit avoidance instructions
              const retryResult = await generateItinerary(avoidList);
              result = retryResult.result;

              // Check again
              const retryCheck = analyzeItineraryVariety(result);
              console.log(`[Variety Check] Retry result: ${retryCheck.uniqueLocations} unique locations, ${(retryCheck.duplicateRate * 100).toFixed(0)}% duplicates`);

              if (!retryCheck.isValid) {
                console.log(`[Variety Check] Still not ideal, but proceeding with best effort`);
              }
            }
          }

          // Cache the result for future use
          if (result.days?.length >= 5) {
            cacheItinerary(input.destination, result);
          }

          trackProgress('itinerary');
          return result;
        })(),

        // Transport pricing - use traveler counts
        // SKIP flight API for domestic short/medium routes (use pre-calculated train/bus prices)
        // Adults: full price, Children (2-11): 75% price, Infants (0-2): 10% price (lap infant)
        (async (): Promise<FlightResult> => {
          const adults = input.adults || input.groupSize || 1;
          const children = input.children || 0;
          const infants = input.infants || 0;

          // Helper to create estimate result
          const createEstimate = (basePrice: number, mode: string = 'Multiple Airlines', duration: string = 'Varies'): FlightResult => {
            const childPrice = Math.round(basePrice * 0.75);
            const infantPrice = Math.round(basePrice * 0.10);
            const totalPrice = (adults * basePrice) + (children * childPrice) + (infants * infantPrice);
            return {
              price: totalPrice,
              pricePerPerson: basePrice,
              airline: mode,
              departure: input.origin || 'Origin',
              arrival: input.destination,
              duration: duration,
              stops: 0,
              source: 'estimate',
            };
          };

          // SKIP flight API for domestic routes using train/bus - use pre-calculated prices instead
          // This saves 2-3 minutes of API timeout waiting
          if (transportRec.primaryMode !== 'flight' && (transportRec.distanceCategory === 'short' || transportRec.distanceCategory === 'medium')) {
            const primaryOption = transportRec.allOptions.find(o => o.recommended) || transportRec.allOptions[0];
            const basePrice = primaryOption?.priceRangeUSD[budgetTier] || 20;
            const modeLabel = transportRec.primaryMode === 'train' ? 'Train' : 'Bus';
            const duration = `${primaryOption?.durationHours || 5}h`;
            console.log(`[Background] Skipping flight API - using ${modeLabel} estimate: $${basePrice}/person`);
            trackProgress('flights');
            return createEstimate(basePrice, modeLabel, duration);
          }

          // Skip API call if dates are in the past
          if (datesInPast) {
            trackProgress('flights');
            return createEstimate(800);
          }

          // Use timeout wrapper for faster response - 30s max, then fallback to estimate
          const flightFallback = createEstimate(150, 'Budget Airlines', '2-4h');
          const { result: flightResult, timedOut } = await withTimeout(
            searchFlights({
              origin: input.origin || input.residence || 'New York',
              destination: input.destination,
              departureDate,
              returnDate,
              passengers: adults + children,
            }),
            API_TIMEOUT_MS,
            flightFallback,
            `Flight search ${input.origin} → ${input.destination}`
          );

          if (timedOut) {
            trackProgress('flights');
            return flightResult; // Already has fallback values
          }

          // Adjust price for children/infants
          const adultPrice = flightResult.pricePerPerson;
          const childPrice = Math.round(adultPrice * 0.75);
          const infantPrice = Math.round(adultPrice * 0.10);
          const totalPrice = (adults * adultPrice) + (children * childPrice) + (infants * infantPrice);

          trackProgress('flights');
          return {
            ...flightResult,
            price: totalPrice,
            pricePerPerson: adultPrice,
          };
        })(),

        // Hotel API call
        (async (): Promise<HotelResult> => {
          // Skip API call if dates are in the past
          if (datesInPast) {
            trackProgress('hotels');
            return {
              totalPrice: Math.round(100 * numNights),
              pricePerNight: 100,
              nights: numNights,
              hotelName: `Budget hotel in ${input.destination}`,
              rating: 4.0,
              amenities: ['WiFi', 'Air Conditioning'],
              source: 'estimate',
              type: 'Budget hotel',
            };
          }

          // Use timeout wrapper for faster response - 30s max, then fallback to estimate
          const hotelFallback: HotelResult = {
            totalPrice: Math.round(80 * numNights),
            pricePerNight: 80,
            nights: numNights,
            hotelName: `Budget accommodation in ${input.destination}`,
            rating: 3.5,
            amenities: ['WiFi', 'Air Conditioning'],
            source: 'estimate',
            type: 'Budget hotel (Estimated)',
          };

          const { result: hotelSearchResult } = await withTimeout(
            searchHotels({
              destination: input.destination,
              checkIn: departureDate,
              checkOut: returnDate,
              guests: input.groupSize,
              budget: Math.round(input.budget * 0.35),
            }),
            API_TIMEOUT_MS,
            hotelFallback,
            `Hotel search ${input.destination}`
          );

          trackProgress('hotels');
          return hotelSearchResult;
        })(),
      ]);

      console.log(`[Background] Parallel calls done in ${Date.now() - startTime}ms`);
      console.log(`[Background] Flight: $${flightResult.price} (${flightResult.source}), Hotel: $${hotelResult.totalPrice} (${hotelResult.source})`);

      // Update progress to show we're finalizing
      updateProgress(tripId, PROGRESS_STEPS.FINALIZING, "Calculating costs and building your trip plan");

      // Fetch live exchange rates
      const exchangeRates = await getExchangeRates();
      const rate = exchangeRates[currency] || FALLBACK_RATES[currency] || 1;
      console.log(`[Background] Exchange rate USD → ${currency}: ${rate}`);

      // Convert API prices from USD to user's currency
      const flightTotal = convertFromUSD(flightResult.price, currency, exchangeRates);
      const flightPerPerson = convertFromUSD(flightResult.pricePerPerson, currency, exchangeRates);
      const hotelTotal = convertFromUSD(hotelResult.totalPrice, currency, exchangeRates);
      const hotelPerNight = convertFromUSD(hotelResult.pricePerNight, currency, exchangeRates);

      console.log(`[Background] Converted to ${currency}: Flight ${currencySymbol}${flightTotal.toLocaleString()}, Hotel ${currencySymbol}${hotelTotal.toLocaleString()}`);

      // Build cost breakdown
      let itinerary = itineraryResult;

      // If itinerary generation failed, create a basic placeholder with real coordinates
      if (!itinerary.days || itinerary.days.length === 0) {
        console.log(`[Placeholder] All AI itinerary attempts failed for ${input.destination}`);
        console.log(`[Placeholder] Reasons: Primary AI returned empty, simplified prompt failed, agentic fallback failed`);
        console.log(`[Placeholder] Generating coordinate-based placeholder for ${numDays} days`);
        const startDate = new Date(departureDate);
        // Use AI Agent to get coordinates dynamically (with caching)
        const destCoords = await getDestinationCoords(input.destination);
        const center = destCoords.center;
        const attractions = destCoords.attractions;
        console.log(`[Placeholder] Found ${attractions.length} attractions via coordinate lookup for ${input.destination}`);
        console.log(`[Placeholder] Center: ${center.lat}, ${center.lng}`);

        itinerary = {
          days: Array.from({ length: numDays }, (_, i) => {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            const isFirstDay = i === 0;
            const isLastDay = i === numDays - 1;

            // Use attractions if available, otherwise use center with slight offsets
            const getCoords = (index: number) => {
              if (attractions.length > 0) {
                const attr = attractions[index % attractions.length];
                return { lat: attr.lat, lng: attr.lng };
              }
              // Add small random offset to center for variety
              return {
                lat: center.lat + (Math.random() - 0.5) * 0.02,
                lng: center.lng + (Math.random() - 0.5) * 0.02
              };
            };

            const getAttractionName = (index: number) => {
              if (attractions.length > 0) {
                return attractions[index % attractions.length].name;
              }
              return input.destination;
            };

            return {
              day: i + 1,
              date: date.toISOString().split('T')[0],
              title: isFirstDay ? "Arrival Day" : isLastDay ? "Departure Day" : `Day ${i + 1} in ${input.destination}`,
              activities: [
                isFirstDay
                  ? { time: "14:00", name: "Airport Arrival", description: "Arrive and transfer to hotel", type: "transport", location: `${input.destination} Airport`, coordinates: center, estimatedCost: 30 }
                  : isLastDay
                    ? { time: "10:00", name: "Hotel Check-out", description: "Check out and prepare for departure", type: "lodging", location: "Hotel", coordinates: center, estimatedCost: 0 }
                    : { time: "09:00", name: getAttractionName(i * 2), description: `Visit ${getAttractionName(i * 2)}`, type: "activity", location: getAttractionName(i * 2), coordinates: getCoords(i * 2), estimatedCost: 40 },
                isFirstDay
                  ? { time: "15:30", name: "Hotel Check-in", description: "Check into accommodation", type: "lodging", location: "Hotel", coordinates: center, estimatedCost: 0 }
                  : null,
                { time: "13:00", name: "Local Lunch", description: "Lunch at local restaurant", type: "meal", location: "Local restaurant", coordinates: getCoords(i * 2 + 1), estimatedCost: 25 },
                isLastDay
                  ? { time: "15:00", name: "Airport Departure", description: "Depart from airport", type: "transport", location: `${input.destination} Airport`, coordinates: center, estimatedCost: 30 }
                  : { time: "15:00", name: getAttractionName(i * 2 + 1), description: `Explore ${getAttractionName(i * 2 + 1)}`, type: "activity", location: getAttractionName(i * 2 + 1), coordinates: getCoords(i * 2 + 1), estimatedCost: 35 },
                !isLastDay ? { time: "19:00", name: "Dinner", description: "Dinner at local restaurant", type: "meal", location: "Local restaurant", coordinates: getCoords(i * 3), estimatedCost: 35 } : null,
              ].filter(Boolean),
            };
          }),
        };
      }

      if (itinerary.days && itinerary.days.length > 0) {
        // ============ DYNAMIC AI-DRIVEN COST SYSTEM ============
        // Trust the AI's cost estimates - they are generated based on destination and travel style
        // AI has been prompted to provide realistic local prices in USD
        console.log(`[Background] Using AI-generated costs for ${budgetTier} travel in ${input.destination}`);

        let totalActivities = 0, totalFood = 0, totalTransport = 0;

        // Calculate group size with fallbacks
        const groupSize = input.groupSize || (input.adults || 1) + (input.children || 0);

        // Fallback costs by activity type (in USD per person)
        const fallbackCostsUSD: Record<string, number> = {
          activity: { budget: 10, standard: 20, luxury: 40 }[budgetTier] || 15,
          meal: { budget: 8, standard: 20, luxury: 50 }[budgetTier] || 15,
          transport: { budget: 5, standard: 10, luxury: 25 }[budgetTier] || 10,
        };

        itinerary.days.forEach((day: any) => {
          if (day.activities) {
            day.activities.forEach((activity: any) => {
              // AI provides estimatedCost in USD per person - convert to user's currency
              let aiCostUSD = activity.estimatedCost || 0;

              // Skip lodging costs (handled separately via hotel API)
              if (activity.type === 'lodging') {
                activity.estimatedCost = 0;
                return;
              }

              // FALLBACK: If AI returned 0 for paid activities, use estimated costs
              if (aiCostUSD === 0 && activity.type !== 'lodging') {
                // Free attractions stay free
                const isFreeAttraction = (activity.description || activity.name || '').toLowerCase()
                  .match(/park|garden|beach|viewpoint|square|piazza|walk|stroll|free/);
                if (!isFreeAttraction) {
                  aiCostUSD = fallbackCostsUSD[activity.type] || fallbackCostsUSD.activity;
                }
              }

              // Convert AI's USD estimate to local currency for the group
              const totalPriceUSD = aiCostUSD * groupSize;
              const totalPrice = Math.round(convertFromUSD(totalPriceUSD, currency, exchangeRates));
              activity.estimatedCost = totalPrice;

              // Track totals by category
              if (activity.type === 'activity') totalActivities += totalPrice;
              if (activity.type === 'meal') totalFood += totalPrice;
              if (activity.type === 'transport') totalTransport += totalPrice;
            });
          }

          // Also process localFood array if present
          if (day.localFood && Array.isArray(day.localFood)) {
            day.localFood.forEach((food: any) => {
              let foodCostUSD = food.estimatedCost || 0;

              // FALLBACK: Estimate food cost based on priceRange if not provided
              if (foodCostUSD === 0) {
                const priceRange = food.priceRange || '$$';
                foodCostUSD = priceRange === '$' ? 8 : priceRange === '$$$' ? 45 : 20;
                food.estimatedCost = foodCostUSD;
              }

              // Convert to group cost in local currency
              const totalFoodPrice = Math.round(convertFromUSD(foodCostUSD * groupSize, currency, exchangeRates));
              food.totalCost = totalFoodPrice;
              totalFood += totalFoodPrice;
            });
          }
        });

        console.log(`[Background] AI cost totals (with fallbacks) - Activities: ${totalActivities}, Food: ${totalFood}, Transport: ${totalTransport}`);

        const hasReliableCosts = totalActivities > 0 || totalFood > 0 || totalTransport > 0;
        itinerary.costDataStatus = hasReliableCosts ? 'complete' : 'incomplete';
        if (!hasReliableCosts) {
          itinerary.costDataNote = 'Activity costs may be incomplete. Please verify prices locally.';
        }

        // Safe number helper
        const safeNum = (n: number) => (isNaN(n) || n === null || n === undefined) ? 0 : n;

        // Budget-appropriate accommodation pricing
        // Hotel API returns various options - apply reasonable tier limits
        const maxPerNightUSD = { budget: 35, standard: 120, luxury: 400 }[budgetTier] || 100;
        const budgetAppropriatePerNightUSD = { budget: 20, standard: 70, luxury: 200 }[budgetTier] || 60;

        // Calculate API hotel rate per night per room
        const apiPerNightUSD = hotelResult.pricePerNight ? hotelResult.pricePerNight : 0;

        // Use API price only if it fits budget tier, otherwise use budget-appropriate estimate
        let accommodationTotal: number;
        let perNightRate: number;
        let hotelSource = 'api';

        if (apiPerNightUSD > 0 && apiPerNightUSD <= maxPerNightUSD) {
          // API result is within budget tier - use it
          accommodationTotal = safeNum(hotelTotal);
          perNightRate = safeNum(hotelPerNight);
        } else {
          // API result is too expensive for this tier OR unavailable - use budget estimate
          const budgetHotelUSD = budgetAppropriatePerNightUSD * numNights * Math.ceil(input.groupSize / 2); // rooms needed
          accommodationTotal = Math.round(convertFromUSD(budgetHotelUSD, currency, exchangeRates));
          perNightRate = Math.round(accommodationTotal / numNights);
          hotelSource = 'estimate';
          console.log(`[Background] Hotel API too expensive for ${budgetTier} tier ($${apiPerNightUSD}/night vs max $${maxPerNightUSD}). Using estimate: $${budgetAppropriatePerNightUSD}/night`);
        }

        // Minimal intercity/misc estimates - AI includes most transport costs in the itinerary
        const intercityEstimate = 0; // AI already includes intercity transport in itinerary
        const miscTotal = 0; // Avoid adding arbitrary padding - trust AI's comprehensive costs

        const originDisplay = input.origin || 'Your city';

        // Traveler counts for display
        const adults = input.adults || input.groupSize || 1;
        const children = input.children || 0;
        const infants = input.infants || 0;

        // Build transport options for cost breakdown
        const transportOptions = transportRec.allOptions.map(opt => ({
          mode: opt.mode,
          estimatedCost: convertFromUSD(opt.priceRangeUSD[budgetTier] * input.groupSize, currency, exchangeRates),
          duration: `${opt.durationHours}h`,
          recommended: opt.recommended,
          note: opt.note
        }));

        // SMART TRANSPORT SELECTION based on travel style
        // Budget travelers → use cheapest option (usually bus)
        // Standard travelers → use recommended option (usually train or balanced)
        // Luxury travelers → use fastest option (usually flight)
        let selectedTransportOption = transportOptions[0];
        let selectedTransportCost = flightTotal;
        let selectedTransportMode = 'flight';
        let selectedTransportDuration = flightResult.duration;
        let selectedTransportNote = `Round-trip from ${originDisplay}`;

        if (transportOptions.length > 0) {
          if (budgetTier === 'budget') {
            // Budget: find the CHEAPEST option
            selectedTransportOption = transportOptions.reduce((cheapest, opt) =>
              opt.estimatedCost < cheapest.estimatedCost ? opt : cheapest, transportOptions[0]);
            console.log(`[Transport Selection] Budget tier: Using cheapest option "${selectedTransportOption.mode}" at ${currencySymbol}${selectedTransportOption.estimatedCost}`);
          } else if (budgetTier === 'luxury') {
            // Luxury: find the FASTEST option (lowest duration)
            selectedTransportOption = transportOptions.reduce((fastest, opt) => {
              const fastestHours = parseFloat(fastest.duration) || 999;
              const optHours = parseFloat(opt.duration) || 999;
              return optHours < fastestHours ? opt : fastest;
            }, transportOptions[0]);
            console.log(`[Transport Selection] Luxury tier: Using fastest option "${selectedTransportOption.mode}" (${selectedTransportOption.duration})`);
          } else {
            // Standard: use recommended option or middle-ground
            selectedTransportOption = transportOptions.find(opt => opt.recommended) || transportOptions[Math.floor(transportOptions.length / 2)];
            console.log(`[Transport Selection] Standard tier: Using recommended option "${selectedTransportOption.mode}"`);
          }

          selectedTransportCost = selectedTransportOption.estimatedCost;
          selectedTransportMode = selectedTransportOption.mode;
          selectedTransportDuration = selectedTransportOption.duration;
          selectedTransportNote = `${selectedTransportMode.charAt(0).toUpperCase() + selectedTransportMode.slice(1)} from ${originDisplay} (${transportRec.distanceCategory} distance)`;

          // Mark the selected option
          transportOptions.forEach((opt: any) => {
            opt.selected = opt.mode === selectedTransportMode;
          });
        }

        // Use SELECTED transport cost (not always flight) for grandTotal
        const grandTotal = safeNum(selectedTransportCost) + safeNum(accommodationTotal) + safeNum(totalFood) +
                          safeNum(totalActivities) + safeNum(totalTransport) + safeNum(intercityEstimate) + safeNum(miscTotal);
        const budgetDiff = input.budget - grandTotal;

        console.log(`[Cost Breakdown] Travel style: ${budgetTier}, Selected transport: ${selectedTransportMode} (${currencySymbol}${selectedTransportCost}), Grand total: ${currencySymbol}${grandTotal}`);

        // AI-powered booking apps and mobile data suggestions based on destination
        // This dynamically finds the best apps for the specific country/region
        const getBookingAppsAndMobileInfo = async (destination: string, transportModes: string[]): Promise<{
          bookingApps: { mode: string; apps: { name: string; url: string; note: string }[] }[];
          mobilePlans: { provider: string; plan: string; price: string; note: string }[];
        }> => {
          try {
            const response = await openai!.chat.completions.create({
              model: aiModel,
              messages: [
                { role: 'system', content: 'You are a travel expert. Return valid JSON only.' },
                { role: 'user', content: `For travelers to ${destination}, provide:
1. Best booking apps/websites for these transport modes: ${transportModes.join(', ')}
2. Cheapest mobile/SIM plans for visitors (prepaid tourist SIMs)

Return JSON:
{
  "bookingApps": [
    {"mode": "bus", "apps": [{"name": "RedBus", "url": "https://www.redbus.in", "note": "Largest bus booking in India"}]},
    {"mode": "train", "apps": [{"name": "IRCTC", "url": "https://www.irctc.co.in", "note": "Official Indian Railways"}]},
    {"mode": "flight", "apps": [{"name": "Skyscanner", "url": "https://www.skyscanner.com", "note": "Compare all airlines"}]}
  ],
  "mobilePlans": [
    {"provider": "Jio", "plan": "Tourist Prepaid", "price": "₹299/28 days", "data": "1.5GB/day", "note": "Best coverage, 4G"}
  ]
}

Include 2-3 apps per mode and 2-3 mobile options. Use REAL apps and URLs for ${destination}.` }
              ],
              response_format: { type: 'json_object' },
              temperature: 0.3,
              max_tokens: 1500,
            });

            const result = safeJsonParse(response.choices[0].message.content || '{}', { bookingApps: [], mobilePlans: [] });
            console.log(`[AI] Got ${result.bookingApps?.length || 0} booking app categories and ${result.mobilePlans?.length || 0} mobile plans for ${destination}`);
            return result;
          } catch (error) {
            console.log(`[AI] Failed to get booking apps for ${destination}, using fallback`);
            // Fallback with common global options
            return {
              bookingApps: [
                { mode: 'flight', apps: [
                  { name: 'Skyscanner', url: 'https://www.skyscanner.com', note: 'Compare all airlines' },
                  { name: 'Google Flights', url: 'https://www.google.com/flights', note: 'Best price tracking' }
                ]},
                { mode: 'bus', apps: [
                  { name: 'Busbud', url: 'https://www.busbud.com', note: 'Global bus booking' }
                ]},
                { mode: 'train', apps: [
                  { name: 'Trainline', url: 'https://www.trainline.com', note: 'European trains' }
                ]}
              ],
              mobilePlans: [
                { provider: 'Airalo', plan: 'eSIM', price: 'From $5', note: 'Works in 190+ countries (1GB+)' }
              ]
            };
          }
        };

        // Get booking apps in parallel (non-blocking for faster response)
        const transportModes = transportOptions.map(opt => opt.mode.split(' ')[0]); // Extract base mode (bus, train, flight)
        const uniqueModes = Array.from(new Set(transportModes));
        const bookingInfo = await getBookingAppsAndMobileInfo(input.destination, uniqueModes);

        // Generate savings tips based on transport and budget
        const savingsTips = [];
        if (transportRec.primaryMode === 'flight') {
          savingsTips.push("Book flights 2-3 months in advance for best prices");
          savingsTips.push("Use Google Flights or Skyscanner to compare prices");
        }
        if (transportRec.allOptions.some(o => o.mode === 'train')) {
          savingsTips.push("Consider trains for scenic journeys and no airport hassles");
        }
        if (transportRec.allOptions.some(o => o.mode.includes('bus'))) {
          savingsTips.push("Overnight buses can save on accommodation costs");
        }
        if (transportRec.isDomestic) {
          savingsTips.push("Compare train and bus prices on local booking sites");
        }
        savingsTips.push("Book attractions online for discounts");
        if (budgetTier === 'budget') {
          savingsTips.push("Use public transport instead of taxis to save more");
        }

        itinerary.costBreakdown = {
          currency: currency,
          currencySymbol: currencySymbol,
          budgetTier: budgetTier,
          travelers: {
            total: input.groupSize,
            adults: adults,
            children: children,
            infants: infants,
            note: `${adults} adult${adults > 1 ? 's' : ''}${children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}${infants > 0 ? `, ${infants} infant${infants > 1 ? 's' : ''}` : ''}`
          },
          // Primary transport - USES SELECTED OPTION based on travel style
          // Budget → cheapest, Standard → recommended, Luxury → fastest
          flights: {
            total: selectedTransportCost,
            perPerson: Math.round(selectedTransportCost / input.groupSize),
            airline: selectedTransportMode === 'flight' ? flightResult.airline : selectedTransportMode.charAt(0).toUpperCase() + selectedTransportMode.slice(1),
            duration: selectedTransportDuration,
            stops: selectedTransportMode === 'flight' ? flightResult.stops : 0,
            bookingUrl: selectedTransportMode === 'flight' ? flightResult.bookingUrl : null,
            note: selectedTransportNote + (selectedTransportMode === 'flight' && flightResult.source === 'api' ? ' (Live prices)' : ' (Estimated)'),
            source: selectedTransportMode === 'flight' ? flightResult.source : 'estimate',
            selectedMode: selectedTransportMode, // Track which mode was selected
          },
          // All transport options with selection marker
          transportOptions: {
            primaryMode: transportRec.primaryMode,
            selectedMode: selectedTransportMode, // Which mode is used in cost calculation
            isDomestic: transportRec.isDomestic,
            distanceCategory: transportRec.distanceCategory,
            recommendation: transportRec.recommendation,
            options: transportOptions
          },
          accommodation: {
            total: accommodationTotal,
            perNight: perNightRate,
            nights: numNights,
            hotelName: hotelSource === 'api' ? hotelResult.hotelName : `${budgetTier === 'budget' ? 'Budget guesthouse/hostel' : budgetTier === 'luxury' ? 'Luxury hotel' : 'Mid-range hotel'}`,
            rating: hotelSource === 'api' ? hotelResult.rating : (budgetTier === 'budget' ? 3.5 : budgetTier === 'luxury' ? 4.5 : 4.0),
            bookingUrl: hotelSource === 'api' ? hotelResult.bookingUrl : null,
            type: hotelSource === 'api'
              ? hotelResult.type + ' (Live prices)'
              : `${budgetTier === 'budget' ? 'Budget accommodation' : budgetTier === 'luxury' ? 'Luxury accommodation' : 'Standard accommodation'} (Estimated for ${budgetTier} travel)`,
            source: hotelSource,
          },
          food: { total: totalFood, perDay: Math.round(totalFood / numDays), note: `${budgetTier === 'luxury' ? 'Fine dining and cafes' : budgetTier === 'budget' ? 'Street food and local eateries' : 'Local restaurants and cafes'}` },
          activities: { total: totalActivities, note: "Museums, attractions, tours" },
          localTransport: {
            total: totalTransport,
            options: transportRec.intraCityTransport.options,
            note: transportRec.intraCityTransport.note
          },
          intercityTransport: { total: intercityEstimate, note: numDays > 4 ? "Day trip transportation" : "Not applicable" },
          misc: { total: miscTotal, note: "Souvenirs, tips, unexpected expenses" },
          grandTotal,
          perPerson: Math.round(grandTotal / input.groupSize),
          budgetStatus: budgetDiff > input.budget * 0.1 ? "within_budget" : budgetDiff > 0 ? "tight" : "over_budget",
          savingsTips: savingsTips.slice(0, 5), // Limit to 5 tips
          // AI-powered booking apps for each transport mode
          bookingApps: bookingInfo.bookingApps,
          // Cheapest mobile/SIM plans for visitors
          mobilePlans: bookingInfo.mobilePlans,
        };
      }

      // Add risk override flag and risk-aware modifications if user proceeded despite warnings
      if (riskOverride) {
        (itinerary as any).riskOverride = true;
        (itinerary as any).riskOverrideTimestamp = new Date().toISOString();

        // Add risk-aware recommendations
        (itinerary as any).riskAwareMode = {
          enabled: true,
          message: "This plan is optimized to reduce risk due to visa/timing concerns.",
          recommendations: {
            flights: "Flexible booking recommended due to visa timing. Consider refundable fares.",
            accommodation: "Free-cancellation properties recommended. Avoid prepaid stays until visa confirmed.",
            activities: "Paid attractions marked as optional. Focus on walk-up and free experiences first."
          }
        };

        // Mark all paid activities as optional upgrades
        if (itinerary.days) {
          itinerary.days = itinerary.days.map((day: any) => ({
            ...day,
            activities: day.activities?.map((activity: any) => {
              // If activity has significant cost, mark as optional
              if (activity.estimatedCost && activity.estimatedCost > 20 && activity.type === 'activity') {
                return {
                  ...activity,
                  isOptional: true,
                  riskNote: "Optional upgrade - book after visa confirmed"
                };
              }
              return activity;
            })
          }));
        }

        // Add notes to cost breakdown
        if (itinerary.costBreakdown) {
          itinerary.costBreakdown.riskAwareNotes = {
            flights: "Consider flexible/refundable fares (+10-15% cost) for peace of mind",
            accommodation: "Book free-cancellation options until visa is confirmed",
            activities: "Paid attractions are marked optional - book closer to travel date"
          };
        }

        console.log(`[Stage2] Applied risk-aware modifications to itinerary for trip ${tripId}`);
      }

      await storage.updateTripItinerary(tripId, itinerary);

      // Sync feasibility report with actual calculated costs
      // ONLY update budget status for custom budget trips - for Budget/Comfort/Luxury travel styles,
      // there's no user-specified budget to compare against
      const isCustomBudgetTrip = input.travelStyle === 'custom';

      if (itinerary.costBreakdown) {
        const actualCost = itinerary.costBreakdown.grandTotal;
        const budgetStatus = itinerary.costBreakdown.budgetStatus;
        const travelStyleLabel = input.travelStyle === 'budget' ? 'Budget' :
                                 input.travelStyle === 'standard' ? 'Comfort' :
                                 input.travelStyle === 'luxury' ? 'Luxury' : 'Custom';

        // Update the feasibility report with actual costs
        const updatedReport: FeasibilityReport = {
          ...report,
          breakdown: {
            ...report.breakdown,
            budget: isCustomBudgetTrip
              ? {
                  // Custom budget - compare against user's specified budget
                  status: budgetStatus === 'over_budget' ? 'impossible' : budgetStatus === 'tight' ? 'tight' : 'ok',
                  estimatedCost: actualCost,
                  reason: budgetStatus === 'over_budget'
                    ? `Trip costs ${currencySymbol}${actualCost.toLocaleString()} exceed your ${currencySymbol}${input.budget.toLocaleString()} budget`
                    : budgetStatus === 'tight'
                    ? `Trip costs ${currencySymbol}${actualCost.toLocaleString()} - close to your ${currencySymbol}${input.budget.toLocaleString()} budget`
                    : `Trip costs ${currencySymbol}${actualCost.toLocaleString()} - within your ${currencySymbol}${input.budget.toLocaleString()} budget`
                }
              : {
                  // Travel style selected - no budget comparison needed
                  status: 'ok',
                  estimatedCost: actualCost,
                  reason: `${travelStyleLabel} travel - estimated ${currencySymbol}${actualCost.toLocaleString()} total`
                }
          },
          summary: isCustomBudgetTrip && budgetStatus === 'over_budget'
            ? `Trip exceeds budget by ${currencySymbol}${(actualCost - input.budget).toLocaleString()}. ${report.breakdown.visa.status === 'ok' ? 'Visa requirements appear favorable.' : 'Check visa requirements carefully.'}`
            : report.summary
        };

        // Also update overall status if budget is impossible - ONLY for custom budget trips
        if (isCustomBudgetTrip && budgetStatus === 'over_budget' && report.overall === 'yes') {
          updatedReport.overall = 'warning';
          updatedReport.score = Math.min(report.score, 65);
        }

        await storage.updateTripFeasibility(tripId, updatedReport.overall, updatedReport);
        console.log(`[Background] Synced feasibility with actual costs: ${currencySymbol}${actualCost.toLocaleString()} (${isCustomBudgetTrip ? 'custom budget' : travelStyleLabel + ' style'})`);
      }
    }

    console.log(`[Background] Trip ${tripId} completed in ${Date.now() - startTime}ms`);
    updateProgress(tripId, PROGRESS_STEPS.COMPLETE, "Your trip is ready!");
    clearProgress(tripId);

  } catch (error) {
    console.error(`[Background] Error processing trip ${tripId}:`, error);
    updateProgress(tripId, { step: -1, message: "Error processing trip" }, String(error));
    clearProgress(tripId);
    // Trip stays in pending state, frontend will show appropriate message
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Add cookie parser for session management
  app.use(cookieParser());

  // Register authentication routes
  app.use('/api/auth', authRouter);

  // Register email routes
  app.use('/api/email', emailRouter);

  // Register chat routes (for trip conversations)
  app.use('/api/trips', chatRouter);

  // Register price alerts routes
  app.use('/api/price-alerts', priceAlertsRouter);

  // Register templates routes
  app.use('/api/templates', templatesRouter);

  // Register additional feature routes
  app.use('/api/packing-list', packingListRouter);
  app.use('/api/insurance', insuranceRouter);
  app.use('/api/trips', collaborationRouter);
  app.use('/api/weather', weatherRouter);
  app.use('/api/subscriptions', subscriptionsRouter);
  app.use("/api", changePlanRouter);
  app.use("/api", fixOptionsRouter);
  app.use("/api", appliedPlansRouter);
  app.use("/api", versionsRouter);
  app.use("/api/knowledge", knowledgeRouter);
  app.use("/api/mapbox", mapboxRouter);
  app.use("/api/scrape", scrapeRouter);

  // Trip creation - rate limited to 5/min per IP (expensive operation)
  app.post(api.trips.create.path, tripCreationRateLimiter, async (req, res) => {
    try {
      const input = api.trips.create.input.parse(req.body);
      const voyageUid = req.headers['x-voyage-uid'] as string | undefined;

      const result = await TripService.createTrip(input, voyageUid);
      if (!result.trip) {
        return res.status(400).json({ message: result.error, field: result.field });
      }

      res.status(201).json(result.trip);

      // Run feasibility check in background
      processFeasibilityOnly(result.trip.id, input).catch(err => {
        console.error('Feasibility check failed:', err);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ============================================================================
  // UPDATE TRIP - Modify existing trip (Edit mode)
  // ============================================================================
  app.put('/api/trips/:id', async (req, res) => {
    try {
      const tripId = Number(req.params.id);
      const input = api.trips.create.input.parse(req.body);
      const voyageUid = req.headers['x-voyage-uid'] as string | undefined;

      const result = await TripService.updateTrip(tripId, input as TripService.CreateTripInput, voyageUid);
      if (!result.trip) {
        const status = result.error === 'Trip not found' ? 404 : result.error === 'Not authorized to edit this trip' ? 403 : 400;
        return res.status(status).json({ message: result.error, field: result.field });
      }

      res.json(result.trip);

      // Run feasibility check in background
      processFeasibilityOnly(tripId, input).catch(err => {
        console.error('Feasibility check failed after update:', err);
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      console.error('Error updating trip:', err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // ============================================================================
  // LIST MY TRIPS - Returns trips for the current anonymous user (Item 21)
  // ============================================================================
  app.get('/api/my-trips', async (req, res) => {
    try {
      const voyageUid = req.headers['x-voyage-uid'] as string | undefined;
      if (!voyageUid) {
        return res.json({ trips: [], message: "No voyage_uid provided" });
      }

      const limit = Number(req.query.limit) || 20;
      const trips = await TripService.listMyTrips(voyageUid, limit);
      res.json({ trips });
    } catch (err) {
      console.error('[my-trips] Error:', err);
      res.status(500).json({ message: 'Failed to fetch trips' });
    }
  });

  app.get(api.trips.get.path, async (req, res) => {
    const tripId = Number(req.params.id);
    const voyageUid = req.headers['x-voyage-uid'] as string | undefined;

    const result = await TripService.getTripWithOwnership(tripId, voyageUid);
    if (!result.authorized || !result.trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    res.json(result.trip);
  });

  // ============================================================================
  // DELETE TRIP - Permanently removes a trip and its associated data
  // ============================================================================
  app.delete('/api/trips/:id', async (req, res) => {
    const tripId = Number(req.params.id);
    const voyageUid = req.headers['x-voyage-uid'] as string | undefined;

    if (isNaN(tripId) || tripId <= 0) {
      return res.status(400).json({ message: 'Invalid trip ID' });
    }

    const result = await TripService.deleteTripWithOwnership(tripId, voyageUid);
    if (!result.success) {
      const status = result.error === 'Trip not found' ? 404 : result.error === 'Not authorized to delete this trip' ? 403 : 500;
      return res.status(status).json({ message: result.error });
    }

    res.json({ success: true, message: 'Trip deleted successfully' });
  });

  // ============================================================================
  // PUBLIC SHARE ENDPOINT - Returns trip data without ownership check
  // Used for view-only shared links (Phase 3.6)
  // ============================================================================
  app.get('/api/share/:id', async (req, res) => {
    const tripId = Number(req.params.id);

    if (isNaN(tripId) || tripId <= 0) {
      return res.status(400).json({ message: 'Invalid trip ID' });
    }

    const shareableTrip = await TripService.getTripForShare(tripId);
    if (!shareableTrip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    console.log(`[ShareView] Trip ${tripId} viewed via share link`);
    res.json(shareableTrip);
  });

  // ============================================================================
  // DEMO TRIP ENDPOINT - Returns a stable demo trip for /demo route
  // ============================================================================
  app.get('/api/demo-trip', async (req, res) => {
    try {
      // Try to find existing demo trip (trip ID 2 - Thailand)
      let demoTrip = await storage.getTrip(2);

      // If trip 2 doesn't exist or has no itinerary, try to find any trip with itinerary
      if (!demoTrip || !(demoTrip.itinerary as any)?.days?.length) {
        // Try to find any completed trip we can use as demo
        const allTrips = await storage.listTrips();
        demoTrip = allTrips.find(t => (t.itinerary as any)?.days?.length > 0) ?? undefined;
      }

      // If still no demo trip available, return fallback data
      if (!demoTrip) {
        return res.json(DEMO_TRIP_FALLBACK);
      }

      res.json(demoTrip);
    } catch (error) {
      console.error('[DemoTrip] Error fetching demo trip:', error);
      // Return fallback on any error
      res.json(DEMO_TRIP_FALLBACK);
    }
  });

  // DEBUG: Seed trip with demo data (for testing export)
  app.post('/api/debug/seed-trip/:id', async (req, res) => {
    const tripId = Number(req.params.id);
    try {
      // Update trip with demo data
      await storage.updateTripItinerary(tripId, DEMO_TRIP_FALLBACK.itinerary);
      await storage.updateTripFeasibility(tripId, 'yes', DEMO_TRIP_FALLBACK.feasibilityReport as any);
      const updated = await storage.getTrip(tripId);
      console.log(`[Debug] Seeded trip ${tripId} with demo data`);
      res.json(updated);
    } catch (error) {
      console.error('[Debug] Seed error:', error);
      res.status(500).json({ error: 'Failed to seed trip' });
    }
  });

  // Progress endpoint - returns real-time processing status
  app.get('/api/trips/:id/progress', async (req, res) => {
    const tripId = Number(req.params.id);
    const progress = tripProgressStore.get(tripId);

    if (progress) {
      const elapsed = Math.round((Date.now() - progress.startedAt) / 1000);

      // Calculate dynamic percentage - especially for step 4 (itinerary generation)
      let percentComplete: number;
      if (progress.step === 4) {
        // Step 4 (itinerary) takes longest - animate from 67% to 95% based on elapsed time
        // Assume average ~90 seconds for itinerary generation
        const itineraryProgress = Math.min(0.95, elapsed / 100); // Max 95% until complete
        percentComplete = Math.round(67 + (itineraryProgress * 28)); // 67% to 95%
      } else if (progress.step === 6) {
        percentComplete = 100;
      } else {
        // Steps 1-3, 5: Linear progress
        percentComplete = Math.min(100, Math.round((progress.step / 6) * 100));
      }

      res.json({
        ...progress,
        elapsed,
        totalSteps: 6,
        percentComplete,
      });
    } else {
      // Check if trip exists and is complete
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found' });
      }
      // If itinerary exists, trip is complete
      if (trip.itinerary) {
        res.json({
          step: 6,
          message: "Complete!",
          totalSteps: 6,
          percentComplete: 100,
          elapsed: 0,
        });
      } else if (trip.feasibilityStatus === 'pending') {
        // Still pending but no progress tracked - probably just started
        res.json({
          step: 0,
          message: "Starting analysis...",
          totalSteps: 6,
          percentComplete: 0,
          elapsed: 0,
        });
      } else {
        // Feasibility done but no itinerary exists
        // IMPORTANT: This does NOT mean generation is in progress!
        // It means user hasn't triggered generation yet.
        // Return step 3.5 to indicate "ready to generate"
        res.json({
          step: 3.5,
          message: "Ready to generate itinerary",
          totalSteps: 6,
          percentComplete: 50,
          elapsed: 0,
          needsGeneration: true, // Signal to client that generation should be triggered
        });
      }
    }
  });

  // ============================================================================
  // RE-CHECK FEASIBILITY: For backward compatibility with older trips
  // ============================================================================
  const STALE_PENDING_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes - if pending longer, consider stale

  app.post('/api/trips/:id/feasibility/refresh', async (req, res) => {
    try {
      const tripId = Number(req.params.id);
      const trip = await storage.getTrip(tripId);

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found' });
      }

      // Prevent concurrent refreshes (409 Conflict)
      // Allow refresh if pending state is stale (> 2 minutes old)
      if (trip.feasibilityStatus === 'pending') {
        const lastRunAt = (trip as any).feasibilityLastRunAt;
        const isStale = lastRunAt && (Date.now() - new Date(lastRunAt).getTime()) > STALE_PENDING_TIMEOUT_MS;

        if (!isStale) {
          return res.status(409).json({
            message: 'Refresh already in progress',
            retryAfter: Math.ceil(STALE_PENDING_TIMEOUT_MS / 1000),
          });
        }
        console.log(`[Refresh] Trip ${tripId} pending state is stale, allowing refresh`);
      }

      // Build input object from existing trip data
      const input = {
        passport: trip.passport,
        residence: trip.passport, // Default to passport if no separate residence
        origin: trip.origin,
        destination: trip.destination,
        dates: trip.dates,
        budget: trip.budget,
        currency: trip.currency,
        groupSize: trip.groupSize,
        adults: trip.adults,
        children: trip.children,
        infants: trip.infants,
        travelStyle: trip.travelStyle,
      };

      // Set pending status with timestamp (for stale detection)
      await storage.setTripFeasibilityPending(tripId);

      // Return 202 Accepted (async processing)
      res.status(202).json({
        success: true,
        message: 'Re-checking feasibility...',
        tripId,
      });

      // Run feasibility check in background
      processFeasibilityOnly(tripId, input).catch(err => {
        console.error('Feasibility re-check failed:', err);
      });

    } catch (err) {
      console.error('Error refreshing feasibility:', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ============================================================================
  // ALTERNATIVES: Get alternative destinations when trip hits HARD_BLOCKER
  // ============================================================================
  app.get('/api/alternatives', async (req, res) => {
    try {
      const passport = req.query.passport as string;
      const blockedDestination = req.query.blocked as string | undefined;

      if (!passport) {
        return res.status(400).json({ message: 'passport query parameter required' });
      }

      const alternatives = getAlternatives(passport, blockedDestination, 3);

      res.json({
        passport,
        blockedDestination: blockedDestination || null,
        alternatives,
        count: alternatives.length,
      });
    } catch (err) {
      console.error('Error fetching alternatives:', err);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  // ============================================================================
  // STAGE 2: Generate Itinerary (triggered by user after reviewing feasibility)
  // ============================================================================
  app.post('/api/trips/:id/generate-itinerary', async (req, res) => {
    try {
      const tripId = Number(req.params.id);
      const { riskOverride = false } = req.body || {};
      const trip = await storage.getTrip(tripId);

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found' });
      }

      // Check if feasibility is done
      if (trip.feasibilityStatus === 'pending') {
        return res.status(400).json({
          message: 'Feasibility check still in progress. Please wait.',
          status: 'pending'
        });
      }

      // Check if trip is feasible (allow override for soft blockers)
      // Hard blockers should never reach this point - UI prevents it
      if (trip.feasibilityStatus === 'no' && !riskOverride) {
        return res.status(400).json({
          message: 'Trip is not feasible. Cannot generate itinerary.',
          status: 'not_feasible'
        });
      }

      // Log risk override for audit and analytics
      if (riskOverride) {
        console.log(`[Stage2] User override: Generating itinerary despite risks for trip ${tripId}`);
        trackOverrideDecision(true);
      }

      // Check if itinerary already exists
      if (trip.itinerary) {
        return res.status(200).json({
          message: 'Itinerary already exists',
          status: 'complete',
          tripId: trip.id
        });
      }

      // Start Stage 2: Generate itinerary in background
      res.status(202).json({
        message: 'Itinerary generation started',
        status: 'processing',
        tripId: trip.id,
        riskOverride
      });

      // Fire and forget - generate itinerary with risk override flag
      generateItineraryForTrip(tripId, { riskOverride }).catch(err => {
        console.error(`[Stage2] Error generating itinerary for trip ${tripId}:`, err);
      });

    } catch (error) {
      console.error('[API] Generate itinerary error:', error);
      res.status(500).json({ message: 'Failed to start itinerary generation' });
    }
  });

  // ============================================================================
  // STREAMING ITINERARY GENERATION (SSE)
  // ============================================================================
  // New endpoint that streams day-by-day generation for faster UX
  // Days appear within 5-10 seconds instead of waiting 60+ seconds
  // Rate limited: 10/min per IP, max 3 concurrent streams per IP

  app.get('/api/trips/:id/itinerary/stream', ...sseProtection, async (req, res) => {
    const tripId = parseInt(req.params.id);

    if (isNaN(tripId)) {
      return res.status(400).json({ error: 'Invalid trip ID' });
    }

    // Rollout flag check - allows gradual rollout via ?stream=1 or env var
    if (!shouldUseStreaming(req)) {
      return res.status(400).json({
        error: 'Streaming not enabled',
        hint: 'Add ?stream=1 to enable streaming or set STREAMING_ITINERARY_ENABLED=true'
      });
    }

    // Create abort controller to handle client disconnect
    const abortController = createStreamAbortController(req);

    try {
      const trip = await storage.getTrip(tripId);

      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      // Check if trip has feasibility report (required before itinerary)
      if (!trip.feasibilityReport) {
        return res.status(400).json({
          error: 'Feasibility check required before generating itinerary',
          status: 'not_feasible'
        });
      }

      // Parse dates to calculate number of days
      const dates = trip.dates || '';
      const dateMatch = dates.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|→|-)\s*(\d{4}-\d{2}-\d{2})/);
      let startDate = new Date().toISOString().split('T')[0];
      let numDays = 7;

      if (dateMatch) {
        startDate = dateMatch[1];
        const endDate = new Date(dateMatch[2]);
        const start = new Date(dateMatch[1]);
        numDays = Math.max(1, Math.ceil((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      }

      // Parse Last-Event-ID for resume support (browser auto-sends this on reconnect)
      const lastEventDayIndex = parseLastEventId(req);
      if (lastEventDayIndex >= 0) {
        console.log(`[StreamAPI] Client reconnecting, last received day-${lastEventDayIndex}`);
      }

      // Check for existing partial itinerary (for resume)
      const existingDays: ItineraryDay[] = [];
      if (trip.itinerary && typeof trip.itinerary === 'object') {
        const itineraryObj = trip.itinerary as any;
        if (Array.isArray(itineraryObj.days) && itineraryObj.days.length > 0 && itineraryObj.days.length < numDays) {
          // Partial itinerary exists - can resume
          existingDays.push(...itineraryObj.days);
          console.log(`[StreamAPI] Found ${existingDays.length}/${numDays} existing days for trip ${tripId}`);
        } else if (Array.isArray(itineraryObj.days) && itineraryObj.days.length >= numDays) {
          // Full itinerary exists - just stream it back quickly
          console.log(`[StreamAPI] Full itinerary exists for trip ${tripId}, streaming cached version`);

          setupSSEHeaders(res);
          const sseCtx = createSSEContext(res);

          try {
            sendSSE(res, {
              event: "meta",
              data: {
                tripId,
                destination: trip.destination,
                totalDays: itineraryObj.days.length,
                startDate,
                cached: true
              }
            }, "meta-0");

            // Skip days that client already received (Last-Event-ID support)
            const startFromDay = lastEventDayIndex >= 0 ? lastEventDayIndex + 1 : 0;
            for (let i = startFromDay; i < itineraryObj.days.length; i++) {
              sendSSE(res, {
                event: "day",
                data: { dayIndex: i, day: itineraryObj.days[i], cached: true }
              }, `day-${i}`);
            }

            sendSSE(res, {
              event: "done",
              data: {
                tripId,
                totalDays: itineraryObj.days.length,
                totalActivities: itineraryObj.days.reduce((sum: number, d: any) => sum + (d.activities?.length || 0), 0),
                itinerary: itineraryObj,
                cached: true
              }
            }, "done-0");
          } finally {
            cleanupSSEContext(sseCtx);
          }

          return res.end();
        }
      }

      // ============ CONCURRENCY LOCK ============
      // Prevents duplicate generation when multiple tabs open the same trip
      const lockResult = await acquireItineraryLock(tripId);

      if (!lockResult.acquired) {
        // Another process is generating - stream cached days and notify client to wait
        console.log(`[StreamAPI] Lock denied for trip ${tripId}: ${lockResult.message}`);

        setupSSEHeaders(res);
        const sseCtx = createSSEContext(res);

        try {
          sendSSE(res, {
            event: "meta",
            data: {
              tripId,
              destination: trip.destination,
              totalDays: numDays,
              startDate,
              locked: true,
              lockedBy: lockResult.existingOwner?.slice(0, 8),
              message: "Another tab is generating this itinerary. Streaming cached days..."
            }
          }, "meta-0");

          // Stream any existing days
          if (existingDays.length > 0) {
            const startFromDay = lastEventDayIndex >= 0 ? lastEventDayIndex + 1 : 0;
            for (let i = startFromDay; i < existingDays.length; i++) {
              sendSSE(res, {
                event: "day",
                data: { dayIndex: i, day: existingDays[i], cached: true }
              }, `day-${i}`);
            }
          }

          // Send a "waiting" event - client should poll or reconnect later
          sendSSE(res, {
            event: "progress",
            data: {
              currentDay: existingDays.length,
              totalDays: numDays,
              percent: Math.round((existingDays.length / numDays) * 100),
              message: "Waiting for generation to complete in another tab...",
              waiting: true
            }
          }, `progress-wait`);

        } finally {
          cleanupSSEContext(sseCtx);
        }

        return res.end();
      }

      // Lock acquired - we own generation
      const lockOwner = lockResult.lockOwner!;
      let lockCtx: LockContext | null = null;
      let sseCtx: SSEContext | null = null;

      // Create metrics for observability
      const metrics: StreamMetrics = createStreamMetrics(tripId, trip.destination, lockOwner);
      metrics.ip = req.ip || req.socket?.remoteAddress || 'unknown';
      metrics.userAgent = req.headers['user-agent']?.slice(0, 100);
      // Note: lockWaitMs would be set if we tracked time before lock acquisition
      // For simplicity, we start metrics after lock, so lockWaitMs stays 0

      try {
        lockCtx = createLockContext(tripId, lockOwner);

        // Build streaming input
        const streamInput: StreamingItineraryInput = {
          tripId,
          destination: trip.destination,
          startDate,
          numDays,
          travelStyle: trip.travelStyle || 'standard',
          budget: trip.budget,
          currency: trip.currency || 'USD',
          groupSize: trip.groupSize || 2,
          passport: trip.passport,
          origin: trip.origin ?? undefined
        };

        console.log(`[StreamAPI] Starting streaming generation for trip ${tripId}: ${numDays} days in ${trip.destination} (lock: ${lockOwner.slice(0, 8)})`);

        // Setup SSE stream with heartbeat support
        setupSSEHeaders(res);
        sseCtx = createSSEContext(res);

        // Cleanup heartbeat and lock on abort
        abortController.abort = (() => {
          const originalAbort = abortController.abort;
          return () => {
            if (sseCtx) cleanupSSEContext(sseCtx);
            if (lockCtx) cleanupLockContext(lockCtx);
            // Release lock as 'idle' since generation was interrupted
            releaseItineraryLock(tripId, lockOwner, "idle").catch(e =>
              console.error(`[StreamAPI] Failed to release lock on abort:`, e)
            );
            originalAbort();
          };
        })();

        // Callback to persist each day to DB
        const onDayComplete = async (day: ItineraryDay, allDays: ItineraryDay[]) => {
          try {
            // Update trip with partial itinerary - cast as any since schema expects Json
            await storage.updateTrip(tripId, {
              status: allDays.length >= numDays ? 'complete' : 'generating'
            } as any);
            // Also update itinerary separately
            await storage.updateTripItinerary(tripId, { days: allDays });
          } catch (e) {
            console.error(`[StreamAPI] Failed to persist day ${day.day}:`, e);
          }
        };

        // Start streaming (resume if partial exists) with abort controller and metrics
        if (existingDays.length > 0) {
          await resumeItineraryStream(res, openai!, aiModel, streamInput, existingDays, abortController, onDayComplete, metrics);
        } else {
          await streamItineraryGeneration(res, openai!, aiModel, streamInput, abortController, onDayComplete, metrics);
        }

        // Check if aborted before marking complete
        if (abortController.aborted) {
          console.log(`[StreamAPI] Generation aborted for trip ${tripId}, skipping completion update`);
          return;
        }

        // Mark trip as complete and release lock
        await storage.updateTrip(tripId, { status: 'complete' });
        await releaseItineraryLock(tripId, lockOwner, "complete");

        res.end();

      } catch (error) {
        console.error('[StreamAPI] Generation error:', error);

        // Update metrics for error case
        metrics.status = "error";

        // Release lock as error
        await releaseItineraryLock(tripId, lockOwner, "error").catch(e =>
          console.error(`[StreamAPI] Failed to release lock on error:`, e)
        );

        // If headers not sent yet, send JSON error
        if (!res.headersSent) {
          return res.status(500).json({ error: 'Streaming generation failed' });
        }

        // If already streaming, send error event
        sendSSE(res, {
          event: "error",
          data: { message: 'Generation failed', recoverable: false }
        }, "error-0");
        res.end();

      } finally {
        // Log stream summary for observability (one structured log per stream)
        logStreamSummary(metrics);

        // Cleanup SSE and lock contexts
        if (sseCtx) cleanupSSEContext(sseCtx);
        if (lockCtx) cleanupLockContext(lockCtx);
      }

    } catch (error) {
      // This catches errors before lock was acquired (trip fetch, etc.)
      console.error('[StreamAPI] Error:', error);

      if (!res.headersSent) {
        return res.status(500).json({ error: 'Streaming generation failed' });
      }
      res.end();
    }
  });

  // ============ DYNAMIC DESTINATION IMAGE API ============
  // AI-powered: Returns image URL with AI-suggested search terms for the destination
  app.get('/api/destination-image', async (req, res) => {
    try {
      const destination = req.query.destination as string;
      if (!destination) {
        return res.status(400).json({ error: 'destination parameter required' });
      }

      console.log(`[API] AI fetching image for destination: ${destination}`);
      const result = await aiGetDestinationImage(destination);
      console.log(`[API] AI suggested: "${result.landmark}" → ${result.searchTerm}`);
      res.json(result);
    } catch (error) {
      console.error('[API] Destination image error:', error);
      res.json({ imageUrl: null, searchTerm: '', landmark: '', source: 'fallback' });
    }
  });

  // Get just the category for a destination (faster, for fallback images)
  app.get('/api/destination-category', async (req, res) => {
    try {
      const destination = req.query.destination as string;
      if (!destination) {
        return res.status(400).json({ error: 'destination parameter required' });
      }

      console.log(`[API] Categorizing destination: ${destination}`);
      const result = await aiGetDestinationCategory(destination);
      res.json(result);
    } catch (error) {
      console.error('[API] Destination category error:', error);
      res.json({ category: 'default', source: 'fallback' });
    }
  });

  // ============ FEASIBILITY ANALYTICS ENDPOINT ============
  // View decision-quality metrics (for validation/debugging)
  app.get('/api/analytics/feasibility', async (_req, res) => {
    try {
      const summary = getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      console.error('[API] Analytics error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  });

  // ============ RATE LIMIT METRICS ENDPOINT ============
  // View current rate limiting status (admin-only in production)
  app.get('/api/analytics/rate-limits', requireAdminToken, async (_req, res) => {
    try {
      const metrics = getRateLimitMetrics();
      res.json({
        timestamp: new Date().toISOString(),
        ...metrics,
      });
    } catch (error) {
      console.error('[API] Rate limit metrics error:', error);
      res.status(500).json({ error: 'Failed to get rate limit metrics' });
    }
  });

  // ============ TRIP EVENTS ANALYTICS ============
  // Generic trip page events for funnel analysis

  interface TripEvent {
    event: string;
    ts: string; // ISO
    tripId: number;
    page: string;
    // V2 fields for session/flow tracking
    sessionId?: string;
    flowId?: string;
    entry?: {
      referrer?: string;
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      entryPoint?: string;
      device?: string;
      locale?: string;
      timezone?: string;
    };
    context?: {
      passport?: string;
      destination?: string;
      visaType?: string;
      certaintyScore?: number;
      isCurated?: boolean;
      travelStyle?: string;
      groupSize?: number;
    };
    data?: Record<string, any>;
  }

  // In-memory store for trip events (use database JSONB in production)
  const tripEvents: TripEvent[] = [];
  const MAX_TRIP_EVENTS = 50_000;

  // Entry metadata schema
  const entrySchema = z.object({
    referrer: z.string().optional(),
    utmSource: z.string().optional(),
    utmMedium: z.string().optional(),
    utmCampaign: z.string().optional(),
    entryPoint: z.string().optional(),
    device: z.string().optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
  }).optional();

  const tripEventSchema = z.object({
    event: z.string().min(1),
    ts: z.string().optional(),
    tripId: z.number(),
    page: z.string().min(1),
    sessionId: z.string().optional(),
    flowId: z.string().optional(),
    entry: entrySchema,
    context: z
      .object({
        passport: z.string().optional(),
        destination: z.string().optional(),
        visaType: z.string().optional(),
        certaintyScore: z.number().optional(),
        isCurated: z.boolean().optional(),
        travelStyle: z.string().optional(),
        groupSize: z.number().optional(),
      })
      .optional(),
    data: z.record(z.any()).optional(),
  });

  // POST /api/analytics/trip-events
  app.post("/api/analytics/trip-events", async (req, res) => {
    const parsed = tripEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(200).json({ success: false, error: parsed.error.flatten() });
    }

    const body = parsed.data;

    const evt: TripEvent = {
      event: body.event,
      ts: body.ts || new Date().toISOString(),
      tripId: body.tripId,
      page: body.page,
      sessionId: body.sessionId,
      flowId: body.flowId,
      entry: body.entry,
      context: body.context || {},
      data: body.data || {},
    };

    tripEvents.push(evt);

    if (tripEvents.length > MAX_TRIP_EVENTS) {
      tripEvents.splice(0, tripEvents.length - MAX_TRIP_EVENTS);
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[TripEvent]", evt.event, {
        tripId: evt.tripId,
        page: evt.page,
        flowId: evt.flowId,
        destination: evt.context?.destination,
        entryPoint: evt.entry?.entryPoint,
      });
    }

    return res.json({ success: true });
  });

  // GET /api/analytics/trip-events
  app.get("/api/analytics/trip-events", async (req, res) => {
    const {
      limit,
      event,
      page,
      tripId,
      flowId,
      sessionId,
      since,
      until,
      includeRecent,
    } = req.query as Record<string, string | undefined>;

    const parsedLimit = Math.max(1, Math.min(Number(limit || 200), 2000));
    const parsedTripId = tripId ? Number(tripId) : undefined;

    const sinceMs = since ? Date.parse(since) : undefined;
    const untilMs = until ? Date.parse(until) : undefined;

    let filtered = tripEvents;

    if (event) filtered = filtered.filter((e) => e.event === event);
    if (page) filtered = filtered.filter((e) => e.page === page);
    if (flowId) filtered = filtered.filter((e) => e.flowId === flowId);
    if (sessionId) filtered = filtered.filter((e) => e.sessionId === sessionId);
    if (parsedTripId && !Number.isNaN(parsedTripId)) {
      filtered = filtered.filter((e) => e.tripId === parsedTripId);
    }

    if (sinceMs && !Number.isNaN(sinceMs)) {
      filtered = filtered.filter((e) => Date.parse(e.ts) >= sinceMs);
    }
    if (untilMs && !Number.isNaN(untilMs)) {
      filtered = filtered.filter((e) => Date.parse(e.ts) <= untilMs);
    }

    // Simple aggregations
    const byEvent: Record<string, number> = {};
    const byPage: Record<string, number> = {};
    const byDestination: Record<string, number> = {};
    const byEntryPoint: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    const byUtmSource: Record<string, number> = {};

    for (const e of filtered) {
      byEvent[e.event] = (byEvent[e.event] || 0) + 1;
      byPage[e.page] = (byPage[e.page] || 0) + 1;
      const dest = e.context?.destination;
      if (dest) byDestination[dest] = (byDestination[dest] || 0) + 1;
      const entry = e.entry?.entryPoint || 'unknown';
      byEntryPoint[entry] = (byEntryPoint[entry] || 0) + 1;
      const device = e.entry?.device || 'unknown';
      byDevice[device] = (byDevice[device] || 0) + 1;
      const utm = e.entry?.utmSource || 'organic';
      byUtmSource[utm] = (byUtmSource[utm] || 0) + 1;
    }

    // Funnel: generate_started -> generate_completed (by flowId for accurate tracking)
    const startedFlows = new Set<string>();
    const completedFlows = new Set<string>();
    const flowTimestamps: Record<string, { started?: number; completed?: number }> = {};

    for (const e of filtered) {
      const flowKey = e.flowId || `trip-${e.tripId}`;
      if (e.event === "itinerary_generate_started") {
        startedFlows.add(flowKey);
        if (!flowTimestamps[flowKey]) flowTimestamps[flowKey] = {};
        flowTimestamps[flowKey].started = Date.parse(e.ts);
      }
      if (e.event === "itinerary_generate_completed") {
        completedFlows.add(flowKey);
        if (!flowTimestamps[flowKey]) flowTimestamps[flowKey] = {};
        flowTimestamps[flowKey].completed = Date.parse(e.ts);
      }
    }

    // Calculate time to value (generate started -> completed)
    const completionTimes: number[] = [];
    for (const flow of Object.values(flowTimestamps)) {
      if (flow.started && flow.completed) {
        completionTimes.push(flow.completed - flow.started);
      }
    }
    completionTimes.sort((a, b) => a - b);

    const median = completionTimes.length > 0
      ? completionTimes[Math.floor(completionTimes.length / 2)]
      : null;
    const p90 = completionTimes.length > 0
      ? completionTimes[Math.floor(completionTimes.length * 0.9)]
      : null;

    // Funnel by entry point
    const funnelByEntry: Record<string, { started: number; completed: number; rate: string }> = {};
    for (const e of filtered) {
      const entry = e.entry?.entryPoint || 'unknown';
      if (!funnelByEntry[entry]) {
        funnelByEntry[entry] = { started: 0, completed: 0, rate: '0%' };
      }
      const flowKey = e.flowId || `trip-${e.tripId}`;
      if (e.event === "itinerary_generate_started") {
        funnelByEntry[entry].started++;
      }
      if (e.event === "itinerary_generate_completed") {
        funnelByEntry[entry].completed++;
      }
    }
    // Calculate rates
    for (const entry of Object.keys(funnelByEntry)) {
      const { started, completed } = funnelByEntry[entry];
      funnelByEntry[entry].rate = started > 0
        ? `${((completed / started) * 100).toFixed(1)}%`
        : '0%';
    }

    const funnel = {
      startedFlows: startedFlows.size,
      completedFlows: completedFlows.size,
      completionRate:
        startedFlows.size > 0
          ? `${((completedFlows.size / startedFlows.size) * 100).toFixed(1)}%`
          : "0.0%",
    };

    const timeToValue = {
      samplesCount: completionTimes.length,
      medianMs: median,
      medianFormatted: median ? `${(median / 1000).toFixed(1)}s` : null,
      p90Ms: p90,
      p90Formatted: p90 ? `${(p90 / 1000).toFixed(1)}s` : null,
    };

    const include = includeRecent !== "false";
    const recent = include ? filtered.slice(-parsedLimit).reverse() : [];

    return res.json({
      success: true,
      totalStored: tripEvents.length,
      totalMatched: filtered.length,
      aggregates: {
        byEvent,
        byPage,
        byDestination,
        byEntryPoint,
        byDevice,
        byUtmSource,
      },
      funnel,
      funnelByEntry,
      timeToValue,
      events: recent,
    });
  });

  // ============ AFFILIATE CLICK TRACKING ============
  // Track affiliate link clicks for analytics and revenue reporting
  const affiliateClickSchema = z.object({
    tripId: z.number(),
    linkType: z.enum(['flight', 'hotel', 'activity']),
    provider: z.string(),
    url: z.string().optional(),
  });

  // In-memory store for affiliate clicks (use database in production)
  const affiliateClicks: Array<{
    tripId: number;
    linkType: string;
    provider: string;
    timestamp: Date;
    url?: string;
  }> = [];

  app.post('/api/analytics/affiliate-click', async (req, res) => {
    try {
      const data = affiliateClickSchema.parse(req.body);

      // Store click
      affiliateClicks.push({
        ...data,
        timestamp: new Date(),
      });

      // Log for development
      console.log(`[Affiliate Click] Trip ${data.tripId} - ${data.linkType} - ${data.provider}`);

      res.json({ success: true });
    } catch (err) {
      console.error('Affiliate click tracking error:', err);
      res.status(400).json({ error: 'Invalid click data' });
    }
  });

  // Get affiliate click stats (for admin dashboard)
  app.get('/api/analytics/affiliate-stats', async (req, res) => {
    // Group by provider
    const stats = affiliateClicks.reduce((acc, click) => {
      const key = `${click.linkType}-${click.provider}`;
      if (!acc[key]) {
        acc[key] = { linkType: click.linkType, provider: click.provider, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {} as Record<string, { linkType: string; provider: string; count: number }>);

    res.json({
      totalClicks: affiliateClicks.length,
      byProvider: Object.values(stats),
      recentClicks: affiliateClicks.slice(-10).reverse(),
    });
  });

  // ============================================================================
  // ALTERNATIVE CLICK TRACKING
  // ============================================================================
  // Tracks when users click alternative destinations after hitting a HARD_BLOCKER
  // This data informs which corridors to curate next

  const alternativeClicks: Array<{
    tripId?: number;
    passport: string;
    blockedDestination: string;
    alternativeDestination: string;
    alternativeCity: string;
    visaType: string;
    visaStatus: string;
    confidence: string;
    timestamp: Date;
  }> = [];

  // Deduplication: Only count first click per (tripId + alternativeDestination)
  // Key format: "tripId:alternativeDestination" or "passport:blocked:alt" if no tripId
  const seenClicks = new Set<string>();

  app.post('/api/analytics/alternative-click', async (req, res) => {
    try {
      const { tripId, passport, blockedDestination, alternativeDestination, alternativeCity, visaType, visaStatus, confidence } = req.body;

      if (!passport || !blockedDestination || !alternativeDestination) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Deduplicate: Only first click per trip+destination counts
      const dedupeKey = tripId
        ? `click:${tripId}:${alternativeDestination}`
        : `click:${passport}:${blockedDestination}:${alternativeDestination}`;

      if (seenClicks.has(dedupeKey)) {
        console.log(`[Analytics] Duplicate click ignored: ${dedupeKey}`);
        return res.json({ success: true, deduplicated: true });
      }

      seenClicks.add(dedupeKey);

      // Store click
      alternativeClicks.push({
        tripId,
        passport,
        blockedDestination,
        alternativeDestination,
        alternativeCity: alternativeCity || '',
        visaType: visaType || '',
        visaStatus: visaStatus || '',
        confidence: confidence || '',
        timestamp: new Date(),
      });

      // Log for development/analytics
      console.log(`[Analytics] alternative_clicked`, {
        tripId,
        passport,
        blockedDestination,
        alternativeDestination,
        visaType,
        confidence,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Alternative click tracking error:', err);
      res.status(400).json({ error: 'Invalid click data' });
    }
  });

  // Get alternative click stats (for admin/analytics dashboard)
  app.get('/api/analytics/alternative-stats', async (_req, res) => {
    // Group by alternative destination
    const byDestination = alternativeClicks.reduce((acc, click) => {
      const key = click.alternativeDestination;
      if (!acc[key]) {
        acc[key] = { destination: key, count: 0, visaTypes: {} };
      }
      acc[key].count++;
      acc[key].visaTypes[click.visaType] = (acc[key].visaTypes[click.visaType] || 0) + 1;
      return acc;
    }, {} as Record<string, { destination: string; count: number; visaTypes: Record<string, number> }>);

    // Group by blocked destination (shows which corridors need curation)
    const byBlockedCorridor = alternativeClicks.reduce((acc, click) => {
      const key = `${click.passport}-${click.blockedDestination}`;
      if (!acc[key]) {
        acc[key] = { passport: click.passport, blocked: click.blockedDestination, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {} as Record<string, { passport: string; blocked: string; count: number }>);

    res.json({
      totalClicks: alternativeClicks.length,
      byDestination: Object.values(byDestination).sort((a, b) => b.count - a.count),
      byBlockedCorridor: Object.values(byBlockedCorridor).sort((a, b) => b.count - a.count),
      recentClicks: alternativeClicks.slice(-10).reverse(),
    });
  });

  // ============================================================================
  // IMPRESSION TRACKING (alternatives shown, not clicked)
  // ============================================================================
  // Needed for de-prioritization rule: "≥10 impressions but ≤1 click → downgrade"
  //
  // IMPORTANT: An impression = unique alternative destination visibly rendered in a single feasibility evaluation
  // One impression per (tripId + alternativeDestination), NOT per render

  const alternativeImpressions: Array<{
    tripId?: number;
    passport: string;
    blockedDestination: string;
    alternativesShown: string[];  // Array of destination codes shown
    timestamp: Date;
  }> = [];

  // Deduplication: Only count first impression per (tripId + alternativeDestination)
  const seenImpressions = new Set<string>();

  app.post('/api/analytics/alternative-impression', async (req, res) => {
    try {
      const { tripId, passport, blockedDestination, alternativesShown } = req.body;

      if (!passport || !blockedDestination || !alternativesShown) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const alternatives = Array.isArray(alternativesShown) ? alternativesShown : [alternativesShown];

      // Deduplicate per destination shown
      // Only count impressions for alternatives not yet seen for this trip
      const newAlternatives: string[] = [];

      for (const alt of alternatives) {
        const dedupeKey = tripId
          ? `imp:${tripId}:${alt}`
          : `imp:${passport}:${blockedDestination}:${alt}`;

        if (!seenImpressions.has(dedupeKey)) {
          seenImpressions.add(dedupeKey);
          newAlternatives.push(alt);
        }
      }

      // Only record if there are new (non-duplicate) impressions
      if (newAlternatives.length > 0) {
        alternativeImpressions.push({
          tripId,
          passport,
          blockedDestination,
          alternativesShown: newAlternatives,
          timestamp: new Date(),
        });

        console.log(`[Analytics] alternative_impression`, {
          tripId,
          passport,
          blockedDestination,
          newAlternatives,
          deduplicatedCount: alternatives.length - newAlternatives.length,
        });
      } else {
        console.log(`[Analytics] All impressions deduplicated for trip ${tripId || passport}`);
      }

      res.json({ success: true, newImpressions: newAlternatives.length });
    } catch (err) {
      console.error('Alternative impression tracking error:', err);
      res.status(400).json({ error: 'Invalid impression data' });
    }
  });

  // ============================================================================
  // DECISION RULES ENGINE
  // ============================================================================
  // Weekly thresholds that turn analytics into product decisions

  const DECISION_RULES = {
    // A. Curate alternatives based on retention signal
    autoCurate: {
      minClicks: 5,              // ≥5 clicks
      minUniqueCorridors: 2,     // across ≥2 unique blocked corridors
      windowDays: 7,             // within 7 days
    },
    // B. Promote blocked corridors to priority curation
    priorityCorridor: {
      minOccurrences: 10,        // ≥10 times
      windowDays: 14,            // in 14 days
    },
    // C. De-prioritize weak alternatives
    deprioritize: {
      minImpressions: 10,        // ≥10 impressions
      maxClicks: 1,              // but ≤1 click
      windowDays: 14,
    },
  };

  // Apply decision rules and return curation decisions
  app.get('/api/analytics/curation-decisions', async (_req, res) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Filter data within time windows
    const recentClicks = alternativeClicks.filter(c => c.timestamp >= sevenDaysAgo);
    const twoWeekClicks = alternativeClicks.filter(c => c.timestamp >= fourteenDaysAgo);
    const twoWeekImpressions = alternativeImpressions.filter(i => i.timestamp >= fourteenDaysAgo);

    // === RULE A: Auto-curate destinations ===
    // Group clicks by destination, count unique corridors
    const destinationStats: Record<string, {
      clicks: number;
      uniqueCorridors: Set<string>;
      visaTypes: Record<string, number>;
    }> = {};

    for (const click of recentClicks) {
      const dest = click.alternativeDestination;
      if (!destinationStats[dest]) {
        destinationStats[dest] = { clicks: 0, uniqueCorridors: new Set(), visaTypes: {} };
      }
      destinationStats[dest].clicks++;
      destinationStats[dest].uniqueCorridors.add(`${click.passport}-${click.blockedDestination}`);
      destinationStats[dest].visaTypes[click.visaType] = (destinationStats[dest].visaTypes[click.visaType] || 0) + 1;
    }

    const autoCurateDestinations = Object.entries(destinationStats)
      .filter(([_, stats]) =>
        stats.clicks >= DECISION_RULES.autoCurate.minClicks &&
        stats.uniqueCorridors.size >= DECISION_RULES.autoCurate.minUniqueCorridors
      )
      .map(([destination, stats]) => ({
        destination,
        clicks: stats.clicks,
        uniqueCorridors: stats.uniqueCorridors.size,
        visaTypes: stats.visaTypes,
        decision: 'auto_curate' as const,
        reason: `${stats.clicks} clicks across ${stats.uniqueCorridors.size} corridors in 7 days`,
      }));

    // === RULE B: Priority corridors ===
    const corridorCounts: Record<string, { passport: string; blocked: string; count: number }> = {};

    for (const click of twoWeekClicks) {
      const key = `${click.passport}-${click.blockedDestination}`;
      if (!corridorCounts[key]) {
        corridorCounts[key] = { passport: click.passport, blocked: click.blockedDestination, count: 0 };
      }
      corridorCounts[key].count++;
    }

    const priorityCorridors = Object.values(corridorCounts)
      .filter(c => c.count >= DECISION_RULES.priorityCorridor.minOccurrences)
      .map(c => ({
        ...c,
        decision: 'priority_curation' as const,
        reason: `${c.count} blocked trips in 14 days`,
      }));

    // === RULE C: De-prioritize weak alternatives ===
    // Count impressions per destination
    const impressionCounts: Record<string, number> = {};
    for (const imp of twoWeekImpressions) {
      for (const dest of imp.alternativesShown) {
        impressionCounts[dest] = (impressionCounts[dest] || 0) + 1;
      }
    }

    // Count clicks per destination (14-day window)
    const clickCounts: Record<string, number> = {};
    for (const click of twoWeekClicks) {
      clickCounts[click.alternativeDestination] = (clickCounts[click.alternativeDestination] || 0) + 1;
    }

    const deprioritizeDestinations = Object.entries(impressionCounts)
      .filter(([dest, impressions]) => {
        const clicks = clickCounts[dest] || 0;
        return impressions >= DECISION_RULES.deprioritize.minImpressions &&
               clicks <= DECISION_RULES.deprioritize.maxClicks;
      })
      .map(([destination, impressions]) => ({
        destination,
        impressions,
        clicks: clickCounts[destination] || 0,
        ctr: ((clickCounts[destination] || 0) / impressions * 100).toFixed(1) + '%',
        decision: 'deprioritize' as const,
        reason: `${impressions} impressions but only ${clickCounts[destination] || 0} clicks (silent rejection)`,
      }));

    // === Output curation decisions ===
    const decisions = {
      generatedAt: now.toISOString(),
      windowStart: {
        sevenDay: sevenDaysAgo.toISOString(),
        fourteenDay: fourteenDaysAgo.toISOString(),
      },
      rules: DECISION_RULES,
      summary: {
        totalClicks: alternativeClicks.length,
        totalImpressions: alternativeImpressions.length,
        decisionsCount: autoCurateDestinations.length + priorityCorridors.length + deprioritizeDestinations.length,
      },
      autoCurate: autoCurateDestinations,
      priorityCorridors,
      deprioritize: deprioritizeDestinations,
    };

    // Log decisions for weekly review
    console.log('[CurationDecisions]', JSON.stringify({
      timestamp: now.toISOString(),
      autoCurate: autoCurateDestinations.length,
      priorityCorridors: priorityCorridors.length,
      deprioritize: deprioritizeDestinations.length,
    }));

    res.json(decisions);
  });

  // ============================================================================
  // INTERNAL DASHBOARD - Only 3 numbers matter
  // ============================================================================

  app.get('/api/analytics/dashboard', async (_req, res) => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter to last 7 days
    const recentClicks = alternativeClicks.filter(c => c.timestamp >= sevenDaysAgo);
    const recentImpressions = alternativeImpressions.filter(i => i.timestamp >= sevenDaysAgo);

    // Count unique impressions (each destination shown counts as 1 impression)
    // This is the correct denominator for CTR
    let uniqueImpressionCount = 0;
    for (const imp of recentImpressions) {
      uniqueImpressionCount += imp.alternativesShown.length;
    }

    // Click count (already deduplicated at ingestion)
    const totalClickEvents = recentClicks.length;

    // CTR calculation with clamp to max 100%
    // Formula: clicks / impressions, clamped to [0, 100]
    let rawCTR = 0;
    if (uniqueImpressionCount > 0) {
      rawCTR = (totalClickEvents / uniqueImpressionCount) * 100;
    }
    const clampedCTR = Math.min(100, rawCTR);
    const overallCTR = clampedCTR.toFixed(1);

    // 2. Top 5 blocked corridors (where users are frustrated)
    const corridorCounts: Record<string, { passport: string; blocked: string; count: number }> = {};
    for (const click of recentClicks) {
      const key = `${click.passport}-${click.blockedDestination}`;
      if (!corridorCounts[key]) {
        corridorCounts[key] = { passport: click.passport, blocked: click.blockedDestination, count: 0 };
      }
      corridorCounts[key].count++;
    }
    const topBlockedCorridors = Object.values(corridorCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 3. Top retained alternatives (where users convert)
    const destCounts: Record<string, { destination: string; clicks: number; visaType: string }> = {};
    for (const click of recentClicks) {
      if (!destCounts[click.alternativeDestination]) {
        destCounts[click.alternativeDestination] = {
          destination: click.alternativeDestination,
          clicks: 0,
          visaType: click.visaType,
        };
      }
      destCounts[click.alternativeDestination].clicks++;
    }
    const topRetainedAlternatives = Object.values(destCounts)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 5);

    // Product health classification with minimum sample gate
    // IMPORTANT: Requires minimum 20 impressions before evaluating health
    // This prevents premature optimism with insufficient data
    const MIN_IMPRESSIONS_FOR_HEALTH = 20;
    let productHealth: 'insufficient_data' | 'critical' | 'needs_attention' | 'healthy';

    if (uniqueImpressionCount < MIN_IMPRESSIONS_FOR_HEALTH) {
      productHealth = 'insufficient_data';
    } else if (clampedCTR < 5) {
      productHealth = 'critical';
    } else if (clampedCTR < 10) {
      productHealth = 'needs_attention';
    } else {
      productHealth = 'healthy';
    }

    res.json({
      period: '7 days',
      generatedAt: now.toISOString(),

      // The 3 numbers that matter
      metrics: {
        blockedToAlternativeCTR: `${overallCTR}%`,
        impressions: uniqueImpressionCount,  // Unique impressions, not events
        clicks: totalClickEvents,
      },

      topBlockedCorridors,
      topRetainedAlternatives,

      // Health indicator with minimum sample gate
      productHealth,
      _healthNote: uniqueImpressionCount < MIN_IMPRESSIONS_FOR_HEALTH
        ? `Need ${MIN_IMPRESSIONS_FOR_HEALTH - uniqueImpressionCount} more impressions to evaluate health`
        : undefined,
    });
  });

  // Trip Planning Chat API - AI-powered conversational trip planning
  app.post('/api/chat/trip-planning', async (req, res) => {
    try {
      const { message, chatHistory, tripContext } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Build context for AI
      const destinations = tripContext?.destinations?.map((d: any) => `${d.city}, ${d.country}`).join(', ') || 'not specified';
      const travelStyle = tripContext?.travelStyle || 'comfort';
      const travelers = tripContext?.travelers || { adults: 1, children: 0, infants: 0 };
      const isRoadTrip = tripContext?.isRoadTrip || false;

      const systemPrompt = `You are VoyageAI, a friendly and knowledgeable AI travel assistant. Help users plan their perfect trip by:
1. Understanding their travel preferences (destinations, dates, budget, travel style)
2. Suggesting destinations based on their interests
3. Providing helpful travel tips and recommendations
4. Asking clarifying questions to better understand their needs

Current trip context:
- Destinations: ${destinations}
- Travel style: ${travelStyle}
- Travelers: ${travelers.adults} adults, ${travelers.children} children, ${travelers.infants} infants
- Road trip: ${isRoadTrip ? 'Yes' : 'No'}

Keep responses concise, friendly, and helpful. Ask follow-up questions to gather more details about their trip.`;

      // Call AI for response using the OpenAI client
      if (!openai) {
        return res.status(500).json({ error: 'AI service not initialized' });
      }

      const completion = await openai.chat.completions.create({
        model: aiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(chatHistory || []).map((msg: any) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })),
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

      // Generate contextual suggestions based on the conversation
      const suggestions = generateTripSuggestions(message, tripContext);

      res.json({
        response: aiResponse,
        suggestions,
      });
    } catch (error) {
      console.error('[Chat] Trip planning error:', error);
      res.status(500).json({
        error: 'Failed to process chat message',
        response: "I'm having trouble connecting right now. Let me help you with what I know! Tell me about your dream destination and I'll do my best to assist."
      });
    }
  });

  // Helper function to generate trip suggestions
  function generateTripSuggestions(message: string, context: any): string[] {
    const lower = message.toLowerCase();
    const hasDestination = context?.destinations?.length > 0;

    if (!hasDestination) {
      if (lower.includes('beach') || lower.includes('relax')) {
        return ['Bali, Indonesia', 'Maldives', 'Santorini, Greece'];
      }
      if (lower.includes('adventure') || lower.includes('hiking')) {
        return ['New Zealand', 'Switzerland', 'Patagonia'];
      }
      if (lower.includes('culture') || lower.includes('history')) {
        return ['Rome, Italy', 'Kyoto, Japan', 'Cairo, Egypt'];
      }
      if (lower.includes('food') || lower.includes('cuisine')) {
        return ['Tokyo, Japan', 'Bangkok, Thailand', 'Barcelona, Spain'];
      }
      return ['Tell me your budget', 'When do you want to travel?', 'Any specific interests?'];
    }

    if (!context?.specificDates && !context?.flexibleMonth) {
      return ["I'm flexible with dates", "Traveling next month", "Best time to visit?"];
    }

    return ['Add another destination', 'Set my budget', 'Create itinerary'];
  }

  // Seed Data
  const existingTrip = await storage.getTrip(1);
  if (!existingTrip) {
    await storage.createTrip({
      passport: "United States",
      destination: "Japan",
      dates: "2024-05-01 to 2024-05-14",
      budget: 3000,
      groupSize: 1,
      adults: 1,
      children: 0,
      infants: 0,
    });
    console.log("Seeded database with initial trip");
  }

  return httpServer;
}
