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

---

## ChatTripV2 UX Improvements (2026-01-08)

### Status: Implemented and Tested

Mindtrip-style chat planning interface with refined UX patterns.

**Route:** `/chat`

### Changes Implemented

#### 1. Quiet Mode (Priority 1)
Once user sets destination + passport (isReady), all narrative messages are suppressed.

```tsx
// ChatTripV2.tsx - One-way transition to quiet mode
const [enteredQuietMode, setEnteredQuietMode] = useState(false);

useEffect(() => {
  if (isReady && !enteredQuietMode) {
    setEnteredQuietMode(true);
  }
}, [isReady, enteredQuietMode]);

const addNarrativeMessage = (content: string) => {
  if (enteredQuietMode) return; // Suppress in quiet mode
  // ... add message
};
```

#### 2. Notes Input (Not Chat)
Input reframed as preference notes, not chat:
- Save-on-blur behavior (no send button)
- Checkmark icon for saving
- Toast feedback: "Preferences saved"
- Placeholder: "Optional notes (saved automatically)"

#### 3. TripSummaryPills Stateful Affordance
Visual state hierarchy:
| State | Appearance |
|-------|------------|
| Urgent (missing required) | Amber pulse, amber border |
| Complete | Checkmark icon, slate solid |
| Highlight (passport set) | Emerald background |
| Default | Dashed outline |

#### 4. Flexible Dates Intent Labels
Changed from mechanism to intent:
- "Dates" → "I know my dates"
- "Flexible" → "I'm flexible"
- "Month" → "Preferred month (optional)"

### Files Modified

| File | Changes |
|------|---------|
| `ChatTripV2.tsx` | Quiet mode, notes input with save-on-blur |
| `TripSummaryPills.tsx` | State hierarchy (urgent/complete/highlight) |
| `DatePickerModal.tsx` | Intent-framed labels |

---

## CertaintyBar Improvements (2026-01-08)

### Status: Implemented

Fixed display issues in the expandable visa details panel.

### Fixes

| Issue | Solution |
|-------|----------|
| "0 days" for visa-free | Shows "Instant" instead |
| Empty Requirements section | Shows "No visa required. Just bring your valid passport." for visa-free |

### Code Changes

```tsx
// CertaintyBar.tsx - Processing time
function getProcessingTime(processingDays) {
  if (processingDays.minimum === 0 && processingDays.maximum === 0) {
    return 'Instant'; // Instead of "0 days"
  }
  // ...
}

// Requirements section
{visaDetails.documentsRequired?.length > 0 ? (
  <ul>...</ul>
) : (
  <p>{visaDetails.type === 'visa_free'
    ? 'No visa required. Just bring your valid passport.'
    : 'No specific documents listed.'}</p>
)}
```

---

## Edit Trip Flow (2026-01-08, Updated 2026-01-11)

### Status: Implemented with Edit-in-Place

Edit updates the SAME trip ID (industry best practice) instead of creating duplicates.

### API Endpoint

**PUT /api/trips/:id** - Updates existing trip in place
- Validates trip exists and ownership via `x-voyage-uid` header
- Resets `feasibilityStatus`, `feasibilityReport`, `itinerary` on update
- Triggers background feasibility re-analysis

### Client Hook

**`useUpdateTrip()`** in `client/src/hooks/use-trips.ts`
- Sends PUT request with updated trip data
- Invalidates React Query cache for the trip
- Shows toast on error

### Edit Flow

**From Results Page:**
```
Results Page → [Edit trip details] → /create?editTripId=2&returnTo=...
                                           ↓
                                    CreateTrip (Edit Mode)
                                    - Uses useUpdateTrip() for existing trips
                                    - Same trip ID preserved
                                    - CTA: "Update & Re-check Feasibility"
                                           ↓
                                    FeasibilityResults?returnTo=...
                                           ↓
                                    Back to Results Page (same trip ID)
```

**From My Trips:**
```
My Trips → [3-dot menu] → Edit → /create?editTripId=X&returnTo=/trips
                                           ↓
                                    CreateTrip (Edit Mode)
                                           ↓
                                    FeasibilityResults
                                           ↓
                                    Trip Results Page (not back to My Trips)
```

### Files Modified

| File | Changes |
|------|---------|
| `server/storage.ts` | Added `updateTrip()` method to IStorage interface |
| `server/routes.ts` | Added `PUT /api/trips/:id` endpoint |
| `client/src/hooks/use-trips.ts` | Added `useUpdateTrip()` hook |
| `CreateTrip.tsx` | Uses update vs create based on `editTripId` |
| `FeasibilityResults.tsx` | Redirects to results (not My Trips) after edit |
| `HeaderBar.tsx` | "Trips" breadcrumb links to `/trips` |

### Key Behaviors

1. **Same Trip ID** - Edit updates existing record, no duplicates
2. **Smart Redirect** - From My Trips edit → goes to results page, not back to list
3. **Ownership Check** - Only trip owner (via voyage_uid) can edit

---

## "What Changed?" Banner (2026-01-09)

### Status: Implemented and Tested

Shows a subtle confirmation banner when user returns from the edit flow, indicating what changed and that feasibility was rechecked.

### Component

**`client/src/components/results/TripUpdateBanner.tsx`**

```tsx
const CHANGE_LABELS: Record<string, string> = {
  destination: "Destination updated",
  dates: "Dates changed",
  groupSize: "Travelers updated",
  travelStyle: "Style adjusted",
  budget: "Budget adjusted",
  passport: "Passport changed",
  origin: "Origin updated",
};
```

### Behavior

- **Placement**: Below HeaderBar, above CertaintyBar
- **Format**: "Trip updated · Dates changed · Budget adjusted · Feasibility rechecked"
- **Auto-dismiss**: After 5 seconds
- **Manual dismiss**: Click X button
- **No reappear**: Controlled by parent state (not URL persist)

### Data Flow

1. **CreateTrip.tsx**: Stores original trip snapshot on load via `originalTripRef`
2. **On submit**: Calculates diff between original and updated fields
3. **URL params**: Passes `?updated=1&changes=["dates","budget"]` to returnTo
4. **TripResultsV1.tsx**: Parses params, shows banner if `updated=1`

