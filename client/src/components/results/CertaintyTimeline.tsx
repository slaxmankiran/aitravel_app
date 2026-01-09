/**
 * CertaintyTimeline.tsx
 *
 * Small horizontal timeline showing certainty score evolution.
 * Displays up to 5 points: initial + changes + undos.
 * Each point shows score with tooltip for label.
 */

import type { CertaintyPoint } from "@/pages/TripResultsV1";

interface CertaintyTimelineProps {
  history: CertaintyPoint[];
}

/**
 * Get color class based on score value.
 * Thresholds aligned with CertaintyBar (70/40).
 */
function getScoreColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-red-500";
}

/**
 * Get text color class based on score value.
 * Thresholds aligned with CertaintyBar (70/40).
 */
function getScoreTextColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

export function CertaintyTimeline({ history }: CertaintyTimelineProps) {
  if (history.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {history.map((point, index) => {
        const isLast = index === history.length - 1;
        const scoreColor = getScoreColor(point.score);
        const textColor = getScoreTextColor(point.score);

        return (
          <div key={point.id} className="flex items-center">
            {/* Point with score */}
            <div
              className="flex flex-col items-center gap-0.5 group relative"
              title={`${point.label}: ${point.score}`}
            >
              {/* Dot */}
              <div
                className={`w-2 h-2 rounded-full ${scoreColor} ${
                  isLast ? "ring-2 ring-white/20" : ""
                }`}
              />
              {/* Score label */}
              <span className={`text-[10px] font-medium ${textColor}`}>
                {point.score}
              </span>
            </div>

            {/* Connecting line (except after last point) */}
            {!isLast && (
              <div className="w-3 h-px bg-white/20 mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}
