/**
 * AI Agent Service - Dynamic, UX-First Travel Intelligence
 *
 * Design Principles:
 * 1. SPEED FIRST - Never block the user, show something immediately
 * 2. PROGRESSIVE ENHANCEMENT - Enrich with real data in background
 * 3. SMART CACHING - Cache aggressively for repeat queries
 * 4. GRACEFUL FALLBACKS - AI knowledge when APIs fail
 */

import OpenAI from "openai";

// ============================================================================
// INTELLIGENT CACHE SYSTEM
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  source: 'ai' | 'api' | 'cache';
}

// Cache durations (in milliseconds)
const CACHE_DURATION = {
  coordinates: 7 * 24 * 60 * 60 * 1000,  // 1 week - coordinates don't change
  attractions: 24 * 60 * 60 * 1000,       // 1 day - attractions relatively stable
  transport: 24 * 60 * 60 * 1000,         // 1 day - transport options stable
  costs: 60 * 60 * 1000,                  // 1 hour - costs can fluctuate
  weather: 30 * 60 * 1000,                // 30 min - weather changes
};

// In-memory cache (could be Redis in production)
const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string, maxAge: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < maxAge) {
    console.log(`[AIAgent] Cache HIT: ${key}`);
    return entry.data;
  }
  return null;
}

function setCache<T>(key: string, data: T, source: 'ai' | 'api'): void {
  cache.set(key, { data, timestamp: Date.now(), source });
  console.log(`[AIAgent] Cache SET: ${key} (source: ${source})`);
}

// ============================================================================
// FREE EXTERNAL APIs
// ============================================================================

/**
 * Nominatim (OpenStreetMap) - Free Geocoding API
 * Rate limit: 1 request/second, but we cache aggressively
 */
async function fetchCoordinatesFromNominatim(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
      {
        signal: controller.signal,
        headers: { 'User-Agent': 'VoyageAI Travel Planner (contact@voyageai.com)' }
      }
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.log(`[AIAgent] Nominatim failed for ${location}, using AI fallback`);
    return null;
  }
}

// ============================================================================
// AI-POWERED DYNAMIC DATA GENERATION
// ============================================================================

let openai: OpenAI | null = null;
let aiModel = "deepseek-chat";

export function initializeAIAgent(apiKey: string, baseURL?: string, model?: string) {
  openai = new OpenAI({
    apiKey,
    baseURL: baseURL || "https://api.deepseek.com",
  });
  if (model) aiModel = model;
  console.log(`[AIAgent] Initialized with model: ${aiModel}`);
}

/**
 * Get coordinates for any location - FAST with caching
 * Priority: Cache → Nominatim API → AI Knowledge
 */
export async function getCoordinates(location: string): Promise<{
  lat: number;
  lng: number;
  source: 'cache' | 'api' | 'ai';
  confidence: 'high' | 'medium' | 'low';
}> {
  const cacheKey = `coords:${location.toLowerCase()}`;

  // 1. Check cache first (instant)
  const cached = getCached<{ lat: number; lng: number }>(cacheKey, CACHE_DURATION.coordinates);
  if (cached) {
    return { ...cached, source: 'cache', confidence: 'high' };
  }

  // 2. Try Nominatim API (free, accurate)
  const apiResult = await fetchCoordinatesFromNominatim(location);
  if (apiResult) {
    setCache(cacheKey, apiResult, 'api');
    return { ...apiResult, source: 'api', confidence: 'high' };
  }

  // 3. Fallback to AI knowledge (always available)
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: [{
          role: "user",
          content: `What are the GPS coordinates (latitude, longitude) for ${location}? Reply with ONLY JSON: {"lat": number, "lng": number}`
        }],
        temperature: 0.1,
        max_tokens: 50,
      });

      const content = response.choices[0].message.content || "";
      const match = content.match(/\{[^}]+\}/);
      if (match) {
        const coords = JSON.parse(match[0]);
        if (coords.lat && coords.lng) {
          setCache(cacheKey, coords, 'ai');
          return { lat: coords.lat, lng: coords.lng, source: 'ai', confidence: 'medium' };
        }
      }
    } catch (error) {
      console.log(`[AIAgent] AI coordinates failed for ${location}`);
    }
  }

  // 4. Ultimate fallback - return null coordinates (UI will handle gracefully)
  return { lat: 0, lng: 0, source: 'ai', confidence: 'low' };
}

