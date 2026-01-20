# Certainty Breakdown Implementation (Item 20)

**Status:** Implemented
**Date:** 2026-01-09

## Overview

The Certainty Breakdown feature explains *why* a trip has its certainty score by showing a visual breakdown of contributing factors. Users can see which areas are strong (green), need attention (amber), or are risky (red).

---

## Type Definitions

### CertaintyFactor

```typescript
type CertaintyFactorId =
  | "visa_timing"
  | "buffer_days"
  | "itinerary_density"
  | "cost_stability";

type CertaintyStatus = "good" | "warning" | "risk";

interface CertaintyFactor {
  id: CertaintyFactorId;
  label: string;
  score: number;          // 0–100 (normalized for display)
  weight: number;         // 0–1, used to compute weighted total
  status: CertaintyStatus;
  explanation: string;
  icon?: string;          // Optional emoji for UI
}

interface CertaintyBreakdownResult {
  factors: CertaintyFactor[];
  totalScore: number;     // Weighted average (0-100)
  verdict: "GO" | "POSSIBLE" | "DIFFICULT" | "NO";
  summary: string;
}
```

### Factor Weights

| Factor | Weight | Description |
|--------|--------|-------------|
| `visa_timing` | 35% | Visa processing urgency - highest priority |
| `buffer_days` | 25% | Days between now and trip vs processing time |
| `cost_stability` | 25% | Budget adequacy confidence |
| `itinerary_density` | 15% | Activity balance per day |

---

## Data Sources (No New APIs)

All factors are derived from existing trip data:

| Factor | Source Fields |
|--------|---------------|
| `visa_timing` | `visaDetails.timing.urgency`, `visaDetails.type`, `processingDays` |
| `buffer_days` | `visaDetails.timing.daysUntilTrip`, `processingDaysNeeded` |
| `itinerary_density` | `itinerary.days[].activities.length` |
| `cost_stability` | `feasibility.breakdown.budget.status`, `itinerary.costBreakdown` |

---

## Score Calculation Rules

### Visa Timing

| Condition | Score |
|-----------|-------|
| Visa-free | 100 |
| Visa on arrival | 100 |
| Urgency: ok | 100 |
| Urgency: tight | 65 |
| Urgency: risky | 35 |
| Urgency: impossible | 10 |

### Buffer Days

| Buffer (days) | Score | Status |
|---------------|-------|--------|
| ≥ 14 | 100 | good |
| 7–13 | 80 | good |
| 3–6 | 55 | warning |
| 0–2 | 30 | warning |
| < 0 | 10 | risk |

### Itinerary Density

| Avg Activities/Day | Score | Note |
|--------------------|-------|------|
| 3–5 | 95 | Ideal balance |
| 2–6 | 80 | Good pacing |
| > 6 | 55 | May be tiring |
| < 2 | 65 | Light schedule |

### Cost Stability

| Budget Status | Score |
|---------------|-------|
| ok | 90 |
| tight | 55 |
| impossible | 15 |

---

## Files Created

| File | Purpose |
|------|---------|
| `client/src/lib/certaintyBreakdown.ts` | Types + `buildCertaintyBreakdown()` function |
| `client/src/components/results/CertaintyBreakdown.tsx` | UI component with animated bars |

---

## Files Modified

| File | Changes |
|------|---------|
| `client/src/components/results/CertaintyBar.tsx` | Added breakdown to expandable section |
| `client/src/pages/TripExport.tsx` | Added "Why This Certainty Score?" PDF section |

---

## UI Component: CertaintyBreakdown

### Features

- **Horizontal progress bars** for each factor
- **Color-coded** by status (emerald/amber/red)
- **Animated** entrance (0.5s per bar, staggered)
- **Hover to reveal** explanation text
- **Weight indicators** (e.g., "35% weight")
- **Legend** at bottom

### Props

```typescript
interface CertaintyBreakdownProps {
  factors: CertaintyFactor[];
  totalScore: number;
  compact?: boolean; // For PDF export (no animations)
}
```

### Usage in CertaintyBar

```tsx
import { CertaintyBreakdown } from "./CertaintyBreakdown";
import { buildCertaintyBreakdown } from "@/lib/certaintyBreakdown";

// Inside component:
const breakdown = useMemo(() => buildCertaintyBreakdown(trip), [trip]);

// In expanded section:
<CertaintyBreakdown
  factors={breakdown.factors}
  totalScore={breakdown.totalScore}
/>
```

---

## PDF Export Integration

### Section: "Why This Certainty Score?"

Location: After "At a Glance", before "Visa & Entry Requirements"

```tsx
{certaintyBreakdown && certaintyBreakdown.factors.length > 0 && (
  <section className="mb-8 avoid-break">
    <h2>Why This Certainty Score?</h2>
    {/* Factor rows with static bars */}
  </section>
)}
```

### Print-Friendly Styling

- Static bars (no animation)
- Status badges with print colors
- Explanation text always visible
- `avoid-break` class prevents page splits

---

## Helper Functions

### getStatusClasses()

Returns Tailwind classes for status indicators:

```typescript
function getStatusClasses(status: CertaintyStatus): {
  bg: string;    // "bg-emerald-500/20"
  text: string;  // "text-emerald-400"
  border: string; // "border-emerald-500/30"
}
```

### getStatusColor()

Returns color name for programmatic use:

```typescript
function getStatusColor(status: CertaintyStatus): string {
  // Returns: "emerald" | "amber" | "red" | "slate"
}
```

---

## Integration Points

### CertaintyBar.tsx

```tsx
// Import
import { CertaintyBreakdown } from "./CertaintyBreakdown";
import { buildCertaintyBreakdown } from "@/lib/certaintyBreakdown";

// Memoize breakdown
const breakdown = useMemo(() => buildCertaintyBreakdown(trip), [trip]);

// Render in expanded section
<div className="mb-4 p-4 bg-white/5 rounded-lg">
  <CertaintyBreakdown
    factors={breakdown.factors}
    totalScore={breakdown.totalScore}
  />
</div>
```

### TripExport.tsx

```tsx
// Import
import { buildCertaintyBreakdown } from "@/lib/certaintyBreakdown";

// Store trip data for breakdown
const [tripData, setTripData] = useState<any>(null);

// Build breakdown
const certaintyBreakdown = useMemo(() => {
  if (!tripData) return null;
  return buildCertaintyBreakdown(tripData);
}, [tripData]);

// Render section (see PDF Export Integration above)
```

---

## Accessibility

- Progress bars have semantic width values
- Status indicated by both color and text label
- Explanations provide context for screen readers
- Focus states for interactive elements

---

## Performance

- `buildCertaintyBreakdown()` is pure function, safe to memoize
- `CertaintyBreakdown` wrapped in `React.memo()`
- Animations use CSS transforms (GPU-accelerated)
- Compact mode skips animations for faster PDF rendering

---

## Future Enhancements

1. **Factor Details Modal** - Click factor to see detailed breakdown
2. **Comparison Mode** - Show before/after when changes applied
3. **Recommendations** - "Add 3 days to improve buffer score"
4. **Custom Weights** - Allow users to prioritize factors
5. **Historical Tracking** - Show factor evolution over changes

---

*Last Updated: 2026-01-09*
