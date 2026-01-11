/**
 * TripExport.tsx
 *
 * Print-friendly export page for trip results.
 * Opens in new tab, auto-triggers print dialog.
 *
 * Hardening:
 * - Deterministic print timing (fonts + RAF + single-fire)
 * - Clean pagination with break rules
 * - Fixed-width columns for tables
 * - Text clamping for long content
 * - Case-insensitive status matching
 * - Proper null checks for numeric fields
 * - Aggressive nav hiding in print
 * - At-a-glance summary box
 *
 * Route: /trips/:id/export
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useSearch } from "wouter";
import { buildTripExportModel, type TripExportModel } from "@shared/exportModel";
import { buildCertaintyBreakdown } from "@/lib/certaintyBreakdown";

// ============================================================================
// HELPERS
// ============================================================================

function formatCurrency(amount: number | null | undefined, symbol: string): string {
  if (amount === null || amount === undefined) return "—";
  return `${symbol}${amount.toLocaleString()}`;
}

// Case-insensitive visa status color matching
function getVisaStatusColor(statusLabel: string): string {
  const s = statusLabel.toLowerCase();
  if (s.includes("free") || s.includes("arrival")) return "text-green-700 bg-green-100";
  if (s.includes("e-visa") || s.includes("evisa")) return "text-amber-700 bg-amber-100";
  if (s === "unknown" || s === "n/a") return "text-gray-600 bg-gray-100";
  return "text-red-700 bg-red-100";
}

function getCertaintyColor(label: string): string {
  if (label === "high") return "text-green-700 bg-green-100";
  if (label === "medium") return "text-amber-700 bg-amber-100";
  if (label === "unavailable") return "text-gray-600 bg-gray-100";
  return "text-red-700 bg-red-100";
}

// Get color for certainty factor status (print-friendly)
function getFactorStatusColor(status: "good" | "warning" | "risk"): { text: string; bg: string; bar: string } {
  switch (status) {
    case "good":
      return { text: "text-green-700", bg: "bg-green-100", bar: "bg-green-500" };
    case "warning":
      return { text: "text-amber-700", bg: "bg-amber-100", bar: "bg-amber-500" };
    case "risk":
      return { text: "text-red-700", bg: "bg-red-100", bar: "bg-red-500" };
    default:
      return { text: "text-gray-600", bg: "bg-gray-100", bar: "bg-gray-400" };
  }
}

// Clamp long text to prevent layout breaks
function clampText(text: string | undefined | null, maxLength: number = 80): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// Prettify day title for better readability
function prettifyTitle(title: string): string {
  if (!title) return "";
  return title
    .replace(/&/g, " & ")
    .replace(/\s+/g, " ")
    .trim();
}

// Known cities for extraction
const KNOWN_CITIES = [
  'Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Krabi', 'Ayutthaya',
  'Tokyo', 'Osaka', 'Kyoto', 'Hiroshima', 'Nara', 'Fukuoka',
  'Paris', 'Nice', 'Lyon', 'Marseille',
  'Rome', 'Florence', 'Venice', 'Milan', 'Naples',
  'London', 'Edinburgh', 'Manchester',
  'New York', 'Los Angeles', 'San Francisco', 'Miami', 'Las Vegas',
  'Singapore', 'Kuala Lumpur', 'Bali', 'Jakarta', 'Hanoi', 'Ho Chi Minh',
  'Barcelona', 'Madrid', 'Seville',
  'Berlin', 'Munich', 'Frankfurt',
  'Sydney', 'Melbourne', 'Auckland',
  'Dubai', 'Abu Dhabi', 'Istanbul', 'Cairo',
  'Mumbai', 'Delhi', 'Jaipur', 'Goa',
];

// Extract city from day title (e.g., "Bangkok Arrival & Riverside" -> "Bangkok")
function extractCity(title: string): string {
  if (!title) return "";

  // First try: match against known cities (case-insensitive)
  for (const city of KNOWN_CITIES) {
    if (title.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
  }

  // Fallback: Common pattern "City Name - Description"
  const dashSplit = title.split(/\s*[-–—]\s*/);
  if (dashSplit.length > 1 && dashSplit[0].length < 30) {
    return dashSplit[0].trim();
  }
  // Try first 1-2 words before &
  const ampSplit = title.split(/\s*&\s*/);
  if (ampSplit.length > 1) {
    const words = ampSplit[0].split(/\s+/);
    if (words.length <= 2) return ampSplit[0].trim();
  }
  return "";
}

