import type { Express } from "express";
import { createServer, type Server } from "http";
import cookieParser from "cookie-parser";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { FeasibilityReport } from "@shared/schema";
import { searchFlights, type FlightResult } from "./services/flightApi";
import { searchHotels, type HotelResult } from "./services/hotelApi";
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

function getDestinationCoords(destination: string): { center: { lat: number; lng: number }; attractions: Array<{ name: string; lat: number; lng: number }> } {
  const destLower = destination.toLowerCase();
  for (const [key, data] of Object.entries(DESTINATION_COORDINATES)) {
    if (destLower.includes(key)) {
      return { center: { lat: data.lat, lng: data.lng }, attractions: data.attractions };
    }
  }
  // Default: return null coordinates that will be filtered out
  return { center: { lat: 0, lng: 0 }, attractions: [] };
}

// Helper to parse date range string to start/end dates
function parseDateRange(dateStr: string): { startDate: string; endDate: string } | null {
  try {
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
    return null;
  } catch {
    return null;
  }
}

// Initialize AI client
let openai: OpenAI | null = null;
let aiModel = "gpt-4o";

if (process.env.DEEPSEEK_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });
  aiModel = "deepseek-chat";
  console.log("AI Provider: Deepseek");
} else if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  console.log("AI Provider: OpenAI");
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

// Convert USD to target currency (async version)
async function convertFromUSDAsync(amountUSD: number, targetCurrency: string): Promise<number> {
  const rates = await getExchangeRates();
  const rate = rates[targetCurrency] || FALLBACK_RATES[targetCurrency] || 1;
  return Math.round(amountUSD * rate);
}

// Sync version using cached rates (for use in loops)
function convertFromUSD(amountUSD: number, targetCurrency: string, rates: Record<string, number>): number {
  const rate = rates[targetCurrency] || FALLBACK_RATES[targetCurrency] || 1;
  return Math.round(amountUSD * rate);
}

// Convert from local currency to USD
function convertToUSD(amount: number, sourceCurrency: string, rates: Record<string, number>): number {
  if (sourceCurrency === 'USD') return amount;
  const rate = rates[sourceCurrency] || FALLBACK_RATES[sourceCurrency] || 1;
  return Math.round(amount / rate);
}

// ============ SMART TRANSPORT SYSTEM ============
// Industry-standard transport recommendations based on regions, countries, and travel patterns

// Country to Region mapping (covers all countries worldwide)
const COUNTRY_REGIONS: Record<string, string> = {
  // South Asia
  'india': 'south_asia', 'pakistan': 'south_asia', 'bangladesh': 'south_asia', 'sri lanka': 'south_asia',
  'nepal': 'south_asia', 'bhutan': 'south_asia', 'maldives': 'south_asia', 'afghanistan': 'south_asia',
  // Southeast Asia
  'thailand': 'southeast_asia', 'vietnam': 'southeast_asia', 'indonesia': 'southeast_asia', 'malaysia': 'southeast_asia',
  'philippines': 'southeast_asia', 'singapore': 'southeast_asia', 'myanmar': 'southeast_asia', 'cambodia': 'southeast_asia',
  'laos': 'southeast_asia', 'brunei': 'southeast_asia', 'timor-leste': 'southeast_asia',
  // East Asia
  'japan': 'east_asia', 'china': 'east_asia', 'south korea': 'east_asia', 'korea': 'east_asia',
  'taiwan': 'east_asia', 'hong kong': 'east_asia', 'macau': 'east_asia', 'mongolia': 'east_asia',
  // Middle East
  'uae': 'middle_east', 'united arab emirates': 'middle_east', 'saudi arabia': 'middle_east', 'qatar': 'middle_east',
  'kuwait': 'middle_east', 'bahrain': 'middle_east', 'oman': 'middle_east', 'israel': 'middle_east',
  'jordan': 'middle_east', 'lebanon': 'middle_east', 'turkey': 'middle_east', 'iran': 'middle_east', 'iraq': 'middle_east',
  // Western Europe
  'uk': 'western_europe', 'united kingdom': 'western_europe', 'england': 'western_europe', 'scotland': 'western_europe',
  'france': 'western_europe', 'germany': 'western_europe', 'italy': 'western_europe', 'spain': 'western_europe',
  'portugal': 'western_europe', 'netherlands': 'western_europe', 'belgium': 'western_europe', 'switzerland': 'western_europe',
  'austria': 'western_europe', 'ireland': 'western_europe', 'luxembourg': 'western_europe', 'monaco': 'western_europe',
  // Northern Europe
  'sweden': 'northern_europe', 'norway': 'northern_europe', 'denmark': 'northern_europe', 'finland': 'northern_europe',
  'iceland': 'northern_europe', 'estonia': 'northern_europe', 'latvia': 'northern_europe', 'lithuania': 'northern_europe',
  // Eastern Europe
  'poland': 'eastern_europe', 'czech republic': 'eastern_europe', 'czechia': 'eastern_europe', 'hungary': 'eastern_europe',
  'romania': 'eastern_europe', 'bulgaria': 'eastern_europe', 'ukraine': 'eastern_europe', 'russia': 'eastern_europe',
  'greece': 'eastern_europe', 'croatia': 'eastern_europe', 'slovenia': 'eastern_europe', 'slovakia': 'eastern_europe',
  'serbia': 'eastern_europe', 'bosnia': 'eastern_europe', 'albania': 'eastern_europe', 'macedonia': 'eastern_europe',
  // North America
  'usa': 'north_america', 'united states': 'north_america', 'america': 'north_america',
  'canada': 'north_america', 'mexico': 'north_america',
  // Central America & Caribbean
  'costa rica': 'central_america', 'panama': 'central_america', 'guatemala': 'central_america', 'belize': 'central_america',
  'cuba': 'caribbean', 'jamaica': 'caribbean', 'bahamas': 'caribbean', 'dominican republic': 'caribbean',
  'puerto rico': 'caribbean', 'barbados': 'caribbean', 'trinidad': 'caribbean',
  // South America
  'brazil': 'south_america', 'argentina': 'south_america', 'chile': 'south_america', 'peru': 'south_america',
  'colombia': 'south_america', 'ecuador': 'south_america', 'bolivia': 'south_america', 'venezuela': 'south_america',
  'uruguay': 'south_america', 'paraguay': 'south_america',
  // Oceania
  'australia': 'oceania', 'new zealand': 'oceania', 'fiji': 'oceania', 'papua new guinea': 'oceania',
  // Africa
  'south africa': 'africa', 'egypt': 'africa', 'morocco': 'africa', 'kenya': 'africa', 'tanzania': 'africa',
  'nigeria': 'africa', 'ghana': 'africa', 'ethiopia': 'africa', 'tunisia': 'africa', 'mauritius': 'africa',
  'seychelles': 'africa', 'zimbabwe': 'africa', 'botswana': 'africa', 'namibia': 'africa',
};

