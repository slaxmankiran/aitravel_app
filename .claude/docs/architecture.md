# Architecture

## Last Updated: 2026-01-30

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite + TailwindCSS + Radix UI |
| **Backend** | Express + TypeScript |
| **Database** | PostgreSQL 15 (Drizzle ORM) + pgvector for RAG |
| **AI** | Tiered LLM Factory (GPT-4o / DeepSeek via OpenAI SDK) |
| **Embeddings** | Ollama (nomic-embed-text) or OpenAI-compatible |
| **Routing** | Wouter (client), Express (server) |
| **State** | React Query + WorkingTrip pattern |
| **Animations** | Framer Motion |
| **Maps** | Leaflet + Mapbox |

---

## Development Setup

```bash
# Start PostgreSQL container
docker start voyageai-postgres

# Or create new container
docker run -d --name voyageai-postgres \
  -e POSTGRES_USER=voyageai \
  -e POSTGRES_PASSWORD=voyageai \
  -e POSTGRES_DB=voyageai \
  -p 5432:5432 \
  postgres:15-alpine

# Enable pgvector (for RAG)
docker exec -it voyageai-postgres psql -U voyageai -d voyageai \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Start dev server (port 3000)
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" \
DEEPSEEK_API_KEY="sk-xxx" \
PORT=3000 npm run dev

# Push schema changes
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" npx drizzle-kit push
```

---

## Directory Structure

```
client/src/
  pages/              # 14 page components
    TripResultsV1.tsx   # Premium results (1,716 lines)
    CreateTrip.tsx      # Multi-step form (2,344 lines)
    ChatTripV2.tsx      # Chat planning (982 lines)
    FeasibilityResults.tsx
    MyTrips.tsx
    TripShareView.tsx
    TripExport.tsx
    Home.tsx, Explore.tsx, Inspiration.tsx, Saved.tsx

  components/
    results/          # Results page components (25+ files)
    results-v1/       # Day cards, activity rows
    chat/             # Chat modals and pills
    ui/               # 45+ Radix/shadcn primitives

  hooks/              # 10 custom hooks
    useItineraryStream.ts   # SSE streaming
    useChangePlanner.ts     # Change planning
    useTripViewModel.ts     # Server/working trip split
    useTripVersions.ts      # Version history

  lib/                # 20+ utilities
    verdict.ts           # GO/POSSIBLE/DIFFICULT logic
    certaintyBreakdown.ts
    comparePlans.ts
    analytics.ts
    voyageUid.ts         # Account-lite

server/
  index.ts            # Express entry point
  routes.ts           # Main API hub (5,573 lines)
  storage.ts          # IStorage interface + implementations
  db.ts               # PostgreSQL/SQLite abstraction

  routes/             # Feature-specific routes (15 files)
    chat.ts, changePlan.ts, versions.ts, knowledge.ts
    auth.ts, collaboration.ts, templates.ts, etc.

  services/           # Business logic (20+ files)
    aiAgent.ts           # AI travel intelligence
    changePlannerAgent.ts # Agentic change planning
    agentChat.ts         # Conversational modifications
    streamingItinerary.ts # SSE day-by-day generation
    itineraryLock.ts     # Concurrency protection
    embeddings.ts        # RAG embeddings
    visaService.ts       # Visa lookup with RAG
    feasibilityCache.ts  # LRU caching

  middleware/
    rateLimiter.ts    # Rate limiting + admin protection

shared/
  schema.ts           # 15 Drizzle tables + types
  knowledgeSchema.ts  # 2 pgvector tables for RAG
```

---

## Database Schema (17 Tables)

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Accounts with OAuth, subscriptions, preferences |
| `sessions` | Session management with expiry |
| `trips` | Trip data, feasibility, itinerary (JSONB) |
| `tripConversations` | Chat history per trip |
| `tripVersions` | Version snapshots for history/restore |
| `tripAppliedPlans` | Shareable change plan links |

### Collaboration

