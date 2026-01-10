# VoyageAI Verdict Rules

## Verdict Definitions

| Verdict | Meaning | User Action |
|---------|---------|-------------|
| **GO** | Book with confidence | Proceed to booking |
| **POSSIBLE** | Doable with preparation | Review action items, then proceed |
| **DIFFICULT** | Technically possible but not recommended | Reconsider dates, destination, or budget |

---

## Input Signals (Guaranteed from Backend)

These fields are **always present** after feasibility analysis:

| Signal | Type | Source |
|--------|------|--------|
| `certaintyScore` | number (0-100) | Computed |
| `visaType` | enum | AI analysis |
| `visaProcessingDays.minimum` | number | AI analysis |
| `visaProcessingDays.maximum` | number | AI analysis |
| `visaRisk` | 'low' \| 'medium' \| 'high' | Computed |
| `safetyLevel` | number (1-4) | AI analysis |
| `totalCost` | number | Computed |
| `userBudget` | number | User input |
| `tripDuration` | number (days) | User input |
| `daysUntilTravel` | number | Computed |

---

## Verdict Decision Matrix

### Primary Rule: Certainty Score Bands

| Score Range | Base Verdict |
|-------------|--------------|
| 80-100 | GO |
| 50-79 | POSSIBLE |
| 0-49 | DIFFICULT |

### Override Rules (Applied in Order)

These can **downgrade** the verdict but never upgrade it.

```
Rule 1: VISA TIMING BLOCKER
IF visaProcessingDays.minimum > daysUntilTravel
THEN verdict = DIFFICULT
     reason = "Visa processing exceeds your travel date"

Rule 2: VISA HIGH RISK
IF visaRisk = 'high' AND verdict = 'GO'
THEN verdict = POSSIBLE
     reason = "Visa approval is uncertain"

Rule 3: BUDGET EXCEEDED
IF totalCost > userBudget * 1.2  (20% buffer)
THEN verdict = max(verdict, POSSIBLE)
     reason = "Estimated cost exceeds budget by ${overage}"

Rule 4: SEVERE BUDGET BREACH
IF totalCost > userBudget * 1.5  (50% over)
THEN verdict = DIFFICULT
     reason = "Trip cost is significantly over budget"

Rule 5: SAFETY CONCERN
IF safetyLevel >= 3
THEN verdict = DIFFICULT
     reason = "Travel advisory in effect for this destination"

Rule 6: TIGHT TIMELINE
IF daysUntilTravel < 7 AND visaType != 'visa_free'
THEN verdict = max(verdict, POSSIBLE)
     reason = "Limited time for visa processing"
```

---

## Verdict Computation Function

```typescript
type Verdict = 'GO' | 'POSSIBLE' | 'DIFFICULT';

interface VerdictInput {
  certaintyScore: number;
  visaType: string;
  visaProcessingDays: { minimum: number; maximum: number };
  visaRisk: 'low' | 'medium' | 'high';
  safetyLevel: number;
  totalCost: number;
  userBudget: number;
  daysUntilTravel: number;
}

interface VerdictResult {
  verdict: Verdict;
  reasons: string[];
  confidence: number;
}

function computeVerdict(input: VerdictInput): VerdictResult {
  const reasons: string[] = [];

  // Base verdict from certainty score
  let verdict: Verdict =
    input.certaintyScore >= 80 ? 'GO' :
    input.certaintyScore >= 50 ? 'POSSIBLE' : 'DIFFICULT';

  // Rule 1: Visa timing blocker
  if (input.visaProcessingDays.minimum > input.daysUntilTravel) {
    verdict = 'DIFFICULT';
    reasons.push('Visa processing exceeds your travel date');
  }

  // Rule 2: Visa high risk
  if (input.visaRisk === 'high' && verdict === 'GO') {
    verdict = 'POSSIBLE';
    reasons.push('Visa approval is uncertain');
  }

  // Rule 3 & 4: Budget checks
  const budgetRatio = input.totalCost / input.userBudget;
  if (budgetRatio > 1.5) {
    verdict = 'DIFFICULT';
    const overage = Math.round(input.totalCost - input.userBudget);
    reasons.push(`Trip cost exceeds budget by $${overage}`);
  } else if (budgetRatio > 1.2 && verdict === 'GO') {
    verdict = 'POSSIBLE';
    const overage = Math.round(input.totalCost - input.userBudget);
    reasons.push(`Estimated cost is $${overage} over budget`);
  }

  // Rule 5: Safety concern
  if (input.safetyLevel >= 3) {
    verdict = 'DIFFICULT';
    reasons.push('Travel advisory in effect for this destination');
  }

  // Rule 6: Tight timeline
  if (input.daysUntilTravel < 7 && input.visaType !== 'visa_free' && verdict === 'GO') {
    verdict = 'POSSIBLE';
    reasons.push('Limited time for visa processing');
  }

  // Add positive reason if GO with no issues
  if (verdict === 'GO' && reasons.length === 0) {
    reasons.push('All checks passed. Safe to book.');
  }

  return {
    verdict,
    reasons,
    confidence: input.certaintyScore,
  };
}
```

