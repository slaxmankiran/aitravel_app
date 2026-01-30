# Certainty Engine Implementation

## Overview

This document tracks the implementation of the VoyageAI Certainty Engine - a production-grade travel planning platform with B2B API capability.

**Started:** 2026-01-20
**Status:** In Progress

---

## Implementation Timeline

### Week 1: Revenue & API Foundation ✅ COMPLETE

#### Day 1-2: Stripe Payment Integration ✅

**Files Created:**
| File | Purpose |
|------|---------|
| `server/services/stripeService.ts` | Stripe SDK wrapper |
| `server/routes/webhooks.ts` | Stripe webhook handlers |

**Files Modified:**
| File | Changes |
|------|---------|
| `server/routes/subscriptions.ts` | Replaced stubbed checkout with real Stripe |
| `server/routes.ts` | Added webhook router import and registration |
| `package.json` | Added `stripe` dependency |

**Stripe Service Features:**
- `getOrCreateCustomer()` - Create/retrieve Stripe customers
- `createCheckoutSession()` - Create subscription checkout
- `createPortalSession()` - Customer billing portal
- `cancelSubscription()` - Cancel at period end or immediately
- `reactivateSubscription()` - Reactivate cancelled subscription
- `verifyWebhookSignature()` - Verify Stripe webhook signatures

**Webhook Events Handled:**
- `checkout.session.completed` - Activate subscription
- `customer.subscription.created/updated` - Handle plan changes
- `customer.subscription.deleted` - Handle cancellations
- `invoice.payment_failed` - Handle failed payments
- `invoice.payment_succeeded` - Handle renewals

**Environment Variables Required:**
```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_BUSINESS=price_xxx
```

---

#### Day 3-5: B2B API Layer ✅

**Files Created:**
| File | Purpose |
|------|---------|
| `server/middleware/apiAuth.ts` | API key authentication middleware |
| `server/routes/api/v1/index.ts` | Main B2B API router |
| `server/routes/api/v1/trips.ts` | Trip CRUD endpoints |
| `server/routes/api/v1/feasibility.ts` | Quick feasibility checks |
| `server/routes/api/v1/visa.ts` | Visa requirement lookups |

**Schema Additions (shared/schema.ts):**
```typescript
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  key: text("key").notNull().unique(), // sk_live_xxx or sk_test_xxx
  name: text("name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").default(['read']),
  rateLimit: integer("rate_limit").default(1000), // per day
  tier: text("tier").default("free"),
  usageCount: integer("usage_count").default(0),
  usageResetAt: timestamp("usage_reset_at"),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**B2B API Endpoints:**
```
/api/v1/
  GET  /                    - API info and capabilities
  GET  /health              - Health check

  /trips
    POST /                  - Create a new trip
    GET  /:id               - Get trip details
    GET  /:id/feasibility   - Get feasibility report
    GET  /:id/itinerary/stream - Stream itinerary (SSE)

  /feasibility
    POST /check             - Quick feasibility check (no trip created)

  /visa
    GET /lookup             - Visa requirements lookup
    GET /countries          - List available countries
```

**API Authentication:**
- API key via `Authorization: Bearer sk_xxx` or `X-API-Key: sk_xxx`
- Rate limiting per key (default 1000/day)
- Tier-based access control (free/pro/business/enterprise)
- Permission-based endpoint access

---

### Week 2: Enhanced Features 🟡 IN PROGRESS

#### Day 7-8: Google Places API (Real Attraction Hours) ✅ COMPLETE

**Files Created:**
| File | Purpose |
|------|---------|
| `server/services/googlePlacesService.ts` | Places API wrapper with caching |
| `server/routes/places.ts` | Places lookup endpoints |

**Files Modified:**
| File | Changes |
|------|---------|
| `server/routes.ts` | Added places router import and registration |
| `server/services/streamingItinerary.ts` | Added placeDetails to ItineraryActivity interface, enrichment functions |

**Google Places Service Features:**
- `searchPlaces()` - Search for places by text query
- `getPlaceDetails()` - Get detailed info including opening hours
- `findPlaceWithDetails()` - Search and get details in one call
- `enrichActivityWithPlaceData()` - Enrich single activity
- `enrichActivitiesBatch()` - Batch enrich with rate limiting
- `getPlacePhotoUrl()` - Get photo URL by reference
- 24-hour cache TTL for place details

**Streaming Itinerary Integration:**
- Added `placeDetails` field to `ItineraryActivity` interface
- Added `enrichDayWithPlaceDetails()` function
- Added `enrichAllDaysWithPlaceDetails()` function
- Activities can now include:
  - `placeId` - Google Places ID
  - `rating` - User rating (1-5)
  - `priceLevel` - Price level (0-4)
  - `googleMapsUrl` - Direct link to Google Maps
  - `openingHours` - Real opening hours with weekday text

**API Endpoints:**
```
/api/places/
  GET  /status              - Check if Places API is configured
  GET  /search              - Search for places
  GET  /details/:placeId    - Get place details
  POST /enrich              - Enrich activity with place data
  GET  /photo               - Get place photo (redirect)
  POST /cache/clear         - Clear cache (admin only)
