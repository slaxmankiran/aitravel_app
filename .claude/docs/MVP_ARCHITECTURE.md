# VoyageAI - MVP Architecture
## "The Certainty Engine for Travel"

> **Core Promise:** "Can I go? What will it truly cost? What's the plan?"

---

## MVP SCOPE

### What's IN (MVP)
- Single destination trips
- Single passport (all travelers same nationality)
- Certainty Score with visa timing check
- Enhanced visa information (cost, processing time, documents)
- True cost breakdown (trip costs + visa + insurance)
- Affiliate links for monetization
- Basic action items checklist

### What's OUT (Post-MVP)
- Multi-country trips
- Mixed passport groups
- Visa concierge service
- B2B API
- Subscription tiers
- User accounts (optional for MVP)

---

## USER FLOW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STEP 1: USER INPUT                              │
│                                                                         │
│  Passport:        [India ▼]                                            │
│  From:            [Hyderabad, India]                                   │
│  To:              [Tokyo, Japan]                                       │
│  Travel Dates:    [Feb 15, 2026] → [Feb 22, 2026]                     │
│  Travelers:       [2 adults, 1 child]                                  │
│  Budget Style:    ○ Budget  ● Comfort  ○ Luxury  ○ Custom [$____]     │
│                                                                         │
│                        [Plan My Trip →]                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: CERTAINTY CHECK (3-5 seconds)                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                                                 │   │
│  │   Checking visa requirements...                                 │   │
│  │   ████████████░░░░░░░░ 60%                                     │   │
│  │                                                                 │   │
│  │   ✓ Destination accessible                                     │   │
│  │   ⏳ Checking visa for Indian passport...                      │   │
│  │   ⏳ Analyzing travel dates...                                 │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 3: RESULTS PAGE                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     CERTAINTY SCORE                             │   │
│  │                                                                 │   │
│  │         ████████████████░░░░  78/100                           │   │
│  │                                                                 │   │
│  │              "You can go! Apply for visa now."                 │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  SCORE BREAKDOWN                                                │   │
│  │                                                                 │   │
│  │  ✓ Accessible          25/25   Tokyo has regular flights       │   │
│  │  ⚠ Visa Required       18/30   Embassy visa, 5-7 days, ₹3,000 │   │
│  │  ✓ Safe                25/25   Low crime, stable               │   │
│  │  ⚠ Budget Tight        10/20   Comfort style may exceed budget│   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ VISA TIMING WARNING                                        │   │
│  │                                                                 │   │
│  │  Your trip is in 12 days.                                      │   │
│  │  Japan visa processing: 5-7 business days.                     │   │
│  │                                                                 │   │
│  │  ⏰ You have just enough time, but apply TODAY!                │   │
│  │                                                                 │   │
│  │  [Apply for Visa Now →]                          💰 Affiliate  │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TRUE COST BREAKDOWN                                            │   │
│  │                                                                 │   │
│  │  Trip Costs                                                     │   │
│  │    Flights .......................... ₹75,000                  │   │
│  │    Hotels (7 nights) ................ ₹42,000                  │   │
│  │    Activities ....................... ₹15,000                  │   │
│  │    Food & Transport ................. ₹14,000                  │   │
│  │                                      ─────────                  │   │
│  │    Subtotal                          ₹146,000                  │   │
│  │                                                                 │   │
│  │  Entry Costs (often forgotten!)                                │   │
│  │    Japan Visa (3 persons) ........... ₹9,000   [Apply →]      │   │
│  │    Travel Insurance ................. ₹2,400   [Get Quote →]  │   │
│  │                                      ─────────                  │   │
│  │    Subtotal                          ₹11,400                   │   │
│  │                                                                 │   │
│  │  ════════════════════════════════════════════                  │   │
│  │  TOTAL TRUE COST                     ₹157,400                  │   │
│  │  Per Person                          ₹52,467                   │   │
│  │  ════════════════════════════════════════════                  │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📋 ACTION ITEMS                                                │   │
│  │                                                                 │   │
│  │  ☐ Apply for Japan visa (5-7 days)        [Apply with iVisa →]│   │
│  │  ☐ Get travel insurance                   [SafetyWing →]      │   │
│  │  ☐ Book flights                           [Compare Prices →]  │   │
│  │  ☐ Book accommodation                     [See Hotels →]      │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  📅 YOUR ITINERARY                                              │   │
│  │                                                                 │   │
│  │  Day 1 - Arrival & Shinjuku                                    │   │
│  │  Day 2 - Shibuya & Harajuku                                    │   │
│  │  Day 3 - Asakusa & Senso-ji                                    │   │
│  │  ... (expandable)                                              │   │
│  │                                                                 │   │
│  │  [View Full Itinerary ↓]                                       │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## DATA STRUCTURES

