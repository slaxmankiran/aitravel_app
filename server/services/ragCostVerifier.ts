/**
 * RAG Cost Verifier Service (Phase 4)
 *
 * Verifies AI-generated activity costs AND visa costs against the knowledge base.
 * Returns verification metadata with confidence levels and citations.
 *
 * How it works:
 * 1. Search knowledge base for pricing info about the activity + destination
 * 2. Search for visa/e-visa/VOA costs based on passport and destination
 * 3. Extract price from matched documents
 * 4. Compare with AI estimate and determine confidence
 * 5. Return verification with citation if found
 */

import { db } from "../db";
import { knowledgeDocuments, EMBEDDING_DIM } from "../../shared/knowledgeSchema";
import { generateEmbedding } from "./embeddings";
import { sql, desc, and, or, eq } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export interface CostVerificationResult {
  source: "rag_knowledge" | "api_estimate" | "ai_estimate";
  confidence: "high" | "medium" | "low";
  verifiedCost?: number;
  originalEstimate: number;
  citation?: string;
  sourceUrl?: string;
  lastVerified?: string;
  priceVariance?: number; // Percentage difference from AI estimate
}

export interface ActivityForVerification {
  name: string;
  type: "activity" | "meal" | "transport" | "lodging";
  estimatedCost: number;
  location?: string;
}

export interface VerificationBatchResult {
  verified: number;
  unverified: number;
  results: Map<string, CostVerificationResult>;
}

// ============================================================================
// VISA COST TYPES
// ============================================================================

export type VisaType = "visa_free" | "visa_on_arrival" | "e_visa" | "visa_required";

export interface VisaCostVerificationInput {
  visaType: VisaType;
  passport: string;       // e.g., "India", "USA"
  destination: string;    // e.g., "Thailand", "Japan"
  estimatedCost?: number; // AI-estimated cost if available
}

export interface VisaCostVerificationResult {
  source: "rag_knowledge" | "official_gov" | "ai_estimate";
  confidence: "high" | "medium" | "low";
  verifiedCost?: number;
  originalEstimate?: number;
  citation?: string;
  sourceUrl?: string;
  lastVerified?: string;
  visaType: VisaType;
  processingFee?: number;      // Base processing fee
  serviceFee?: number;         // Third-party service fee (if using agent)
  expediteFee?: number;        // Rush processing fee
  notes?: string;              // Any relevant notes about the fee
}

// ============================================================================
// PRICE EXTRACTION
// ============================================================================

/**
 * Extract price from text content using regex patterns
 */
function extractPriceFromText(content: string): number | null {
  const patterns = [
    // "$25" or "$25.00" or "$25 USD"
    /\$(\d+(?:\.\d{2})?)\s*(?:USD)?/i,
    // "25 USD" or "25 dollars"
    /(\d+(?:\.\d{2})?)\s*(?:USD|dollars?)/i,
    // "costs $25" or "price: $25" or "fee: $25"
    /(?:costs?|price|fee|admission|entrance|ticket)[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    // "€25" or "25 EUR"
    /€(\d+(?:\.\d{2})?)/i,
    /(\d+(?:\.\d{2})?)\s*(?:EUR|euros?)/i,
    // "Free" or "free admission"
    /free\s*(?:admission|entry|entrance)?/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      // Check for "free"
      if (pattern.source.includes("free") && match[0].toLowerCase().includes("free")) {
        return 0;
      }
      if (match[1]) {
        return parseFloat(match[1]);
      }
    }
  }

  return null;
}

/**
 * Extract price range from text (e.g., "$20-30" or "20-30 USD")
 */
function extractPriceRange(content: string): { min: number; max: number } | null {
  const patterns = [
    /\$(\d+)[\s-]+(?:\$)?(\d+)/i,
    /(\d+)[\s-]+(\d+)\s*(?:USD|dollars)/i,
    /€(\d+)[\s-]+(?:€)?(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1] && match[2]) {
      return {
        min: parseFloat(match[1]),
        max: parseFloat(match[2]),
      };
    }
  }

  return null;
}

// ============================================================================
// VISA COST EXTRACTION
// ============================================================================

/**
 * Known visa costs by corridor (fallback data when RAG has no match)
 * Sources: Official government websites and embassy sites
 * Last verified: 2026-01
 */
