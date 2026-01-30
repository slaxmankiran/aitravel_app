/**
 * Flight API Integration
 * Uses SerpAPI Google Flights or falls back to estimates
 * Features AI-powered airport code lookup for any city
 */

import type OpenAI from 'openai';
import { getAIClient, isAIConfigured } from './aiClientFactory';

// Initialize OpenAI client for airport lookups (lazy via factory)
let openaiClient: OpenAI | null = null;
let aiModel = 'deepseek-chat';

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && isAIConfigured()) {
    const client = getAIClient('fast');
    openaiClient = client.openai;
    aiModel = client.model;
  }
  return openaiClient;
}

// Cache for AI airport lookups (persists during server runtime)
const airportCache = new Map<string, string>();

export interface FlightSearchParams {
  origin: string;        // City name or airport code
  destination: string;   // City name or airport code
  departureDate: string; // YYYY-MM-DD
  returnDate: string;    // YYYY-MM-DD
  passengers: number;
  currency?: string;
}

export interface FlightResult {
  price: number;           // Total price for all passengers
  pricePerPerson: number;
  airline: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  bookingUrl?: string;
  source: 'api' | 'estimate';
}

// City to IATA airport code mapping
const CITY_TO_AIRPORT: Record<string, string> = {
  // North America
  'new york': 'JFK', 'los angeles': 'LAX', 'chicago': 'ORD', 'san francisco': 'SFO',
  'miami': 'MIA', 'seattle': 'SEA', 'boston': 'BOS', 'washington': 'IAD',
  'atlanta': 'ATL', 'dallas': 'DFW', 'houston': 'IAH', 'denver': 'DEN',
  'toronto': 'YYZ', 'vancouver': 'YVR', 'montreal': 'YUL', 'calgary': 'YYC',
  // Europe
  'london': 'LHR', 'paris': 'CDG', 'rome': 'FCO', 'barcelona': 'BCN',
  'amsterdam': 'AMS', 'berlin': 'BER', 'madrid': 'MAD', 'lisbon': 'LIS',
  'prague': 'PRG', 'vienna': 'VIE', 'budapest': 'BUD', 'dublin': 'DUB',
  'edinburgh': 'EDI', 'zurich': 'ZRH', 'geneva': 'GVA', 'brussels': 'BRU',
  'copenhagen': 'CPH', 'stockholm': 'ARN', 'oslo': 'OSL', 'helsinki': 'HEL',
  'athens': 'ATH', 'milan': 'MXP', 'venice': 'VCE', 'florence': 'FLR',
  'munich': 'MUC', 'frankfurt': 'FRA',
  // Asia
  'tokyo': 'NRT', 'osaka': 'KIX', 'kyoto': 'KIX', 'singapore': 'SIN',
  'hong kong': 'HKG', 'seoul': 'ICN', 'bangkok': 'BKK', 'kuala lumpur': 'KUL',
  'manila': 'MNL', 'jakarta': 'CGK', 'bali': 'DPS', 'hanoi': 'HAN',
  'ho chi minh': 'SGN', 'taipei': 'TPE', 'beijing': 'PEK', 'shanghai': 'PVG',
  // Thailand - all use Bangkok (BKK) as main hub
  'pattaya': 'BKK', 'chiang mai': 'CNX', 'phuket': 'HKT', 'krabi': 'KBV',
  'koh samui': 'USM', 'chiang rai': 'CEI', 'hua hin': 'BKK', 'ayutthaya': 'BKK',
  // Malaysia - additional cities
  'penang': 'PEN', 'langkawi': 'LGK', 'kota kinabalu': 'BKI', 'johor': 'JHB',
  // Indonesia - additional cities
  'yogyakarta': 'JOG', 'lombok': 'LOP', 'surabaya': 'SUB',
  // Vietnam - additional cities
  'da nang': 'DAD', 'nha trang': 'CXR', 'hoi an': 'DAD', 'sapa': 'HAN',
  // Philippines - additional cities
  'cebu': 'CEB', 'boracay': 'KLO', 'palawan': 'PPS',
  // Cambodia/Laos
  'siem reap': 'REP', 'phnom penh': 'PNH', 'vientiane': 'VTE', 'luang prabang': 'LPQ',
  // Middle East
  'dubai': 'DXB', 'abu dhabi': 'AUH', 'doha': 'DOH', 'tel aviv': 'TLV',
  'istanbul': 'IST', 'riyadh': 'RUH', 'amman': 'AMM',
  // Oceania
  'sydney': 'SYD', 'melbourne': 'MEL', 'brisbane': 'BNE', 'perth': 'PER',
  'auckland': 'AKL', 'wellington': 'WLG', 'queenstown': 'ZQN',
  // South Asia
  'delhi': 'DEL', 'mumbai': 'BOM', 'bangalore': 'BLR', 'chennai': 'MAA',
  'kolkata': 'CCU', 'hyderabad': 'HYD',
  // Africa
  'cape town': 'CPT', 'johannesburg': 'JNB', 'nairobi': 'NBO',
  'cairo': 'CAI', 'marrakech': 'RAK', 'casablanca': 'CMN',
  // South America
  'rio de janeiro': 'GIG', 'sao paulo': 'GRU', 'buenos aires': 'EZE',
  'lima': 'LIM', 'bogota': 'BOG', 'santiago': 'SCL', 'mexico city': 'MEX',
  'cancun': 'CUN',
};

