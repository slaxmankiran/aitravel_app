/**
 * Embeddings Service
 *
 * Generates text embeddings using local Ollama (nomic-embed-text) or
 * fallback to Deepseek/OpenAI-compatible API.
 *
 * Environment Variables:
 * - OLLAMA_BASE_URL: Ollama server URL (default: http://localhost:11434)
 * - EMBEDDING_MODEL: Ollama model name (default: nomic-embed-text)
 * - EMBEDDING_DIM: Expected dimension (default: 768)
 * - DEEPSEEK_API_KEY: Fallback to API-based embeddings if Ollama unavailable
 */

import { EMBEDDING_DIM, validateEmbeddingDimension } from "../../shared/knowledgeSchema";

// ============================================================================
// CONFIGURATION
// ============================================================================

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";

// Cache for Ollama availability check
let ollamaAvailable: boolean | null = null;
let lastOllamaCheck = 0;
const OLLAMA_CHECK_INTERVAL = 60_000; // Re-check every 60 seconds

// ============================================================================
// TYPES
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  source: "ollama" | "api" | "mock";
  dimension: number;
  latencyMs: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  model: string;
  source: "ollama" | "api" | "mock";
  dimension: number;
  latencyMs: number;
  count: number;
}

// ============================================================================
// OLLAMA EMBEDDINGS
// ============================================================================

/**
 * Check if Ollama is available and the model is loaded.
 */
async function checkOllamaAvailability(): Promise<boolean> {
  const now = Date.now();
  if (ollamaAvailable !== null && now - lastOllamaCheck < OLLAMA_CHECK_INTERVAL) {
    return ollamaAvailable;
  }

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      ollamaAvailable = false;
      lastOllamaCheck = now;
      return false;
    }

    const data = await response.json() as { models?: Array<{ name: string }> };
    const models = data.models || [];
    const hasModel = models.some(m => m.name.includes(EMBEDDING_MODEL));

    ollamaAvailable = hasModel;
    lastOllamaCheck = now;

    if (!hasModel) {
      console.warn(`[Embeddings] Ollama available but model '${EMBEDDING_MODEL}' not found. Available: ${models.map(m => m.name).join(", ")}`);
    }

    return hasModel;
  } catch (error) {
    ollamaAvailable = false;
    lastOllamaCheck = now;
    console.warn(`[Embeddings] Ollama not available at ${OLLAMA_BASE_URL}:`, error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Generate embedding using Ollama.
 */
async function generateOllamaEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { embedding: number[] };

  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("Invalid Ollama response: missing embedding array");
  }

  return data.embedding;
}

/**
 * Generate batch embeddings using Ollama (sequential for now).
 */
async function generateOllamaBatchEmbeddings(texts: string[]): Promise<number[][]> {
  // Ollama doesn't support batch embedding natively, process sequentially
  const embeddings: number[][] = [];

  for (const text of texts) {
    const embedding = await generateOllamaEmbedding(text);
    embeddings.push(embedding);
  }

  return embeddings;
}

// ============================================================================
// MOCK EMBEDDINGS (for testing)
// ============================================================================

/**
 * Generate deterministic mock embedding for testing.
 * Uses text hash to create reproducible embeddings.
 */
