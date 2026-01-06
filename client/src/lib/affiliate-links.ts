/**
 * Affiliate Booking Links Configuration
 *
 * This module generates affiliate links for flights, hotels, and activities.
 * Replace the placeholder affiliate IDs with your actual IDs when you sign up
 * for each affiliate program.
 *
 * Affiliate Programs to Sign Up:
 * - Skyscanner: https://partners.skyscanner.net/
 * - Booking.com: https://www.booking.com/affiliate-program.html
 * - Viator: https://www.viator.com/affiliates
 * - GetYourGuide: https://partner.getyourguide.com/
 * - Hostelworld: https://affiliates.hostelworld.com/
 * - TripAdvisor: https://www.tripadvisor.com/Affiliates
 * - Expedia: https://affiliate.expedia.com/
 */

// ============================================================================
// CONFIGURATION - Replace with your actual affiliate IDs
// ============================================================================
const AFFILIATE_CONFIG = {
  skyscanner: {
    associateId: 'voyageai_flights', // Replace with your Skyscanner associate ID
    enabled: true,
  },
  booking: {
    affiliateId: '123456', // Replace with your Booking.com affiliate ID
    enabled: true,
  },
  viator: {
    pid: '123456', // Replace with your Viator partner ID
    enabled: true,
  },
  getYourGuide: {
    partnerId: 'voyageai', // Replace with your GetYourGuide partner ID
    enabled: true,
  },
  hostelworld: {
    affiliateId: '123456', // Replace with your Hostelworld affiliate ID
    enabled: true,
  },
  expedia: {
    affiliateId: '123456', // Replace with your Expedia affiliate ID
    enabled: true,
  },
  googleFlights: {
    // Google Flights doesn't have affiliate program but useful for comparison
    enabled: true,
  },
  kayak: {
    affiliateId: '123456', // Replace with your Kayak affiliate ID
    enabled: true,
  },
};

