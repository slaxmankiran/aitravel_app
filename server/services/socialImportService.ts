/**
 * Social Media Import Service
 * Parses travel inspiration from social media URLs (Instagram, TikTok, Pinterest, blogs)
 * Uses AI to extract destinations, activities, and trip details
 */

import OpenAI from 'openai';

// ============================================================================
// TYPES
// ============================================================================

export type SocialPlatform = 'instagram' | 'tiktok' | 'pinterest' | 'blog' | 'unknown';

export interface SocialImportResult {
  success: boolean;
  platform: SocialPlatform;
  sourceUrl: string;
  error?: string;

  // Extracted trip data
  destination?: string;
  activities?: string[];
  estimatedDays?: number;
  travelStyle?: 'budget' | 'moderate' | 'luxury';
  highlights?: string[];
  tags?: string[];

  // Raw extraction data
  rawContent?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface SocialContentData {
  platform: SocialPlatform;
  url: string;
  content?: string;
  hashtags?: string[];
  mentions?: string[];
  caption?: string;
  title?: string;
}

// ============================================================================
// PLATFORM DETECTION
// ============================================================================

/**
 * Detect social platform from URL
 */
export function detectPlatform(url: string): SocialPlatform {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes('instagram.com') || hostname.includes('instagr.am')) {
      return 'instagram';
    }
    if (hostname.includes('tiktok.com') || hostname.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (hostname.includes('pinterest.com') || hostname.includes('pin.it')) {
      return 'pinterest';
    }

    // Check for common blog patterns
    if (
      hostname.includes('blog') ||
      hostname.includes('medium.com') ||
      hostname.includes('wordpress') ||
      hostname.includes('blogger') ||
      hostname.includes('travelblog') ||
      hostname.includes('nomad')
    ) {
      return 'blog';
    }

    // Fallback to blog for unknown URLs (we'll try to scrape them)
    return 'blog';
  } catch {
    return 'unknown';
  }
}

// ============================================================================
// URL VALIDATION
// ============================================================================

/**
 * Validate and normalize social media URL
 */
