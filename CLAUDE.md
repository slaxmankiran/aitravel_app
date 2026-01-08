# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VoyageAI is an AI-powered travel planning application that analyzes trip feasibility, generates personalized itineraries, and provides real-time travel insights. The core value proposition is the "Certainty Engine" - answering "Can I go? What will it truly cost? What's the plan?"

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (runs on port 3000) |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run check` | TypeScript type checking |
| `npm run db:push` | Push database schema changes with Drizzle |

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Radix UI
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL 15 (Docker container: `voyageai-postgres`) via Drizzle ORM
- **AI**: OpenAI SDK configured for Deepseek API
- **Routing**: Wouter (client), Express (server)
- **State**: React Query for data fetching

### Development Setup
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

# Start dev server (port 3000)
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" PORT=3000 npm run dev

# Push schema changes
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" npx drizzle-kit push
```

### Directory Structure
```
client/src/
  pages/           # Page components (Home, CreateTrip, TripDetails, etc.)
  components/      # Reusable UI components
  contexts/        # React contexts (AuthContext)
  hooks/           # Custom React hooks
  lib/             # Utilities (queryClient, etc.)

server/
  index.ts         # Express server entry point
  routes.ts        # Main API routes + trip processing logic
  storage.ts       # Database operations
  db.ts            # Database connection
  routes/          # Feature-specific route handlers
  services/        # Business logic (aiAgent, flightApi, hotelApi, agentChat)

shared/
  schema.ts        # Drizzle schema + Zod validation + TypeScript types
```

### Key Data Flow

1. **Trip Creation**: `POST /api/trips` → feasibility analysis → flight/hotel search → AI itinerary generation
2. **Progress Tracking**: In-memory `tripProgressStore` tracks multi-step processing; clients poll `/api/trips/:id/progress`
3. **AI Chat**: `/api/trips/:id/chat` for itinerary modifications via natural language

### Database Schema Highlights

- `trips` - Core trip data with feasibility reports and itineraries stored as JSONB
- `users` - Authentication with optional OAuth (Google, Apple)
- `tripConversations` - Chat history per trip
- `priceAlerts` - Flight/hotel price monitoring
- Drizzle config auto-selects SQLite (local) or PostgreSQL (DATABASE_URL)

### AI Integration

- Uses OpenAI SDK pointed at Deepseek API (`DEEPSEEK_API_KEY`)
- `server/services/aiAgent.ts` - Coordinates, attractions, cost estimates, destination intelligence
- `server/services/agentChat.ts` - Conversational itinerary modifications
- `server/routes.ts` - Feasibility analysis and itinerary generation prompts

### Certainty Score System (MVP)

The app calculates a 0-100 certainty score based on:
- Accessibility (0-25 pts)
- Visa requirements (0-30 pts) - weighted higher
- Safety (0-25 pts)
- Budget adequacy (0-20 pts)

Types defined in `shared/schema.ts`: `CertaintyScore`, `VisaDetails`, `VisaTiming`, `EntryCosts`, `TrueCostBreakdown`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | Yes | API key for AI (Deepseek/OpenAI-compatible) |
| `SERP_API_KEY` | No | SerpAPI for flight searches |
| `DATABASE_URL` | No | PostgreSQL connection (uses SQLite if not set) |
| `SQLITE_DB_PATH` | No | Custom SQLite path (default: ./dev.db) |

## API Patterns

- All API routes prefixed with `/api`
- Trip processing is async with progress polling
- Chat endpoints support itinerary modifications with confirmation flow
- Authentication uses cookie-based sessions

---

## Trip Results V1 (Mindtrip-style Layout)

### Status: Implemented and Tested (2026-01-08)

New premium trip results page with clean two-column layout, replacing the old timeline view.

**Route:** `/trips/:id/results-v1`

### Components Created

