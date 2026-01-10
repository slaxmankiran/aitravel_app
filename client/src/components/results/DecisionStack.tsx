/**
 * DecisionStack.tsx
 *
 * Single card combining all decision signals:
 * - Verdict summary
 * - Budget status
 * - Visa timing status
 * - Safety status
 * - Primary CTA
 *
 * This instantly explains the product value.
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  onFixBlockers?: () => void;
  onShowDetails?: () => void;
  className?: string;
}

interface StatusRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'ok' | 'warning' | 'error';
}

// ============================================================================
// STATUS ROW COMPONENT
// ============================================================================

function StatusRow({ icon, label, value, status }: StatusRowProps) {
  const statusColors = {
    ok: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400',
  };

  const statusIcons = {
    ok: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    error: <XCircle className="w-3.5 h-3.5 text-red-400" />,
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2 text-white/60">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={cn('text-xs font-medium', statusColors[status])}>
          {value}
        </span>
        {statusIcons[status]}
      </div>
    </div>
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
  onFixBlockers,
  onShowDetails,
  className,
}: DecisionStackProps) {
  const feasibility = trip.feasibilityReport as any;
  const visaDetails = feasibility?.visaDetails as VisaDetails | undefined;
  const safetyStatus = feasibility?.breakdown?.safety?.status;

  // Compute statuses
  const statuses = useMemo(() => {
    const items: StatusRowProps[] = [];

    // Budget status
    const budgetValue =
      budgetStatus === 'under' ? 'Within budget' :
      budgetStatus === 'near' ? 'Near limit' :
      budgetStatus === 'over20' ? `${currency}${Math.abs(Math.round(budgetOverBy)).toLocaleString()} over` :
      `${currency}${Math.abs(Math.round(budgetOverBy)).toLocaleString()} over`;

    items.push({
      icon: <DollarSign className="w-3.5 h-3.5" />,
      label: 'Budget',
      value: budgetValue,
      status: budgetStatus === 'under' ? 'ok' : budgetStatus === 'near' ? 'ok' : budgetStatus === 'over20' ? 'warning' : 'error',
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
  }, [budgetStatus, budgetOverBy, currency, visaDetails, safetyStatus]);

  // Determine if there are blockers or warnings
  // Verdict values: 'GO' | 'POSSIBLE' | 'DIFFICULT'
  const hasBlockers = statuses.some(s => s.status === 'error') ||
    (verdictResult && verdictResult.verdict === 'DIFFICULT' && verdictResult.score < 30);

  const hasWarnings = statuses.some(s => s.status === 'warning') ||
    (verdictResult && (verdictResult.verdict === 'POSSIBLE' || verdictResult.verdict === 'DIFFICULT'));

  // Verdict display
  const verdictDisplay = verdictResult ? getVerdictDisplay(verdictResult.verdict) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header with verdict */}
      {verdictResult && verdictDisplay && (
        <div
          className={cn(
            'px-4 py-3 border-b border-white/5',
            verdictResult.verdict === 'GO' ? 'bg-emerald-500/10' :
            verdictResult.verdict === 'DIFFICULT' ? 'bg-red-500/10' :
            'bg-amber-500/10'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  'border-2 font-bold text-xs',
                  verdictDisplay.borderClass,
                  verdictDisplay.textClass
                )}
              >
                {verdictResult.score}
              </div>
              <div>
                <span className={cn('font-semibold text-sm', verdictDisplay.textClass)}>
                  {verdictResult.verdict}
                </span>
                <p className="text-white/50 text-xs">
                  {verdictDisplay.headline}
                </p>
              </div>
            </div>
            {onShowDetails && (
              <button
                onClick={onShowDetails}
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Details
              </button>
            )}
          </div>
        </div>
      )}

      {/* Status rows */}
      <div className="px-4 py-2">
        {statuses.map((status, i) => (
          <StatusRow key={i} {...status} />
        ))}
      </div>

      {/* CTA button */}
      {(hasBlockers || hasWarnings) && onFixBlockers && (
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={onFixBlockers}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
              hasBlockers
                ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
            )}
          >
            <Sparkles className="w-4 h-4" />
            {hasBlockers ? 'Fix what blocks this trip' : 'Improve your chances'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* All clear message */}
      {!hasBlockers && !hasWarnings && (
        <div className="px-4 pb-4 pt-2">
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">You're all set to go!</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export const DecisionStack = memo(DecisionStackComponent);