// ============================================================================
// AIRPORT CODES MAPPING
// ============================================================================
const CITY_TO_AIRPORT: Record<string, string> = {
  // Asia
  'tokyo': 'TYO', 'japan': 'TYO', 'narita': 'NRT', 'haneda': 'HND',
  'osaka': 'OSA', 'kyoto': 'KIX',
  'seoul': 'ICN', 'korea': 'ICN',
  'bangkok': 'BKK', 'thailand': 'BKK', 'phuket': 'HKT', 'chiang mai': 'CNX',
  'singapore': 'SIN',
  'hong kong': 'HKG',
  'kuala lumpur': 'KUL', 'malaysia': 'KUL',
  'bali': 'DPS', 'jakarta': 'CGK', 'indonesia': 'CGK',
  'manila': 'MNL', 'philippines': 'MNL', 'cebu': 'CEB',
  'hanoi': 'HAN', 'ho chi minh': 'SGN', 'vietnam': 'SGN',
  'mumbai': 'BOM', 'delhi': 'DEL', 'bangalore': 'BLR', 'india': 'DEL',
  'chennai': 'MAA', 'kolkata': 'CCU', 'hyderabad': 'HYD',
  'beijing': 'PEK', 'shanghai': 'PVG', 'china': 'PEK',
  'taipei': 'TPE', 'taiwan': 'TPE',

  // Europe
  'london': 'LON', 'uk': 'LON', 'heathrow': 'LHR', 'gatwick': 'LGW',
  'paris': 'PAR', 'france': 'CDG',
  'rome': 'FCO', 'italy': 'FCO', 'milan': 'MXP', 'venice': 'VCE', 'florence': 'FLR',
  'barcelona': 'BCN', 'madrid': 'MAD', 'spain': 'MAD',
  'amsterdam': 'AMS', 'netherlands': 'AMS',
  'berlin': 'BER', 'munich': 'MUC', 'frankfurt': 'FRA', 'germany': 'FRA',
  'vienna': 'VIE', 'austria': 'VIE',
  'prague': 'PRG', 'czech': 'PRG',
  'budapest': 'BUD', 'hungary': 'BUD',
  'lisbon': 'LIS', 'porto': 'OPO', 'portugal': 'LIS',
  'dublin': 'DUB', 'ireland': 'DUB',
  'zurich': 'ZRH', 'geneva': 'GVA', 'switzerland': 'ZRH',
  'athens': 'ATH', 'greece': 'ATH', 'santorini': 'JTR', 'mykonos': 'JMK',
  'istanbul': 'IST', 'turkey': 'IST',
  'copenhagen': 'CPH', 'denmark': 'CPH',
  'stockholm': 'ARN', 'sweden': 'ARN',
  'oslo': 'OSL', 'norway': 'OSL',
  'helsinki': 'HEL', 'finland': 'HEL',
  'reykjavik': 'KEF', 'iceland': 'KEF',
  'brussels': 'BRU', 'belgium': 'BRU',
  'warsaw': 'WAW', 'krakow': 'KRK', 'poland': 'WAW',

  // Americas
  'new york': 'NYC', 'nyc': 'JFK', 'manhattan': 'JFK',
  'los angeles': 'LAX', 'la': 'LAX',
  'san francisco': 'SFO',
  'las vegas': 'LAS',
  'miami': 'MIA',
  'chicago': 'ORD',
  'seattle': 'SEA',
  'boston': 'BOS',
  'washington': 'IAD', 'dc': 'DCA',
  'hawaii': 'HNL', 'honolulu': 'HNL',
  'toronto': 'YYZ', 'vancouver': 'YVR', 'montreal': 'YUL', 'canada': 'YYZ',
  'cancun': 'CUN', 'mexico city': 'MEX', 'mexico': 'MEX',
  'rio': 'GIG', 'sao paulo': 'GRU', 'brazil': 'GRU',
  'buenos aires': 'EZE', 'argentina': 'EZE',
  'lima': 'LIM', 'peru': 'LIM', 'cusco': 'CUZ',
  'bogota': 'BOG', 'colombia': 'BOG', 'medellin': 'MDE',

  // Middle East & Africa
  'dubai': 'DXB', 'abu dhabi': 'AUH', 'uae': 'DXB',
  'doha': 'DOH', 'qatar': 'DOH',
  'tel aviv': 'TLV', 'israel': 'TLV',
  'cairo': 'CAI', 'egypt': 'CAI',
  'marrakech': 'RAK', 'casablanca': 'CMN', 'morocco': 'CMN',
  'cape town': 'CPT', 'johannesburg': 'JNB', 'south africa': 'JNB',
  'nairobi': 'NBO', 'kenya': 'NBO',

  // Oceania
  'sydney': 'SYD', 'melbourne': 'MEL', 'brisbane': 'BNE', 'perth': 'PER', 'australia': 'SYD',
  'auckland': 'AKL', 'wellington': 'WLG', 'queenstown': 'ZQN', 'new zealand': 'AKL',

  // Islands
  'maldives': 'MLE',
  'fiji': 'NAN',
  'mauritius': 'MRU',
  'seychelles': 'SEZ',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get airport code from city name
 */
export function getAirportCode(city: string): string {
  const cityLower = city.toLowerCase().trim();

  // Direct match
  if (CITY_TO_AIRPORT[cityLower]) {
    return CITY_TO_AIRPORT[cityLower];
  }

  // Partial match
  for (const [key, code] of Object.entries(CITY_TO_AIRPORT)) {
    if (cityLower.includes(key) || key.includes(cityLower)) {
      return code;
    }
  }

  // Default: return first 3 letters uppercase as fallback
  return city.substring(0, 3).toUpperCase();
}

/**
 * Parse date range string to get departure and return dates
 */
function parseDateRange(dates: string): { departure: string; return: string } | null {
  if (!dates) return null;

  const parts = dates.split(' - ');
  if (parts.length !== 2) return null;

  try {
    const from = new Date(parts[0]);
    const to = new Date(parts[1]);

    // Format as YYYY-MM-DD
    const departure = from.toISOString().split('T')[0];
    const returnDate = to.toISOString().split('T')[0];

    return { departure, return: returnDate };
  } catch {
    return null;
  }
}

/**
 * Format date for different affiliate link formats
 */
function formatDate(date: string, format: 'YYMMDD' | 'YYYY-MM-DD' | 'DDMMYYYY'): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYMMDD':
      return `${String(year).slice(2)}${month}${day}`;
    case 'DDMMYYYY':
      return `${day}${month}${year}`;
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`;
  }
}

// ============================================================================
// BOOKING LINK GENERATORS
// ============================================================================

export interface TripParams {
  origin: string;
  destination: string;
  dates: string;
  adults?: number;
  children?: number;
  infants?: number;
  currency?: string;
}

export interface BookingLinks {
  flights: {
    skyscanner?: string;
    googleFlights?: string;
    kayak?: string;
  };
  hotels: {
    booking?: string;
    hostelworld?: string;
    expedia?: string;
  };
  activities: {
    viator?: string;
    getYourGuide?: string;
  };
}

/**
 * Generate Skyscanner flight search link
 */
export function getSkyscannerLink(params: TripParams): string {
  const originCode = getAirportCode(params.origin);
  const destCode = getAirportCode(params.destination);
  const dateRange = parseDateRange(params.dates);
  const adults = params.adults || 1;
  const children = params.children || 0;

  if (!dateRange) {
    // Fallback to general search
    return `https://www.skyscanner.com/transport/flights/${originCode}/${destCode}/?adultsv2=${adults}&cabinclass=economy&childrenv2=${children > 0 ? Array(children).fill('8').join('%7C') : ''}&ref=home&rtn=1&preferdirects=false&outboundaltsen498;enabled=false&inboundaltsenabled=false&associateid=${AFFILIATE_CONFIG.skyscanner.associateId}`;
  }

  const outDate = formatDate(dateRange.departure, 'YYMMDD');
  const inDate = formatDate(dateRange.return, 'YYMMDD');

  return `https://www.skyscanner.com/transport/flights/${originCode}/${destCode}/${outDate}/${inDate}/?adultsv2=${adults}&cabinclass=economy&childrenv2=${children > 0 ? Array(children).fill('8').join('%7C') : ''}&ref=home&rtn=1&associateid=${AFFILIATE_CONFIG.skyscanner.associateId}`;
}

