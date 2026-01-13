/**
 * Transport Service
 *
 * Smart transport recommendations based on regions, countries, and travel patterns.
 * Industry-standard logic with AI enhancement for unusual routes.
 */

import { getTransportOptions as aiGetTransportOptions } from "./aiAgent";

// ============================================================================
// TYPES
// ============================================================================

export interface RegionalTransport {
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

export interface TransportOption {
  mode: string;
  priceRangeUSD: { budget: number; standard: number; luxury: number };
  durationHours: number;
  recommended: boolean;
  tags: ('cheapest' | 'fastest' | 'best_value' | 'most_comfortable' | 'ai_suggested')[];
  note: string;
}

export interface TransportRecommendation {
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

// ============================================================================
// CONSTANTS
// ============================================================================

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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract country from location string (handles "City, Country" format)
 */
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

/**
 * Get region for a location
 */
function getRegion(location: string): string {
  const country = extractCountry(location);
  return COUNTRY_REGIONS[country] || 'default';
}

/**
 * Check if two locations are in the same country
 */
function isSameCountry(origin: string, destination: string): boolean {
  return extractCountry(origin) === extractCountry(destination);
}

/**
 * Check if two locations are in the same region
 */
function isSameRegion(origin: string, destination: string): boolean {
  return getRegion(origin) === getRegion(destination);
}

/**
 * Get regional transport info for a location
 */
function getRegionalTransport(location: string): RegionalTransport {
  const region = getRegion(location);
  return REGIONAL_TRANSPORT[region] || REGIONAL_TRANSPORT['default'];
}

/**
 * Extract city name from location string for matching
 */
function extractCity(location: string): string {
  const parts = location.toLowerCase().split(',');
  return parts[0].trim()
    .replace(/city$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if two cities are a known short/medium distance pair
 */
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

/**
 * Estimate distance category based on travel context (no coordinates needed)
 */
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

/**
 * Format duration in hours to human-readable string
 */
function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours === Math.floor(hours)) return `${hours}h`;
  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get transport recommendations based on origin, destination, budget, and group size
 */
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

/**
 * Detect if a route is "unusual" and might benefit from AI enhancement
 */
function detectUnusualRoute(origin: string, destination: string, rec: TransportRecommendation): boolean {
  const originLower = origin.toLowerCase();
  const destLower = destination.toLowerCase();

  // Routes that are well-covered by hardcoded data (don't need AI)
  const wellKnownCities = [
    'paris', 'london', 'tokyo', 'new york', 'dubai', 'singapore', 'bangkok',
    'rome', 'barcelona', 'amsterdam', 'berlin', 'sydney', 'los angeles',
    'delhi', 'mumbai', 'beijing', 'shanghai', 'seoul', 'hong kong',
    'istanbul', 'cairo', 'cape town', 'toronto', 'vancouver', 'chicago'
  ];

  const originKnown = wellKnownCities.some(city => originLower.includes(city));
  const destKnown = wellKnownCities.some(city => destLower.includes(city));

  // If both cities are well-known, hardcoded logic is sufficient
  if (originKnown && destKnown) return false;

  // If we only have 1 option (usually just flight), AI might find more
  if (rec.allOptions.length <= 1) return true;

  // If the route seems intercontinental but we're not sure
  if (rec.distanceCategory === 'intercontinental' && !rec.isDomestic) {
    // Check if it's a common intercontinental route
    const commonIntercontinental = [
      ['new york', 'london'], ['new york', 'paris'], ['los angeles', 'tokyo'],
      ['london', 'dubai'], ['sydney', 'singapore'], ['delhi', 'dubai']
    ];
    const isCommon = commonIntercontinental.some(([a, b]) =>
      (originLower.includes(a) && destLower.includes(b)) ||
      (originLower.includes(b) && destLower.includes(a))
    );
    if (!isCommon) return true;
  }

  return false;
}

/**
 * Merge hardcoded and AI transport options
 */
function mergeTransportOptions(
  hardcoded: TransportOption[],
  aiOptions: Array<{ mode: string; duration: string; estimatedCost: number; recommended: boolean; note: string }>,
  groupSize: number
): TransportOption[] {
  const merged = [...hardcoded];

  for (const aiOpt of aiOptions) {
    // Check if this mode already exists
    const existing = merged.find(h =>
      h.mode.toLowerCase().includes(aiOpt.mode.toLowerCase()) ||
      aiOpt.mode.toLowerCase().includes(h.mode.toLowerCase())
    );

    if (!existing) {
      // Parse duration string like "2h 30m" to hours
      const durationMatch = aiOpt.duration.match(/(\d+)h?\s*(\d+)?m?/);
      const hours = durationMatch
        ? parseFloat(durationMatch[1]) + (parseFloat(durationMatch[2] || '0') / 60)
        : 3;

      // Add new option from AI
      merged.push({
        mode: aiOpt.mode,
        priceRangeUSD: {
          budget: aiOpt.estimatedCost * groupSize * 0.7,
          standard: aiOpt.estimatedCost * groupSize,
          luxury: aiOpt.estimatedCost * groupSize * 1.5,
        },
        durationHours: hours,
        recommended: aiOpt.recommended,
        tags: ['ai_suggested'],
        note: aiOpt.note,
      });
    }
  }

  return merged;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Smart Transport Recommendations - Hybrid Approach
 * Uses hardcoded logic for common routes (fast), AI for unusual routes (smart)
 */
export async function getSmartTransportRecommendations(
  origin: string,
  destination: string,
  budget: number,
  currency: string,
  groupSize: number,
  travelStyle: 'budget' | 'standard' | 'luxury' = 'standard'
): Promise<TransportRecommendation> {
  // First, get the hardcoded recommendation (instant, always works)
  const hardcodedRec = getTransportRecommendations(origin, destination, budget, currency, groupSize);

  // Check if this is an "unusual" route that might benefit from AI enhancement
  const isUnusualRoute = detectUnusualRoute(origin, destination, hardcodedRec);

  if (!isUnusualRoute) {
    // Common route - hardcoded logic is good enough
    console.log(`[TransportService] Using hardcoded recommendations for ${origin} → ${destination}`);
    return hardcodedRec;
  }

  // Unusual route - enhance with AI (but don't block on failure)
  console.log(`[TransportService] Unusual route detected: ${origin} → ${destination}, querying AI...`);
  try {
    const aiOptions = await aiGetTransportOptions(origin, destination, travelStyle);

    if (aiOptions.options && aiOptions.options.length > 0) {
      // Merge AI options with hardcoded ones for best of both
      const enhancedOptions = mergeTransportOptions(hardcodedRec.allOptions, aiOptions.options, groupSize);
      console.log(`[TransportService] AI enhanced with ${aiOptions.options.length} options`);

      return {
        ...hardcodedRec,
        allOptions: enhancedOptions,
        recommendation: aiOptions.options.find(o => o.recommended)?.note || hardcodedRec.recommendation,
      };
    }
  } catch (error) {
    console.log(`[TransportService] AI enhancement failed, using hardcoded:`, error);
  }

  // AI failed or no results - return hardcoded (still works!)
  return hardcodedRec;
}

/**
 * Get intra-city transport info for a destination
 */
export function getIntraCityTransport(destination: string) {
  const regional = getRegionalTransport(destination);
  return {
    options: regional.intraCityOptions,
    note: regional.intraCityNote,
    rideshareApps: regional.rideshareApps,
  };
}

/**
 * Check if a route is domestic
 */
export function isDomesticRoute(origin: string, destination: string): boolean {
  return isSameCountry(origin, destination);
}

/**
 * Get the region for a location
 */
export function getLocationRegion(location: string): string {
  return getRegion(location);
}