/**
 * Get attractions for a destination - AI-powered, cached
 */
export async function getAttractions(destination: string, count: number = 5): Promise<{
  attractions: Array<{ name: string; lat: number; lng: number; type: string; estimatedCost: number }>;
  source: 'cache' | 'ai';
}> {
  const cacheKey = `attractions:${destination.toLowerCase()}:${count}`;

  // Check cache
  const cached = getCached<any[]>(cacheKey, CACHE_DURATION.attractions);
  if (cached) {
    return { attractions: cached, source: 'cache' };
  }

  if (!openai) {
    return { attractions: [], source: 'ai' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: aiModel,
      messages: [{
        role: "user",
        content: `List ${count} top tourist attractions in ${destination}.
Return ONLY valid JSON array: [{"name":"Attraction Name","lat":0.0,"lng":0.0,"type":"museum|temple|park|landmark|market|beach","estimatedCost":0}]
Use real GPS coordinates. estimatedCost in USD (0 if free).`
      }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const attractions = JSON.parse(match[0]);
      setCache(cacheKey, attractions, 'ai');
      return { attractions, source: 'ai' };
    }
  } catch (error) {
    console.log(`[AIAgent] Failed to get attractions for ${destination}`);
  }

  return { attractions: [], source: 'ai' };
}

/**
 * Get transport options between two locations - AI-powered
 */
export async function getTransportOptions(
  origin: string,
  destination: string,
  travelStyle: 'budget' | 'standard' | 'luxury'
): Promise<{
  options: Array<{
    mode: string;
    duration: string;
    estimatedCost: number;
    recommended: boolean;
    note: string;
  }>;
  source: 'cache' | 'ai';
}> {
  const cacheKey = `transport:${origin.toLowerCase()}-${destination.toLowerCase()}:${travelStyle}`;

  // Check cache
  const cached = getCached<any[]>(cacheKey, CACHE_DURATION.transport);
  if (cached) {
    return { options: cached, source: 'cache' };
  }

  if (!openai) {
    return { options: [], source: 'ai' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: aiModel,
      messages: [{
        role: "user",
        content: `What are the transport options from ${origin} to ${destination} for ${travelStyle} travelers?
Consider: flights, trains, buses, ferries, driving.
Return ONLY valid JSON array: [{"mode":"flight|train|bus|ferry|drive","duration":"Xh Ym","estimatedCost":0,"recommended":true/false,"note":"brief tip"}]
estimatedCost in USD per person. Mark the best option as recommended:true.`
      }],
      temperature: 0.3,
      max_tokens: 400,
    });

    const content = response.choices[0].message.content || "";
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const options = JSON.parse(match[0]);
      setCache(cacheKey, options, 'ai');
      return { options, source: 'ai' };
    }
  } catch (error) {
    console.log(`[AIAgent] Failed to get transport for ${origin} → ${destination}`);
  }

  return { options: [], source: 'ai' };
}

/**
 * Get realistic cost estimates for a destination - AI-powered
 */
