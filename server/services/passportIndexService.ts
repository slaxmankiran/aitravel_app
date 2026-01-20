/**
 * passportIndexService.ts
 *
 * Free visa requirements lookup using the Passport Index Dataset.
 * Source: https://github.com/ilyankou/passport-index-dataset
 *
 * This provides unlimited, free visa lookups for 199 countries (39,000+ routes).
 * Used as the PRIMARY source, with RapidAPI as optional enrichment.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// TYPES
// =============================================================================

export type VisaStatus =
  | 'visa_free'      // Number of days allowed
  | 'visa_on_arrival'
  | 'e_visa'
  | 'eta'            // Electronic Travel Authorization (ESTA, eTA, etc.)
  | 'visa_required'
  | 'covid_ban'      // Travel ban
  | 'no_admission'   // No admission (e.g., Israel passport to certain countries)
  | 'unknown';

export interface PassportIndexEntry {
  passport: string;      // Country name (e.g., "India")
  destination: string;   // Country name (e.g., "Thailand")
  requirement: string;   // Raw value (e.g., "60", "e-visa", "visa required")
  status: VisaStatus;    // Normalized status
  days?: number;         // Days allowed (if visa-free)
}

export interface VisaLookupResult {
  passport: string;
  passportCode: string;
  destination: string;
  destinationCode: string;
  status: VisaStatus;
  statusLabel: string;
  days?: number;
  source: 'passport_index';
}

// =============================================================================
// COUNTRY NAME TO ISO CODE MAPPING
// =============================================================================

const COUNTRY_TO_ISO: Record<string, string> = {
  // A
  'afghanistan': 'AF', 'albania': 'AL', 'algeria': 'DZ', 'andorra': 'AD',
  'angola': 'AO', 'antigua and barbuda': 'AG', 'argentina': 'AR', 'armenia': 'AM',
  'australia': 'AU', 'austria': 'AT', 'azerbaijan': 'AZ',
  // B
  'bahamas': 'BS', 'bahrain': 'BH', 'bangladesh': 'BD', 'barbados': 'BB',
  'belarus': 'BY', 'belgium': 'BE', 'belize': 'BZ', 'benin': 'BJ',
  'bhutan': 'BT', 'bolivia': 'BO', 'bosnia and herzegovina': 'BA',
  'botswana': 'BW', 'brazil': 'BR', 'brunei': 'BN', 'bulgaria': 'BG',
  'burkina faso': 'BF', 'burundi': 'BI',
  // C
  'cambodia': 'KH', 'cameroon': 'CM', 'canada': 'CA', 'cape verde': 'CV',
  'central african republic': 'CF', 'chad': 'TD', 'chile': 'CL', 'china': 'CN',
  'colombia': 'CO', 'comoros': 'KM', 'congo': 'CG', 'congo (dem. rep.)': 'CD',
  'costa rica': 'CR', 'croatia': 'HR', 'cuba': 'CU', 'cyprus': 'CY',
  'czech republic': 'CZ', 'czechia': 'CZ',
  // D
  'denmark': 'DK', 'djibouti': 'DJ', 'dominica': 'DM', 'dominican republic': 'DO',
  // E
  'east timor': 'TL', 'timor-leste': 'TL', 'ecuador': 'EC', 'egypt': 'EG',
  'el salvador': 'SV', 'equatorial guinea': 'GQ', 'eritrea': 'ER', 'estonia': 'EE',
  'eswatini': 'SZ', 'ethiopia': 'ET',
  // F
  'fiji': 'FJ', 'finland': 'FI', 'france': 'FR',
  // G
  'gabon': 'GA', 'gambia': 'GM', 'georgia': 'GE', 'germany': 'DE', 'ghana': 'GH',
  'greece': 'GR', 'grenada': 'GD', 'guatemala': 'GT', 'guinea': 'GN',
  'guinea-bissau': 'GW', 'guyana': 'GY',
  // H
  'haiti': 'HT', 'honduras': 'HN', 'hong kong': 'HK', 'hungary': 'HU',
  // I
  'iceland': 'IS', 'india': 'IN', 'indonesia': 'ID', 'iran': 'IR', 'iraq': 'IQ',
  'ireland': 'IE', 'israel': 'IL', 'italy': 'IT', 'ivory coast': 'CI',
  "cote d'ivoire": 'CI',
  // J
  'jamaica': 'JM', 'japan': 'JP', 'jordan': 'JO',
  // K
  'kazakhstan': 'KZ', 'kenya': 'KE', 'kiribati': 'KI', 'kosovo': 'XK',
  'kuwait': 'KW', 'kyrgyzstan': 'KG',
  // L
  'laos': 'LA', 'latvia': 'LV', 'lebanon': 'LB', 'lesotho': 'LS', 'liberia': 'LR',
  'libya': 'LY', 'liechtenstein': 'LI', 'lithuania': 'LT', 'luxembourg': 'LU',
  // M
  'macau': 'MO', 'north macedonia': 'MK', 'madagascar': 'MG', 'malawi': 'MW',
  'malaysia': 'MY', 'maldives': 'MV', 'mali': 'ML', 'malta': 'MT',
  'marshall islands': 'MH', 'mauritania': 'MR', 'mauritius': 'MU', 'mexico': 'MX',
  'micronesia': 'FM', 'moldova': 'MD', 'monaco': 'MC', 'mongolia': 'MN',
  'montenegro': 'ME', 'morocco': 'MA', 'mozambique': 'MZ', 'myanmar': 'MM',
  // N
  'namibia': 'NA', 'nauru': 'NR', 'nepal': 'NP', 'netherlands': 'NL',
  'new zealand': 'NZ', 'nicaragua': 'NI', 'niger': 'NE', 'nigeria': 'NG',
  'north korea': 'KP', 'norway': 'NO',
  // O
  'oman': 'OM',
  // P
  'pakistan': 'PK', 'palau': 'PW', 'palestine': 'PS', 'panama': 'PA',
  'papua new guinea': 'PG', 'paraguay': 'PY', 'peru': 'PE', 'philippines': 'PH',
  'poland': 'PL', 'portugal': 'PT',
  // Q
  'qatar': 'QA',
  // R
  'romania': 'RO', 'russia': 'RU', 'rwanda': 'RW',
  // S
  'saint kitts and nevis': 'KN', 'saint lucia': 'LC',
  'saint vincent and the grenadines': 'VC', 'samoa': 'WS', 'san marino': 'SM',
  'sao tome and principe': 'ST', 'saudi arabia': 'SA', 'senegal': 'SN',
  'serbia': 'RS', 'seychelles': 'SC', 'sierra leone': 'SL', 'singapore': 'SG',
  'slovakia': 'SK', 'slovenia': 'SI', 'solomon islands': 'SB', 'somalia': 'SO',
  'south africa': 'ZA', 'south korea': 'KR', 'south sudan': 'SS', 'spain': 'ES',
  'sri lanka': 'LK', 'sudan': 'SD', 'suriname': 'SR', 'sweden': 'SE',
  'switzerland': 'CH', 'syria': 'SY',
  // T
  'taiwan': 'TW', 'tajikistan': 'TJ', 'tanzania': 'TZ', 'thailand': 'TH',
  'togo': 'TG', 'tonga': 'TO', 'trinidad and tobago': 'TT', 'tunisia': 'TN',
  'turkey': 'TR', 'turkmenistan': 'TM', 'tuvalu': 'TV',
  // U
  'uganda': 'UG', 'ukraine': 'UA', 'united arab emirates': 'AE',
  'united kingdom': 'GB', 'united states': 'US', 'uruguay': 'UY', 'uzbekistan': 'UZ',
  // V
  'vanuatu': 'VU', 'vatican': 'VA', 'venezuela': 'VE', 'vietnam': 'VN',
  // Y
  'yemen': 'YE',
  // Z
  'zambia': 'ZM', 'zimbabwe': 'ZW',
};

const ISO_TO_COUNTRY: Record<string, string> = Object.entries(COUNTRY_TO_ISO)
  .reduce((acc, [name, code]) => {
    acc[code] = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return acc;
  }, {} as Record<string, string>);

// =============================================================================
// DATA LOADING
// =============================================================================

interface VisaMatrix {
  [passport: string]: {
    [destination: string]: PassportIndexEntry;
  };
}

let visaMatrix: VisaMatrix | null = null;
let loadedAt: Date | null = null;

/**
 * Parse the requirement string into status and days
 */
