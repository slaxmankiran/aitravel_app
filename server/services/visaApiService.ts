/**
 * visaApiService.ts
 *
 * Integrates with RapidAPI Visa Requirement API to fetch real-time visa data.
 * Results are cached in the knowledge base for future lookups.
 *
 * API: https://rapidapi.com/travel-developer/api/visa-requirement
 */

import { db } from "../db";
import { knowledgeDocuments } from "@shared/knowledgeSchema";
import { generateEmbedding } from "./embeddings";
import { eq, and } from "drizzle-orm";

// =============================================================================
// TYPES
// =============================================================================

export interface VisaApiResponse {
  data: {
    passport: {
      code: string;
      name: string;
      currency_code: string;
    };
    destination: {
      code: string;
      name: string;
      continent: string;
      capital: string;
      currency_code: string;
      currency: string;
      exchange: string;
      passport_validity: string;
      phone_code: string;
      timezone: string;
      population: number;
      area_km2: number;
      embassy_url?: string;
    };
    mandatory_registration?: {
      name: string;
      color: string;
      link?: string;
    };
    visa_rules: {
      primary_rule: {
        name: string;
        duration?: string;
        color: string;
        link?: string;
      };
      secondary_rules?: Array<{
        name: string;
        duration?: string;
        color: string;
      }>;
    };
  };
  meta: {
    version: string;
    language: string;
    generated_at: string;
  };
}

export interface VisaRequirement {
  passportCountry: string;
  passportCode: string;
  destinationCountry: string;
  destinationCode: string;
  visaType: 'visa_free' | 'visa_on_arrival' | 'e_visa' | 'visa_required';
  visaName: string;
  duration?: string;
  passportValidity: string;
  currency: string;
  exchangeRate: string;
  capital: string;
  timezone: string;
  embassyUrl?: string;
  applyLink?: string;
  mandatoryRegistration?: string;
  fetchedAt: string;
  source: 'api' | 'cache';
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '7c691e788emsh2db279df4a82b4ap184edejsn9dd32d6e74c8';
const RAPIDAPI_HOST = 'visa-requirement.p.rapidapi.com';
const API_URL = 'https://visa-requirement.p.rapidapi.com/v2/visa/check';

// Cache duration: 30 days (visa rules don't change often)
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// Country code mapping (common names to ISO 2-letter codes)
const COUNTRY_CODES: Record<string, string> = {
  // Common variations
  'india': 'IN',
  'united states': 'US',
  'usa': 'US',
  'united kingdom': 'GB',
  'uk': 'GB',
  'thailand': 'TH',
  'japan': 'JP',
  'france': 'FR',
  'germany': 'DE',
  'italy': 'IT',
  'spain': 'ES',
  'australia': 'AU',
  'canada': 'CA',
  'singapore': 'SG',
  'malaysia': 'MY',
  'indonesia': 'ID',
  'vietnam': 'VN',
  'south korea': 'KR',
  'korea': 'KR',
  'china': 'CN',
  'uae': 'AE',
  'united arab emirates': 'AE',
  'dubai': 'AE',
  'netherlands': 'NL',
  'switzerland': 'CH',
  'greece': 'GR',
  'turkey': 'TR',
  'egypt': 'EG',
  'maldives': 'MV',
  'sri lanka': 'LK',
  'nepal': 'NP',
  'bhutan': 'BT',
  'bangladesh': 'BD',
  'pakistan': 'PK',
  'new zealand': 'NZ',
  'mexico': 'MX',
  'brazil': 'BR',
  'argentina': 'AR',
  'south africa': 'ZA',
  'kenya': 'KE',
  'morocco': 'MA',
  'portugal': 'PT',
  'belgium': 'BE',
  'austria': 'AT',
  'sweden': 'SE',
  'norway': 'NO',
  'denmark': 'DK',
  'finland': 'FI',
  'ireland': 'IE',
  'czech republic': 'CZ',
  'czechia': 'CZ',
  'poland': 'PL',
  'hungary': 'HU',
  'russia': 'RU',
  'philippines': 'PH',
  'taiwan': 'TW',
  'hong kong': 'HK',
  'macau': 'MO',
  'cambodia': 'KH',
  'laos': 'LA',
  'myanmar': 'MM',
  'burma': 'MM',
  'bali': 'ID', // Bali is in Indonesia
  'phuket': 'TH', // Phuket is in Thailand
  'tokyo': 'JP', // Cities to countries
  'paris': 'FR',
  'london': 'GB',
  'new york': 'US',
  'bangkok': 'TH',
  'rome': 'IT',
  'barcelona': 'ES',
  'amsterdam': 'NL',
  'berlin': 'DE',
  'sydney': 'AU',
  'dubai city': 'AE',
  'mumbai': 'IN',
  'delhi': 'IN',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert country name to ISO 2-letter code
 */
export function getCountryCode(country: string): string | null {
  if (!country) return null;

  // Already a 2-letter code?
  if (country.length === 2 && /^[A-Z]{2}$/.test(country.toUpperCase())) {
    return country.toUpperCase();
  }

  // Look up in mapping
  const normalized = country.toLowerCase().trim();

  // Direct match
  if (COUNTRY_CODES[normalized]) {
    return COUNTRY_CODES[normalized];
  }

  // Try to extract country from "City, Country" format
  const parts = normalized.split(',');
  if (parts.length >= 2) {
    const countryPart = parts[parts.length - 1].trim();
    if (COUNTRY_CODES[countryPart]) {
      return COUNTRY_CODES[countryPart];
    }
  }

  // Try partial match
  for (const [name, code] of Object.entries(COUNTRY_CODES)) {
    if (normalized.includes(name) || name.includes(normalized)) {
      return code;
    }
  }

  console.warn(`[VisaAPI] Unknown country: ${country}`);
  return null;
}

/**
 * Map API visa rule name to our visa type
 */
function mapVisaType(ruleName: string): VisaRequirement['visaType'] {
  const name = ruleName.toLowerCase();

  if (name.includes('not required') || name.includes('visa free') || name.includes('freedom of movement')) {
    return 'visa_free';
  }
  if (name.includes('on arrival') || name.includes('voa')) {
    return 'visa_on_arrival';
  }
  if (name.includes('evisa') || name.includes('e-visa') || name.includes('eta') || name.includes('electronic')) {
    return 'e_visa';
  }
  return 'visa_required';
}

/**
 * Generate cache key for knowledge base lookup
 */
function getCacheKey(passportCode: string, destinationCode: string): string {
  return `visa-api-${passportCode}-${destinationCode}`.toLowerCase();
}

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

/**
 * Fetch visa requirements from the RapidAPI
 */
export async function fetchVisaRequirements(
  passport: string,
  destination: string
): Promise<VisaRequirement | null> {
  const passportCode = getCountryCode(passport);
  const destinationCode = getCountryCode(destination);

  if (!passportCode || !destinationCode) {
    console.error(`[VisaAPI] Cannot resolve country codes: passport=${passport} (${passportCode}), destination=${destination} (${destinationCode})`);
    return null;
  }

  // Check cache first
  const cached = await getFromCache(passportCode, destinationCode);
  if (cached) {
    console.log(`[VisaAPI] Cache hit: ${passportCode} → ${destinationCode}`);
    return cached;
  }

  // Fetch from API
  console.log(`[VisaAPI] Fetching: ${passportCode} → ${destinationCode}`);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
      body: `passport=${passportCode}&destination=${destinationCode}`,
    });