export async function getCostEstimates(
  destination: string,
  travelStyle: 'budget' | 'standard' | 'luxury',
  currency: string = 'USD'
): Promise<{
  daily: {
    accommodation: number;
    food: number;
    activities: number;
    transport: number;
  };
  source: 'cache' | 'ai';
}> {
  const cacheKey = `costs:${destination.toLowerCase()}:${travelStyle}:${currency}`;

  // Check cache
  const cached = getCached<any>(cacheKey, CACHE_DURATION.costs);
  if (cached) {
    return { daily: cached, source: 'cache' };
  }

  if (!openai) {
    // Fallback estimates based on travel style
    const fallback = {
      budget: { accommodation: 30, food: 20, activities: 15, transport: 10 },
      standard: { accommodation: 100, food: 50, activities: 40, transport: 25 },
      luxury: { accommodation: 300, food: 150, activities: 100, transport: 50 },
    };
    return { daily: fallback[travelStyle], source: 'ai' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: aiModel,
      messages: [{
        role: "user",
        content: `What are realistic DAILY costs for ${travelStyle} travel in ${destination}?
Return ONLY valid JSON: {"accommodation":0,"food":0,"activities":0,"transport":0}
All amounts in ${currency}. Be realistic based on local prices.`
      }],
      temperature: 0.3,
      max_tokens: 100,
    });

    const content = response.choices[0].message.content || "";
    const match = content.match(/\{[^}]+\}/);
    if (match) {
      const costs = JSON.parse(match[0]);
      setCache(cacheKey, costs, 'ai');
      return { daily: costs, source: 'ai' };
    }
  } catch (error) {
    console.log(`[AIAgent] Failed to get costs for ${destination}`);
  }

  // Fallback
  const fallback = {
    budget: { accommodation: 30, food: 20, activities: 15, transport: 10 },
    standard: { accommodation: 100, food: 50, activities: 40, transport: 25 },
    luxury: { accommodation: 300, food: 150, activities: 100, transport: 50 },
  };
  return { daily: fallback[travelStyle], source: 'ai' };
}

/**
 * Get destination overview - Comprehensive AI analysis
 * This is the main "agent" function that gathers all info
 */
export async function getDestinationIntelligence(
  origin: string,
  destination: string,
  travelStyle: 'budget' | 'standard' | 'luxury',
  currency: string = 'USD'
): Promise<{
  coordinates: { lat: number; lng: number };
  attractions: Array<{ name: string; lat: number; lng: number; type: string; estimatedCost: number }>;
  transport: Array<{ mode: string; duration: string; estimatedCost: number; recommended: boolean; note: string }>;
  dailyCosts: { accommodation: number; food: number; activities: number; transport: number };
  timing: { coordsMs: number; attractionsMs: number; transportMs: number; costsMs: number; totalMs: number };
}> {
  const startTime = Date.now();

  // Run all queries in PARALLEL for speed
  const [coordsResult, attractionsResult, transportResult, costsResult] = await Promise.all([
    (async () => {
      const start = Date.now();
      const result = await getCoordinates(destination);
      return { result, ms: Date.now() - start };
    })(),
    (async () => {
      const start = Date.now();
      const result = await getAttractions(destination, 5);
      return { result, ms: Date.now() - start };
    })(),
    (async () => {
      const start = Date.now();
      const result = await getTransportOptions(origin, destination, travelStyle);
      return { result, ms: Date.now() - start };
    })(),
    (async () => {
      const start = Date.now();
      const result = await getCostEstimates(destination, travelStyle, currency);
      return { result, ms: Date.now() - start };
    })(),
  ]);

  const totalMs = Date.now() - startTime;
  console.log(`[AIAgent] Intelligence gathered in ${totalMs}ms (coords: ${coordsResult.ms}ms, attractions: ${attractionsResult.ms}ms, transport: ${transportResult.ms}ms, costs: ${costsResult.ms}ms)`);

  return {
    coordinates: { lat: coordsResult.result.lat, lng: coordsResult.result.lng },
    attractions: attractionsResult.result.attractions,
    transport: transportResult.result.options,
    dailyCosts: costsResult.result.daily,
    timing: {
      coordsMs: coordsResult.ms,
      attractionsMs: attractionsResult.ms,
      transportMs: transportResult.ms,
      costsMs: costsResult.ms,
      totalMs,
    },
  };
}

/**
 * Get destination image category - AI-powered categorization for unknown destinations
 * Used to select appropriate fallback images
 */