/**
 * AI-powered airport code lookup
 * Uses DeepSeek/OpenAI to find the nearest major international airport for any city
 */
async function getAirportCodeFromAI(city: string): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: aiModel,
      messages: [
        {
          role: 'system',
          content: `You are an airport expert. Given a city or location, return ONLY the 3-letter IATA code of the nearest major international airport. No explanation, just the code. If the city has its own airport, use it. If not, use the nearest major hub. Examples:
- "Pattaya, Thailand" → BKK (Bangkok is nearest major hub)
- "Paris, France" → CDG
- "Hua Hin, Thailand" → BKK
- "Hoi An, Vietnam" → DAD`
        },
        {
          role: 'user',
          content: `What is the IATA airport code for: ${city}`
        }
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const code = response.choices[0]?.message?.content?.trim().toUpperCase();

    // Validate it looks like an IATA code (3 letters)
    if (code && /^[A-Z]{3}$/.test(code)) {
      console.log(`[FlightAPI] AI found airport for "${city}": ${code}`);
      return code;
    }

    console.log(`[FlightAPI] AI returned invalid code for "${city}": ${code}`);
    return null;
  } catch (error) {
    console.log(`[FlightAPI] AI airport lookup failed for "${city}":`, error);
    return null;
  }
}

/**
 * Get airport code for a city - uses cache, hardcoded mapping, then AI
 * Priority: 1) Cache 2) Hardcoded mapping 3) AI lookup 4) Fallback
 */
async function getAirportCode(city: string): Promise<string> {
  const cityLower = city.toLowerCase();
  const cacheKey = cityLower.replace(/[^a-z0-9]/g, '');

  // 1) Check cache first (includes previous AI lookups)
  if (airportCache.has(cacheKey)) {
    const cached = airportCache.get(cacheKey)!;
    console.log(`[FlightAPI] Cache hit for "${city}": ${cached}`);
    return cached;
  }

  // 2) Check hardcoded mapping (instant, for common cities)
  for (const [name, code] of Object.entries(CITY_TO_AIRPORT)) {
    if (cityLower.includes(name)) {
      airportCache.set(cacheKey, code);
      return code;
    }
  }

  // 3) Use AI to find the nearest airport
  console.log(`[FlightAPI] City "${city}" not in mapping, asking AI...`);
  const aiCode = await getAirportCodeFromAI(city);
  if (aiCode) {
    airportCache.set(cacheKey, aiCode);
    return aiCode;
  }

  // 4) Last resort fallback - use first 3 letters
  console.log(`[FlightAPI] Warning: All lookups failed for "${city}", using fallback`);
  const fallback = city.substring(0, 3).toUpperCase();
  airportCache.set(cacheKey, fallback);
  return fallback;
}

// Estimated flight prices based on route (fallback when no API)
function getEstimatedFlightPrice(origin: string, destination: string, passengers: number): FlightResult {
  const originLower = origin.toLowerCase();
  const destLower = destination.toLowerCase();

  // Geographic regions
  const regions: Record<string, string[]> = {
    north_america: ['new york', 'los angeles', 'chicago', 'toronto', 'vancouver', 'san francisco', 'miami', 'seattle', 'usa', 'canada'],
    europe: ['london', 'paris', 'rome', 'barcelona', 'amsterdam', 'berlin', 'madrid', 'lisbon', 'prague', 'vienna'],
    asia: ['tokyo', 'singapore', 'hong kong', 'seoul', 'bangkok', 'kuala lumpur', 'osaka', 'bali', 'japan', 'thailand'],
    middle_east: ['dubai', 'abu dhabi', 'doha', 'tel aviv', 'istanbul', 'uae', 'qatar', 'turkey'],
    oceania: ['sydney', 'melbourne', 'auckland', 'wellington', 'australia', 'new zealand'],
    south_asia: ['delhi', 'mumbai', 'bangalore', 'india', 'sri lanka'],
    africa: ['cape town', 'johannesburg', 'nairobi', 'cairo', 'marrakech', 'south africa', 'kenya', 'egypt'],
    south_america: ['rio', 'sao paulo', 'buenos aires', 'lima', 'bogota', 'brazil', 'argentina'],
  };

  const getRegion = (city: string): string => {
    for (const [region, cities] of Object.entries(regions)) {
      if (cities.some(c => city.includes(c))) return region;
    }
    return 'unknown';
  };

  const originRegion = getRegion(originLower);
  const destRegion = getRegion(destLower);

  // Price matrix (per person, round trip)
  const prices: Record<string, number> = {
    'north_america_europe': 700, 'north_america_asia': 1100, 'north_america_oceania': 1400,
    'north_america_middle_east': 1000, 'north_america_south_asia': 1200, 'north_america_africa': 1100,
    'europe_asia': 800, 'europe_oceania': 1300, 'europe_middle_east': 500, 'europe_south_asia': 700,
    'asia_oceania': 600, 'asia_middle_east': 600, 'asia_south_asia': 400,
    'oceania_middle_east': 1000, 'oceania_south_asia': 800,
    'same': 300, 'default': 800,
  };

  let pricePerPerson = prices['default'];
  if (originRegion === destRegion) {
    pricePerPerson = prices['same'];
  } else {
    const key = `${originRegion}_${destRegion}`;
    const reverseKey = `${destRegion}_${originRegion}`;
    pricePerPerson = prices[key] || prices[reverseKey] || prices['default'];
  }

  return {
    price: pricePerPerson * passengers,
    pricePerPerson,
    airline: 'Multiple Airlines',
    departure: origin,
    arrival: destination,
    duration: 'Varies',
    stops: 0,
    source: 'estimate',
  };
}