function parseRequirement(requirement: string): { status: VisaStatus; days?: number } {
  const req = requirement.toLowerCase().trim();

  // Check for numeric (visa-free days)
  const numMatch = req.match(/^(\d+)$/);
  if (numMatch) {
    return { status: 'visa_free', days: parseInt(numMatch[1], 10) };
  }

  // Check for "visa free" text
  if (req === 'visa free' || req === 'free') {
    return { status: 'visa_free' };
  }

  // Check for e-visa
  if (req === 'e-visa' || req === 'evisa' || req === 'e visa') {
    return { status: 'e_visa' };
  }

  // Check for ETA (Electronic Travel Authorization)
  if (req === 'eta' || req.includes('electronic travel')) {
    return { status: 'eta' };
  }

  // Check for visa on arrival
  if (req === 'visa on arrival' || req === 'voa') {
    return { status: 'visa_on_arrival' };
  }

  // Check for visa required
  if (req === 'visa required' || req === 'visa') {
    return { status: 'visa_required' };
  }

  // Check for special cases
  if (req === 'covid ban' || req.includes('ban')) {
    return { status: 'covid_ban' };
  }

  if (req === 'no admission' || req === '-1') {
    return { status: 'no_admission' };
  }

  // Default to visa required for unknown
  console.warn(`[PassportIndex] Unknown requirement: "${requirement}"`);
  return { status: 'visa_required' };
}

/**
 * Load the passport index CSV into memory
 */