/**
 * Generate Google Flights search link
 */
export function getGoogleFlightsLink(params: TripParams): string {
  const originCode = getAirportCode(params.origin);
  const destCode = getAirportCode(params.destination);
  const dateRange = parseDateRange(params.dates);
  const adults = params.adults || 1;
  const children = params.children || 0;

  const currency = params.currency || 'USD';

  if (!dateRange) {
    return `https://www.google.com/travel/flights?hl=en&curr=${currency}&q=flights%20from%20${encodeURIComponent(params.origin)}%20to%20${encodeURIComponent(params.destination)}`;
  }

  // Google Flights TFS format
  return `https://www.google.com/travel/flights?hl=en&gl=us&curr=${currency}&tfs=CBwQAhoeEgoyMDI2LTAxLTAxagcIARID${originCode}cgcIARID${destCode}Gh4SCjIwMjYtMDEtMTBqBwgBEgN${destCode}cgcIARID${originCode}QgIBAUgBcAGYAQE&tfu=EgIIAQ`;
}

/**
 * Generate Kayak flight search link
 */
export function getKayakLink(params: TripParams): string {
  const originCode = getAirportCode(params.origin);
  const destCode = getAirportCode(params.destination);
  const dateRange = parseDateRange(params.dates);
  const adults = params.adults || 1;

  if (!dateRange) {
    return `https://www.kayak.com/flights/${originCode}-${destCode}?sort=bestflight_a&fs=stops=0`;
  }

  return `https://www.kayak.com/flights/${originCode}-${destCode}/${dateRange.departure}/${dateRange.return}/${adults}adults?sort=bestflight_a`;
}

/**
 * Generate Booking.com hotel search link
 */
export function getBookingLink(params: TripParams): string {
  const dateRange = parseDateRange(params.dates);
  const adults = params.adults || 1;
  const children = params.children || 0;
  const rooms = Math.ceil((adults + children) / 2); // Estimate rooms needed

  const dest = encodeURIComponent(params.destination);

  let url = `https://www.booking.com/searchresults.html?ss=${dest}&group_adults=${adults}&no_rooms=${rooms}&group_children=${children}&aid=${AFFILIATE_CONFIG.booking.affiliateId}`;

  if (dateRange) {
    url += `&checkin=${dateRange.departure}&checkout=${dateRange.return}`;
  }

  return url;
}

/**
 * Generate Hostelworld search link
 */
