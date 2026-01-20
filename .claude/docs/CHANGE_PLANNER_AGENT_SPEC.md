# Change Planner Agent - Design Specification

**Version:** 1.0
**Status:** Approved Design (Not Yet Implemented)
**Created:** 2026-01-09
**Last Updated:** 2026-01-09

---

## Overview

### Goal

When a user changes anything after seeing results (dates, budget, origin, destination, passport, travelers, pace, interests), the Change Planner Agent:

1. **Detects** what changed and what it breaks
2. **Recomputes** only the impacted parts (not the whole trip blindly)
3. **Explains** the delta in plain language (cost delta, visa delta, itinerary delta, certainty delta)
4. **Updates** Action Items, Cost Breakdown, and Itinerary with minimal UI churn
5. **Logs** analytics so we can measure "change friction" and "replan success"

### Design Principles

- **Deterministic outputs** - Same inputs always produce same change plan
- **Partial failure resilience** - UI should render deltaSummary even if some modules fail
- **Minimal churn** - Only affected sections update, not full page reload
- **Cost-aware caching** - Invalidate only what changed

---

## UX Entry Points

### A) Inline Change Trigger (Primary)

User edits inputs in the Results header bar (or "Edit trip" drawer).

**Flow:**
1. User modifies field(s)
2. On save → Show slim "Replanning…" state
3. Agent computes change plan
4. Apply changes with animations

### B) Quick Tweak Chips (Secondary)

Small one-tap edits that call the agent:

| Chip | Effect |
|------|--------|
| "Shift trip +3 days" | Adjusts dates |
| "Cheaper options" | Lowers budget threshold |
| "More relaxed pace" | Changes pace preference |
| "Add beach day" | Adds interest/activity |
| "Remove museums" | Removes interest |
| "Avoid long drives" | Adds constraint |

### C) Fix-a-Blocker CTA (Required Items)

When Required action items exist:

- **CTA:** "Fix blockers"
- **Agent behavior:** Suggests the smallest change that resolves blockers
  - Change date window
  - Choose alternate destination
  - Choose e-visa friendly route

---

## Change Types and Impact Matrix

### Supported Change Inputs

| Field | Examples |
|-------|----------|
| `dates` | start, end, duration |
| `budget` | total, per-person |
| `origin` | city/airport |
| `destination` | city/country |
| `passport` | nationality |
| `travelers` | count, adults/children |
| `preferences` | pace, interests, hotel class |
| `constraints` | "no red-eye", "no layovers > X", "kid friendly", "wheelchair accessible" |

### Impact Matrix (What to Recompute)

| Changed Field | Visa | Flights | Hotels | Itinerary | Certainty | Action Items |
|---------------|------|---------|--------|-----------|-----------|--------------|
| dates | ⚠️* | ✓ | ✓ | ✓ | ✓ | ✓ |
| budget | ✗ | ✗ | ⚠️** | ⚠️** | ✓ | ✓ |
| origin | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| destination | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| passport | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| travelers | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ |
| preferences | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| constraints | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |

*⚠️ Visa: Only if date window affects entry rules or processing windows
**⚠️ Budget: May re-rank hotels/itinerary cost choices, not full recompute

---

## Agent Output Contract

### Primary Response Type

```typescript
type ChangePlannerResponse = {
  changeId: string;

  detectedChanges: Array<{
    field:
      | "dates"
      | "budget"
      | "origin"
      | "destination"
      | "passport"
      | "travelers"
      | "preferences"
      | "constraints";
    before: any;
    after: any;
    impact: Array<"visa" | "flights" | "hotels" | "itinerary" | "certainty" | "action_items">;
    severity: "low" | "medium" | "high";
  }>;

  recomputePlan: {
    modulesToRecompute: Array<"visa" | "flights" | "hotels" | "itinerary" | "certainty" | "action_items">;
    cacheKeysToInvalidate: string[];
    apiCalls: Array<{
      name: string;
      endpointKey: string;
      dependsOn?: string[];
      priority: 1 | 2 | 3;
    }>;
  };

  deltaSummary: {
    certainty: {
      before: number;
      after: number;
      reason: string;
    };
    totalCost: {
      before: number;
      after: number;
      delta: number;
      notes: string[];
    };
    blockers: {
      before: number;
      after: number;
      resolved: string[];
      new: string[];
    };
    itinerary: {
      dayCountBefore: number;
      dayCountAfter: number;
      majorDiffs: string[];
    };
  };

  uiInstructions: {
    banner: {
      tone: "green" | "amber" | "red";
      title: string;
      subtitle?: string;
    };
    highlightSections: Array<"ActionItems" | "CostBreakdown" | "Itinerary" | "VisaCard">;
    toasts?: Array<{
      tone: "success" | "warning" | "error";
      message: string;
    }>;
  };

  updatedData: {
    visa?: any;
    flights?: any;
    hotels?: any;
    itinerary?: any;
    actionItems: Array<{
      key: string;
      label: string;
      category: "required" | "recommended";
      type: string;
      completed: boolean;
      reason?: string;
    }>;
    costBreakdown?: any;
  };

  // Optional: Fix suggestions when blockers exist
  fixOptions?: Array<{
    title: string;
    changePatch: Partial<UserTripInput>;
    expectedOutcome: {
      certaintyAfter: number;
      blockersAfter: number;
      costDelta: number;
    };
    confidence: "high" | "medium" | "low";
  }>;
};
```

