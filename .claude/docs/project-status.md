# VoyageAI Project Status

## Last Updated: 2026-01-30

## Overall Phase Status

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         VOYAGEAI IMPLEMENTATION PHASES                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Phase 1: Core MVP                                        ✅ COMPLETE      │
│  ├── Trip creation flow (CreateTrip + ChatTripV2)                          │
│  ├── Feasibility analysis (Certainty Engine)                               │
│  ├── AI itinerary generation                                               │
│  └── Basic UI (TripResults, DayCards, Map)                                 │
│                                                                            │
│  Phase 2: RAG Foundation                                  ✅ COMPLETE      │
│  ├── pgvector + knowledge schema (2 tables)                                │
│  ├── Embeddings service (Ollama/OpenAI)                                    │
│  ├── Knowledge search endpoint                                             │
│  └── Visa lookup with citations                                            │
│                                                                            │
│  Phase 3: UX & Features                                   ✅ COMPLETE      │
│  ├── Trip Results V1 (Mindtrip-style layout)                               │
│  ├── Chat Trip V2 (wizard flow + quiet mode)                               │
│  ├── Edit flow with returnTo (edit-in-place)                               │
│  ├── Change Planner Agent (agentic with tools)                             │
│  ├── Compare Plans modal                                                   │
│  ├── Version history                                                       │
│  └── Account-lite (voyage_uid)                                             │
│                                                                            │
│  Phase 4: Streaming & Performance                         ✅ COMPLETE      │
│  ├── SSE day-by-day streaming                                              │
│  ├── Progressive skeleton UI                                               │
│  ├── React.memo optimizations                                              │
│  ├── Lazy loading (TripChat)                                               │
│  └── Multi-layer caching (AI, feasibility, weather)                        │
│                                                                            │
│  Phase 5: Production Hardening                            ✅ COMPLETE      │
│  ├── Heartbeat keep-alive (15s pings)                                      │
│  ├── Last-Event-ID resume support                                          │
│  ├── Concurrency lock (cost protection)                                    │
│  ├── Rate limiting (SSE, trips, knowledge)                                 │
│  └── Admin token protection (ingest)                                       │
│                                                                             │
│  Phase 6: Observability & Guardrails                      ✅ COMPLETE       │
│  ├── Stream summary logging                                                │
│  ├── Generation budget guard                                               │
│  ├── Metrics endpoint                                                      │
│  └── Database persistence bug fix (2026-01-19)                             │
│                                                                             │
│  Phase 7: Scale & Deploy                                  ⬜ NOT STARTED    │
│  ├── Redis L2 cache                                                        │
│  ├── Multi-instance support                                                │
│  └── Corridor expansion workflow                                           │
│                                                                             │
│  Phase 9: AI Infrastructure (LLM Factory)               ✅ COMPLETE        │
│  ├── Centralized AI Client Factory (aiClientFactory.ts) ✅ Complete         │
│  ├── Tiered model architecture (premium/standard/fast)  ✅ Complete         │
│  ├── Migrated all 10 service files to factory           ✅ Complete         │
│  ├── Provider-agnostic (DeepSeek ↔ OpenAI swap via env) ✅ Complete         │
│  ├── Bounded in-memory caches (BoundedMap utility)      ✅ Complete         │
│  └── Sanitized AI provider logging                      ✅ Complete         │
│                                                                             │
│  Phase 8: Certainty Engine (B2B + Revenue)               ✅ COMPLETE       │
│  ├── Week 1: Stripe Payment Integration                  ✅ Complete        │
│  ├── Week 1: B2B API Layer (/api/v1)                     ✅ Complete        │
│  ├── Week 2: Google Places API                           ✅ Complete        │
│  ├── Week 2: Mapbox Directions (Walking Times)           ✅ Complete        │
│  ├── Week 2: Social Media Import                         ✅ Complete        │
│  └── Week 3: WhatsApp AI Concierge                       ✅ Complete        │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Recent Updates (2026-01-30)

### Phase 9: AI Infrastructure — Centralized LLM Factory

**Problem Solved:** 10 service files each had independent, hardcoded OpenAI/DeepSeek client creation with inconsistent configuration, making it impossible to swap LLM providers without editing every file.