export function loadPassportIndex(): void {
  const csvPath = path.join(__dirname, '../data/passport-index.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`[PassportIndex] CSV file not found at ${csvPath}`);
    console.error('[PassportIndex] Download from: https://github.com/ilyankou/passport-index-dataset');
    return;
  }

  const startTime = Date.now();
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');

  visaMatrix = {};
  let count = 0;

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const [passport, destination, requirement] = line.split(',').map(s => s.trim());
    if (!passport || !destination || !requirement) continue;

    const passportKey = passport.toLowerCase();
    const destKey = destination.toLowerCase();

    if (!visaMatrix[passportKey]) {
      visaMatrix[passportKey] = {};
    }

    const { status, days } = parseRequirement(requirement);

    visaMatrix[passportKey][destKey] = {
      passport,
      destination,
      requirement,
      status,
      days,
    };

    count++;
  }

  loadedAt = new Date();
  const elapsed = Date.now() - startTime;
  console.log(`[PassportIndex] Loaded ${count.toLocaleString()} visa routes in ${elapsed}ms`);
}

/**
 * Get the visa matrix (load if needed)
 */
function getMatrix(): VisaMatrix {
  if (!visaMatrix) {
    loadPassportIndex();
  }
  return visaMatrix || {};
}

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Normalize country input to lowercase key
 */
function normalizeCountry(input: string): string {
  const normalized = input.toLowerCase().trim();

  // Check if it's already a country name in our data
  const matrix = getMatrix();
  if (matrix[normalized]) {
    return normalized;
  }

  // Check if it's an ISO code
  const fromIso = ISO_TO_COUNTRY[normalized.toUpperCase()];
  if (fromIso) {
    return fromIso.toLowerCase();
  }

  // Handle common variations
  const variations: Record<string, string> = {
    'usa': 'united states',
    'uk': 'united kingdom',
    'uae': 'united arab emirates',
    'korea': 'south korea',
    'czechia': 'czech republic',
    'burma': 'myanmar',
    'holland': 'netherlands',
    'england': 'united kingdom',
    'great britain': 'united kingdom',
  };

  return variations[normalized] || normalized;
}

/**
 * Get country code from name
 */
function getCountryCode(name: string): string {
  const normalized = name.toLowerCase().trim();
  return COUNTRY_TO_ISO[normalized] || name.substring(0, 2).toUpperCase();
}

/**
 * Get status label for display
 */
function getStatusLabel(status: VisaStatus, days?: number): string {
  switch (status) {
    case 'visa_free':
      return days ? `Visa Free (${days} days)` : 'Visa Free';
    case 'visa_on_arrival':
      return 'Visa on Arrival';
    case 'e_visa':
      return 'e-Visa Required';
    case 'eta':
      return 'ETA Required';
    case 'visa_required':
      return 'Visa Required';
    case 'covid_ban':
      return 'Travel Restricted';
    case 'no_admission':
      return 'No Admission';
    default:
      return 'Unknown';
  }
}

/**
 * Look up visa requirements between two countries
 *
 * @param passport - Passport country (name or ISO code)
 * @param destination - Destination country (name or ISO code)
 * @returns Visa lookup result or null if not found
 */
export function lookupVisa(passport: string, destination: string): VisaLookupResult | null {
  const matrix = getMatrix();

  const passportKey = normalizeCountry(passport);
  const destKey = normalizeCountry(destination);

  const passportData = matrix[passportKey];
  if (!passportData) {
    console.warn(`[PassportIndex] Passport not found: "${passport}" (normalized: "${passportKey}")`);
    return null;
  }

  const entry = passportData[destKey];
  if (!entry) {
    console.warn(`[PassportIndex] Destination not found: "${destination}" (normalized: "${destKey}")`);
    return null;
  }

  return {
    passport: entry.passport,
    passportCode: getCountryCode(entry.passport),
    destination: entry.destination,
    destinationCode: getCountryCode(entry.destination),
    status: entry.status,
    statusLabel: getStatusLabel(entry.status, entry.days),
    days: entry.days,
    source: 'passport_index',
  };
}

/**
 * Check if a route exists in the dataset
 */
export function hasRoute(passport: string, destination: string): boolean {
  const matrix = getMatrix();
  const passportKey = normalizeCountry(passport);
  const destKey = normalizeCountry(destination);

  return !!matrix[passportKey]?.[destKey];
}

/**
 * Get all destinations for a passport
 */
export function getDestinationsForPassport(passport: string): PassportIndexEntry[] {
  const matrix = getMatrix();
  const passportKey = normalizeCountry(passport);

  const passportData = matrix[passportKey];
  if (!passportData) return [];

  return Object.values(passportData);
}

/**
 * Get statistics about the loaded data
 */
export function getStats(): {
  totalRoutes: number;
  passports: number;
  loadedAt: string | null;
} {
  const matrix = getMatrix();
  const passports = Object.keys(matrix).length;
  const totalRoutes = Object.values(matrix).reduce(
    (sum, dests) => sum + Object.keys(dests).length,
    0
  );

  return {
    totalRoutes,
    passports,
    loadedAt: loadedAt?.toISOString() || null,
  };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Load data on module import
loadPassportIndex();