```

**Status:** Complete

---

#### Day 9-10: Mapbox Directions API (Real Walking Times) ✅ COMPLETE

**Files Modified:**
| File | Changes |
|------|---------|
| `server/services/mapboxService.ts` | Added walking time helpers, cache stats |
| `server/routes/mapbox.ts` | Added walking-times, day-route, cache endpoints |

**Mapbox Service Additions:**
- `getWalkingTime()` - Get walking time between two points
- `getWalkingTimesBetweenActivities()` - Batch walking times for activity pairs
- `getDayWalkingRoute()` - Single route through all day's activities
- `getCacheStats()` - Monitor cache usage
- `clearCache()` - Admin cache management

**New API Endpoints:**
```
/api/mapbox/
  POST /walking-times        - Walking times between consecutive activities
  POST /day-route            - Full walking route for a day's itinerary
  GET  /cache/stats          - Cache statistics (admin only)
  POST /cache/clear          - Clear cache (admin only)
```

**Walking Time Response Format:**
```json
{
  "activityCount": 4,
  "segments": 3,
  "walkingTimes": [
    {
      "fromIndex": 0,
      "toIndex": 1,
      "available": true,
      "distanceMeters": 850,
      "durationSeconds": 612,
      "walkable": true,
      "formattedDistance": "850m",
      "formattedDuration": "10 min"
    }
  ]
}
```

**Status:** Complete

---

#### Day 11-12: Social Media Inspiration Import ✅ COMPLETE

**Files Created:**
| File | Purpose |
|------|---------|
| `server/services/socialImportService.ts` | URL parsing, content fetching, AI extraction |
| `server/routes/import.ts` | Import endpoints |

**Files Modified:**
| File | Changes |
|------|---------|
| `server/routes.ts` | Added import router registration |

**Social Import Service Features:**
- `detectPlatform()` - Identify platform from URL
- `validateUrl()` - Validate and normalize URLs
- `fetchSocialContent()` - Fetch content with browser-like user agent
- `extractTravelInfo()` - AI-powered extraction of trip details
- `importFromUrl()` - Full import pipeline
- `importBatch()` - Batch import with rate limiting

**Supported Platforms:**
- Instagram - Posts, Reels (captions, hashtags)
- TikTok - Videos (descriptions, tags)
- Pinterest - Pins (descriptions, board context)
- Blogs - Travel articles (full content extraction)

**API Endpoints:**
```
/api/import/
  GET  /status              - Check service availability
  POST /validate            - Validate URL before import
  POST /url                 - Import from single URL
  POST /batch               - Import from multiple URLs (max 10)
  POST /preview             - Preview platform detection