**Solution:** Created `server/services/aiClientFactory.ts` — a centralized factory with tiered model routing.

**Tier Architecture:**

| Tier | Default (OpenAI) | Fallback (DeepSeek) | Used By |
|------|-------------------|---------------------|---------|
| `premium` | gpt-4o | deepseek-chat | Itinerary, feasibility, chat, generative edits |
| `standard` | gpt-4o | deepseek-chat | Change planner, destination intelligence |
| `fast` | gpt-4o-mini | deepseek-chat | Classification, scraping, flight lookup, import |
| `auxiliary` | gpt-4o-mini | deepseek-chat | WhatsApp concierge |

**Files Migrated (10 total):**

| File | Tier | Changes |
|------|------|---------|
| `server/routes.ts` | premium | Replaced 27-line init block with factory call |
| `server/services/agentChat.ts` | premium | Removed hardcoded DeepSeek `/v1` URL |
| `server/services/itineraryModifier.ts` | premium+fast | Factory in constructor, fixed hardcoded model |
| `server/services/streamingItinerary.ts` | premium | Caller passes from factory |
| `server/services/aiAgent.ts` | standard | Deprecated `initializeAIAgent()`, lazy getter |
| `server/services/changePlannerAgent.ts` | standard | Deprecated `initializeChangePlannerAgent()`, lazy getter |
| `server/services/scrapingService.ts` | fast | Replaced custom `getOpenAI()` |
| `server/services/flightApi.ts` | fast | Replaced custom `getOpenAIClient()` |
| `server/routes/import.ts` | fast | Replaced module-level client |
| `server/routes/concierge.ts` | auxiliary | Replaced module-level client |

**Key Design Decisions:**
- Provider swap via env var: Set `OPENAI_API_KEY` for GPT-4o, or use `DEEPSEEK_API_KEY` alone for DeepSeek
- Per-tier model override: `AI_PREMIUM_MODEL`, `AI_FAST_MODEL`, etc.
- Singleton OpenAI instances cached per (apiKey + baseURL) pair
- Provider/model names never exposed in logs (user privacy)

**New Environment Variables:**
```bash
OPENAI_API_KEY=sk-...           # Optional: enables GPT-4o (overrides DeepSeek)
AI_PREMIUM_MODEL=gpt-4o         # Optional: override premium tier model
AI_STANDARD_MODEL=gpt-4o        # Optional: override standard tier model
AI_FAST_MODEL=gpt-4o-mini       # Optional: override fast tier model
AI_AUXILIARY_MODEL=gpt-4o-mini   # Optional: override auxiliary tier model
```

**Other Improvements (2026-01-28):**
- Created `BoundedMap` utility class (`server/utils/boundedMap.ts`) — LRU eviction + TTL for all in-memory caches
- Applied to 9 Map instances across 7 services, preventing unbounded memory growth
- Removed startup initialization calls from `changePlan.ts` and `routes.ts`

---

## Previous Updates (2026-01-20)

### Phase 8: Certainty Engine - Week 3 Complete

**WhatsApp AI Concierge:**
- Created `server/services/conciergeService.ts` - Intent parsing, response generation
- Created `server/routes/concierge.ts` - Twilio webhook endpoints
- Added `twilio` package dependency

**Concierge Features:**
- AI-powered intent parsing (greeting, help, trip_status, visa_question, etc.)
- Per-phone conversation context (30min TTL)
- Formatted WhatsApp responses for trips, visas, costs
- TwiML response generation for Twilio

**API Endpoints:**
- `GET /api/concierge/status` - Check service availability
- `POST /api/concierge/webhook` - Twilio webhook for incoming messages
- `POST /api/concierge/status-callback` - Delivery status
- `POST /api/concierge/simulate` - Test without Twilio (dev only)

**New Environment Variables:**
```bash
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_NUMBER=+14155238886
```

---

### Phase 8: Certainty Engine - Week 2 Complete

**Google Places API Integration:**
- Created `server/services/googlePlacesService.ts` - Places API wrapper with 24h cache
- Created `server/routes/places.ts` - Places lookup endpoints
- Modified `server/services/streamingItinerary.ts` - Added `placeDetails` to ItineraryActivity