### Input Schema (Updated)
```typescript
interface TripInput {
  // Existing fields
  passport: string;              // "India"
  residence?: string;            // "Hyderabad, India"
  origin: string;                // "Hyderabad, India"
  destination: string;           // "Tokyo, Japan"
  dates: string;                 // "Feb 15, 2026 - Feb 22, 2026"

  // Travelers
  adults: number;                // 2
  children: number;              // 1
  infants: number;               // 0

  // Budget
  travelStyle: 'budget' | 'comfort' | 'luxury' | 'custom';
  budget?: number;               // Only if custom
  currency: string;              // "INR"

  // NEW: For visa timing calculation
  passportExpiry?: string;       // "2028-06-15" (optional, Phase 2)
}
```

### Certainty Score Schema (NEW)
```typescript
interface CertaintyScore {
  // Overall
  score: number;                 // 0-100
  verdict: 'GO' | 'POSSIBLE' | 'DIFFICULT' | 'NO';
  summary: string;               // "You can go! Apply for visa now."

  // Breakdown (total = 100)
  breakdown: {
    accessibility: {
      score: number;             // 0-25
      status: 'ok' | 'warning' | 'blocker';
      reason: string;
    };
    visa: {
      score: number;             // 0-30 (weighted higher)
      status: 'ok' | 'warning' | 'blocker';
      reason: string;
      timingOk: boolean;         // Do they have enough time?
    };
    safety: {
      score: number;             // 0-25
      status: 'ok' | 'warning' | 'blocker';
      reason: string;
    };
    budget: {
      score: number;             // 0-20
      status: 'ok' | 'warning' | 'blocker';
      reason: string;
    };
  };

  // Blockers (if any)
  blockers: string[];            // ["Not enough time for visa processing"]

  // Warnings
  warnings: string[];            // ["Monsoon season - pack rain gear"]
}
```

### Visa Details Schema (NEW - Enhanced)
```typescript
interface VisaDetails {
  required: boolean;

  // Type
  type: 'visa_free' | 'visa_on_arrival' | 'e_visa' | 'embassy_visa' | 'not_allowed';

  // If visa needed
  name?: string;                 // "Japan Tourist Visa"

  // Processing
  processingDays: {
    minimum: number;             // 5
    maximum: number;             // 7
    expedited?: number;          // 3 (if available)
  };

  // Cost (per person)
  cost: {
    government: number;          // 3000 (actual visa fee)
    service?: number;            // 500 (VFS/agency fee)
    expedited?: number;          // 1500 (rush fee)
    currency: string;            // "INR"
  };

  // Documents
  documentsRequired: string[];   // ["Passport", "Photo", "Bank statement", ...]

  // Application
  applicationMethod: 'online' | 'embassy' | 'vfs' | 'on_arrival';
  applicationUrl?: string;       // Official or affiliate link

  // Timing analysis (calculated)
  timing: {
    daysUntilTrip: number;       // 12
    businessDaysUntilTrip: number; // 8
    processingDaysNeeded: number;  // 7
    hasEnoughTime: boolean;      // true
    urgency: 'ok' | 'tight' | 'risky' | 'impossible';
    recommendation: string;      // "Apply today to be safe"
  };

  // Affiliate
  affiliateLink?: string;        // iVisa affiliate link
}
```

### Entry Costs Schema (NEW)
```typescript
interface EntryCosts {
  visa: {
    required: boolean;
    costPerPerson: number;
    totalCost: number;           // costPerPerson × travelers needing visa
    affiliateLink?: string;
  };

  insurance: {
    required: boolean;           // Mandatory for destination?
    recommended: boolean;        // Always true
    estimatedCost: number;       // Based on trip duration
    affiliateLink?: string;
  };

  total: number;                 // visa.totalCost + insurance.estimatedCost
}
```