| Table | Purpose |
|-------|---------|
| `tripCollaborators` | Multi-user trip access (owner/editor/viewer) |
| `tripComments` | Day/activity-level discussions |
| `tripVotes` | Thumbs up/down on activities |

### Travel Features

| Table | Purpose |
|-------|---------|
| `priceAlerts` | Flight/hotel price monitoring |
| `packingLists` | AI-generated packing items |
| `weatherCache` | Cached weather data |

### Knowledge Base (RAG)

| Table | Purpose |
|-------|---------|
| `knowledgeDocuments` | Vector-embedded documents (768-dim) |
| `knowledgeSources` | Document source tracking |

### Key Trip Fields

```typescript
trips {
  // Inputs
  passport, origin, destination, dates, budget, currency
  groupSize, adults, children, infants
  travelStyle, accommodationType, interests[]

  // Anonymous access
  userId?, voyageUid  // Account-lite

  // AI outputs
  feasibilityStatus, feasibilityReport (JSONB)
  itinerary (JSONB)

  // Concurrency lock
  itineraryStatus, itineraryLockedAt, itineraryLockOwner

  // Media
  destinationImageUrl
}
```

---

## Key Data Flow Patterns

### 1. Trip Creation → Results

```
CreateTrip or ChatTripV2
       ↓ POST /api/trips
    createTrip()
       ↓
    setTripFeasibilityPending()
       ↓ Background async
    AI Feasibility Analysis (5-8s)
       ↓
    updateTripFeasibility()
       ↓ (parallel)
    fetchAndStoreDestinationImage() → updateTripImage()
       ↓
    Client polls GET /api/trips/:id
       ↓ status: "warning" or "yes"
FeasibilityResults page
       ↓ Click "Continue"
    GET /api/trips/:id/itinerary/stream (SSE)
       ↓
TripResultsV1 (days stream in progressively)
```

### 2. SSE Streaming Itinerary

```
Client → GET /api/trips/:id/itinerary/stream
         ↓ acquireItineraryLock()

Server sends SSE events:
  - "meta" (id: meta-0) → trip info, totalDays
  - "day" (id: day-0, day-1...) → each day as generated
  - "progress" → generation status
  - ": ping" → heartbeat every 15s
  - "done" (id: done-0) → completion

         ↓ releaseItineraryLock()
Client receives via EventSource
  - Last-Event-ID enables resume on reconnect
```

### 3. Change Planning (Agentic)

```
User modifies trip (dates, budget, destination)
       ↓
POST /api/change-plan
  { prevInput, nextInput, currentResults }
       ↓
ChangePlannerAgent
  - Detects changed fields
  - Calls tools: visa lookup, flight/hotel search
  - Computes impact on modules
       ↓
Returns ChangePlannerResponse
  { deltaSummary, updatedData, uiInstructions }
       ↓
Client applies to workingTrip (optimistic)
Shows ChangePlanBanner with undo option
```

### 4. Chat with Confirmation

```
POST /api/trips/:id/chat
  { message: "Add a cooking class on day 2" }
       ↓
agentChat.processChat()
  - Context: trip details, conversation history
  - Proposes changes (does NOT apply)
       ↓
Returns { response, pendingChanges? }
  - Client shows preview
       ↓
POST /api/trips/:id/chat/confirm
  { pendingChangeId }
       ↓
applyPendingChanges() → workingTrip updated
```

---

## AI Integration

### Centralized AI Client Factory

All AI calls go through `server/services/aiClientFactory.ts`, which provides:
- **Tiered model routing** — Quality-critical vs cost-efficient calls
- **Provider-agnostic** — Swap DeepSeek ↔ GPT-4o via env var, zero code changes
- **Singleton caching** — One OpenAI SDK instance per (apiKey + baseURL) pair
- **Lazy initialization** — Services init on first use, not at startup

```typescript
import { getAIClient, isAIConfigured } from './aiClientFactory';

// Get a client for the appropriate tier
const { openai, model } = getAIClient('premium');
```