const KNOWN_VISA_COSTS: Record<string, Record<string, {
  visaType: VisaType;
  cost: number;
  source: string;
  sourceUrl?: string;
  notes?: string;
}>> = {
  // Indian passport holders
  "India": {
    "Thailand": {
      visaType: "visa_on_arrival",
      cost: 2000, // THB (~$57 USD)
      source: "Thailand Immigration Bureau",
      sourceUrl: "https://www.immigration.go.th",
      notes: "2000 THB (~$57 USD) for 15-day VOA"
    },
    "Vietnam": {
      visaType: "e_visa",
      cost: 25,
      source: "Vietnam Immigration Department",
      sourceUrl: "https://evisa.gov.vn",
      notes: "$25 USD for 30-day single entry e-visa"
    },
    "Cambodia": {
      visaType: "visa_on_arrival",
      cost: 30,
      source: "Cambodia Ministry of Foreign Affairs",
      notes: "$30 USD for tourist visa"
    },
    "Indonesia": {
      visaType: "visa_on_arrival",
      cost: 35,
      source: "Indonesian Immigration",
      notes: "$35 USD for 30-day VOA (extendable)"
    },
    "Turkey": {
      visaType: "e_visa",
      cost: 50,
      source: "Turkey e-Visa Portal",
      sourceUrl: "https://www.evisa.gov.tr",
      notes: "$50 USD for 30-day multiple entry"
    },
    "UAE": {
      visaType: "visa_on_arrival",
      cost: 0,
      source: "UAE Ministry of Interior",
      notes: "Free 14-day visa on arrival"
    },
    "Japan": {
      visaType: "visa_required",
      cost: 27,
      source: "Embassy of Japan",
      notes: "$27 USD single entry (processing may vary by VFS)"
    },
    "UK": {
      visaType: "visa_required",
      cost: 134,
      source: "UK Home Office",
      sourceUrl: "https://www.gov.uk/standard-visitor",
      notes: "£134 (~$168 USD) for 6-month Standard Visitor"
    },
    "USA": {
      visaType: "visa_required",
      cost: 185,
      source: "US Department of State",
      sourceUrl: "https://travel.state.gov",
      notes: "$185 USD MRV fee for B1/B2 visitor visa"
    },
    "Schengen": {
      visaType: "visa_required",
      cost: 80,
      source: "European Commission",
      notes: "€80 (~$85 USD) standard Schengen visa"
    },
  },
  // US passport holders
  "USA": {
    "Thailand": { visaType: "visa_free", cost: 0, source: "Thailand Immigration", notes: "30-day visa exemption" },
    "Vietnam": { visaType: "visa_free", cost: 0, source: "Vietnam Immigration", notes: "45-day visa exemption since Aug 2023" },
    "Cambodia": { visaType: "e_visa", cost: 36, source: "Cambodia e-Visa", notes: "$36 for e-visa or $30 VOA" },
    "Indonesia": { visaType: "visa_free", cost: 0, source: "Indonesian Immigration", notes: "30-day visa free (non-extendable)" },
    "Japan": { visaType: "visa_free", cost: 0, source: "Japan Immigration", notes: "90-day visa exemption" },
    "UK": { visaType: "visa_free", cost: 0, source: "UK Home Office", notes: "6-month visa exemption" },
    "Schengen": { visaType: "visa_free", cost: 0, source: "European Commission", notes: "90/180 day visa exemption" },
    "Brazil": { visaType: "e_visa", cost: 44.50, source: "Brazil Consular Services", notes: "$44.50 for e-visa" },
    "Australia": { visaType: "e_visa", cost: 20, source: "Australian Immigration", sourceUrl: "https://immi.homeaffairs.gov.au", notes: "AUD $20 for ETA (subclass 601)" },
    "Turkey": { visaType: "e_visa", cost: 50, source: "Turkey e-Visa Portal", notes: "$50 for 90-day multiple entry" },
  },
  // UK passport holders
  "UK": {
    "Thailand": { visaType: "visa_free", cost: 0, source: "Thailand Immigration", notes: "30-day visa exemption" },
    "Vietnam": { visaType: "e_visa", cost: 25, source: "Vietnam Immigration", notes: "$25 e-visa required" },
    "Japan": { visaType: "visa_free", cost: 0, source: "Japan Immigration", notes: "90-day visa exemption" },
    "USA": { visaType: "e_visa", cost: 21, source: "US CBP", sourceUrl: "https://esta.cbp.dhs.gov", notes: "$21 ESTA fee for VWP" },
    "Schengen": { visaType: "visa_free", cost: 0, source: "European Commission", notes: "90/180 day visa exemption" },
    "Australia": { visaType: "e_visa", cost: 20, source: "Australian Immigration", notes: "AUD $20 for ETA" },
    "UAE": { visaType: "visa_free", cost: 0, source: "UAE Immigration", notes: "30-day visa exemption" },
  },
};

