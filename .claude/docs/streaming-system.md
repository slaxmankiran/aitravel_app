# Streaming System

## Streaming Itinerary Generation (2026-01-12)

### Status: Production Ready ✅

SSE-based day-by-day itinerary streaming for 5x faster perceived performance. Day 1 appears within 5-10 seconds instead of waiting 60+ seconds.

### Architecture

```
Client                          Server
  │                               │
  │ GET /api/trips/:id/itinerary/stream
  │ ─────────────────────────────►│
  │                               │
  │ ◄──── SSE: event: meta ───────│ (trip info, totalDays)
  │ ◄──── SSE: event: day ────────│ (Day 1 data)
  │ ◄──── SSE: event: day ────────│ (Day 2 data)
  │       ...                     │
  │ ◄──── SSE: event: done ───────│ (complete)
  │                               │
```

### Files Created

| File | Purpose |
|------|---------|
| `server/services/streamingItinerary.ts` | SSE streaming service with day-by-day generation |
| `server/services/itineraryLock.ts` | Concurrency lock to prevent duplicate generation |
| `server/middleware/rateLimiter.ts` | Rate limiting and admin protection |
| `client/src/hooks/useItineraryStream.ts` | React hook for consuming SSE stream |
| `client/src/components/results/StreamingItinerary.tsx` | Progressive UI with skeletons |

### Server Endpoint

**GET /api/trips/:id/itinerary/stream**

SSE Events (with event IDs for Last-Event-ID resume):
- `meta` (id: `meta-0`) - Trip metadata (tripId, destination, totalDays, cached flag)
- `day` (id: `day-{i}`) - Individual day data with activities
- `progress` (id: `progress-{i}`) - Generation progress updates
- `done` (id: `done-0`) - Completion summary
- `error` (id: `error-0`) - Error with recoverable flag

### Production Hardening Features (Phase 5)

#### 1. Heartbeat Keep-Alive ✅
```typescript
// 15-second pings prevent proxy/CDN disconnects
const HEARTBEAT_INTERVAL_MS = 15000;

function sendHeartbeat(res: Response): void {
  res.write(`: ping ${Date.now()}\n\n`);
}
```

#### 2. Last-Event-ID Resume ✅
```typescript
// Browser auto-sends Last-Event-ID on reconnect
const lastEventDayIndex = parseLastEventId(req);
if (lastEventDayIndex >= 0) {
  // Skip already-received days
  const startFromDay = lastEventDayIndex + 1;
}
```

#### 3. Concurrency Lock (Cost Protection) ✅
```typescript
// Prevents duplicate LLM generation from multiple tabs
const lockResult = await acquireItineraryLock(tripId);
if (!lockResult.acquired) {
  // Stream cached days, notify client to wait
}
// Lock auto-releases on complete/error/abort
// Stale locks (> 10 min) are automatically taken over
```

#### 4. Rate Limiting ✅
```typescript
// 10 new connections/min per IP, max 3 concurrent
app.get('/api/trips/:id/itinerary/stream', ...sseProtection, handler);
```

#### 5. Rollout Flag
```typescript
// Enable via query param or env var
?stream=1                           // Explicit enable
?stream=0                           // Explicit disable
STREAMING_ITINERARY_ENABLED=true   // Default on/off
```

#### 6. Abort on Client Disconnect
```typescript
// Prevents wasted API calls when user navigates away
const abortController = createStreamAbortController(req);
req.on('close', () => abortController.aborted = true);
```

#### 7. Atomic Persistence
- DB write happens BEFORE SSE emit (prevents lost data)
- Trip status only marked 'complete' after all days generated

#### 8. Activity Deduplication
```typescript
// Deterministic key: slug-timeSlot
function generateActivityKey(activity: ItineraryActivity): string {
  const slug = activity.name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);
  const hour = parseInt(activity.time?.split(':')[0] || '12', 10);
  const timeSlot = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `${slug}-${timeSlot}`;
}
```

#### 9. Final Itinerary Caching
- Full itineraries served instantly from DB
- `cached: true` flag in SSE events
- No re-generation for complete itineraries

#### 10. Stream Metrics & Budget Guards ✅ (Phase 6)
```typescript
// Budget limits
export const GENERATION_BUDGETS = {
  maxDays: 14,           // Hard cap on trip length
  maxTotalMs: 5 * 60 * 1000, // 5 minute timeout
  maxAICalls: 20,        // Cost protection
  maxRetriesPerDay: 2,
};

// Metrics tracked per stream
interface StreamMetrics {
  tripId, lockOwner, status,
  totalDays, generatedDays, cachedDays,
  timeToFirstDayMs, totalMs, aiCalls,
  recoverableErrors, lockWaitMs,
  budgetExceeded: { type, limit, actual },
  requestId, destination, ip, userAgent
}

// One structured log per stream
[StreamSummary] {"type":"stream_summary","tripId":123,...}
```

### Client Hook Usage

