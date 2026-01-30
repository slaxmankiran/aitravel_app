import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { VisaDetails } from '@shared/schema';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Corridor Data Service
 *
 * Provides curated, verified visa and travel data for specific passport→destination corridors.
 * This data takes precedence over AI-generated information when available.
 */

export interface CorridorVisa {
  required: boolean;
  type: 'visa_free' | 'visa_on_arrival' | 'e_visa' | 'embassy_visa' | 'not_allowed';
  name: string;
  processingDays: {
    minimum: number;
    maximum: number;
    expedited?: number;
    note?: string;
  };
  cost: {
    government: number;
    service?: number;
    expedited?: number;
    currency: string;
    note?: string;
  };
  documentsRequired: string[];
  applicationMethod: 'online' | 'embassy' | 'vfs' | 'on_arrival' | 'none';
  applicationUrl?: string;
  embassyUrl?: string;
  notes?: string[];
  alternatives?: Record<string, any>;
  etias?: {
    launching: string;
    cost: number;
    currency: string;
    validity: string;
    processingTime: string;
    applicationUrl: string;
    note: string;
  };
}

export interface CorridorCostEstimate {
  currency: string;
  budget: {
    daily: Record<string, number>;
    total7Days: number;
  };
  mid: {
    daily: Record<string, number>;
    total7Days: number;
  };
  luxury: {
    daily: Record<string, number>;
    total7Days: number;
  };
  flights: {
    budget: number;
    average: number;
    premium: number;
    note?: string;
  };
}

export interface CorridorData {
  corridor: {
    passport: string;
    passportCode: string;
    destination: string;
    destinationCode: string;
    destinationCountries?: string[];
  };
  lastVerified: string;
  source: string;
  visa: CorridorVisa;
  entryRequirements: {
    passportValidity: string;
    blankPages: number;
    returnTicket: boolean;
    proofOfAccommodation: boolean;
    proofOfFunds: boolean;
    proofOfFundsAmount?: {
      perPerson?: number;
      perFamily?: number;
      recommended?: number;
      perDay?: boolean;
      currency: string;
      note?: string;
    };
    travelInsurance: {
      required: boolean;
      recommended: boolean;
      minimumCoverage: number;
      currency: string;
      note?: string;
    };
  };
  stayLimits: {
    maxStay?: number;
    voaMaxStay?: number;
    touristVisaMaxStay?: number;
    period?: number;
    extendable: boolean;
    extensionDays?: number;
    extensionCost?: number;
    extensionCurrency?: string;
    extensionProcess?: string;
    overstayConsequences?: string;
    note?: string;
  };
  costEstimates: CorridorCostEstimate;
  tips: string[];
  popularDestinations?: Array<{
    country: string;
    cities: string[];
    highlights: string[];
  }>;
}

// Normalize country/passport names for matching
function normalizeLocation(name: string): string {
  return name.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z]/g, '')
    .replace(/unitedstatesofamerica|unitedstates|usa/g, 'us')
    .replace(/unitedkingdom|uk|greatbritain/g, 'uk')
    .replace(/schengenarea|schengenstates|schengenzone/g, 'schengen');
}

// Map of normalized names to corridor file names
const CORRIDOR_MAP: Record<string, string> = {
  // India corridors
  'india-japan': 'india-japan.json',
  'in-jp': 'india-japan.json',
  'india-thailand': 'india-thailand.json',
  'in-th': 'india-thailand.json',

  // US corridors
  'us-schengen': 'us-schengen.json',
  'unitedstates-schengen': 'us-schengen.json',
  'us-france': 'us-schengen.json',
  'us-germany': 'us-schengen.json',
  'us-italy': 'us-schengen.json',
  'us-spain': 'us-schengen.json',
  'us-netherlands': 'us-schengen.json',
  'us-portugal': 'us-schengen.json',
  'us-greece': 'us-schengen.json',
  'us-austria': 'us-schengen.json',
  'us-belgium': 'us-schengen.json',
  'us-switzerland': 'us-schengen.json',
};

// Cache for loaded corridor data
const corridorCache = new Map<string, CorridorData>();

/**
 * Get the corridor key for a passport-destination pair
 */
