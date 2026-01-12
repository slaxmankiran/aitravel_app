# Edit Trip Flow

## Status: Implemented with Edit-in-Place (2026-01-11)

Edit updates the SAME trip ID (industry best practice) instead of creating duplicates.

## API Endpoint

**PUT /api/trips/:id** - Updates existing trip in place
- Validates trip exists and ownership via `x-voyage-uid` header
- Resets `feasibilityStatus`, `feasibilityReport`, `itinerary` on update
- Triggers background feasibility re-analysis

## Client Hook

**`useUpdateTrip()`** in `client/src/hooks/use-trips.ts`
- Sends PUT request with updated trip data
- Invalidates React Query cache for the trip
- Shows toast on error

```typescript
export function useUpdateTrip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CreateTripRequest }) => {
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
  });
}
```

## Edit Flow

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

## Key Behaviors

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

## Files Modified

| File | Changes |
|------|---------|
| `server/storage.ts` | Added `updateTrip()` method to IStorage interface |
| `server/routes.ts` | Added `PUT /api/trips/:id` endpoint |
| `client/src/hooks/use-trips.ts` | Added `useUpdateTrip()` hook |
| `CreateTrip.tsx` | Uses update vs create based on `editTripId` |
| `FeasibilityResults.tsx` | Redirects to results (not My Trips) after edit |
| `HeaderBar.tsx` | "Trips" breadcrumb links to `/trips` |
| `TripUpdateBanner.tsx` | New component with auto-dismiss, motion animation |
