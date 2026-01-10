# Version History Implementation (Item 18)

**Status:** Implemented
**Date:** 2026-01-09

## Overview

Trip version history enables users to see a timeline of changes, restore previous versions, and export any version as PDF. Versions are automatically created when changes are applied via the Change Planner or Fix suggestions.

---

## Database Schema

### Table: `trip_versions`

```sql
CREATE TABLE trip_versions (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  source TEXT NOT NULL,  -- 'change_plan' | 'next_fix' | 'manual_save' | 'system' | 'restore'
  change_id TEXT,        -- nullable - manual saves don't have a changeId
  label TEXT,
  snapshot JSONB NOT NULL,
  summary JSONB NOT NULL,
  is_pinned BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX trip_versions_trip_id_idx ON trip_versions(trip_id);
CREATE UNIQUE INDEX trip_versions_trip_change_id_uniq
  ON trip_versions(trip_id, change_id) WHERE change_id IS NOT NULL;
```

### TypeScript Types

```typescript
// Source of version creation
type VersionSource = "change_plan" | "next_fix" | "manual_save" | "system" | "restore";

// Snapshot of trip state at version time
interface VersionSnapshot {
  inputs: {
    passport: string;
    destination: string;
    dates: string;
    budget: number;
    currency: string;
    groupSize: number;
    adults?: number;
    children?: number;
    infants?: number;
    travelStyle?: string;
    origin?: string;
  };
  costs: {
    grandTotal: number | null;
    perPerson: number | null;
    currency: string;
    rows: Array<{ category: string; amount: number; note?: string }>;
  };
  certainty: {
    score: number;
    visaRisk: "low" | "medium" | "high";
    bufferDays?: number;
    verdict: string;
  };
  itinerarySummary: {
    totalDays: number;
    dayHeadings: string[];
    totalActivities: number;
  };
  itinerary?: any; // Full itinerary for restore capability
}

// Summary for quick display
interface VersionSummary {
  chips: string[];           // ["Dates changed", "Budget adjusted"]
  certaintyAfter?: number;   // Score after this change
  totalAfter?: number | null; // Total cost after
  source?: string;
}

// API response type
interface TripVersionResponse {
  id: number;
  tripId: number;
  createdAt: string;
  source: VersionSource;
  changeId?: string;
  label?: string;
  summary: VersionSummary;
  snapshot: VersionSnapshot;
  isPinned: boolean;
}
```

---

## API Endpoints

### POST `/api/trips/:tripId/versions`

Create or upsert a version. Uses `(tripId, changeId)` for deduplication.

**Request Body:**
```json
{
  "source": "change_plan",
  "changeId": "change_plan:123:1704825600000",
  "label": "Extended trip by 3 days",
  "snapshot": { ... },
  "summary": { "chips": ["Dates changed"], "certaintyAfter": 85 }
}
```

**Response:**
```json
{
  "ok": true,
  "versionId": 42,
  "tripId": 123,
  "changeId": "change_plan:123:1704825600000"
}
```

### GET `/api/trips/:tripId/versions`

List versions (newest first).

**Query Parameters:**
- `limit` (default: 20, max: 100)
- `includeSnapshot` (default: false) - Include full snapshot in response

**Response:**
```json
{
  "ok": true,
  "tripId": 123,
  "count": 5,
  "versions": [
    {
      "id": 42,
      "tripId": 123,
      "createdAt": "2026-01-09T10:30:00.000Z",
      "source": "change_plan",
      "changeId": "change_plan:123:1704825600000",
      "summary": { "chips": ["Dates changed"], "certaintyAfter": 85 },
      "snapshot": {},
      "isPinned": false
    }
  ]
}
```

### GET `/api/trips/:tripId/versions/:versionId`

Get a single version with full snapshot.

**Response:**
```json
{
  "ok": true,
  "version": {
    "id": 42,
    "tripId": 123,
    "createdAt": "2026-01-09T10:30:00.000Z",
    "source": "change_plan",
    "snapshot": { ... },
    "summary": { ... }
  }
}
```

### POST `/api/trips/:tripId/versions/:versionId/restore`

Restore a version. Updates the trip and creates a new "restore" version.

**Response:**
```json
{
  "ok": true,
  "message": "Version restored successfully",
  "tripId": 123,
  "restoredFromVersionId": 42,
  "newVersionId": 43,
  "changeId": "restore:42:1704825600000",
  "trip": { ... }
}
```

---

## Client Implementation

### useTripVersions Hook

Location: `client/src/hooks/useTripVersions.ts`

```typescript
const {
  versions,           // TripVersionResponse[]
  isLoading,          // boolean
  error,              // Error | null

  createVersion,      // (args) => Promise<CreateVersionResponse>
  createVersionFromTrip, // (trip, source, changeId?, chips?) => Promise
  restoreVersion,     // (versionId) => Promise<RestoreVersionResponse>
  getVersion,         // (versionId) => Promise<TripVersionResponse | null>
  refetch,            // () => void

  isCreating,         // boolean
  isRestoring,        // boolean

  isPanelOpen,        // boolean
  openPanel,          // () => void
  closePanel,         // () => void
  togglePanel,        // () => void
} = useTripVersions(tripId);
```

