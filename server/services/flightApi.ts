/**
 * Flight API Integration
 * Uses SerpAPI Google Flights or falls back to estimates
 */

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

function getAirportCode(city: string): string {
  const cityLower = city.toLowerCase();
  for (const [name, code] of Object.entries(CITY_TO_AIRPORT)) {
    if (cityLower.includes(name)) return code;
  }
  // Return first 3 letters as fallback (might work for some cities)
  return city.substring(0, 3).toUpperCase();
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
    const originCode = getAirportCode(origin);
    const destCode = getAirportCode(destination);

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