export async function getDestinationCategory(destination: string): Promise<{
  category: 'beach' | 'tropical' | 'mountain' | 'city' | 'european' | 'asian' | 'desert' | 'island' | 'africa' | 'americas' | 'default';
  source: 'cache' | 'ai';
}> {
  const cacheKey = `destCategory:${destination.toLowerCase()}`;

  // Check cache
  const cached = getCached<string>(cacheKey, CACHE_DURATION.coordinates);
  if (cached) {
    return { category: cached as any, source: 'cache' };
  }

  if (!openai) {
    return { category: 'default', source: 'ai' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: aiModel,
      messages: [{
        role: "user",
        content: `Categorize ${destination} for travel imagery. Pick ONE category that best represents this destination's visual appeal:
- beach (coastal areas, beaches)
- tropical (Caribbean, Pacific islands, tropical forests)
- mountain (alpine, highland, ski resorts)
- city (urban metropolis, modern city)
- european (European architecture, historic cities)
- asian (Asian cities, temples, culture)
- desert (Middle East, deserts, Arabian)
- island (island destinations, archipelagos)
- africa (African landscapes, safari, wildlife)
- americas (Americas, Latin American culture)
- default (if none fit)

Reply with ONLY the category name, nothing else.`
      }],
      temperature: 0.1,
      max_tokens: 20,
    });

    const content = response.choices[0].message.content?.trim().toLowerCase() || 'default';
    const validCategories = ['beach', 'tropical', 'mountain', 'city', 'european', 'asian', 'desert', 'island', 'africa', 'americas', 'default'];
    const category = validCategories.includes(content) ? content : 'default';

    setCache(cacheKey, category, 'ai');
    return { category: category as any, source: 'ai' };
  } catch (error) {
    console.log(`[AIAgent] Failed to categorize ${destination}`);
    return { category: 'default', source: 'ai' };
  }
}

/**
 * AI-powered destination image search - suggests specific landmarks for each destination
 * Returns search terms that can be used with image APIs
 */
export async function getDestinationImageTerms(destination: string): Promise<{
  searchTerms: string[];
  landmark: string;
  source: 'cache' | 'ai';
}> {
  const cacheKey = `destImageTerms:${destination.toLowerCase()}`;

  // Check cache first
  const cached = getCached<{ searchTerms: string[]; landmark: string }>(cacheKey, CACHE_DURATION.attractions);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  if (!openai) {
    // Fallback to destination name
    return { searchTerms: [destination], landmark: destination, source: 'ai' };
  }

  try {
    const response = await openai.chat.completions.create({
      model: aiModel,
      messages: [{
        role: "user",
        content: `For the travel destination "${destination}", suggest the most iconic and photogenic landmark or scene that represents this place.

Reply with ONLY valid JSON:
{
  "landmark": "specific landmark name (e.g., 'Sydney Opera House', 'Eiffel Tower', 'Boudhanath Stupa')",
  "searchTerms": ["term1", "term2", "term3"]
}

The searchTerms should be 3 specific terms useful for finding beautiful travel photos of this destination.
Examples:
- Sydney → {"landmark": "Sydney Opera House", "searchTerms": ["Sydney Opera House sunset", "Sydney Harbour Bridge", "Sydney skyline"]}
- Kathmandu → {"landmark": "Boudhanath Stupa", "searchTerms": ["Boudhanath Stupa Nepal", "Kathmandu temples", "Nepal Himalayas"]}
- Paris → {"landmark": "Eiffel Tower", "searchTerms": ["Eiffel Tower Paris", "Paris skyline", "Champs Elysees"]}
- Tokyo → {"landmark": "Tokyo Tower", "searchTerms": ["Tokyo Tower night", "Shibuya crossing", "Mount Fuji Tokyo"]}`
      }],
      temperature: 0.3,
      max_tokens: 150,
    });

    const content = response.choices[0].message.content || "";
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.landmark && parsed.searchTerms) {
        const result = { searchTerms: parsed.searchTerms, landmark: parsed.landmark };
        setCache(cacheKey, result, 'ai');
        console.log(`[AIAgent] Image terms for ${destination}: ${parsed.landmark}`);
        return { ...result, source: 'ai' };
      }
    }
  } catch (error) {
    console.log(`[AIAgent] Failed to get image terms for ${destination}`);
  }

  // Fallback
  return { searchTerms: [destination, `${destination} landmark`, `${destination} travel`], landmark: destination, source: 'ai' };
}