// Regional transport characteristics (industry standard)
interface RegionalTransport {
  intraCityOptions: string[];
  intraCityNote: string;
  hasGoodRailNetwork: boolean;
  hasBudgetBuses: boolean;
  avgDomesticFlightCostUSD: number;
  trainCostPerKmUSD: number;
  busCostPerKmUSD: number;
  rideshareAvailable: boolean;
  rideshareApps: string[];
}

const REGIONAL_TRANSPORT: Record<string, RegionalTransport> = {
  'south_asia': {
    intraCityOptions: ['Metro/Subway', 'Auto-rickshaw/Tuk-tuk', 'Ola/Uber', 'Local bus', 'Local train', 'Cycle rickshaw'],
    intraCityNote: 'Auto-rickshaws are iconic and cheap. Ola/Uber widely available. Metro in major cities. Always negotiate or use meters.',
    hasGoodRailNetwork: true,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 80,
    trainCostPerKmUSD: 0.02,
    busCostPerKmUSD: 0.01,
    rideshareAvailable: true,
    rideshareApps: ['Ola', 'Uber', 'Rapido']
  },
  'southeast_asia': {
    intraCityOptions: ['Grab/Gojek', 'BTS/MRT Metro', 'Tuk-tuk/Tricycle', 'Motorbike taxi', 'Songthaew/Jeepney', 'Local bus'],
    intraCityNote: 'Grab app works across SE Asia. Motorbike taxis are fast and cheap. Negotiate prices for tuk-tuks. BTS/MRT excellent in Bangkok, Singapore, KL.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 60,
    trainCostPerKmUSD: 0.03,
    busCostPerKmUSD: 0.015,
    rideshareAvailable: true,
    rideshareApps: ['Grab', 'Gojek', 'Bolt']
  },
  'east_asia': {
    intraCityOptions: ['Metro/Subway', 'JR/Local trains', 'Bus', 'Taxi', 'DiDi/Kakao'],
    intraCityNote: 'World-class metro systems. Get IC cards (Suica, Octopus, T-money). JR Pass for Japan. Trains are punctual and clean.',
    hasGoodRailNetwork: true,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 120,
    trainCostPerKmUSD: 0.15,
    busCostPerKmUSD: 0.05,
    rideshareAvailable: true,
    rideshareApps: ['DiDi', 'Kakao T', 'Japan Taxi']
  },
  'middle_east': {
    intraCityOptions: ['Metro', 'Taxi', 'Uber/Careem', 'Bus', 'Water taxi'],
    intraCityNote: 'Modern metro in Dubai, Doha, Riyadh. Careem and Uber widely used. Taxis are metered and AC. Water taxis in coastal cities.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 100,
    trainCostPerKmUSD: 0.08,
    busCostPerKmUSD: 0.03,
    rideshareAvailable: true,
    rideshareApps: ['Careem', 'Uber', 'Bolt']
  },
  'western_europe': {
    intraCityOptions: ['Metro/Underground', 'Tram', 'Bus', 'Uber/Bolt', 'Bike rental', 'E-scooter'],
    intraCityNote: 'Excellent public transport. Get day passes for unlimited travel. Bike-friendly cities. High-speed trains between cities (TGV, Eurostar, ICE).',
    hasGoodRailNetwork: true,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 80,
    trainCostPerKmUSD: 0.12,
    busCostPerKmUSD: 0.06,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'Bolt', 'FREE NOW']
  },
  'northern_europe': {
    intraCityOptions: ['Metro/T-bana', 'Tram', 'Bus', 'Ferry', 'Bike rental', 'Taxi'],
    intraCityNote: 'Efficient public transport but expensive. Consider city passes. Ferries common in Scandinavia. Cycling infrastructure is excellent.',
    hasGoodRailNetwork: true,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 100,
    trainCostPerKmUSD: 0.15,
    busCostPerKmUSD: 0.08,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'Bolt', 'Yango']
  },
  'eastern_europe': {
    intraCityOptions: ['Metro', 'Tram', 'Bus', 'Taxi', 'Bolt/Uber', 'Marshrutka'],
    intraCityNote: 'Affordable public transport. Metro in major cities. Marshrutkas (shared minibuses) common. Bolt often cheaper than Uber.',
    hasGoodRailNetwork: true,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 60,
    trainCostPerKmUSD: 0.05,
    busCostPerKmUSD: 0.02,
    rideshareAvailable: true,
    rideshareApps: ['Bolt', 'Uber', 'Yandex']
  },
  'north_america': {
    intraCityOptions: ['Uber/Lyft', 'Subway/Metro', 'Bus', 'Taxi', 'Rental car', 'E-scooter'],
    intraCityNote: 'Rideshare is dominant. Public transit varies by city (excellent in NYC, limited elsewhere). Rental car often needed outside major cities.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 150,
    trainCostPerKmUSD: 0.20,
    busCostPerKmUSD: 0.08,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'Lyft']
  },
  'south_america': {
    intraCityOptions: ['Metro/Subte', 'Bus/Colectivo', 'Uber/Cabify', 'Taxi', 'Remis'],
    intraCityNote: 'Metro in major cities (Buenos Aires, Santiago, São Paulo). Buses are extensive. Uber/Cabify widely used. Negotiate taxi fares.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 100,
    trainCostPerKmUSD: 0.04,
    busCostPerKmUSD: 0.02,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'Cabify', '99']
  },
  'central_america': {
    intraCityOptions: ['Taxi', 'Uber', 'Chicken bus', 'Shuttle', 'Tuk-tuk'],
    intraCityNote: 'Chicken buses are cheap but crowded. Tourist shuttles between cities. Uber in capitals. Always negotiate taxi fares.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 80,
    trainCostPerKmUSD: 0.05,
    busCostPerKmUSD: 0.02,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'InDriver']
  },
  'caribbean': {
    intraCityOptions: ['Taxi', 'Local bus', 'Rental car', 'Water taxi', 'Scooter rental'],
    intraCityNote: 'Taxis are primary transport. Negotiate fares beforehand. Rental cars give freedom. Water taxis between islands.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: false,
    avgDomesticFlightCostUSD: 120,
    trainCostPerKmUSD: 0,
    busCostPerKmUSD: 0.03,
    rideshareAvailable: false,
    rideshareApps: []
  },
  'oceania': {
    intraCityOptions: ['Train', 'Bus', 'Uber/Ola', 'Tram', 'Ferry', 'Rental car'],
    intraCityNote: 'Good public transport in cities. Opal/Myki cards for travel. Rental car essential for road trips. Ferries for harbor cities.',
    hasGoodRailNetwork: true,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 120,
    trainCostPerKmUSD: 0.10,
    busCostPerKmUSD: 0.05,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'Ola', 'DiDi']
  },
  'africa': {
    intraCityOptions: ['Taxi', 'Uber/Bolt', 'Minibus/Matatu', 'Bus', 'Boda-boda/Okada'],
    intraCityNote: 'Uber/Bolt in major cities. Minibuses are cheapest. Motorbike taxis (boda-boda) for traffic. Always negotiate fares.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 150,
    trainCostPerKmUSD: 0.03,
    busCostPerKmUSD: 0.015,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'Bolt', 'SafeBoda']
  },
  'default': {
    intraCityOptions: ['Taxi', 'Rideshare app', 'Public bus', 'Metro (if available)', 'Rental car'],
    intraCityNote: 'Check local rideshare apps. Public transport is usually cheapest. Negotiate taxi fares where meters are not used.',
    hasGoodRailNetwork: false,
    hasBudgetBuses: true,
    avgDomesticFlightCostUSD: 100,
    trainCostPerKmUSD: 0.05,
    busCostPerKmUSD: 0.03,
    rideshareAvailable: true,
    rideshareApps: ['Uber', 'Local apps']
  }
};

