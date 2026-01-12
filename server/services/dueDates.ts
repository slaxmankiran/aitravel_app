/**
 * Due Date Calculator
 *
 * Computes "Apply by X date" for action items based on travel date
 * and processing time requirements.
 *
 * Server-side only - UI should only render, not compute.
 */

export interface DueDateInput {
  travelStartDateISO: string;        // "2026-02-15"
  processingDaysMax?: number | null; // e.g., 30 for visa
  processingDaysMin?: number | null; // e.g., 10 for visa
  bufferDays?: number;               // default 7
}

export interface DueDateResult {
  applyByDate: string | null;        // "2026-01-08" or null if not applicable
  daysUntilDeadline: number | null;  // days from now until applyByDate
  urgency: 'critical' | 'urgent' | 'normal' | 'relaxed' | null;
  recommendation: string | null;     // "Apply within 2 weeks"
}

/**
 * Compute the "apply by" date for a visa or document.
 *
 * Logic:
 * - applyByDate = travelStartDate - (processingDaysMax + bufferDays)
 * - bufferDays accounts for unexpected delays
 */
export function computeApplyByDate(input: DueDateInput): string | null {
  const { travelStartDateISO, processingDaysMax, bufferDays = 7 } = input;

  if (!processingDaysMax || processingDaysMax === 0) return null;

  const travelStart = new Date(travelStartDateISO);
  if (isNaN(travelStart.getTime())) return null;

  const applyBy = new Date(travelStart);
  applyBy.setDate(applyBy.getDate() - (processingDaysMax + bufferDays));

  return applyBy.toISOString().slice(0, 10);
}

/**
 * Compute full due date info including urgency level.
 */
export function computeDueDate(input: DueDateInput): DueDateResult {
  const applyByDate = computeApplyByDate(input);

  if (!applyByDate) {
    return {
      applyByDate: null,
      daysUntilDeadline: null,
      urgency: null,
      recommendation: null,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadline = new Date(applyByDate);
  const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Determine urgency
  let urgency: DueDateResult['urgency'];
  let recommendation: string;

  if (daysUntilDeadline < 0) {
    urgency = 'critical';
    recommendation = `Deadline passed ${Math.abs(daysUntilDeadline)} days ago. Apply immediately or consider changing dates.`;
  } else if (daysUntilDeadline <= 7) {
    urgency = 'critical';
    recommendation = `Apply immediately. Only ${daysUntilDeadline} days until deadline.`;
  } else if (daysUntilDeadline <= 14) {
    urgency = 'urgent';
    recommendation = `Apply within this week. ${daysUntilDeadline} days until deadline.`;
  } else if (daysUntilDeadline <= 30) {
    urgency = 'normal';
    recommendation = `Apply within 2 weeks. ${daysUntilDeadline} days until deadline.`;
  } else {
    urgency = 'relaxed';
    recommendation = `You have time. Apply by ${applyByDate}.`;
  }

  return {
    applyByDate,
    daysUntilDeadline,
    urgency,
    recommendation,
  };
}

/**
 * Parse travel start date from various date string formats.
 * Returns ISO date string "YYYY-MM-DD" or null if unparseable.
 */
export function parseTravelStartDate(dates: string | null | undefined): string | null {
  if (!dates) return null;

  // Try ISO format first: "2026-02-15" or "2026-02-15 to 2026-02-22"
  const isoMatch = dates.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // Try "Feb 15, 2026" or "February 15, 2026"
  const monthNameMatch = dates.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthNameMatch) {
    const monthNames: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const monthNum = monthNames[monthNameMatch[1].toLowerCase()];
    if (monthNum !== undefined) {
      const d = new Date(parseInt(monthNameMatch[3]), monthNum, parseInt(monthNameMatch[2]));
      return d.toISOString().slice(0, 10);
    }
  }

  // Try "2/15/2026" (US format)
  const usMatch = dates.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    const d = new Date(parseInt(usMatch[3]), parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    return d.toISOString().slice(0, 10);
  }

  // Try flexible format: "February 2026, 7 days" - assume 15th of month
  const flexMatch = dates.match(/([A-Za-z]+)\s+(\d{4})/);
  if (flexMatch) {
    const monthNames: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const monthNum = monthNames[flexMatch[1].toLowerCase()];
    if (monthNum !== undefined) {
      const d = new Date(parseInt(flexMatch[2]), monthNum, 15); // Assume mid-month
      return d.toISOString().slice(0, 10);
    }
  }

  return null;
}

/**
 * Build action item due dates from visa details.
 */
export function buildVisaDueDates(
  visaDetails: { processingDays?: { minimum?: number; maximum?: number } } | null | undefined,
  travelDates: string | null | undefined
): DueDateResult | null {
  if (!visaDetails?.processingDays?.maximum) return null;

  const travelStartISO = parseTravelStartDate(travelDates);
  if (!travelStartISO) return null;

  return computeDueDate({
    travelStartDateISO: travelStartISO,
    processingDaysMax: visaDetails.processingDays.maximum,
    processingDaysMin: visaDetails.processingDays.minimum,
    bufferDays: 7,
  });
}
