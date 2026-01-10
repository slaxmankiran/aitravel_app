/**
 * CertaintyBreakdown.tsx
 *
 * Item 20: Visual breakdown of certainty score factors
 * Shows horizontal bars for each factor with status indicators.
 */

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertCircle, XCircle, Info } from "lucide-react";
import type { CertaintyFactor, CertaintyStatus } from "@/lib/certaintyBreakdown";
import { getStatusClasses } from "@/lib/certaintyBreakdown";

interface CertaintyBreakdownProps {
  factors: CertaintyFactor[];
  totalScore: number;
  compact?: boolean; // For PDF export (no animations)
}

// Status icon component
function StatusIcon({ status, className }: { status: CertaintyStatus; className?: string }) {
  switch (status) {
    case "good":
      return <CheckCircle className={`w-4 h-4 text-emerald-400 ${className || ""}`} />;
    case "warning":
      return <AlertCircle className={`w-4 h-4 text-amber-400 ${className || ""}`} />;
    case "risk":
      return <XCircle className={`w-4 h-4 text-red-400 ${className || ""}`} />;
    default:
      return <Info className={`w-4 h-4 text-slate-400 ${className || ""}`} />;
  }
}

// Single factor row with horizontal bar
function FactorRow({
  factor,
  index,
  compact,
}: {
  factor: CertaintyFactor;
  index: number;
  compact?: boolean;
}) {
  const statusClasses = getStatusClasses(factor.status);

  // Bar color based on status
  const barColor =
    factor.status === "good"
      ? "bg-emerald-500"
      : factor.status === "warning"
      ? "bg-amber-500"
      : "bg-red-500";

  const content = (
    <div className="group">
      {/* Header: icon, label, score */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <StatusIcon status={factor.status} />
          <span className="text-sm font-medium text-white/90">{factor.label}</span>
          {factor.icon && (
            <span className="text-xs opacity-60">{factor.icon}</span>
          )}
        </div>
        <span className={`text-sm font-semibold ${statusClasses.text}`}>
          {factor.score}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        {compact ? (
          <div
            className={`h-full ${barColor} rounded-full`}
            style={{ width: `${factor.score}%` }}
          />
        ) : (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${factor.score}%` }}
            transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
            className={`h-full ${barColor} rounded-full`}
          />
        )}
      </div>

      {/* Explanation (shows on hover or always in compact mode) */}
      <p
        className={`mt-1.5 text-xs text-white/50 ${
          compact ? "" : "opacity-0 group-hover:opacity-100 transition-opacity"
        }`}
      >
        {factor.explanation}
      </p>
    </div>
  );

  if (compact) {
    return <div className="py-2">{content}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="py-2"
    >
      {content}
    </motion.div>
  );
}

// Weight indicator for each factor
function WeightIndicator({ weight }: { weight: number }) {
  const percentage = Math.round(weight * 100);
  return (
    <span className="text-[10px] text-white/30 uppercase tracking-wider">
      {percentage}% weight
    </span>
  );
}

// Main breakdown component
function CertaintyBreakdownComponent({
  factors,
  totalScore,
  compact = false,
}: CertaintyBreakdownProps) {
  // Sort factors by weight (highest first)
  const sortedFactors = [...factors].sort((a, b) => b.weight - a.weight);

  return (
    <div className="space-y-3">
      {/* Header with total */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="text-xs text-white/50 uppercase tracking-wider">
          Score Breakdown
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Weighted Total</span>
          <span className="text-sm font-bold text-white">{totalScore}%</span>
        </div>
      </div>

      {/* Factor rows */}
      <div className="space-y-2">
        {sortedFactors.map((factor, index) => (
          <div key={factor.id}>
            <FactorRow factor={factor} index={index} compact={compact} />
            {!compact && (
              <div className="flex justify-end -mt-1 mb-1">
                <WeightIndicator weight={factor.weight} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend (only in full mode) */}
      {!compact && (
        <div className="flex items-center justify-center gap-4 pt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-white/40">Good</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-[10px] text-white/40">Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] text-white/40">Risk</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const CertaintyBreakdown = React.memo(CertaintyBreakdownComponent);

// Compact version for PDF export
export function CertaintyBreakdownCompact({
  factors,
  totalScore,
}: Omit<CertaintyBreakdownProps, "compact">) {
  return (
    <CertaintyBreakdown
      factors={factors}
      totalScore={totalScore}
      compact={true}
    />
  );
}