```typescript
const {
  status,      // 'idle' | 'connecting' | 'streaming' | 'complete' | 'error'
  days,        // ItineraryDay[]
  meta,        // StreamMeta | null
  progress,    // StreamProgress | null
  error,       // StreamError | null
  isCached,    // boolean
  startStream, // (tripId: number) => void
  abortStream, // () => void
  retry,       // () => void
} = useItineraryStream();
```

---

## Streaming Skeleton Framework (2026-01-10)

### Status: Implemented

Section-level skeleton components for instant visual feedback during trip generation.

### Files Created

| File | Purpose |
|------|---------|
| `client/src/components/results/ResultsSkeletons.tsx` | All skeleton components |

### Components

| Component | Shows When |
|-----------|------------|
| `CertaintyBarSkeleton` | No feasibility report yet |
| `VerdictCardSkeleton` | Generating + no verdict |
| `ItinerarySkeleton` | Generating + no days |
| `DayCardSkeleton` | Single day placeholder |
| `MapSkeleton` | Generating + no days |
| `CostPanelSkeleton` | Costs loading |
| `ActionItemsSkeleton` | Action items loading |
| `RightRailSkeleton` | Cost + Action items combined |
| `StreamingProgress` | Animated progress indicator |

### Progressive Reveal Pattern

```tsx
// CertaintyBar
{workingTrip.feasibilityReport ? (
  <CertaintyBar trip={workingTrip} />
) : (
  <CertaintyBarSkeleton />
)}

// VerdictCard
{verdictResult ? (
  <VerdictCard verdictResult={verdictResult} />
) : isGenerating ? (
  <VerdictCardSkeleton />
) : null}

// Itinerary
{isGenerating || !itinerary?.days?.length ? (
  <ItinerarySkeleton />
) : (
  <DayCardList ... />
)}
```

### Success Criteria Met

- ✅ User sees progress within 2-3 seconds (skeletons render immediately)
- ✅ No empty page ever renders (all sections have skeleton states)

---

## Right Rail Decision Grade (Phase 1.5)

### Status: Implemented (2026-01-10)

Enhanced the True Cost sidebar to feel "decision grade" with prominent budget alerts and suggestion chips.

### Budget Status Type

```typescript
export type BudgetStatus = 'under' | 'near' | 'over20' | 'over50';
```

### BudgetAlert Component

Added to `RightRailPanels.tsx`:

| Budget Status | Alert Color | Suggestion Chips |
|---------------|-------------|------------------|
| `over20` | Amber | "Cheaper hotels", "Fewer activities", "Local food" |
| `over50` | Red | "Fewer days", "Budget hotels", "Skip flights" |

### Chip-to-Chat Flow

Budget suggestion chips open AI chat panel with prefilled prompt:

```typescript
const SUGGESTION_PROMPTS: Record<string, string> = {
  'Fewer days': 'Reduce the trip by 1-2 days to lower costs. Keep the best experiences.',
  'Budget hotels': 'Switch all accommodations to budget-friendly hotels or hostels.',
  'Skip flights': 'Remove internal flights and use ground transport instead.',
  'Cheaper hotels': 'Find more affordable hotel options while keeping same locations.',
  'Fewer activities': 'Remove some paid activities and suggest free alternatives.',
  'Local food': 'Replace expensive restaurants with local street food and casual eateries.',
};
```

---

## Performance Optimizations (2026-01-09)

### Status: Implemented

Comprehensive performance pass on the TripResults component tree to reduce unnecessary rerenders.

### Changes Implemented

| Component | Optimization |
|-----------|-------------|
| `TripResultsV1.tsx` | Memoized `costs` and `narrativeSubtitle` with `useMemo`; throttled map marker scroll |
| `RightRailPanels.tsx` | Lazy load `TripChat` with `React.lazy()`; wrapped in `Suspense`; `React.memo()` |
| `DayCardList.tsx` | Memoized `currencySymbol` and `dayCities`; redundant hover prevention; `React.memo()` |
| `DayCard.tsx` | `React.memo()` |
| `ActivityRow.tsx` | `React.memo()` |
| `HeaderBar.tsx` | `React.memo()` |
| `CertaintyBar.tsx` | `React.memo()` |
| `TripUpdateBanner.tsx` | `React.memo()` |
| `ItineraryMap.tsx` | `React.memo()` (prevents expensive Leaflet rerenders) |
| `ActionItems.tsx` | `React.memo()` |

### Key Patterns

**Lazy Loading Named Exports:**
```tsx
const TripChat = lazy(() =>
  import("@/components/TripChat").then(mod => ({ default: mod.TripChat }))
);
```

**Redundant Hover Prevention:**
```tsx
const hoveredRef = useRef<string | null>(null);
const handleHover = (key: string | null) => {
  if (hoveredRef.current !== key) {
    hoveredRef.current = key;
    onActivityHover(key);
  }
};
```

**Throttled Scroll:**
```tsx
const scrollTimeoutRef = useRef<number | null>(null);
const handleScroll = () => {
  if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
  scrollTimeoutRef.current = window.setTimeout(() => { /* scroll */ }, 80);
};
```
