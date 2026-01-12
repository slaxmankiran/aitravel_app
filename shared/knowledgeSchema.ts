/**
 * Knowledge Schema for RAG (Retrieval Augmented Generation)
 *
 * Stores visa/travel documents with vector embeddings for semantic search.
 * Uses pgvector extension for efficient similarity queries.
 *
 * Environment Variables:
 * - EMBEDDING_DIM: Dimension of embeddings (default: 768 for nomic-embed-text)
 */

import { pgTable, text, serial, integer, timestamp, jsonb, index, customType, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Embedding dimension - configurable via env var.
 * Default 768 for local Ollama nomic-embed-text model.
 * OpenAI text-embedding-3-small uses 1536.
 */
export const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM || "768", 10);

// ============================================================================
// CUSTOM TYPES FOR PGVECTOR
// ============================================================================

/**
 * Custom Drizzle type for pgvector's vector column.
 * Stores embeddings as float arrays.
 */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIM})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Parse "[0.1,0.2,0.3,...]" format
    const cleaned = value.replace(/[\[\]]/g, "");
    return cleaned.split(",").map(Number);
  },
});

// ============================================================================
// KNOWLEDGE BASE SCHEMA
// ============================================================================

/**
 * Knowledge documents table - stores visa/travel info chunks with embeddings.
 *
 * Each row represents a chunk of a source document with its vector embedding.
 * Chunks are typically 500-1000 tokens for optimal retrieval.
 */
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: serial("id").primaryKey(),

  // Document identification
  sourceId: text("source_id").notNull(), // e.g., "visa_india_usa", "safety_thailand"
  sourceType: text("source_type").notNull(), // "visa", "safety", "customs", "health", "general"

  // Content
  title: text("title").notNull(), // Human-readable title
  content: text("content").notNull(), // The actual text chunk

  // Metadata for filtering
  fromCountry: text("from_country"), // Passport country code (e.g., "IN", "US")
  toCountry: text("to_country"), // Destination country code

  // Vector embedding
  embedding: vector("embedding").notNull(),

  // Source attribution
  sourceUrl: text("source_url"), // Original source URL for citations
  sourceName: text("source_name"), // e.g., "US State Department", "Timatic"
  lastVerified: timestamp("last_verified"), // When this info was last verified

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>(), // Additional structured data

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Standard B-tree indexes for filtering
  // NOTE: HNSW index for embedding column must be created manually via SQL:
  // CREATE INDEX knowledge_embedding_hnsw_idx ON knowledge_documents
  // USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
  sourceTypeIdx: index("knowledge_source_type_idx").on(table.sourceType),
  fromCountryIdx: index("knowledge_from_country_idx").on(table.fromCountry),
  toCountryIdx: index("knowledge_to_country_idx").on(table.toCountry),
  sourceIdIdx: index("knowledge_source_id_idx").on(table.sourceId),
}));

/**
 * Knowledge sources table - tracks document sources for refresh scheduling.
 */
export const knowledgeSources = pgTable("knowledge_sources", {
  id: serial("id").primaryKey(),

  sourceId: text("source_id").notNull().unique(),
  sourceType: text("source_type").notNull(),

  // Source info
  name: text("name").notNull(), // Display name
  url: text("url"), // Source URL

  // Refresh tracking
  lastFetched: timestamp("last_fetched"),
  refreshIntervalDays: integer("refresh_interval_days").default(30),

  // Stats
  documentCount: integer("document_count").default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments);
export const insertKnowledgeSourceSchema = createInsertSchema(knowledgeSources);

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type NewKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;
export type KnowledgeSource = typeof knowledgeSources.$inferSelect;
export type NewKnowledgeSource = typeof knowledgeSources.$inferInsert;

// ============================================================================
// RETRIEVAL TYPES
// ============================================================================

/**
 * Search result from vector similarity query.
 */
export interface KnowledgeSearchResult {
  id: number;
  sourceId: string;
  sourceType: string;
  title: string;
  content: string;
  fromCountry: string | null;
  toCountry: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  lastVerified: Date | null;
  similarity: number; // Cosine similarity score (0-1)
}

/**
 * Citation for AI responses.
 */
export interface KnowledgeCitation {
  sourceId: string;
  sourceName: string;
  sourceUrl: string | null;
  title: string;
  snippet: string; // Relevant excerpt
  lastVerified: Date | null;
}

/**
 * RAG query parameters.
 */
export interface KnowledgeQueryParams {
  query: string; // Natural language question
  fromCountry?: string; // Filter by passport country
  toCountry?: string; // Filter by destination
  sourceTypes?: string[]; // Filter by type (visa, safety, etc.)
  limit?: number; // Max results (default 5)
  minSimilarity?: number; // Min cosine similarity (default 0.7)
}

/**
 * RAG query response.
 */
export interface KnowledgeQueryResponse {
  results: KnowledgeSearchResult[];
  citations: KnowledgeCitation[];
  queryEmbedding?: number[]; // For debugging
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate embedding dimensions at runtime.
 * Throws if embedding size doesn't match EMBEDDING_DIM.
 */
export function validateEmbeddingDimension(embedding: number[], context: string): void {
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `[${context}] Embedding dimension mismatch: expected ${EMBEDDING_DIM}, got ${embedding.length}. ` +
      `Check EMBEDDING_DIM env var matches your embedding model.`
    );
  }
}

/**
 * Source types enum for type safety.
 */
export const KNOWLEDGE_SOURCE_TYPES = [
  "visa",
  "safety",
  "customs",
  "health",
  "general",
  "entry_requirements",
  "travel_advisory",
] as const;

export type KnowledgeSourceType = typeof KNOWLEDGE_SOURCE_TYPES[number];