function getCorridorKey(passport: string, destination: string): string | null {
  const normalizedPassport = normalizeLocation(passport);
  const normalizedDest = normalizeLocation(destination);

  // Try direct match
  const directKey = `${normalizedPassport}-${normalizedDest}`;
  if (CORRIDOR_MAP[directKey]) {
    return directKey;
  }

  // Try with country codes
  const codeKey = `${normalizedPassport.substring(0, 2)}-${normalizedDest.substring(0, 2)}`;
  if (CORRIDOR_MAP[codeKey]) {
    return codeKey;
  }

  // Check if destination is a Schengen country
  const schengenCountries = [
    'austria', 'belgium', 'croatia', 'czechrepublic', 'denmark', 'estonia',
    'finland', 'france', 'germany', 'greece', 'hungary', 'iceland', 'italy',
    'latvia', 'liechtenstein', 'lithuania', 'luxembourg', 'malta', 'netherlands',
    'norway', 'poland', 'portugal', 'slovakia', 'slovenia', 'spain', 'sweden', 'switzerland'
  ];

  if (schengenCountries.includes(normalizedDest)) {
    const schengenKey = `${normalizedPassport}-schengen`;
    if (CORRIDOR_MAP[schengenKey]) {
      return schengenKey;
    }
  }

  return null;
}

/**
 * Load corridor data from JSON file
 */
function loadCorridorData(fileName: string): CorridorData | null {
  try {
    const filePath = path.join(__dirname, '..', 'data', 'corridors', fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`Corridor file not found: ${filePath}`);
      return null;
    }

    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as CorridorData;
  } catch (error) {
    console.error(`Error loading corridor data from ${fileName}:`, error);
    return null;
  }
}

/**
 * Get curated corridor data for a passport-destination pair
 * Returns null if no curated data exists for this corridor
 */
export function getCorridorData(passport: string, destination: string): CorridorData | null {
  const corridorKey = getCorridorKey(passport, destination);

  if (!corridorKey) {
    return null;
  }

  // Check cache first
  if (corridorCache.has(corridorKey)) {
    return corridorCache.get(corridorKey)!;
  }

  // Load from file
  const fileName = CORRIDOR_MAP[corridorKey];
  const data = loadCorridorData(fileName);

  if (data) {
    corridorCache.set(corridorKey, data);
  }

  return data;
}

/**
 * Check if curated data exists for a corridor
 */
export function hasCuratedData(passport: string, destination: string): boolean {
  return getCorridorKey(passport, destination) !== null;
}

/**
 * Get list of all available corridors
 */
export function getAvailableCorridors(): string[] {
  return Object.keys(CORRIDOR_MAP)
    .filter((key, index, arr) => {
      // Get unique file names
      const fileName = CORRIDOR_MAP[key];
      return arr.findIndex(k => CORRIDOR_MAP[k] === fileName) === index;
    })
    .map(key => {
      const [passport, dest] = key.split('-');
      return `${passport.toUpperCase()} → ${dest.charAt(0).toUpperCase() + dest.slice(1)}`;
    });
}

/**
 * Validate all corridor JSON files at startup
 * Ensures required fields are present and data is well-formed
 */
export function validateCorridorData(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const uniqueFiles = Array.from(new Set(Object.values(CORRIDOR_MAP)));

  for (const fileName of uniqueFiles) {
    try {
      const filePath = path.join(__dirname, '..', 'data', 'corridors', fileName);

      if (!fs.existsSync(filePath)) {
        errors.push(`[Corridor] File not found: ${fileName}`);
        continue;
      }

      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as CorridorData;

      // Required fields in corridor section
      if (!data.corridor) {
        errors.push(`[Corridor] ${fileName}: missing 'corridor' section`);
      } else {
        if (!data.corridor.passport) errors.push(`[Corridor] ${fileName}: missing 'corridor.passport'`);
        if (!data.corridor.destination) errors.push(`[Corridor] ${fileName}: missing 'corridor.destination'`);
      }

      // Required top-level fields
      if (!data.lastVerified) errors.push(`[Corridor] ${fileName}: missing 'lastVerified'`);
      if (!data.source) errors.push(`[Corridor] ${fileName}: missing 'source'`);

      // Visa section validation
      if (!data.visa) {
        errors.push(`[Corridor] ${fileName}: missing 'visa' section`);
      } else {
        if (data.visa.required === undefined) errors.push(`[Corridor] ${fileName}: visa.required missing`);
        if (!data.visa.type) errors.push(`[Corridor] ${fileName}: visa.type missing`);
        if (!data.visa.processingDays) errors.push(`[Corridor] ${fileName}: visa.processingDays missing`);
        if (!data.visa.cost) errors.push(`[Corridor] ${fileName}: visa.cost missing`);
        if (data.visa.cost && data.visa.cost.government === undefined) {
          errors.push(`[Corridor] ${fileName}: visa.cost.government missing`);
        }
      }

      const corridorLabel = data.corridor
        ? `${data.corridor.passport} → ${data.corridor.destination}`
        : fileName;
      console.log(`[Corridor] ✓ Validated: ${fileName} (${corridorLabel})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[Corridor] ${fileName}: JSON parse error - ${msg}`);
    }
  }

  if (errors.length > 0) {
    console.error('[Corridor] Validation errors:');
    errors.forEach(e => console.error(`  ${e}`));
  } else {
    console.log(`[Corridor] All ${uniqueFiles.length} corridor files validated successfully`);
  }

  return { valid: errors.length === 0, errors };
}

