/**
 * TripCompareExport.tsx
 *
 * Print-friendly export page for comparing two trip plans.
 * Shows Plan A vs Plan B side-by-side with visual deltas.
 *
 * Data source: sessionStorage (set by ComparePlansModal)
 * Route: /trips/:id/export/compare
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "wouter";
import type { TripResponse } from "@shared/schema";
import { comparePlans, type PlanComparison } from "@/lib/comparePlans";

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number | null | undefined, symbol: string): string {
  if (amount === null || amount === undefined) return "—";
  return `${symbol}${amount.toLocaleString()}`;
}

function getCertaintyColor(score: number | null): string {
  if (score === null) return "text-gray-600 bg-gray-100";
  if (score >= 70) return "text-green-700 bg-green-100";
  if (score >= 40) return "text-amber-700 bg-amber-100";
  return "text-red-700 bg-red-100";
}

function getDeltaColor(delta: number | null, lowerIsBetter = false): string {
  if (delta === null || delta === 0) return "text-gray-600";
  const isPositive = lowerIsBetter ? delta < 0 : delta > 0;
  return isPositive ? "text-green-600" : "text-red-600";
}

function formatDelta(delta: number | null, prefix = ""): string {
  if (delta === null) return "—";
  if (delta === 0) return "No change";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${prefix}${delta.toLocaleString()}`;
}

// ============================================================================
// PRINT CSS
// ============================================================================

const PRINT_STYLES = `
  @media print {
    @page {
      margin: 0.5in;
      size: letter landscape;
    }

    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .no-print {
      display: none !important;
    }

    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    header:not(.export-header),
    nav,
    [role="navigation"] {
      display: none !important;
    }
  }
`;

// ============================================================================
// COMPONENT
// ============================================================================

export function TripCompareExport() {
  const { id } = useParams<{ id: string }>();
  const [planA, setPlanA] = useState<TripResponse | null>(null);
  const [planB, setPlanB] = useState<TripResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printReady, setPrintReady] = useState(false);
  const hasPrintedRef = useRef(false);

  // Load trips from sessionStorage
  useEffect(() => {
    try {
      const planAStr = sessionStorage.getItem("compareExport_planA");
      const planBStr = sessionStorage.getItem("compareExport_planB");

      if (!planAStr || !planBStr) {
        setError("Comparison data not found. Please start from the Compare Plans modal.");
        setLoading(false);
        return;
      }

      setPlanA(JSON.parse(planAStr));
      setPlanB(JSON.parse(planBStr));
    } catch (err) {
      setError("Failed to parse comparison data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-print when ready
  useEffect(() => {
    if (!planA || !planB || loading) return;

    async function prepareForPrint() {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise(resolve => requestAnimationFrame(resolve));
      await new Promise(resolve => setTimeout(resolve, 100));
      setPrintReady(true);

      if (!hasPrintedRef.current) {
        hasPrintedRef.current = true;
        try {
          window.print();
        } catch {
          console.log('[CompareExport] Auto-print blocked');
        }
      }
    }

    prepareForPrint();
  }, [planA, planB, loading]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Compute comparison data
  const comparison = useMemo(() => {
    if (!planA || !planB) return null;
    return comparePlans(planA, planB);
  }, [planA, planB]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading comparison data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !planA || !planB || !comparison) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Comparison data not available"}</p>
          <a href={`/trips/${id}/results-v1`} className="text-emerald-600 hover:underline">Return to trip</a>
        </div>
      </div>
    );
  }

  const { certaintyDelta, totalCostDelta, costDeltas, itineraryChanges, recommendation } = comparison;
  const currencySymbol = (planB.itinerary as any)?.costBreakdown?.currencySymbol || "$";

  // Extract key data for both plans
  const planAData = {
    destination: planA.destination,
    dates: planA.dates || "Dates not set",
    travelers: (planA.adults || 1) + (planA.children || 0),
    budget: planA.budget,
    certainty: certaintyDelta.scoreBefore,
    totalCost: totalCostDelta.before,
    daysCount: itineraryChanges.dayCountBefore,
  };

  const planBData = {
    destination: planB.destination,
    dates: planB.dates || "Dates not set",
    travelers: (planB.adults || 1) + (planB.children || 0),
    budget: planB.budget,
    certainty: certaintyDelta.scoreAfter,
    totalCost: totalCostDelta.after,
    daysCount: itineraryChanges.dayCountAfter,
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 print:text-black">
      <style>{PRINT_STYLES}</style>

      {/* Print controls */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handlePrint}
          disabled={!printReady}
          className={`px-4 py-2 rounded-lg shadow-lg transition-colors ${
            printReady
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-gray-300 text-gray-500 cursor-wait"
          }`}
        >
          {printReady ? "Print / Save PDF" : "Preparing..."}
        </button>
        <a
          href={`/trips/${id}/results-v1`}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 shadow-lg"
        >
          Back to Trip
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12">
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <header className="export-header mb-8 pb-6 border-b-2 border-gray-200 avoid-break">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
              V
            </div>
            <span className="text-xl font-semibold text-gray-700">VoyageAI</span>
            <span className="text-sm text-gray-400 ml-auto">Trip Comparison</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Plan Comparison: {planB.destination}
          </h1>
          <p className="text-gray-600">
            Comparing original plan vs updated plan
          </p>
        </header>

        {/* ================================================================ */}
        {/* RECOMMENDATION SUMMARY */}
        {/* ================================================================ */}
        <section className="mb-8 avoid-break">
          <div className={`rounded-lg p-4 border ${
            recommendation.preferred === "B"
              ? "bg-green-50 border-green-200"
              : recommendation.preferred === "A"
                ? "bg-amber-50 border-amber-200"
                : "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                recommendation.preferred === "B"
                  ? "bg-green-100 text-green-600"
                  : recommendation.preferred === "A"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-gray-100 text-gray-600"
              }`}>
                <span className="text-2xl font-bold">
                  {recommendation.preferred === "neutral" ? "=" : recommendation.preferred}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {recommendation.preferred === "B"
                    ? "Updated Plan Recommended"
                    : recommendation.preferred === "A"
                      ? "Original Plan Recommended"
                      : "Plans Are Comparable"}
                </h2>
                <p className="text-gray-600 mt-1">{recommendation.reason}</p>
                <p className="text-sm text-gray-500 mt-2">{recommendation.tradeoffSummary}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* SIDE-BY-SIDE COMPARISON TABLE */}
        {/* ================================================================ */}
        <section className="mb-8 avoid-break">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Plan Overview</h2>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '25%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '30%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Metric</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">
                    <span className="inline-block px-2 py-0.5 bg-white rounded">Plan A</span>
                    <span className="block text-xs text-gray-400 font-normal mt-1">Original</span>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">
                    <span className="inline-block px-2 py-0.5 bg-emerald-100 rounded text-emerald-700">Plan B</span>
                    <span className="block text-xs text-gray-400 font-normal mt-1">Updated</span>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Change</th>
                </tr>
              </thead>
              <tbody>
                {/* Dates Row */}
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium text-gray-700">Dates</td>
                  <td className="py-3 px-4 text-center text-gray-600">{planAData.dates}</td>
                  <td className="py-3 px-4 text-center text-gray-900">{planBData.dates}</td>
                  <td className="py-3 px-4 text-center text-gray-500 text-xs">
                    {planAData.dates !== planBData.dates ? "Changed" : "—"}
                  </td>
                </tr>

                {/* Duration Row */}
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium text-gray-700">Duration</td>
                  <td className="py-3 px-4 text-center text-gray-600">{planAData.daysCount} days</td>
                  <td className="py-3 px-4 text-center text-gray-900">{planBData.daysCount} days</td>
                  <td className={`py-3 px-4 text-center text-sm ${getDeltaColor(planBData.daysCount - planAData.daysCount)}`}>
                    {planBData.daysCount !== planAData.daysCount
                      ? formatDelta(planBData.daysCount - planAData.daysCount)
                      : "—"}
                  </td>
                </tr>

                {/* Certainty Row */}
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium text-gray-700">Certainty Score</td>
                  <td className="py-3 px-4 text-center">
                    {certaintyDelta.scoreBefore !== null ? (
                      <span className={`inline-block px-2 py-1 rounded font-semibold ${getCertaintyColor(certaintyDelta.scoreBefore)}`}>
                        {certaintyDelta.scoreBefore}%
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {certaintyDelta.scoreAfter !== null ? (
                      <span className={`inline-block px-2 py-1 rounded font-semibold ${getCertaintyColor(certaintyDelta.scoreAfter)}`}>
                        {certaintyDelta.scoreAfter}%
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-center text-sm font-semibold ${getDeltaColor(certaintyDelta.delta)}`}>
                    {certaintyDelta.delta !== null ? formatDelta(certaintyDelta.delta, "") + "%" : "—"}
                  </td>
                </tr>

                {/* Visa Risk Row */}
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium text-gray-700">Visa Risk</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      certaintyDelta.visaRiskBefore === "low" ? "bg-green-100 text-green-700" :
                      certaintyDelta.visaRiskBefore === "high" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {certaintyDelta.visaRiskBefore}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      certaintyDelta.visaRiskAfter === "low" ? "bg-green-100 text-green-700" :
                      certaintyDelta.visaRiskAfter === "high" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>
                      {certaintyDelta.visaRiskAfter}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-gray-500 text-xs">
                    {certaintyDelta.visaRiskBefore !== certaintyDelta.visaRiskAfter ? "Changed" : "—"}
                  </td>
                </tr>

                {/* Buffer Days Row */}
                <tr className="border-t border-gray-200">
                  <td className="py-3 px-4 font-medium text-gray-700">Buffer Days</td>
                  <td className="py-3 px-4 text-center text-gray-600">{certaintyDelta.bufferDaysBefore}</td>
                  <td className="py-3 px-4 text-center text-gray-900">{certaintyDelta.bufferDaysAfter}</td>
                  <td className={`py-3 px-4 text-center text-sm ${getDeltaColor(certaintyDelta.bufferDelta)}`}>
                    {certaintyDelta.bufferDelta !== 0 ? formatDelta(certaintyDelta.bufferDelta) : "—"}
                  </td>
                </tr>

                {/* Total Cost Row */}
                <tr className="border-t-2 border-gray-300 bg-gray-100">
                  <td className="py-3 px-4 font-semibold text-gray-800">Estimated Total Cost</td>
                  <td className="py-3 px-4 text-center font-semibold text-gray-700">
                    {formatCurrency(totalCostDelta.before, currencySymbol)}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-gray-900">
                    {formatCurrency(totalCostDelta.after, currencySymbol)}
                  </td>
                  <td className={`py-3 px-4 text-center font-semibold ${getDeltaColor(totalCostDelta.delta, true)}`}>
                    {totalCostDelta.delta !== null ? formatDelta(totalCostDelta.delta, currencySymbol) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ================================================================ */}
        {/* COST BREAKDOWN BY CATEGORY */}
        {/* ================================================================ */}
        {costDeltas.length > 0 && (
          <section className="mb-8 avoid-break">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Cost Breakdown by Category</h2>
            <div className="bg-gray-50 rounded-lg overflow-hidden">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Plan A</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Plan B</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {costDeltas.map((delta, i) => (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="py-2 px-4 text-gray-700">{delta.category}</td>
                      <td className="py-2 px-4 text-right text-gray-600 font-mono">
                        {formatCurrency(delta.before, currencySymbol)}
                      </td>
                      <td className="py-2 px-4 text-right text-gray-900 font-mono">
                        {formatCurrency(delta.after, currencySymbol)}
                      </td>
                      <td className={`py-2 px-4 text-right font-mono ${getDeltaColor(delta.delta, true)}`}>
                        {delta.delta !== null && delta.delta !== 0
                          ? formatDelta(delta.delta, currencySymbol)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* ITINERARY CHANGES */}
        {/* ================================================================ */}
        <section className="mb-8 avoid-break page-break">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Itinerary Changes</h2>
          <div className="grid grid-cols-2 gap-6">
            {/* Added Experiences */}
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <h3 className="font-semibold text-green-800 mb-3">
                Added Experiences ({itineraryChanges.addedHighlights.length})
              </h3>
              {itineraryChanges.addedHighlights.length > 0 ? (
                <ul className="space-y-2">
                  {itineraryChanges.addedHighlights.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-green-700">
                      <span className="text-green-500 mt-0.5">+</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-600">No new experiences added</p>
              )}
            </div>

            {/* Removed Experiences */}
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <h3 className="font-semibold text-red-800 mb-3">
                Removed Experiences ({itineraryChanges.removedHighlights.length})
              </h3>
              {itineraryChanges.removedHighlights.length > 0 ? (
                <ul className="space-y-2">
                  {itineraryChanges.removedHighlights.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                      <span className="text-red-500 mt-0.5">−</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-red-600">No experiences removed</p>
              )}
            </div>
          </div>
        </section>

        {/* ================================================================ */}
        {/* FOOTER */}
        {/* ================================================================ */}
        <footer className="border-t border-gray-200 pt-6 avoid-break">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <p>
              Generated by VoyageAI · {new Date().toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
            <p>Trip #{id} · Plan Comparison</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
