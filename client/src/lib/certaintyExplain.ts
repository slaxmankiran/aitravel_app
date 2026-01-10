/**
 * certaintyExplain.ts
 *
 * Pure helper that transforms trip + optional ChangePlannerResponse into
 * display-ready explanation bullets for the CertaintyExplanationDrawer.
 *
 * Uses existing data:
 * - trip.feasibilityReport (score, breakdown, visaDetails, summary)
 * - optional ChangePlannerResponse (deltaSummary, detectedChanges, failures)
 */

import type { TripResponse, ChangePlannerResponse } from "@shared/schema";
import { hasVisaBlocker } from "@/lib/actionItems";

type ExplainItem = {
  title: string;
  detail?: string;
  severity?: "good" | "warn" | "bad";
};

export type CertaintyExplanation = {
  score: number;
  overall?: string;
  headline: string;
  deltaLine?: string; // "82 → 74 (-8)" if plan exists
  sections: Array<{
    title: string;
    items: ExplainItem[];
  }>;
};

function severityFromStatus(status?: string): "good" | "warn" | "bad" {
  if (!status) return "warn";
  if (status === "ok" || status === "safe" || status === "accessible") return "good";
  if (status === "warning" || status === "tight" || status === "caution" || status === "restricted") return "warn";
  return "bad";
}

function formatDelta(before?: number, after?: number): string | undefined {
  if (before == null || after == null) return undefined;
  const d = after - before;
  const sign = d > 0 ? "+" : "";
  return `${before} → ${after} (${sign}${d})`;
}

export function buildCertaintyExplanation(
  trip: TripResponse,
  changePlan?: ChangePlannerResponse | null
): CertaintyExplanation {
  const report: any = trip.feasibilityReport;
  const score = Number(report?.score ?? 0) || 0;
  const overall = report?.overall;

  const headline =
    score >= 80
      ? "High confidence. You're good to plan."
      : score >= 60
        ? "Moderate confidence. A few things need attention."
        : "Low confidence. This trip likely needs changes.";

  const deltaLine = changePlan
    ? formatDelta(
        changePlan.deltaSummary?.certainty?.before,
        changePlan.deltaSummary?.certainty?.after
      )
    : undefined;

  const breakdown = report?.breakdown || {};
  const visa = breakdown?.visa;
  const budget = breakdown?.budget;
  const safety = breakdown?.safety;
  const accessibility = breakdown?.accessibility;

  const visaDetails = report?.visaDetails;
  const visaBlocked = hasVisaBlocker(report);
  const visaTiming = visaDetails?.timing;

  const coreItems: ExplainItem[] = [];

  // Visa status
  if (visa) {
    coreItems.push({
      title: `Visa: ${visa.status === "ok" ? "OK" : "Needs attention"}`,
      detail: visa.reason,
      severity: severityFromStatus(visa.status === "ok" ? "ok" : "issue"),
    });
  } else if (visaDetails) {
    coreItems.push({
      title: `Visa: ${visaDetails.required ? "Required" : "Not required"}`,
      detail: visaDetails.required
        ? visaTiming?.recommendation || "Visa required for entry"
        : "No visa required for entry",
      severity: visaBlocked ? "bad" : "good",
    });
  }

  // Visa timing (if urgency is not ok)
  if (visaTiming?.urgency && visaTiming.urgency !== "ok") {
    coreItems.push({
      title: `Visa timing: ${visaTiming.urgency}`,
      detail: visaTiming.recommendation,
      severity: severityFromStatus(visaTiming.urgency),
    });
  }

  // Budget
  if (budget) {
    coreItems.push({
      title: `Budget: ${budget.status === "ok" ? "OK" : budget.status === "tight" ? "Tight" : "Not feasible"}`,
      detail: budget.reason,
      severity: severityFromStatus(budget.status),
    });
  }

  // Safety
  if (safety) {
    coreItems.push({
      title: `Safety: ${safety.status}`,
      detail: safety.reason,
      severity: severityFromStatus(safety.status),
    });
  }

  // Accessibility
  if (accessibility) {
    coreItems.push({
      title: `Accessibility: ${accessibility.status}`,
      detail: accessibility.reason,
      severity: severityFromStatus(accessibility.status),
    });
  }

  // Change items (if changePlan exists)
  const changeItems: ExplainItem[] = [];
  if (changePlan) {
    const detected = changePlan.detectedChanges || [];
    for (const ch of detected) {
      const impacts = (ch.impact || []).join(", ");
      changeItems.push({
        title: `Changed ${ch.field}`,
        detail: impacts ? `Impacted: ${impacts}` : undefined,
        severity:
          ch.severity === "high" ? "bad" : ch.severity === "medium" ? "warn" : "good",
      });
    }

    const blockers = changePlan.deltaSummary?.blockers;
    if (blockers) {
      const delta = blockers.after - blockers.before;
      const msg =
        delta === 0
          ? "Blockers unchanged"
          : delta < 0
            ? `${Math.abs(delta)} blocker(s) resolved`
            : `${delta} new blocker(s) introduced`;
      changeItems.push({
        title: "Blockers",
        detail: msg,
        severity: delta > 0 ? "bad" : delta < 0 ? "good" : "warn",
      });
    }

    const failures = changePlan.failures;
    if (failures?.length) {
      changeItems.push({
        title: "Some sections couldn't refresh",
        detail: "Showing last known data for a few modules.",
        severity: "warn",
      });
    }
  }

  // Summary text
  const summaryText = report?.summary || report?.breakdown?.visa?.reason;
  const summaryItems: ExplainItem[] = summaryText
    ? [{ title: "Summary", detail: summaryText, severity: "warn" }]
    : [];

  // Build sections
  const sections: CertaintyExplanation["sections"] = [
    { title: "What's driving your score", items: coreItems },
  ];

  if (changeItems.length) {
    sections.push({ title: "What changed", items: changeItems });
  }
  if (summaryItems.length) {
    sections.push({ title: "Notes", items: summaryItems });
  }

  return { score, overall, headline, deltaLine, sections };
}