### Helper Functions

```typescript
// Build snapshot from trip response
function buildSnapshotFromTrip(trip: TripResponse): VersionSnapshot;

// Build summary with change chips
function buildVersionSummary(
  snapshot: VersionSnapshot,
  chips?: string[],
  source?: string
): VersionSummary;
```

---

## UI Component: VersionsPanel

Location: `client/src/components/results/VersionsPanel.tsx`

### Features

- Collapsible accordion panel in right rail
- Timeline view of versions
- Each version shows:
  - Relative timestamp ("2h ago", "Yesterday")
  - Source indicator (AI Change, Quick Fix, Saved, Restored, Auto)
  - Change chips ("Dates changed", "Budget adjusted")
  - Certainty score and total cost
- Actions (hover to reveal):
  - Restore version
  - Export as PDF
  - Copy share link
- Current version highlighted with green badge

### Placement

In `RightRailPanels.tsx`, between Action Items and Modify with AI panels:

```tsx
{!isDemo && (
  <VersionsPanel
    tripId={trip.id}
    onRestore={onVersionRestore}
    onExport={onVersionExport}
  />
)}
```

---

## Version Creation Flow

### Automatic Version Creation

Versions are automatically created when:

1. **Change Planner applies changes** (`useChangePlanner.ts`)
   - Source: `"change_plan"`
   - Triggered in `applyChanges()` via `onVersionCreate` callback

2. **Fix suggestions are applied** (`applyFix.ts`)
   - Source: `"next_fix"`
   - Triggered through ApplyFixContext

3. **Undo is performed** (`TripResultsV1.tsx`)
   - Source: `"change_plan"` (undo is a reverse change)

### Integration Points

**useChangePlanner.ts:**
```typescript
applyChanges({
  tripId,
  plan,
  setWorkingTrip,
  setBannerPlan,
  source: "fix_blocker",
  onVersionCreate: handleVersionCreate,  // NEW
});
```

**TripResultsV1.tsx:**
```typescript
const { createVersion } = useTripVersions(tripId);

const handleVersionCreate = useCallback(async (args) => {
  await createVersion(args);
}, [createVersion]);
```

---

## Export Integration

### Version Export

Export any version as PDF: `/trips/:id/export?version=<versionId>`

**TripExport.tsx changes:**
- Parse `version` query parameter
- Fetch version snapshot from `/api/trips/:id/versions/:versionId`
- Merge snapshot data into trip before building export model

### Share Links

Copy version-specific link: `/trips/:id/results-v1?version=<versionId>`

---

## Analytics Events

| Event | When | Data |
|-------|------|------|
| `version_created` | Version saved | `versionId`, `changeId` |
| `versions_opened` | Panel opened | `count` |
| `version_restored` | Version restored | `restoredFromVersionId`, `newVersionId` |
| `version_exported` | Export clicked | `versionId` |
| `version_link_copied` | Share link copied | `versionId` |

---

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | `tripVersions` table + types |
| `server/routes/versions.ts` | API endpoints |
| `client/src/hooks/useTripVersions.ts` | React hook |
| `client/src/components/results/VersionsPanel.tsx` | UI component |

### Modified Files

| File | Changes |
|------|---------|
| `server/routes.ts` | Registered versions router |
| `client/src/hooks/useChangePlanner.ts` | Added `onVersionCreate` callback |
| `client/src/lib/applyFix.ts` | Added `onVersionCreate` to context |
| `client/src/pages/TripResultsV1.tsx` | Integrated version creation |
| `client/src/components/results/RightRailPanels.tsx` | Added VersionsPanel |
| `client/src/pages/TripExport.tsx` | Version query param support |

---

## Database Migration

Run schema push after changes:

```bash
DATABASE_URL="postgres://voyageai:voyageai@localhost:5432/voyageai" npx drizzle-kit push
```

---

## Testing Checklist

- [ ] Version created on Change Planner apply
- [ ] Version created on Fix suggestion apply
- [ ] Version created on Undo
- [ ] Versions list shows in panel
- [ ] Restore version works
- [ ] Export version works (PDF with version data)
- [ ] Copy share link works
- [ ] Deduplication works (same changeId updates existing)
- [ ] Analytics events fire correctly

---

## Future Enhancements

1. **Manual Save Button** - "Save current state" in HeaderBar
2. **Pin Versions** - Star important versions to prevent deletion
3. **Version Diff View** - Side-by-side comparison of two versions
4. **Version Limit** - Auto-prune old versions (keep last 50)
5. **Version Comments** - Add notes to versions

---

*Last Updated: 2026-01-09*