### User Trip Input Type

```typescript
type UserTripInput = {
  dates: {
    start: string;  // ISO date
    end: string;    // ISO date
    duration: number;
  };
  budget: {
    total: number;
    perPerson?: number;
    currency: string;
  };
  origin: {
    city: string;
    airport?: string;
    country: string;
  };
  destination: {
    city: string;
    country: string;
  };
  passport: string;  // Country code
  travelers: {
    total: number;
    adults: number;
    children: number;
    infants: number;
  };
  preferences: {
    pace: "relaxed" | "moderate" | "packed";
    interests: string[];
    hotelClass: "budget" | "mid" | "luxury";
  };
  constraints: string[];
};
```

---

## UI Behavior Specification

### 1) Change Review Banner (Top of Results)

**Placement:** Below HeaderBar, above CertaintyBar (similar to TripUpdateBanner)

**States:**

| Tone | Condition | Example Title |
|------|-----------|---------------|
| Green | No blockers | "Updated. No blockers found." |
| Amber | Blockers exist but manageable | "Updated. 2 items need attention before your trip." |
| Red | Change introduced new blocker | "Updated. This change introduced a blocker." |

**Banner Details (expandable):**
- "Certainty: 82 → 74"
- "Cost: +$210"
- "Blockers: 0 → 1 (Visa appointment timing)"

### 2) Section-Level Animations (Minimal Churn)

**Rules:**
- Only sections in `highlightSections` pulse or glow for 1.5s
- Action items list: only changed items animate in/out
- Itinerary: show "Day 3 adjusted" labels rather than re-rendering everything

**Animation Classes:**
```css
.section-highlight {
  animation: highlight-pulse 1.5s ease-out;
}

@keyframes highlight-pulse {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}
```

### 3) Diff View (Optional - Premium Feature)

A small "See what changed" drawer containing:
- **Costs:** Delta lines with +/- formatting
- **Visa:** Required vs recommended flips
- **Itinerary:** 3-5 bullet diffs

*Can be gated as "Pro" feature later, but build the contract now.*

---

## Fix Suggestions (Smallest Fix Algorithm)

When blockers exist, agent provides a "Fix options" list:

| Option | Description | Example |
|--------|-------------|---------|
| A: Minimal change | Smallest parameter tweak | Shift dates 7 days |
| B: Alternative destination | From HARD_BLOCKER alternatives | Similar destination with easier visa |
| C: Upgrade approach | Different entry method | Use e-visa destination, visa-on-arrival region |

**UI Rendering:** Buttons with "Apply option" CTA

---

## Analytics Specification

### Existing Events (Already Implemented)

- `action_items_viewed`
- `action_item_clicked`

### New Events to Add

| Event | Fields | When |
|-------|--------|------|
| `trip_change_started` | `changeFields[]`, `source`, `currentCertainty` | User initiates change |
| `trip_change_planned` | `modulesToRecompute[]`, `severityMax`, `predictedBlockerDelta`, `predictedCostDelta` | Agent computes plan |
| `trip_change_applied` | `certaintyBefore/After`, `blockersBefore/After`, `costBefore/After`, `durationMs` | Changes applied to UI |
| `trip_change_failed` | `moduleFailed`, `errorCode`, `partialApplied` | Recompute fails |
| `fix_option_shown` | `optionTitle`, `confidence`, `outcomeDeltas` | Fix suggestions displayed |
| `fix_option_applied` | `optionTitle`, `confidence`, `outcomeDeltas` | User applies a fix option |

**Source Values:**
- `edit_trip` - From edit drawer/form
- `quick_chip` - From quick tweak chip
- `fix_blocker` - From "Fix blockers" CTA

---

## Caching Strategy

### Cache Key Patterns

| Module | Key Pattern | Example |
|--------|-------------|---------|
| Visa | `visa:{passport}:{destinationCountry}` | `visa:US:TH` |
| Flights | `flightPrice:{origin}:{dest}:{dateRange}:{pax}` | `flightPrice:SFO:BKK:2026-03-01-2026-03-14:2` |
| Hotels | `hotelPrice:{city}:{dateRange}:{pax}:{class}` | `hotelPrice:bangkok:2026-03-01-2026-03-14:2:mid` |
| Itinerary | `itinerary:{city}:{days}:{pace}:{interestsHash}` | `itinerary:bangkok:7:moderate:abc123` |