```
CreateTrip (Edit Mode)
  ↓ stores originalTripRef
  ↓ user modifies fields
  ↓ submit → diffTrip() → ["dates", "budget"]
  ↓
FeasibilityResults?returnTo=/trips/2/results-v1?updated=1&changes=...
  ↓
TripResultsV1
  ↓ parses URL params
  ↓ shows TripUpdateBanner
  ↓ auto-dismisses after 5s
```

### Files Modified

| File | Changes |
|------|---------|
| `TripUpdateBanner.tsx` | New component with auto-dismiss, motion animation |
| `CreateTrip.tsx` | `originalTripRef`, `pickComparableFields`, `diffTrip`, URL encoding |
| `TripResultsV1.tsx` | URL param parsing, `showUpdateBanner` state, banner render |

---

## Action Items: Required vs Recommended (2026-01-09)

### Status: Implemented and Tested

Split Action Items into blocking (Required) vs nice-to-have (Recommended) sections to improve trust in the Certainty Engine.

### Classification Rules

**Required (blocking - affects eligibility):**
- Visa application (if visa required)
- Passport validity (if expiring within 6 months)
- Mandatory vaccinations (if required for entry)
- Entry restrictions (health declarations, testing)

**Recommended (nice-to-have - improves trip):**
- Book flights
- Reserve accommodation
- Travel insurance
- Payment methods (notify bank, travel card)
- Mobile data (eSIM, local SIM)
- Packing

### UI Changes

- Header counts: "Required (2)", "Recommended (6)"
- "No blockers found" message with green checkmark when Required is empty
- Contextual status message:
  - Blockers present: Amber alert "2 items need attention before your trip"
  - No blockers: Green success "No blockers found. You're all set for planning!"
- Category-based sorting (required first, then by priority within category)

### Analytics Events

| Event | Data | When |
|-------|------|------|
| `action_items_viewed` | `requiredCount`, `recommendedCount`, `hasBlockers` | Panel mount |
| `action_item_clicked` | `key`, `type: required\|recommended`, `wasCompleted` | Item click |

### File Modified

| File | Changes |
|------|---------|
| `ActionItems.tsx` | Added `category` field, classification logic, header counts, analytics |

---

## Change Planner Agent (2026-01-09)

### Status: Design Spec Complete (Not Yet Implemented)

**Full Specification:** [`docs/CHANGE_PLANNER_AGENT_SPEC.md`](docs/CHANGE_PLANNER_AGENT_SPEC.md)

### Overview

Smart agent that detects user changes after seeing results, recomputes only impacted modules, and explains deltas in plain language.

### Core Capabilities

1. **Detect** what changed and what it breaks
2. **Recompute** only impacted parts (not the whole trip)
3. **Explain** delta in plain language (cost, visa, itinerary, certainty)
4. **Update** Action Items, Cost Breakdown, Itinerary with minimal UI churn
5. **Log** analytics for "change friction" and "replan success"

### Entry Points

| Entry Point | Description |
|-------------|-------------|
| Inline Edit | Edit in Results header → "Replanning…" → apply |
| Quick Chips | One-tap: "+3 days", "Cheaper options", "Add beach day" |
| Fix Blocker | "Fix blockers" CTA → smallest change to resolve |

### TypeScript Types (shared/schema.ts)

```typescript
// Core types added:
- ChangePlannerResponse     // Main agent output
- UserTripInput            // User's trip parameters
- DetectedChange           // Single change with impact
- RecomputePlan            // What to recompute
- DeltaSummary             // Before/after deltas
- UIInstructions           // How to render results
- FixOption                // Blocker fix suggestion

// Analytics types:
- TripChangeStartedEvent
- TripChangePlannedEvent
- TripChangeAppliedEvent
- TripChangeFailedEvent
- FixOptionEvent
```

### Implementation Plan

| Phase | Description | Files |
|-------|-------------|-------|
| 1 | Client hook | `client/src/hooks/useChangePlanner.ts` |
| 2 | Server endpoint | `server/routes/changePlan.ts` (`POST /api/change-plan`) |
| 3 | UI integration | `ChangePlanBanner.tsx`, section highlights, chips |

---

## Features & Functionalities Overview

### Core Value Proposition: "Certainty Engine"

> *Can I go? What will it truly cost? What's the plan?*

---

### Key Features

#### 1. Trip Planning

| Feature              | Description                                                                              |
|----------------------|------------------------------------------------------------------------------------------|
| Smart Trip Creation  | Destination autocomplete, date picker, traveler composition, budget, travel style        |
| Feasibility Analysis | Visa requirements, safety checks, budget validation, accessibility                       |
| Certainty Score      | 0-100 score based on visa (30pts), accessibility (25pts), safety (25pts), budget (20pts) |
| AI Itinerary         | Day-by-day plans with activities, costs, transport, local food recommendations           |

#### 2. AI Chat Assistant

| Feature                 | Description                                            |
|-------------------------|--------------------------------------------------------|
| Itinerary Modifications | "Add a cooking class", "Remove Day 3 morning activity" |
| Pending Changes         | Confirm/reject AI suggestions before applying          |
| Nearby Suggestions      | AI recommends attractions near your activities         |
| Quick Actions           | One-click activity swaps, duration changes             |

#### 3. Collaboration

| Feature              | Description                                      |
|----------------------|--------------------------------------------------|
| Invite Collaborators | Share via email with roles (owner/editor/viewer) |
| Comments             | Day-level and activity-level discussions         |
| Voting               | Thumbs up/down on activities                     |

#### 4. Travel Tools

| Feature          | Description                                        |
|------------------|----------------------------------------------------|
| Price Alerts     | Set target prices for flights/hotels, get notified |
| Packing Lists    | AI-generated based on climate & activities         |
| Weather Forecast | 7-14 day forecasts with packing tips               |
| Travel Insurance | Compare quotes from SafetyWing, Allianz, etc.      |

#### 5. Discovery

