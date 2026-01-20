/**
 * Scraping Service - "Start Anywhere" Feature
 *
 * Extracts trip planning data from travel URLs using:
 * 1. Jina Reader API for clean markdown content
 * 2. AI (Deepseek) for structured data extraction
 *
 * Supports: blogs, articles, YouTube, TikTok, Reddit, etc.
 */

import OpenAI from "openai";

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedTripData {
  destination: string | null;
  destinations: string[];
  durationDays: number | null;
  budgetEstimate: number | null;
  budgetCurrency: string;
  travelStyle: 'budget' | 'comfort' | 'luxury' | null;
  highlights: string[];
  suggestedMonth: string | null;
  travelers: number | null;
  rawSummary: string;
  confidence: 'high' | 'medium' | 'low';
  source: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: ExtractedTripData;
  error?: string;
  errorCode?: 'invalid_url' | 'timeout' | 'scrape_failed' | 'no_content' | 'extraction_failed';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const JINA_READER_URL = 'https://r.jina.ai';
const JINA_TIMEOUT_MS = 15000; // 15 seconds
const AI_TIMEOUT_MS = 30000; // 30 seconds for AI extraction
const MAX_CONTENT_LENGTH = 50000; // Truncate very long articles

// Cache for scraped content (24 hour TTL)
const contentCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// AI client (initialized lazily)
let openai: OpenAI | null = null;
let aiModel = "deepseek-chat";

// ============================================================================
// INITIALIZATION
// ============================================================================

function getOpenAI(): OpenAI {
  if (!openai) {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('[ScrapingService] No AI API key configured');
    }

    openai = new OpenAI({
      apiKey,
      baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com",
    });

    aiModel = process.env.AI_MODEL || "deepseek-chat";
    console.log(`[ScrapingService] AI initialized with model: ${aiModel}`);
  }
  return openai;
}

// ============================================================================
// URL VALIDATION
// ============================================================================

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

// ============================================================================
// JINA READER - Fetch Clean Markdown
// ============================================================================

async function scrapeUrl(url: string): Promise<{ content: string; error?: string }> {
  // Check cache first
  const cacheKey = url.toLowerCase();
  const cached = contentCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[ScrapingService] Cache HIT: ${url}`);
    return { content: cached.content };
  }

  console.log(`[ScrapingService] Fetching via Jina Reader: ${url}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

    // Jina Reader API - prepend URL to get markdown
    const response = await fetch(`${JINA_READER_URL}/${url}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/markdown',
        'User-Agent': 'VoyageAI Travel Planner',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[ScrapingService] Jina Reader error: ${response.status}`);
      return { content: '', error: `Jina Reader returned ${response.status}` };
    }

    let content = await response.text();

    // Truncate very long content
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
    }

    // Cache the result
    contentCache.set(cacheKey, { content, timestamp: Date.now() });

    console.log(`[ScrapingService] Scraped ${content.length} chars from ${url}`);
    return { content };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[ScrapingService] Timeout scraping ${url}`);
      return { content: '', error: 'Request timed out' };
    }
    console.error(`[ScrapingService] Fetch error:`, error.message);
    return { content: '', error: error.message };
  }
}

// ============================================================================
// AI EXTRACTION - Parse Trip Data from Markdown
// ============================================================================

const EXTRACTION_PROMPT = `You are a travel data extraction assistant. Analyze this travel article/blog and extract trip planning information.

ARTICLE CONTENT:
---
{content}
---

Extract trip details and return ONLY valid JSON (no markdown, no explanation):
{
  "destination": "Primary City, Country",
  "destinations": ["City1, Country", "City2, Country"],
  "durationDays": 7,
  "budgetEstimate": 2500,
  "budgetCurrency": "USD",
  "travelStyle": "comfort",
  "highlights": ["attraction1", "attraction2", "activity1"],
  "suggestedMonth": "April",
  "travelers": 2,
  "rawSummary": "Brief 1-2 sentence summary of the trip",
  "confidence": "high"
}

EXTRACTION RULES:
- Set null for fields you cannot determine from the content
- destination: Primary destination mentioned (format: "City, Country")
- destinations: All cities/places mentioned for multi-city trips
- durationDays: Number of days mentioned or implied
- budgetEstimate: Total trip cost in USD (convert from other currencies if mentioned)
- travelStyle: "budget" (<$100/day pp), "comfort" ($100-300/day pp), "luxury" (>$300/day pp)
- highlights: Up to 5 key attractions, activities, or experiences mentioned
- suggestedMonth: Best time to visit if mentioned (e.g., "March", "Spring")
- travelers: Number of people if mentioned
- confidence: "high" if destination+duration clear, "medium" if partial, "low" if guessing

