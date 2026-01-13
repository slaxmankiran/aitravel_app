/**
 * Visa Service
 *
 * RAG-based visa lookup with caching and trust-level validation.
 * Fetches cited visa information from the knowledge base.
 */

import { sql, and, or, eq, desc, cosineDistance } from "drizzle-orm";
import { db } from "../db";
import { knowledgeDocuments } from "@shared/knowledgeSchema";
import { generateEmbedding } from "./embeddings";
import {
  VisaFacts,
  computeVisaConfidence,
} from "@shared/knowledgeSchema";
import type { VisaDetails } from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface VisaCacheEntry {
  data: VisaFacts | null;
  timestamp: number;
}

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

// In-memory LRU cache with 24-hour TTL
const VISA_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const VISA_CACHE_MAX_SIZE = 500; // Max entries

const visaFactsCache = new Map<string, VisaCacheEntry>();

// ============================================================================
// CACHE HELPERS
// ============================================================================

function getVisaCacheKey(passport: string, destination: string): string {
  return `visaFacts:${passport.toUpperCase()}:${destination.toUpperCase()}`;
}

function getCachedVisaFacts(passport: string, destination: string): VisaFacts | null | undefined {
  const key = getVisaCacheKey(passport, destination);
  const entry = visaFactsCache.get(key);

  if (!entry) return undefined; // Not in cache

  // Check TTL
  if (Date.now() - entry.timestamp > VISA_CACHE_TTL_MS) {
    visaFactsCache.delete(key);
    return undefined; // Expired
  }

  console.log(`[VisaService] Cache HIT for ${passport} → ${destination}`);
  return entry.data;
}

function setCachedVisaFacts(passport: string, destination: string, data: VisaFacts | null): void {
  const key = getVisaCacheKey(passport, destination);

  // LRU eviction: if at max size, delete oldest entry
  if (visaFactsCache.size >= VISA_CACHE_MAX_SIZE) {
    const oldestKey = visaFactsCache.keys().next().value;
    if (oldestKey) visaFactsCache.delete(oldestKey);
  }

  visaFactsCache.set(key, { data, timestamp: Date.now() });
  console.log(`[VisaService] Cache SET for ${passport} → ${destination} (size: ${visaFactsCache.size})`);
}

// ============================================================================
// CONTENT PARSING HELPERS
// ============================================================================

/**
 * Determine trust level from source name
 */
function determineTrustLevel(sourceName: string | null): "high" | "medium" | "low" {
  if (!sourceName) return "low";
  const lower = sourceName.toLowerCase();
  if (lower.includes("embassy") || lower.includes("consulate") || lower.includes("immigration") || lower.includes("gov")) {
    return "high";
  }
  if (lower.includes("travel database") || lower.includes("visa guide") || lower.includes("lonely planet")) {
    return "medium";
  }
  return "low";
}

/**
 * Parse visa status from content
 */
function parseVisaStatusFromContent(content: string): VisaFacts["visaStatus"] {
  const lower = content.toLowerCase();

  if ((lower.includes("visa-free") || lower.includes("visa free")) && !lower.includes("not visa-free")) {
    return "visa_free";
  }
  if (lower.includes("no visa required") || lower.includes("visa not required")) {
    return "visa_free";
  }

  const explicitNoVoa = lower.includes("no visa on arrival") || lower.includes("no voa available");
  const explicitNoEvisa = lower.includes("no e-visa") || lower.includes("or e-visa available");

  if (explicitNoVoa && explicitNoEvisa) {
    return "embassy_visa";
  }

  const hasVoaInfo = lower.includes("visa on arrival") || lower.includes("voa");
  const voaPositive = lower.includes("can obtain a visa on arrival") || lower.includes("voa available") ||
    (hasVoaInfo && !explicitNoVoa && (lower.includes("voa allows") || lower.includes("voa costs")));

  if (voaPositive && !explicitNoVoa) {
    return "visa_on_arrival";
  }

  const evisaPositive = lower.includes("e-visa available") || lower.includes("apply for an e-visa") || lower.includes("e-visa:");

  if (evisaPositive && !explicitNoEvisa) {
    return "evisa";
  }

  if (lower.includes("require a visa") || lower.includes("visa required") || lower.includes("tourist visa") || lower.includes("embassy")) {
    return "embassy_visa";
  }

  return "unknown";
}