| Feature          | Description                                           |
|------------------|-------------------------------------------------------|
| Explore Page     | Browse by category (Beach, City, Adventure, Food)     |
| Inspiration Page | Pre-built trip templates (Cherry Blossom Japan, etc.) |
| Saved Places     | Bookmark attractions & templates                      |

#### 6. User Accounts

| Feature       | Description                                  |
|---------------|----------------------------------------------|
| Auth          | Email/password + Google/Apple OAuth          |
| Subscriptions | Free (3 trips/mo), Pro ($9.99/mo unlimited)  |
| Preferences   | Currency, home airport, travel style profile |

---

### User Flow Chart

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VOYAGEAI USER FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────┐
                                    │  START   │
                                    └────┬─────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
            ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
            │  Home Page   │    │   Explore    │    │ Inspiration  │
            │  (Landing)   │    │  (Browse)    │    │ (Templates)  │
            └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
                   │                   │                   │
                   └───────────────────┼───────────────────┘
                                       ▼
                              ┌────────────────┐
                              │  CREATE TRIP   │
                              │    /create     │
                              └────────┬───────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │         STEP 1: Passport            │
                    │         STEP 2: Destination + Dates │
                    │         STEP 3: Budget + Style      │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────┐
                         │   FEASIBILITY ANALYSIS  │
                         │   (AI Processing ~8s)   │
                         │                         │
                         │  • Visa requirements    │
                         │  • Safety assessment    │
                         │  • Budget validation    │
                         │  • Accessibility check  │
                         └────────────┬────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
      ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
      │  VERDICT:   │         │  VERDICT:   │         │  VERDICT:   │
      │     GO      │         │  POSSIBLE/  │         │     NO      │
      │  (Score 80+)│         │  DIFFICULT  │         │ (Blockers)  │
      └──────┬──────┘         └──────┬──────┘         └──────┬──────┘
             │                       │                       │
             │                       ▼                       ▼
             │               ┌─────────────┐         ┌─────────────┐
             │               │ ACTION ITEMS│         │ ALTERNATIVES│
             │               │ • Apply visa│         │ Suggested   │
             │               │ • Get insur.│         │ destinations│
             │               └──────┬──────┘         └─────────────┘
             │                      │
             └──────────────────────┼
                                    ▼
                     ┌──────────────────────────┐
                     │   GENERATE ITINERARY     │
                     │   (AI Processing ~15s)   │
                     │                          │
                     │  • Day-by-day activities │
                     │  • Cost breakdown        │
                     │  • Transport options     │
                     │  • Local food spots      │
                     └────────────┬─────────────┘
                                  │
                                  ▼
           ┌──────────────────────────────────────────────────┐
           │              TRIP RESULTS V1                     │
           │              /trips/:id/results-v1               │
           │                                                  │
           │  ┌─────────────────┐  ┌────────────────────────┐ │
           │  │  LEFT COLUMN    │  │     RIGHT COLUMN       │ │
           │  │                 │  │                        │ │
           │  │  Day Cards      │  │  📍 Interactive Map    │ │
           │  │  • Day 1        │  │                        │ │
           │  │    - Morning    │  │  💰 True Cost Panel    │ │
           │  │    - Afternoon  │  │                        │ │
           │  │    - Evening    │  │  ✅ Action Items       │ │
           │  │  • Day 2...     │  │                        │ │
           │  │                 │  │  💬 AI Chat Panel      │ │
           │  └─────────────────┘  └────────────────────────┘ │
           └──────────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
   │  REFINE     │        │ COLLABORATE │        │    BOOK     │
   │             │        │             │        │             │
   │ Chat with   │        │ Invite      │        │ Affiliate   │
   │ AI to       │        │ friends,    │        │ links:      │
   │ modify      │        │ comment,    │        │ • Flights   │
   │ itinerary   │        │ vote        │        │ • Hotels    │
   └─────────────┘        └─────────────┘        │ • Insurance │
                                                 └─────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
   │ PRICE ALERTS│        │ PACKING LIST│        │   WEATHER   │
   │             │        │             │        │             │
   │ Monitor     │        │ AI-generated│        │ 7-14 day    │
   │ flight/hotel│        │ based on    │        │ forecast    │
   │ prices      │        │ climate     │        │             │
   └─────────────┘        └─────────────┘        └─────────────┘
                                  │
                                  ▼
                          ┌─────────────┐
                          │  MY TRIPS   │
                          │   /trips    │
                          │             │
                          │ View all    │
                          │ past trips  │
                          └─────────────┘