```

**Import Response Format:**
```json
{
  "success": true,
  "platform": "instagram",
  "sourceUrl": "https://instagram.com/p/...",
  "destination": "Bali, Indonesia",
  "activities": ["Temple visit", "Beach sunset", "Rice terrace"],
  "estimatedDays": 5,
  "travelStyle": "moderate",
  "highlights": ["Ubud temples", "Seminyak beach"],
  "tags": ["beach", "culture", "food"],
  "confidence": "high"
}
```

**Status:** Complete (backend only - frontend UI deferred to Phase 2)

---

### Week 3: Polish & Concierge Foundation ✅ COMPLETE

#### Day 13-14: WhatsApp AI Concierge ✅

**Files Created:**
| File | Purpose |
|------|---------|
| `server/services/conciergeService.ts` | Concierge logic, intent parsing, response generation |
| `server/routes/concierge.ts` | Twilio webhook endpoints, TwiML responses |

**Files Modified:**
| File | Changes |
|------|---------|
| `server/routes.ts` | Added concierge router import and registration |
| `package.json` | Added `twilio` dependency |

**Concierge Service Features:**
- `parseMessage()` - AI-powered intent parsing
- `getConversationContext()` - Per-phone conversation state (30min TTL)
- `handleIncomingMessage()` - Main message handler with intent routing
- `formatTripStatusResponse()` - Trip status formatting for WhatsApp
- `formatVisaResponse()` - Visa info formatting
- `formatCostResponse()` - Cost breakdown formatting
- `sendWhatsAppMessage()` - Outbound message via Twilio

**Supported Intents:**
| Intent | Example | Handler |
|--------|---------|---------|
| `greeting` | "Hi", "Hello" | Friendly welcome + capabilities |
| `help` | "What can you do?" | Feature list |
| `trip_status` | "What's my trip status?" | Lookup trip by phone/ID |
| `trip_details` | "Show me my Paris trip" | Detailed trip info |
| `visa_question` | "Do I need a visa for Japan?" | Visa lookup |
| `cost_question` | "How much will my trip cost?" | Cost breakdown |
| `change_request` | "Add cooking class to day 2" | Forward to agentChat |
| `general_question` | Other travel questions | Suggest using app |

**API Endpoints:**
```
/api/concierge/
  GET  /status           - Check service availability
  POST /webhook          - Twilio webhook for incoming messages
  POST /status-callback  - Message delivery status
  POST /send             - Manual send (admin/dev only)
  POST /simulate         - Test messages without Twilio (dev only)
```

**Webhook Flow:**
```
User (WhatsApp) → Twilio → POST /api/concierge/webhook
                              ↓
                    Parse intent with AI
                              ↓
                    Route to handler (status/visa/cost/etc.)
                              ↓
                    Generate response
                              ↓
                    Return TwiML → Twilio → User (WhatsApp)
```

**Phase 2 Deferred Features:**
- Proactive notifications (trip ready, visa deadlines)
- Rich media responses (images, cards)
- Multi-language support
- Phone-to-user account linking

**Status:** Complete (MVP backend)

---

## Environment Variables Summary

```bash
# Stripe (Week 1)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_BUSINESS=price_xxx

# Google Places (Week 2)
GOOGLE_PLACES_API_KEY=xxx

# Mapbox (Week 2 - already configured)
MAPBOX_ACCESS_TOKEN=xxx

# Twilio (Week 3)
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_NUMBER=+14155238886
```

---

## Database Migrations Required

After Week 1:
```bash
DATABASE_URL="postgres://..." npx drizzle-kit push
```

This will add:
- `api_keys` table
- `subscriptions` table updates (if not already present)

---

## Testing Checklist

### Week 1 Tests
- [ ] Stripe checkout flow creates subscription
- [ ] Webhook activates subscription on payment
- [ ] API key authentication works
- [ ] Rate limiting enforces daily limits
- [ ] B2B trip creation triggers feasibility analysis

### Week 2 Tests
- [ ] Google Places returns real opening hours
- [ ] Mapbox Directions returns real walking times
- [ ] Social import parses Instagram/TikTok URLs

### Week 3 Tests
- [ ] Concierge status endpoint returns availability
- [ ] Webhook receives and parses Twilio messages
- [ ] Intent parsing correctly identifies greeting/help/visa
- [ ] TwiML response format is valid
- [ ] Simulation endpoint works in development

---

## Risk Log

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stripe webhook issues | Medium | Use Stripe CLI for local testing |
| Google Places rate limits | Low | Aggressive caching, AI fallback |
| Social import parsing fails | High | AI fallback, manual entry option |
| WhatsApp delays | High | Keep as "Coming Soon" in MVP |

---

## Related Documentation

- [Project Status](./project-status.md)
- [Architecture](./architecture.md)
- [Visa System](./visa-system.md)
- [Streaming System](./streaming-system.md)