/**
 * Extract visa fee from text content using specialized patterns
 */
function extractVisaFeeFromText(content: string): {
  processingFee?: number;
  serviceFee?: number;
  expediteFee?: number;
  totalFee?: number;
} | null {
  const result: {
    processingFee?: number;
    serviceFee?: number;
    expediteFee?: number;
    totalFee?: number;
  } = {};

  const lowerContent = content.toLowerCase();

  // Visa fee patterns
  const feePatterns = [
    // "$35 visa fee" or "visa fee: $35" or "visa application fee $35"
    /visa\s*(?:application\s*)?fee[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    // "e-visa costs $25" or "evisa: $25"
    /e[\-\s]?visa[:\s]*(?:costs?|fee)?[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    // "VOA fee $30" or "visa on arrival: $30"
    /(?:voa|visa[\s-]*on[\s-]*arrival)[:\s]*(?:fee)?[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    // "processing fee: $10"
    /processing\s*fee[:\s]*\$?(\d+(?:\.\d{2})?)/i,
  ];

  for (const pattern of feePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      result.processingFee = parseFloat(match[1]);
      break;
    }
  }

  // Service fee patterns (VFS, iVisa, etc.)
  const servicePatterns = [
    /service\s*(?:charge|fee)[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /(?:vfs|cts)\s*(?:service\s*)?fee[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /handling\s*(?:charge|fee)[:\s]*\$?(\d+(?:\.\d{2})?)/i,
  ];

  for (const pattern of servicePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      result.serviceFee = parseFloat(match[1]);
      break;
    }
  }

  // Expedite/rush fee patterns
  const expeditePatterns = [
    /(?:expedite|rush|express)\s*(?:processing\s*)?(?:fee)?[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /urgent\s*(?:processing\s*)?fee[:\s]*\$?(\d+(?:\.\d{2})?)/i,
  ];

  for (const pattern of expeditePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      result.expediteFee = parseFloat(match[1]);
      break;
    }
  }

  // Total cost patterns
  const totalPatterns = [
    /total\s*(?:cost|fee|amount)[:\s]*\$?(\d+(?:\.\d{2})?)/i,
    /(?:costs?|approximately)[:\s]*\$?(\d+(?:\.\d{2})?)\s*(?:usd|dollars?)?(?:\s*total)?/i,
  ];

  for (const pattern of totalPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      result.totalFee = parseFloat(match[1]);
      break;
    }
  }

  // Calculate total if not directly found
  if (!result.totalFee && (result.processingFee || result.serviceFee)) {
    result.totalFee = (result.processingFee || 0) + (result.serviceFee || 0);
  }

  // Fallback: try generic price extraction
  if (!result.processingFee && !result.totalFee) {
    const genericPrice = extractPriceFromText(content);
    if (genericPrice !== null) {
      result.processingFee = genericPrice;
      result.totalFee = genericPrice;
    }
  }

  return (result.processingFee || result.totalFee) ? result : null;
}

// ============================================================================
// RAG SEARCH
// ============================================================================

/**
 * Search knowledge base for pricing information about an activity
 */
async function searchPricingInfo(
  activityName: string,
  destination: string,
  activityType: string
): Promise<{
  content: string;
  sourceName: string;
  sourceUrl: string | null;
  lastVerified: Date | null;
  similarity: number;
} | null> {
  try {
    // Build a query for pricing information
    const query = `${activityName} ${destination} price cost admission fee ticket`;

    // Generate embedding
    const embeddingResult = await generateEmbedding(query);
    const queryEmbedding = embeddingResult.embedding;

    // Search with vector similarity
    const similarity = sql<number>`1 - (${cosineDistance(knowledgeDocuments.embedding, queryEmbedding)})`;

    const results = await db
      .select({
        content: knowledgeDocuments.content,
        sourceName: knowledgeDocuments.sourceName,
        sourceUrl: knowledgeDocuments.sourceUrl,
        lastVerified: knowledgeDocuments.lastVerified,
        similarity,
      })
      .from(knowledgeDocuments)
      .where(
        or(
          eq(knowledgeDocuments.sourceType, "pricing"),
          eq(knowledgeDocuments.sourceType, "attraction"),
          eq(knowledgeDocuments.sourceType, "activity"),
          eq(knowledgeDocuments.sourceType, "restaurant"),
          eq(knowledgeDocuments.sourceType, "transport"),
        )
      )
      .orderBy(desc(similarity))
      .limit(3);

    // Filter by minimum similarity threshold
    const MIN_SIMILARITY = 0.65;
    const bestMatch = results.find((r: typeof results[number]) => r.similarity >= MIN_SIMILARITY);

    if (!bestMatch) {
      return null;
    }

    return {
      content: bestMatch.content,
      sourceName: bestMatch.sourceName || "Travel Database",
      sourceUrl: bestMatch.sourceUrl,
      lastVerified: bestMatch.lastVerified,
      similarity: bestMatch.similarity,
    };
  } catch (error) {
    console.error(`[RAGCostVerifier] Search error for ${activityName}:`, error);
    return null;
  }
}

// ============================================================================
// VISA RAG SEARCH
// ============================================================================

/**
 * Normalize country name for lookup
 */
function normalizeCountry(country: string): string {
  const normalized = country.trim();

  // Common aliases
  const aliases: Record<string, string> = {
    "United States": "USA",
    "United States of America": "USA",
    "U.S.A.": "USA",
    "U.S.": "USA",
    "America": "USA",
    "United Kingdom": "UK",
    "Great Britain": "UK",
    "Britain": "UK",
    "U.K.": "UK",
    "England": "UK", // Technically incorrect but commonly used
    "Republic of India": "India",
    "Bharat": "India",
  };

  return aliases[normalized] || normalized;
}

/**
 * Extract destination country from destination string
 * e.g., "Bangkok, Thailand" -> "Thailand"
 */
function extractDestinationCountry(destination: string): string {
  const parts = destination.split(",").map(s => s.trim());
  // Usually the country is the last part
  return parts[parts.length - 1] || destination;
}

/**
 * Search knowledge base for visa pricing information
 */
async function searchVisaPricingInfo(
  passport: string,
  destination: string
): Promise<{
  content: string;
  sourceName: string;
  sourceUrl: string | null;
  lastVerified: Date | null;
  similarity: number;
} | null> {
  try {
    // Build a visa-specific query
    const query = `${passport} passport visa ${destination} fee cost price e-visa evisa VOA visa on arrival application`;

    // Generate embedding
    const embeddingResult = await generateEmbedding(query);
    const queryEmbedding = embeddingResult.embedding;

    // Search with vector similarity - focus on visa documents
    const similarity = sql<number>`1 - (${cosineDistance(knowledgeDocuments.embedding, queryEmbedding)})`;

    const results = await db
      .select({
        content: knowledgeDocuments.content,
        sourceName: knowledgeDocuments.sourceName,
        sourceUrl: knowledgeDocuments.sourceUrl,
        lastVerified: knowledgeDocuments.lastVerified,
        similarity,
      })
      .from(knowledgeDocuments)
      .where(
        or(
          eq(knowledgeDocuments.sourceType, "visa"),
          eq(knowledgeDocuments.sourceType, "entry"),
          eq(knowledgeDocuments.sourceType, "pricing"),
        )
      )
      .orderBy(desc(similarity))
      .limit(5);

    // Filter by minimum similarity threshold (lower for visa as it's more specific)
    const MIN_SIMILARITY = 0.60;
    const bestMatch = results.find((r: typeof results[number]) => r.similarity >= MIN_SIMILARITY);

    if (!bestMatch) {
      return null;
    }

    return {
      content: bestMatch.content,
      sourceName: bestMatch.sourceName || "Visa Database",
      sourceUrl: bestMatch.sourceUrl,
      lastVerified: bestMatch.lastVerified,
      similarity: bestMatch.similarity,
    };
  } catch (error) {
    console.error(`[RAGCostVerifier] Visa search error for ${passport} → ${destination}:`, error);
    return null;
  }
}

/**
 * Verify visa cost using RAG + known costs fallback
 */
export async function verifyVisaCost(
  input: VisaCostVerificationInput
): Promise<VisaCostVerificationResult> {
  const { visaType, passport, destination, estimatedCost } = input;

  const normalizedPassport = normalizeCountry(passport);
  const destinationCountry = extractDestinationCountry(destination);
  const normalizedDestination = normalizeCountry(destinationCountry);

  console.log(`[RAGCostVerifier] Verifying visa cost: ${normalizedPassport} → ${normalizedDestination} (${visaType})`);

  // Default result for visa_free
  if (visaType === "visa_free") {
    return {
      source: "rag_knowledge",
      confidence: "high",
      verifiedCost: 0,
      originalEstimate: estimatedCost,
      visaType,
      notes: "No visa required",
    };
  }

  // Try RAG search first
  const ragResult = await searchVisaPricingInfo(normalizedPassport, normalizedDestination);

  if (ragResult) {
    const visaFees = extractVisaFeeFromText(ragResult.content);

    if (visaFees && (visaFees.totalFee !== undefined || visaFees.processingFee !== undefined)) {
      const verifiedCost = visaFees.totalFee || visaFees.processingFee || 0;

      // Determine confidence based on source
      const isGovSource = ragResult.sourceName.toLowerCase().includes("gov") ||
                         ragResult.sourceName.toLowerCase().includes("official") ||
                         ragResult.sourceName.toLowerCase().includes("embassy");

      const confidence: "high" | "medium" | "low" =
        isGovSource ? "high" :
        ragResult.lastVerified && (Date.now() - ragResult.lastVerified.getTime()) < 180 * 24 * 60 * 60 * 1000
          ? "medium" : "low";

      console.log(`[RAGCostVerifier] Visa RAG match: $${verifiedCost} from ${ragResult.sourceName} (${confidence} confidence)`);

      return {
        source: "rag_knowledge",
        confidence,
        verifiedCost,
        originalEstimate: estimatedCost,
        citation: ragResult.sourceName,
        sourceUrl: ragResult.sourceUrl || undefined,
        lastVerified: ragResult.lastVerified?.toISOString(),
        visaType,
        processingFee: visaFees.processingFee,
        serviceFee: visaFees.serviceFee,
        expediteFee: visaFees.expediteFee,
      };
    }
  }

  // Fallback to known costs
  const knownCost = KNOWN_VISA_COSTS[normalizedPassport]?.[normalizedDestination];

  if (knownCost) {
    console.log(`[RAGCostVerifier] Using known visa cost: $${knownCost.cost} (${knownCost.source})`);

    return {
      source: knownCost.sourceUrl ? "official_gov" : "rag_knowledge",
      confidence: "high", // Known costs are manually verified
      verifiedCost: knownCost.cost,
      originalEstimate: estimatedCost,
      citation: knownCost.source,
      sourceUrl: knownCost.sourceUrl,
      visaType: knownCost.visaType,
      processingFee: knownCost.cost,
      notes: knownCost.notes,
    };
  }

  // No data found - return AI estimate with low confidence
  console.log(`[RAGCostVerifier] No visa cost data found for ${normalizedPassport} → ${normalizedDestination}`);

  return {
    source: "ai_estimate",
    confidence: "low",
    verifiedCost: estimatedCost,
    originalEstimate: estimatedCost,
    visaType,
    notes: "Unable to verify - please check official embassy website",
  };
}

/**
 * Get visa cost estimate for a trip
 * Convenience function that extracts visa type from trip data
 */
export async function getVisaCostForTrip(
  passport: string,
  destination: string,
  visaDetails?: {
    type?: string;
    costs?: { total?: number };
  }
): Promise<VisaCostVerificationResult> {
  // Map visa type string to VisaType enum
  const visaTypeMap: Record<string, VisaType> = {
    "visa_free": "visa_free",
    "visa-free": "visa_free",
    "visa_on_arrival": "visa_on_arrival",
    "visa-on-arrival": "visa_on_arrival",
    "voa": "visa_on_arrival",
    "e_visa": "e_visa",
    "e-visa": "e_visa",
    "evisa": "e_visa",
    "visa_required": "visa_required",
    "visa-required": "visa_required",
    "required": "visa_required",
  };

  const rawType = visaDetails?.type?.toLowerCase() || "visa_required";
  const visaType = visaTypeMap[rawType] || "visa_required";
  const estimatedCost = visaDetails?.costs?.total;

  return verifyVisaCost({
    visaType,
    passport,
    destination,
    estimatedCost,
  });
}

// ============================================================================
// VERIFICATION LOGIC
// ============================================================================

/**
 * Determine confidence based on source and price variance
 */
function determineConfidence(
  sourceName: string,
  priceVariance: number,
  lastVerified: Date | null
): "high" | "medium" | "low" {
  // Check source trust level
  const lowerSource = sourceName.toLowerCase();
  const isOfficialSource =
    lowerSource.includes("gov") ||
    lowerSource.includes("official") ||
    lowerSource.includes("tripadvisor") ||
    lowerSource.includes("viator") ||
    lowerSource.includes("getyourguide");

  // Check data freshness (within 6 months = high, 1 year = medium, older = low)
  const now = new Date();
  const sixMonthsAgo = new Date(now.setMonth(now.getMonth() - 6));
  const oneYearAgo = new Date(now.setMonth(now.getMonth() - 6));

  const isFresh = lastVerified && lastVerified > sixMonthsAgo;
  const isRecent = lastVerified && lastVerified > oneYearAgo;

  // Check price variance (within 20% = high, 40% = medium, else = low)
  const isAccurate = Math.abs(priceVariance) <= 20;
  const isReasonable = Math.abs(priceVariance) <= 40;

  if (isOfficialSource && isFresh && isAccurate) {
    return "high";
  }

  if ((isOfficialSource || isFresh) && isReasonable) {
    return "medium";
  }

  return "low";
}

/**
 * Verify a single activity's cost against the knowledge base
 */
export async function verifyCost(
  activity: ActivityForVerification,
  destination: string
): Promise<CostVerificationResult> {
  // Default result for unverified
  const defaultResult: CostVerificationResult = {
    source: "ai_estimate",
    confidence: "low",
    originalEstimate: activity.estimatedCost,
  };

  // Skip free activities - no verification needed
  if (activity.estimatedCost === 0) {
    return {
      ...defaultResult,
      confidence: "medium", // Free is usually reliable
    };
  }

  // Search knowledge base
  const searchResult = await searchPricingInfo(
    activity.name,
    destination,
    activity.type
  );

  if (!searchResult) {
    console.log(`[RAGCostVerifier] No pricing data found for: ${activity.name}`);
    return defaultResult;
  }

  // Extract price from content
  const extractedPrice = extractPriceFromText(searchResult.content);
  const priceRange = extractPriceRange(searchResult.content);

  let verifiedCost: number | undefined;

  if (extractedPrice !== null) {
    verifiedCost = extractedPrice;
  } else if (priceRange) {
    // Use midpoint of range
    verifiedCost = (priceRange.min + priceRange.max) / 2;
  }

  if (verifiedCost === undefined) {
    console.log(`[RAGCostVerifier] Could not extract price from content for: ${activity.name}`);
    return defaultResult;
  }

  // Calculate variance
  const priceVariance = activity.estimatedCost > 0
    ? ((verifiedCost - activity.estimatedCost) / activity.estimatedCost) * 100
    : 0;

  // Determine confidence
  const confidence = determineConfidence(
    searchResult.sourceName,
    priceVariance,
    searchResult.lastVerified
  );

  console.log(`[RAGCostVerifier] Verified ${activity.name}: $${activity.estimatedCost} → $${verifiedCost} (${priceVariance.toFixed(1)}% variance, ${confidence} confidence)`);

  return {
    source: "rag_knowledge",
    confidence,
    verifiedCost,
    originalEstimate: activity.estimatedCost,
    citation: searchResult.sourceName,
    sourceUrl: searchResult.sourceUrl || undefined,
    lastVerified: searchResult.lastVerified?.toISOString(),
    priceVariance,
  };
}

/**
 * Verify multiple activities in batch (more efficient)
 */
export async function verifyCostsBatch(
  activities: Array<{ key: string; activity: ActivityForVerification }>,
  destination: string
): Promise<VerificationBatchResult> {
  const results = new Map<string, CostVerificationResult>();
  let verified = 0;
  let unverified = 0;

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 3;

  for (let i = 0; i < activities.length; i += BATCH_SIZE) {
    const batch = activities.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async ({ key, activity }) => {
        const result = await verifyCost(activity, destination);
        return { key, result };
      })
    );

    for (const { key, result } of batchResults) {
      results.set(key, result);
      if (result.source === "rag_knowledge") {
        verified++;
      } else {
        unverified++;
      }
    }
  }

  return { verified, unverified, results };
}