```

---

### API Endpoints Summary

| Category      | Count | Key Endpoints                                         |
|---------------|-------|-------------------------------------------------------|
| Trips         | 9     | `POST /api/trips`, `GET /api/trips/:id`, `/progress`, `/chat`, `/my-trips` |
| Auth          | 9     | `/register`, `/login`, `/logout`, `/google`, `/apple` |
| Collaboration | 5     | `/collaborators`, `/comments`, `/votes`               |
| Price Alerts  | 4     | CRUD operations                                       |
| Analytics     | 8     | `/trip-events`, `/affiliate-click`, `/dashboard`      |
| Templates     | 4     | List, get, use, rate                                  |
| Versions      | 4     | `GET/POST /api/trips/:id/versions`, `/restore`        |

---

### Tech Stack Summary

| Layer    | Technology                                 |
|----------|--------------------------------------------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS |
| Backend  | Express + TypeScript                       |
| Database | PostgreSQL 15 (Drizzle ORM)                |
| AI       | Deepseek API (OpenAI SDK compatible)       |
| State    | React Query                                |
| Routing  | Wouter (client), Express (server)          |

---

## Share View (Phase 3.6) - Beta Complete (2026-01-11)

### Status: Implemented and Tested

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

### Layout Structure

```
┌──────────────────────────────────────────────────┐
│ ShareViewHeader (brand left, "Plan own trip" CTA)│
├──────────────────────────────────────────────────┤
│ Hero Section (destination, dates, travelers)     │
├──────────────────────────────────────────────────┤
│ CertaintyBar (visa status, score)                │
├──────────────────────────────────────────────────┤
│ Main Content                                      │
│ ┌────────────────────┬─────────────────────────┐ │
│ │ DayCardList        │ ItineraryMap (sticky)   │ │
│ │ - Day cards        │                         │ │
│ │ - Activities       │ CostSummaryCard         │ │
│ └────────────────────┴─────────────────────────┘ │
├──────────────────────────────────────────────────┤
│ PlanOwnCTA (sticky bottom bar)                   │
└──────────────────────────────────────────────────┘
```

### Key Implementation Details

1. **ResultsBackground as wrapper**: All content rendered as children of `ResultsBackground` for proper layering
2. **No duplicate destination**: Header shows only brand, destination appears only in hero
3. **ItineraryMap props**: Uses `trip={tripResponse}` interface, not individual location props
4. **Social crawler detection**: OG tags injected server-side before Vite transforms

### Test Checklist

- [x] `/share/:tripId` loads in incognito (no auth)
- [x] OG meta tags appear (curl test)
- [x] Map displays correctly
- [x] Day cards render with activities
- [x] Cost summary visible
- [x] "Plan your own trip" navigates to `/create`

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

### Regression Checklist (Verified)
- Results page loads normally (no blank screen from lazy import)
- Chat panel: Closed by default, loads with fallback, opens on demand
- Hover behavior: Map highlights change, no jitter
- Expand/Collapse all works
- Distances toggle works
- Map marker click scroll works

---

## Change Planner Agent - Full Implementation (2026-01-09)

### Status: Implemented and Tested

The Change Planner Agent is now fully implemented, enabling smart detection of user changes, selective recomputation, and delta explanation.

### Files Created

| File | Purpose |
|------|---------|
| `client/src/hooks/useChangePlanner.ts` | Client hook for change planning flow |
| `client/src/lib/tripInput.ts` | Build `UserTripInput` from `TripResponse` |
| `client/src/lib/uiEvents.ts` | Pub/sub for fix-blocker events |
| `client/src/lib/blockerDeltas.ts` | Compute resolved/new blockers from plan |
| `client/src/components/results/ChangePlanBanner.tsx` | Collapsible delta summary banner |
| `client/src/components/results/FixBlockersCTA.tsx` | "Fix blockers" button in ActionItems |
| `client/src/components/results/FixBlockersController.tsx` | Listens for fix events, calls planner |
| `server/routes/changePlan.ts` | `POST /api/change-plan` endpoint |
| `server/routes/fixOptions.ts` | `POST /api/trips/:id/fix-options` endpoint |
| `server/routes/appliedPlans.ts` | Persist/retrieve applied plans for sharing |

### Client Hook: useChangePlanner

```typescript
const { isReplanning, planChanges, applyChanges, resetPlan } = useChangePlanner();

// Plan a change
const plan = await planChanges({
  tripId,
  prevInput,
  nextInput,
  currentResults: workingTrip,
  source: "fix_blocker",
});

// Apply the plan (patches workingTrip, shows banner)
applyChanges({
  tripId,
  plan,
  setWorkingTrip,
  setBannerPlan,
  source: "fix_blocker",
});
```

### Change Plan Banner

Shows after any change is applied:
- Certainty delta: "+8% certainty" (green) or "-5% certainty" (red)
- Cost delta: "+$150" or "-$200"
- Blocker chips: "2 resolved", "1 new"
- Actions: Undo, Compare, Share, Dismiss

### Undo Support

- `UndoContext` stores `prevInput`/`nextInput` for 60 seconds
- Undo swaps inputs and re-runs change planner
- Certainty history updated on each change

### Shareable Links

- Applied plans persisted to `/api/trips/:id/applied-plans`
- URL format: `/trips/2/results-v1?plan=chg_abc123`
- Shared link restores banner on page load

### Analytics Events

| Event | When |
|-------|------|
| `trip_change_started` | Change initiated |
| `trip_change_planned` | Plan computed |
| `trip_change_applied` | Plan applied to UI |
| `trip_change_failed` | Error during planning |
| `trip_change_undo_clicked` | User clicks Undo |
| `trip_change_undo_applied` | Undo completed |

---

## Compare Plans Feature - Item 15 (2026-01-09)

### Status: Implemented and Tested

Side-by-side comparison modal showing original vs updated trip after changes.

### Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/comparePlans.ts` | Compute `PlanComparison` from two trips |
| `client/src/components/results/ComparePlansModal.tsx` | Modal with side-by-side comparison |

### Comparison Data

```typescript
interface PlanComparison {
  isComparable: boolean;
  incomparableReason?: string;
  totalCostDelta: { before, after, delta, direction };
  certaintyDelta: {
    before, after, delta, direction,
    visaRiskBefore, visaRiskAfter,
    bufferDaysBefore, bufferDaysAfter
  };
  costDeltas: Array<{ category, before, after, delta, direction }>;
  planA: { tripId, dates, budget, destination };
  planB: { tripId, dates, budget, destination };
}
```

### Modal Features

- **Header**: "Compare Plans" with close button
- **Two columns**: Plan A (Original) vs Plan B (Current)
- **Sections**:
  - Trip details (dates, budget, destination)
  - Certainty score with delta badge
  - Cost breakdown by category
  - Visa risk indicator
- **Actions**: "Keep Updated" (default), "Revert to Original"

### Accessibility

- Focus trapped inside modal
- Escape key closes
- Focus returns to trigger button on close

---

## Auto-suggest Next Fix - Item 16 (2026-01-09)

### Status: Implemented and Tested

Deterministic rule engine that suggests the next improvement action after a plan change.

### Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/nextFix.ts` | Rule engine for suggestions |
| `client/src/lib/applyFix.ts` | Dispatcher for fix actions |

### Rule Priority (First Match Wins)

1. **Visa risk high** or **buffer days < 5** → ADD_BUFFER_DAYS
2. **Cost increased > $150** → REDUCE_COST (with dominant category)
3. **Certainty dropped > 5%** → IMPROVE_CERTAINTY
4. **Missing cost data** → REFRESH_PRICING
5. **All stable** → SAVE_VERSION