---

## UI Copy Contract

### Verdict Headlines

| Verdict | Headline | Subtext |
|---------|----------|---------|
| GO | "You're good to go" | "All checks passed. Book with confidence." |
| POSSIBLE | "Possible with preparation" | "Review the action items below before booking." |
| DIFFICULT | "Consider alternatives" | "This trip has significant blockers. See details." |

### Reason Templates

| Trigger | Copy |
|---------|------|
| Visa timing blocker | "Visa processing ({min}-{max} days) exceeds your travel date" |
| Visa high risk | "Visa approval is uncertain for {passport} → {destination}" |
| Budget exceeded | "Estimated cost (${total}) exceeds your budget by ${overage}" |
| Safety concern | "Level {level} travel advisory in effect" |
| Tight timeline | "Only {days} days until travel. Visa may not process in time." |
| All clear | "No blockers found. Visa, budget, and safety all checked." |

---

## Verdict Card Component Spec

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     [ICON]   GO / POSSIBLE / DIFFICULT                      │
│                                                             │
│     "You're good to go"                    Score: 87/100    │
│                                                             │
│     ─────────────────────────────────────────────────────   │
│                                                             │
│     ✓ Visa-free entry (30 days)                             │
│     ✓ Budget sufficient ($365 remaining)                    │
│     ✓ No travel advisories                                  │
│                                                             │
│     [View Full Analysis ↓]                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Visual States

| Verdict | Background | Icon | Border |
|---------|------------|------|--------|
| GO | `bg-emerald-500/10` | ✓ | `border-emerald-500` |
| POSSIBLE | `bg-amber-500/10` | ⚠ | `border-amber-500` |
| DIFFICULT | `bg-red-500/10` | ✗ | `border-red-500` |

---

## Edge Cases

### Missing Data Handling

| Missing Field | Fallback |
|---------------|----------|
| `visaProcessingDays` | Assume 14 days, add reason "Visa timeline estimated" |
| `safetyLevel` | Assume level 1 (safe) |
| `totalCost` | Use budget as estimate, add reason "Cost is estimated" |

### Boundary Conditions

| Condition | Treatment |
|-----------|-----------|
| Score exactly 80 | GO |
| Score exactly 50 | POSSIBLE |
| Budget exactly matched | GO (no overage warning) |
| Same-day travel | DIFFICULT unless visa-free |

---

## Implementation Checklist

- [ ] Add `computeVerdict()` to `client/src/lib/verdict.ts`
- [ ] Create `VerdictCard` component
- [ ] Wire to `TripResultsV1.tsx`
- [ ] Add verdict to `TripResponse` type
- [ ] Backend: ensure all required fields are always returned

---

## Testing Scenarios

| Scenario | Expected Verdict |
|----------|------------------|
| US → Thailand, visa-free, $2000 budget, $1500 cost | GO |
| India → USA, visa required, 30 days out, $5000 budget | POSSIBLE |
| India → USA, visa required, 5 days out | DIFFICULT |
| Any → North Korea | DIFFICULT (safety) |
| Budget $1000, cost $1800 | DIFFICULT (50%+ over) |
| Budget $1000, cost $1150 | POSSIBLE (15% over) |