/**
 * Extract fees from content
 */
function extractFeesFromContent(content: string): string | undefined {
  const patterns = [/fee[s]?\s*(?:is|are|of)?\s*(?:approximately\s*)?(\$\d+[\d,]*(?:\s*USD)?)/i, /(\$\d+[\d,]*(?:\s*USD)?)\s*(?:fee|cost)/i];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) return match[1];
  }
  if (content.toLowerCase().includes("free of charge") || content.toLowerCase().includes("no fee")) return "Free";
  return undefined;
}

/**
 * Extract required documents
 */
function extractRequiredDocsFromContent(content: string): string[] {
  const docs: string[] = [];
  const lower = content.toLowerCase();
  if (lower.includes("passport") && lower.includes("valid")) docs.push("Valid passport (6+ months validity)");
  if (lower.includes("proof of onward") || lower.includes("return ticket")) docs.push("Proof of onward/return travel");
  if (lower.includes("proof of accommodation") || lower.includes("hotel booking")) docs.push("Proof of accommodation");
  if (lower.includes("passport photo")) docs.push("Passport-size photos");
  if (lower.includes("bank statement") || lower.includes("proof of funds")) docs.push("Proof of sufficient funds");
  return docs;
}

/**
 * Extract max stay days
 */
function extractMaxStayDays(content: string): number | undefined {
  const patterns = [/stay[s]?\s*(?:up\s*to\s*)?(\d+)\s*days/i, /(\d+)\s*days?\s*(?:maximum\s*)?stay/i, /valid\s*(?:for\s*)?(\d+)\s*days/i];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Extract processing days
 */
function extractProcessingDays(content: string): { min?: number; max?: number } {
  const maxMatch = content.match(/processing[^.]*?\d+\s*to\s*(\d+)\s*days/i) || content.match(/(\d+)\s*days?\s*maximum/i);
  const minMatch = content.match(/processing[^.]*?(\d+)\s*to\s*\d+\s*days/i) || content.match(/(\d+)\s*days?\s*minimum/i);
  return {
    min: minMatch ? parseInt(minMatch[1], 10) : undefined,
    max: maxMatch ? parseInt(maxMatch[1], 10) : undefined,
  };
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Get visa facts from knowledge base with caching
 */
export async function getVisaFactsFromKnowledge(passport: string, destination: string): Promise<VisaFacts | null> {
  // Check cache first
  const cached = getCachedVisaFacts(passport, destination);
  if (cached !== undefined) {
    return cached; // Return cached result (including null for "no data found")
  }

  try {
    // Generate embedding for the visa query
    const question = `visa requirements for ${passport} passport holders traveling to ${destination}`;
    const embeddingResult = await generateEmbedding(question);
    const queryEmbedding = embeddingResult.embedding;

    // Build optimized visa query
    const similarity = sql<number>`1 - (${cosineDistance(knowledgeDocuments.embedding, queryEmbedding)})`;

    const results = await db
      .select({
        id: knowledgeDocuments.id,
        sourceId: knowledgeDocuments.sourceId,
        sourceType: knowledgeDocuments.sourceType,
        title: knowledgeDocuments.title,
        content: knowledgeDocuments.content,
        sourceUrl: knowledgeDocuments.sourceUrl,
        sourceName: knowledgeDocuments.sourceName,
        lastVerified: knowledgeDocuments.lastVerified,
        similarity,
      })
      .from(knowledgeDocuments)
      .where(
        and(
          or(
            eq(knowledgeDocuments.sourceType, "visa"),
            eq(knowledgeDocuments.sourceType, "entry_requirements")
          ),
          or(
            // Exact match on country pair
            and(
              eq(knowledgeDocuments.fromCountry, passport.toUpperCase()),
              eq(knowledgeDocuments.toCountry, destination.toUpperCase())
            ),
            // General destination info
            and(
              sql`${knowledgeDocuments.fromCountry} IS NULL`,
              eq(knowledgeDocuments.toCountry, destination.toUpperCase())
            )
          )
        )
      )
      .orderBy(desc(similarity))
      .limit(5);

    // Filter by minimum similarity
    const relevantResults = results.filter((r: typeof results[number]) => r.similarity >= 0.5);

    if (relevantResults.length === 0) {
      console.log(`[VisaService] No visa data found for ${passport} → ${destination}`);
      setCachedVisaFacts(passport, destination, null); // Cache "not found" to avoid repeated lookups
      return null;
    }

    // Build citations
    const citations = relevantResults.map((r: typeof results[number]) => ({
      title: r.title,
      url: r.sourceUrl,
      sourceName: r.sourceName || "Travel Database",
      trustLevel: determineTrustLevel(r.sourceName),
      updatedAt: r.lastVerified?.toISOString().slice(0, 10),
    }));

    // Combine content for parsing
    const combinedContent = relevantResults.map((r: typeof results[number]) => r.content).join("\n\n");

    // Parse visa status and details
    const visaStatus = parseVisaStatusFromContent(combinedContent);
    const feesText = extractFeesFromContent(combinedContent);
    const requiredDocs = extractRequiredDocsFromContent(combinedContent);
    const maxStayDays = extractMaxStayDays(combinedContent);
    const processingDays = extractProcessingDays(combinedContent);

    // Build summary
    let summary = "";
    if (visaStatus === "visa_free") {
      summary = `${passport} passport holders can visit ${destination} visa-free`;
      if (maxStayDays) summary += ` for up to ${maxStayDays} days`;
      summary += ".";
    } else if (visaStatus === "visa_on_arrival") {
      summary = `${passport} passport holders can obtain a Visa on Arrival for ${destination}`;
      if (maxStayDays) summary += ` for stays up to ${maxStayDays} days`;
      if (feesText) summary += `. Fee: ${feesText}`;
      summary += ".";
    } else if (visaStatus === "evisa") {
      summary = `${passport} passport holders can apply for an e-Visa to visit ${destination}`;
      if (processingDays.max) summary += `. Processing: ${processingDays.min || 1}-${processingDays.max} days`;
      summary += ".";
    } else if (visaStatus === "embassy_visa") {
      summary = `${passport} passport holders require a visa to visit ${destination}`;
      if (processingDays.max) summary += `. Processing time: ${processingDays.min || 5}-${processingDays.max} days`;
      summary += ".";
    } else {
      summary = `Visa requirements for ${passport} passport holders visiting ${destination}. Please check official sources.`;
    }

    const confidence = computeVisaConfidence(citations);

    // ============ SAFETY CHECKS ============
    // Count high-trust sources (official embassy/immigration)
    const highTrustCount = citations.filter((c: { trustLevel: string }) => c.trustLevel === 'high').length;

    // Log warnings for low confidence
    if (confidence === 'low') {
      console.warn(`[VisaService] ⚠️ LOW CONFIDENCE visa lookup: ${passport} → ${destination}`);
      console.warn(`[VisaService]   - Citations: ${citations.length} (${highTrustCount} high-trust)`);
      console.warn(`[VisaService]   - Status: ${visaStatus}`);
      console.warn(`[VisaService]   - Action: User should verify with official sources`);
    }

    // Log when no high-trust sources found
    if (highTrustCount === 0 && citations.length > 0) {
      console.warn(`[VisaService] ⚠️ No official sources for ${passport} → ${destination}`);
    }

    // Generate warning message for low confidence
    let warningMessage: string | undefined;
    if (confidence === 'low') {
      warningMessage = 'Limited verified data available. Please confirm with official embassy sources before making travel plans.';
    } else if (highTrustCount === 0) {
      warningMessage = 'No official embassy sources found. Consider verifying requirements.';
    }

    console.log(`[VisaService] Visa lookup: ${passport} → ${destination}: ${visaStatus} (${confidence} confidence, ${citations.length} citations, ${highTrustCount} official)`);

    const result: VisaFacts = {
      summary,
      visaStatus,
      maxStayDays,
      processingDaysMin: processingDays.min,
      processingDaysMax: processingDays.max,
      feesText,
      requiredDocs: requiredDocs.length > 0 ? requiredDocs : undefined,
      citations,
      confidence,
      passport,
      destination,
      hasCitations: true,
      warning: warningMessage,
    };

    // Cache successful result
    setCachedVisaFacts(passport, destination, result);

    return result;
  } catch (error) {
    console.error(`[VisaService] Error fetching visa data:`, error);
    // Don't cache errors - allow retry
    return null;
  }
}

/**
 * Convert VisaFacts to VisaDetails for storing in FeasibilityReport
 */
export function convertVisaFactsToVisaDetails(visaFacts: VisaFacts): VisaDetails {
  // Map visa status
  const typeMap: Record<VisaFacts["visaStatus"], VisaDetails["type"]> = {
    visa_free: "visa_free",
    visa_on_arrival: "visa_on_arrival",
    evisa: "e_visa",
    embassy_visa: "embassy_visa",
    unknown: "embassy_visa", // Conservative fallback
  };

  // Parse fee amount from feesText
  let govFee = 0;
  if (visaFacts.feesText) {
    const feeMatch = visaFacts.feesText.match(/\$(\d+)/);
    if (feeMatch) govFee = parseInt(feeMatch[1], 10);
  }

  return {
    required: visaFacts.visaStatus !== "visa_free",
    type: typeMap[visaFacts.visaStatus],
    processingDays: {
      minimum: visaFacts.processingDaysMin || (visaFacts.visaStatus === "visa_on_arrival" ? 0 : 3),
      maximum: visaFacts.processingDaysMax || (visaFacts.visaStatus === "visa_on_arrival" ? 0 : 7),
    },
    cost: {
      government: govFee,
      totalPerPerson: govFee,
      currency: "USD",
      accuracy: "curated",
    },
    documentsRequired: visaFacts.requiredDocs || [],
    applicationMethod: visaFacts.visaStatus === "visa_on_arrival" ? "on_arrival" :
                       visaFacts.visaStatus === "evisa" ? "online" : "embassy",
    sources: visaFacts.citations.map((c) => ({ title: c.title, url: c.url || "" })),
    confidenceLevel: visaFacts.confidence,
    lastVerified: visaFacts.citations[0]?.updatedAt,
  };
}

/**
 * Get visa requirements for a passport/destination pair
 * Main API function for external callers
 */
export async function getVisaRequirements(passport: string, destination: string): Promise<{
  facts: VisaFacts | null;
  details: VisaDetails | null;
}> {
  const facts = await getVisaFactsFromKnowledge(passport, destination);

  if (!facts) {
    return { facts: null, details: null };
  }

  const details = convertVisaFactsToVisaDetails(facts);
  return { facts, details };
}

/**
 * Clear the visa cache (for testing or manual refresh)
 */
export function clearVisaCache(): void {
  visaFactsCache.clear();
  console.log(`[VisaService] Cache cleared`);
}

/**
 * Get cache stats
 */
export function getVisaCacheStats(): { size: number; maxSize: number; ttlHours: number } {
  return {
    size: visaFactsCache.size,
    maxSize: VISA_CACHE_MAX_SIZE,
    ttlHours: VISA_CACHE_TTL_MS / (60 * 60 * 1000),
  };
}
