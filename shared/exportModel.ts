/**
 * exportModel.ts
 *
 * Normalized data model for PDF export.
 * Decouples PDF rendering from raw database schema.
 *
 * Used by:
 * - Server: GET /api/trips/:id/export.pdf
 * - Client: (future) client-side preview
 */

// ============================================================================
// TYPES
// ============================================================================

export interface TripExportModel {
  meta: {
    tripId: number;
    generatedAtISO: string;
    title: string;
    shareUrl?: string;
    /** If itinerary destination differs from stated destination */
    destinationMismatch?: {
      stated: string;
      detected: string;
    };
  };
  inputs: {
    from?: string;
    to: string;
    startDate: string;
    endDate: string;
    travelers: number;
    passport: string;
    budget: number | null;
    currency: string;
    travelStyle?: string;
  };
  certainty: {
    score: number | null;
    label: "high" | "medium" | "low" | "unavailable";
    visaRisk: "low" | "medium" | "high" | "unavailable";
    bufferDays: number | null;
    summaryLine?: string;
  };
  visa: {
    statusLabel: string;
    required: boolean;
    processingDays: string | null;
    fee: string | null;
    requirements: Array<{
      label: string;
      status: "required" | "recommended" | "optional";
    }>;
  };
  costs: {
    currency: string;
    currencySymbol: string;
    rows: Array<{
      label: string;
      amount: number | null;
      note?: string;
    }>;
    total: number | null;
    perPerson: number | null;
    pricingNote?: string;
  };
  itinerary: Array<{
    dayIndex: number;
    dateLabel: string;
    cityLabel: string;
    /** The full day title/theme (e.g., "Arrival & Riverside Serenity") */
    dayTitle?: string;
    dayCost: number | null;
    sections: Array<{
      label: "Morning" | "Afternoon" | "Evening";
      items: Array<{
        time: string;
        title: string;
        location?: string;
        cost: number | null;
        notes?: string;
      }>;
    }>;
  }>;
  actionItems: Array<{
    group: string;
    items: Array<{
      label: string;
      isRequired: boolean;
    }>;
  }>;
  footnotes: string[];
}

// ============================================================================
// CURRENCY HELPERS
// ============================================================================

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', KRW: '₩', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  MXN: '$', BRL: 'R$', AED: 'د.إ', SAR: '﷼', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
};

function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] || currency || '$';
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Parse trip dates string into start and end dates
 * Format: "2026-03-04 to 2026-03-09" or "2026-03-04 - 2026-03-09"
 */
function parseTripDates(dates: string): { start: string; end: string } | null {
  try {
    const parts = dates.split(/\s+to\s+|\s+-\s+/);
    if (parts.length !== 2) return null;
    return { start: parts[0].trim(), end: parts[1].trim() };
  } catch {
    return null;
  }
}

/**
 * Format date for display (e.g., "Mon, Mar 4, 2026")
 */
