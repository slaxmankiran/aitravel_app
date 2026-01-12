/**
 * Evidence Bundle Service
 *
 * Builds compact evidence bundles from VisaFacts for AI prompts.
 * This reduces tokens, prevents hallucination, and ensures consistency
 * with the trust model.
 */

import type {
  VisaFacts,
  VisaEvidenceBundle,
  CitationLite,
  VisaCitation,
} from "../../shared/knowledgeSchema";

/**
 * Trust level ranking for sorting citations.
 */
function trustRank(t: string): number {
  if (t === "high") return 3;
  if (t === "medium") return 2;
  return 1;
}

/**
 * Build a compact visa evidence bundle from VisaFacts.
 *
 * @param visaFacts - Full VisaFacts from RAG lookup
 * @param applyByDateISO - Computed apply-by date (from due dates service)
 * @returns Compact VisaEvidenceBundle for AI prompts
 */
export function buildVisaEvidenceBundle(args: {
  visaFacts: VisaFacts;
  applyByDateISO?: string | null;
}): VisaEvidenceBundle {
  const { visaFacts, applyByDateISO } = args;

  // Sort citations by trust level (high first), then by recency
  const citationsTop3: CitationLite[] = (visaFacts.citations || [])
    .slice()
    .sort((a, b) => {
      // First sort by trust level
      const tr = trustRank(b.trustLevel) - trustRank(a.trustLevel);
      if (tr !== 0) return tr;

      // Then by recency (most recent first)
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .filter((c) => c.url) // Only include citations with valid URLs
    .slice(0, 3)
    .map((c) => ({
      sourceName: c.sourceName,
      title: c.title,
      url: c.url!, // Safe after filter
      trustLevel: c.trustLevel,
      updatedAt: c.updatedAt ?? null,
    }));

  // Map visa status to bundle format
  // Note: VisaFacts uses "evisa" but VisaEvidenceBundle also supports it
  let bundleVisaStatus: VisaEvidenceBundle["visaStatus"] = visaFacts.visaStatus as any;

  // If no citations and low confidence, mark as requires_verification
  if (visaFacts.confidence === "low" && citationsTop3.length === 0) {
    bundleVisaStatus = "requires_verification";
  }

  return {
    visaStatus: bundleVisaStatus,
    confidence: visaFacts.confidence,
    summary: visaFacts.summary,
    maxStayDays: visaFacts.maxStayDays ?? null,
    processingDaysMin: visaFacts.processingDaysMin ?? null,
    processingDaysMax: visaFacts.processingDaysMax ?? null,
    applyByDateISO: applyByDateISO ?? null,
    citations: citationsTop3,
  };
}

/**
 * Build an evidence bundle for AI-generated (estimated) visa data.
 * Used when RAG returns no results and we fall back to AI estimates.
 *
 * @param estimatedData - Partial visa data from AI
 * @param passport - Passport country
 * @param destination - Destination country
 * @returns VisaEvidenceBundle with requires_verification status
 */
export function buildEstimatedEvidenceBundle(args: {
  visaType: string;
  passport: string;
  destination: string;
  processingDaysMin?: number;
  processingDaysMax?: number;
  applyByDateISO?: string | null;
}): VisaEvidenceBundle {
  const { visaType, passport, destination, processingDaysMin, processingDaysMax, applyByDateISO } = args;

  // Map common visa types
  let bundleVisaStatus: VisaEvidenceBundle["visaStatus"] = "requires_verification";
  if (visaType === "visa_free") bundleVisaStatus = "visa_free";
  else if (visaType === "visa_on_arrival") bundleVisaStatus = "visa_on_arrival";
  else if (visaType === "e_visa" || visaType === "evisa") bundleVisaStatus = "evisa";
  else if (visaType === "embassy_visa") bundleVisaStatus = "embassy_visa";

  return {
    visaStatus: bundleVisaStatus,
    confidence: "low",
    summary: `${passport} passport holders traveling to ${destination}. Visa requirements estimated - verification required.`,
    maxStayDays: null,
    processingDaysMin: processingDaysMin ?? null,
    processingDaysMax: processingDaysMax ?? null,
    applyByDateISO: applyByDateISO ?? null,
    citations: [], // No citations for estimated data
  };
}

/**
 * Format evidence bundle as a compact string for AI prompts.
 * Designed to be token-efficient while providing all necessary facts.
 */
export function formatEvidenceBundleForPrompt(bundle: VisaEvidenceBundle): string {
  const lines: string[] = [];

  // Core facts
  lines.push(`Visa Status: ${bundle.visaStatus.replace(/_/g, " ")}`);
  lines.push(`Confidence: ${bundle.confidence}`);

  if (bundle.maxStayDays) {
    lines.push(`Max Stay: ${bundle.maxStayDays} days`);
  }

  if (bundle.processingDaysMin || bundle.processingDaysMax) {
    const min = bundle.processingDaysMin || 1;
    const max = bundle.processingDaysMax || min;
    lines.push(`Processing: ${min}-${max} days`);
  }

  if (bundle.applyByDateISO) {
    lines.push(`Apply By: ${bundle.applyByDateISO}`);
  }

  // Summary
  lines.push(`Summary: ${bundle.summary}`);

  // Citations (if any)
  if (bundle.citations.length > 0) {
    lines.push(`Sources: ${bundle.citations.map(c => c.sourceName).join(", ")}`);
  } else {
    lines.push(`Sources: None (verification required)`);
  }

  return lines.join("\n");
}
