/**
 * Knowledge Routes - RAG (Retrieval Augmented Generation)
 *
 * Endpoints for searching the knowledge base using vector similarity
 * to provide cited visa/travel information.
 *
 * Rate limits:
 * - Search: 60/min per IP
 * - Visa lookup: 30/min per IP
 * - Ingest: Admin-only in production
 */

import { Router } from "express";
import { eq, and, or, inArray, sql, desc } from "drizzle-orm";
import { cosineDistance, gt, lt } from "drizzle-orm";
import { db } from "../db";
import {
  knowledgeDocuments,
  knowledgeSources,
  EMBEDDING_DIM,
  validateEmbeddingDimension,
  computeVisaConfidence,
  type KnowledgeSearchResult,
  type KnowledgeCitation,
  type KnowledgeQueryParams,
  type KnowledgeQueryResponse,
  type NewKnowledgeDocument,
  type NewKnowledgeSource,
  type VisaFacts,
  type VisaCitation,
} from "../../shared/knowledgeSchema";
import { generateEmbedding, getEmbeddingServiceStatus } from "../services/embeddings";
import {
  knowledgeSearchRateLimiter,
  visaLookupRateLimiter,
  productionAdminOnly,
} from "../middleware/rateLimiter";

export const knowledgeRouter = Router();

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

/**
 * POST /api/knowledge/search
 *
 * Semantic search over the knowledge base.
 * Returns relevant documents with similarity scores and citations.
 * Rate limited: 60/min per IP
 */