function formatDateLabel(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculate number of days between two dates
 */
function calculateBufferDays(startDate: string, endDate: string): number {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

// ============================================================================
// CERTAINTY HELPERS
// ============================================================================

function getCertaintyLabel(score: number | null): "high" | "medium" | "low" | "unavailable" {
  if (score === null || score === undefined) return "unavailable";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function getVisaRisk(visaDetails: any): "low" | "medium" | "high" | "unavailable" {
  if (!visaDetails) return "unavailable";
  const type = visaDetails.type;
  if (type === 'visa_free' || type === 'visa_on_arrival') return "low";
  if (type === 'e_visa') return "medium";
  if (type === 'embassy_visa' || type === 'not_allowed') return "high";
  return "unavailable";
}

// ============================================================================
// VISA HELPERS
// ============================================================================

function getVisaStatusLabel(visaDetails: any): string {
  if (!visaDetails) return "Unknown";

  const typeLabels: Record<string, string> = {
    'visa_free': 'Visa-free entry',
    'visa_on_arrival': 'Visa on arrival',
    'e_visa': 'E-Visa required',
    'embassy_visa': 'Embassy visa required',
    'not_allowed': 'Entry not allowed',
  };

  return typeLabels[visaDetails.type] || 'Unknown';
}

function formatProcessingDays(processingDays: any): string | null {
  if (!processingDays) return null;
  const { minimum, maximum } = processingDays;
  if (minimum === 0 && maximum === 0) return "Instant";
  if (minimum === maximum) return `${minimum} days`;
  return `${minimum}-${maximum} days`;
}

function formatVisaFee(cost: any, currency: string): string | null {
  if (!cost) return null;
  const symbol = getCurrencySymbol(cost.currency || currency);
  if (cost.totalPerPerson) {
    return `${symbol}${cost.totalPerPerson} per person`;
  }
  if (cost.government) {
    return `${symbol}${cost.government}`;
  }
  return null;
}

// ============================================================================
// ITINERARY HELPERS
// ============================================================================

type TimeSlot = "Morning" | "Afternoon" | "Evening";

function getTimeSlot(time: string): TimeSlot {
  try {
    const hour = parseInt(time.split(':')[0], 10);
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    return "Evening";
  } catch {
    return "Morning";
  }
}

/**
 * Compute date label from canonical start date + day index.
 * This ensures all displayed dates are derived from the same source.
 */
function computeDateLabelFromStart(startDate: string, dayIndex: number): string {
  try {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return `Day ${dayIndex + 1}`;
    start.setDate(start.getDate() + dayIndex);
    return formatDateLabel(start.toISOString().split('T')[0]);
  } catch {
    return `Day ${dayIndex + 1}`;
  }
}

/**
 * Extract dominant city/country from itinerary days.
 * Used to detect destination mismatches.
 */
function extractDominantDestination(itinerary: any): string | null {
  if (!itinerary?.days?.length) return null;

  const cityCount: Record<string, number> = {};
  const KNOWN_CITIES = [
    'Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Krabi', 'Ayutthaya', // Thailand
    'Tokyo', 'Osaka', 'Kyoto', 'Hiroshima', 'Nara', 'Fukuoka', // Japan
    'Paris', 'Nice', 'Lyon', 'Marseille', // France
    'Rome', 'Florence', 'Venice', 'Milan', 'Naples', // Italy
    'London', 'Edinburgh', 'Manchester', // UK
    'New York', 'Los Angeles', 'San Francisco', 'Miami', 'Las Vegas', // USA
    'Singapore', 'Kuala Lumpur', 'Bali', 'Jakarta', 'Hanoi', 'Ho Chi Minh', // SEA
    'Barcelona', 'Madrid', 'Seville', // Spain
    'Berlin', 'Munich', 'Frankfurt', // Germany
    'Sydney', 'Melbourne', 'Auckland', // ANZ
    'Dubai', 'Abu Dhabi', 'Istanbul', 'Cairo', // Middle East
    'Mumbai', 'Delhi', 'Jaipur', 'Goa', // India
  ];

  for (const day of itinerary.days) {
    const title = day.title || '';
    for (const city of KNOWN_CITIES) {
      if (title.toLowerCase().includes(city.toLowerCase())) {
        cityCount[city] = (cityCount[city] || 0) + 1;
      }
    }
  }

  // Return most frequent city
  const entries = Object.entries(cityCount);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/**
 * Check if two destinations match (handles partial matches)
 * e.g., "Thailand" matches "Bangkok", "Japan" matches "Tokyo"
 */
function destinationsMatch(stated: string, detected: string): boolean {
  if (!stated || !detected) return true; // Can't determine, assume match

  const statedLower = stated.toLowerCase();
  const detectedLower = detected.toLowerCase();

  // Direct match
  if (statedLower.includes(detectedLower) || detectedLower.includes(statedLower)) {
    return true;
  }

  // Country-city mappings
  const countryToCities: Record<string, string[]> = {
    'thailand': ['bangkok', 'chiang mai', 'phuket', 'pattaya', 'krabi', 'ayutthaya'],
    'japan': ['tokyo', 'osaka', 'kyoto', 'hiroshima', 'nara', 'fukuoka'],
    'france': ['paris', 'nice', 'lyon', 'marseille'],
    'italy': ['rome', 'florence', 'venice', 'milan', 'naples'],
    'spain': ['barcelona', 'madrid', 'seville'],
    'germany': ['berlin', 'munich', 'frankfurt'],
    'india': ['mumbai', 'delhi', 'jaipur', 'goa'],
    'usa': ['new york', 'los angeles', 'san francisco', 'miami', 'las vegas'],
    'united states': ['new york', 'los angeles', 'san francisco', 'miami', 'las vegas'],
  };

  // Check if stated country contains detected city
  for (const [country, cities] of Object.entries(countryToCities)) {
    if (statedLower.includes(country) && cities.some(c => detectedLower.includes(c))) {
      return true;
    }
    // Or vice versa
    if (detectedLower.includes(country) && cities.some(c => statedLower.includes(c))) {
      return true;
    }
  }

  return false;
}

/**
 * Extract city from a title string using known cities list
 */
function extractCityFromTitle(title: string): string | null {
  if (!title) return null;

  const KNOWN_CITIES = [
    'Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Krabi', 'Ayutthaya', 'Koh Samui', 'Hua Hin',
    'Tokyo', 'Osaka', 'Kyoto', 'Hiroshima', 'Nara', 'Fukuoka', 'Yokohama', 'Kobe', 'Sapporo',
    'Paris', 'Nice', 'Lyon', 'Marseille', 'Bordeaux', 'Toulouse',
    'Rome', 'Florence', 'Venice', 'Milan', 'Naples', 'Amalfi', 'Positano', 'Capri',
    'London', 'Edinburgh', 'Manchester', 'Liverpool', 'Oxford', 'Cambridge', 'Bath',
    'New York', 'Los Angeles', 'San Francisco', 'Miami', 'Las Vegas', 'Chicago', 'Boston', 'Seattle',
    'Singapore', 'Kuala Lumpur', 'Bali', 'Jakarta', 'Hanoi', 'Ho Chi Minh', 'Saigon', 'Da Nang', 'Hoi An',
    'Barcelona', 'Madrid', 'Seville', 'Granada', 'Valencia', 'Malaga',
    'Berlin', 'Munich', 'Frankfurt', 'Hamburg', 'Cologne', 'Dresden',
    'Sydney', 'Melbourne', 'Auckland', 'Brisbane', 'Perth', 'Adelaide',
    'Dubai', 'Abu Dhabi', 'Istanbul', 'Cairo', 'Marrakech', 'Fez',
    'Mumbai', 'Delhi', 'Jaipur', 'Goa', 'Agra', 'Udaipur', 'Varanasi',
    'Hong Kong', 'Macau', 'Taipei', 'Seoul', 'Busan', 'Beijing', 'Shanghai', 'Shenzhen',
    'Athens', 'Santorini', 'Mykonos', 'Crete', 'Prague', 'Vienna', 'Budapest', 'Amsterdam',
    'Lisbon', 'Porto', 'Dublin', 'Reykjavik', 'Copenhagen', 'Stockholm', 'Oslo', 'Helsinki',
    'Cancun', 'Mexico City', 'Tulum', 'Rio de Janeiro', 'Sao Paulo', 'Buenos Aires', 'Lima', 'Bogota',
    'Cape Town', 'Johannesburg', 'Nairobi', 'Zanzibar', 'Marrakesh',
  ];

  const titleLower = title.toLowerCase();
  for (const city of KNOWN_CITIES) {
    if (titleLower.includes(city.toLowerCase())) {
      return city;
    }
  }

  return null;
}

/**
 * Generate a stable key for de-duplication
 */
function getActivityKey(activity: any): string {
  const time = activity.time || '';
  const title = (activity.name || activity.description || '').toLowerCase().trim();
  const location = typeof activity.location === 'string'
    ? activity.location.toLowerCase().trim()
    : (activity.location?.address || '').toLowerCase().trim();
  const cost = activity.estimatedCost || activity.cost || 0;
  return `${time}|${title}|${location}|${cost}`;
}

/**
 * De-duplicate activities within a day before bucketing
 */
function dedupeActivities(activities: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];

  for (const activity of activities) {
    const key = getActivityKey(activity);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(activity);
    }
  }

  return result;
}

function bucketActivities(activities: any[]): Record<TimeSlot, any[]> {
  const buckets: Record<TimeSlot, any[]> = {
    Morning: [],
    Afternoon: [],
    Evening: [],
  };

  // De-dupe before bucketing
  const dedupedActivities = dedupeActivities(activities);

  for (const activity of dedupedActivities) {
    const slot = getTimeSlot(activity.time || "09:00");
    buckets[slot].push(activity);
  }

  return buckets;
}

// ============================================================================
// ACTION ITEMS HELPERS
// ============================================================================

interface ActionItemDef {
  key: string;
  label: string;
  category: "before_departure" | "upon_arrival" | "during_trip";
  isRequired: boolean;
}

function buildActionItems(trip: any): Array<{ group: string; items: Array<{ label: string; isRequired: boolean }> }> {
  const items: ActionItemDef[] = [];
  const report = trip.feasibilityReport as any;
  const visaDetails = report?.visaDetails;

  // Visa application (if required)
  if (visaDetails?.required && visaDetails.type !== 'visa_free' && visaDetails.type !== 'visa_on_arrival') {
    items.push({
      key: 'visa',
      label: `Apply for ${visaDetails.name || 'visa'}`,
      category: 'before_departure',
      isRequired: true,
    });
  }

  // Passport validity
  items.push({
    key: 'passport',
    label: 'Check passport validity (6+ months)',
    category: 'before_departure',
    isRequired: true,
  });

  // Book flights
  items.push({
    key: 'flights',
    label: 'Book flights',
    category: 'before_departure',
    isRequired: false,
  });

  // Book accommodation
  items.push({
    key: 'accommodation',
    label: 'Reserve accommodation',
    category: 'before_departure',
    isRequired: false,
  });

  // Travel insurance
  items.push({
    key: 'insurance',
    label: 'Get travel insurance',
    category: 'before_departure',
    isRequired: false,
  });

  // Notify bank
  items.push({
    key: 'bank',
    label: 'Notify bank of travel',
    category: 'before_departure',
    isRequired: false,
  });

  // Mobile data
  items.push({
    key: 'mobile',
    label: 'Arrange mobile data (eSIM/local SIM)',
    category: 'upon_arrival',
    isRequired: false,
  });

  // Local currency
  items.push({
    key: 'currency',
    label: 'Get local currency',
    category: 'upon_arrival',
    isRequired: false,
  });

  // Group by category
  const groups: Record<string, Array<{ label: string; isRequired: boolean }>> = {
    'Before Departure': [],
    'Upon Arrival': [],
    'During Trip': [],
  };

  const categoryMap: Record<string, string> = {
    'before_departure': 'Before Departure',
    'upon_arrival': 'Upon Arrival',
    'during_trip': 'During Trip',
  };

  for (const item of items) {
    const groupName = categoryMap[item.category];
    groups[groupName].push({ label: item.label, isRequired: item.isRequired });
  }

  // Return non-empty groups
  return Object.entries(groups)
    .filter(([_, items]) => items.length > 0)
    .map(([group, items]) => ({ group, items }));
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build a normalized TripExportModel from raw trip data.
 * This is the single source of truth for PDF export data.
 */
export function buildTripExportModel(trip: any, baseUrl?: string): TripExportModel {
  const report = trip.feasibilityReport as any;
  const visaDetails = report?.visaDetails;
  const itinerary = trip.itinerary as any;
  const costBreakdown = itinerary?.costBreakdown;
  const currency = trip.currency || 'USD';
  const currencySymbol = getCurrencySymbol(currency);

  // Parse dates
  const parsedDates = parseTripDates(trip.dates);
  const startDate = parsedDates?.start || trip.dates;
  const endDate = parsedDates?.end || trip.dates;

  // Standard cost categories - always show these for structured report feel
  const STANDARD_CATEGORIES = [
    { key: 'flights', label: 'Flights' },
    { key: 'accommodation', label: 'Accommodation' },
    { key: 'food', label: 'Food & Dining' },
    { key: 'activities', label: 'Activities' },
    { key: 'localTransport', label: 'Local Transport' },
    { key: 'intercityTransport', label: 'Intercity Transport' },
    { key: 'misc', label: 'Miscellaneous' },
  ];

  // Build cost rows - always include standard categories
  const costRows: Array<{ label: string; amount: number | null; note?: string }> = [];

  for (const cat of STANDARD_CATEGORIES) {
    const catData = costBreakdown?.[cat.key];
    if (catData && typeof catData === 'object' && 'total' in catData) {
      costRows.push({
        label: cat.label,
        amount: catData.total || null,
        note: catData.note,
      });
    } else {
      // Show category with null amount for structured appearance
      costRows.push({
        label: cat.label,
        amount: null,
      });
    }
  }

  // Add visa row if we have visa details
  if (visaDetails?.cost?.totalPerPerson) {
    costRows.push({
      label: 'Visa',
      amount: visaDetails.cost.totalPerPerson * (trip.groupSize || 1),
      note: `${currencySymbol}${visaDetails.cost.totalPerPerson} per person`,
    });
  } else if (visaDetails?.required) {
    // Visa required but no cost data
    costRows.push({
      label: 'Visa',
      amount: null,
      note: 'Cost varies by application type',
    });
  }

  // Build itinerary sections with city fallback
  const itinerarySections: TripExportModel['itinerary'] = [];

  // Extract primary city from trip destination for fallback
  const primaryCity = extractCityFromTitle(trip.destination) || trip.destination?.split(',')[0]?.trim() || '';

  // Track last known city for fallback
  let lastKnownCity = primaryCity;

  if (itinerary?.days) {
    for (let i = 0; i < itinerary.days.length; i++) {
      const day = itinerary.days[i];
      const activities = day.activities || [];
      const bucketed = bucketActivities(activities);

      // Calculate day cost
      let dayCost: number | null = null;
      const activityCosts = activities
        .map((a: any) => a.estimatedCost || a.cost || 0)
        .filter((c: number) => c > 0);
      if (activityCosts.length > 0) {
        dayCost = activityCosts.reduce((sum: number, c: number) => sum + c, 0);
      }

      // Build sections
      const sections: TripExportModel['itinerary'][number]['sections'] = [];
      for (const slot of ['Morning', 'Afternoon', 'Evening'] as TimeSlot[]) {
        const slotActivities = bucketed[slot];
        if (slotActivities.length > 0) {
          sections.push({
            label: slot,
            items: slotActivities.map((a: any) => ({
              time: a.time || '',
              title: a.name || a.description || 'Activity',
              location: typeof a.location === 'string' ? a.location : a.location?.address,
              cost: a.estimatedCost || a.cost || null,
              notes: a.bookingTip || a.costNote,
            })),
          });
        }
      }

      // Extract city from title with fallback chain:
      // 1. Try to find known city in day title
      // 2. Fall back to previous day's city
      // 3. Fall back to trip's primary city
      const dayTitle = day.title || '';
      let extractedCity = extractCityFromTitle(dayTitle);

      if (extractedCity) {
        lastKnownCity = extractedCity; // Update for next day's fallback
      } else {
        extractedCity = lastKnownCity; // Use fallback
      }

      // cityLabel is the detected city (e.g., "Bangkok")
      // dayTitle is the full theme (e.g., "Arrival & Riverside Serenity")
      const cityLabel = extractedCity || dayTitle.split(' - ')[0] || `Day ${i + 1}`;

      // Extract description by removing city from title
      let dayTitleClean = dayTitle;
      if (extractedCity && dayTitle.toLowerCase().includes(extractedCity.toLowerCase())) {
        // Remove city and clean up separators
        dayTitleClean = dayTitle
          .replace(new RegExp(extractedCity, 'gi'), '')
          .replace(/^[\s\-–—:&·]+/, '')
          .replace(/[\s\-–—:&·]+$/, '')
          .trim();
      }

      // ALWAYS compute date from canonical startDate + dayIndex
      // This ensures header dates and itinerary dates are aligned
      const dateLabel = computeDateLabelFromStart(startDate, i);

      itinerarySections.push({
        dayIndex: i + 1,
        dateLabel,
        cityLabel,
        dayTitle: dayTitleClean || undefined,
        dayCost,
        sections,
      });
    }
  }

  // Detect destination mismatch
  const detectedDestination = extractDominantDestination(itinerary);
  const hasMismatch = detectedDestination && !destinationsMatch(trip.destination, detectedDestination);
  const destinationMismatch = hasMismatch
    ? { stated: trip.destination, detected: detectedDestination! }
    : undefined;

  // Build visa requirements
  const visaRequirements: TripExportModel['visa']['requirements'] = [];
  if (visaDetails?.documentsRequired) {
    for (const doc of visaDetails.documentsRequired) {
      visaRequirements.push({
        label: doc,
        status: 'required',
      });
    }
  }

  // Build footnotes
  const footnotes: string[] = [];
  if (report?.generatedAt) {
    footnotes.push(`Feasibility analysis generated: ${formatDateLabel(report.generatedAt)}`);
  }
  if (costBreakdown?.pricingNote) {
    footnotes.push(costBreakdown.pricingNote);
  }

  // Check for cost total vs breakdown mismatch
  const hasItemizedCosts = costRows.some(r => r.amount !== null);
  const itemizedTotal = costRows.reduce((sum, r) => sum + (r.amount || 0), 0);
  if (costBreakdown?.grandTotal && !hasItemizedCosts) {
    footnotes.push('Total includes additional categories not itemized in this export.');
  } else if (costBreakdown?.grandTotal && hasItemizedCosts && Math.abs(itemizedTotal - costBreakdown.grandTotal) > 10) {
    footnotes.push('Total includes additional costs beyond itemized categories.');
  }

  // Add destination mismatch warning
  if (destinationMismatch) {
    footnotes.push(`Note: Stated destination (${destinationMismatch.stated}) differs from itinerary content (${destinationMismatch.detected}). This may indicate stale data.`);
  }

  footnotes.push('Prices are estimates and may vary. Verify with official sources before booking.');

  // Format dates for title (e.g., "Mar 4-10, 2026")
  const formatDateRange = (start: string, end: string): string => {
    try {
      const startD = new Date(start);
      const endD = new Date(end);
      const startMonth = startD.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = endD.toLocaleDateString('en-US', { month: 'short' });
      const startDay = startD.getDate();
      const endDay = endD.getDate();
      const year = endD.getFullYear();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay}–${endDay}, ${year}`;
      }
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
    } catch {
      return `${start} to ${end}`;
    }
  };

  return {
    meta: {
      tripId: trip.id,
      generatedAtISO: new Date().toISOString(),
      // Deterministic title from destination + dates (not custom trip name)
      title: `${trip.destination} · ${formatDateRange(startDate, endDate)}`,
      shareUrl: baseUrl ? `${baseUrl}/trips/${trip.id}/results-v1` : undefined,
      destinationMismatch,
    },
    inputs: {
      from: trip.origin || undefined,
      to: trip.destination,
      startDate,
      endDate,
      travelers: trip.groupSize || 1,
      passport: trip.passport,
      budget: trip.budget,
      currency,
      travelStyle: trip.travelStyle || undefined,
    },
    certainty: {
      score: report?.score ?? null,
      label: getCertaintyLabel(report?.score),
      visaRisk: getVisaRisk(visaDetails),
      bufferDays: parsedDates ? calculateBufferDays(parsedDates.start, parsedDates.end) : null,
      summaryLine: report?.summary,
    },
    visa: {
      statusLabel: getVisaStatusLabel(visaDetails),
      required: visaDetails?.required ?? false,
      processingDays: formatProcessingDays(visaDetails?.processingDays),
      fee: formatVisaFee(visaDetails?.cost, currency),
      requirements: visaRequirements,
    },
    costs: {
      currency,
      currencySymbol,
      rows: costRows,
      total: costBreakdown?.grandTotal ?? null,
      // Always calculate perPerson from grandTotal / groupSize to ensure correctness
      // When groupSize is 1, perPerson equals total (will be hidden in UI)
      perPerson: costBreakdown?.grandTotal
        ? Math.round(costBreakdown.grandTotal / (trip.groupSize || 1))
        : null,
      pricingNote: costBreakdown?.pricingNote,
    },
    itinerary: itinerarySections,
    actionItems: buildActionItems(trip),
    footnotes,
  };
}
