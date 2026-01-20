/**
 * Scrape Routes - "Start Anywhere" API
 *
 * POST /api/scrape - Extract trip data from a URL
 */

import { Router, type Request, type Response } from 'express';
import { scrapeAndExtract, isValidUrl } from '../services/scrapingService';
import rateLimit from 'express-rate-limit';

const router = Router();

// ============================================================================
// RATE LIMITING
// ============================================================================

// 10 requests per minute per IP (scraping is expensive)
const scrapeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'rate_limited', message: 'Too many requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * POST /api/scrape
 * Extract trip data from a travel URL
 *
 * Body: { url: string }
 * Returns: { success: boolean, data?: ExtractedTripData, error?: string }
 */
router.post('/', scrapeRateLimiter, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    // Validate input
    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
        errorCode: 'invalid_url',
      });
    }

    // Quick URL validation before expensive operation
    if (!isValidUrl(url.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid URL starting with http:// or https://',
        errorCode: 'invalid_url',
      });
    }

    console.log(`[ScrapeRoute] Processing URL: ${url}`);

    // Scrape and extract trip data
    const result = await scrapeAndExtract(url.trim());

    if (!result.success) {
      // Return 200 with error in body (not 4xx) for graceful client handling
      return res.json(result);
    }

    console.log(`[ScrapeRoute] Extracted: ${result.data?.destination}, confidence: ${result.data?.confidence}`);

    res.json(result);

  } catch (error: any) {
    console.error('[ScrapeRoute] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Something went wrong. Please try again.',
      errorCode: 'scrape_failed',
    });
  }
});

/**
 * GET /api/scrape/test
 * Test endpoint to verify the service is running
 */
router.get('/test', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'scraping',
    message: 'Scraping service is running. POST a URL to /api/scrape to extract trip data.',
  });
});

export default router;