**API Endpoints:**
- `GET /api/places/status` - Check if Places API is configured
- `GET /api/places/search` - Search for places
- `GET /api/places/details/:placeId` - Get place details with opening hours
- `POST /api/places/enrich` - Enrich activity with place data
- `GET /api/places/photo` - Get place photo

**Mapbox Directions (Real Walking Times):**
- Modified `server/services/mapboxService.ts` - Added walking time helpers
- Modified `server/routes/mapbox.ts` - Added walking-times, day-route endpoints

**API Endpoints:**
- `POST /api/mapbox/walking-times` - Walking times between consecutive activities
- `POST /api/mapbox/day-route` - Full walking route for a day's itinerary
- `GET /api/mapbox/cache/stats` - Cache statistics (admin only)
- `POST /api/mapbox/cache/clear` - Clear cache (admin only)

**Social Media Import:**
- Created `server/services/socialImportService.ts` - URL parsing, content fetching, AI extraction
- Created `server/routes/import.ts` - Import endpoints

**Supported Platforms:** Instagram, TikTok, Pinterest, Travel Blogs

**API Endpoints:**
- `GET /api/import/status` - Check service availability
- `POST /api/import/validate` - Validate URL before import
- `POST /api/import/url` - Import from single URL
- `POST /api/import/batch` - Import from multiple URLs (max 10)
- `POST /api/import/preview` - Preview platform detection

**New Environment Variable:**
```bash
GOOGLE_PLACES_API_KEY=xxx
```

---

### Phase 8: Certainty Engine - Week 1 Complete

**Stripe Payment Integration:**
- Created `server/services/stripeService.ts` - Full Stripe SDK wrapper
- Created `server/routes/webhooks.ts` - Webhook handlers for subscription lifecycle
- Updated `server/routes/subscriptions.ts` - Real Stripe checkout (was stubbed)

**B2B API Layer:**
- Created `server/middleware/apiAuth.ts` - API key authentication
- Created `server/routes/api/v1/index.ts` - Main B2B router
- Created `server/routes/api/v1/trips.ts` - Trip CRUD
- Created `server/routes/api/v1/feasibility.ts` - Quick feasibility checks
- Created `server/routes/api/v1/visa.ts` - Visa lookups
- Added `apiKeys` table to schema

**New Environment Variables:**
```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_BUSINESS=price_xxx
```

**B2B API Endpoints:**
- `POST /api/v1/trips` - Create trip
- `GET /api/v1/trips/:id` - Get trip details
- `GET /api/v1/trips/:id/feasibility` - Get feasibility report
- `POST /api/v1/feasibility/check` - Quick check (no trip)
- `GET /api/v1/visa/lookup` - Visa requirements

---

## Previous Updates (2026-01-19)

### Database Persistence Bug Fix

**Issue**: Feasibility data was being overwritten to `pending` after successful save.

**Root Cause**: Race condition where `fetchAndStoreDestinationImage()` called `updateTrip()` which ALWAYS reset `feasibilityStatus: 'pending'` and `feasibilityReport: null`.

**Fix Applied**:
1. Added `updateTripImage()` method to `IStorage` interface
2. Implemented in `DatabaseStorage` class (server/storage.ts:100-112)
3. Implemented in `InMemoryStorage` class (server/storage.ts:273-280)
4. Updated `fetchAndStoreDestinationImage()` in routes.ts to use the new method

**Files Modified**:
- `server/storage.ts` - Added `updateTripImage()` method
- `server/routes.ts` - Updated image storage function

---

## Codebase Statistics

### Server (Express + TypeScript)

| Category | Count | Key Files |
|----------|-------|-----------|
| Main routes | 5,573 lines | `routes.ts` |
| Feature routes | 15 files | `chat.ts`, `changePlan.ts`, `versions.ts`, etc. |
| Services | 20+ files | `aiAgent.ts`, `streamingItinerary.ts`, `changePlannerAgent.ts` |
| Middleware | 1 file | `rateLimiter.ts` |

### Client (React + TypeScript)

| Category | Count | Key Files |
|----------|-------|-----------|
| Pages | 14 files | `TripResultsV1.tsx` (1,716 lines), `CreateTrip.tsx` (2,344 lines) |
| Components | 100+ files | `results/`, `results-v1/`, `chat/`, `ui/` |
| Hooks | 10 files | `useItineraryStream.ts`, `useChangePlanner.ts` |
| Utilities | 20+ files | `verdict.ts`, `comparePlans.ts`, `analytics.ts` |