#### Provider Detection (Cascade)

```
1. OPENAI_API_KEY     → OpenAI (GPT-4o / GPT-4o-mini)
2. DEEPSEEK_API_KEY   → DeepSeek (deepseek-chat, baseURL: api.deepseek.com)
3. AI_INTEGRATIONS_*  → Replit integration fallback
```

#### Tier Assignment

| Tier | Default Model | Purpose | Files |
|------|--------------|---------|-------|
| `premium` | gpt-4o | User-facing content, structured output | routes.ts, agentChat.ts, itineraryModifier.ts, streamingItinerary.ts |
| `standard` | gpt-4o | Analysis, change planning | aiAgent.ts, changePlannerAgent.ts |
| `fast` | gpt-4o-mini | Classification, extraction | scrapingService.ts, flightApi.ts, import.ts |
| `auxiliary` | gpt-4o-mini | Low-stakes conversational | concierge.ts |

When only `DEEPSEEK_API_KEY` is set, all tiers use `deepseek-chat`.

### AI Services

| Service | Tier | Purpose |
|---------|------|---------|
| `aiClientFactory.ts` | — | Central factory (all AI clients) |
| `aiAgent.ts` | standard | Coordinates, attractions, costs, images |
| `changePlannerAgent.ts` | standard | Agentic change planning with tools |
| `agentChat.ts` | premium | Conversational itinerary modifications |
| `streamingItinerary.ts` | premium | Day-by-day SSE generation |
| `itineraryModifier.ts` | premium+fast | Director Agent (intent classification + surgical edits) |
| `scrapingService.ts` | fast | URL scraping + AI extraction |
| `flightApi.ts` | fast | Airport code lookup |

### Caching Strategy

| Data Type | TTL | Max Size | Implementation |
|-----------|-----|----------|----------------|
| Coordinates | 7 days | 2,000 | BoundedMap (LRU) |
| Attractions | 1 day | 2,000 | BoundedMap (LRU) |
| Transport | 1 day | 2,000 | BoundedMap (LRU) |
| Costs | 1 hour | 2,000 | BoundedMap (LRU) |
| Weather | 30 min | 500 | BoundedMap (LRU) |
| Feasibility | 24 hours | 1,000 | BoundedMap (LRU) |
| Scraped content | 24 hours | 200 | BoundedMap (LRU) |
| Airport codes | Permanent | Unbounded (small) | Map |

All caches use `BoundedMap` (`server/utils/boundedMap.ts`) with LRU eviction + TTL to prevent unbounded memory growth.

### Fallback Chain

```
Nominatim (free) → AI (via factory) → Cached/Static
```

---

## Security & Protection

### Rate Limiting

| Endpoint | Limit | Purpose |
|----------|-------|---------|
| SSE streams | 10/min + 3 concurrent | Streaming abuse |
| AI endpoints | 20/min | Cost protection |
| Knowledge search | 60/min | RAG queries |
| Trip creation | 5/min | Spam prevention |

### Concurrency Lock

- Prevents duplicate LLM generation from multiple tabs
- Lock timeout: 10 minutes (stale auto-takeover)
- Lock refresh: Every 60s during generation

### Generation Budgets

```typescript
GENERATION_BUDGETS = {
  maxDays: 14,           // Trip length cap
  maxTotalMs: 5 * 60000, // 5 minute timeout
  maxAICalls: 20,        // Cost limit
  maxRetriesPerDay: 2,
}
```

### Admin Protection

Production endpoints require `X-Admin-Token`:
- `POST /api/knowledge/ingest`
- `DELETE /api/knowledge/documents/:sourceId`

---

## Account-lite System

Anonymous user tracking without authentication:

```typescript
// Client: voyageUid.ts
const uid = getVoyageUid();  // UUID in localStorage
const headers = getVoyageHeaders();  // { "x-voyage-uid": "..." }

// Server: routes.ts
const voyageUid = req.headers['x-voyage-uid'];
await storage.createTrip({ ...data, voyageUid });

// Ownership check
if (trip.voyageUid && voyageUid !== trip.voyageUid) {
  return res.status(404);  // Not found (soft security)
}
```