### Invalidation Rules

| Change | Invalidates |
|--------|-------------|
| Dates | flights, hotels, itinerary (visa only if affects processing windows) |
| Budget | hotels (re-rank), itinerary (re-rank) - NOT visa |
| Origin | flights only |
| Destination | ALL modules |
| Passport | visa, certainty only |
| Travelers | flights, hotels |
| Preferences | hotels, itinerary |

---

## Failure Handling

### Principles

1. **Keep old data visible** - Don't wipe sections on failure
2. **Show inline retry** - "Couldn't refresh X. Try again" message
3. **Still update banner** - Use whatever data was successfully computed
4. **Don't wipe action items** - Only patch what was computed

### Partial Failure Response

```typescript
type PartialFailureResponse = ChangePlannerResponse & {
  failures: Array<{
    module: "visa" | "flights" | "hotels" | "itinerary";
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
  }>;
};
```

---

## Implementation Plan

### Phase 1: Client-Side Hook

```typescript
// client/src/hooks/useChangePlanner.ts

function useChangePlanner() {
  const [isReplanning, setIsReplanning] = useState(false);
  const [changePlan, setChangePlan] = useState<ChangePlannerResponse | null>(null);

  const planChanges = async (
    prevInput: UserTripInput,
    nextInput: UserTripInput,
    currentResults: TripResponse
  ): Promise<ChangePlannerResponse> => {
    setIsReplanning(true);
    try {
      const response = await fetch('/api/change-plan', {
        method: 'POST',
        body: JSON.stringify({ prevInput, nextInput, currentResults }),
      });
      const plan = await response.json();
      setChangePlan(plan);
      return plan;
    } finally {
      setIsReplanning(false);
    }
  };

  const applyChanges = (plan: ChangePlannerResponse) => {
    // Apply uiInstructions
    // Patch updatedData into state
    // Trigger section highlights
    // Fire analytics
  };

  return { isReplanning, changePlan, planChanges, applyChanges };
}
```

### Phase 2: Server Endpoint

```typescript
// server/routes/changePlan.ts

// POST /api/change-plan
// Steps:
// 1. Diff inputs (prev vs next)
// 2. Build recompute plan (which modules, which cache keys)
// 3. Execute module recomputes in priority order
// 4. Produce delta summary
// 5. Generate updated action items
// 6. Return response contract
```

### Phase 3: UI Integration

1. Add `ChangePlanBanner` component (extends TripUpdateBanner)
2. Add section highlight animations
3. Integrate with TripResultsV1 page
4. Add quick tweak chip UI

---

## Acceptance Criteria

### Functional

- [ ] Changing dates updates itinerary day count correctly
- [ ] Changing dates adjusts action item counts appropriately
- [ ] Changing passport updates visa severity correctly
- [ ] Changing destination updates Required blockers accurately
- [ ] Certainty score changes with explainable reason
- [ ] Cost delta shown with breakdown

### UI/UX

- [ ] Only impacted sections highlight (no full page churn)
- [ ] Action items animate only changed items
- [ ] Banner shows correct tone (green/amber/red)
- [ ] "No blockers found" vs "X items need attention" messaging

### Analytics

- [ ] All new events fire with correct payloads
- [ ] Source tracking works (edit_trip, quick_chip, fix_blocker)
- [ ] Duration tracking accurate

### Resilience

- [ ] Partial failures keep UI stable
- [ ] Old data preserved on module failure
- [ ] Retry mechanism works

---

## Appendix: Example Scenarios

### Scenario 1: Date Shift (+3 days)

**Input Change:**
```json
{
  "field": "dates",
  "before": { "start": "2026-03-01", "end": "2026-03-08" },
  "after": { "start": "2026-03-04", "end": "2026-03-11" }
}
```

**Expected Response:**
- Modules to recompute: `["flights", "hotels", "itinerary"]`
- Visa: NOT recomputed (same destination/passport)
- Delta summary: Cost may change, itinerary same structure

### Scenario 2: Passport Change (US → India)

**Input Change:**
```json
{
  "field": "passport",
  "before": "US",
  "after": "IN"
}
```

**Expected Response:**
- Modules to recompute: `["visa", "certainty", "action_items"]`
- Flights/Hotels: NOT recomputed
- Delta summary: Certainty may drop, new Required items may appear

### Scenario 3: Destination Change (Thailand → Japan)

**Input Change:**
```json
{
  "field": "destination",
  "before": { "city": "Bangkok", "country": "Thailand" },
  "after": { "city": "Tokyo", "country": "Japan" }
}
```

**Expected Response:**
- Modules to recompute: ALL
- Full replanning essentially
- Delta summary: Everything changes

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-09 | Initial specification |