export function validateUrl(url: string): { valid: boolean; normalized?: string; error?: string } {
  try {
    // Basic URL validation
    const urlObj = new URL(url);

    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS' };
    }

    // Normalize common shortened URLs
    let normalizedUrl = url;

    // Handle Instagram shortlinks
    if (urlObj.hostname === 'instagr.am') {
      normalizedUrl = url.replace('instagr.am', 'instagram.com');
    }

    return { valid: true, normalized: normalizedUrl };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

// ============================================================================
// CONTENT FETCHING
// ============================================================================

/**
 * Fetch content from a social media URL
 * Note: This is a basic implementation. Production would need platform-specific APIs
 * or a web scraping service like ScrapingBee/Browserless
 */
export async function fetchSocialContent(url: string): Promise<SocialContentData | null> {
  const platform = detectPlatform(url);

  if (platform === 'unknown') {
    return null;
  }

  try {
    // For MVP, we use basic fetch with a browser-like user agent
    // Production would use platform APIs or proper scraping
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VoyageAI/1.0; +https://voyageai.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`[SocialImport] Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract basic content from HTML
    const content = extractContentFromHtml(html, platform);

    return {
      platform,
      url,
      ...content,
    };
  } catch (error) {
    console.error(`[SocialImport] Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Extract content from HTML based on platform
 */
function extractContentFromHtml(html: string, platform: SocialPlatform): Partial<SocialContentData> {
  const result: Partial<SocialContentData> = {};

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.title = decodeHtmlEntities(titleMatch[1].trim());
  }

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (descMatch) {
    result.caption = decodeHtmlEntities(descMatch[1].trim());
  }

  // Extract OG description (often more detailed)
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDescMatch && (!result.caption || ogDescMatch[1].length > result.caption.length)) {
    result.caption = decodeHtmlEntities(ogDescMatch[1].trim());
  }

  // Extract hashtags from content
  const hashtagRegex = /#[\w\u00C0-\u017F]+/g;
  const allContent = `${result.title || ''} ${result.caption || ''}`;
  const hashtags = allContent.match(hashtagRegex);
  if (hashtags) {
    result.hashtags = Array.from(new Set(hashtags.map(h => h.toLowerCase())));
  }

  // Extract @mentions
  const mentionRegex = /@[\w.]+/g;
  const mentions = allContent.match(mentionRegex);
  if (mentions) {
    result.mentions = Array.from(new Set(mentions));
  }

  // Combine into content string
  result.content = [result.title, result.caption].filter(Boolean).join('\n\n');

  return result;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[#\w]+;/g, match => entities[match] || match);
}

// ============================================================================
// AI EXTRACTION
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a travel content analyzer. Extract travel information from social media posts and articles.

Your task:
1. Identify the destination(s) mentioned
2. List specific activities, places, or experiences mentioned
3. Estimate the trip duration if possible
4. Determine the travel style (budget, moderate, or luxury)
5. Extract key highlights or must-do experiences
6. Identify relevant travel tags/themes

Be specific and extract actual place names and activities. If the content is not travel-related, indicate that clearly.

Respond in JSON format only.`;

const EXTRACTION_USER_PROMPT = `Analyze this travel content and extract structured information:

PLATFORM: {platform}
URL: {url}

CONTENT:
{content}

HASHTAGS: {hashtags}

Extract the following as JSON:
{
  "isTravelContent": boolean,
  "destination": "City, Country" or null,
  "activities": ["activity 1", "activity 2", ...],
  "estimatedDays": number or null,
  "travelStyle": "budget" | "moderate" | "luxury" | null,
  "highlights": ["highlight 1", "highlight 2", ...],
  "tags": ["beach", "adventure", "food", ...],
  "confidence": "high" | "medium" | "low"
}`;

/**
 * Use AI to extract travel information from content
 */
export async function extractTravelInfo(
  content: SocialContentData,
  openai: OpenAI,
  model: string = 'deepseek-chat'
): Promise<SocialImportResult> {
  if (!content.content && !content.caption && !content.title) {
    return {
      success: false,
      platform: content.platform,
      sourceUrl: content.url,
      error: 'No content to analyze',
      confidence: 'low',
    };
  }

  try {
    const prompt = EXTRACTION_USER_PROMPT
      .replace('{platform}', content.platform)
      .replace('{url}', content.url)
      .replace('{content}', content.content || content.caption || content.title || '')
      .replace('{hashtags}', (content.hashtags || []).join(', ') || 'None');

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1000,
    });

    const resultText = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(resultText);

    if (!parsed.isTravelContent) {
      return {
        success: false,
        platform: content.platform,
        sourceUrl: content.url,
        error: 'Content does not appear to be travel-related',
        rawContent: content.content?.substring(0, 200),
        confidence: 'low',
      };
    }

    return {
      success: true,
      platform: content.platform,
      sourceUrl: content.url,
      destination: parsed.destination || undefined,
      activities: parsed.activities || [],
      estimatedDays: parsed.estimatedDays || undefined,
      travelStyle: parsed.travelStyle || undefined,
      highlights: parsed.highlights || [],
      tags: parsed.tags || [],
      rawContent: content.content?.substring(0, 500),
      confidence: parsed.confidence || 'medium',
    };
  } catch (error) {
    console.error('[SocialImport] AI extraction error:', error);
    return {
      success: false,
      platform: content.platform,
      sourceUrl: content.url,
      error: 'Failed to analyze content',
      confidence: 'low',
    };
  }
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

/**
 * Import travel inspiration from a social media URL
 */
export async function importFromUrl(
  url: string,
  openai: OpenAI,
  model: string = 'deepseek-chat'
): Promise<SocialImportResult> {
  // Validate URL
  const validation = validateUrl(url);
  if (!validation.valid) {
    return {
      success: false,
      platform: 'unknown',
      sourceUrl: url,
      error: validation.error,
      confidence: 'low',
    };
  }

  const normalizedUrl = validation.normalized || url;
  const platform = detectPlatform(normalizedUrl);

  if (platform === 'unknown') {
    return {
      success: false,
      platform,
      sourceUrl: normalizedUrl,
      error: 'Unsupported platform. Try Instagram, TikTok, Pinterest, or a travel blog.',
      confidence: 'low',
    };
  }

  // Fetch content
  console.log(`[SocialImport] Fetching content from ${platform}: ${normalizedUrl}`);
  const content = await fetchSocialContent(normalizedUrl);

  if (!content) {
    return {
      success: false,
      platform,
      sourceUrl: normalizedUrl,
      error: 'Could not fetch content from this URL. The post may be private or the platform may be blocking requests.',
      confidence: 'low',
    };
  }

  // Extract travel info using AI
  console.log(`[SocialImport] Extracting travel info with AI`);
  return extractTravelInfo(content, openai, model);
}

// ============================================================================
// BATCH IMPORT
// ============================================================================

/**
 * Import from multiple URLs
 */
export async function importBatch(
  urls: string[],
  openai: OpenAI,
  model: string = 'deepseek-chat',
  options?: {
    maxConcurrent?: number;
    delayMs?: number;
  }
): Promise<SocialImportResult[]> {
  const maxConcurrent = options?.maxConcurrent || 2;
  const delayMs = options?.delayMs || 500;

  const results: SocialImportResult[] = [];

  // Process URLs in batches
  for (let i = 0; i < urls.length; i += maxConcurrent) {
    const batch = urls.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(url => importFromUrl(url, openai, model))
    );

    results.push(...batchResults);

    // Delay between batches
    if (i + maxConcurrent < urls.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