/**
 * Search for flights using SerpAPI Google Flights
 */
export async function searchFlights(params: FlightSearchParams): Promise<FlightResult> {
  const { origin, destination, departureDate, returnDate, passengers, currency = 'USD' } = params;

  const serpApiKey = process.env.SERPAPI_KEY;

  if (!serpApiKey) {
    console.log('SerpAPI key not configured, using flight estimates');
    return getEstimatedFlightPrice(origin, destination, passengers);
  }

  try {
    // AI-powered airport code lookup (with caching)
    const [originCode, destCode] = await Promise.all([
      getAirportCode(origin),
      getAirportCode(destination)
    ]);

    // Google Flights API limits passengers to 9 max
    // If more passengers, we'll search for 1 and multiply the price
    const searchPassengers = Math.min(passengers, 9);
    const passengerMultiplier = passengers / searchPassengers;

    const searchParams = new URLSearchParams({
      api_key: serpApiKey,
      engine: 'google_flights',
      departure_id: originCode,
      arrival_id: destCode,
      outbound_date: departureDate,
      return_date: returnDate,
      adults: searchPassengers.toString(),
      currency: currency,
      hl: 'en',
      type: '1', // Round trip
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    const response = await fetch(`https://serpapi.com/search?${searchParams}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('SerpAPI flight search failed:', response.status);
      return getEstimatedFlightPrice(origin, destination, passengers);
    }

    const data = await response.json();

    // Parse best flight from results
    if (data.best_flights && data.best_flights.length > 0) {
      const bestFlight = data.best_flights[0];
      const apiPrice = bestFlight.price || 0;
      // Scale price for actual passenger count if we searched with fewer
      const totalPrice = Math.round(apiPrice * passengerMultiplier);
      const pricePerPerson = Math.round(apiPrice / searchPassengers);

      return {
        price: totalPrice,
        pricePerPerson,
        airline: bestFlight.flights?.[0]?.airline || 'Multiple Airlines',
        departure: originCode,
        arrival: destCode,
        duration: bestFlight.total_duration ? `${Math.floor(bestFlight.total_duration / 60)}h ${bestFlight.total_duration % 60}m` : 'N/A',
        stops: bestFlight.flights?.length - 1 || 0,
        bookingUrl: data.search_metadata?.google_flights_url,
        source: 'api',
      };
    }

    // Try other flights if best_flights is empty
    if (data.other_flights && data.other_flights.length > 0) {
      const flight = data.other_flights[0];
      const apiPrice = flight.price || 0;
      // Scale price for actual passenger count if we searched with fewer
      const totalPrice = Math.round(apiPrice * passengerMultiplier);
      const pricePerPerson = Math.round(apiPrice / searchPassengers);

      return {
        price: totalPrice,
        pricePerPerson,
        airline: flight.flights?.[0]?.airline || 'Multiple Airlines',
        departure: originCode,
        arrival: destCode,
        duration: flight.total_duration ? `${Math.floor(flight.total_duration / 60)}h ${flight.total_duration % 60}m` : 'N/A',
        stops: flight.flights?.length - 1 || 0,
        bookingUrl: data.search_metadata?.google_flights_url,
        source: 'api',
      };
    }

    console.log('No flights found in API response, using estimates');
    return getEstimatedFlightPrice(origin, destination, passengers);

  } catch (error) {
    console.error('Flight API error:', error);
    return getEstimatedFlightPrice(origin, destination, passengers);
  }
}
