/**
 * Rate Limiting Middleware
 *
 * Protects endpoints from abuse and excessive costs.
 * Uses express-rate-limit with different tiers for different endpoint types.
 *
 * Tiers:
 * - SSE streaming: 10/min per IP, max 3 concurrent
 * - AI-heavy (feasibility, chat): 20/min per IP
 * - Knowledge search: 60/min per IP
 * - Knowledge ingest: Admin-only in production
 */

import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction, RequestHandler } from "express";

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Environment check for production mode */
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Admin token for protected endpoints (ingest, etc.) */
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

/** Track concurrent SSE connections per IP */
const sseConnectionsByIP = new Map<string, number>();

/** Maximum concurrent SSE connections per IP */
const MAX_CONCURRENT_SSE_PER_IP = 3;

// ============================================================================
// RATE LIMITERS
// ============================================================================

/**
 * SSE Streaming rate limiter
 * 10 new connections per minute per IP
 */
export const sseRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: "Too many streaming requests. Please wait before starting another stream.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
  skip: (req) => {
    // Skip if this is a reconnect (Last-Event-ID present)
    return !!req.headers["last-event-id"];
  },
});

/**
 * AI-heavy endpoints rate limiter (feasibility, chat)
 * 20 requests per minute per IP
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    error: "Too many AI requests. Please wait before trying again.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

/**
 * Knowledge search rate limiter
 * 60 requests per minute per IP
 */
export const knowledgeSearchRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: {
    error: "Too many search requests. Please wait before trying again.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

/**
 * Visa lookup rate limiter
 * 30 requests per minute per IP
 */
export const visaLookupRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: "Too many visa lookup requests. Please wait before trying again.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

/**
 * Trip creation rate limiter
 * 5 requests per minute per IP (trips are expensive)
 */
export const tripCreationRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 trips per minute
  message: {
    error: "Too many trip creation requests. Please wait before creating another trip.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

/**
 * General API rate limiter (fallback)
 * 100 requests per minute per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: {
    error: "Too many requests. Please slow down.",
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIP(req),
});

// ============================================================================
// CONCURRENT SSE LIMITER
// ============================================================================

/**
 * Middleware to limit concurrent SSE connections per IP
 * Returns 429 if IP has too many active streams
 */
export const sseConcurrencyLimiter: RequestHandler = (req, res, next) => {
  const ip = getClientIP(req);
  const currentCount = sseConnectionsByIP.get(ip) || 0;

  if (currentCount >= MAX_CONCURRENT_SSE_PER_IP) {
    console.log(`[RateLimit] SSE concurrency limit reached for IP ${ip} (${currentCount}/${MAX_CONCURRENT_SSE_PER_IP})`);
    return res.status(429).json({
      error: `Too many concurrent streams. Maximum ${MAX_CONCURRENT_SSE_PER_IP} allowed per IP.`,
      currentStreams: currentCount,
    });
  }

  // Increment count
  sseConnectionsByIP.set(ip, currentCount + 1);
  console.log(`[RateLimit] SSE connection opened for IP ${ip} (${currentCount + 1}/${MAX_CONCURRENT_SSE_PER_IP})`);

  // Decrement on close
  const cleanup = () => {
    const count = sseConnectionsByIP.get(ip) || 1;
    if (count <= 1) {
      sseConnectionsByIP.delete(ip);
    } else {
      sseConnectionsByIP.set(ip, count - 1);
    }
    console.log(`[RateLimit] SSE connection closed for IP ${ip} (${Math.max(0, count - 1)}/${MAX_CONCURRENT_SSE_PER_IP})`);
  };

  res.on("close", cleanup);
  res.on("finish", cleanup);

  next();
};

// ============================================================================
// ADMIN TOKEN MIDDLEWARE
// ============================================================================

/**
 * Middleware to require admin token for protected endpoints
 * In production, blocks requests without valid X-Admin-Token header
 * In development, allows all requests with a warning
 */
export const requireAdminToken: RequestHandler = (req, res, next) => {
  const providedToken = req.headers["x-admin-token"] as string | undefined;

  // In development without ADMIN_TOKEN set, allow with warning
  if (!IS_PRODUCTION && !ADMIN_TOKEN) {
    console.warn(`[Security] Admin endpoint accessed without token in dev mode: ${req.path}`);
    return next();
  }

  // Check token
  if (!ADMIN_TOKEN) {
    console.error("[Security] ADMIN_TOKEN not configured but required in production");
    return res.status(503).json({
      error: "Service not configured. Admin token required but not set.",
    });
  }

  if (!providedToken) {
    return res.status(401).json({
      error: "Admin token required. Provide X-Admin-Token header.",
    });
  }

  if (providedToken !== ADMIN_TOKEN) {
    console.warn(`[Security] Invalid admin token attempt from ${getClientIP(req)}`);
    return res.status(403).json({
      error: "Invalid admin token.",
    });
  }

  next();
};

/**
 * Middleware that blocks endpoint entirely in production (unless admin)
 * Useful for dangerous endpoints like ingest
 */
export const productionAdminOnly: RequestHandler = (req, res, next) => {
  if (!IS_PRODUCTION) {
    // In development, allow all
    return next();
  }

  // In production, require admin token
  return requireAdminToken(req, res, next);
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get client IP address, handling proxies
 */
function getClientIP(req: Request): string {
  // Trust X-Forwarded-For from reverse proxies
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = typeof forwarded === "string" ? forwarded : forwarded[0];
    return ips.split(",")[0].trim();
  }

  // Fall back to direct connection
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Combined SSE limiter (rate + concurrency)
 * Use this for SSE endpoints
 */
export const sseProtection: RequestHandler[] = [
  sseConcurrencyLimiter,
  sseRateLimiter,
];

// ============================================================================
// METRICS (for observability)
// ============================================================================

/**
 * Get current rate limiting metrics
 */
export function getRateLimitMetrics() {
  const sseConnections: Record<string, number> = {};
  sseConnectionsByIP.forEach((count, ip) => {
    sseConnections[ip] = count;
  });

  return {
    activeSseConnections: sseConnectionsByIP.size,
    sseConnectionsByIP: sseConnections,
    totalActiveSseStreams: Array.from(sseConnectionsByIP.values()).reduce((a, b) => a + b, 0),
  };
}