export function getHostelworldLink(params: TripParams): string {
  const dateRange = parseDateRange(params.dates);
  const dest = encodeURIComponent(params.destination.split(',')[0].trim());

  let url = `https://www.hostelworld.com/s?q=${dest}&guests=${params.adults || 1}`;

  if (dateRange) {
    url += `&dateFrom=${dateRange.departure}&dateTo=${dateRange.return}`;
  }

  return url;
}

/**
 * Generate Expedia hotel search link
 */
export function getExpediaLink(params: TripParams): string {
  const dateRange = parseDateRange(params.dates);
  const dest = encodeURIComponent(params.destination);
  const adults = params.adults || 1;

  let url = `https://www.expedia.com/Hotel-Search?destination=${dest}&adults=${adults}`;

  if (dateRange) {
    url += `&startDate=${dateRange.departure}&endDate=${dateRange.return}`;
  }

  return url;
}

/**
 * Generate Viator activities search link
 */
export function getViatorLink(params: TripParams): string {
  const dest = encodeURIComponent(params.destination.split(',')[0].trim());

  return `https://www.viator.com/searchResults/all?text=${dest}&pid=${AFFILIATE_CONFIG.viator.pid}`;
}

/**
 * Generate GetYourGuide activities search link
 */
export function getGetYourGuideLink(params: TripParams): string {
  const dest = encodeURIComponent(params.destination.split(',')[0].trim());
  const dateRange = parseDateRange(params.dates);

  let url = `https://www.getyourguide.com/s/?q=${dest}&partner_id=${AFFILIATE_CONFIG.getYourGuide.partnerId}`;

  if (dateRange) {
    url += `&date_from=${dateRange.departure}&date_to=${dateRange.return}`;
  }

  return url;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Generate all booking links for a trip
 */
export function generateBookingLinks(params: TripParams): BookingLinks {
  return {
    flights: {
      skyscanner: AFFILIATE_CONFIG.skyscanner.enabled ? getSkyscannerLink(params) : undefined,
      googleFlights: AFFILIATE_CONFIG.googleFlights.enabled ? getGoogleFlightsLink(params) : undefined,
      kayak: AFFILIATE_CONFIG.kayak.enabled ? getKayakLink(params) : undefined,
    },
    hotels: {
      booking: AFFILIATE_CONFIG.booking.enabled ? getBookingLink(params) : undefined,
      hostelworld: AFFILIATE_CONFIG.hostelworld.enabled ? getHostelworldLink(params) : undefined,
      expedia: AFFILIATE_CONFIG.expedia.enabled ? getExpediaLink(params) : undefined,
    },
    activities: {
      viator: AFFILIATE_CONFIG.viator.enabled ? getViatorLink(params) : undefined,
      getYourGuide: AFFILIATE_CONFIG.getYourGuide.enabled ? getGetYourGuideLink(params) : undefined,
    },
  };
}

// ============================================================================
// CLICK TRACKING
// ============================================================================

export interface ClickEvent {
  tripId: number;
  linkType: 'flight' | 'hotel' | 'activity';
  provider: string;
  url: string;
  timestamp: Date;
}

/**
 * Track affiliate link click
 * Sends click data to server for analytics
 */
export function trackAffiliateClick(event: ClickEvent): void {
  // Log for development
  console.log('[Affiliate Click]', {
    tripId: event.tripId,
    type: event.linkType,
    provider: event.provider,
    timestamp: event.timestamp.toISOString(),
  });

  // Send to analytics API (fire and forget)
  fetch('/api/analytics/affiliate-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tripId: event.tripId,
      linkType: event.linkType,
      provider: event.provider,
      url: event.url,
    }),
  }).catch(err => {
    // Silent fail - don't block user interaction
    console.warn('Failed to track affiliate click:', err);
  });

  // Also track in Google Analytics if available
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'affiliate_click', {
      event_category: 'booking',
      event_label: event.provider,
      link_type: event.linkType,
      trip_id: event.tripId,
    });
  }
}

/**
 * Open affiliate link with tracking
 */
export function openAffiliateLink(
  url: string,
  tripId: number,
  linkType: 'flight' | 'hotel' | 'activity',
  provider: string
): void {
  // Track the click
  trackAffiliateClick({
    tripId,
    linkType,
    provider,
    url,
    timestamp: new Date(),
  });

  // Open in new tab
  window.open(url, '_blank', 'noopener,noreferrer');
}