### Updated Cost Breakdown Schema
```typescript
interface TrueCostBreakdown {
  currency: string;
  currencySymbol: string;

  // Trip costs (existing)
  tripCosts: {
    flights: { total: number; perPerson: number; note: string };
    accommodation: { total: number; perNight: number; nights: number };
    activities: { total: number; note: string };
    food: { total: number; perDay: number };
    localTransport: { total: number; note: string };
    subtotal: number;
  };

  // Entry costs (NEW)
  entryCosts: {
    visa: {
      required: boolean;
      total: number;
      perPerson: number;
      note: string;              // "Japan Tourist Visa × 3 persons"
      affiliateLink?: string;
    };
    insurance: {
      required: boolean;
      recommended: boolean;
      total: number;
      note: string;              // "7 days coverage"
      affiliateLink?: string;
    };
    subtotal: number;
  };

  // Totals
  grandTotal: number;            // tripCosts.subtotal + entryCosts.subtotal
  perPerson: number;

  // Budget comparison
  budgetStatus: 'under' | 'on_track' | 'over';
  budgetDifference?: number;     // How much over/under
}
```

---

## BACKEND CHANGES

### 1. Enhanced Feasibility Prompt

**File:** `server/routes.ts`

**Current prompt returns:**
```json
{
  "overall": "yes|warning|no",
  "score": 65,
  "breakdown": {
    "visa": { "status": "ok|issue", "reason": "brief" }
  }
}
```

**New prompt should return:**
```json
{
  "certaintyScore": {
    "score": 78,
    "verdict": "POSSIBLE",
    "summary": "You can go! Apply for visa now."
  },
  "breakdown": {
    "accessibility": { "score": 25, "status": "ok", "reason": "..." },
    "visa": { "score": 18, "status": "warning", "reason": "..." },
    "safety": { "score": 25, "status": "ok", "reason": "..." },
    "budget": { "score": 10, "status": "warning", "reason": "..." }
  },
  "visaDetails": {
    "required": true,
    "type": "embassy_visa",
    "name": "Japan Tourist Visa",
    "processingDays": { "minimum": 5, "maximum": 7 },
    "cost": { "government": 3000, "service": 500, "currency": "INR" },
    "documentsRequired": ["Passport with 6+ months validity", "..."],
    "applicationMethod": "vfs",
    "applicationUrl": "https://www.vfsglobal.com/japan/india/"
  },
  "insuranceRequired": false,
  "insuranceRecommended": true,
  "warnings": ["Passport must be valid until Aug 2026"],
  "blockers": []
}
```

### 2. Visa Timing Calculation

**File:** `server/routes.ts` (new function)

```typescript
function calculateVisaTiming(
  tripStartDate: string,        // "2026-02-15"
  visaProcessingDays: { min: number; max: number },
  today: Date = new Date()
): VisaTiming {
  const tripDate = new Date(tripStartDate);
  const diffTime = tripDate.getTime() - today.getTime();
  const daysUntilTrip = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Calculate business days (rough: multiply by 5/7)
  const businessDaysUntilTrip = Math.floor(daysUntilTrip * 5 / 7);

  // Add buffer for submission + pickup
  const bufferDays = 3;
  const totalDaysNeeded = visaProcessingDays.max + bufferDays;

  const hasEnoughTime = daysUntilTrip >= totalDaysNeeded;

  let urgency: 'ok' | 'tight' | 'risky' | 'impossible';
  let recommendation: string;

  if (daysUntilTrip >= totalDaysNeeded + 7) {
    urgency = 'ok';
    recommendation = 'You have plenty of time. Apply within the next week.';
  } else if (daysUntilTrip >= totalDaysNeeded) {
    urgency = 'tight';
    recommendation = 'Time is tight. Apply TODAY!';
  } else if (daysUntilTrip >= visaProcessingDays.min) {
    urgency = 'risky';
    recommendation = 'Very risky! Consider expedited processing or postponing.';
  } else {
    urgency = 'impossible';
    recommendation = 'Not enough time. Postpone your trip or choose visa-free destination.';
  }

  return {
    daysUntilTrip,
    businessDaysUntilTrip,
    processingDaysNeeded: totalDaysNeeded,
    hasEnoughTime,
    urgency,
    recommendation
  };
}
```

### 3. Certainty Score Calculation

**File:** `server/routes.ts` (new function)