// Extract country from location string (handles "City, Country" format)
function extractCountry(location: string): string {
  const parts = location.split(',').map(p => p.trim().toLowerCase());
  // Try last part first (usually country)
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (COUNTRY_REGIONS[part]) return part;
    // Check for partial matches
    for (const country of Object.keys(COUNTRY_REGIONS)) {
      if (part.includes(country) || country.includes(part)) return country;
    }
  }
  return parts[parts.length - 1] || 'unknown';
}

// Get region for a location
function getRegion(location: string): string {
  const country = extractCountry(location);
  return COUNTRY_REGIONS[country] || 'default';
}

// Check if two locations are in the same country
function isSameCountry(origin: string, destination: string): boolean {
  return extractCountry(origin) === extractCountry(destination);
}

// Check if two locations are in the same region
function isSameRegion(origin: string, destination: string): boolean {
  return getRegion(origin) === getRegion(destination);
}

// Get regional transport info
function getRegionalTransport(location: string): RegionalTransport {
  const region = getRegion(location);
  return REGIONAL_TRANSPORT[region] || REGIONAL_TRANSPORT['default'];
}

// Inter-city transport options based on distance and region
interface TransportOption {
  mode: string;
  priceRangeUSD: { budget: number; standard: number; luxury: number };
  durationHours: number;
  recommended: boolean;
  tags: ('cheapest' | 'fastest' | 'best_value' | 'most_comfortable')[];
  note: string;
}

interface TransportRecommendation {
  primaryMode: string;
  allOptions: TransportOption[];
  isDomestic: boolean;
  isSameRegion: boolean;
  distanceCategory: 'short' | 'medium' | 'long' | 'intercontinental';
  intraCityTransport: { options: string[]; note: string; rideshareApps: string[] };
  recommendation: string;
  quickSummary: {
    cheapest: { mode: string; priceUSD: number; duration: string };
    fastest: { mode: string; priceUSD: number; duration: string };
  };
}

// Known short-distance city pairs (bidirectional) - cities within ~300km
const SHORT_DISTANCE_PAIRS: Array<[string, string]> = [
  // India
  ['delhi', 'agra'], ['delhi', 'jaipur'], ['mumbai', 'pune'], ['mumbai', 'lonavala'],
  ['bangalore', 'mysore'], ['chennai', 'pondicherry'], ['hyderabad', 'warangal'],
  ['kolkata', 'digha'], ['ahmedabad', 'vadodara'], ['lucknow', 'kanpur'],
  // Europe - Neighboring cities
  ['paris', 'brussels'], ['paris', 'amsterdam'], ['amsterdam', 'brussels'],
  ['london', 'birmingham'], ['london', 'oxford'], ['london', 'cambridge'],
  ['rome', 'florence'], ['rome', 'naples'], ['milan', 'turin'], ['venice', 'florence'],
  ['berlin', 'prague'], ['munich', 'salzburg'], ['vienna', 'prague'], ['vienna', 'bratislava'],
  ['barcelona', 'valencia'], ['madrid', 'toledo'], ['madrid', 'segovia'],
  ['zurich', 'geneva'], ['zurich', 'milan'],
  // UK
  ['london', 'manchester'], ['london', 'bristol'], ['manchester', 'liverpool'],
  ['edinburgh', 'glasgow'],
  // Japan
  ['tokyo', 'yokohama'], ['osaka', 'kyoto'], ['osaka', 'kobe'], ['nagoya', 'osaka'],
  // USA (close pairs)
  ['san francisco', 'san jose'], ['los angeles', 'san diego'], ['boston', 'new york'],
  ['washington', 'baltimore'], ['philadelphia', 'new york'], ['dallas', 'austin'],
  // Southeast Asia
  ['singapore', 'kuala lumpur'], ['bangkok', 'pattaya'], ['hanoi', 'halong'],
  // China
  ['shanghai', 'hangzhou'], ['beijing', 'tianjin'], ['guangzhou', 'shenzhen'],
  ['hong kong', 'shenzhen'], ['hong kong', 'guangzhou'],
  // Australia
  ['sydney', 'canberra'], ['melbourne', 'geelong'], ['brisbane', 'gold coast'],
];

// Medium distance pairs (~300-600km) - good for high-speed rail
const MEDIUM_DISTANCE_PAIRS: Array<[string, string]> = [
  // India
  ['delhi', 'chandigarh'], ['mumbai', 'goa'], ['mumbai', 'ahmedabad'], ['bangalore', 'chennai'],
  ['delhi', 'lucknow'], ['kolkata', 'patna'], ['hyderabad', 'bangalore'], ['hyderabad', 'bengaluru'],
  ['hyderabad', 'chennai'], ['hyderabad', 'mumbai'], ['delhi', 'jaipur'], ['bangalore', 'goa'],
  ['chennai', 'bangalore'], ['pune', 'bangalore'], ['ahmedabad', 'pune'],
  // Europe
  ['paris', 'lyon'], ['paris', 'london'], ['london', 'edinburgh'], ['london', 'paris'],
  ['berlin', 'munich'], ['berlin', 'hamburg'], ['madrid', 'barcelona'],
  ['rome', 'milan'], ['amsterdam', 'paris'], ['brussels', 'amsterdam'],
  // Japan
  ['tokyo', 'osaka'], ['tokyo', 'nagoya'], ['osaka', 'hiroshima'],
  // USA
  ['new york', 'boston'], ['new york', 'washington'], ['chicago', 'detroit'],
  ['los angeles', 'las vegas'], ['san francisco', 'los angeles'],
  // China
  ['shanghai', 'nanjing'], ['beijing', 'shanghai'], ['guangzhou', 'hong kong'],
  // Australia
  ['sydney', 'melbourne'], ['brisbane', 'sydney'],
];