| Component | Location | Purpose |
|-----------|----------|---------|
| `DayCardList` | `client/src/components/results-v1/DayCardList.tsx` | Container for all day cards, handles analytics |
| `DayCard` | `client/src/components/results-v1/DayCard.tsx` | Single day with morning/afternoon/evening sections |
| `ActivityRow` | `client/src/components/results-v1/ActivityRow.tsx` | Activity row with time, name, cost, transport icon |
| `itinerary-adapters` | `client/src/components/results-v1/itinerary-adapters.ts` | Utilities: `getActivityKey`, `getTimeSlot`, `bucketActivities`, `extractCityFromTitle`, `calculateDistance`, `formatDistance`, `estimateWalkingTime` |
| `HeaderBar` | `client/src/components/results/HeaderBar.tsx` | Sticky header with destination, dates, actions |
| `CertaintyBar` | `client/src/components/results/CertaintyBar.tsx` | Visa status, certainty score, chips |
| `RightRailPanels` | `client/src/components/results/RightRailPanels.tsx` | Accordion panels: True Cost, Action Items, AI Chat |
| `PanelAccordion` | `client/src/components/results/PanelAccordion.tsx` | Collapsible panel component |

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ HeaderBar (sticky) - logo, destination, meta        │
├─────────────────────────────────────────────────────┤
│ CertaintyBar (sticky) - visa, score, chips          │
├──────────────────────────┬──────────────────────────┤
│ Left Column (7/12)       │ Right Column (5/12)      │
│                          │                          │
│ DayCardList              │ ItineraryMap (sticky)    │
│ - DayCard 1              │                          │
│   - Morning activities   │ RightRailPanels          │
│   - Afternoon activities │ - True Cost (open)       │
│   - Evening activities   │ - Action Items (open)    │
│ - DayCard 2              │ - AI Chat (closed)       │
│ - ...                    │                          │
└──────────────────────────┴──────────────────────────┘
```

### Analytics System

**Endpoint:** `POST /api/analytics/trip-events` (server/routes.ts:4620-4795)

**Client Helper:** `client/src/lib/analytics.ts`
- `trackTripEvent(tripId, event, data, context)` - fire-and-forget
- `buildTripContext(trip)` - extracts stable context from trip
- Uses `navigator.sendBeacon` with `fetch` fallback
- Client-side deduplication (one-shot for generate events, 500ms throttle for clicks)

**Canonical Events:**
| Event | When | Data |
|-------|------|------|
| `itinerary_generate_started` | Trip loads, still generating | `destination`, `passport` |
| `itinerary_generate_completed` | Itinerary appears | `certaintyScore`, `daysCount` |
| `day_clicked` | User clicks day header | `dayIndex` |
| `activity_clicked` | User clicks activity | `activityKey`, `dayIndex`, `timeSlot` |
| `map_marker_clicked` | User clicks map marker | `locationId` |
| `chat_opened` | AI chat panel opens | - |
| `chat_change_applied` | AI modifies itinerary | - |

**Context Fields:**
- `passport`, `destination`, `visaType`, `certaintyScore`, `travelStyle`, `isCurated`, `groupSize`

**Debug Endpoint:** `GET /api/analytics/trip-events?limit=200`
- Filters: `event`, `page`, `tripId`, `since`, `until`
- Returns: `aggregates.byEvent`, `aggregates.byPage`, `aggregates.byDestination`, `funnel`

### Key Features

1. **Time Slot Bucketing** - Activities grouped by morning (before 12), afternoon (12-17), evening (after 17)
2. **Activity Key Format** - `{dayNum}-{activityIndex+1}` for map sync
3. **Collapsible Days** - Click header to expand/collapse individual days
4. **Expand/Collapse All** - Global toggle with user override pattern (individual clicks take priority, global resets all)
5. **Distance Toggle** - Show/hide distances between activities with walking time estimates (< 5km only)
6. **Transport Icons** - Walk, metro, bus, car between activities
7. **Cost Badges** - "Free" or "$amount" per activity
8. **Hover Highlights** - Debounced 50ms, syncs with map markers
9. **Working Trip State** - Optimistic updates from AI chat
10. **Scrollable Left Column** - Sticky header with itinerary subtitle, scroll within viewport
11. **Phase Labels** - Smart city detection for Arrival/Departure/City Transition labels

### Test Results (2026-01-08)

Tested with India → Thailand trip (7 days, 26 activities):
- Page renders all days with correct structure
- Analytics events captured with full context
- Map sync works (activity click → marker highlight)
- No TypeScript errors
- No console errors

### Recent Fixes (2026-01-08)

| Issue | Solution | File |
|-------|----------|------|
| Map not displaying | Changed container to `absolute inset-0` for proper height | `ItineraryMap.tsx` |
| Phase labels showing day titles | Created `extractCityFromTitle` with KNOWN_CITIES list (Bangkok, Chiang Mai, etc.) | `itinerary-adapters.ts` |
| Unrealistic walk times (598km) | Only show walking time for distances < 5km | `ActivityRow.tsx` |
| Individual expand not working | Added `userOverride` state pattern - individual clicks take priority over global | `DayCard.tsx` |
| Left column not scrollable | Added `lg:max-h-[calc(100vh-160px)] lg:overflow-y-auto` with sticky header | `TripResultsV1.tsx` |
| Header overlay on scroll | Changed sticky header from gradient to solid `bg-slate-900` | `TripResultsV1.tsx` |
| Narrative subtitle too long | Created `generateNarrativeSubtitle` extracting actual city names | `TripResultsV1.tsx` |

### User Override Pattern (Expand/Collapse)

```tsx
// In DayCard.tsx - Individual expand takes priority over global
const [userOverride, setUserOverride] = useState<boolean | null>(null);

// Priority: user override > forceExpanded > default (true)
const isExpanded = userOverride !== null
  ? userOverride
  : (forceExpanded !== undefined ? forceExpanded : true);

// When global expand changes, reset user override so global takes effect
useEffect(() => {
  setUserOverride(null);
}, [forceExpanded]);
```

### City Extraction (Phase Labels)

Uses a KNOWN_CITIES list to detect actual city names from day titles:
- "Royal Grandeur & Market Marvels" → extracts "Bangkok" if mentioned
- Falls back to dash pattern matching: "Bangkok - Temple Tour" → "Bangkok"
- Only shows phase labels for: Arrival (day 1), Departure (last day), City Transitions

### Files Modified

- `client/src/pages/TripResultsV1.tsx` - Main page with scrollable container, expand/distance controls, narrative subtitle
- `client/src/components/results-v1/DayCard.tsx` - User override expand pattern, phase label detection
- `client/src/components/results-v1/DayCardList.tsx` - Container with global expand/collapse and distance toggle
- `client/src/components/results-v1/ActivityRow.tsx` - Distance display with walking time (< 5km only)
- `client/src/components/results-v1/itinerary-adapters.ts` - City extraction, distance utilities (Haversine formula)
- `client/src/components/ItineraryMap.tsx` - Fixed map container height with absolute positioning
- `client/src/App.tsx` - Route at `/trips/:id/results-v1`
- `server/routes.ts` - Trip events analytics endpoints (lines 4620-4795)

### Next Steps (Backlog)

- [ ] Dashboard endpoint: `GET /api/analytics/trip-results-dashboard`
- [ ] Add `panel_toggled` event for accordion opens
- [ ] Add `export_pdf_clicked`, `share_clicked` events when features exist
- [ ] Consider persisting events to database for production
- [ ] Improve city detection with more comprehensive KNOWN_CITIES list
- [ ] Add keyboard navigation for day cards (arrow keys)
