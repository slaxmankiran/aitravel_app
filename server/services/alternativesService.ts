import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Alternatives Service
 *
 * Provides alternative destination suggestions when a trip hits a HARD_BLOCKER.
 * Uses passport region to suggest visa-friendly alternatives.
 */

export interface Alternative {
  destination: string;
  destinationCode: string;
  city: string;
  flag: string;
  visaType: 'visa_free' | 'voa' | 'e_visa' | 'embassy';  // Internal enum for logic/analytics
  visaStatus: 'visa_free' | 'visa_on_arrival' | 'e_visa' | 'embassy_visa';  // User-facing display
  visaLabel: string;
  processingDays: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  // Curation metadata - controls product behavior
  isCurated: boolean;                              // First-class product switch
  curationLevel?: 'manual' | 'auto';               // How curation was determined
  lastReviewedAt?: string;                         // ISO date of last human review
}

interface RegionData {
  passports: string[];
  alternatives: Alternative[];
}

interface AlternativesData {
  regions: Record<string, RegionData>;
}

let alternativesData: AlternativesData | null = null;

/**
 * Load alternatives data from JSON file
 */
function loadAlternativesData(): AlternativesData | null {
  if (alternativesData) return alternativesData;

  try {
    const filePath = path.join(__dirname, '..', 'data', 'alternatives', 'by_passport_region.json');

    if (!fs.existsSync(filePath)) {
      console.warn('[Alternatives] Data file not found:', filePath);
      return null;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    alternativesData = JSON.parse(raw) as AlternativesData;
    console.log('[Alternatives] Loaded alternatives data');
    return alternativesData;
  } catch (error) {
    console.error('[Alternatives] Error loading data:', error);
    return null;
  }
}

/**
 * Normalize passport input to match region data
 */
function normalizePassport(passport: string): string {
  return passport.trim().toUpperCase();
}

/**
 * Find the region for a given passport
 */
function findRegionForPassport(passport: string): RegionData | null {
  const data = loadAlternativesData();
  if (!data) return null;

  const normalizedPassport = normalizePassport(passport);

  // Check each region's passports list
  for (const [regionName, region] of Object.entries(data.regions)) {
    if (regionName === 'global_fallback') continue; // Skip fallback in first pass

    for (const p of region.passports) {
      if (normalizePassport(p) === normalizedPassport) {
        return region;
      }
    }
  }

  // Return global fallback if no specific region found
  return data.regions.global_fallback || null;
}

/**
 * Get alternative destinations for a passport
 *
 * @param passport - The passport nationality
 * @param blockedDestination - The destination that was blocked (to exclude from results)
 * @param maxResults - Maximum number of alternatives to return (default: 3)
 */
export function getAlternatives(
  passport: string,
  blockedDestination?: string,
  maxResults: number = 3
): Alternative[] {
  const region = findRegionForPassport(passport);

  if (!region || !region.alternatives) {
    console.log(`[Alternatives] No alternatives found for passport: ${passport}`);
    return [];
  }

  // Filter out the blocked destination and prioritize by confidence
  let alternatives = region.alternatives.filter(alt => {
    if (!blockedDestination) return true;

    // Check if this alternative matches the blocked destination
    const blockedLower = blockedDestination.toLowerCase();
    return !blockedLower.includes(alt.destination.toLowerCase()) &&
           !blockedLower.includes(alt.city.toLowerCase());
  });

  // Sort by: 1) isCurated first, 2) confidence (high > medium > low)
  alternatives.sort((a, b) => {
    // Curated alternatives first (these have verified data)
    if (a.isCurated && !b.isCurated) return -1;
    if (!a.isCurated && b.isCurated) return 1;

    // Then by confidence level
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
  });

  // Return top N
  const result = alternatives.slice(0, maxResults);
  console.log(`[Alternatives] Returning ${result.length} alternatives for ${passport} (blocked: ${blockedDestination || 'none'})`);

  return result;
}

/**
 * Get available passport regions
 */
export function getAvailableRegions(): string[] {
  const data = loadAlternativesData();
  if (!data) return [];
  return Object.keys(data.regions).filter(r => r !== 'global_fallback');
}