### Suggestion Types

```typescript
type FixId =
  | "ADD_BUFFER_DAYS"    // APPLY_PATCH: extend dates
  | "REDUCE_COST"        // OPEN_EDITOR: budget/hotels
  | "LOWER_VISA_RISK"    // OPEN_EDITOR: visa_docs
  | "SIMPLIFY_ITINERARY" // OPEN_EDITOR: itinerary
  | "IMPROVE_CERTAINTY"  // OPEN_EDITOR: itinerary
  | "REFRESH_PRICING"    // TRIGGER_FLOW: refetch
  | "SAVE_VERSION"       // TRIGGER_FLOW: save_trip
  | "REVERT_CHANGE";     // TRIGGER_FLOW: undo_change
```

### Confidence Levels

| Level | Trigger |
|-------|---------|
| High | Visa risk high, buffer < 3 days, cost > $300, certainty drop > 10% |
| Medium | Visa risk medium, buffer < 5 days, cost > $150, certainty drop > 5% |
| Low | Neutral suggestions, generic fixes |

### UI in ChangePlanBanner

- Lightbulb icon with suggestion title
- Impact chips: "+3 days", "-$200"
- "Apply" button (disabled while applying)
- "Snooze" button (hides until next change)
- "Why?" tooltip with reason

### Sanity Checks

- **Dedupe events**: Track last shown suggestion key in ref
- **Idempotent apply**: `isApplyingFix` state prevents double-clicks
- **Snooze for session**: Resets on new changeId

---

## Apply Fix Dispatcher - Item 16B (2026-01-09)

### Status: Implemented and Tested

Dispatcher that routes fix suggestions to their implementations.

### Action Types

| Type | Behavior |
|------|----------|
| `APPLY_PATCH` | Routes through change planner for undo support |
| `OPEN_EDITOR` | Scrolls to relevant section |
| `TRIGGER_FLOW` | Executes flow (undo, refresh, save) |

### ApplyFixContext

```typescript
interface ApplyFixContext {
  tripId: number;
  trip: TripResponse;
  planChanges: (...) => Promise<ChangePlannerResponse>;
  applyChanges: (...) => void;
  setWorkingTrip: (...) => void;
  setBannerPlan: (...) => void;
  handleUndo?: () => Promise<void>;
  refetchTrip?: () => Promise<void>;
  openEditor?: (target: EditorTarget) => void;
  showToast?: (message, type) => void;
}
```

### Implemented Flows

| FixId | Implementation |
|-------|----------------|
| `ADD_BUFFER_DAYS` | `buildBufferDaysPatch()` → change planner |
| `REDUCE_COST` | Scroll to cost-breakdown section |
| `LOWER_VISA_RISK` | Scroll to action-items section |
| `REFRESH_PRICING` | `queryClient.invalidateQueries()` |
| `SAVE_VERSION` | Toast "Trip saved" |
| `REVERT_CHANGE` | Call `handleUndo()` |

### Production Hardening

1. **Query key fix**: Uses `[api.trips.get.path, tripId]` (matches use-trips.ts)
2. **Certainty from planner**: `result.newCertaintyScore` from `plan.deltaSummary.certainty.after`
3. **data-section attributes**: Added to HeaderBar, RightRailPanels, DayCardList for scroll targeting

### data-section Attributes

| Section | Selector |
|---------|----------|
| Header | `data-section="header-bar"` |
| Cost Breakdown | `data-section="cost-breakdown"` |
| Action Items | `data-section="action-items"` |
| Itinerary | `data-section="day-card-list"` |

---

## Certainty Explanation Drawer (2026-01-09)

### Status: Implemented

Expandable drawer showing detailed certainty score breakdown.

### File Created

`client/src/components/results/CertaintyExplanationDrawer.tsx`

### Features

- Triggered from CertaintyBar score click
- Shows breakdown by category (Visa, Safety, Budget, Accessibility)
- Displays change deltas when plan is applied
- Animated slide-up from bottom

---

## Certainty Timeline (2026-01-09)

### Status: Implemented

Visual timeline showing certainty score evolution across changes.

### File Created

`client/src/components/results/CertaintyTimeline.tsx`

### Features

- Shows up to 5 most recent certainty points
- Color-coded: green (increase), red (decrease), gray (neutral)
- Labels: "Initial", "Undo", change source
- Displayed in CertaintyBar on hover/click

---

## Version History - Item 18 (2026-01-09)

### Status: Implemented

Full specification: [`docs/VERSION_HISTORY_IMPLEMENTATION.md`](docs/VERSION_HISTORY_IMPLEMENTATION.md)

### Overview

Trip version history enables users to see a timeline of changes, restore previous versions, and export any version as PDF.

### Files Created

| File | Purpose |
|------|---------|
| `shared/schema.ts` | `tripVersions` table + TypeScript types |
| `server/routes/versions.ts` | API endpoints: create, list, get, restore |
| `client/src/hooks/useTripVersions.ts` | React hook for version operations |
| `client/src/components/results/VersionsPanel.tsx` | UI panel in right rail |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trips/:id/versions` | POST | Create/upsert version |
| `/api/trips/:id/versions` | GET | List versions (newest first) |
| `/api/trips/:id/versions/:versionId` | GET | Get single version with snapshot |
| `/api/trips/:id/versions/:versionId/restore` | POST | Restore a version |

### Version Sources

| Source | When Created |
|--------|--------------|
| `change_plan` | Change Planner applies changes |
| `next_fix` | Fix suggestion applied |
| `manual_save` | User clicks "Save" (future) |
| `restore` | Version restored |
| `system` | Auto-save (future) |

### Export Integration

Export any version as PDF: `/trips/:id/export?version=<versionId>`

---

## Certainty Breakdown - Item 20 (2026-01-09)

### Status: Implemented

Full specification: [`docs/CERTAINTY_BREAKDOWN_IMPLEMENTATION.md`](docs/CERTAINTY_BREAKDOWN_IMPLEMENTATION.md)

### Overview

Visual breakdown explaining *why* a trip has its certainty score. Shows 4 weighted factors with progress bars and status indicators.

### Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/certaintyBreakdown.ts` | Types + `buildCertaintyBreakdown()` function |
| `client/src/components/results/CertaintyBreakdown.tsx` | UI component with animated bars |