// Extract city name from location string for matching
function extractCity(location: string): string {
  const parts = location.toLowerCase().split(',');
  return parts[0].trim()
    .replace(/city$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if two cities are a known short/medium distance pair
function checkKnownDistance(origin: string, destination: string): 'short' | 'medium' | null {
  const originCity = extractCity(origin);
  const destCity = extractCity(destination);

  // Check short distance pairs
  for (const [city1, city2] of SHORT_DISTANCE_PAIRS) {
    if ((originCity.includes(city1) || city1.includes(originCity)) &&
        (destCity.includes(city2) || city2.includes(destCity))) return 'short';
    if ((originCity.includes(city2) || city2.includes(originCity)) &&
        (destCity.includes(city1) || city1.includes(destCity))) return 'short';
  }

  // Check medium distance pairs
  for (const [city1, city2] of MEDIUM_DISTANCE_PAIRS) {
    if ((originCity.includes(city1) || city1.includes(originCity)) &&
        (destCity.includes(city2) || city2.includes(destCity))) return 'medium';
    if ((originCity.includes(city2) || city2.includes(originCity)) &&
        (destCity.includes(city1) || city1.includes(destCity))) return 'medium';
  }

  return null;
}

// Estimate distance category based on travel context (no coordinates needed)
function estimateDistanceCategory(origin: string, destination: string): 'short' | 'medium' | 'long' | 'intercontinental' {
  const sameCountry = isSameCountry(origin, destination);
  const sameRegion = isSameRegion(origin, destination);

  // First check if this is a known distance pair
  const knownDistance = checkKnownDistance(origin, destination);
  if (knownDistance) return knownDistance;

  if (!sameCountry && !sameRegion) return 'intercontinental';

  // Same region but different countries - check for good rail connections
  if (!sameCountry && sameRegion) {
    const region = getRegion(origin);
    // European countries with excellent rail connectivity
    if (region === 'western_europe' || region === 'eastern_europe') {
      return 'medium'; // Train-friendly distance in Europe
    }
    return 'long';
  }

  // Same country - check if likely short/medium/long based on country size
  const country = extractCountry(origin);
  const largeCountries = ['usa', 'united states', 'canada', 'russia', 'china', 'india', 'brazil', 'australia'];
  const mediumCountries = ['france', 'germany', 'spain', 'italy', 'japan', 'mexico', 'argentina', 'south africa'];

  // For large countries, default to long (but known pairs are already handled above)
  if (largeCountries.includes(country)) return 'long';
  if (mediumCountries.includes(country)) return 'medium';
  return 'medium'; // Default for smaller countries
}

function getTransportRecommendations(
  origin: string,
  destination: string,
  budget: number,
  currency: string,
  groupSize: number
): TransportRecommendation {
  const isDomestic = isSameCountry(origin, destination);
  const sameRegion = isSameRegion(origin, destination);
  const distanceCategory = estimateDistanceCategory(origin, destination);

  // Get regional transport info for destination
  const destRegionalTransport = getRegionalTransport(destination);
  const originRegionalTransport = getRegionalTransport(origin);

  const intraCityTransport = {
    options: destRegionalTransport.intraCityOptions,
    note: destRegionalTransport.intraCityNote,
    rideshareApps: destRegionalTransport.rideshareApps
  };

  const options: TransportOption[] = [];
  let primaryMode = 'flight';
  let recommendation = '';

  // Build transport options based on distance category and regional characteristics
  // Estimate distance in km based on category
  const estimatedDistanceKm = distanceCategory === 'short' ? 200 : distanceCategory === 'medium' ? 500 : 1000;

  if (distanceCategory === 'short' || (isDomestic && distanceCategory === 'medium')) {
    // Short/medium domestic - prioritize ground transport

    // Calculate train price using regional per-km cost
    const trainBudgetUSD = Math.max(5, estimatedDistanceKm * destRegionalTransport.trainCostPerKmUSD);
    const busBudgetUSD = Math.max(3, estimatedDistanceKm * destRegionalTransport.busCostPerKmUSD);

    if (destRegionalTransport.hasGoodRailNetwork) {
      primaryMode = 'train';
      options.push({
        mode: 'train',
        priceRangeUSD: {
          budget: trainBudgetUSD * groupSize,
          standard: trainBudgetUSD * 2 * groupSize,  // 2AC class
          luxury: trainBudgetUSD * 4 * groupSize     // 1AC or premium
        },
        durationHours: distanceCategory === 'short' ? 2 : 5,
        recommended: true,
        tags: [],
        note: 'Comfortable and scenic. Book in advance for best prices.'
      });
    }

    if (destRegionalTransport.hasBudgetBuses) {
      options.push({
        mode: 'bus',
        priceRangeUSD: {
          budget: busBudgetUSD * groupSize,
          standard: busBudgetUSD * 2 * groupSize,    // AC/Volvo
          luxury: busBudgetUSD * 3.5 * groupSize     // Luxury sleeper
        },
        durationHours: distanceCategory === 'short' ? 3 : 7,
        recommended: !destRegionalTransport.hasGoodRailNetwork,
        tags: [],
        note: 'Most economical option. Overnight buses save hotel costs.'
      });
    }

    // Taxi/cab - calculate based on distance and regional rates
    const taxiRatePerKm = 0.15; // ~₹12/km for India, slightly higher for other regions
    const taxiBudgetUSD = Math.max(15, estimatedDistanceKm * taxiRatePerKm);

    options.push({
      mode: destRegionalTransport.rideshareAvailable ? `${destRegionalTransport.rideshareApps[0] || 'Taxi'}/Cab` : 'Taxi/Cab',
      priceRangeUSD: {
        budget: taxiBudgetUSD * groupSize,
        standard: taxiBudgetUSD * 1.3 * groupSize,   // Peak/comfort
        luxury: taxiBudgetUSD * 2 * groupSize        // Premium sedan
      },
      durationHours: distanceCategory === 'short' ? 1.5 : 4,
      recommended: false,
      tags: [],
      note: 'Door-to-door convenience. Best for groups or heavy luggage.'
    });

    // Add flight option for medium distances
    if (distanceCategory === 'medium') {
      options.push({
        mode: 'flight',
        priceRangeUSD: {
          budget: destRegionalTransport.avgDomesticFlightCostUSD * groupSize * 0.7,
          standard: destRegionalTransport.avgDomesticFlightCostUSD * groupSize,
          luxury: destRegionalTransport.avgDomesticFlightCostUSD * groupSize * 1.8
        },
        durationHours: 1.5,
        recommended: false,
        tags: [],
        note: 'Fastest option. Consider if time is limited.'
      });
    }

    recommendation = destRegionalTransport.hasGoodRailNetwork
      ? `${isDomestic ? 'Domestic' : 'Regional'} journey. Train recommended for comfort and value.`
      : `${isDomestic ? 'Domestic' : 'Regional'} journey. Bus is most economical, taxi for convenience.`;

  } else if (distanceCategory === 'long') {
    // Long domestic/regional - flight or overnight train

    // Calculate long-distance prices using regional per-km costs (for ~1000km journey)
    const longTrainBudgetUSD = Math.max(15, estimatedDistanceKm * destRegionalTransport.trainCostPerKmUSD);
    const longBusBudgetUSD = Math.max(10, estimatedDistanceKm * destRegionalTransport.busCostPerKmUSD);

    primaryMode = 'flight';
    options.push({
      mode: 'flight',
      priceRangeUSD: {
        budget: destRegionalTransport.avgDomesticFlightCostUSD * groupSize * 0.7,
        standard: destRegionalTransport.avgDomesticFlightCostUSD * groupSize,
        luxury: destRegionalTransport.avgDomesticFlightCostUSD * groupSize * 2
      },
      durationHours: 2,
      recommended: true,
      tags: [],
      note: 'Fastest option for long distances. Book early for best prices.'
    });

    if (isDomestic && destRegionalTransport.hasGoodRailNetwork) {
      options.push({
        mode: 'train (overnight/express)',
        priceRangeUSD: {
          budget: longTrainBudgetUSD * groupSize,
          standard: longTrainBudgetUSD * 2 * groupSize,   // 2AC sleeper
          luxury: longTrainBudgetUSD * 4 * groupSize      // 1AC
        },
        durationHours: 10,
        recommended: false,
        tags: [],
        note: 'Sleeper trains save hotel cost. Great for overnight journeys.'
      });
    }

    if (destRegionalTransport.hasBudgetBuses) {
      options.push({
        mode: 'bus (overnight)',
        priceRangeUSD: {
          budget: longBusBudgetUSD * groupSize,
          standard: longBusBudgetUSD * 2 * groupSize,     // Volvo sleeper
          luxury: longBusBudgetUSD * 3 * groupSize        // Luxury sleeper
        },
        durationHours: 12,
        recommended: false,
        tags: [],
        note: 'Budget option. Look for luxury/sleeper buses for comfort.'
      });
    }

    recommendation = isDomestic
      ? `Long domestic journey. Flight is fastest, overnight train is budget-friendly.`
      : `Long regional journey. Flight recommended for time savings.`;

  } else {
    // Intercontinental - flight only realistically

    primaryMode = 'flight';
    options.push({
      mode: 'flight',
      priceRangeUSD: {
        budget: 400 * groupSize,
        standard: 800 * groupSize,
        luxury: 2500 * groupSize
      },
      durationHours: 10,
      recommended: true,
      tags: [],
      note: 'Only practical option for intercontinental travel.'
    });

    recommendation = `Intercontinental journey. Flight is the only practical option. Book 2-3 months ahead for best prices.`;
  }

  // Calculate and assign tags: cheapest, fastest, best_value
  if (options.length > 0) {
    // Find cheapest (by budget price)
    const cheapestOption = options.reduce((min, opt) =>
      opt.priceRangeUSD.budget < min.priceRangeUSD.budget ? opt : min
    );
    cheapestOption.tags.push('cheapest');

    // Find fastest
    const fastestOption = options.reduce((min, opt) =>
      opt.durationHours < min.durationHours ? opt : min
    );
    fastestOption.tags.push('fastest');

    // Best value = good balance of price and time (price/hour ratio)
    const bestValueOption = options.reduce((best, opt) => {
      const ratio = opt.priceRangeUSD.budget / opt.durationHours;
      const bestRatio = best.priceRangeUSD.budget / best.durationHours;
      return ratio < bestRatio ? opt : best;
    });
    if (!bestValueOption.tags.includes('cheapest') && !bestValueOption.tags.includes('fastest')) {
      bestValueOption.tags.push('best_value');
    }

    // Most comfortable (usually the luxury option or train)
    const comfortOption = options.find(o => o.mode.includes('train') && !o.mode.includes('overnight'))
      || options.find(o => o.mode === 'flight');
    if (comfortOption && !comfortOption.tags.includes('fastest')) {
      comfortOption.tags.push('most_comfortable');
    }
  }

  // Ensure at least one option is recommended
  if (!options.some(o => o.recommended) && options.length > 0) {
    options[0].recommended = true;
  }

  // Build quick summary for UI
  const cheapest = options.find(o => o.tags.includes('cheapest')) || options[0];
  const fastest = options.find(o => o.tags.includes('fastest')) || options[0];

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours === Math.floor(hours)) return `${hours}h`;
    return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  };

  return {
    primaryMode,
    allOptions: options,
    isDomestic,
    isSameRegion: sameRegion,
    distanceCategory,
    intraCityTransport,
    recommendation,
    quickSummary: {
      cheapest: {
        mode: cheapest?.mode || 'flight',
        priceUSD: cheapest?.priceRangeUSD.budget || 0,
        duration: formatDuration(cheapest?.durationHours || 0)
      },
      fastest: {
        mode: fastest?.mode || 'flight',
        priceUSD: fastest?.priceRangeUSD.budget || 0,
        duration: formatDuration(fastest?.durationHours || 0)
      }
    }
  };
}