// AFFILIATE_CONFIG for visa links
const AFFILIATE_CONFIG = {
  visa: 'https://www.ivisa.com/?utm_source=voyageai&utm_medium=affiliate',
};

/**
 * Convert corridor visa data to the app's VisaDetails format
 * Returns curated data with high confidence
 */
export function corridorToVisaDetails(
  corridor: CorridorData,
  daysUntilTrip: number
): VisaDetails | null {
  const visa = corridor.visa;

  // If visa not required, return visa-free details
  if (!visa.required) {
    return {
      required: false,
      type: 'visa_free',
      name: 'Visa-Free Entry',
      processingDays: { minimum: 0, maximum: 0 },
      cost: {
        government: 0,
        service: 0,
        currency: 'USD',
        totalPerPerson: 0,
        breakdownLabel: 'No visa fee required',
        accuracy: 'curated',
      },
      documentsRequired: visa.documentsRequired || [],
      applicationMethod: 'online',
      lastVerified: corridor.lastVerified,
      sources: [
        { title: corridor.source, url: visa.applicationUrl || '' }
      ],
      confidenceLevel: 'high',
    };
  }

  const processingMax = visa.processingDays.maximum;
  const businessDaysUntilTrip = Math.floor(daysUntilTrip * 5 / 7);
  const processingDaysNeeded = processingMax + 3; // buffer
  const hasEnoughTime = daysUntilTrip >= processingDaysNeeded;

  // Calculate urgency
  let urgency: 'ok' | 'tight' | 'risky' | 'impossible';
  let recommendation: string;

  if (daysUntilTrip < visa.processingDays.minimum) {
    urgency = 'impossible';
    recommendation = `Not enough time. ${visa.type === 'embassy_visa' ? 'Consider postponing or expedited processing if available.' : 'Consider alternative visa type.'}`;
  } else if (daysUntilTrip < processingDaysNeeded) {
    urgency = 'risky';
    recommendation = `Very risky! Apply immediately. Consider expedited processing.`;
  } else if (daysUntilTrip < processingDaysNeeded + 7) {
    urgency = 'tight';
    recommendation = 'Time is tight. Apply TODAY for peace of mind.';
  } else {
    urgency = 'ok';
    recommendation = `You have time, but don't delay. Apply within the next week.`;
  }

  const totalPerPerson = visa.cost.government + (visa.cost.service || 0);

  return {
    required: true,
    type: visa.type as VisaDetails['type'],
    name: visa.name,
    processingDays: {
      minimum: visa.processingDays.minimum,
      maximum: visa.processingDays.maximum,
      expedited: visa.processingDays.expedited,
    },
    cost: {
      government: visa.cost.government,
      service: visa.cost.service,
      currency: visa.cost.currency,
      totalPerPerson,
      breakdownLabel: visa.cost.service ? "Gov't fee + service charge" : "Government fee",
      accuracy: 'curated',
    },
    documentsRequired: visa.documentsRequired,
    applicationMethod: visa.applicationMethod === 'none' ? 'online' : visa.applicationMethod as VisaDetails['applicationMethod'],
    applicationUrl: visa.applicationUrl,
    affiliateLink: AFFILIATE_CONFIG.visa,
    timing: {
      daysUntilTrip,
      businessDaysUntilTrip,
      processingDaysNeeded,
      hasEnoughTime,
      urgency,
      recommendation,
    },
    lastVerified: corridor.lastVerified,
    sources: [
      { title: corridor.source, url: visa.applicationUrl || visa.embassyUrl || '' }
    ],
    confidenceLevel: 'high',
  };
}

/**
 * Generate default (estimated) visa details when no corridor data exists
 * Returns AI-estimated data with low/medium confidence
 */
