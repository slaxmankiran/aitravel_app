/**
 * versions.ts
 *
 * Routes for trip version history (Item 18).
 * Enables users to see version timeline, restore previous versions, and export any version.
 *
 * POST /api/trips/:tripId/versions - Create/upsert a version
 * GET /api/trips/:tripId/versions - List versions (newest first)
 * POST /api/trips/:tripId/versions/:versionId/restore - Restore a version
 * GET /api/trips/:tripId/versions/:versionId - Get single version
 */

import type { Request, Response, Router } from "express";
import express from "express";
import { db } from "../db";
import { tripVersions, trips } from "@shared/schema";
import type { VersionSnapshot, VersionSummary, VersionSource, TripVersionResponse } from "@shared/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";

const router: Router = express.Router();

// Maximum payload size for snapshot (500KB - includes full itinerary)
const MAX_SNAPSHOT_SIZE = 500_000;

// ---------------------------------------------------------------------------
// Helper: Check trip ownership (soft guard)
// Returns trip if access allowed, null if denied
// ---------------------------------------------------------------------------
async function checkTripOwnership(tripId: number, req: Request): Promise<{ allowed: boolean; trip: any | null }> {
  const voyageUid = req.headers['x-voyage-uid'] as string | undefined;

  const [trip] = await db.select().from(trips).where(eq(trips.id, tripId));
  if (!trip) {
    return { allowed: false, trip: null };
  }

  // If trip has voyageUid and it doesn't match request, deny access
  // Legacy trips (null voyageUid) are accessible to everyone (for share links)
  if (trip.voyageUid && voyageUid && trip.voyageUid !== voyageUid) {
    return { allowed: false, trip: null };
  }

  return { allowed: true, trip };
}

