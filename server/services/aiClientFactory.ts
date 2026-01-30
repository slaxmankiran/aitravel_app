/**
 * AI Client Factory — Centralized, tiered model configuration.
 *
 * Tiers:
 *   premium   – User-facing quality (itinerary, feasibility, chat)     → gpt-4o
 *   standard  – Analysis tasks (coordinates, attractions, change plan) → gpt-4o
 *   fast      – Cheap extraction (classification, scraping, import)    → gpt-4o-mini
 *   auxiliary  – Low-stakes conversational (concierge)                  → gpt-4o-mini
 *
 * Env var cascade:
 *   OPENAI_API_KEY          → primary (GPT-4o / GPT-4o-mini)
 *   DEEPSEEK_API_KEY        → legacy fallback (deepseek-chat)
 *
 * Model env overrides:
 *   AI_PREMIUM_MODEL   (default: gpt-4o)
 *   AI_STANDARD_MODEL  (default: gpt-4o)
 *   AI_FAST_MODEL      (default: gpt-4o-mini)
 *   AI_AUXILIARY_MODEL  (default: gpt-4o-mini)
 */

import OpenAI from 'openai';

// ============================================================================
// TYPES
// ============================================================================

export type AITier = 'premium' | 'standard' | 'fast' | 'auxiliary';

export interface AIClient {
  openai: OpenAI;
  model: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const TIER_DEFAULTS: Record<AITier, string> = {
  premium: 'gpt-4o',
  standard: 'gpt-4o',
  fast: 'gpt-4o-mini',
  auxiliary: 'gpt-4o-mini',
};

const DEEPSEEK_FALLBACK_MODEL = 'deepseek-chat';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

// ============================================================================
// SINGLETON CACHE (one OpenAI instance per unique baseURL)
// ============================================================================

const clientCache = new Map<string, OpenAI>();

function getOrCreateOpenAI(apiKey: string, baseURL?: string): OpenAI {
  const cacheKey = `${apiKey.slice(0, 8)}:${baseURL ?? 'default'}`;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({ apiKey, baseURL });
    clientCache.set(cacheKey, client);
  }
  return client;
}

// ============================================================================
// PROVIDER DETECTION
// ============================================================================

interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  isDeepSeek: boolean;
}

function detectProvider(): ProviderConfig | null {
  // Priority 1: OpenAI key → use OpenAI API (no baseURL override)
  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: undefined,  // default OpenAI endpoint
      isDeepSeek: false,
    };
  }

  // Priority 2: DeepSeek key → use DeepSeek API
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_BASE_URL,
      isDeepSeek: true,
    };
  }

  // Priority 3: Legacy Replit OpenAI integration
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return {
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      isDeepSeek: false,
    };
  }

  return null;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get an OpenAI client + model string for the given tier.
 *
 * Tier determines which model is used (configurable via env vars).
 * If only DEEPSEEK_API_KEY is set, all tiers fall back to deepseek-chat.
 */
export function getAIClient(tier: AITier = 'premium'): AIClient {
  const provider = detectProvider();
  if (!provider) {
    throw new Error(
      '[AIClientFactory] No AI API key configured. Set OPENAI_API_KEY or DEEPSEEK_API_KEY.'
    );
  }

  // Resolve model for this tier
  const envKey = `AI_${tier.toUpperCase()}_MODEL`;
  let model: string;

  if (provider.isDeepSeek) {
    // DeepSeek mode: all tiers use deepseek-chat (or env override)
    model = process.env[envKey] || DEEPSEEK_FALLBACK_MODEL;
  } else {
    // OpenAI mode: use tier-specific model
    model = process.env[envKey] || TIER_DEFAULTS[tier];
  }

  const openai = getOrCreateOpenAI(provider.apiKey, provider.baseURL);

  return { openai, model };
}

/**
 * Check if any AI provider is configured.
 */
export function isAIConfigured(): boolean {
  return detectProvider() !== null;
}

/**
 * Log that AI is configured (no provider/model names exposed).
 */
export function logAIConfig(): void {
  const provider = detectProvider();
  if (!provider) {
    console.log('[AIClientFactory] No AI provider configured');
    return;
  }
  console.log('[AIClientFactory] AI provider configured and ready');
}
