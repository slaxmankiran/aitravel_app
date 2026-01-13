/**
 * Speculative Execution Service
 *
 * The "Magic Trick" - Start itinerary generation BEFORE user clicks "Plan Trip"
 * when feasibility score is high (> 80).
 *
 * By the time user reviews feasibility and clicks "Plan Trip", the first few days
 * are already generated and waiting. This makes itinerary appear "instant".
 *
 * Strategy:
 * - Track which trips have speculative generation in progress
 * - Generate first 2-3 days speculatively (enough to show instant results)
 * - Full generation continues when user explicitly requests it
 */

// ============================================================================
// TYPES
// ============================================================================

interface SpeculativeJob {
  tripId: number;
  startedAt: number;
  status: 'running' | 'complete' | 'aborted';
  daysGenerated: number;
}

// ============================================================================
// STATE
// ============================================================================

const speculativeJobs = new Map<number, SpeculativeJob>();

// Score threshold for triggering speculative execution
const SPECULATIVE_SCORE_THRESHOLD = 80;

// Maximum speculative days to generate (rest comes from full request)
const MAX_SPECULATIVE_DAYS = 3;

// Cleanup old jobs after 10 minutes
const JOB_TTL_MS = 10 * 60 * 1000;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if speculative execution should be triggered
 */
export function shouldTriggerSpeculative(
  overall: string,
  score: number
): boolean {
  return overall === 'yes' && score >= SPECULATIVE_SCORE_THRESHOLD;
}

/**
 * Mark speculative job as started
 */
export function startSpeculativeJob(tripId: number): void {
  speculativeJobs.set(tripId, {
    tripId,
    startedAt: Date.now(),
    status: 'running',
    daysGenerated: 0,
  });
  console.log(`[Speculative] Started for trip ${tripId}`);
}

/**
 * Update speculative job progress
 */
export function updateSpeculativeJob(tripId: number, daysGenerated: number): void {
  const job = speculativeJobs.get(tripId);
  if (job) {
    job.daysGenerated = daysGenerated;
    if (daysGenerated >= MAX_SPECULATIVE_DAYS) {
      job.status = 'complete';
      console.log(`[Speculative] Complete for trip ${tripId} (${daysGenerated} days)`);
    }
  }
}

/**
 * Check if speculative execution is in progress for a trip
 */
export function hasSpeculativeJob(tripId: number): boolean {
  const job = speculativeJobs.get(tripId);
  return job?.status === 'running';
}

/**
 * Get speculative job status
 */
export function getSpeculativeJob(tripId: number): SpeculativeJob | null {
  return speculativeJobs.get(tripId) || null;
}

/**
 * Abort speculative job (e.g., if user navigates away)
 */
export function abortSpeculativeJob(tripId: number): void {
  const job = speculativeJobs.get(tripId);
  if (job && job.status === 'running') {
    job.status = 'aborted';
    console.log(`[Speculative] Aborted for trip ${tripId}`);
  }
}

/**
 * Clean up old jobs
 */
export function cleanupOldJobs(): void {
  const now = Date.now();
  // Use Array.from for ES5 compatibility
  const entries = Array.from(speculativeJobs.entries());
  for (const [tripId, job] of entries) {
    if (now - job.startedAt > JOB_TTL_MS) {
      speculativeJobs.delete(tripId);
    }
  }
}

/**
 * Get max speculative days constant
 */
export function getMaxSpeculativeDays(): number {
  return MAX_SPECULATIVE_DAYS;
}

/**
 * Get stats for monitoring
 */
export function getSpeculativeStats(): {
  activeJobs: number;
  completedJobs: number;
  totalDaysGenerated: number;
} {
  let activeJobs = 0;
  let completedJobs = 0;
  let totalDaysGenerated = 0;

  // Use Array.from for ES5 compatibility
  const jobs = Array.from(speculativeJobs.values());
  for (const job of jobs) {
    if (job.status === 'running') activeJobs++;
    if (job.status === 'complete') completedJobs++;
    totalDaysGenerated += job.daysGenerated;
  }

  return { activeJobs, completedJobs, totalDaysGenerated };
}

// Run cleanup every 5 minutes
setInterval(cleanupOldJobs, 5 * 60 * 1000);
