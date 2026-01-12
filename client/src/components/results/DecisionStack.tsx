/**
 * DecisionStack.tsx
 *
 * Premium glass card - The Command Center
 *
 * Features:
 * - Glass material with backdrop blur
 * - Verdict-based subtle glow (not border)
 * - Animated accent line
 * - Depth micro-interactions
 * - Quick links for progressive disclosure
 */

import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  DollarSign,
  FileCheck,
  Shield,
  ChevronRight,
  Sparkles,
  Receipt,
  ClipboardList,
  History,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  glassPrimary,
  getVerdictGlow,
  typography,
  entranceScale,
} from '@/lib/glassDesign';
import type { TripResponse, VisaDetails } from '@shared/schema';
import type { VerdictResult } from '@/lib/verdict';
import { getVerdictDisplay } from '@/lib/verdict';

// ============================================================================
// TYPES
// ============================================================================

interface DecisionStackProps {
  trip: TripResponse;
  verdictResult: VerdictResult | null;
  budgetStatus: 'under' | 'near' | 'over20' | 'over50';
  budgetOverBy?: number;
  currency?: string;
  grandTotal?: number;
  hasBudgetSet?: boolean; // True only if user set a realistic budget
  onFixBlockers?: () => void;
  onShowDetails?: () => void;
  onViewCosts?: () => void;
  onViewChecklist?: () => void;
  onViewHistory?: () => void;
  onViewMap?: () => void;
  hideQuickLinks?: boolean;
  className?: string;
}

interface StatusRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'error';
}

// ============================================================================
// ANIMATED ACCENT LINE
// ============================================================================

interface AccentLineProps {
  verdict: string;
}

function AccentLine({ verdict }: AccentLineProps) {
  const gradientClass = verdict === 'GO'
    ? 'from-transparent via-emerald-500/50 to-transparent'
    : verdict === 'DIFFICULT'
    ? 'from-transparent via-rose-500/50 to-transparent'
    : 'from-transparent via-amber-500/50 to-transparent';

  return (
    <div className="absolute top-0 left-0 right-0 h-px overflow-hidden">
      <motion.div
        className={cn('h-full w-1/3 bg-gradient-to-r', gradientClass)}
        animate={{
          x: ['0%', '200%', '0%'],
        }}
        transition={{
          duration: 20,
          ease: 'linear',
          repeat: Infinity,
        }}
      />
    </div>
  );
}

// ============================================================================
// STATUS ROW COMPONENT
// ============================================================================

function StatusRow({ icon, label, value, status }: StatusRowProps) {
  const statusColors = {
    ok: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-rose-400',
  };

  const statusIcons = {
    ok: <CheckCircle className="w-3.5 h-3.5 text-emerald-400/80" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80" />,
    error: <XCircle className="w-3.5 h-3.5 text-rose-400/80" />,
  };

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <div className={cn('flex items-center gap-2.5', typography.secondary)}>
        <span className="text-white/40">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-xs font-medium', statusColors[status])}>
          {value}
        </span>
        {statusIcons[status]}
      </div>
    </div>
  );
}

// ============================================================================
// QUICK LINK COMPONENT (Glass Pill)
// ============================================================================

interface QuickLinkProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}