knowledgeRouter.post("/search", knowledgeSearchRateLimiter, async (req, res) => {
  try {
    const {
      query,
      fromCountry,
      toCountry,
      sourceTypes,
      limit = 5,
      minSimilarity = 0.7,
    } = req.body as KnowledgeQueryParams;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query is required" });
    }

    // Generate embedding for the query
    const embeddingResult = await generateEmbedding(query);
    const queryEmbedding = embeddingResult.embedding;

    // Build filter conditions
    const conditions: any[] = [];

    if (fromCountry) {
      conditions.push(eq(knowledgeDocuments.fromCountry, fromCountry.toUpperCase()));
    }

    if (toCountry) {
      conditions.push(eq(knowledgeDocuments.toCountry, toCountry.toUpperCase()));
    }

    if (sourceTypes && sourceTypes.length > 0) {
      conditions.push(inArray(knowledgeDocuments.sourceType, sourceTypes));
    }

    // Build the vector similarity query using cosineDistance
    // Note: cosineDistance returns distance (0 = identical), we want similarity (1 = identical)
    const similarity = sql<number>`1 - (${cosineDistance(knowledgeDocuments.embedding, queryEmbedding)})`;

    // Execute the search query
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        id: knowledgeDocuments.id,
        sourceId: knowledgeDocuments.sourceId,
        sourceType: knowledgeDocuments.sourceType,
        title: knowledgeDocuments.title,
        content: knowledgeDocuments.content,
        fromCountry: knowledgeDocuments.fromCountry,
        toCountry: knowledgeDocuments.toCountry,
        sourceUrl: knowledgeDocuments.sourceUrl,
        sourceName: knowledgeDocuments.sourceName,
        lastVerified: knowledgeDocuments.lastVerified,
        similarity,
      })
      .from(knowledgeDocuments)
      .where(whereClause)
      .orderBy(desc(similarity))
      .limit(limit);

    // Filter by minimum similarity (post-query since we can't use computed column in WHERE easily)
    const filteredResults: KnowledgeSearchResult[] = results
      .filter((r: typeof results[number]) => r.similarity >= minSimilarity)
      .map((r: typeof results[number]) => ({
        id: r.id,
        sourceId: r.sourceId,
        sourceType: r.sourceType,
        title: r.title,
        content: r.content,
        fromCountry: r.fromCountry,
        toCountry: r.toCountry,
        sourceUrl: r.sourceUrl,
        sourceName: r.sourceName,
        lastVerified: r.lastVerified,
        similarity: r.similarity,
      }));

    // Generate citations from results
    const citations: KnowledgeCitation[] = filteredResults.map(r => ({
      sourceId: r.sourceId,
      sourceName: r.sourceName || "Unknown source",
      sourceUrl: r.sourceUrl,
      title: r.title,
      snippet: r.content.slice(0, 200) + (r.content.length > 200 ? "..." : ""),
      lastVerified: r.lastVerified,
    }));

    const response: KnowledgeQueryResponse = {
      results: filteredResults,
      citations,
      queryEmbedding: process.env.NODE_ENV === "development" ? queryEmbedding : undefined,
    };

    res.json(response);
  } catch (error) {
    console.error("[Knowledge] Search error:", error);
    res.status(500).json({
      error: "Search failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// INGEST ENDPOINTS
// ============================================================================

/**
 * POST /api/knowledge/ingest
 *
 * Add a document to the knowledge base with auto-generated embedding.
 * PROTECTED: Requires X-Admin-Token header in production.
 */
knowledgeRouter.post("/ingest", productionAdminOnly, async (req, res) => {
  try {
    const {
      sourceId,
      sourceType,
      title,
      content,
      fromCountry,
      toCountry,
      sourceUrl,
      sourceName,
      metadata,
    } = req.body;

    // Validation
    if (!sourceId || !sourceType || !title || !content) {
      return res.status(400).json({
        error: "Missing required fields: sourceId, sourceType, title, content",
      });
    }

    // Generate embedding for the content
    const embeddingResult = await generateEmbedding(content);

    // Insert the document
    const [inserted] = await db
      .insert(knowledgeDocuments)
      .values({
        sourceId,
        sourceType,
        title,
        content,
        fromCountry: fromCountry?.toUpperCase() || null,
        toCountry: toCountry?.toUpperCase() || null,
        sourceUrl: sourceUrl || null,
        sourceName: sourceName || null,
        lastVerified: new Date(),
        metadata: metadata || null,
        embedding: embeddingResult.embedding,
      })
      .returning({ id: knowledgeDocuments.id });

    res.status(201).json({
      id: inserted.id,
      embeddingSource: embeddingResult.source,
      embeddingModel: embeddingResult.model,
      embeddingDimension: embeddingResult.dimension,
      latencyMs: embeddingResult.latencyMs,
    });
  } catch (error) {
    console.error("[Knowledge] Ingest error:", error);
    res.status(500).json({
      error: "Ingest failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/knowledge/ingest/batch
 *
 * Add multiple documents to the knowledge base.
 * PROTECTED: Requires X-Admin-Token header in production.
 */
knowledgeRouter.post("/ingest/batch", productionAdminOnly, async (req, res) => {
  try {
    const { documents } = req.body as {
      documents: Array<{
        sourceId: string;
        sourceType: string;
        title: string;
        content: string;
        fromCountry?: string;
        toCountry?: string;
        sourceUrl?: string;
        sourceName?: string;
        metadata?: Record<string, unknown>;
      }>;
    };

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ error: "documents array is required" });
    }

    const results: { id: number; sourceId: string }[] = [];
    const errors: { sourceId: string; error: string }[] = [];

    // Process documents sequentially to avoid overwhelming the embedding service
    for (const doc of documents) {
      try {
        if (!doc.sourceId || !doc.sourceType || !doc.title || !doc.content) {
          errors.push({
            sourceId: doc.sourceId || "unknown",
            error: "Missing required fields",
          });
          continue;
        }

        const embeddingResult = await generateEmbedding(doc.content);

        const [inserted] = await db
          .insert(knowledgeDocuments)
          .values({
            sourceId: doc.sourceId,
            sourceType: doc.sourceType,
            title: doc.title,
            content: doc.content,
            fromCountry: doc.fromCountry?.toUpperCase() || null,
            toCountry: doc.toCountry?.toUpperCase() || null,
            sourceUrl: doc.sourceUrl || null,
            sourceName: doc.sourceName || null,
            lastVerified: new Date(),
            metadata: doc.metadata || null,
            embedding: embeddingResult.embedding,
          })
          .returning({ id: knowledgeDocuments.id });

        results.push({ id: inserted.id, sourceId: doc.sourceId });
      } catch (error) {
        errors.push({
          sourceId: doc.sourceId || "unknown",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    res.status(201).json({
      inserted: results.length,
      errors: errors.length,
      results,
      errorDetails: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Knowledge] Batch ingest error:", error);
    res.status(500).json({
      error: "Batch ingest failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * GET /api/knowledge/status
 *
 * Get knowledge base status and embedding service info.
 */
knowledgeRouter.get("/status", async (req, res) => {
  try {
    // Get document count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeDocuments);

    // Get source counts
    const sourceCounts = await db
      .select({
        sourceType: knowledgeDocuments.sourceType,
        count: sql<number>`count(*)::int`,
      })
      .from(knowledgeDocuments)
      .groupBy(knowledgeDocuments.sourceType);

    // Get embedding service status
    const embeddingStatus = await getEmbeddingServiceStatus();

    res.json({
      documentCount: countResult?.count || 0,
      sourceCounts: Object.fromEntries(
        sourceCounts.map((s: typeof sourceCounts[number]) => [s.sourceType, s.count])
      ),
      embeddingService: embeddingStatus,
      dimension: EMBEDDING_DIM,
    });
  } catch (error) {
    console.error("[Knowledge] Status error:", error);
    res.status(500).json({
      error: "Failed to get status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/knowledge/documents/:sourceId
 *
 * Delete all documents for a given source.
 * PROTECTED: Requires X-Admin-Token header in production.
 */
knowledgeRouter.delete("/documents/:sourceId", productionAdminOnly, async (req, res) => {
  try {
    const { sourceId } = req.params;

    const deleted = await db
      .delete(knowledgeDocuments)
      .where(eq(knowledgeDocuments.sourceId, sourceId))
      .returning({ id: knowledgeDocuments.id });

    res.json({
      deleted: deleted.length,
      sourceId,
    });
  } catch (error) {
    console.error("[Knowledge] Delete error:", error);
    res.status(500).json({
      error: "Delete failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/knowledge/documents
 *
 * List documents with optional filtering.
 */
knowledgeRouter.get("/documents", async (req, res) => {
  try {
    const {
      sourceType,
      fromCountry,
      toCountry,
      limit = "50",
      offset = "0",
    } = req.query;

    const conditions: any[] = [];

    if (sourceType && typeof sourceType === "string") {
      conditions.push(eq(knowledgeDocuments.sourceType, sourceType));
    }

    if (fromCountry && typeof fromCountry === "string") {
      conditions.push(eq(knowledgeDocuments.fromCountry, fromCountry.toUpperCase()));
    }

    if (toCountry && typeof toCountry === "string") {
      conditions.push(eq(knowledgeDocuments.toCountry, toCountry.toUpperCase()));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const documents = await db
      .select({
        id: knowledgeDocuments.id,
        sourceId: knowledgeDocuments.sourceId,
        sourceType: knowledgeDocuments.sourceType,
        title: knowledgeDocuments.title,
        fromCountry: knowledgeDocuments.fromCountry,
        toCountry: knowledgeDocuments.toCountry,
        sourceName: knowledgeDocuments.sourceName,
        createdAt: knowledgeDocuments.createdAt,
      })
      .from(knowledgeDocuments)
      .where(whereClause)
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10))
      .orderBy(desc(knowledgeDocuments.createdAt));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(knowledgeDocuments)
      .where(whereClause);

    res.json({
      documents,
      total: countResult?.count || 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    console.error("[Knowledge] List error:", error);
    res.status(500).json({
      error: "List failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// VISA-SPECIFIC ENDPOINT
// ============================================================================

/**
 * Parse visa status from content text.
 * Handles negations like "No visa on arrival" correctly.
 * Priority: visa_free > embassy_visa > evisa > visa_on_arrival
 */
function parseVisaStatus(content: string): VisaFacts["visaStatus"] {
  const lower = content.toLowerCase();

  // Check for visa-free first - clear indicator
  if (
    (lower.includes("visa-free") || lower.includes("visa free")) &&
    !lower.includes("not visa-free") &&
    !lower.includes("not visa free")
  ) {
    return "visa_free";
  }

  // Check for "no visa required" (different from visa_free but means the same)
  if (lower.includes("no visa required") || lower.includes("visa not required")) {
    return "visa_free";
  }

  // Check for negations first - if VOA/e-visa explicitly not available, it's embassy visa
  const explicitNoVoa =
    lower.includes("no visa on arrival") ||
    lower.includes("no voa available");

  const explicitNoEvisa =
    lower.includes("no e-visa") ||
    lower.includes("no evisa available") ||
    lower.includes("or e-visa available"); // "No visa on arrival or e-visa available"

  // If both VOA and e-visa are explicitly unavailable, it's embassy visa
  if (explicitNoVoa && explicitNoEvisa) {
    return "embassy_visa";
  }

  // Check for VOA availability - look for positive indicators
  // Pattern: "can obtain a visa on arrival", "VOA", "visa on arrival" with details
  const hasVoaInfo =
    lower.includes("visa on arrival") ||
    lower.includes("voa") ||
    lower.includes("on arrival");

  const voaPositive =
    lower.includes("can obtain a visa on arrival") ||
    lower.includes("can get a visa on arrival") ||
    lower.includes("visa on arrival available") ||
    lower.includes("voa available") ||
    (hasVoaInfo && !explicitNoVoa && (
      lower.includes("voa allows") ||
      lower.includes("voa costs") ||
      lower.includes("voa fee") ||
      lower.match(/voa[:\s]+(?:up to|allows|valid|fee|\$|usd)/i) ||
      lower.match(/visa on arrival[:\s]+(?:up to|allows|valid|fee|\$|usd|available)/i)
    ));

  if (voaPositive && !explicitNoVoa) {
    return "visa_on_arrival";
  }

  // Check for e-visa availability
  const evisaPositive =
    lower.includes("e-visa available") ||
    lower.includes("evisa available") ||
    lower.includes("apply for an e-visa") ||
    lower.includes("apply for e-visa") ||
    lower.includes("electronic visa available") ||
    lower.includes("e-visa:") ||
    lower.match(/e-?visa[:\s]+(?:single|valid|fee|\$|usd|processing)/i);

  if (evisaPositive && !explicitNoEvisa) {
    return "evisa";
  }

  // Fall back: if visa is required but no easy option found
  if (
    lower.includes("require a visa") ||
    lower.includes("requires a visa") ||
    lower.includes("visa required") ||
    lower.includes("must obtain a visa") ||
    lower.includes("need a visa") ||
    lower.includes("tourist visa") ||
    lower.includes("apply at") ||
    lower.includes("embassy")
  ) {
    return "embassy_visa";
  }

  return "unknown";
}

/**
 * Extract numeric values from content (processing days, max stay, etc.)
 */
function extractNumbers(content: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
  }
  return undefined;
}

/**
 * Extract fees from content.
 */
function extractFees(content: string): string | undefined {
  const patterns = [
    /costs?\s*(?:approximately\s*)?(\$\d+[\d,]*(?:\s*USD)?)/i,
    /fee[s]?\s*(?:is|are|of)?\s*(?:approximately\s*)?(\$\d+[\d,]*(?:\s*USD)?)/i,
    /(\$\d+[\d,]*(?:\s*USD)?)\s*(?:fee|cost)/i,
    /free\s*(?:of\s*charge)?/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      if (match[0].toLowerCase().includes("free")) return "Free";
      if (match[1]) return match[1];
    }
  }
  return undefined;
}

/**
 * Extract required documents from content.
 */
function extractRequiredDocs(content: string): string[] {
  const docs: string[] = [];
  const lower = content.toLowerCase();

  if (lower.includes("passport") && lower.includes("valid")) {
    docs.push("Valid passport (6+ months validity)");
  }
  if (lower.includes("proof of onward") || lower.includes("return ticket")) {
    docs.push("Proof of onward/return travel");
  }
  if (lower.includes("proof of accommodation") || lower.includes("hotel booking")) {
    docs.push("Proof of accommodation");
  }
  if (lower.includes("passport photo") || lower.includes("photo")) {
    docs.push("Passport-size photos");
  }
  if (lower.includes("bank statement") || lower.includes("proof of funds")) {
    docs.push("Proof of sufficient funds");
  }
  if (lower.includes("travel insurance")) {
    docs.push("Travel insurance");
  }

  return docs;
}

/**
 * Determine trust level from source name.
 */
function determineTrustLevel(sourceName: string | null): "high" | "medium" | "low" {
  if (!sourceName) return "low";
  const lower = sourceName.toLowerCase();

  // High trust: Official government sources
  if (
    lower.includes("embassy") ||
    lower.includes("consulate") ||
    lower.includes("immigration") ||
    lower.includes("state department") ||
    lower.includes("foreign affairs") ||
    lower.includes("timatic") ||
    lower.includes("gov")
  ) {
    return "high";
  }

  // Medium trust: Known travel databases
  if (
    lower.includes("travel database") ||
    lower.includes("visa guide") ||
    lower.includes("lonely planet") ||
    lower.includes("tripadvisor")
  ) {
    return "medium";
  }

  return "low";
}

/**
 * POST /api/knowledge/visa-lookup
 *
 * Returns VisaFacts - the single source of truth for visa information.
 * Combines vector search with country-based filtering.
 * Rate limited: 30/min per IP
 */
knowledgeRouter.post("/visa-lookup", visaLookupRateLimiter, async (req, res) => {
  try {
    const { passport, destination } = req.body as {
      passport: string;
      destination: string;
    };

    if (!passport || !destination) {
      return res.status(400).json({
        error: "Missing required fields: passport, destination",
      });
    }

    // Generate embedding for a generic visa query
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
        metadata: knowledgeDocuments.metadata,
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
            ),
            // General passport info
            and(
              eq(knowledgeDocuments.fromCountry, passport.toUpperCase()),
              sql`${knowledgeDocuments.toCountry} IS NULL`
            )
          )
        )
      )
      .orderBy(desc(similarity))
      .limit(5);

    // Filter by minimum similarity
    const relevantResults = results.filter((r: typeof results[number]) => r.similarity >= 0.5);

    // Build VisaCitations
    const citations: VisaCitation[] = relevantResults.map((r: typeof results[number]) => ({
      title: r.title,
      url: r.sourceUrl,
      sourceName: r.sourceName || "Travel Database",
      trustLevel: determineTrustLevel(r.sourceName),
      updatedAt: r.lastVerified?.toISOString().slice(0, 10),
    }));

    // Combine all content for parsing
    const combinedContent = relevantResults
      .map((r: typeof results[number]) => r.content)
      .join("\n\n");

    // No citations found
    if (citations.length === 0) {
      console.warn(`[Knowledge] Low confidence visa lookup: ${passport} -> ${destination}, no citations found`);

      const emptyFacts: VisaFacts = {
        summary: `No verified visa information found for ${passport} passport holders traveling to ${destination}. Please check official embassy sources.`,
        visaStatus: "unknown",
        citations: [],
        confidence: "low",
        passport,
        destination,
        hasCitations: false,
        warning: "No information found in knowledge base. Please verify with official sources.",
      };

      return res.json(emptyFacts);
    }

    // Extract structured data from content
    const visaStatus = parseVisaStatus(combinedContent);
    const feesText = extractFees(combinedContent);
    const requiredDocs = extractRequiredDocs(combinedContent);

    // Extract processing days
    const processingPatterns = [
      /processing[^.]*?(\d+)\s*(?:to\s*\d+\s*)?days/i,
      /(\d+)\s*(?:to\s*\d+\s*)?(?:business\s*)?days?\s*(?:to\s*)?process/i,
    ];
    const processingDaysMax = extractNumbers(combinedContent, [
      /processing[^.]*?\d+\s*to\s*(\d+)\s*days/i,
      /(\d+)\s*days?\s*maximum/i,
    ]) || extractNumbers(combinedContent, processingPatterns);

    const processingDaysMin = extractNumbers(combinedContent, [
      /processing[^.]*?(\d+)\s*to\s*\d+\s*days/i,
      /(\d+)\s*days?\s*minimum/i,
    ]);

    // Extract max stay
    const maxStayDays = extractNumbers(combinedContent, [
      /stay[s]?\s*(?:up\s*to\s*)?(\d+)\s*days/i,
      /(\d+)\s*days?\s*(?:maximum\s*)?stay/i,
      /valid\s*(?:for\s*)?(\d+)\s*days/i,
    ]);

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
      if (processingDaysMax) summary += `. Processing: ${processingDaysMin || 1}-${processingDaysMax} days`;
      summary += ".";
    } else if (visaStatus === "embassy_visa") {
      summary = `${passport} passport holders require a visa to visit ${destination}`;
      if (processingDaysMax) summary += `. Processing time: ${processingDaysMin || 5}-${processingDaysMax} days`;
      summary += ".";
    } else {
      summary = `Visa requirements for ${passport} passport holders visiting ${destination}. Please check official sources.`;
    }

    // Compute confidence
    const confidence = computeVisaConfidence(citations);

    // Log low confidence lookups
    if (confidence === "low") {
      console.warn(`[Knowledge] Low confidence visa lookup: ${passport} -> ${destination}, citations: ${citations.length}`);
    }

    const visaFacts: VisaFacts = {
      summary,
      visaStatus,
      maxStayDays,
      processingDaysMin,
      processingDaysMax,
      feesText,
      requiredDocs: requiredDocs.length > 0 ? requiredDocs : undefined,
      citations,
      confidence,
      passport,
      destination,
      hasCitations: true,
      warning: confidence === "low" ? "Limited data available. Please verify with official sources." : undefined,
    };

    res.json(visaFacts);
  } catch (error) {
    console.error("[Knowledge] Visa lookup error:", error);
    res.status(500).json({
      error: "Visa lookup failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ============================================================================
// VISA API ENDPOINTS (Hybrid: Passport Index + RapidAPI Enrichment)
// ============================================================================

import {
  fetchVisaRequirements,
  seedPopularCorridors,
  getCountryCode,
  getVisaTypeLabel,
} from "../services/visaApiService";

import {
  lookupVisa,
  getStats as getPassportIndexStats,
} from "../services/passportIndexService";

/**
 * GET /api/knowledge/visa/check
 *
 * HYBRID visa lookup:
 * 1. Primary: Passport Index Dataset (FREE, 39k+ routes)
 * 2. Fallback: RapidAPI for enriched details (120/month limit)
 *
 * Query params:
 * - passport: Passport country (name or ISO code)
 * - destination: Destination country (name or ISO code)
 * - enrich: "true" to force RapidAPI lookup for extra details (embassy links, etc.)
 */
knowledgeRouter.get("/visa/check", visaLookupRateLimiter, async (req, res) => {
  try {
    const { passport, destination, enrich } = req.query;

    if (!passport || !destination) {
      return res.status(400).json({
        error: "Missing required parameters",
        message: "Both 'passport' and 'destination' query parameters are required",
      });
    }

    // Layer 1: Passport Index (FREE, instant)
    const indexResult = lookupVisa(passport as string, destination as string);

    if (indexResult && enrich !== 'true') {
      // Return free data immediately
      console.log(`[VisaCheck] Passport Index hit: ${indexResult.passportCode} → ${indexResult.destinationCode}`);
      return res.json({
        success: true,
        data: {
          passportCountry: indexResult.passport,
          passportCode: indexResult.passportCode,
          destinationCountry: indexResult.destination,
          destinationCode: indexResult.destinationCode,
          visaType: indexResult.status,
          visaName: indexResult.statusLabel,
          duration: indexResult.days ? `${indexResult.days} days` : undefined,
          source: 'passport_index',
          visaTypeLabel: indexResult.statusLabel,
        },
      });
    }

    // Layer 2: RapidAPI (when enrichment requested or index miss)
    if (enrich === 'true' || !indexResult) {
      console.log(`[VisaCheck] Using RapidAPI for: ${passport} → ${destination} (enrich=${enrich}, indexHit=${!!indexResult})`);

      const apiResult = await fetchVisaRequirements(
        passport as string,
        destination as string
      );

      if (apiResult) {
        return res.json({
          success: true,
          data: {
            ...apiResult,
            visaTypeLabel: getVisaTypeLabel(apiResult.visaType),
          },
        });
      }
    }

    // Fallback: Return index result even without enrichment if API fails
    if (indexResult) {
      return res.json({
        success: true,
        data: {
          passportCountry: indexResult.passport,
          passportCode: indexResult.passportCode,
          destinationCountry: indexResult.destination,
          destinationCode: indexResult.destinationCode,
          visaType: indexResult.status,
          visaName: indexResult.statusLabel,
          duration: indexResult.days ? `${indexResult.days} days` : undefined,
          source: 'passport_index',
          visaTypeLabel: indexResult.statusLabel,
        },
      });
    }

    return res.status(404).json({
      error: "Visa information not found",
      message: `Could not find visa requirements for ${passport} → ${destination}`,
      hint: "Check if the country names are spelled correctly",
    });
  } catch (error) {
    console.error("[Knowledge] Visa check error:", error);
    res.status(500).json({
      error: "Visa check failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/knowledge/visa/index-stats
 *
 * Get statistics about the Passport Index dataset.
 */
knowledgeRouter.get("/visa/index-stats", (_req, res) => {
  const stats = getPassportIndexStats();
  res.json({
    success: true,
    source: "passport_index_dataset",
    description: "Free visa requirements data from https://github.com/ilyankou/passport-index-dataset",
    stats,
  });
});

/**
 * POST /api/knowledge/visa/seed
 *
 * Seed the knowledge base with visa requirements for popular travel corridors.
 * Admin-only in production. Takes ~40 seconds (rate limited to 1 req/sec).
 */
knowledgeRouter.post("/visa/seed", productionAdminOnly, async (_req, res) => {
  try {
    console.log("[Knowledge] Starting visa corridor seeding...");

    const result = await seedPopularCorridors();

    res.json({
      success: true,
      message: `Seeded ${result.success} visa corridors`,
      details: result,
    });
  } catch (error) {
    console.error("[Knowledge] Visa seed error:", error);
    res.status(500).json({
      error: "Visa seeding failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/knowledge/visa/stats
 *
 * Get statistics about cached visa data in the knowledge base.
 */
knowledgeRouter.get("/visa/stats", async (_req, res) => {
  try {
    const [stats] = await db
      .select({
        totalDocuments: sql<number>`COUNT(*)`,
        visaApiDocuments: sql<number>`COUNT(*) FILTER (WHERE source_type = 'visa_api')`,
        uniquePassports: sql<number>`COUNT(DISTINCT from_country) FILTER (WHERE source_type = 'visa_api')`,
        uniqueDestinations: sql<number>`COUNT(DISTINCT to_country) FILTER (WHERE source_type = 'visa_api')`,
        oldestCache: sql<string>`MIN(created_at) FILTER (WHERE source_type = 'visa_api')`,
        newestCache: sql<string>`MAX(created_at) FILTER (WHERE source_type = 'visa_api')`,
      })
      .from(knowledgeDocuments);

    // Get breakdown by visa type
    const corridors = await db
      .select({
        fromCountry: knowledgeDocuments.fromCountry,
        toCountry: knowledgeDocuments.toCountry,
        title: knowledgeDocuments.title,
        lastVerified: knowledgeDocuments.lastVerified,
      })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.sourceType, "visa_api"))
      .orderBy(desc(knowledgeDocuments.lastVerified))
      .limit(50);

    res.json({
      success: true,
      stats: {
        totalKnowledgeDocuments: Number(stats.totalDocuments),
        visaApiCachedCorridors: Number(stats.visaApiDocuments),
        uniquePassportCountries: Number(stats.uniquePassports),
        uniqueDestinationCountries: Number(stats.uniqueDestinations),
        cacheRange: {
          oldest: stats.oldestCache,
          newest: stats.newestCache,
        },
      },
      corridors: corridors.map(c => ({
        route: `${c.fromCountry} → ${c.toCountry}`,
        title: c.title,
        lastVerified: c.lastVerified,
      })),
    });
  } catch (error) {
    console.error("[Knowledge] Visa stats error:", error);
    res.status(500).json({
      error: "Failed to get visa stats",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