### Database (Drizzle + PostgreSQL)

| Category | Count |
|----------|-------|
| Main tables | 15 |
| Knowledge tables | 2 (with pgvector) |
| Total tables | 17 |

---

## Feature Inventory

### Complete Features

| Feature | Status | Key Files |
|---------|--------|-----------|
| Trip Creation (Form) | ✅ | `CreateTrip.tsx` |
| Trip Creation (Chat) | ✅ | `ChatTripV2.tsx` |
| Feasibility Analysis | ✅ | `routes.ts`, `feasibilityCache.ts` |
| Streaming Itinerary | ✅ | `streamingItinerary.ts`, `useItineraryStream.ts` |
| Day Cards UI | ✅ | `DayCard.tsx`, `DayCardList.tsx` |
| Interactive Map | ✅ | `ItineraryMap.tsx` |
| Verdict System | ✅ | `verdict.ts`, `VerdictCard.tsx` |
| Certainty Breakdown | ✅ | `certaintyBreakdown.ts`, `CertaintyBreakdown.tsx` |
| Change Planner | ✅ | `changePlannerAgent.ts`, `useChangePlanner.ts` |
| Compare Plans | ✅ | `comparePlans.ts`, `ComparePlansModal.tsx` |
| Version History | ✅ | `versions.ts`, `useTripVersions.ts` |
| AI Chat | ✅ | `agentChat.ts`, `TripChat.tsx` |
| Account-lite | ✅ | `voyageUid.ts`, trips.voyageUid |
| Share View | ✅ | `TripShareView.tsx`, `/api/share/:id` |
| PDF Export | ✅ | `TripExport.tsx` |
| My Trips | ✅ | `MyTrips.tsx`, `/api/my-trips` |
| RAG Knowledge | ✅ | `knowledge.ts`, `embeddings.ts` |

### Phase 8 Features (Certainty Engine)

| Feature | Status | Key Files |
|---------|--------|-----------|
| Stripe Payments | ✅ | `stripeService.ts`, `webhooks.ts` |
| B2B API (/api/v1) | ✅ | `api/v1/trips.ts`, `api/v1/feasibility.ts` |
| API Key Auth | ✅ | `apiAuth.ts`, `apiKeys` table |
| Google Places API | ✅ | `googlePlacesService.ts`, `places.ts` |
| Real Walking Times | ✅ | `mapboxService.ts`, `mapbox.ts` |
| Social Media Import | ✅ | `socialImportService.ts`, `import.ts` |
| WhatsApp Concierge | ✅ | `conciergeService.ts`, `concierge.ts` |

### Infrastructure Features

| Feature | Status | Notes |
|---------|--------|-------|
| SSE Heartbeat | ✅ | 15s pings |
| Last-Event-ID Resume | ✅ | Auto-reconnect |
| Concurrency Lock | ✅ | Prevent duplicate generation |
| Rate Limiting | ✅ | Per-endpoint limits |
| Generation Budgets | ✅ | maxDays, maxTime, maxCalls |
| Stream Logging | ✅ | Structured JSON per stream |
| Feasibility Cache | ✅ | 24h TTL, 1000 entries LRU |
| AI Cache | ✅ | Multi-TTL by data type |
| Places Cache | ✅ | 24h TTL for place details |
| Directions Cache | ✅ | 1d TTL for walking routes |

---

## Environment Variables

### Required

```bash
DEEPSEEK_API_KEY=sk-xxx           # AI API key
DATABASE_URL=postgres://...       # PostgreSQL connection (prod)
```

### Production

```bash
ADMIN_TOKEN=your-secret-token     # Admin endpoint protection
NODE_ENV=production               # Enables strict security
```

### Optional

```bash
STREAMING_ITINERARY_ENABLED=true  # SSE streaming (default: true)
EMBEDDING_DIM=768                 # pgvector embedding dimension
OLLAMA_URL=http://localhost:11434 # Local embeddings
SERP_API_KEY=sk-xxx               # Flight search API
```

---

## API Endpoints Summary