export function generateEstimatedVisaDetails(
  visaRequired: boolean,
  visaType: VisaDetails['type'],
  visaReason: string,
  daysUntilTrip: number,
  destination: string
): VisaDetails {
  if (!visaRequired || visaType === 'visa_free') {
    return {
      required: false,
      type: 'visa_free',
      name: 'Visa-Free Entry',
      processingDays: { minimum: 0, maximum: 0 },
      cost: {
        government: 0,
        service: 0,
        currency: 'USD',
        totalPerPerson: 0,
        breakdownLabel: 'No visa fee required',
        accuracy: 'estimated',
      },
      documentsRequired: [],
      applicationMethod: 'online',
      confidenceLevel: 'medium',
    };
  }

  // Estimate processing times based on visa type
  let processingMin = 5;
  let processingMax = 10;
  if (visaType === 'e_visa') {
    processingMin = 3;
    processingMax = 7;
  } else if (visaType === 'visa_on_arrival') {
    processingMin = 0;
    processingMax = 0;
  } else if (visaType === 'embassy_visa') {
    processingMin = 10;
    processingMax = 30; // Embassy visas can take a month
  }

  // Estimate costs (conservative - based on real 2025 data)
  // Schengen: €90 (~$100) + VFS (~$25) = $125
  // USA B1/B2: $185
  // UK: £100+ ($125+)
  // E-visa typical: $50-80
  // VOA typical: $30-40
  let governmentFee = 100; // Higher default to avoid underestimating
  let serviceFee = 25;
  if (visaType === 'visa_on_arrival') {
    governmentFee = 35;
    serviceFee = 0;
  } else if (visaType === 'e_visa') {
    governmentFee = 50;
    serviceFee = 15;
  }

  // Schengen countries get higher fee (€90 + service)
  const SCHENGEN_COUNTRIES = [
    'austria', 'belgium', 'czech republic', 'czechia', 'denmark', 'estonia',
    'finland', 'france', 'germany', 'greece', 'hungary', 'iceland', 'italy',
    'latvia', 'liechtenstein', 'lithuania', 'luxembourg', 'malta', 'netherlands',
    'norway', 'poland', 'portugal', 'slovakia', 'slovenia', 'spain', 'sweden', 'switzerland'
  ];
  if (SCHENGEN_COUNTRIES.some(c => destination.toLowerCase().includes(c))) {
    governmentFee = 100; // €90 ≈ $100
    serviceFee = 25; // VFS/service center
  }

  const totalPerPerson = governmentFee + serviceFee;
  const businessDaysUntilTrip = Math.floor(daysUntilTrip * 5 / 7);
  const processingDaysNeeded = processingMax + 3;
  const hasEnoughTime = daysUntilTrip >= processingDaysNeeded;

  // Calculate urgency
  let urgency: 'ok' | 'tight' | 'risky' | 'impossible';
  let recommendation: string;

  if (visaType === 'visa_on_arrival') {
    urgency = 'ok';
    recommendation = 'Available on arrival. Ensure you have required documents.';
  } else if (daysUntilTrip < processingMin) {
    urgency = 'impossible';
    recommendation = 'Not enough time for visa processing. Consider postponing.';
  } else if (daysUntilTrip < processingDaysNeeded) {
    urgency = 'risky';
    recommendation = 'Very risky! Apply immediately if proceeding.';
  } else if (daysUntilTrip < processingDaysNeeded + 7) {
    urgency = 'tight';
    recommendation = 'Time is tight. Apply as soon as possible.';
  } else {
    urgency = 'ok';
    recommendation = 'You have time. Apply within the next week.';
  }

  return {
    required: true,
    type: visaType,
    name: visaType === 'e_visa' ? 'E-Visa' :
          visaType === 'visa_on_arrival' ? 'Visa on Arrival' :
          'Tourist Visa',
    processingDays: {
      minimum: processingMin,
      maximum: processingMax,
    },
    cost: {
      government: governmentFee,
      service: serviceFee,
      currency: 'USD',
      totalPerPerson,
      breakdownLabel: serviceFee > 0 ? "Gov't fee + service (est.)" : "Government fee (est.)",
      accuracy: 'estimated',
    },
    documentsRequired: [
      'Valid passport (6+ months validity)',
      'Passport photos',
      'Proof of accommodation',
      'Return flight itinerary',
      'Proof of funds',
    ],
    applicationMethod: visaType === 'e_visa' ? 'online' :
                       visaType === 'visa_on_arrival' ? 'on_arrival' : 'embassy',
    affiliateLink: AFFILIATE_CONFIG.visa,
    timing: {
      daysUntilTrip,
      businessDaysUntilTrip,
      processingDaysNeeded,
      hasEnoughTime,
      urgency,
      recommendation,
    },
    confidenceLevel: 'low',
  };
}