Return ONLY the JSON object, nothing else.`;

async function extractTripData(content: string, sourceUrl: string): Promise<ExtractedTripData> {
  const defaultResult: ExtractedTripData = {
    destination: null,
    destinations: [],
    durationDays: null,
    budgetEstimate: null,
    budgetCurrency: 'USD',
    travelStyle: null,
    highlights: [],
    suggestedMonth: null,
    travelers: null,
    rawSummary: '',
    confidence: 'low',
    source: sourceUrl,
  };

  if (!content || content.length < 100) {
    console.log('[ScrapingService] Content too short for extraction');
    return defaultResult;
  }

  try {
    const ai = getOpenAI();

    const prompt = EXTRACTION_PROMPT.replace('{content}', content);

    console.log('[ScrapingService] Sending to AI for extraction...');

    const completion = await ai.chat.completions.create({
      model: aiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2, // Low temperature for consistent extraction
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = responseText.trim();

    // Remove markdown code block if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    // Try to find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[ScrapingService] No JSON found in AI response');
      return defaultResult;
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Build result with validation
    const result: ExtractedTripData = {
      destination: typeof extracted.destination === 'string' ? extracted.destination : null,
      destinations: Array.isArray(extracted.destinations) ? extracted.destinations.filter((d: any) => typeof d === 'string') : [],
      durationDays: typeof extracted.durationDays === 'number' ? extracted.durationDays : null,
      budgetEstimate: typeof extracted.budgetEstimate === 'number' ? extracted.budgetEstimate : null,
      budgetCurrency: extracted.budgetCurrency || 'USD',
      travelStyle: ['budget', 'comfort', 'luxury'].includes(extracted.travelStyle) ? extracted.travelStyle : null,
      highlights: Array.isArray(extracted.highlights) ? extracted.highlights.slice(0, 5).filter((h: any) => typeof h === 'string') : [],
      suggestedMonth: typeof extracted.suggestedMonth === 'string' ? extracted.suggestedMonth : null,
      travelers: typeof extracted.travelers === 'number' ? extracted.travelers : null,
      rawSummary: typeof extracted.rawSummary === 'string' ? extracted.rawSummary : '',
      confidence: ['high', 'medium', 'low'].includes(extracted.confidence) ? extracted.confidence : 'low',
      source: sourceUrl,
    };

    // Auto-determine confidence if AI didn't
    if (!extracted.confidence) {
      if (result.destination && result.durationDays) {
        result.confidence = 'high';
      } else if (result.destination || result.destinations.length > 0) {
        result.confidence = 'medium';
      } else {
        result.confidence = 'low';
      }
    }

    console.log(`[ScrapingService] Extracted: ${result.destination}, ${result.durationDays} days, confidence: ${result.confidence}`);
    return result;

  } catch (error: any) {
    console.error('[ScrapingService] AI extraction error:', error.message);
    return defaultResult;
  }
}

// ============================================================================
// MAIN FUNCTION - Scrape and Extract
// ============================================================================

export async function scrapeAndExtract(url: string): Promise<ScrapeResult> {
  console.log(`[ScrapingService] Processing URL: ${url}`);

  // Validate URL
  if (!isValidUrl(url)) {
    return {
      success: false,
      error: 'Invalid URL format',
      errorCode: 'invalid_url',
    };
  }

  // Step 1: Scrape content via Jina Reader
  const scrapeResult = await scrapeUrl(url);

  if (scrapeResult.error) {
    if (scrapeResult.error.includes('timed out')) {
      return {
        success: false,
        error: 'The page took too long to load. Try a different link.',
        errorCode: 'timeout',
      };
    }
    return {
      success: false,
      error: `Couldn't read this page: ${scrapeResult.error}`,
      errorCode: 'scrape_failed',
    };
  }

  if (!scrapeResult.content || scrapeResult.content.length < 100) {
    return {
      success: false,
      error: 'The page doesn\'t have enough content to extract trip details.',
      errorCode: 'no_content',
    };
  }

  // Step 2: Extract trip data using AI
  const extractedData = await extractTripData(scrapeResult.content, url);

  if (!extractedData.destination && extractedData.destinations.length === 0) {
    return {
      success: false,
      error: 'Couldn\'t find any travel destinations in this content.',
      errorCode: 'extraction_failed',
    };
  }

  return {
    success: true,
    data: extractedData,
  };
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

export function clearScrapeCache(): void {
  contentCache.clear();
  console.log('[ScrapingService] Cache cleared');
}

export function getCacheStats(): { entries: number; oldestMs: number } {
  let oldest = Date.now();
  contentCache.forEach(entry => {
    if (entry.timestamp < oldest) oldest = entry.timestamp;
  });
  return {
    entries: contentCache.size,
    oldestMs: Date.now() - oldest,
  };
}
