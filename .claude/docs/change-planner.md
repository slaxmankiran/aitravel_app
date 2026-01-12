# Change Planner Agent

## Status: Implemented and Tested (2026-01-09)

Smart agent that detects user changes after seeing results, recomputes only impacted modules, and explains deltas in plain language.

**Full Specification:** [`docs/CHANGE_PLANNER_AGENT_SPEC.md`](docs/CHANGE_PLANNER_AGENT_SPEC.md)

## Core Capabilities

1. **Detect** what changed and what it breaks
2. **Recompute** only impacted parts (not the whole trip)
3. **Explain** delta in plain language (cost, visa, itinerary, certainty)
4. **Update** Action Items, Cost Breakdown, Itinerary with minimal UI churn
5. **Log** analytics for "change friction" and "replan success"

## Entry Points

| Entry Point | Description |
|-------------|-------------|
| Inline Edit | Edit in Results header → "Replanning…" → apply |
| Quick Chips | One-tap: "+3 days", "Cheaper options", "Add beach day" |
| Fix Blocker | "Fix blockers" CTA → smallest change to resolve |

## Files Created

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

## Client Hook: useChangePlanner

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

## Change Plan Banner

Shows after any change is applied:
- Certainty delta: "+8% certainty" (green) or "-5% certainty" (red)
- Cost delta: "+$150" or "-$200"
- Blocker chips: "2 resolved", "1 new"
- Actions: Undo, Compare, Share, Dismiss

## Undo Support

- `UndoContext` stores `prevInput`/`nextInput` for 60 seconds
- Undo swaps inputs and re-runs change planner
- Certainty history updated on each change

## Shareable Links

- Applied plans persisted to `/api/trips/:id/applied-plans`
- URL format: `/trips/2/results-v1?plan=chg_abc123`
- Shared link restores banner on page load

---

## Compare Plans Feature (Item 15)

### Status: Implemented and Tested

Side-by-side comparison modal showing original vs updated trip after changes.

### Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/comparePlans.ts` | Compute `PlanComparison` from two trips |
| `client/src/components/results/ComparePlansModal.tsx` | Modal with side-by-side comparison |

### Modal Features

- **Header**: "Compare Plans" with close button
- **Two columns**: Plan A (Original) vs Plan B (Current)
- **Sections**: Trip details, certainty score, cost breakdown, visa risk
- **Actions**: "Keep Updated" (default), "Revert to Original"

---

## Auto-suggest Next Fix (Item 16)

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

### UI in ChangePlanBanner

- Lightbulb icon with suggestion title
- Impact chips: "+3 days", "-$200"
- "Apply" button (disabled while applying)
- "Snooze" button (hides until next change)
- "Why?" tooltip with reason

---

## Action Items: Required vs Recommended (2026-01-09)

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
- Contextual status message based on blocker count
- Category-based sorting (required first, then by priority within category)

### File Modified

| File | Changes |
|------|---------|
| `ActionItems.tsx` | Added `category` field, classification logic, header counts, analytics |

---

## Analytics Events

| Event | When |
|-------|------|
| `trip_change_started` | Change initiated |
| `trip_change_planned` | Plan computed |
| `trip_change_applied` | Plan applied to UI |
| `trip_change_failed` | Error during planning |
| `trip_change_undo_clicked` | User clicks Undo |
| `trip_change_undo_applied` | Undo completed |
| `action_items_viewed` | Panel mount |
| `action_item_clicked` | Item click |