// Extract description from title, removing the city part
function extractDescription(title: string, city: string): string {
  if (!title || !city) return title || "";

  // Remove city name and clean up leading separators/whitespace
  let desc = title;

  // Case-insensitive city removal
  const cityRegex = new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  desc = desc.replace(cityRegex, '');

  // Clean up leading/trailing separators and whitespace
  desc = desc.replace(/^[\s\-–—:&·]+/, '').replace(/[\s\-–—:&·]+$/, '').trim();

  return desc;
}

// ============================================================================
// PRINT CSS - Comprehensive rules for clean pagination
// ============================================================================

const PRINT_STYLES = `
  @media print {
    /* Page setup with footer for page numbers */
    @page {
      margin: 0.5in 0.5in 0.75in 0.5in;
      size: letter portrait;

      @bottom-center {
        content: "Trip #" attr(data-trip-id) " • Page " counter(page);
        font-size: 9px;
        color: #9ca3af;
      }
    }

    /* Force color printing */
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    /* Page counter for browsers that support it */
    .page-footer::after {
      content: "Page " counter(page);
    }

    /* Hide non-print elements */
    .no-print {
      display: none !important;
    }

    /* AGGRESSIVE: Hide any nav/header elements that might sneak in */
    header:not(.export-header),
    nav,
    [data-app-shell],
    [data-site-header],
    [data-nav],
    [role="navigation"],
    .mobile-nav,
    .site-nav,
    .app-header {
      display: none !important;
    }

    /* Page break controls */
    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .page-break-after {
      page-break-after: always;
      break-after: page;
    }

    /* Prevent awkward breaks */
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Day cards should not split */
    .day-card {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Table rows should not split */
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Activity items should not split */
    .activity-row {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Section headers stay with content */
    h2, h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Keep lists together when possible */
    ul, ol {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Footer stays at bottom */
    footer {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Ensure backgrounds print */
    .bg-gray-50, .bg-gray-100, .bg-green-100, .bg-amber-100, .bg-red-100, .bg-emerald-50 {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

// ============================================================================
// COMPONENT
// ============================================================================

export function TripExport() {
  const { id } = useParams<{ id: string }>();
  const searchStr = useSearch();
  const [model, setModel] = useState<TripExportModel | null>(null);
  const [tripData, setTripData] = useState<any>(null); // For certainty breakdown
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printReady, setPrintReady] = useState(false);
  const [showPrintAgain, setShowPrintAgain] = useState(false);

  // Parse version query param
  const versionId = (() => {
    const params = new URLSearchParams(searchStr);
    const v = params.get("version");
    return v ? parseInt(v, 10) : null;
  })();

  // Prevent double-print on re-renders
  const hasPrintedRef = useRef(false);

  // Load trip data (optionally with version override)
  useEffect(() => {
    async function loadTrip() {
      try {
        // Fetch base trip data
        const res = await fetch(`/api/trips/${id}`);
        if (!res.ok) throw new Error("Failed to load trip");
        let trip = await res.json();

        // If version specified, fetch version and merge snapshot data
        if (versionId) {
          const versionRes = await fetch(`/api/trips/${id}/versions/${versionId}`);
          if (versionRes.ok) {
            const { version } = await versionRes.json();
            if (version?.snapshot) {
              // Override trip data with version snapshot
              // The snapshot contains: inputs, costs, certainty, itinerarySummary, itinerary
              const snapshot = version.snapshot;

              // Merge inputs (passport, destination, dates, budget, etc.)
              if (snapshot.inputs) {
                trip = {
                  ...trip,
                  passport: snapshot.inputs.passport || trip.passport,
                  destination: snapshot.inputs.destination || trip.destination,
                  dates: snapshot.inputs.dates || trip.dates,
                  budget: snapshot.inputs.budget ?? trip.budget,
                  currency: snapshot.inputs.currency || trip.currency,
                  groupSize: snapshot.inputs.groupSize || trip.groupSize,
                  adults: snapshot.inputs.adults || trip.adults,
                  children: snapshot.inputs.children || trip.children,
                  infants: snapshot.inputs.infants || trip.infants,
                  travelStyle: snapshot.inputs.travelStyle || trip.travelStyle,
                  origin: snapshot.inputs.origin || trip.origin,
                };
              }

              // Override itinerary
              if (snapshot.itinerary) {
                trip.itinerary = snapshot.itinerary;
              }

              // Merge cost breakdown into itinerary
              if (snapshot.costs) {
                trip.itinerary = trip.itinerary || {};
                trip.itinerary.costBreakdown = {
                  ...trip.itinerary.costBreakdown,
                  grandTotal: snapshot.costs.grandTotal,
                  perPerson: snapshot.costs.perPerson,
                  currency: snapshot.costs.currency,
                };
                // Merge cost rows if available
                if (snapshot.costs.rows) {
                  const breakdown = trip.itinerary.costBreakdown;
                  for (const row of snapshot.costs.rows) {
                    const key = row.category.toLowerCase().replace(/\s+/g, '');
                    if (!breakdown[key]) {
                      breakdown[key] = { total: row.amount, note: row.note };
                    }
                  }
                }
              }

              // Merge certainty into feasibility report
              if (snapshot.certainty) {
                trip.feasibilityReport = trip.feasibilityReport || {};
                trip.feasibilityReport.score = snapshot.certainty.score;
              }
            }
          }
        }

        const exportModel = buildTripExportModel(trip, window.location.origin);
        setModel(exportModel);
        setTripData(trip); // Store for certainty breakdown
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    loadTrip();
  }, [id, versionId]);

  // Deterministic print timing: wait for fonts + layout stabilization
  useEffect(() => {
    if (!model || loading) return;

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
          // Show "Print again" button after dialog closes
          // Use afterprint event if available, otherwise timeout
          const showAgain = () => setShowPrintAgain(true);
          if ('onafterprint' in window) {
            window.addEventListener('afterprint', showAgain, { once: true });
            // Fallback timeout in case event doesn't fire
            setTimeout(showAgain, 3000);
          } else {
            // Fallback for browsers without afterprint
            setTimeout(showAgain, 1000);
          }
        } catch {
          console.log('[Export] Auto-print blocked, use manual button');
          setShowPrintAgain(true);
        }
      }
    }

    prepareForPrint();
  }, [model, loading]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Build certainty breakdown (memoized) - must be before early returns
  const certaintyBreakdown = useMemo(() => {
    if (!tripData) return null;
    try {
      return buildCertaintyBreakdown(tripData);
    } catch {
      return null;
    }
  }, [tripData]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading trip data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !model) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Trip not found"}</p>
          <a href="/" className="text-emerald-600 hover:underline">Return home</a>
        </div>
      </div>
    );
  }

  // Data availability checks
  const hasItinerary = model.itinerary.length > 0;
  const hasCostData = model.costs.rows.some(r => r.amount !== null);
  const showPerPerson = model.inputs.travelers > 1 && model.costs.total !== null;

  // Get top 3 required action items for at-a-glance
  const topActions = model.actionItems
    .flatMap(g => g.items.filter(i => i.isRequired).map(i => i.label))
    .slice(0, 3);

  // Build dynamic footnotes
  const dynamicFootnotes: string[] = [...model.footnotes];
  if (!hasCostData) {
    dynamicFootnotes.push("Flight, accommodation, and activity costs not yet priced for this plan.");
  }
  if (!hasItinerary) {
    dynamicFootnotes.push("Itinerary unavailable - trip generation may still be in progress.");
  }
  if (model.certainty.label === "unavailable") {
    dynamicFootnotes.push("Certainty score unavailable due to missing feasibility analysis.");
  }
  if (model.visa.requirements.length === 0 && model.visa.required) {
    dynamicFootnotes.push("Visa requirements not fully documented. Verify with official embassy sources.");
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 print:text-black">
      <style>{PRINT_STYLES}</style>

      {/* Print controls - hidden in print */}
      <div className="no-print fixed top-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="flex gap-2">
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
        {/* Print again prompt after dialog closes/cancelled */}
        {showPrintAgain && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-amber-700">Cancelled or need another copy?</span>
            <button
              onClick={handlePrint}
              className="text-amber-600 font-medium hover:text-amber-800 underline"
            >
              Print again
            </button>
          </div>
        )}
      </div>

      {/* Tip about browser headers - hidden in print */}
      <div className="no-print fixed bottom-4 right-4 z-50 max-w-xs">
        <p className="text-xs text-gray-400 bg-white/90 px-3 py-2 rounded shadow">
          Tip: For a clean PDF, disable browser headers/footers in print settings.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        {/* ================================================================ */}
        {/* COVER HEADER */}
        {/* ================================================================ */}
        <header className="export-header mb-6 pb-6 border-b-2 border-gray-200 avoid-break">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
              V
            </div>
            <span className="text-xl font-semibold text-gray-700">VoyageAI</span>
            <span className="text-sm text-gray-400 ml-auto">Trip #{model.meta.tripId}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">{model.meta.title}</h1>
          <p className="text-gray-600">
            {model.inputs.travelers} traveler{model.inputs.travelers !== 1 ? "s" : ""} · {model.inputs.passport} passport
            {model.inputs.from && ` · From ${model.inputs.from}`}
          </p>
          {/* Destination mismatch warning */}
          {model.meta.destinationMismatch && (
            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md text-sm">
              <span className="text-amber-700">
                ⚠️ Note: Trip header shows "{model.meta.destinationMismatch.stated}" but itinerary is for "{model.meta.destinationMismatch.detected}"
              </span>
            </div>
          )}
        </header>

        {/* ================================================================ */}
        {/* AT-A-GLANCE SUMMARY BOX */}
        {/* ================================================================ */}
        <section className="mb-8 avoid-break">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-emerald-800 mb-3 uppercase tracking-wide">At a Glance</h2>
            <div className="grid grid-cols-3 gap-4 mb-3">
              <div>
                <p className="text-xs text-emerald-600 uppercase">Certainty</p>
                <p className={`text-lg font-bold capitalize ${
                  model.certainty.label === "high" ? "text-green-700" :
                  model.certainty.label === "medium" ? "text-amber-700" :
                  model.certainty.label === "unavailable" ? "text-gray-500" : "text-red-700"
                }`}>
                  {model.certainty.label === "unavailable" ? "N/A" : model.certainty.label}
                  {model.certainty.score !== null && <span className="text-sm font-normal ml-1">({model.certainty.score}%)</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 uppercase">Visa</p>
                <p className="text-lg font-bold text-gray-800">{model.visa.statusLabel}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-600 uppercase">Est. Cost</p>
                <p className="text-lg font-bold text-gray-800">
                  {model.costs.total !== null ? formatCurrency(model.costs.total, model.costs.currencySymbol) : "TBD"}
                </p>
              </div>
            </div>
            {topActions.length > 0 && (
              <div className="border-t border-emerald-200 pt-3">
                <p className="text-xs text-emerald-600 uppercase mb-1">Priority Actions</p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {topActions.map((action, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-emerald-500">→</span> {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================ */}
        {/* CERTAINTY BREAKDOWN - "Why This Score?" */}
        {/* ================================================================ */}
        {certaintyBreakdown && certaintyBreakdown.factors.length > 0 && (
          <section className="mb-8 avoid-break">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Why This Certainty Score?</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                {certaintyBreakdown.factors.map((factor) => {
                  const colors = getFactorStatusColor(factor.status);
                  return (
                    <div key={factor.id} className="avoid-break">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">
                            {factor.icon} {factor.label}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                            {factor.status}
                          </span>
                        </div>
                        <span className={`text-sm font-semibold ${colors.text}`}>
                          {factor.score}%
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                        <div
                          className={`h-full ${colors.bar} rounded-full`}
                          style={{ width: `${factor.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{factor.explanation}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-500">Weighted Total</span>
                <span className="text-sm font-bold text-gray-800">{certaintyBreakdown.totalScore}%</span>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* VISA & ENTRY REQUIREMENTS */}
        {/* ================================================================ */}
        {(model.visa.required || model.visa.requirements.length > 0 || model.visa.processingDays !== null || model.visa.fee !== null) && (
          <section className="mb-8 avoid-break">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">Visa & Entry Requirements</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex flex-wrap gap-4 mb-3 text-sm">
                <div>
                  <span className="text-gray-500">Status: </span>
                  <span className={`font-medium px-2 py-0.5 rounded ${getVisaStatusColor(model.visa.statusLabel)}`}>
                    {model.visa.statusLabel}
                  </span>
                </div>
                {model.visa.processingDays !== null && (
                  <div>
                    <span className="text-gray-500">Processing: </span>
                    <span className="font-medium">{model.visa.processingDays}</span>
                  </div>
                )}
                {model.visa.fee !== null && (
                  <div>
                    <span className="text-gray-500">Fee: </span>
                    <span className="font-medium">{model.visa.fee}</span>
                  </div>
                )}
              </div>
              {model.visa.requirements.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {model.visa.requirements.map((req, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        req.status === "required" ? "bg-red-500" :
                        req.status === "recommended" ? "bg-amber-500" : "bg-gray-400"
                      }`} />
                      <span className="flex-1">{req.label}</span>
                      <span className="text-xs text-gray-400">({req.status})</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No specific requirements documented. Verify with official sources.</p>
              )}
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* COST BREAKDOWN */}
        {/* ================================================================ */}
        <section className="mb-8 avoid-break">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Cost Breakdown ({model.costs.currency})
          </h2>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '65%' }} />
                <col style={{ width: '35%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left py-2 px-4 font-medium text-gray-600">Category</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {model.costs.rows.map((row, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="py-2 px-4">
                      <div>{row.label}</div>
                      {row.note && (
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]" title={row.note}>
                          {row.note}
                        </div>
                      )}
                    </td>
                    <td className="text-right py-2 px-4 font-mono text-gray-700 align-top">
                      {formatCurrency(row.amount, model.costs.currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-semibold">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4 font-mono">
                    {model.costs.total !== null ? formatCurrency(model.costs.total, model.costs.currencySymbol) : "TBD"}
                  </td>
                </tr>
                {showPerPerson && (
                  <tr className="bg-gray-100 text-gray-600">
                    <td className="py-2 px-4 text-sm">Per Person ({model.inputs.travelers} travelers)</td>
                    <td className="text-right py-2 px-4 font-mono text-sm">
                      {formatCurrency(model.costs.perPerson, model.costs.currencySymbol)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
          {model.costs.pricingNote && (
            <p className="mt-2 text-xs text-gray-500 italic">{model.costs.pricingNote}</p>
          )}
        </section>

        {/* ================================================================ */}
        {/* DAILY ITINERARY */}
        {/* ================================================================ */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Daily Itinerary</h2>

          {hasItinerary ? (
            model.itinerary.map((day, dayIdx) => {
              return (
                <div
                  key={dayIdx}
                  className={`mb-6 day-card ${dayIdx > 0 && dayIdx % 2 === 0 ? "page-break" : ""}`}
                >
                  {/* Day header with clear separators */}
                  <div className="flex items-start justify-between mb-3 pb-2 border-b border-gray-200">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        Day {day.dayIndex}
                        <span className="text-gray-500 font-normal">&nbsp;·&nbsp;{day.cityLabel}</span>
                      </h3>
                      {day.dayTitle && (
                        <p className="text-sm text-gray-600 mt-0.5">{prettifyTitle(day.dayTitle)}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{day.dateLabel}</p>
                    </div>
                    {day.dayCost !== null && day.dayCost !== undefined && (
                      <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {formatCurrency(day.dayCost, model.costs.currencySymbol)}
                      </span>
                    )}
                  </div>

                  {/* Time slots */}
                  {day.sections.map((section, sectionIdx) => (
                    <div key={sectionIdx} className="mb-4 ml-2 avoid-break">
                      <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide border-b border-gray-100 pb-1">
                        {section.label}
                      </h4>
                      <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '55px' }} />
                          <col />
                          <col style={{ width: '70px' }} />
                        </colgroup>
                        <tbody>
                          {section.items.map((item, itemIdx) => (
                            <tr key={itemIdx} className="activity-row align-top">
                              <td className="py-1.5 pr-2 text-gray-400 font-mono text-xs">
                                {item.time || "—"}
                              </td>
                              <td className="py-1.5 pr-2">
                                <span className="font-medium text-gray-800">
                                  {clampText(item.title, 45)}
                                </span>
                                {item.location && (
                                  <span className="text-gray-500 text-xs ml-1">
                                    @ {clampText(item.location, 25)}
                                  </span>
                                )}
                                {item.notes && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {clampText(item.notes, 80)}
                                  </p>
                                )}
                              </td>
                              <td className="py-1.5 text-right text-gray-600 font-mono text-xs">
                                {item.cost !== null && item.cost !== undefined
                                  ? (item.cost === 0 ? "Free" : formatCurrency(item.cost, model.costs.currencySymbol))
                                  : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })
          ) : (
            <div className="bg-gray-50 rounded-lg p-4 text-gray-500 text-sm">
              Itinerary not yet generated for this trip.
            </div>
          )}
        </section>

        {/* ================================================================ */}
        {/* ACTION ITEMS */}
        {/* ================================================================ */}
        {model.actionItems.length > 0 && (
          <section className="mb-8 avoid-break page-break">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Action Items Checklist</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {model.actionItems.map((group, groupIdx) => (
                <div key={groupIdx} className="bg-gray-50 rounded-lg p-4 avoid-break">
                  <h3 className="font-semibold text-gray-700 mb-3 pb-2 border-b border-gray-200">{group.group}</h3>
                  <ul className="space-y-2">
                    {group.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex items-start gap-2 text-sm">
                        {/* Unicode checkbox */}
                        <span className="text-gray-400 flex-shrink-0 mt-0.5">☐</span>
                        <span className={item.isRequired ? "font-medium text-gray-800" : "text-gray-600"}>
                          {item.label}
                        </span>
                        {item.isRequired && (
                          <span className="text-xs text-red-500 flex-shrink-0">(required)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* FOOTNOTES */}
        {/* ================================================================ */}
        <footer className="border-t border-gray-200 pt-6 avoid-break">
          <h2 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Notes & Disclaimers</h2>
          <ul className="text-xs text-gray-500 space-y-1">
            {dynamicFootnotes.map((note, i) => (
              <li key={i}>• {note}</li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Generated by VoyageAI · {new Date(model.meta.generatedAtISO).toLocaleDateString('en-US', {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
              <p className="text-xs text-gray-400">
                Trip #{model.meta.tripId}
              </p>
            </div>
            {model.meta.shareUrl && (
              <p className="text-xs text-gray-400">
                View online: <a href={model.meta.shareUrl} className="text-emerald-600 hover:underline">{model.meta.shareUrl}</a>
              </p>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