### Files Modified

| File | Changes |
|------|---------|
| `client/src/components/results/CertaintyBar.tsx` | Added breakdown to expandable section |
| `client/src/pages/TripExport.tsx` | Added "Why This Certainty Score?" PDF section |

### Certainty Factors

| Factor | Weight | Source |
|--------|--------|--------|
| `visa_timing` | 35% | `visaDetails.timing.urgency` |
| `buffer_days` | 25% | Days until trip vs processing time |
| `cost_stability` | 25% | `feasibility.breakdown.budget.status` |
| `itinerary_density` | 15% | Activities per day (ideal: 3-5) |

### Usage

```tsx
import { buildCertaintyBreakdown } from "@/lib/certaintyBreakdown";
import { CertaintyBreakdown } from "@/components/results/CertaintyBreakdown";

const breakdown = useMemo(() => buildCertaintyBreakdown(trip), [trip]);

<CertaintyBreakdown
  factors={breakdown.factors}
  totalScore={breakdown.totalScore}
/>
```

---

## Files Summary (Recent Sessions)

### New Files Created

```
client/src/lib/
  applyFix.ts           # Fix dispatcher
  nextFix.ts            # Rule engine
  comparePlans.ts       # Plan comparison
  blockerDeltas.ts      # Blocker diff
  tripInput.ts          # Build UserTripInput
  uiEvents.ts           # Pub/sub events
  certaintyExplain.ts   # Certainty explanation drawer
  certaintyBreakdown.ts # Item 20: Factor breakdown + buildCertaintyBreakdown()
  actionItems.ts        # Action item helpers
  voyageUid.ts          # Item 21: Anonymous user ID helper
  verdict.ts            # Phase 1: computeVerdict(), buildVerdictInput(), display helpers
  verdict.test.ts       # Phase 1: 25 unit tests for verdict rules

client/src/components/results/
  ChangePlanBanner.tsx         # Delta banner with suggestions
  ComparePlansModal.tsx        # Side-by-side comparison
  CertaintyBreakdown.tsx       # Item 20: Factor bars UI
  CertaintyExplanationDrawer.tsx
  CertaintyTimeline.tsx
  FixBlockersCTA.tsx
  FixBlockersController.tsx
  TripUpdateBanner.tsx
  VersionsPanel.tsx            # Version history panel
  VerdictCard.tsx              # Phase 1: GO/POSSIBLE/DIFFICULT verdict UI
  ResultsSkeletons.tsx         # Streaming: Section-level skeleton components

client/src/hooks/
  useChangePlanner.ts
  usePlanningMode.ts
  useTripVersions.ts           # Version history hook

server/routes/
  changePlan.ts         # POST /api/change-plan
  fixOptions.ts         # POST /api/trips/:id/fix-options
  appliedPlans.ts       # GET/POST /api/trips/:id/applied-plans
  versions.ts           # Version history endpoints + ownership checks
```

### Modified Files

```
client/src/pages/TripResultsV1.tsx    # Main integration, verdict, skeletons, budget delta
client/src/pages/MyTrips.tsx          # Item 21: TripSummary, empty state banner
client/src/pages/CreateTrip.tsx       # "Trip saved!" toast
client/src/pages/ChatTripV2.tsx       # "Trip saved!" toast
client/src/components/results/RightRailPanels.tsx  # data-section, BudgetAlert component
client/src/components/results/HeaderBar.tsx        # data-section
client/src/components/results/ActionItems.tsx      # FixBlockersCTA
client/src/hooks/useTripViewModel.ts  # BudgetStatus type, budget delta fields
client/src/lib/queryClient.ts         # Item 21: voyage headers on all requests
client/src/hooks/use-trips.ts         # Item 21: voyage headers
shared/schema.ts                      # Change planner types, voyageUid column
server/routes.ts                      # Analytics, /api/my-trips, ownership checks
server/storage.ts                     # listTripsByUid(), adoptTrip()
```

---

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

### Files Modified

| File | Changes |
|------|---------|
| `server/storage.ts` | Added `adoptTrip()` method to interface + implementations |
| `server/routes.ts` | Ownership check + soft backfill on GET /api/trips/:id |
| `server/routes/versions.ts` | Added `checkTripOwnership()` helper, applied to all 4 endpoints |
| `client/src/pages/MyTrips.tsx` | Empty state banner with localStorage notice |
| `client/src/pages/CreateTrip.tsx` | Added useToast import + "Trip saved!" notification |
| `client/src/pages/ChatTripV2.tsx` | Added "Trip saved!" notification |

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

## Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Planning Loop | ✅ Complete | Feasibility → Itinerary → Results |
| Compare Plans | ✅ Complete | Side-by-side modal |
| Guided Fixes | ✅ Complete | Auto-suggest next fix |
| Versions | ✅ Complete | Version history panel |
| Exports | ✅ Complete | PDF with certainty breakdown |
| My Trips | ✅ Complete | Account-lite with voyage_uid |
| Ownership Guards | ✅ Complete | Soft security for trips |
| **Phase 1: Verdict System** | ✅ Complete | GO/POSSIBLE/DIFFICULT with override rules |
| **Streaming Skeletons** | ✅ Complete | Progressive reveal, no blank screens |
| **Budget Alerts** | ✅ Complete | Decision-grade right rail with suggestion chips |

### Production Checklist

- [x] Anonymous user tracking (voyage_uid)
- [x] Trip ownership isolation
- [x] Soft backfill for legacy trips
- [x] Empty state UX for new devices
- [x] "Trip saved" confirmation toast
- [ ] Database migration for voyageUid column (run `drizzle-kit push`)
- [ ] Optional: Email capture for cross-device persistence

---

## Phase 1: Verdict System (2026-01-10)

### Status: Implemented and Tested

