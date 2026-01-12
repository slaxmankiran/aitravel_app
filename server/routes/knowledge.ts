/**
 * Knowledge Routes - RAG (Retrieval Augmented Generation)
 *
 * Endpoints for searching the knowledge base using vector similarity
 * to provide cited visa/travel information.
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
  type KnowledgeSearchResult,
  type KnowledgeCitation,
  type KnowledgeQueryParams,
  type KnowledgeQueryResponse,
  type NewKnowledgeDocument,
  type NewKnowledgeSource,
} from "../../shared/knowledgeSchema";
import { generateEmbedding, getEmbeddingServiceStatus } from "../services/embeddings";

export const knowledgeRouter = Router();

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

/**
 * POST /api/knowledge/search
 *
 * Semantic search over the knowledge base.
 * Returns relevant documents with similarity scores and citations.
 */
knowledgeRouter.post("/search", async (req, res) => {
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
 */
knowledgeRouter.post("/ingest", async (req, res) => {
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
 */
knowledgeRouter.post("/ingest/batch", async (req, res) => {
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
 */
knowledgeRouter.delete("/documents/:sourceId", async (req, res) => {
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
 * POST /api/knowledge/visa-lookup
 *
 * Specialized endpoint for visa information lookup.
 * Combines vector search with country-based filtering.
 */
knowledgeRouter.post("/visa-lookup", async (req, res) => {
  try {
    const { question, passport, destination } = req.body as {
      question: string;
      passport: string;
      destination: string;
    };

    if (!question || !passport || !destination) {
      return res.status(400).json({
        error: "Missing required fields: question, passport, destination",
      });
    }

    // Generate embedding for the question
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

    // Format response
    const citations: KnowledgeCitation[] = results
      .filter((r: typeof results[number]) => r.similarity >= 0.6)
      .map((r: typeof results[number]) => ({
        sourceId: r.sourceId,
        sourceName: r.sourceName || "Travel Database",
        sourceUrl: r.sourceUrl,
        title: r.title,
        snippet: r.content.slice(0, 300) + (r.content.length > 300 ? "..." : ""),
        lastVerified: r.lastVerified,
      }));

    // Combine content for context
    const context = results
      .filter((r: typeof results[number]) => r.similarity >= 0.6)
      .map((r: typeof results[number]) => `[${r.title}]\n${r.content}`)
      .join("\n\n---\n\n");

    res.json({
      question,
      passport,
      destination,
      context,
      citations,
      resultCount: citations.length,
      embeddingSource: embeddingResult.source,
    });
  } catch (error) {
    console.error("[Knowledge] Visa lookup error:", error);
    res.status(500).json({
      error: "Visa lookup failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
