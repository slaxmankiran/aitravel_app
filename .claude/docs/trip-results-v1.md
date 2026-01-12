# Trip Results V1 (Mindtrip-style Layout)

## Status: Implemented and Tested (2026-01-08)

New premium trip results page with clean two-column layout, replacing the old timeline view.

**Route:** `/trips/:id/results-v1`

## Components Created

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

## Layout Structure

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

## Analytics System

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

## Key Features

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

## User Override Pattern (Expand/Collapse)

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

## City Extraction (Phase Labels)

Uses a KNOWN_CITIES list to detect actual city names from day titles:
- "Royal Grandeur & Market Marvels" → extracts "Bangkok" if mentioned
- Falls back to dash pattern matching: "Bangkok - Temple Tour" → "Bangkok"
- Only shows phase labels for: Arrival (day 1), Departure (last day), City Transitions

## Files Modified

- `client/src/pages/TripResultsV1.tsx` - Main page with scrollable container, expand/distance controls, narrative subtitle
- `client/src/components/results-v1/DayCard.tsx` - User override expand pattern, phase label detection
- `client/src/components/results-v1/DayCardList.tsx` - Container with global expand/collapse and distance toggle
- `client/src/components/results-v1/ActivityRow.tsx` - Distance display with walking time (< 5km only)
- `client/src/components/results-v1/itinerary-adapters.ts` - City extraction, distance utilities (Haversine formula)
- `client/src/components/ItineraryMap.tsx` - Fixed map container height with absolute positioning
- `client/src/App.tsx` - Route at `/trips/:id/results-v1`
- `server/routes.ts` - Trip events analytics endpoints (lines 4620-4795)