```typescript
function calculateCertaintyScore(
  accessibility: { status: string; reason: string },
  visa: { status: string; reason: string; timingOk: boolean },
  safety: { status: string; reason: string },
  budget: { status: string; reason: string }
): CertaintyScore {

  // Accessibility: 0-25 points
  const accessibilityScore =
    accessibility.status === 'ok' ? 25 :
    accessibility.status === 'warning' ? 15 :
    5;

  // Visa: 0-30 points (weighted higher)
  let visaScore =
    visa.status === 'visa_free' ? 30 :
    visa.status === 'visa_on_arrival' ? 27 :
    visa.status === 'e_visa' ? 24 :
    visa.status === 'embassy_visa' ? 18 :
    0; // not_allowed

  // Reduce visa score if timing is bad
  if (!visa.timingOk) {
    visaScore = Math.min(visaScore, 5);
  }

  // Safety: 0-25 points
  const safetyScore =
    safety.status === 'safe' ? 25 :
    safety.status === 'caution' ? 15 :
    5;

  // Budget: 0-20 points
  const budgetScore =
    budget.status === 'under' ? 20 :
    budget.status === 'on_track' ? 18 :
    budget.status === 'tight' ? 12 :
    5;

  const totalScore = accessibilityScore + visaScore + safetyScore + budgetScore;

  // Determine verdict
  let verdict: 'GO' | 'POSSIBLE' | 'DIFFICULT' | 'NO';
  let summary: string;

  if (totalScore >= 80) {
    verdict = 'GO';
    summary = 'You\'re all set! Book with confidence.';
  } else if (totalScore >= 60) {
    verdict = 'POSSIBLE';
    summary = 'You can go! Address the warnings below.';
  } else if (totalScore >= 40) {
    verdict = 'DIFFICULT';
    summary = 'Significant hurdles. Review blockers carefully.';
  } else {
    verdict = 'NO';
    summary = 'This trip is not recommended. See alternatives.';
  }

  return {
    score: totalScore,
    verdict,
    summary,
    breakdown: {
      accessibility: { score: accessibilityScore, ...accessibility },
      visa: { score: visaScore, ...visa },
      safety: { score: safetyScore, ...safety },
      budget: { score: budgetScore, ...budget }
    },
    blockers: [], // Populated based on any 'blocker' status
    warnings: []  // Populated based on any 'warning' status
  };
}
```

### 4. Entry Costs Calculation

**File:** `server/routes.ts` (new function)

```typescript
function calculateEntryCosts(
  visaDetails: VisaDetails,
  travelers: { adults: number; children: number; infants: number },
  tripDurationDays: number
): EntryCosts {

  // Visa costs (usually adults and children need visas, infants sometimes free)
  const travelersNeedingVisa = visaDetails.required
    ? travelers.adults + travelers.children
    : 0;

  const visaCostPerPerson = visaDetails.required
    ? (visaDetails.cost.government + (visaDetails.cost.service || 0))
    : 0;

  const totalVisaCost = visaCostPerPerson * travelersNeedingVisa;

  // Insurance estimate (rough: $1-2 per person per day)
  const allTravelers = travelers.adults + travelers.children + travelers.infants;
  const insurancePerPersonPerDay = 150; // INR, roughly $1.80
  const insuranceCost = insurancePerPersonPerDay * allTravelers * tripDurationDays;

  return {
    visa: {
      required: visaDetails.required,
      costPerPerson: visaCostPerPerson,
      totalCost: totalVisaCost,
      affiliateLink: 'https://ivisa.com/?affiliate=voyageai' // Replace with real
    },
    insurance: {
      required: false, // Set based on destination
      recommended: true,
      estimatedCost: insuranceCost,
      affiliateLink: 'https://safetywing.com/?affiliate=voyageai' // Replace with real
    },
    total: totalVisaCost + insuranceCost
  };
}
```

---

## FRONTEND CHANGES

### 1. New Component: CertaintyScore

