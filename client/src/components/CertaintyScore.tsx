import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, Plane, FileCheck, ShieldCheck, Wallet, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CertaintyScore as CertaintyScoreType } from "@shared/schema";

interface Props {
  certaintyScore: CertaintyScoreType;
  travelStyle?: 'budget' | 'standard' | 'luxury' | 'custom';
}

export function CertaintyScoreDisplay({ certaintyScore, travelStyle }: Props) {
  const { score, verdict, summary, breakdown, blockers, warnings } = certaintyScore;

  // For travel style trips (budget/standard/luxury), budget scoring is meaningless
  // since there's no user-specified budget to compare against
  const isCustomBudget = travelStyle === 'custom';

  const getVerdictColor = () => {
    switch (verdict) {
      case 'GO': return 'from-emerald-500 to-emerald-600';
      case 'POSSIBLE': return 'from-amber-500 to-amber-600';
      case 'DIFFICULT': return 'from-orange-500 to-orange-600';
      case 'NO': return 'from-red-500 to-red-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getVerdictBgColor = () => {
    switch (verdict) {
      case 'GO': return 'bg-emerald-50 border-emerald-200';
      case 'POSSIBLE': return 'bg-amber-50 border-amber-200';
      case 'DIFFICULT': return 'bg-orange-50 border-orange-200';
      case 'NO': return 'bg-red-50 border-red-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'blocker') => {
    switch (status) {
      case 'ok': return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'blocker': return <XCircle className="w-4 h-4 text-red-600" />;
    }
  };

  const getBarColor = (status: 'ok' | 'warning' | 'blocker') => {
    switch (status) {
      case 'ok': return 'bg-emerald-500';
      case 'warning': return 'bg-amber-500';
      case 'blocker': return 'bg-red-500';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'accessibility': return <Plane className="w-4 h-4" />;
      case 'visa': return <FileCheck className="w-4 h-4" />;
      case 'safety': return <ShieldCheck className="w-4 h-4" />;
      case 'budget': return <Wallet className="w-4 h-4" />;
      default: return null;
    }
  };

  // Build categories based on travel style
  // For custom budget: show all 4 categories including budget comparison
  // For travel styles (budget/comfort/luxury): skip budget bar since it's meaningless
  const categories = isCustomBudget
    ? [
        { key: 'accessibility', label: 'Accessible', maxScore: 25, data: breakdown.accessibility },
        { key: 'visa', label: 'Visa', maxScore: 30, data: breakdown.visa },
        { key: 'safety', label: 'Safe', maxScore: 25, data: breakdown.safety },
        { key: 'budget', label: 'Budget', maxScore: 20, data: breakdown.budget },
      ]
    : [
        { key: 'accessibility', label: 'Accessible', maxScore: 25, data: breakdown.accessibility },
        { key: 'visa', label: 'Visa', maxScore: 30, data: breakdown.visa },
        { key: 'safety', label: 'Safe', maxScore: 25, data: breakdown.safety },
      ];

  // Get travel style display label
  const getTravelStyleLabel = () => {
    switch (travelStyle) {
      case 'budget': return 'Budget Travel';
      case 'standard': return 'Comfort Travel';
      case 'luxury': return 'Luxury Travel';
      default: return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={`overflow-hidden shadow-lg border ${getVerdictBgColor()}`}>
        <CardHeader className="pb-4">
          {/* Main Score Display */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              {/* Circular Score */}
              <div className="relative">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-slate-200"
                  />
                  <motion.circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="url(#scoreGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 251.2" }}
                    animate={{ strokeDasharray: `${(score / 100) * 251.2} 251.2` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" className={verdict === 'GO' ? 'text-emerald-400' : verdict === 'POSSIBLE' ? 'text-amber-400' : verdict === 'DIFFICULT' ? 'text-orange-400' : 'text-red-400'} stopColor="currentColor" />
                      <stop offset="100%" className={verdict === 'GO' ? 'text-emerald-600' : verdict === 'POSSIBLE' ? 'text-amber-600' : verdict === 'DIFFICULT' ? 'text-orange-600' : 'text-red-600'} stopColor="currentColor" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.span
                    className="text-2xl font-bold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    {score}
                  </motion.span>
                </div>
              </div>

              {/* Verdict Text */}
              <div>
                <div className={`inline-block px-3 py-1 rounded-full text-sm font-bold text-white bg-gradient-to-r ${getVerdictColor()} mb-2`}>
                  {verdict === 'GO' && 'READY TO GO'}
                  {verdict === 'POSSIBLE' && 'POSSIBLE'}
                  {verdict === 'DIFFICULT' && 'DIFFICULT'}
                  {verdict === 'NO' && 'NOT RECOMMENDED'}
                </div>
                <p className="text-lg font-medium text-slate-700">{summary}</p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Score Breakdown Bars */}
          <div className="space-y-3">
            {categories.map((cat, index) => (
              <motion.div
                key={cat.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="flex items-center gap-2 w-28 shrink-0">
                  {getStatusIcon(cat.data.status)}
                  <span className="text-sm font-medium text-slate-600">{cat.label}</span>
                </div>

                <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${getBarColor(cat.data.status)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(cat.data.score / cat.maxScore) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
                  />
                </div>

                <span className="text-sm font-mono text-slate-500 w-12 text-right">
                  {cat.data.score}/{cat.maxScore}
                </span>
              </motion.div>
            ))}

            {/* Travel Style indicator (shown for non-custom budget trips) */}
            {!isCustomBudget && getTravelStyleLabel() && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-3 pt-2 border-t border-slate-200"
              >
                <div className="flex items-center gap-2 w-28 shrink-0">
                  <Sparkles className={`w-4 h-4 ${
                    travelStyle === 'luxury' ? 'text-amber-500' :
                    travelStyle === 'budget' ? 'text-emerald-500' :
                    'text-blue-500'
                  }`} />
                  <span className="text-sm font-medium text-slate-600">Style</span>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  travelStyle === 'luxury' ? 'bg-amber-100 text-amber-700' :
                  travelStyle === 'budget' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {getTravelStyleLabel()}
                </div>
                <span className="text-xs text-slate-400 italic ml-auto">
                  AI will optimize for this style
                </span>
              </motion.div>
            )}
          </div>

          {/* Blockers */}
          {blockers.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <div className="flex items-center gap-2 text-red-700 font-semibold mb-2">
                <XCircle className="w-4 h-4" />
                <span>Blockers</span>
              </div>
              <ul className="space-y-1">
                {blockers.map((blocker, i) => (
                  <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                    <span className="text-red-400 mt-1">•</span>
                    {blocker}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg"
            >
              <div className="flex items-center gap-2 text-amber-700 font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Warnings</span>
              </div>
              <ul className="space-y-1">
                {warnings.map((warning, i) => (
                  <li key={i} className="text-sm text-amber-600 flex items-start gap-2">
                    <span className="text-amber-400 mt-1">•</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