The Verdict System provides a single source of truth for trip feasibility verdicts (GO / POSSIBLE / DIFFICULT).

### Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/verdict.ts` | Core `computeVerdict()` function, `buildVerdictInput()`, display helpers |
| `client/src/lib/verdict.test.ts` | 25 unit tests covering all rules and edge cases |
| `client/src/components/results/VerdictCard.tsx` | UI component with full and compact variants |

### Verdict Rules

**Base Score Thresholds:**
| Score Range | Base Verdict |
|-------------|--------------|
| 80-100 | GO |
| 50-79 | POSSIBLE |
| 0-49 | DIFFICULT |

**Override Rules (Applied in Priority Order):**

| Rule | Condition | Result |
|------|-----------|--------|
| VISA_TIMING_BLOCKER | Visa min days > days until travel | → DIFFICULT |
| VISA_HIGH_RISK | visaRisk = 'high' | GO → POSSIBLE |
| OVER_BUDGET_50 | cost > budget × 1.5 | → DIFFICULT |
| OVER_BUDGET_20 | cost > budget × 1.2 | GO → POSSIBLE |
| SAFETY_L3_PLUS | safetyLevel ≥ 3 | → DIFFICULT |
| UNDER_7_DAYS_VISA | < 7 days + visa required | GO → POSSIBLE |

### Types

```typescript
export type Verdict = 'GO' | 'POSSIBLE' | 'DIFFICULT';

export interface VerdictResult {
  verdict: Verdict;
  score: number;
  overridesApplied: OverrideId[];
  reasons: string[];
  riskFlags: RiskFlags;
  budgetDelta: number;
  budgetRatio: number;
}
```

### Integration in TripResultsV1.tsx

```tsx
import { computeVerdict, buildVerdictInput } from "@/lib/verdict";
import { VerdictCard } from "@/components/results/VerdictCard";

// In component:
const verdictResult = useMemo(() => {
  if (!workingTrip) return null;
  const verdictInput = buildVerdictInput(trip, travelDate);
  return computeVerdict(verdictInput);
}, [workingTrip]);

// In JSX (above itinerary):
{verdictResult && <VerdictCard verdictResult={verdictResult} />}
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

## Phase 1.5: Right Rail Decision Grade (2026-01-10)

### Status: Implemented

Enhanced the True Cost sidebar to feel "decision grade" with prominent budget alerts and suggestion chips.

### Budget Status Type

```typescript
export type BudgetStatus = 'under' | 'near' | 'over20' | 'over50';
```

### Budget Delta Calculation

Added to `costs` memo in `TripResultsV1.tsx`:

```typescript
const costs = useMemo(() => {
  // ... existing cost extraction ...

  const overByAmount = grand - userBudget;
  const overByPercent = userBudget > 0 ? (overByAmount / userBudget) * 100 : 0;

  let budgetStatus: BudgetStatus = 'under';
  if (overByPercent >= 50) budgetStatus = 'over50';
  else if (overByPercent >= 20) budgetStatus = 'over20';
  else if (overByPercent > -10) budgetStatus = 'near';

  return {
    // ... existing fields ...
    userBudget,
    overByAmount,
    overByPercent,
    budgetStatus,
  };
}, [workingTrip]);
```

### BudgetAlert Component

Added to `RightRailPanels.tsx`:

| Budget Status | Alert Color | Suggestion Chips |
|---------------|-------------|------------------|
| `over20` | Amber | "Cheaper hotels", "Fewer activities", "Local food" |
| `over50` | Red | "Fewer days", "Budget hotels", "Skip flights" |

### Files Modified

| File | Changes |
|------|---------|
| `client/src/pages/TripResultsV1.tsx` | Budget delta in costs memo, improved date parsing |
| `client/src/hooks/useTripViewModel.ts` | Added `BudgetStatus` type and budget fields |
| `client/src/components/results/RightRailPanels.tsx` | Added `BudgetAlert` component |

### Date Parsing Improvement

Fixed parsing for formats like "Dec 15-22, 2025":

```typescript
// Strategy 1: ISO format "2025-12-15"
// Strategy 2: Month range "Dec 15-22, 2025" → "Dec 15, 2025"
// Strategy 3: Full date range "May 15, 2025 - May 22, 2025"
// Strategy 4: Native Date parsing fallback
```

### Small Fixes

- Replaced em dash `'—'` with `'...'` in itinerary title fallback

---

## Chip-to-Chat Flow (2026-01-10)

### Status: Implemented

Budget suggestion chips now open the AI chat panel with a prefilled prompt.

### How It Works

1. User sees BudgetAlert (when over budget by 20%+ or 50%+)
2. Clicks a suggestion chip (e.g., "Cheaper hotels")
3. Chat panel auto-opens via `forceOpen` prop
4. Input prefilled with actionable prompt
5. User can edit and send

### Files Modified

| File | Changes |
|------|---------|
| `client/src/components/TripChat.tsx` | Added `prefillMessage` prop |
| `client/src/components/results/PanelAccordion.tsx` | Added `forceOpen` prop for programmatic open |
| `client/src/components/results/RightRailPanels.tsx` | Added `handleBudgetSuggestion`, state management, wiring |

### Prompt Mappings

```typescript
const SUGGESTION_PROMPTS: Record<string, string> = {
  'Fewer days': 'Reduce the trip by 1-2 days to lower costs. Keep the best experiences.',
  'Budget hotels': 'Switch all accommodations to budget-friendly hotels or hostels. Keep the same itinerary.',
  'Skip flights': 'Remove internal flights and use ground transport (bus, train) instead to save money.',
  'Cheaper hotels': 'Find more affordable hotel options while keeping the same locations and dates.',
  'Fewer activities': 'Remove some paid activities and suggest free alternatives. Focus on must-see attractions.',
  'Local food': 'Replace expensive restaurants with local street food and casual eateries to reduce food costs.',
};
```

---

## Budget Parsing Fix (2026-01-10)

### Status: Implemented

Fixed budget parsing to handle string formats like `"$2,000"` or `"2000.50"`.

### Files Modified

| File | Line | Fix |
|------|------|-----|
| `client/src/hooks/useTripViewModel.ts` | 197-200 | Robust parsing |
| `client/src/pages/TripResultsV1.tsx` | 1070-1073 | Same robust parsing |

### Code Pattern

```typescript
// Robust budget parsing: handle strings like "2000", "$2,000", "2000.50"
const userBudget = typeof trip.budget === 'number'
  ? trip.budget
  : Number(String(trip.budget || '').replace(/[^\d.]/g, '')) || 0;