**File:** `client/src/components/CertaintyScore.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│         ████████████████░░░░  78/100                           │
│                                                                 │
│    [Animated circular or bar progress indicator]                │
│                                                                 │
│              "You can go! Apply for visa now."                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────│
│                                                                 │
│  ✓ Accessible       ████████████████████████  25/25           │
│  ⚠ Visa            ██████████████░░░░░░░░░░  18/30           │
│  ✓ Safe            ████████████████████████  25/25           │
│  ⚠ Budget          ██████████░░░░░░░░░░░░░░  10/20           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. New Component: VisaAlert

**File:** `client/src/components/VisaAlert.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ VISA TIMING                                     [Dismiss]  │
│                                                                 │
│  Japan Tourist Visa required for Indian passport holders.      │
│                                                                 │
│  ⏱️ Processing time: 5-7 business days                         │
│  📅 Your trip: 12 days away                                    │
│  💰 Cost: ₹3,500 per person (₹10,500 total)                   │
│                                                                 │
│  ⏰ Status: TIGHT - Apply today!                               │
│                                                                 │
│  Documents needed:                                              │
│  • Valid passport (6+ months validity)                         │
│  • Recent photo (2x2 inches)                                   │
│  • Bank statement (last 3 months)                              │
│  • Flight booking (or itinerary)                               │
│  • Hotel booking confirmation                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [Apply with iVisa - ₹3,800]    [Official Embassy Site] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Updated Component: CostBreakdown

**File:** `client/src/components/CostBreakdown.tsx` (update existing)

Add new "Entry Costs" section showing visa + insurance with affiliate links.

### 4. New Component: ActionItems

**File:** `client/src/components/ActionItems.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 ACTION ITEMS                                                │
│                                                                 │
│  Complete these before your trip:                               │
│                                                                 │
│  ☐ Apply for Japan visa                                        │
│    5-7 days processing • ₹3,500/person                         │
│    [Apply Now →]                                               │
│                                                                 │
│  ☐ Get travel insurance                                        │
│    Recommended • ~₹2,400 for 7 days                            │
│    [Get Quote →]                                               │
│                                                                 │
│  ☐ Book flights                                                │
│    ₹75,000 estimated                                           │
│    [Compare Prices →]                                          │
│                                                                 │
│  ☐ Book accommodation                                          │
│    ₹42,000 estimated • 7 nights                                │
│    [See Hotels →]                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION ORDER

### Phase 1: Backend - Certainty Score (2-3 hours)
1. Update AI prompt to return enhanced visa details
2. Add `calculateVisaTiming()` function
3. Add `calculateCertaintyScore()` function
4. Add `calculateEntryCosts()` function
5. Update trip response to include new fields

### Phase 2: Frontend - Display Components (3-4 hours)
1. Create `CertaintyScore.tsx` component
2. Create `VisaAlert.tsx` component
3. Create `ActionItems.tsx` component
4. Update `CostBreakdown.tsx` to show entry costs

### Phase 3: Integration (1-2 hours)
1. Update `TripDetails.tsx` to use new components
2. Add affiliate links (placeholder URLs for now)
3. Test with various passport/destination combos

### Phase 4: Polish (1-2 hours)
1. Add animations (score counting up, progress bars)
2. Mobile responsive design
3. Error handling for edge cases

---

## AFFILIATE LINKS (Placeholder)

```typescript
const AFFILIATE_LINKS = {
  visa: {
    ivisa: 'https://www.ivisa.com/?utm_source=voyageai&utm_medium=affiliate',
    // Add actual affiliate ID when registered
  },
  insurance: {
    safetywing: 'https://safetywing.com/nomad-insurance/?referenceID=voyageai',
    // Add actual affiliate ID when registered
  },
  flights: {
    skyscanner: 'https://www.skyscanner.com/?associate=voyageai',
  },
  hotels: {
    booking: 'https://www.booking.com/?aid=XXXXXX', // Add affiliate ID
  },
  activities: {
    viator: 'https://www.viator.com/?pid=XXXXXX', // Add affiliate ID
  }
};
```

---

## SUCCESS METRICS (MVP)

| Metric | Target |
|--------|--------|
| Time to Certainty Score | < 5 seconds |
| Score accuracy (user feedback) | > 80% "helpful" |
| Visa affiliate click rate | > 15% of trips needing visa |
| Action items engagement | > 1 click per trip |

---

## WHAT'S NOT IN MVP (Reminder)

- Multi-country trip visa logic
- Mixed passport group handling
- Visa concierge service
- User accounts
- Subscription payments
- B2B API

These come AFTER validating that users find the Certainty Score valuable.

---

*Ready to build? Start with Phase 1: Backend changes.*
