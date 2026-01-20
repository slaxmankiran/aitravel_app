# Director Agent - Browser Verification Tests

**Server:** http://localhost:3000
**Status:** ✅ Running
**Date:** 2026-01-13

---

## Prerequisites

1. **Open browser:** Navigate to http://localhost:3000
2. **Find a trip:** Go to "My Trips" and open any trip with a complete itinerary
   - OR create a new trip if none exist
3. **Open the AI Co-Pilot:** Click the cost button (bottom-right) to open LogisticsDrawer
4. **Open DevTools:** Press `Cmd+Option+I` (Mac) or `F12` (Windows/Linux) for console logs

---

## Test 1: Route Optimization Logic ✅

**Goal:** Verify the TSP algorithm reorders activities for less walking

### Steps:

1. **Open AI Co-Pilot panel** (click $ button bottom-right)
2. In the console textarea, type:
   ```
   Optimize the route for Day 1
   ```
3. Click **Send** or press **Enter**

### Expected Behavior:

#### Processing State:
- [ ] See animated processing card with 3 steps:
  - 🧠 Analyzing itinerary...
  - 🔍 Finding alternatives...
  - ✨ Updating plan...

#### Console Logs (Check DevTools):
```
[Modifier] Analyzing: "Optimize the route for Day 1"
[Modifier] Intent: OPTIMIZE_ROUTE
[Modifier] Complete: Route optimized (saved X km) OR Route is already optimal
[LogisticsDrawer] Modification complete: <summary>
[LogisticsDrawer] Reasoning: [array of steps]
```

#### Visual Changes:
- [ ] **Activity order changes** (if route was suboptimal)
- [ ] **Map markers rearrange** (lines become straighter)
- [ ] **Distance badges update** (if showing distances)
- [ ] Processing completes in **~1-2 seconds**

#### Result:
If activities were already optimal: "Route is already optimal"
If changes made: "Reordered X activities, saved Y km"

---

## Test 2: Budget Squeeze Logic ✅

**Goal:** Verify budget analyzer identifies expensive items and suggests swaps

### Steps:

1. **Open AI Co-Pilot panel**
2. Type:
   ```
   Save me money on this trip
   ```
   OR
   ```
   Find cheaper alternatives
   ```
3. Click **Send**

### Expected Behavior:

#### Processing State:
- [ ] Animated processing card (3 steps)

#### Console Logs:
```
[Modifier] Analyzing: "Save me money on this trip"
[Modifier] Intent: REDUCE_BUDGET
[Modifier] Complete: Budget is already optimized OR Saved $X by swapping Y items
```

#### Reasoning Display (Critical for this test):
Look for **specific swap details** in the console reasoning array:
- [ ] **Example:** "Swapped Private Transfer ($80) for Express Train ($15)"
- [ ] **Example:** "Replaced Fine Dining ($120) with Local Restaurant ($35)"
- [ ] **NOT generic:** "Made changes to reduce cost" ❌

#### Visual Changes:
- [ ] **Activity names change** (if swaps made)
- [ ] **Cost badges update** (lower amounts)
- [ ] **Grand total drops** (check bottom right $ button)
- [ ] Processing completes in **~1-2 seconds** (if no expensive items)
- [ ] OR **~30-60 seconds** (if AI replacements needed)

#### Result:
If already optimized: "Budget is already optimized - no expensive activities found"
If changes made: "Saved $X" with specific reasoning

---

## Test 3: Persistence Verification ✅ **CRITICAL**

**Goal:** Verify database saves persist across page refreshes

### Steps:

1. **Make ANY modification** using Tests 1 or 2 above
2. **Wait for completion** (see "Complete!" message)
3. **Note the changes:**
   - Write down an activity name that changed
   - Note the new total cost
4. **Refresh the page** (press `Cmd+R` or `F5`)
5. **Wait for page to reload**

### Expected Behavior:

#### After Refresh:
- [ ] **Changes persist** (modified activity still has new name/order)
- [ ] **Cost persists** (grand total matches post-modification value)
- [ ] **Map matches** (if route was optimized, markers still in new order)

#### ❌ FAILURE INDICATORS:
- Changes disappear after refresh
- Old itinerary comes back
- Cost resets to original value

**If this happens:** We have a database save issue in the `/api/trips/:id/modify` endpoint.

---

## Test 4: Add Activity (Generative Edit) 🎨

**Bonus test for image curation verification**

### Steps:

1. **Open AI Co-Pilot panel**
2. Type:
   ```
   Add a local market on day 2 morning
   ```
   OR
   ```
   Add a sunset cruise on day 3 evening
   ```
3. Click **Send**

### Expected Behavior:

#### Processing State:
- [ ] Processing takes **~60-90 seconds** (full LLM generation)

#### Console Logs:
```
[Modifier] Intent: ADD_ACTIVITY
[Modifier] Complete: Applied semantic edit: Add a <activity> on day X <time>
```

