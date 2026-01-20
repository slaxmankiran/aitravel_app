# Certainty Features

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

## Certainty Breakdown (Item 20)

### Status: Implemented

Full specification: [`CERTAINTY_BREAKDOWN_IMPLEMENTATION.md`](CERTAINTY_BREAKDOWN_IMPLEMENTATION.md)

### Overview

Visual breakdown explaining *why* a trip has its certainty score. Shows 4 weighted factors with progress bars and status indicators.

### Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/certaintyBreakdown.ts` | Types + `buildCertaintyBreakdown()` function |
| `client/src/components/results/CertaintyBreakdown.tsx` | UI component with animated bars |

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

## Certainty Explanation Drawer

### Status: Implemented

### File Created

`client/src/components/results/CertaintyExplanationDrawer.tsx`

### Features

- Triggered from CertaintyBar score click
- Shows breakdown by category (Visa, Safety, Budget, Accessibility)
- Displays change deltas when plan is applied
- Animated slide-up from bottom

---

## Certainty Timeline

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

## Version History (Item 18)

### Status: Implemented

Full specification: [`VERSION_HISTORY_IMPLEMENTATION.md`](VERSION_HISTORY_IMPLEMENTATION.md)

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