function QuickLink({ icon, label, sublabel, onClick }: QuickLinkProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-xl',
        'bg-white/[0.04] hover:bg-white/[0.08]',
        'border border-white/[0.04] hover:border-white/[0.08]',
        'backdrop-blur-sm',
        'transition-colors duration-200',
        'text-left group'
      )}
    >
      <span className="text-white/35 group-hover:text-white/55 transition-colors">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <span className={cn('text-xs font-medium', typography.secondary, 'group-hover:text-white/80 transition-colors')}>
          {label}
        </span>
        {sublabel && (
          <span className={cn('ml-1.5 text-xs', typography.tertiary)}>
            {sublabel}
          </span>
        )}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/30 transition-colors" />
    </motion.button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function DecisionStackComponent({
  trip,
  verdictResult,
  budgetStatus,
  budgetOverBy = 0,
  currency = 'USD',
  grandTotal,
  hasBudgetSet = true,
  onFixBlockers,
  onShowDetails,
  onViewCosts,
  onViewChecklist,
  onViewHistory,
  onViewMap,
  hideQuickLinks = false,
  className,
}: DecisionStackProps) {
  const feasibility = trip.feasibilityReport as any;
  const visaDetails = feasibility?.visaDetails as VisaDetails | undefined;
  const safetyStatus = feasibility?.breakdown?.safety?.status;

  // Get verdict glow
  const verdictGlowStyle = getVerdictGlow(verdictResult?.verdict);

  // Compute statuses
  const statuses = useMemo(() => {
    const items: StatusRowProps[] = [];

    // Budget status - show estimated cost if no budget set, otherwise show delta
    let budgetValue: string;
    let budgetStatusClass: 'ok' | 'warning' | 'error' = 'ok';

    if (!hasBudgetSet) {
      // No budget set - show estimated total (neutral, not "over")
      budgetValue = grandTotal ? `Est. ${currency}${Math.round(grandTotal).toLocaleString()}` : 'Calculating...';
      budgetStatusClass = 'ok';
    } else if (budgetStatus === 'under') {
      budgetValue = 'Within budget';
      budgetStatusClass = 'ok';
    } else if (budgetStatus === 'near') {
      budgetValue = 'Near limit';
      budgetStatusClass = 'ok';
    } else {
      budgetValue = `${currency}${Math.abs(Math.round(budgetOverBy)).toLocaleString()} over`;
      budgetStatusClass = budgetStatus === 'over20' ? 'warning' : 'error';
    }

    items.push({
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: 'Budget',
      value: budgetValue,
      status: budgetStatusClass,
    });

    // Visa status
    if (visaDetails) {
      const visaValue =
        visaDetails.type === 'visa_free' ? 'No visa needed' :
        visaDetails.type === 'visa_on_arrival' ? 'Visa on arrival' :
        visaDetails.type === 'e_visa' ? 'e-Visa required' :
        visaDetails.type === 'embassy_visa' ? 'Embassy visa' :
        'Check requirements';

      const visaStatus =
        visaDetails.type === 'visa_free' || visaDetails.type === 'visa_on_arrival' ? 'ok' :
        visaDetails.type === 'e_visa' ? 'warning' :
        'error';

      items.push({
        icon: <FileCheck className="w-3.5 h-3.5" />,
        label: 'Visa',
        value: visaValue,
        status: visaStatus,
      });
    }

    // Safety status
    if (safetyStatus) {
      const safetyValue =
        safetyStatus === 'safe' ? 'Generally safe' :
        safetyStatus === 'caution' ? 'Exercise caution' :
        'Check advisories';

      items.push({
        icon: <Shield className="w-3.5 h-3.5" />,
        label: 'Safety',
        value: safetyValue,
        status: safetyStatus === 'safe' ? 'ok' : safetyStatus === 'caution' ? 'warning' : 'error',
      });
    }

    return items;
  }, [budgetStatus, budgetOverBy, currency, visaDetails, safetyStatus, hasBudgetSet, grandTotal]);

  const hasBlockers = statuses.some(s => s.status === 'error') ||
    (verdictResult && verdictResult.verdict === 'DIFFICULT' && verdictResult.score < 30);

  const hasWarnings = statuses.some(s => s.status === 'warning') ||
    (verdictResult && (verdictResult.verdict === 'POSSIBLE' || verdictResult.verdict === 'DIFFICULT'));

  const verdictDisplay = verdictResult ? getVerdictDisplay(verdictResult.verdict) : null;

  return (
    <motion.div
      initial={entranceScale.initial}
      animate={entranceScale.animate}
      transition={entranceScale.transition}
      whileHover={{ y: -1 }}
      className={cn(
        // Glass material with inner highlight
        glassPrimary.bg,
        glassPrimary.backdrop,
        glassPrimary.border,
        glassPrimary.shadow,
        // Shape
        'rounded-xl overflow-hidden relative',
        // Hover depth
        'transition-all duration-300 ease-out',
        className
      )}
    >
      {/* Inner highlight - top edge glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

      {/* Animated accent line */}
      {verdictResult && <AccentLine verdict={verdictResult.verdict} />}

      {/* Header with verdict - refined typography */}
      {verdictResult && verdictDisplay && (
        <div className="px-5 py-4 border-b border-white/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Score circle - the ONLY place score is shown */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center',
                  'border font-semibold text-sm',
                  verdictDisplay.borderClass,
                  verdictDisplay.textClass
                )}
              >
                {verdictResult.score}
              </motion.div>
              <div>
                <span className={cn('font-medium text-sm', verdictDisplay.textClass)}>
                  {verdictResult.verdict}
                </span>
                <p className={cn('text-[11px] mt-0.5', typography.muted)}>
                  {verdictDisplay.headline}
                </p>
              </div>
            </div>
            {onShowDetails && (
              <button
                onClick={onShowDetails}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-md',
                  'bg-white/[0.03] hover:bg-white/[0.06]',
                  typography.muted,
                  'hover:text-white/50 transition-colors'
                )}
              >
                Details
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status rows */}
      <div className="px-5 py-3">
        {statuses.map((status, i) => (
          <StatusRow key={i} {...status} />
        ))}
      </div>

      {/* CTA button - signature glow sweep on hover */}
      {(hasBlockers || hasWarnings) && onFixBlockers && (
        <div className="px-5 pb-4 pt-1">
          <motion.button
            onClick={onFixBlockers}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium',
              'transition-all duration-300 relative overflow-hidden group',
              hasBlockers
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/15 hover:border-rose-500/25'
                : 'bg-amber-500/10 text-amber-300 border border-amber-500/15 hover:border-amber-500/25'
            )}
          >
            {/* Signature glow sweep - moves on hover */}
            <div
              className={cn(
                'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                'bg-gradient-to-r from-transparent via-white/[0.08] to-transparent',
                'translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out'
              )}
            />
            <Sparkles className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">
              {hasBlockers ? 'Fix blockers' : 'Improve chances'}
            </span>
            <ChevronRight className="w-3.5 h-3.5 relative z-10 group-hover:translate-x-0.5 transition-transform" />
          </motion.button>
        </div>
      )}

      {/* All clear message */}
      {!hasBlockers && !hasWarnings && (
        <div className="px-5 pb-4 pt-1">
          <div className={cn(
            'flex items-center gap-2 text-emerald-400 rounded-xl px-4 py-3',
            'bg-emerald-500/10 border border-emerald-500/15'
          )}>
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">You're all set to go!</span>
          </div>
        </div>
      )}

      {/* Quick links - Progressive disclosure */}
      {!hideQuickLinks && (onViewCosts || onViewChecklist || onViewHistory || onViewMap) && (
        <div className="px-5 pb-5 pt-2 border-t border-white/[0.04]">
          <div className="grid grid-cols-2 gap-2">
            {onViewCosts && (
              <QuickLink
                icon={<Receipt className="w-3.5 h-3.5" />}
                label="Costs"
                sublabel={grandTotal ? `${currency}${grandTotal.toLocaleString()}` : undefined}
                onClick={onViewCosts}
              />
            )}
            {onViewChecklist && (
              <QuickLink
                icon={<ClipboardList className="w-3.5 h-3.5" />}
                label="Checklist"
                onClick={onViewChecklist}
              />
            )}
            {onViewHistory && (
              <QuickLink
                icon={<History className="w-3.5 h-3.5" />}
                label="History"
                onClick={onViewHistory}
              />
            )}
            {onViewMap && (
              <QuickLink
                icon={<MapPin className="w-3.5 h-3.5" />}
                label="Full map"
                onClick={onViewMap}
              />
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export const DecisionStack = memo(DecisionStackComponent);