// ============================================================================
// ITINERARY ENHANCEMENT
// ============================================================================

import type { ItineraryDay, ItineraryActivity } from "./streamingItinerary";

/**
 * Enhance itinerary activities with RAG-verified costs
 * This is called after validation to upgrade confidence levels
 */
export async function enhanceWithRagVerification(
  days: ItineraryDay[],
  destination: string
): Promise<ItineraryDay[]> {
  console.log(`[RAGCostVerifier] Starting verification for ${days.length} days in ${destination}`);

  // Collect all activities with their keys
  const activitiesToVerify: Array<{
    dayIndex: number;
    activityIndex: number;
    key: string;
    activity: ActivityForVerification;
  }> = [];

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx];
    for (let actIdx = 0; actIdx < day.activities.length; actIdx++) {
      const activity = day.activities[actIdx];
      // Skip free activities and transport
      if (activity.estimatedCost > 0 && activity.type !== "transport") {
        activitiesToVerify.push({
          dayIndex: dayIdx,
          activityIndex: actIdx,
          key: `${dayIdx}-${actIdx}`,
          activity: {
            name: activity.name,
            type: activity.type,
            estimatedCost: activity.estimatedCost,
            location: activity.location,
          },
        });
      }
    }
  }

  console.log(`[RAGCostVerifier] Verifying ${activitiesToVerify.length} paid activities`);

  // Verify in batch
  const verificationResults = await verifyCostsBatch(
    activitiesToVerify.map(a => ({ key: a.key, activity: a.activity })),
    destination
  );

  console.log(`[RAGCostVerifier] Verified: ${verificationResults.verified}, Unverified: ${verificationResults.unverified}`);

  // Apply verification results to activities
  const enhancedDays = days.map((day, dayIdx) => ({
    ...day,
    activities: day.activities.map((activity, actIdx) => {
      const key = `${dayIdx}-${actIdx}`;
      const verification = verificationResults.results.get(key);

      if (verification && verification.source === "rag_knowledge") {
        return {
          ...activity,
          // Optionally update cost to verified value
          // estimatedCost: verification.verifiedCost ?? activity.estimatedCost,
          costVerification: {
            source: verification.source,
            confidence: verification.confidence,
            lastVerified: verification.lastVerified,
            citation: verification.citation,
            originalEstimate: verification.originalEstimate,
          },
        };
      }

      // Keep existing verification or add default
      return {
        ...activity,
        costVerification: activity.costVerification || {
          source: "ai_estimate" as const,
          confidence: "low" as const,
        },
      };
    }),
  }));

  return enhancedDays;
}

/**
 * Check if RAG verification should be enabled
 * (only if knowledge base has pricing data)
 */
export async function isRagVerificationAvailable(): Promise<boolean> {
  try {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeDocuments)
      .where(
        or(
          eq(knowledgeDocuments.sourceType, "pricing"),
          eq(knowledgeDocuments.sourceType, "attraction"),
          eq(knowledgeDocuments.sourceType, "activity"),
        )
      );

    const hasPricingData = (result?.count || 0) > 0;
    console.log(`[RAGCostVerifier] Pricing data available: ${hasPricingData} (${result?.count || 0} documents)`);
    return hasPricingData;
  } catch (error) {
    console.error("[RAGCostVerifier] Error checking availability:", error);
    return false;
  }
}