### Trip Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trips` | POST | Create trip |
| `/api/trips/:id` | GET | Get trip |
| `/api/trips/:id` | PUT | Update trip (edit-in-place) |
| `/api/trips/:id` | DELETE | Delete trip |
| `/api/my-trips` | GET | List user's trips |
| `/api/trips/:id/itinerary/stream` | GET | SSE streaming |

### AI Features

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trips/:id/chat` | POST | Chat with AI |
| `/api/trips/:id/chat/confirm` | POST | Apply pending changes |
| `/api/change-plan` | POST | Change planner agent |
| `/api/trips/:id/fix-options` | POST | Suggest fixes |
| `/api/trips/:id/generate-itinerary` | POST | Generate itinerary |

### Versions & Sharing

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/trips/:id/versions` | GET/POST | Version history |
| `/api/trips/:id/versions/:vid/restore` | POST | Restore version |
| `/api/share/:id` | GET | Public share view |
| `/api/trips/:id/applied-plans` | GET/POST | Shareable plan links |

### Knowledge (RAG)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/knowledge/search` | POST | Semantic search |
| `/api/knowledge/ingest` | POST | Add documents (admin) |
| `/api/knowledge/ingest/batch` | POST | Batch ingest (admin) |

### B2B API (v1)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/trips` | POST | Create trip (B2B) |
| `/api/v1/trips/:id` | GET | Get trip details |
| `/api/v1/trips/:id/feasibility` | GET | Get feasibility report |
| `/api/v1/feasibility/check` | POST | Quick feasibility check |
| `/api/v1/visa/lookup` | GET | Visa requirements |

### Google Places

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/places/status` | GET | Check API availability |
| `/api/places/search` | GET | Search places |
| `/api/places/details/:placeId` | GET | Place details + hours |
| `/api/places/enrich` | POST | Enrich activity data |

### Social Import

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/import/status` | GET | Check service status |
| `/api/import/url` | POST | Import from URL |
| `/api/import/batch` | POST | Import multiple URLs |

### WhatsApp Concierge

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/concierge/status` | GET | Check service availability |
| `/api/concierge/webhook` | POST | Twilio webhook |
| `/api/concierge/status-callback` | POST | Delivery status |
| `/api/concierge/simulate` | POST | Test messages (dev) |

---

## Production Checklist

### Security
- [x] Rate limiting on all expensive endpoints
- [x] Admin token for ingest/delete operations
- [x] Concurrency lock prevents cost abuse
- [x] Client disconnect aborts generation
- [x] Voyage UID ownership checks
- [ ] Input validation hardening
- [ ] CORS configuration

### Reliability
- [x] Heartbeat keeps SSE alive through proxies
- [x] Last-Event-ID enables auto-reconnect
- [x] Atomic persistence (DB before SSE)
- [x] Stale lock recovery
- [x] Generation budget guards
- [x] Database persistence bug fixed (2026-01-19)
- [ ] Circuit breaker for AI API

### Observability
- [x] Console logging throughout
- [x] Rate limit metrics endpoint
- [x] Stream summary logging
- [ ] Error tracking (Sentry)
- [ ] Performance metrics dashboard

### Scalability
- [x] DB caching for complete itineraries
- [x] Multi-layer AI caching
- [x] Feasibility LRU cache
- [ ] Redis L2 cache
- [ ] Multi-instance lock coordination
- [ ] Queue for long generation jobs

---

## Next Steps (Phase 7)

### Priority Order:
1. **Redis L2 Cache** - Reduce DB load for hot trip data
2. **Multi-instance Lock Coordination** - Redis-based locks for horizontal scaling
3. **Corridor Expansion** - Seed top 20 visa corridors with RAG data
4. **Error Tracking** - Sentry integration for production monitoring

---

## Key Architecture Decisions

1. **Account-lite over Auth-first**: UUID in localStorage enables anonymous usage while preserving trip ownership

2. **WorkingTrip Pattern**: Separates server data from optimistic UI updates, enabling undo and comparison

3. **SSE over WebSockets**: Simpler protocol for one-way streaming, better proxy compatibility

4. **Agentic Change Planning**: AI with tools for intelligent recomputation vs. full regeneration

5. **Edit-in-place**: Same trip ID preserved on edit, not duplicated

6. **Dedicated Image Update**: `updateTripImage()` method prevents feasibility data loss (bug fix)