// ---------------------------------------------------------------------------
// POST /api/trips/:tripId/versions - Create or upsert a version
// ---------------------------------------------------------------------------
router.post("/trips/:tripId/versions", async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId)) {
    return res.status(400).json({ ok: false, error: "Invalid tripId" });
  }

  // Ownership check
  const { allowed } = await checkTripOwnership(tripId, req);
  if (!allowed) {
    return res.status(404).json({ ok: false, error: "Trip not found" });
  }

  const { source, changeId, label, snapshot, summary } = req.body || {};

  // Validate required fields
  if (!source || !["change_plan", "next_fix", "manual_save", "system", "restore"].includes(source)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing source" });
  }
  if (!snapshot || typeof snapshot !== "object") {
    return res.status(400).json({ ok: false, error: "Missing or invalid snapshot" });
  }
  if (!summary || typeof summary !== "object") {
    return res.status(400).json({ ok: false, error: "Missing or invalid summary" });
  }

  // Validate snapshot structure
  if (!snapshot.inputs || !snapshot.costs || !snapshot.certainty || !snapshot.itinerarySummary) {
    return res.status(400).json({ ok: false, error: "Incomplete snapshot - missing required fields" });
  }

  // Check payload size
  const payloadSize = JSON.stringify(snapshot).length;
  if (payloadSize > MAX_SNAPSHOT_SIZE) {
    return res.status(413).json({
      ok: false,
      error: `Snapshot too large (${payloadSize} bytes, max ${MAX_SNAPSHOT_SIZE})`,
    });
  }

  try {
    let versionId: number;

    // If changeId provided, upsert (prevents duplicates from same change plan)
    if (changeId) {
      // Check if version exists
      const [existing] = await db
        .select({ id: tripVersions.id })
        .from(tripVersions)
        .where(
          and(
            eq(tripVersions.tripId, tripId),
            eq(tripVersions.changeId, changeId)
          )
        );

      if (existing) {
        // Update existing version
        await db
          .update(tripVersions)
          .set({
            source: source as VersionSource,
            label: label || null,
            snapshot,
            summary,
            createdAt: new Date(), // Update timestamp on upsert
          })
          .where(eq(tripVersions.id, existing.id));

        versionId = existing.id;
        console.log(`[versions] Updated version ${versionId} for trip ${tripId} (changeId: ${changeId})`);
      } else {
        // Insert new version
        const [inserted] = await db
          .insert(tripVersions)
          .values({
            tripId,
            source: source as VersionSource,
            changeId,
            label: label || null,
            snapshot,
            summary,
          })
          .returning({ id: tripVersions.id });

        versionId = inserted.id;
        console.log(`[versions] Created version ${versionId} for trip ${tripId} (changeId: ${changeId})`);
      }
    } else {
      // No changeId - always insert (manual saves, system saves)
      const [inserted] = await db
        .insert(tripVersions)
        .values({
          tripId,
          source: source as VersionSource,
          changeId: null,
          label: label || null,
          snapshot,
          summary,
        })
        .returning({ id: tripVersions.id });

      versionId = inserted.id;
      console.log(`[versions] Created version ${versionId} for trip ${tripId} (manual/system save)`);
    }

    return res.status(201).json({
      ok: true,
      versionId,
      tripId,
      changeId: changeId || null,
    });
  } catch (err: any) {
    console.error("[versions] Failed to create version:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to create version",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/trips/:tripId/versions - List versions (newest first)
// ---------------------------------------------------------------------------
router.get("/trips/:tripId/versions", async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId)) {
    return res.status(400).json({ ok: false, error: "Invalid tripId" });
  }

  // Ownership check
  const { allowed } = await checkTripOwnership(tripId, req);
  if (!allowed) {
    return res.status(404).json({ ok: false, error: "Trip not found" });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const includeSnapshot = req.query.includeSnapshot === "true";

  try {
    const rows = await db
      .select({
        id: tripVersions.id,
        tripId: tripVersions.tripId,
        createdAt: tripVersions.createdAt,
        source: tripVersions.source,
        changeId: tripVersions.changeId,
        label: tripVersions.label,
        summary: tripVersions.summary,
        snapshot: tripVersions.snapshot,
        isPinned: tripVersions.isPinned,
      })
      .from(tripVersions)
      .where(eq(tripVersions.tripId, tripId))
      .orderBy(desc(tripVersions.createdAt))
      .limit(limit);

    const versions: TripVersionResponse[] = rows.map((row: typeof rows[number]) => ({
      id: row.id,
      tripId: row.tripId,
      createdAt: row.createdAt.toISOString(),
      source: row.source as VersionSource,
      changeId: row.changeId || undefined,
      label: row.label || undefined,
      summary: row.summary as VersionSummary,
      snapshot: includeSnapshot ? (row.snapshot as VersionSnapshot) : ({} as VersionSnapshot),
      isPinned: row.isPinned || false,
    }));

    return res.json({
      ok: true,
      tripId,
      count: versions.length,
      versions,
    });
  } catch (err: any) {
    console.error("[versions] Failed to list versions:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to list versions",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/trips/:tripId/versions/:versionId - Get single version with snapshot
// ---------------------------------------------------------------------------
router.get("/trips/:tripId/versions/:versionId", async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.tripId, 10);
  const versionId = parseInt(req.params.versionId, 10);

  if (isNaN(tripId) || isNaN(versionId)) {
    return res.status(400).json({ ok: false, error: "Invalid tripId or versionId" });
  }

  // Ownership check
  const { allowed } = await checkTripOwnership(tripId, req);
  if (!allowed) {
    return res.status(404).json({ ok: false, error: "Trip not found" });
  }

  try {
    const [row] = await db
      .select()
      .from(tripVersions)
      .where(
        and(
          eq(tripVersions.tripId, tripId),
          eq(tripVersions.id, versionId)
        )
      );

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: "Version not found",
      });
    }

    const version: TripVersionResponse = {
      id: row.id,
      tripId: row.tripId,
      createdAt: row.createdAt.toISOString(),
      source: row.source as VersionSource,
      changeId: row.changeId || undefined,
      label: row.label || undefined,
      summary: row.summary as VersionSummary,
      snapshot: row.snapshot as VersionSnapshot,
      isPinned: row.isPinned || false,
    };

    return res.json({
      ok: true,
      version,
    });
  } catch (err: any) {
    console.error("[versions] Failed to get version:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to get version",
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/trips/:tripId/versions/:versionId/restore - Restore a version
// ---------------------------------------------------------------------------
router.post("/trips/:tripId/versions/:versionId/restore", async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.tripId, 10);
  const versionId = parseInt(req.params.versionId, 10);

  if (isNaN(tripId) || isNaN(versionId)) {
    return res.status(400).json({ ok: false, error: "Invalid tripId or versionId" });
  }

  // Ownership check
  const { allowed } = await checkTripOwnership(tripId, req);
  if (!allowed) {
    return res.status(404).json({ ok: false, error: "Trip not found" });
  }

  try {
    // Fetch the version to restore
    const [version] = await db
      .select()
      .from(tripVersions)
      .where(
        and(
          eq(tripVersions.tripId, tripId),
          eq(tripVersions.id, versionId)
        )
      );

    if (!version) {
      return res.status(404).json({
        ok: false,
        error: "Version not found",
      });
    }

    const snapshot = version.snapshot as VersionSnapshot;

    // Check if snapshot has itinerary for restore
    if (!snapshot.itinerary) {
      return res.status(400).json({
        ok: false,
        error: "Version does not contain full itinerary for restore",
      });
    }

    // Fetch current trip to get feasibility report
    const [currentTrip] = await db
      .select()
      .from(trips)
      .where(eq(trips.id, tripId));

    if (!currentTrip) {
      return res.status(404).json({
        ok: false,
        error: "Trip not found",
      });
    }

    // Update trip with restored data
    // Note: We restore itinerary and some inputs, but preserve feasibility report
    await db
      .update(trips)
      .set({
        // Restore inputs
        passport: snapshot.inputs.passport,
        destination: snapshot.inputs.destination,
        dates: snapshot.inputs.dates,
        budget: snapshot.inputs.budget,
        currency: snapshot.inputs.currency,
        groupSize: snapshot.inputs.groupSize,
        adults: snapshot.inputs.adults,
        children: snapshot.inputs.children,
        infants: snapshot.inputs.infants,
        travelStyle: snapshot.inputs.travelStyle || null,
        origin: snapshot.inputs.origin || null,
        // Restore itinerary
        itinerary: snapshot.itinerary,
        // Update timestamp
        updatedAt: new Date(),
      })
      .where(eq(trips.id, tripId));

    // Generate a new changeId for undo tracking
    const restoreChangeId = `restore:${versionId}:${Date.now()}`;

    // Create a new version entry for this restore action
    const [newVersion] = await db
      .insert(tripVersions)
      .values({
        tripId,
        source: "restore" as VersionSource,
        changeId: restoreChangeId,
        label: `Restored from ${version.label || `version #${versionId}`}`,
        snapshot: snapshot, // Same snapshot
        summary: {
          chips: ["Restored from history"],
          certaintyAfter: snapshot.certainty.score,
          totalAfter: snapshot.costs.grandTotal,
          source: "restore",
        },
      })
      .returning({ id: tripVersions.id });

    console.log(`[versions] Restored trip ${tripId} to version ${versionId}, created new version ${newVersion.id}`);

    // Fetch updated trip
    const [updatedTrip] = await db
      .select()
      .from(trips)
      .where(eq(trips.id, tripId));

    return res.json({
      ok: true,
      message: "Version restored successfully",
      tripId,
      restoredFromVersionId: versionId,
      newVersionId: newVersion.id,
      changeId: restoreChangeId,
      trip: updatedTrip,
    });
  } catch (err: any) {
    console.error("[versions] Failed to restore version:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to restore version",
    });
  }
});

// ---------------------------------------------------------------------------
// Analytics helper - track version events
// ---------------------------------------------------------------------------
export function trackVersionEvent(event: string, data: Record<string, any>) {
  console.log(`[VersionEvent] ${event}`, data);
  // Future: Send to analytics service
}

export default router;
