/**
 * Social Import Routes
 * Endpoints for importing travel inspiration from social media
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getAIClient, isAIConfigured } from '../services/aiClientFactory';
import {
  importFromUrl,
  importBatch,
  detectPlatform,
  validateUrl,
  type SocialImportResult,
} from '../services/socialImportService';

const router = Router();

// AI client initialized lazily from factory
function getAI() {
  return getAIClient('fast');
}

// Validation schemas
const importUrlSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

const importBatchSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10, 'Maximum 10 URLs per batch'),
});

/**
 * GET /api/import/status
 * Check if import service is available
 */
router.get('/status', (req: Request, res: Response) => {
  const configured = isAIConfigured();

  res.json({
    available: configured,
    supportedPlatforms: ['instagram', 'tiktok', 'pinterest', 'blog'],
    maxBatchSize: 10,
    features: [
      'Extract destinations from posts',
      'Identify activities and experiences',
      'Detect travel style (budget/moderate/luxury)',
      'Generate activity suggestions',
    ],
  });
});

/**
 * POST /api/import/validate
 * Validate a URL before importing
 */
router.post('/validate', (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        valid: false,
        error: 'URL is required',
      });
    }

    const validation = validateUrl(url);
    const platform = detectPlatform(url);

    res.json({
      valid: validation.valid,
      error: validation.error,
      platform,
      normalizedUrl: validation.normalized,
      supported: platform !== 'unknown',
    });
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: 'Validation failed',
    });
  }
});

/**
 * POST /api/import/url
 * Import travel inspiration from a single URL
 */
router.post('/url', async (req: Request, res: Response) => {
  try {
    const validation = importUrlSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { url } = validation.data;

    if (!isAIConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Import service not configured',
        message: 'AI service is not available',
      });
    }

    console.log(`[Import] Processing URL: ${url}`);
    const { openai, model } = getAI();
    const result = await importFromUrl(url, openai, model);

    if (!result.success) {
      return res.status(422).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[Import] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Import failed',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/import/batch
 * Import from multiple URLs
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const validation = importBatchSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors,
      });
    }

    const { urls } = validation.data;

    if (!isAIConfigured()) {
      return res.status(503).json({
        success: false,
        error: 'Import service not configured',
        message: 'AI service is not available',
      });
    }

    console.log(`[Import] Processing ${urls.length} URLs`);
    const { openai, model } = getAI();
    const results = await importBatch(urls, openai, model);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    res.json({
      total: urls.length,
      successful: successful.length,
      failed: failed.length,
      results,
    });
  } catch (error) {
    console.error('[Import] Batch error:', error);
    res.status(500).json({
      success: false,
      error: 'Batch import failed',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/import/preview
 * Preview what would be extracted without full AI processing
 * Useful for showing platform detection and basic content
 */
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
      });
    }

    const validation = validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({
        error: validation.error,
      });
    }

    const platform = detectPlatform(validation.normalized || url);

    res.json({
      url: validation.normalized,
      platform,
      supported: platform !== 'unknown',
      description: getPreviewDescription(platform),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Preview failed',
    });
  }
});

/**
 * Get preview description for a platform
 */
function getPreviewDescription(platform: string): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram posts - We can extract destinations, activities, and travel style from captions and hashtags';
    case 'tiktok':
      return 'TikTok videos - We can analyze travel content from video descriptions and tags';
    case 'pinterest':
      return 'Pinterest pins - We can extract travel inspiration from pin descriptions and board context';
    case 'blog':
      return 'Travel blog - We can analyze article content for detailed trip information';
    default:
      return 'Unknown platform - We may still be able to extract some information';
  }
}

export default router;
