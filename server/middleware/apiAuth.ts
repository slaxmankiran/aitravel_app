/**
 * API Authentication Middleware
 * Verifies API keys for B2B API requests
 */

import { type Request, type Response, type NextFunction } from 'express';
import { db } from '../db';
import { apiKeys, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';

// Extend Express Request to include API context
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: number;
        userId: number;
        tier: string;
        permissions: string[];
        rateLimit: number;
        usageCount: number;
      };
    }
  }
}

/**
 * Generate a new API key
 */
export function generateApiKey(isTest: boolean = false): string {
  const prefix = isTest ? 'sk_test_' : 'sk_live_';
  const randomPart = crypto.randomBytes(24).toString('base64url');
  return `${prefix}${randomPart}`;
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return /^sk_(live|test)_[A-Za-z0-9_-]{32}$/.test(key);
}

/**
 * Extract API key from request headers
 */
function extractApiKey(req: Request): string | null {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Check X-API-Key header
  const apiKeyHeader = req.headers['x-api-key'];
  if (typeof apiKeyHeader === 'string') {
    return apiKeyHeader;
  }

  return null;
}

/**
 * Verify API key and attach context to request
 */
export async function verifyApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const key = extractApiKey(req);

  if (!key) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'API key is required. Provide via Authorization: Bearer <key> or X-API-Key header.',
    });
    return;
  }

  if (!isValidApiKeyFormat(key)) {
    res.status(401).json({
      error: 'unauthorized',
      message: 'Invalid API key format.',
    });
    return;
  }

  try {
    // Look up API key
    const [apiKeyRecord] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.key, key), eq(apiKeys.isActive, true)));

    if (!apiKeyRecord) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid or inactive API key.',
      });
      return;
    }

    // Check if key has expired
    if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) < new Date()) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'API key has expired.',
      });
      return;
    }

    // Check rate limit
    const now = new Date();
    const resetAt = apiKeyRecord.usageResetAt
      ? new Date(apiKeyRecord.usageResetAt)
      : new Date(0);

    let currentUsage = apiKeyRecord.usageCount || 0;

    // Reset usage if past reset time (daily reset)
    if (now > resetAt) {
      currentUsage = 0;
      await db
        .update(apiKeys)
        .set({
          usageCount: 0,
          usageResetAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        })
        .where(eq(apiKeys.id, apiKeyRecord.id));
    }

    // Check if rate limit exceeded
    const rateLimit = apiKeyRecord.rateLimit || 1000;
    if (currentUsage >= rateLimit) {
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded. Limit: ${rateLimit} requests per day.`,
        resetAt: apiKeyRecord.usageResetAt,
      });
      return;
    }

    // Increment usage and update last used
    await db
      .update(apiKeys)
      .set({
        usageCount: currentUsage + 1,
        lastUsedAt: now,
        updatedAt: now,
      })
      .where(eq(apiKeys.id, apiKeyRecord.id));

    // Attach API context to request
    req.apiKey = {
      id: apiKeyRecord.id,
      userId: apiKeyRecord.userId!,
      tier: apiKeyRecord.tier || 'free',
      permissions: (apiKeyRecord.permissions as string[]) || ['read'],
      rateLimit,
      usageCount: currentUsage + 1,
    };

    next();
  } catch (error) {
    console.error('[API Auth] Error verifying API key:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to verify API key.',
    });
  }
}

/**
 * Check if request has specific permission
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'API key required.',
      });
      return;
    }

    if (!req.apiKey.permissions.includes(permission) && !req.apiKey.permissions.includes('*')) {
      res.status(403).json({
        error: 'forbidden',
        message: `Missing required permission: ${permission}`,
      });
      return;
    }

    next();
  };
}

/**
 * Check if request tier is sufficient
 */
export function requireTier(minTier: 'free' | 'pro' | 'business' | 'enterprise') {
  const tierLevels = { free: 0, pro: 1, business: 2, enterprise: 3 };

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        error: 'unauthorized',
        message: 'API key required.',
      });
      return;
    }

    const requestTierLevel = tierLevels[req.apiKey.tier as keyof typeof tierLevels] || 0;
    const requiredTierLevel = tierLevels[minTier];

    if (requestTierLevel < requiredTierLevel) {
      res.status(403).json({
        error: 'forbidden',
        message: `This endpoint requires ${minTier} tier or higher. Current tier: ${req.apiKey.tier}`,
      });
      return;
    }

    next();
  };
}