/**
 * Fetch actual image URL from multiple free sources
 * Priority: Unsplash API → Unsplash Source → Pixabay (PRIMARY) → Pexels (BACKUP) → LoremFlickr → Picsum
 * Focuses on BRIGHT, DAYTIME, high-quality vertical images
 */
async function fetchImageFromFreeSources(searchTerm: string, destination: string): Promise<string | null> {
  // Clean up search term for better results
  const parts = destination.split(',');
  const city = parts[0].trim();
  const country = parts[1]?.trim() || '';
  // Use the AI-suggested search term (landmark) if provided, otherwise fall back to city
  // Include country for better geographic relevance
  const searchQuery = searchTerm ? `${searchTerm} ${country}`.trim() : `${city} ${country}`.trim();

  // 1. Try Unsplash API (if API key available) - most reliable for quality
  const unsplashApiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (unsplashApiKey) {
    try {
      const unsplashQuery = encodeURIComponent(`${city} landmark daytime`);
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${unsplashQuery}&orientation=portrait&per_page=10&order_by=relevant`,
        { headers: { 'Authorization': `Client-ID ${unsplashApiKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          // Find a bright image (avoid dark/sunset images based on color analysis in description)
          const brightImage = data.results.find((img: any) => {
            const desc = (img.description || img.alt_description || '').toLowerCase();
            const isDark = desc.includes('night') || desc.includes('sunset') || desc.includes('dark') || desc.includes('dusk');
            return !isDark;
          }) || data.results[0];

          const imageUrl = brightImage.urls.regular || brightImage.urls.full;
          console.log(`[AIAgent] Unsplash API found image for ${city}`);
          return imageUrl;
        }
      }
    } catch (error) {
      // Silently fall through to next source
    }
  }

  // 2. Try Unsplash Source (free, no API key) - search ONLY by city name to avoid generic country images
  try {
    // IMPORTANT: Use ONLY the city name (not country) to get destination-specific images
    const unsplashQuery = encodeURIComponent(`${city} travel landscape`);
    const unsplashUrl = `https://source.unsplash.com/1080x1920/?${unsplashQuery}`;
    console.log(`[AIAgent] Trying Unsplash Source: ${unsplashUrl}`);

    const response = await fetch(unsplashUrl, { method: 'HEAD', redirect: 'follow' });
    console.log(`[AIAgent] Unsplash Source response: ${response.status}, URL: ${response.url}`);

    if (response.ok && response.url && !response.url.includes('placeholder') && !response.url.includes('source.unsplash.com')) {
      console.log(`[AIAgent] Unsplash Source found image for ${city}: ${response.url}`);
      return response.url;
    } else {
      console.log(`[AIAgent] Unsplash Source no valid redirect for ${city}`);
    }
  } catch (error: any) {
    console.log(`[AIAgent] Unsplash Source failed for ${city}:`, error?.message || error);
  }

  // Helper function to try Pixabay with a query
  const tryPixabay = async (query: string, minHits: number = 20, requireTagMatch: boolean = true): Promise<string | null> => {
    const pixabayApiKey = process.env.PIXABAY_API_KEY;
    if (!pixabayApiKey) return null;

    try {
      // Add cityscape/skyline terms + sunny for bright images
      const searchWithTerms = `${query} skyline sunny daytime`;
      const encodedQuery = encodeURIComponent(searchWithTerms);
      console.log(`[AIAgent] Pixabay searching for: ${searchWithTerms}`);
      // Use HORIZONTAL orientation for better background quality, high resolution
      const response = await fetch(
        `https://pixabay.com/api/?key=${pixabayApiKey}&q=${encodedQuery}&image_type=photo&orientation=horizontal&min_width=1920&min_height=1080&per_page=20&safesearch=true&category=travel`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.hits && data.hits.length > 0) {
          // If requireTagMatch is true, find an image whose tags contain part of the city or query
          if (requireTagMatch) {
            const cityLower = city.toLowerCase();

            const relevantImage = data.hits.find((hit: any) => {
              const tags = (hit.tags || '').toLowerCase();

              // Skip people/animals/vehicles/dark/cloudy/sunset images - we want BRIGHT, SUNNY DAYTIME cityscapes & landscapes
              const excludeKeywords = ['boy', 'girl', 'man', 'woman', 'person', 'people', 'portrait', 'face', 'child', 'kid', 'model', 'fashion', 'selfie', 'bird', 'animal', 'dog', 'cat', 'wildlife', 'insect', 'flower', 'food', 'drink', 'car', 'vehicle', 'motorcycle', 'bike', 'bus', 'truck', 'auto', 'wheel', 'tire', 'night', 'dark', 'dusk', 'evening', 'neon', 'lights at night', 'cloudy', 'cloud', 'storm', 'stormy', 'overcast', 'rain', 'rainy', 'fog', 'foggy', 'mist', 'misty', 'grey', 'gray', 'moody', 'dramatic sky', 'thunder', 'sunset', 'sunrise', 'dawn', 'twilight', 'golden hour', 'silhouette'];
              const hasExcludeKeyword = excludeKeywords.some(keyword => tags.includes(keyword));
              if (hasExcludeKeyword) {
                return false;
              }

              // Prefer daytime/bright images - check for positive indicators
              const preferredKeywords = ['skyline', 'cityscape', 'city', 'downtown', 'landmark', 'monument', 'architecture', 'building', 'panorama', 'view', 'landscape', 'scenic', 'daytime', 'day', 'sunny', 'blue sky'];
              const hasPreferredKeyword = preferredKeywords.some(keyword => tags.includes(keyword));
              if (!hasPreferredKeyword) {
                return false; // Skip if no travel-related keywords
              }

              // MUST include the city name (not just country) for relevance
              const cityNameLower = city.toLowerCase().split(' ')[0]; // First word of city
              return tags.includes(cityLower) || tags.includes(cityNameLower);
            });

            if (relevantImage) {
              const imageUrl = relevantImage.largeImageURL || relevantImage.webformatURL;
              console.log(`[AIAgent] Pixabay found RELEVANT image for ${query} (tags: ${relevantImage.tags})`);
              return imageUrl;
            } else {
              console.log(`[AIAgent] Pixabay ${data.hits.length} results for ${query} but no suitable landscape with "${city}" - skipping`);
              return null;
            }
          }

          // No tag matching required
          if (data.totalHits >= minHits) {
            const imageUrl = data.hits[0].largeImageURL || data.hits[0].webformatURL;
            console.log(`[AIAgent] Pixabay found image for ${query} (${data.totalHits} total hits)`);
            return imageUrl;
          } else {
            console.log(`[AIAgent] Pixabay only ${data.totalHits} hits for ${query} - skipping (need ${minHits}+)`);
          }
        }
      }
    } catch (error) {
      console.log(`[AIAgent] Pixabay failed for ${query}`);
    }
    return null;
  };

  // Helper function to try Pexels with a query
  const tryPexels = async (query: string, minResults: number = 5, requireAltMatch: boolean = true): Promise<string | null> => {
    const pexelsApiKey = process.env.PEXELS_API_KEY;
    if (!pexelsApiKey) return null;

    try {
      // Add cityscape/skyline terms for better travel images
      const searchWithTerms = `${query} skyline daytime`;
      const encodedQuery = encodeURIComponent(searchWithTerms);
      console.log(`[AIAgent] Pexels searching for: ${searchWithTerms}`);
      // Use LANDSCAPE orientation for better background quality
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodedQuery}&orientation=landscape&per_page=20&size=large`,
        { headers: { 'Authorization': pexelsApiKey } }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
          // If requireAltMatch, find an image whose alt text contains the city or country
          if (requireAltMatch) {
            const cityLower = city.toLowerCase();
            // Exclude people/vehicles/dark/cloudy/sunset images - we want BRIGHT, SUNNY DAYTIME cityscapes & landscapes
            const excludeKeywords = ['boy', 'girl', 'man', 'woman', 'person', 'people', 'portrait', 'face', 'child', 'model', 'fashion', 'car', 'vehicle', 'bike', 'motorcycle', 'bus', 'truck', 'auto', 'night', 'dark', 'dusk', 'evening', 'neon', 'silhouette', 'cloudy', 'cloud', 'storm', 'stormy', 'overcast', 'rain', 'fog', 'mist', 'grey', 'gray', 'moody', 'dramatic', 'sunset', 'sunrise', 'dawn', 'twilight', 'golden hour'];

            const relevantPhoto = data.photos.find((photo: any) => {
              const alt = (photo.alt || '').toLowerCase();

              // Skip dark/night or people/vehicle photos
              const hasExcludeKeyword = excludeKeywords.some(keyword => alt.includes(keyword));
              if (hasExcludeKeyword) {
                return false;
              }

              // MUST include city name - country alone is too generic
              const cityNameLower = city.toLowerCase().split(' ')[0]; // First word of city
              return alt.includes(cityLower) || alt.includes(cityNameLower);
            });

            if (relevantPhoto) {
              const imageUrl = relevantPhoto.src.large2x || relevantPhoto.src.large || relevantPhoto.src.original;
              console.log(`[AIAgent] Pexels found RELEVANT image for ${query} (alt: ${relevantPhoto.alt})`);
              return imageUrl;
            } else {
              console.log(`[AIAgent] Pexels ${data.photos.length} results for ${query} but no suitable landscape with "${city}" - skipping`);
              return null;
            }
          }

          // No alt matching required
          if (data.total_results >= minResults) {
            const photo = data.photos[0];
            const imageUrl = photo.src.large2x || photo.src.large || photo.src.original;
            console.log(`[AIAgent] Pexels found image for ${query} (${data.total_results} total results)`);
            return imageUrl;
          } else {
            console.log(`[AIAgent] Pexels only ${data.total_results} results for ${query} - skipping (need ${minResults}+)`);
          }
        }
      }
    } catch (error) {
      console.log(`[AIAgent] Pexels failed for ${query}`);
    }
    return null;
  };

  // 3. Try specific landmark search first (Pixabay PRIMARY)
  let imageUrl = await tryPixabay(searchQuery, 20);
  if (imageUrl) return imageUrl;

  // 4. Try specific landmark search (Pexels BACKUP)
  imageUrl = await tryPexels(searchQuery, 5);
  if (imageUrl) return imageUrl;

  // 5. Try more generic city + country landscape search (less strict matching)
  const genericQuery = `${city} ${country} landscape`.trim();
  console.log(`[AIAgent] Trying generic search: ${genericQuery}`);

  imageUrl = await tryPixabay(genericQuery, 10, true);
  if (imageUrl) return imageUrl;

  imageUrl = await tryPexels(genericQuery, 3, true);
  if (imageUrl) return imageUrl;

  // 6. Try just city + travel as last resort (no tag matching - accept what's available)
  const cityTravelQuery = `${city} travel`;
  imageUrl = await tryPixabay(cityTravelQuery, 5, false);
  if (imageUrl) return imageUrl;

  imageUrl = await tryPexels(cityTravelQuery, 2, false);
  if (imageUrl) return imageUrl;

  // 7. Final API attempt: just country + landscape (broad but relevant)
  if (country) {
    const countryLandscape = `${country} landscape scenic`;
    console.log(`[AIAgent] Trying country-level search: ${countryLandscape}`);
    imageUrl = await tryPixabay(countryLandscape, 50, false);
    if (imageUrl) return imageUrl;

    imageUrl = await tryPexels(countryLandscape, 20, false);
    if (imageUrl) return imageUrl;
  }

  // 8. Try Unsplash random photo endpoint (more reliable than Source)
  try {
    const unsplashRandomUrl = `https://api.unsplash.com/photos/random?query=${encodeURIComponent(city)}&orientation=portrait&client_id=demo`;
    console.log(`[AIAgent] Trying Unsplash random API for ${city}`);

    const response = await fetch(unsplashRandomUrl);
    if (response.ok) {
      const data = await response.json();
      if (data.urls?.regular) {
        console.log(`[AIAgent] Unsplash random API found image for ${city}`);
        return data.urls.regular;
      }
    }
  } catch (error: any) {
    console.log(`[AIAgent] Unsplash random API failed for ${city}:`, error?.message || error);
  }

  // 6. Try LoremFlickr (free, topic-specific images from Flickr)
  try {
    // LoremFlickr provides real Flickr images for specific topics - use AI landmark
    const flickrUrl = `https://loremflickr.com/1080/1920/${encodeURIComponent(searchQuery)}/all`;
    console.log(`[AIAgent] Trying LoremFlickr for ${searchQuery}`);

    // Verify the image loads (follow redirects)
    const response = await fetch(flickrUrl, { method: 'HEAD', redirect: 'follow' });
    if (response.ok && response.url) {
      console.log(`[AIAgent] LoremFlickr found image for ${city}: ${response.url}`);
      return response.url;
    }
  } catch (error: any) {
    console.log(`[AIAgent] LoremFlickr failed for ${city}:`, error?.message || error);
  }

  // 7. Final fallback: Lorem Picsum with seed for consistency
  const seed = city.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const picsumUrl = `https://picsum.photos/seed/${seed}/1080/1920`;
  console.log(`[AIAgent] Using Lorem Picsum fallback for ${city}: ${picsumUrl}`);
  return picsumUrl;
}