#### Visual Changes:
- [ ] **New activity appears** in the specified day/time slot
- [ ] **Activity has proper details:**
  - Name (e.g., "Chatuchak Weekend Market")
  - Time (e.g., "09:00")
  - Cost (e.g., "$15")
  - Location with coordinates
- [ ] **Image loads** (either Unsplash photo or emoji fallback)
- [ ] **Cost increases** (grand total updates)
- [ ] **Map marker appears** for new activity

#### Image Verification (Photo Curation):
- [ ] If image loads: Should be relevant (market photo for "local market")
- [ ] If emoji fallback: Should match activity type (🏛️ for activity, 🍜 for meal)

---

## Success Criteria Summary

| Test | Pass Criteria | Processing Time | Changes Visible |
|------|--------------|----------------|----------------|
| **Route Optimization** | Intent: OPTIMIZE_ROUTE, order changes or "already optimal" | ~1-2s | Map lines, activity order |
| **Budget Squeeze** | Intent: REDUCE_BUDGET, specific swap reasoning | ~1-2s | Activity names, costs |
| **Persistence** | Changes survive page refresh | N/A | All modifications persist |
| **Add Activity** | Intent: ADD_ACTIVITY, new activity appears | ~60-90s | New row, image, map marker |

---

## Debugging Tips

### If Tests Fail:

#### Test 1 (Route) Issues:
- **No changes:** Route may already be optimal
- **Error:** Check if activities have coordinates
- **Console:** Look for geospatial calculation errors

#### Test 2 (Budget) Issues:
- **No swaps:** All activities may be under $50 threshold
- **Generic reasoning:** Check AI response format in server logs
- **Error:** Verify Deepseek API key is valid

#### Test 3 (Persistence) Issues:
- **Changes lost:** Database save failed in `/api/trips/:id/modify`
- **Check logs:** Look for "Trip X updated in database" message
- **Fix:** Verify `storage.updateTripItinerary()` is being called

#### Test 4 (Add Activity) Issues:
- **Long processing:** Normal for generative edits (60-90s)
- **No image:** Check network tab for Unsplash requests
- **Error:** Verify activity has proper structure (name, time, coordinates)

### Server Logs to Monitor:

```bash
# Watch server logs in real-time:
tail -f /tmp/claude/-Volumes-Personal-Stuff-Learning-Material-AI-Related-AI-Travel-Replit/tasks/b77b012.output

# Look for these patterns:
[Modifier] Intent: <intent_type>
[Modifier] Complete: <summary>
[ModifyAPI] Trip X updated in database
```

---

## Expected Console Output (Example)

```javascript
// Test 1: Route Optimization
[Modifier] Analyzing: "Optimize the route for Day 1"
[Modifier] Intent: OPTIMIZE_ROUTE
[Modifier] Complete: Reordered 4 activities, saved 2.3 km (1672ms)
[LogisticsDrawer] Modification complete: Reordered 4 activities, saved 2.3 km
[LogisticsDrawer] Reasoning: [
  "Day 1: Moved activity B before activity C (1.2 km saved)",
  "Day 1: Moved activity D to end (1.1 km saved)"
]

// Test 2: Budget Squeeze
[Modifier] Analyzing: "Save me money on this trip"
[Modifier] Intent: REDUCE_BUDGET
[Modifier] Complete: Saved $150 by swapping 2 activities (34523ms)
[LogisticsDrawer] Modification complete: Saved $150 by swapping 2 activities
[LogisticsDrawer] Reasoning: [
  "Swapped Private Transfer ($80) for Express Train ($15)",
  "Replaced Fine Dining ($120) with Local Restaurant ($65)"
]
```

---

## Next Steps After Testing

### If All Tests Pass ✅:
1. Document any interesting findings (e.g., "Route optimizer saved 5km on Day 2")
2. Take screenshots of:
   - Processing state animation
   - Before/after map comparison
   - Console reasoning output
3. Ready for production deployment preparation

### If Any Test Fails ❌:
1. Note which test failed and exact error message
2. Share console logs + server logs
3. Describe expected vs actual behavior
4. We'll debug together

---

## Performance Benchmarks (Reference)

Based on API tests:

| Intent Type | Expected Time | Max Time | Status |
|-------------|--------------|----------|--------|
| OPTIMIZE_ROUTE | ~1.4s | 3s | ✅ Deterministic |
| REDUCE_BUDGET (no items) | ~1.2s | 3s | ✅ Fast scan |
| REDUCE_BUDGET (with swaps) | ~30-60s | 120s | ✅ AI calls |
| CHANGE_PACE | ~1.3s | 3s | ✅ Density check |
| ADD_ACTIVITY | ~60-90s | 180s | ✅ Generative |
| REMOVE_ACTIVITY | ~45-60s | 180s | ✅ Generative |

If processing takes significantly longer, check:
- Network connection (Deepseek API)
- Server logs for errors
- Browser console for frontend issues

---

**Ready to test! Open http://localhost:3000 and start with Test 1.**