---

## Environment Variables

### AI Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes* | DeepSeek API key (default provider) |
| `OPENAI_API_KEY` | No | OpenAI API key (overrides DeepSeek when set) |
| `AI_PREMIUM_MODEL` | No | Override premium tier (default: gpt-4o / deepseek-chat) |
| `AI_STANDARD_MODEL` | No | Override standard tier (default: gpt-4o / deepseek-chat) |
| `AI_FAST_MODEL` | No | Override fast tier (default: gpt-4o-mini / deepseek-chat) |
| `AI_AUXILIARY_MODEL` | No | Override auxiliary tier (default: gpt-4o-mini / deepseek-chat) |

*At least one of `DEEPSEEK_API_KEY` or `OPENAI_API_KEY` is required.

### Infrastructure

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Prod | PostgreSQL connection |
| `ADMIN_TOKEN` | Prod | Admin endpoint protection |
| `NODE_ENV` | No | 'production' for strict security |
| `STREAMING_ITINERARY_ENABLED` | No | SSE streaming (default: true) |
| `EMBEDDING_DIM` | No | pgvector dimension (default: 768) |
| `OLLAMA_URL` | No | Local Ollama (default: localhost:11434) |
| `SERP_API_KEY` | No | SerpAPI for flights |

---

## Client State Management

### WorkingTrip Pattern

```typescript
// useTripViewModel.ts
const { serverTrip, workingTrip, setWorkingTrip } = useTripViewModel(tripId);

// serverTrip = API data (read-only)
// workingTrip = UI state (writable, optimistic updates)
// Chat/plan changes go to workingTrip first
// Server updates merge without overwriting local edits
```

### React Query Configuration

```typescript
// queryClient.ts
defaultOptions: {
  queries: {
    staleTime: Infinity,  // No auto-refetch
    refetchOnWindowFocus: false,
  }
}
// Voyage headers auto-injected on all requests
```

---

## Performance Optimizations

### Server

- Multi-layer caching (AI cache, feasibility LRU, weather cache)
- Streaming SSE (Day 1 in 5-10s vs 60s+ batch)
- Concurrency locks prevent duplicate work
- Atomic DB writes before SSE emission

### Client

- `React.lazy()` for TripChat (heavy component)
- `React.memo()` on expensive components
- `useMemo()` for verdicts, comparisons, costs
- Throttled scroll (80ms), debounced hover (50ms)
- Skeleton states for all loading sections

---

## API Endpoints Summary

### Core

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/trips` | Create trip |
| GET | `/api/trips/:id` | Get trip |
| PUT | `/api/trips/:id` | Update trip (edit-in-place) |
| GET | `/api/trips/:id/itinerary/stream` | SSE streaming |
| GET | `/api/my-trips` | List user's trips |

### AI Features

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/trips/:id/chat` | Chat with AI |
| POST | `/api/change-plan` | Change planner agent |
| POST | `/api/trips/:id/fix-options` | Suggest fixes |

### Versions & Sharing

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/trips/:id/versions` | Version history |
| POST | `/api/trips/:id/versions/:vid/restore` | Restore version |
| GET | `/api/share/:id` | Public share view |

### Knowledge (RAG)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/knowledge/search` | Semantic search |
| POST | `/api/knowledge/ingest` | Add documents (admin) |

---

## Observability

### Stream Summary Logging

One structured JSON log per SSE stream:
```json
{
  "type": "stream_summary",
  "tripId": 123,
  "status": "complete",  // complete/abort/error/budget_exceeded
  "totalDays": 7,
  "generatedDays": 7,
  "timeToFirstDayMs": 5200,
  "totalMs": 45000,
  "aiCalls": 7
}
```

### Metrics

- Rate limit statistics
- Cache hit rates (feasibility, AI)
- Budget consumption tracking