```

---

## Phase 1 + 1.5 Complete (2026-01-10)

All exit criteria satisfied:

- ✅ Verdict system with 6 override rules (25 tests passing)
- ✅ Streaming skeletons for progressive reveal
- ✅ Budget alerts with severity levels and suggestion chips
- ✅ Chip-to-chat flow (chips open AI panel with prefilled prompt)
- ✅ Robust budget parsing in both view model and page

**Ready for Phase 2**: Activity images, distance display reliability, preference capture

---

## Edit-in-Place Implementation (2026-01-11)

### Status: Implemented and Tested

Updated edit flow to UPDATE existing trips instead of creating duplicates.

### Files Modified

| File | Changes |
|------|---------|
| `client/src/hooks/use-trips.ts` | Added `useUpdateTrip()` hook |
| `client/src/pages/CreateTrip.tsx` | Uses update vs create based on editTripId |
| `client/src/pages/FeasibilityResults.tsx` | Handles returnTo param redirect |
| `client/src/components/results/HeaderBar.tsx` | Edit link with returnTo encoding |

### useUpdateTrip Hook

```typescript
export function useUpdateTrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CreateTripRequest }) => {
      const payload = {
        ...data,
        budget: Number(data.budget),
        groupSize: Number(data.groupSize),
        adults: Number(data.adults) || 1,
        children: Number(data.children) || 0,
        infants: Number(data.infants) || 0,
      };
      const validated = api.trips.create.input.parse(payload);
      const res = await fetch(`/api/trips/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getVoyageHeaders() },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return api.trips.create.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.trips.get.path, data.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
    },
    onError: (error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });
}
```

### Edit Flow Logic

In CreateTrip.tsx:
- When `editTripId` param present: uses PUT to update existing trip
- When no editTripId: uses POST to create new trip
- Smart redirect: If returnTo=/trips, redirects to results-v1 page instead

### Redirect Fix

```typescript
// In handleSuccess()
if (decodedReturnTo === '/trips' || decodedReturnTo === '/trips/') {
  // Editing from My Trips page - redirect to results, not back to list
  finalReturnTo = `/trips/${tripId}/results-v1?updated=1${changesParam}`;
} else {
  finalReturnTo = `${decodedReturnTo}?updated=1${changesParam}`;
}
```

---

## UI Improvements (2026-01-11)

### Status: Implemented

Various UI refinements based on user feedback.

### 1. Trips Breadcrumb Link

Made "Trips" in HeaderBar breadcrumb a clickable link to My Trips page.

```tsx
// client/src/components/results/HeaderBar.tsx
<Link href="/trips" className="shrink-0 hover:text-white/70 transition-colors">
  Trips
</Link>
```

### 2. Passport/Nationality Pill

Added nationality display in trip results hero with proper adjective formatting.

**File**: `client/src/pages/TripResultsV1.tsx`

```typescript
const NATIONALITY_MAP: Record<string, string> = {
  'India': 'Indian',
  'United States': 'American',
  'USA': 'American',
  'United Kingdom': 'British',
  'UK': 'British',
  'Canada': 'Canadian',
  // ... 40+ countries mapped
};

function getNationalityAdjective(country: string): string {
  if (NATIONALITY_MAP[country]) return NATIONALITY_MAP[country];
  // Case-insensitive fallback
  for (const [key, value] of Object.entries(NATIONALITY_MAP)) {
    if (key.toLowerCase() === country.toLowerCase()) return value;
  }
  return country;
}
```

Usage in hero:
```tsx
{passport && (
  <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
    <Flag className="w-4 h-4" />
    <span>{getNationalityAdjective(passport)} Passport</span>
  </div>
)}
```

### 3. Activity Cost Icons Removed

Removed Coins icon from activity cost badges in `ActivityRow.tsx`. Now shows clean "Free" or price text only.

### 4. Glass Design for DayCard

Updated DayCard background to match glass design system:

```tsx
// client/src/components/results-v1/DayCard.tsx
"bg-slate-900/50 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
```

### 5. Distances Toggle Fix

Fixed toggle to actually control distance display + improved UI to on/off switch:

**ActivityRow.tsx fix**:
```typescript
const shouldShowTransport = showTransport && showDistance &&
  (distanceFromPrevious !== null || activity.transportMode);
```

**Toggle UI in TripResultsV1.tsx**:
```tsx
<button onClick={() => setShowDistances(!showDistances)} className="flex items-center gap-2...">
  <Route className="w-3 h-3 text-white/50" />
  <span className="text-white/60">Distances</span>
  <div className={`relative w-7 h-4 rounded-full transition-colors ${
    showDistances ? 'bg-emerald-500' : 'bg-white/20'
  }`}>
    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
      showDistances ? 'translate-x-3.5' : 'translate-x-0.5'
    }`} />
  </div>
</button>
```

### 6. Cross-Slot Distance Calculation

Fixed distances to show across time slots (morning → afternoon → evening):

```tsx
// client/src/components/results-v1/DayCard.tsx
const renderTimeSlot = (
  slot: TimeSlot,
  activities: typeof day.activities,
  lastActivityFromPreviousSlot: typeof day.activities[0] | null
) => { /* ... */ };

const getLastActivity = (activities: typeof day.activities) =>
  activities.length > 0 ? activities[activities.length - 1] : null;

// Usage:
{renderTimeSlot("morning", buckets.morning, null)}
{renderTimeSlot("afternoon", buckets.afternoon, getLastActivity(buckets.morning))}
{renderTimeSlot("evening", buckets.evening,
  getLastActivity(buckets.afternoon) || getLastActivity(buckets.morning))}
```
