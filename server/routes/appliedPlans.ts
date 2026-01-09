/**
 * appliedPlans.ts
 *
 * Routes for persisting and retrieving applied change plans.
 * Enables shareable links that can restore banner state.
 *
 * POST /api/trips/:tripId/applied-plans - Store applied plan summary
 * GET /api/trips/:tripId/applied-plans/:changeId - Fetch stored plan
 */

import type { Request, Response, Router } from "express";
import express from "express";
import { db } from "../db";
import { tripAppliedPlans } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const router: Router = express.Router();

// Maximum payload size for plan summary (50KB)
const MAX_PAYLOAD_SIZE = 50_000;

// ---------------------------------------------------------------------------
// POST /api/trips/:tripId/applied-plans - Store applied plan
// ---------------------------------------------------------------------------
router.post("/trips/:tripId/applied-plans", async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.tripId, 10);
  if (isNaN(tripId)) {
    return res.status(400).json({ ok: false, error: "Invalid tripId" });
  }

  const { changeId, source, planSummary } = req.body || {};

  // Validate required fields
  if (!changeId || typeof changeId !== "string") {
    return res.status(400).json({ ok: false, error: "Missing or invalid changeId" });
  }
  if (!source || typeof source !== "string") {
    return res.status(400).json({ ok: false, error: "Missing or invalid source" });
  }
  if (!planSummary || typeof planSummary !== "object") {
    return res.status(400).json({ ok: false, error: "Missing planSummary" });
  }

  const { detectedChanges, deltaSummary, failures, uiInstructions } = planSummary;

  if (!Array.isArray(detectedChanges)) {
    return res.status(400).json({ ok: false, error: "detectedChanges must be an array" });
  }
  if (!deltaSummary || typeof deltaSummary !== "object") {
    return res.status(400).json({ ok: false, error: "deltaSummary is required" });
  }

  // Check payload size
  const payloadSize = JSON.stringify(planSummary).length;
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    return res.status(413).json({
      ok: false,
      error: `Plan summary too large (${payloadSize} bytes, max ${MAX_PAYLOAD_SIZE})`,
    });
  }

  try {
    // Upsert: insert or update if exists
    await db
      .insert(tripAppliedPlans)
      .values({
        tripId,
        changeId,
        source,
        detectedChanges,
        deltaSummary,
        failures: failures || null,
        uiInstructions: uiInstructions || null,
        appliedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [tripAppliedPlans.tripId, tripAppliedPlans.changeId],
        set: {
          source,
          detectedChanges,
          deltaSummary,
          failures: failures || null,
          uiInstructions: uiInstructions || null,
          appliedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    console.log(`[appliedPlans] Stored plan ${changeId} for trip ${tripId}`);

    return res.json({
      ok: true,
      tripId: tripId.toString(),
      changeId,
    });
  } catch (err: any) {
    console.error("[appliedPlans] Failed to store plan:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to store applied plan",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/trips/:tripId/applied-plans/:changeId - Fetch stored plan
// ---------------------------------------------------------------------------
router.get("/trips/:tripId/applied-plans/:changeId", async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.tripId, 10);
  const { changeId } = req.params;

  if (isNaN(tripId)) {
    return res.status(400).json({ ok: false, error: "Invalid tripId" });
  }
  if (!changeId) {
    return res.status(400).json({ ok: false, error: "Missing changeId" });
  }

  try {
    const [row] = await db
      .select()
      .from(tripAppliedPlans)
      .where(
        and(
          eq(tripAppliedPlans.tripId, tripId),
          eq(tripAppliedPlans.changeId, changeId)
        )
      );

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: "Applied plan not found",
      });
    }

    return res.json({
      ok: true,
      tripId: row.tripId.toString(),
      changeId: row.changeId,
      source: row.source,
      appliedAt: row.appliedAt?.toISOString() || new Date().toISOString(),
      detectedChanges: row.detectedChanges || [],
      deltaSummary: row.deltaSummary,
      failures: row.failures || undefined,
      uiInstructions: row.uiInstructions || undefined,
    });
  } catch (err: any) {
    console.error("[appliedPlans] Failed to fetch plan:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to fetch applied plan",
    });
  }
});

export default router;