    if (!response.ok) {
      console.error(`[VisaAPI] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: VisaApiResponse = await response.json();

    if (!data.data?.visa_rules?.primary_rule) {
      console.error(`[VisaAPI] Invalid response structure`);
      return null;
    }

    const result: VisaRequirement = {
      passportCountry: data.data.passport.name,
      passportCode: data.data.passport.code,
      destinationCountry: data.data.destination.name,
      destinationCode: data.data.destination.code,
      visaType: mapVisaType(data.data.visa_rules.primary_rule.name),
      visaName: data.data.visa_rules.primary_rule.name,
      duration: data.data.visa_rules.primary_rule.duration,
      passportValidity: data.data.destination.passport_validity,
      currency: data.data.destination.currency,
      exchangeRate: data.data.destination.exchange,
      capital: data.data.destination.capital,
      timezone: data.data.destination.timezone,
      embassyUrl: data.data.destination.embassy_url,
      applyLink: data.data.visa_rules.primary_rule.link,
      mandatoryRegistration: data.data.mandatory_registration?.name,
      fetchedAt: new Date().toISOString(),
      source: 'api',
    };

    // Cache the result
    await saveToCache(result);

    console.log(`[VisaAPI] Result: ${result.visaName} (${result.visaType})${result.duration ? ` - ${result.duration}` : ''}`);

    return result;

  } catch (error: any) {
    console.error(`[VisaAPI] Fetch error:`, error.message);
    return null;
  }
}

/**
 * Get cached visa requirements from knowledge base
 */
async function getFromCache(passportCode: string, destinationCode: string): Promise<VisaRequirement | null> {
  try {
    const cacheKey = getCacheKey(passportCode, destinationCode);

    const [doc] = await db
      .select()
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.sourceId, cacheKey))
      .limit(1);

    if (!doc) return null;

    // Check if cache is still valid
    const cachedAt = doc.createdAt ? new Date(doc.createdAt).getTime() : 0;
    if (Date.now() - cachedAt > CACHE_DURATION_MS) {
      console.log(`[VisaAPI] Cache expired: ${cacheKey}`);
      return null;
    }

    // Parse cached data from metadata
    const metadata = doc.metadata as any;
    if (!metadata?.visaRequirement) return null;

    return {
      ...metadata.visaRequirement,
      source: 'cache',
    };

  } catch (error: any) {
    console.error(`[VisaAPI] Cache read error:`, error.message);
    return null;
  }
}

/**
 * Save visa requirements to knowledge base cache
 */
async function saveToCache(requirement: VisaRequirement): Promise<void> {
  try {
    const cacheKey = getCacheKey(requirement.passportCode, requirement.destinationCode);

    // Create content for embedding
    const content = `
Visa requirements for ${requirement.passportCountry} passport holders traveling to ${requirement.destinationCountry}:
- Visa Type: ${requirement.visaName}
- Duration: ${requirement.duration || 'varies'}
- Passport Validity Required: ${requirement.passportValidity}
${requirement.mandatoryRegistration ? `- Mandatory Registration: ${requirement.mandatoryRegistration}` : ''}
- Currency: ${requirement.currency}
- Capital: ${requirement.capital}
    `.trim();

    // Generate embedding
    const embeddingResult = await generateEmbedding(content);
    const embedding = embeddingResult.embedding;

    // Upsert into knowledge base
    await db
      .insert(knowledgeDocuments)
      .values({
        sourceId: cacheKey,
        sourceType: 'visa_api',
        title: `${requirement.passportCountry} → ${requirement.destinationCountry} Visa Requirements`,
        content,
        fromCountry: requirement.passportCode,
        toCountry: requirement.destinationCode,
        embedding,
        sourceName: 'RapidAPI Visa Requirement',
        sourceUrl: requirement.applyLink || requirement.embassyUrl,
        lastVerified: new Date(),
        metadata: {
          visaRequirement: requirement,
          apiVersion: '2.0',
        },
      })
      .onConflictDoUpdate({
        target: knowledgeDocuments.sourceId,
        set: {
          content,
          embedding,
          lastVerified: new Date(),
          metadata: {
            visaRequirement: requirement,
            apiVersion: '2.0',
          },
          updatedAt: new Date(),
        },
      });

    console.log(`[VisaAPI] Cached: ${cacheKey}`);

  } catch (error: any) {
    console.error(`[VisaAPI] Cache write error:`, error.message);
  }
}

/**
 * Batch fetch and cache visa requirements for popular corridors.
 *
 * ⚠️ WARNING: Uses 36 API calls. Only run if you have sufficient API quota.
 * Current plan: 120 requests/month (Basic tier)
 */
export async function seedPopularCorridors(): Promise<{ success: number; failed: number }> {
  const popularCorridors = [
    // From India
    { passport: 'IN', destination: 'TH' }, // Thailand
    { passport: 'IN', destination: 'SG' }, // Singapore
    { passport: 'IN', destination: 'MY' }, // Malaysia
    { passport: 'IN', destination: 'ID' }, // Indonesia (Bali)
    { passport: 'IN', destination: 'VN' }, // Vietnam
    { passport: 'IN', destination: 'JP' }, // Japan
    { passport: 'IN', destination: 'KR' }, // South Korea
    { passport: 'IN', destination: 'AE' }, // UAE
    { passport: 'IN', destination: 'GB' }, // UK
    { passport: 'IN', destination: 'US' }, // USA
    { passport: 'IN', destination: 'FR' }, // France
    { passport: 'IN', destination: 'DE' }, // Germany
    { passport: 'IN', destination: 'IT' }, // Italy
    { passport: 'IN', destination: 'AU' }, // Australia
    { passport: 'IN', destination: 'NZ' }, // New Zealand
    { passport: 'IN', destination: 'MV' }, // Maldives
    { passport: 'IN', destination: 'LK' }, // Sri Lanka
    { passport: 'IN', destination: 'NP' }, // Nepal

    // From USA
    { passport: 'US', destination: 'GB' },
    { passport: 'US', destination: 'FR' },
    { passport: 'US', destination: 'DE' },
    { passport: 'US', destination: 'IT' },
    { passport: 'US', destination: 'ES' },
    { passport: 'US', destination: 'JP' },
    { passport: 'US', destination: 'TH' },
    { passport: 'US', destination: 'MX' },
    { passport: 'US', destination: 'AU' },

    // From UK
    { passport: 'GB', destination: 'US' },
    { passport: 'GB', destination: 'FR' },
    { passport: 'GB', destination: 'ES' },
    { passport: 'GB', destination: 'TH' },
    { passport: 'GB', destination: 'JP' },
    { passport: 'GB', destination: 'AU' },
  ];

  let success = 0;
  let failed = 0;

  for (const corridor of popularCorridors) {
    try {
      const result = await fetchVisaRequirements(corridor.passport, corridor.destination);
      if (result) {
        success++;
      } else {
        failed++;
      }
      // Rate limit: 1 request per second
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      failed++;
    }
  }

  console.log(`[VisaAPI] Seeding complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * Get visa type label for display
 */
export function getVisaTypeLabel(visaType: VisaRequirement['visaType']): string {
  switch (visaType) {
    case 'visa_free': return 'Visa Free';
    case 'visa_on_arrival': return 'Visa on Arrival';
    case 'e_visa': return 'e-Visa';
    case 'visa_required': return 'Visa Required';
  }
}

/**
 * Get visa type color for UI
 */
export function getVisaTypeColor(visaType: VisaRequirement['visaType']): string {
  switch (visaType) {
    case 'visa_free': return 'green';
    case 'visa_on_arrival': return 'yellow';
    case 'e_visa': return 'blue';
    case 'visa_required': return 'red';
  }
}