/**
 * Get destination image URL - AI-powered with multiple free image sources
 * Uses AI to determine the best search terms, then fetches real images
 */
export async function getDestinationImage(destination: string): Promise<{
  imageUrl: string | null;
  searchTerm: string;
  landmark: string;
  source: 'cache' | 'ai' | 'fallback';
}> {
  const cacheKey = `destImage:${destination.toLowerCase()}`;

  // Check cache first
  const cached = getCached<{ imageUrl: string; searchTerm: string; landmark: string }>(cacheKey, CACHE_DURATION.attractions);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  // Get AI-suggested search terms for the destination
  const { searchTerms, landmark } = await getDestinationImageTerms(destination);
  const primarySearch = searchTerms[0] || landmark || destination;

  // Try to fetch actual image from free sources
  let imageUrl = await fetchImageFromFreeSources(primarySearch, destination);

  // If primary search failed, try secondary terms
  if (!imageUrl && searchTerms.length > 1) {
    for (const term of searchTerms.slice(1)) {
      imageUrl = await fetchImageFromFreeSources(term, destination);
      if (imageUrl) break;
    }
  }

  // If still no image, try just the destination name
  if (!imageUrl) {
    imageUrl = await fetchImageFromFreeSources(destination, destination);
  }

  const result = {
    imageUrl,
    searchTerm: primarySearch,
    landmark
  };

  if (imageUrl) {
    setCache(cacheKey, result, 'ai');
    return { ...result, source: 'ai' };
  }

  // Final fallback - return null and let client use category fallback
  return { ...result, source: 'fallback' };
}

/**
 * Clear cache (for testing/admin)
 */
export function clearCache(): void {
  cache.clear();
  console.log('[AIAgent] Cache cleared');
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
