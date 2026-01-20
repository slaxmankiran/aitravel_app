/**
 * TrustBadge.tsx
 *
 * Visual indicator for cost verification status (Phase 3 - Trust Badges)
 * Shows where cost estimates come from and confidence level.
 *
 * Sources:
 * - rag_knowledge: Verified from knowledge base (high trust)
 * - api_estimate: From real-time API (medium-high trust)
 * - ai_estimate: AI-generated estimate (medium trust)
 * - user_input: User-provided (varies)
 */

import React from "react";
import { CheckCircle2, Database, Bot, User, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CostVerification, CostVerificationSource, CostConfidence } from "./itinerary-adapters";

// ============================================================================
// BADGE VARIANTS
// ============================================================================

interface BadgeVariant {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortLabel: string;
  bgColor: string;
  textColor: string;
  ringColor: string;
  tooltip: string;
}

const SOURCE_VARIANTS: Record<CostVerificationSource, BadgeVariant> = {
  rag_knowledge: {
    icon: CheckCircle2,
    label: "Verified",
    shortLabel: "✓",
    bgColor: "bg-green-500/15",
    textColor: "text-green-400",
    ringColor: "ring-green-500/30",
    tooltip: "Price verified from trusted sources",
  },
  api_estimate: {
    icon: Database,
    label: "Live",
    shortLabel: "●",
    bgColor: "bg-blue-500/15",
    textColor: "text-blue-400",
    ringColor: "ring-blue-500/30",
    tooltip: "Real-time price from API",
  },
  ai_estimate: {
    icon: Bot,
    label: "Estimate",
    shortLabel: "~",
    bgColor: "bg-amber-500/15",
    textColor: "text-amber-400",
    ringColor: "ring-amber-500/30",
    tooltip: "AI-estimated price (may vary)",
  },
  user_input: {
    icon: User,
    label: "Custom",
    shortLabel: "★",
    bgColor: "bg-purple-500/15",
    textColor: "text-purple-400",
    ringColor: "ring-purple-500/30",
    tooltip: "User-provided price",
  },
};

const CONFIDENCE_OPACITY: Record<CostConfidence, string> = {
  high: "opacity-100",
  medium: "opacity-80",
  low: "opacity-60",
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface TrustBadgeProps {
  /** Cost verification metadata */
  verification?: CostVerification;
  /** Display variant */
  variant?: "icon" | "chip" | "inline";
  /** Size variant */
  size?: "sm" | "md";
  /** Additional class names */
  className?: string;
  /** Whether to show tooltip on hover */
  showTooltip?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function TrustBadgeComponent({
  verification,
  variant = "icon",
  size = "sm",
  className,
  showTooltip = true,
}: TrustBadgeProps) {
  // If no verification data, show nothing (legacy data)
  if (!verification) {
    return null;
  }

  const sourceVariant = SOURCE_VARIANTS[verification.source] || SOURCE_VARIANTS.ai_estimate;
  const confidenceOpacity = CONFIDENCE_OPACITY[verification.confidence] || "opacity-100";
  const Icon = sourceVariant.icon;

  const sizeClasses = size === "sm"
    ? "text-[9px] px-1 py-0.5"
    : "text-[10px] px-1.5 py-0.5";

  const iconSize = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";

  // Build tooltip content
  const tooltipContent = verification.citation
    ? `${sourceVariant.tooltip} (${verification.citation})`
    : sourceVariant.tooltip;

  // Icon-only variant (minimal)
  if (variant === "icon") {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full",
          size === "sm" ? "w-4 h-4" : "w-5 h-5",
          sourceVariant.bgColor,
          confidenceOpacity,
          className
        )}
        title={showTooltip ? tooltipContent : undefined}
      >
        <Icon className={cn(iconSize, sourceVariant.textColor)} />
      </span>
    );
  }

  // Chip variant (label + icon)
  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full font-medium",
          sizeClasses,
          sourceVariant.bgColor,
          sourceVariant.textColor,
          "ring-1",
          sourceVariant.ringColor,
          confidenceOpacity,
          className
        )}
        title={showTooltip ? tooltipContent : undefined}
      >
        <Icon className={iconSize} />
        <span>{sourceVariant.shortLabel}</span>
      </span>
    );
  }

  // Inline variant (just the symbol)
  return (
    <span
      className={cn(
        "font-medium",
        sourceVariant.textColor,
        confidenceOpacity,
        className
      )}
      title={showTooltip ? tooltipContent : undefined}
    >
      {sourceVariant.shortLabel}
    </span>
  );
}

// ============================================================================
// HELPER: Get default verification for AI-generated costs
// ============================================================================

/**
 * Create a default verification object for costs without verification data
 * (legacy activities or AI-generated without explicit verification)
 */
export function getDefaultVerification(hasValidation: boolean = false): CostVerification {
  return {
    source: "ai_estimate",
    confidence: hasValidation ? "medium" : "low",
  };
}

/**
 * Create verification object from validation result
 */
export function createVerificationFromValidation(
  budgetVerified: boolean,
  source: CostVerificationSource = "ai_estimate"
): CostVerification {
  return {
    source,
    confidence: budgetVerified ? "medium" : "low",
  };
}

// Memoize for performance
export const TrustBadge = React.memo(TrustBadgeComponent);