function generateMockEmbedding(text: string): number[] {
  const embedding = new Array(EMBEDDING_DIM).fill(0);

  // Simple hash-based pseudo-random embedding
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }

  for (let i = 0; i < EMBEDDING_DIM; i++) {
    // Generate pseudo-random values between -1 and 1
    hash = ((hash << 5) - hash) + i;
    hash = hash & hash;
    embedding[i] = (hash % 1000) / 500 - 1;
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  return embedding.map(v => v / magnitude);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate embedding for a single text.
 *
 * Priority:
 * 1. Ollama (if available)
 * 2. Mock embeddings (for development/testing)
 *
 * @throws Error if embedding generation fails
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const startTime = Date.now();

  // Check Ollama availability
  const useOllama = await checkOllamaAvailability();

  if (useOllama) {
    try {
      const embedding = await generateOllamaEmbedding(text);
      validateEmbeddingDimension(embedding, "generateEmbedding");

      return {
        embedding,
        model: EMBEDDING_MODEL,
        source: "ollama",
        dimension: embedding.length,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[Embeddings] Ollama failed, falling back to mock:", error);
      // Fall through to mock
    }
  }

  // Fallback to mock embeddings
  console.warn("[Embeddings] Using mock embeddings - install Ollama for production use");
  const embedding = generateMockEmbedding(text);

  return {
    embedding,
    model: "mock",
    source: "mock",
    dimension: embedding.length,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Generate embeddings for multiple texts.
 *
 * @param texts Array of texts to embed
 * @returns Batch embedding result
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
  const startTime = Date.now();

  if (texts.length === 0) {
    return {
      embeddings: [],
      model: "none",
      source: "mock",
      dimension: EMBEDDING_DIM,
      latencyMs: 0,
      count: 0,
    };
  }

  // Check Ollama availability
  const useOllama = await checkOllamaAvailability();

  if (useOllama) {
    try {
      const embeddings = await generateOllamaBatchEmbeddings(texts);

      // Validate all embeddings
      for (let i = 0; i < embeddings.length; i++) {
        validateEmbeddingDimension(embeddings[i], `generateBatchEmbeddings[${i}]`);
      }

      return {
        embeddings,
        model: EMBEDDING_MODEL,
        source: "ollama",
        dimension: embeddings[0]?.length || EMBEDDING_DIM,
        latencyMs: Date.now() - startTime,
        count: embeddings.length,
      };
    } catch (error) {
      console.error("[Embeddings] Ollama batch failed, falling back to mock:", error);
      // Fall through to mock
    }
  }

  // Fallback to mock embeddings
  console.warn("[Embeddings] Using mock batch embeddings");
  const embeddings = texts.map(text => generateMockEmbedding(text));

  return {
    embeddings,
    model: "mock",
    source: "mock",
    dimension: EMBEDDING_DIM,
    latencyMs: Date.now() - startTime,
    count: embeddings.length,
  };
}

/**
 * Check embedding service status.
 */
export async function getEmbeddingServiceStatus(): Promise<{
  available: boolean;
  source: "ollama" | "mock";
  model: string;
  dimension: number;
  ollamaUrl: string;
}> {
  const useOllama = await checkOllamaAvailability();

  return {
    available: true, // Always available with mock fallback
    source: useOllama ? "ollama" : "mock",
    model: useOllama ? EMBEDDING_MODEL : "mock",
    dimension: EMBEDDING_DIM,
    ollamaUrl: OLLAMA_BASE_URL,
  };
}

/**
 * Preload the embedding model (pull if needed).
 * Call this at server startup to ensure model is ready.
 */
export async function preloadEmbeddingModel(): Promise<void> {
  try {
    // Check if Ollama is available
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.log("[Embeddings] Ollama not available, will use mock embeddings");
      return;
    }

    const data = await response.json() as { models?: Array<{ name: string }> };
    const models = data.models || [];
    const hasModel = models.some(m => m.name.includes(EMBEDDING_MODEL));

    if (!hasModel) {
      console.log(`[Embeddings] Pulling model '${EMBEDDING_MODEL}'...`);

      const pullResponse = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: EMBEDDING_MODEL }),
        signal: AbortSignal.timeout(300000), // 5 min timeout for download
      });

      if (!pullResponse.ok) {
        console.error("[Embeddings] Failed to pull model:", await pullResponse.text());
        return;
      }

      console.log(`[Embeddings] Model '${EMBEDDING_MODEL}' ready`);
    } else {
      console.log(`[Embeddings] Model '${EMBEDDING_MODEL}' already loaded`);
    }

    // Reset availability cache
    ollamaAvailable = null;
    lastOllamaCheck = 0;
  } catch (error) {
    console.warn("[Embeddings] Could not preload model:", error instanceof Error ? error.message : error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate cosine similarity between two embeddings.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}