// Budget tier multipliers
const BUDGET_TIERS = {
  budget: { hotel: 0.6, transport: 0.7, food: 0.7, label: 'Budget' },
  standard: { hotel: 1.0, transport: 1.0, food: 1.0, label: 'Standard' },
  luxury: { hotel: 2.0, transport: 1.5, food: 1.5, label: 'Luxury' }
};

function detectBudgetTier(budget: number, days: number, groupSize: number, currency: string): 'budget' | 'standard' | 'luxury' {
  // Convert budget to USD equivalent for comparison
  const budgetPerPersonPerDay = budget / days / groupSize;
  const rateToUSD = FALLBACK_RATES[currency] || 1;
  const budgetUSD = budgetPerPersonPerDay / rateToUSD;

  if (budgetUSD < 80) return 'budget';
  if (budgetUSD > 250) return 'luxury';
  return 'standard';
}

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

  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch {
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

// Retry wrapper for AI calls
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  let lastError: Error | null = null;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      console.log(`[Retry] Attempt ${i + 1} failed, ${retries - i} retries left`);
      if (i < retries) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// Background processor for trip analysis
async function processTripInBackground(tripId: number, input: any) {
  const startTime = Date.now();
  console.log(`[Background] Starting analysis for trip ${tripId}`);
  updateProgress(tripId, PROGRESS_STEPS.STARTING, "Initializing...");

  try {
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

    // Enhanced feasibility prompt that checks accessibility FIRST
    const feasibilityPrompt = `CRITICAL: First determine if this trip is even POSSIBLE. JSON only, no markdown.

Trip Request: ${originCity} → ${input.destination}
Passport: ${input.passport}. Residence: ${residenceCountry}${hasResidency ? " (PR)" : ""}.
Travel dates: ${input.dates}, ${input.groupSize} travelers, ${budgetInfo}.

STEP 1 - ACCESSIBILITY CHECK (most important):
- Is ${input.destination} a real, accessible tourist destination?
- Can regular tourists travel there? (Not war zones, closed countries, restricted areas, uninhabited regions)
- Are there commercial flights/transport available from ${originCity}?
- Examples of INACCESSIBLE destinations: Antarctica (requires expedition), North Korea (closed), war zones, uninhabited islands

STEP 2 - If accessible, check:
- Visa requirements for ${input.passport} passport holders visiting ${input.destination}
- Safety conditions for tourists
${isCustomBudget ? '- Budget feasibility' : '- Skip budget analysis (travel style selected)'}

CRITICAL RULES:
- If destination is NOT accessible to regular tourists → overall: "no", score: 0-20
- If destination requires special permits/expeditions (like Antarctica) → overall: "no"
- If destination is a conflict zone → overall: "no"
- Only return "yes" or "warning" if regular commercial travel is possible

Return JSON:
{
  "overall": "yes|no|warning",
  "score": 0-100,
  "breakdown": {
    "accessibility": {
      "status": "accessible|restricted|impossible",
      "reason": "Can tourists visit? Are there commercial transport options?"
    },
    "visa": {"status": "ok|issue", "reason": "brief visa info"},
    ${budgetInstruction},
    "safety": {"status": "safe|caution|danger", "reason": "brief safety info"}
  },
  "summary": "1-2 sentences. If not accessible, explain WHY and suggest alternatives."
}`;

    console.log(`[Background] Calling AI for feasibility...`);
    updateProgress(tripId, PROGRESS_STEPS.FEASIBILITY, `Checking ${input.passport} passport requirements for ${input.destination}`);
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
    await storage.updateTripFeasibility(tripId, report.overall, report);
    console.log(`[Background] Feasibility: ${report.overall} (score: ${report.score}) in ${Date.now() - startTime}ms`);

    // ============ SMART EARLY EXIT FOR INFEASIBLE TRIPS ============
    // If AI determines the trip is NOT feasible, stop here - don't search for flights/hotels/activities
    if (report.overall === "no") {
      console.log(`[Background] Trip NOT FEASIBLE: ${report.summary}`);
      updateProgress(tripId, PROGRESS_STEPS.COMPLETE, "Trip not feasible - see details");
      clearProgress(tripId);
      // Trip stays with just the feasibility report - no itinerary generated
      console.log(`[Background] Trip ${tripId} completed (infeasible) in ${Date.now() - startTime}ms`);
      return;
    }

    // STEP 2: Generate itinerary ONLY if trip is feasible (run API calls in parallel)
    if (report.overall === "yes" || report.overall === "warning") {
      const dates = parseDateRange(input.dates);
      const numDays = dates ? Math.ceil((new Date(dates.endDate).getTime() - new Date(dates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 7;
      const numNights = Math.max(numDays - 1, 1);
      const departureDate = dates?.startDate || new Date().toISOString().split('T')[0];
      const returnDate = dates?.endDate || new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Check if dates are in the past (can't search for past flights/hotels)
      const today = new Date().toISOString().split('T')[0];
      const datesInPast = departureDate < today;
      if (datesInPast) {
        console.log(`[Background] Trip dates are in the past (${departureDate}), using estimates only`);
      }

      // Check cache first for itinerary
      const cachedItinerary = getCachedItinerary(input.destination, departureDate, numDays);

      // Get transport recommendations (no API call, uses static data)
      const transportRec = getTransportRecommendations(
        input.origin || residenceCountry,
        input.destination,
        input.budget,
        currency,
        input.groupSize
      );

      // Use user's selected travel style if provided, otherwise auto-detect from budget
      const userTravelStyle = input.travelStyle as 'budget' | 'standard' | 'luxury' | null;
      const budgetTier = (userTravelStyle && ['budget', 'standard', 'luxury'].includes(userTravelStyle))
        ? userTravelStyle
        : detectBudgetTier(input.budget, numDays, input.groupSize, currency);
      console.log(`[Background] Transport: ${transportRec.primaryMode} (${transportRec.distanceCategory}, ${transportRec.isDomestic ? 'domestic' : 'international'}), Budget tier: ${budgetTier}${userTravelStyle ? ' (user selected)' : ' (auto-detected)'}`);

      // Start API calls in parallel with itinerary generation
      console.log(`[Background] Starting parallel processing...`);

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

      const [itineraryResult, flightResult, hotelResult] = await Promise.all([
        // AI Itinerary generation (or use cache)
        (async () => {
          // Use cache if available
          if (cachedItinerary) {
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
          const travelStyleGuide = {
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
          }[budgetTier] || travelStyleGuide.standard;

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

          const itineraryPrompt = `Create a realistic ${numDays}-day ${input.destination} travel itinerary for ${input.groupSize} traveler(s).

TRAVEL STYLE: ${budgetTier.toUpperCase()}
${travelStyleGuide}${budgetConstraint}

OUTPUT FORMAT (JSON):
{"days":[{"day":1,"date":"${departureDate}","title":"Day Theme","activities":[{"time":"09:00","description":"Activity name","type":"activity|meal|transport","location":"Place name","coordinates":{"lat":0.0,"lng":0.0},"estimatedCost":0,"transportMode":"walk|metro|taxi"}]}]}

REQUIREMENTS:
1. Day 1: Arrive at ${arrivalMode} by ${arrivalTransport} around 14:00, check into accommodation, light exploration
2. Last day: Morning activity, checkout by 11:00, depart from ${arrivalMode}
3. Full days: 4-5 activities each (breakfast 08:00, activity 10:00, lunch 13:00, activity 15:00, dinner 19:00)
4. DAY TITLES must be thematic: "Old City Heritage", "Nature & Gardens", "Local Markets" - NOT "Day 2 in ${input.destination}"
5. ACTIVITY NAMES must be specific: Real place names from ${input.destination} - NOT generic "Explore" or "Visit city"
6. estimatedCost: REALISTIC local prices in USD for ${budgetTier} travel in ${input.destination}
7. coordinates: Real GPS coordinates for ${input.destination} locations
8. transportMode: How to reach each place (${localTransport}, walk, taxi)
9. Keep descriptions short (3-5 words)

IMPORTANT: All costs must reflect ACTUAL local prices in ${input.destination} for ${budgetTier} travelers. Research real costs.`;

          // Scale tokens: ~250 tokens per day, minimum 3000, maximum 8000
          const maxTokens = Math.max(3000, Math.min(8000, numDays * 280));

          const systemPrompt = `You are a travel planning expert with deep knowledge of local costs worldwide.
Your role: Create realistic travel itineraries with ACCURATE local prices.

Key responsibilities:
- Know typical costs for meals, activities, and transport in every destination
- Adjust all prices based on travel style (budget/standard/luxury)
- Use REAL place names and GPS coordinates
- Create varied, interesting day themes
- Output compact JSON only, no markdown or explanations`;

          const response = await openai!.chat.completions.create({
            model: aiModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: itineraryPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.4, // Slightly higher for more creative day titles
            max_tokens: maxTokens,
          });
          const result = safeJsonParse(response.choices[0].message.content || "{}", { days: [] });

          // Cache the result for future use
          if (result.days?.length >= 5) {
            cacheItinerary(input.destination, result);
          }

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
            return createEstimate(basePrice, modeLabel, duration);
          }

          // Skip API call if dates are in the past
          if (datesInPast) {
            return createEstimate(800);
          }

          try {
            const result = await searchFlights({
              origin: input.origin || input.residence || 'New York',
              destination: input.destination,
              departureDate,
              returnDate,
              passengers: adults + children, // Infants don't need seats
            });

            // Adjust price for children/infants
            const adultPrice = result.pricePerPerson;
            const childPrice = Math.round(adultPrice * 0.75);
            const infantPrice = Math.round(adultPrice * 0.10);
            const totalPrice = (adults * adultPrice) + (children * childPrice) + (infants * infantPrice);

            return {
              ...result,
              price: totalPrice,
              pricePerPerson: adultPrice,
            };
          } catch (err) {
            console.error('Flight API error:', err);
            return createEstimate(800);
          }
        })(),

        // Hotel API call
        (async (): Promise<HotelResult> => {
          // Skip API call if dates are in the past
          if (datesInPast) {
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

          try {
            return await searchHotels({
              destination: input.destination,
              checkIn: departureDate,
              checkOut: returnDate,
              guests: input.groupSize,
              budget: Math.round(input.budget * 0.35),
            });
          } catch (err) {
            console.error('Hotel API error:', err);
            return {
              totalPrice: Math.round(100 * numNights),
              pricePerNight: 100,
              nights: numNights,
              hotelName: 'Mid-range Hotel',
              rating: 4.0,
              amenities: ['WiFi', 'Air Conditioning'],
              source: 'estimate',
              type: 'Mid-range hotel',
            };
          }
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
        console.log(`[Background] AI itinerary empty, generating basic placeholder for ${numDays} days`);
        const startDate = new Date(departureDate);
        const destCoords = getDestinationCoords(input.destination);
        const center = destCoords.center;
        const attractions = destCoords.attractions;

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
                  ? { time: "14:00", description: "Arrive and check in", type: "transport", location: `${input.destination} Airport`, coordinates: center, estimatedCost: 30 }
                  : { time: "09:00", description: `Visit ${getAttractionName(i * 2)}`, type: "activity", location: getAttractionName(i * 2), coordinates: getCoords(i * 2), estimatedCost: 40 },
                { time: "13:00", description: "Lunch at local restaurant", type: "meal", location: "Local restaurant", coordinates: getCoords(i * 2 + 1), estimatedCost: 25 },
                isLastDay
                  ? { time: "15:00", description: "Depart from airport", type: "transport", location: `${input.destination} Airport`, coordinates: center, estimatedCost: 30 }
                  : { time: "15:00", description: `Explore ${getAttractionName(i * 2 + 1)}`, type: "activity", location: getAttractionName(i * 2 + 1), coordinates: getCoords(i * 2 + 1), estimatedCost: 35 },
                !isLastDay ? { time: "19:00", description: "Dinner", type: "meal", location: "Local restaurant", coordinates: getCoords(i * 3), estimatedCost: 35 } : null,
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

        itinerary.days.forEach((day: any) => {
          if (day.activities) {
            day.activities.forEach((activity: any) => {
              // AI provides estimatedCost in USD per person - convert to user's currency
              const aiCostUSD = activity.estimatedCost || 0;

              // Skip lodging costs (handled separately via hotel API)
              if (activity.type === 'lodging') {
                activity.estimatedCost = 0;
                return;
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
        });

        console.log(`[Background] AI cost totals - Activities: ${totalActivities}, Food: ${totalFood}, Transport: ${totalTransport}`);

        // Fallback: If cached itinerary has no AI costs, generate basic estimates
        if (totalActivities === 0 && totalFood === 0 && totalTransport === 0) {
          console.log(`[Background] Cached itinerary lacks costs - generating tier-based estimates`);
          // Basic per-person daily costs by tier (USD)
          const dailyCosts = {
            budget: { meal: 3, activity: 2, transport: 2 },
            standard: { meal: 8, activity: 10, transport: 5 },
            luxury: { meal: 25, activity: 30, transport: 15 }
          }[budgetTier] || { meal: 8, activity: 10, transport: 5 };

          itinerary.days.forEach((day: any) => {
            if (day.activities) {
              day.activities.forEach((activity: any) => {
                if (activity.type === 'lodging') return;
                let costUSD = 0;
                if (activity.type === 'meal') costUSD = dailyCosts.meal;
                else if (activity.type === 'activity') costUSD = dailyCosts.activity;
                else if (activity.type === 'transport') costUSD = dailyCosts.transport;

                const totalPrice = Math.round(convertFromUSD(costUSD * groupSize, currency, exchangeRates));
                activity.estimatedCost = totalPrice;

                if (activity.type === 'activity') totalActivities += totalPrice;
                if (activity.type === 'meal') totalFood += totalPrice;
                if (activity.type === 'transport') totalTransport += totalPrice;
              });
            }
          });
          console.log(`[Background] Fallback costs - Activities: ${totalActivities}, Food: ${totalFood}, Transport: ${totalTransport}`);
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

        const grandTotal = safeNum(flightTotal) + safeNum(accommodationTotal) + safeNum(totalFood) +
                          safeNum(totalActivities) + safeNum(totalTransport) + safeNum(intercityEstimate) + safeNum(miscTotal);
        const budgetDiff = input.budget - grandTotal;

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
          // Primary transport (flights or alternative)
          flights: transportRec.primaryMode === 'flight' ? {
            total: flightTotal,
            perPerson: flightPerPerson,
            airline: flightResult.airline,
            duration: flightResult.duration,
            stops: flightResult.stops,
            bookingUrl: flightResult.bookingUrl,
            note: `Round-trip from ${originDisplay}${flightResult.source === 'api' ? ' (Live prices)' : ' (Estimated)'}`,
            source: flightResult.source,
          } : {
            total: convertFromUSD(transportRec.allOptions[0]?.priceRangeUSD[budgetTier] * input.groupSize || 0, currency, exchangeRates),
            perPerson: convertFromUSD(transportRec.allOptions[0]?.priceRangeUSD[budgetTier] || 0, currency, exchangeRates),
            airline: transportRec.primaryMode.charAt(0).toUpperCase() + transportRec.primaryMode.slice(1),
            duration: `${transportRec.allOptions[0]?.durationHours || 2}h`,
            stops: 0,
            note: `${transportRec.primaryMode.charAt(0).toUpperCase() + transportRec.primaryMode.slice(1)} from ${originDisplay} (${transportRec.distanceCategory} distance)`,
            source: 'estimate',
          },
          // All transport options
          transportOptions: {
            primaryMode: transportRec.primaryMode,
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
          savingsTips: savingsTips.slice(0, 5) // Limit to 5 tips
        };
      }

      await storage.updateTripItinerary(tripId, itinerary);

      // Sync feasibility report with actual calculated costs
      if (itinerary.costBreakdown) {
        const actualCost = itinerary.costBreakdown.grandTotal;
        const budgetStatus = itinerary.costBreakdown.budgetStatus;

        // Update the feasibility report with actual costs
        const updatedReport: FeasibilityReport = {
          ...report,
          breakdown: {
            ...report.breakdown,
            budget: {
              status: budgetStatus === 'over_budget' ? 'impossible' : budgetStatus === 'tight' ? 'tight' : 'ok',
              estimatedCost: actualCost,
              reason: budgetStatus === 'over_budget'
                ? `Trip costs ${currencySymbol}${actualCost.toLocaleString()} exceed your ${currencySymbol}${input.budget.toLocaleString()} budget`
                : budgetStatus === 'tight'
                ? `Trip costs ${currencySymbol}${actualCost.toLocaleString()} - close to your ${currencySymbol}${input.budget.toLocaleString()} budget`
                : `Trip costs ${currencySymbol}${actualCost.toLocaleString()} - within your ${currencySymbol}${input.budget.toLocaleString()} budget`
            }
          },
          summary: budgetStatus === 'over_budget'
            ? `Trip exceeds budget by ${currencySymbol}${(actualCost - input.budget).toLocaleString()}. ${report.breakdown.visa.status === 'ok' ? 'Visa requirements appear favorable.' : 'Check visa requirements carefully.'}`
            : report.summary
        };

        // Also update overall status if budget is impossible
        if (budgetStatus === 'over_budget' && report.overall === 'yes') {
          updatedReport.overall = 'warning';
          updatedReport.score = Math.min(report.score, 65);
        }

        await storage.updateTripFeasibility(tripId, updatedReport.overall, updatedReport);
        console.log(`[Background] Synced feasibility with actual costs: ${currencySymbol}${actualCost.toLocaleString()}`);
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

  app.post(api.trips.create.path, async (req, res) => {
    try {
      const input = api.trips.create.input.parse(req.body);

      // Validate dates are not in the past
      const dates = parseDateRange(input.dates);
      if (dates) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(dates.startDate);
        if (startDate < today) {
          return res.status(400).json({
            message: "Travel dates must be in the future. Please select upcoming dates.",
            field: "dates"
          });
        }
      }

      // Validate minimum budget - ONLY for custom travel style
      // For Budget/Standard/Luxury, AI handles costs automatically (budget field is just a placeholder)
      const isCustomBudget = input.travelStyle === 'custom';
      if (isCustomBudget) {
        const numDays = dates ? Math.ceil((new Date(dates.endDate).getTime() - new Date(dates.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 7;
        const groupSize = input.groupSize || 1;
        const minBudget = groupSize * numDays * 50; // $50/person/day absolute minimum
        if (input.budget < minBudget) {
          return res.status(400).json({
            message: `Budget too low. Minimum budget for ${input.groupSize} traveler(s) for ${numDays} days is approximately $${minBudget.toLocaleString()}`,
            field: "budget"
          });
        }
      }

      // Create trip immediately with pending status
      const trip = await storage.createTrip(input);

      // Return immediately - don't wait for AI processing
      res.status(201).json(trip);

      // Process in background (fire and forget)
      processTripInBackground(trip.id, input).catch(err => {
        console.error('Background processing failed:', err);
      });

    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.get(api.trips.get.path, async (req, res) => {
    const trip = await storage.getTrip(Number(req.params.id));
    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }
    res.json(trip);
  });

  // Progress endpoint - returns real-time processing status
  app.get('/api/trips/:id/progress', async (req, res) => {
    const tripId = Number(req.params.id);
    const progress = tripProgressStore.get(tripId);

    if (progress) {
      const elapsed = Math.round((Date.now() - progress.startedAt) / 1000);
      res.json({
        ...progress,
        elapsed,
        totalSteps: 6,
        percentComplete: Math.min(100, Math.round((progress.step / 6) * 100)),
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
        // Feasibility done but itinerary in progress
        res.json({
          step: 4,
          message: "Creating your itinerary",
          totalSteps: 6,
          percentComplete: 67,
          elapsed: 0,
        });
      }
    }
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
