# Account-lite & Security

## Item 21: Account-lite MVP (2026-01-09)

### Status: Implemented and Tested

Anonymous user identification enabling trip persistence without authentication.

### How It Works

1. **First Visit**: `getVoyageUid()` generates a UUID and stores in localStorage
2. **Every Request**: `x-voyage-uid` header automatically included via `getVoyageHeaders()`
3. **Trip Creation**: Server stores `voyageUid` on trip record
4. **My Trips**: `/api/my-trips` endpoint filters trips by user's voyageUid

### Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/voyageUid.ts` | UUID generation, localStorage storage, header helper |

### Files Modified

| File | Changes |
|------|---------|
| `client/src/lib/queryClient.ts` | Added voyage headers to all API requests |
| `shared/schema.ts` | Added `voyageUid` column + index to trips table |
| `server/routes.ts` | Extract UID header, store on trips, `/api/my-trips` endpoint |
| `server/storage.ts` | Added `listTripsByUid()` method |
| `client/src/hooks/use-trips.ts` | Added voyage headers to fetch calls |
| `client/src/pages/MyTrips.tsx` | Updated for TripSummary with certainty badges |

### API Endpoint

**GET /api/my-trips**
- Header: `x-voyage-uid` (required)
- Returns: `{ trips: TripSummary[] }`

```typescript
interface TripSummary {
  id: number;
  destination: string;
  dates: string;
  certaintyScore: number | null;
  certaintyLabel: 'high' | 'medium' | 'low' | null;
  estimatedCost: number | null;
  currency: string;
  travelers: number;
  feasibilityStatus: string | null;
  createdAt: string | null;
}
```

### Client Helper

```typescript
// client/src/lib/voyageUid.ts
import { getVoyageUid, getVoyageHeaders } from "@/lib/voyageUid";

// Get or create user ID
const uid = getVoyageUid(); // Returns UUID from localStorage

// Get headers for API requests
const headers = getVoyageHeaders(); // { "x-voyage-uid": "..." }
```

### Database Migration

For production, run schema push to add the `voyageUid` column:
```bash
DATABASE_URL="..." npx drizzle-kit push
```

---

## Production Finishing (2026-01-09)

### Status: Implemented and Tested

Security hardening and UX polish for production readiness.

### 1. Soft Backfill on Trip Access

Legacy trips (null voyageUid) are automatically adopted when accessed:

```typescript
// server/routes.ts - GET /api/trips/:id
if (!trip.voyageUid && voyageUid) {
  const adopted = await storage.adoptTrip(tripId, voyageUid);
  // Trip now belongs to this user
}
```

**Storage Method:**
```typescript
// server/storage.ts
async adoptTrip(id: number, voyageUid: string): Promise<Trip | null>
// Only updates if voyageUid is currently null
```

### 2. Ownership Checks on Sensitive Endpoints

**Rule:** If trip has `voyageUid` and it doesn't match request header → return 404

**Protected Endpoints:**
| Endpoint | File |
|----------|------|
| `GET /api/trips/:id` | `server/routes.ts` |
| `POST /api/trips/:tripId/versions` | `server/routes/versions.ts` |
| `GET /api/trips/:tripId/versions` | `server/routes/versions.ts` |
| `GET /api/trips/:tripId/versions/:versionId` | `server/routes/versions.ts` |
| `POST /api/trips/:tripId/versions/:versionId/restore` | `server/routes/versions.ts` |

**Logic:**
```typescript
// Legacy trips (null voyageUid) remain accessible to everyone (for share links)
// Owned trips (has voyageUid) only accessible to owner
if (trip.voyageUid && voyageUid && trip.voyageUid !== voyageUid) {
  return res.status(404).json({ message: 'Trip not found' });
}
```

### 3. Empty State Banner

My Trips page shows helpful notice when empty:

> "On a new device or cleared your browser? Your trips are stored locally. If you have a trip link saved, you can still access it directly."

### 4. "Trip Saved" Toast

Toast notification on trip creation:
- **Title:** "Trip saved!"
- **Description:** "Find it anytime in My Trips."

Added to both `CreateTrip.tsx` and `ChatTripV2.tsx`.

### Test Results

```bash
# User A creates trip
curl -X POST /api/trips -H "x-voyage-uid: user-A" → Trip 2 created

# User A can access their trip
curl /api/trips/2 -H "x-voyage-uid: user-A" → 200 OK

# User B cannot access User A's trip
curl /api/trips/2 -H "x-voyage-uid: user-B" → 404 Not Found

# Legacy trip (null uid) gets adopted on first access
curl /api/trips/1 -H "x-voyage-uid: user-C" → Trip adopted, now owned by user-C
```

---

## Share View (Phase 3.6)

### Status: Implemented and Tested (2026-01-11)

Public, read-only trip sharing with OG meta tags for social previews.

**Route:** `/share/:tripId`

### Features

| Feature | Description |
|---------|-------------|
| Public API | `GET /api/share/:id` returns trip without auth |
| OG Meta Tags | Dynamic title, description for Facebook/Twitter previews |
| Read-only UI | No edit affordances, clean view-only rendering |
| Plan Own CTA | Prominent "Plan your own trip" conversion button |
| Full Itinerary | Day cards, map, cost summary - all visible |

### Files Created/Modified

| File | Changes |
|------|---------|
| `client/src/pages/TripShareView.tsx` | New page component |
| `client/src/App.tsx` | Added `/share/:tripId` route |
| `server/routes.ts` | Added `GET /api/share/:id` endpoint |
| `server/vite.ts` | OG meta tag injection (development) |
| `server/static.ts` | OG meta tag injection (production) |

### API Endpoint

```typescript
// GET /api/share/:id - Public endpoint, no auth required
// Returns: Shareable trip data (excludes sensitive fields)
{
  id, destination, origin, startDate, endDate,
  groupSize, travelStyle, budget, currency,
  feasibilityReport, itinerary, certaintyScore,
  trueCostBreakdown, visaDetails, actionItems
  // Excludes: userId, voyageUid, userNotes
}
```

### OG Meta Tags

```html
<title>Paris, France Trip | VoyageAI</title>
<meta property="og:title" content="Paris, France Trip | VoyageAI" />
<meta property="og:description" content="AI-powered travel plan for Paris, France. 2 travelers, moderate style." />
<meta name="twitter:card" content="summary_large_image" />
```

---

## Production Checklist

- [x] Anonymous user tracking (voyage_uid)
- [x] Trip ownership isolation
- [x] Soft backfill for legacy trips
- [x] Empty state UX for new devices
- [x] "Trip saved" confirmation toast
- [ ] Database migration for voyageUid column (run `drizzle-kit push`)
- [ ] Optional: Email capture for cross-device persistence
