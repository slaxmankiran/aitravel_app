# VoyageAI Execution Plan (Phased, No Jira)

Optimized for:
- Solo founder velocity
- Avoiding overbuild
- Fast beta validation

---

## PHASE 0: Product Lock (½ Day - Mandatory)

### Goal
Freeze scope so execution stays sharp.

### Deliverable: `docs/BETA_DEFINITION.md`

```
VoyageAI Beta is complete when:

1. A user can enter:
   - Passport
   - Destination
   - Dates
   - Budget

2. The system returns:
   - GO / POSSIBLE / DIFFICULT verdict
   - Visa timeline + requirements
   - True cost including visa & insurance
   - Day-by-day itinerary

3. The experience:
   - Shows visible progress within 3 seconds
   - Never shows a blank screen
   - Allows sharing a view-only link

Anything not required for this is out of scope for Beta.
```

### Stop Condition
Do not proceed until this exists.

---

## PHASE 1: Experience Foundation (Week 1)

### Goal
Make VoyageAI feel **fast, serious, and trustworthy**.

### 1. Streaming Skeleton Framework

**Why first:** Perceived speed fixes everything else.

**Build:**
- Global loading orchestration
- Section-level skeletons: Visa, Cost, Itinerary
- Progressive reveal

**Success Criteria:**
- User sees progress within 2-3 seconds
- No empty page ever renders

### 2. Verdict Card (Your Moat)

**Build:**
- Verdict banner (GO / POSSIBLE / DIFFICULT)
- Confidence score
- Risk explanation

**Rules:**
- Verdict always visible above itinerary
- Language is factual, not apologetic

**Success Criteria:**
- A non-technical user understands the verdict without explanation

### 3. True Cost Sidebar

**Build:**
- Sticky cost panel
- Visa + insurance always included
- Budget overrun detection

**Success Criteria:**
- User can immediately answer: "Am I over budget? And why?"

### Phase 1 Exit Checklist
- [ ] Streaming works
- [ ] Verdict is clear
- [ ] Cost feels honest
- [ ] App feels fast

**If any box is unchecked, do not move on.**

---

## PHASE 2: Functional Itinerary (Week 2)

### Goal
Make the plan usable, not beautiful.

### 4. Day Card System

**Build:**
- Day 1, Day 2, etc.
- Morning / Afternoon / Evening
- Cost per activity

**Constraints:**
- One image per activity max
- No drag and drop
- No personalization yet

**Success Criteria:**
- User can realistically follow the plan on a real trip

### 5. Action Items Checklist

**Build:**
- Required vs Recommended
- Visa steps always listed
- Pre-trip tasks only

**Success Criteria:**
- User understands what must be done before travel

### Phase 2 Exit Checklist
- [ ] Itinerary is readable
- [ ] Costs are visible per day
- [ ] Action items feel practical

---

## PHASE 3: Share & Validate (Week 3)

### Goal
Let the product speak for itself.

### 6. Share View (View-Only)

**Build:**
- Shareable URL
- View-only rendering
- CTA: "Plan your own trip"

**Rules:**
- No auth
- No edit affordances

**Success Criteria:**
- Link works in incognito
- Viewer clearly understands this is view-only

### 7. Lightweight Analytics

**Track:**
- Time to first result
- Verdict distribution
- Share clicks
- Drop-offs

**Success Criteria:**
- You know where users hesitate

### Phase 3 Exit Checklist
- [ ] Trips are shareable
- [ ] Users click share organically
- [ ] You can observe usage patterns

---

## PHASE 4: Polishing Only After Signal (Week 4+)

**Proceed only if:**
- Users trust the verdict
- They comment on cost realism
- They share links

### Optional Enhancements
- Activity images (Unsplash)
- Budget suggestions
- Preference capture
- URL paste import

These are **amplifiers**, not foundations.

---

## Daily Work Loop

Forget "tasks". Use this loop:

1. Pick one Phase objective
2. Implement end-to-end
3. Test with real data
4. Share with 1-2 users
5. Adjust
6. Move on

---

## Why This Will Work

- You are not competing on beauty
- You are not racing feature parity
- You are validating **trust**
- You are shipping in layers that compound

Most travel AI tools feel exciting for 5 minutes.
VoyageAI should feel **reliable after 30 seconds**.
