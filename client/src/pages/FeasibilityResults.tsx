import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle, AlertTriangle, XCircle, MapPin, Calendar, Users, Wallet, Plane, RefreshCw, Edit3, FileCheck, ShieldCheck, Clock, DollarSign, Ban, Globe, Info } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { CertaintyScoreDisplay } from "@/components/CertaintyScore";
import { VisaAlert } from "@/components/VisaAlert";
import { ActionItemsChecklist } from "@/components/ActionItems";
import { trackAlternativeClick, trackAlternativeImpression } from "@/lib/affiliate-links";
import type { CertaintyScore, VisaDetails, EntryCosts, ActionItem, Alternative } from "@shared/schema";
import { useState, useEffect } from "react";

// Currency symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', KRW: '₩', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  MXN: '$', BRL: 'R$', AED: 'د.إ', SAR: '﷼', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
};

function getCurrencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[currency || 'USD'] || currency || '$';
}

// Affiliate links
const AFFILIATE_CONFIG = {
  visa: 'https://www.ivisa.com/?utm_source=voyageai&utm_medium=affiliate',
  insurance: 'https://safetywing.com/nomad-insurance/?referenceID=voyageai',
  flights: 'https://www.skyscanner.com/?associate=voyageai',
  hotels: 'https://www.booking.com/?aid=voyageai',
};

// Helper functions to generate MVP data
function generateCertaintyScore(feasibilityReport: any): CertaintyScore | null {
  if (!feasibilityReport) return null;

  const breakdown = feasibilityReport.breakdown || {};
  const accessibilityStatus = breakdown.accessibility?.status || 'accessible';
  const visaStatus = breakdown.visa?.status || 'ok';
  const safetyStatus = breakdown.safety?.status || 'safe';
  const budgetStatus = breakdown.budget?.status || 'ok';

  const accessibilityScore = accessibilityStatus === 'accessible' ? 25 : accessibilityStatus === 'restricted' ? 15 : 5;
  const visaScore = visaStatus === 'ok' ? 30 : visaStatus === 'issue' ? 18 : 5;
  const safetyScore = safetyStatus === 'safe' ? 25 : safetyStatus === 'caution' ? 15 : 5;
  const budgetScore = budgetStatus === 'ok' ? 20 : budgetStatus === 'tight' ? 12 : 5;
  const totalScore = accessibilityScore + visaScore + safetyScore + budgetScore;

  const warnings: string[] = [];
  const blockers: string[] = [];

  if (visaStatus === 'issue') warnings.push(`Visa required: ${breakdown.visa?.reason || 'Check requirements'}`);
  if (budgetStatus === 'tight') warnings.push(`Budget is tight: ${breakdown.budget?.reason || 'Consider adjusting'}`);
  if (safetyStatus === 'caution') warnings.push(`Exercise caution: ${breakdown.safety?.reason || 'Check advisories'}`);
  if (accessibilityStatus === 'impossible') blockers.push(`Not accessible: ${breakdown.accessibility?.reason || 'Check destination'}`);
  if (safetyStatus === 'danger') blockers.push(`Safety concern: ${breakdown.safety?.reason || 'Not recommended'}`);

  let verdict: 'GO' | 'POSSIBLE' | 'DIFFICULT' | 'NO';
  let summary: string;

  if (totalScore >= 80) {
    verdict = 'GO';
    summary = "You're all set! Ready to plan your trip.";
  } else if (totalScore >= 60) {
    verdict = 'POSSIBLE';
    summary = 'You can go! Review the warnings below.';
  } else if (totalScore >= 40) {
    verdict = 'DIFFICULT';
    summary = 'Significant hurdles. Review carefully before proceeding.';
  } else {
    verdict = 'NO';
    summary = 'This trip is not recommended.';
  }

  return {
    score: totalScore,
    verdict,
    summary,
    breakdown: {
      accessibility: { score: accessibilityScore, status: accessibilityStatus === 'accessible' ? 'ok' : accessibilityStatus === 'restricted' ? 'warning' : 'blocker', reason: breakdown.accessibility?.reason || 'Destination accessible' },
      visa: { score: visaScore, status: visaStatus === 'ok' ? 'ok' : visaStatus === 'issue' ? 'warning' : 'blocker', reason: breakdown.visa?.reason || 'Check visa requirements', timingOk: true },
      safety: { score: safetyScore, status: safetyStatus === 'safe' ? 'ok' : safetyStatus === 'caution' ? 'warning' : 'blocker', reason: breakdown.safety?.reason || 'Safe destination' },
      budget: { score: budgetScore, status: budgetStatus === 'ok' ? 'ok' : budgetStatus === 'tight' ? 'warning' : 'blocker', reason: breakdown.budget?.reason || 'Within budget' },
    },
    warnings,
    blockers,
  };
}

// NOTE: generateVisaDetails removed - server is now single source of truth
// Visa details come from trip.feasibilityReport?.visaDetails

function generateActionItems(visaDetails: VisaDetails | null, currencySymbol: string, destination: string): ActionItem[] {
  const items: ActionItem[] = [];
  let id = 1;

  if (visaDetails?.required) {
    items.push({
      id: `action-${id++}`,
      title: 'Apply for visa',
      description: `${visaDetails.type === 'e_visa' ? 'Apply online' : 'Visit embassy/VFS'} for ${destination}`,
      priority: 'high',
      dueInfo: `${visaDetails.processingDays.minimum}-${visaDetails.processingDays.maximum} days processing`,
      affiliateLink: AFFILIATE_CONFIG.visa,
      affiliateLabel: 'Apply with iVisa',
      completed: false,
    });
  }

  items.push({
    id: `action-${id++}`,
    title: 'Get travel insurance',
    description: 'Protect your trip with comprehensive coverage',
    priority: visaDetails?.required ? 'medium' : 'high',
    dueInfo: 'Before departure',
    affiliateLink: AFFILIATE_CONFIG.insurance,
    affiliateLabel: 'Get SafetyWing',
    completed: false,
  });

  return items;
}

// Feasibility classification types
type FeasibilityClass = 'HARD_BLOCKER' | 'SOFT_BLOCKER' | 'CLEAR';

interface FeasibilityClassification {
  class: FeasibilityClass;
  hardBlockers: string[];
  softBlockers: string[];
}

// Classify feasibility into three tiers
function classifyFeasibility(
  feasibilityReport: any,
  visaDetails: VisaDetails | null,
  certaintyScore: CertaintyScore | null
): FeasibilityClassification {
  const hardBlockers: string[] = [];
  const softBlockers: string[] = [];

  if (!feasibilityReport || !certaintyScore) {
    return { class: 'CLEAR', hardBlockers: [], softBlockers: [] };
  }

  const breakdown = feasibilityReport.breakdown || {};

  // === HARD BLOCKERS (objective impossibilities) ===

  // Visa type = not_allowed or entry ban
  if (visaDetails?.type === 'not_allowed') {
    hardBlockers.push('Entry not permitted for your passport nationality');
  }

  // Processing time > days until trip (impossible timing)
  if (visaDetails?.timing?.urgency === 'impossible') {
    hardBlockers.push(`Visa processing (${visaDetails.processingDays.minimum}+ days) exceeds time until trip (${visaDetails.timing.daysUntilTrip} days)`);
  }

  // Accessibility = impossible (entry ban, conflict zone)
  if (breakdown.accessibility?.status === 'impossible') {
    hardBlockers.push(breakdown.accessibility?.reason || 'Destination is not accessible');
  }

  // Safety = danger (active conflict, government ban)
  if (breakdown.safety?.status === 'danger') {
    hardBlockers.push(breakdown.safety?.reason || 'Active safety threat - travel not recommended');
  }

  // === SOFT BLOCKERS (risky but possible) ===

  // Visa timing is tight or risky
  if (visaDetails?.timing?.urgency === 'tight') {
    softBlockers.push(`Visa timing is tight: ${visaDetails.timing.daysUntilTrip} days until trip, processing needs ${visaDetails.processingDays.maximum}+ days`);
  } else if (visaDetails?.timing?.urgency === 'risky') {
    softBlockers.push(`Visa timing is very risky: Only ${visaDetails.timing.daysUntilTrip} days until trip`);
  }

  // Budget significantly over
  if (breakdown.budget?.status === 'tight' || breakdown.budget?.status === 'over') {
    softBlockers.push(breakdown.budget?.reason || 'Budget may be insufficient');
  }

  // Safety caution
  if (breakdown.safety?.status === 'caution') {
    softBlockers.push(breakdown.safety?.reason || 'Exercise caution - check travel advisories');
  }

  // Accessibility restricted
  if (breakdown.accessibility?.status === 'restricted') {
    softBlockers.push(breakdown.accessibility?.reason || 'Some access restrictions apply');
  }

  // Determine class
  if (hardBlockers.length > 0) {
    return { class: 'HARD_BLOCKER', hardBlockers, softBlockers };
  } else if (softBlockers.length > 0) {
    return { class: 'SOFT_BLOCKER', hardBlockers, softBlockers };
  }
  return { class: 'CLEAR', hardBlockers, softBlockers };
}

// Risk acknowledgment modal for soft blockers
// Purpose: Force conscious acknowledgment of risks. Does NOT navigate or generate.
// One intent. One place. One action.
interface RiskAcknowledgmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAcknowledge: () => void;  // Only sets acknowledged state, doesn't generate
  risks: string[];
}

function RiskAcknowledgmentModal({ isOpen, onClose, onAcknowledge, risks }: RiskAcknowledgmentModalProps) {
  const [checked, setChecked] = useState(false);

  if (!isOpen) return null;

  const handleAcknowledge = () => {
    if (checked) {
      onAcknowledge();
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-full">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <h3 className="text-xl font-semibold text-white">Acknowledge risks</h3>
        </div>

        <p className="text-white/70 mb-4">
          Please confirm you understand these concerns:
        </p>

        <ul className="space-y-2 mb-6">
          {risks.map((risk, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <XCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <span className="text-white/80">{risk}</span>
            </li>
          ))}
        </ul>

        <label className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-white/10 cursor-pointer hover:bg-white/10 transition-colors mb-4">
          <Checkbox
            checked={checked}
            onCheckedChange={(val) => setChecked(val === true)}
            className="mt-0.5 border-white/30 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
          />
          <span className="text-sm text-white/80">
            I understand these risks and accept responsibility
          </span>
        </label>

        {/* Reassurance */}
        <p className="text-xs text-white/50 mb-6 text-center italic">
          VoyageAI will adjust recommendations to reduce risk where possible.
        </p>

        {/* Single CTA - acknowledgment only */}
        <Button
          onClick={handleAcknowledge}
          disabled={!checked}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
        >
          Acknowledge & Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}

// Animated Certainty Check Interstitial
function CertaintyCheckAnimation() {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const steps = [
    { icon: ShieldCheck, label: "Checking visa rules", color: "text-blue-400" },
    { icon: Clock, label: "Analyzing timing feasibility", color: "text-amber-400" },
    { icon: DollarSign, label: "Evaluating budget realism", color: "text-emerald-400" },
    { icon: FileCheck, label: "Verifying entry requirements", color: "text-purple-400" },
  ];

  useEffect(() => {
    // Animate through steps
    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < steps.length - 1) {
          setCompletedSteps(completed => [...completed, prev]);
          return prev + 1;
        }
        return prev;
      });
    }, 1200);

    // Mark last step as completed after delay
    const completeLastStep = setTimeout(() => {
      setCompletedSteps(completed => [...completed, steps.length - 1]);
    }, steps.length * 1200 + 800);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(completeLastStep);
    };
  }, []);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20"
    >
      <div className="text-center mb-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-primary to-emerald-500 flex items-center justify-center"
        >
          <Plane className="w-8 h-8 text-white" />
        </motion.div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Checking if your trip is feasible...
        </h3>
        <p className="text-white/60 text-sm">
          Analyzing requirements for your destination
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = currentStep === index && !isCompleted;
          const isPending = index > currentStep;
          const Icon = step.icon;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`flex items-center gap-4 p-3 rounded-lg transition-all duration-300 ${
                isCompleted
                  ? "bg-emerald-500/20 border border-emerald-500/30"
                  : isCurrent
                  ? "bg-white/10 border border-white/20"
                  : "bg-white/5 border border-transparent"
              }`}
            >
              <div className={`relative flex items-center justify-center w-10 h-10 rounded-full ${
                isCompleted
                  ? "bg-emerald-500"
                  : isCurrent
                  ? "bg-white/20"
                  : "bg-white/10"
              }`}>
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle className="w-5 h-5 text-white" />
                  </motion.div>
                ) : isCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-5 h-5 text-white" />
                  </motion.div>
                ) : (
                  <Icon className={`w-5 h-5 ${isPending ? "text-white/40" : step.color}`} />
                )}
              </div>

              <div className="flex-1">
                <p className={`font-medium ${
                  isCompleted
                    ? "text-emerald-400"
                    : isCurrent
                    ? "text-white"
                    : "text-white/50"
                }`}>
                  {step.label}
                </p>
              </div>

              {isCompleted && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-xs font-medium text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded"
                >
                  Done
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Progress indicator */}
      <div className="mt-8">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${((completedSteps.length) / steps.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-center text-white/40 text-xs mt-2">
          {completedSteps.length} of {steps.length} checks complete
        </p>
      </div>
    </motion.div>
  );
}

export default function FeasibilityResults() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);

  // Fetch trip data with polling while pending
  const { data: trip, isLoading, error, refetch } = useQuery({
    queryKey: ['trip', id],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${id}`);
      if (!res.ok) throw new Error('Failed to fetch trip');
      return res.json();
    },
    refetchInterval: (query) => {
      // Poll every 1 second while feasibility is pending
      // React Query v5: callback receives Query object, data is in query.state.data
      const tripData = query.state.data;
      if (tripData?.feasibilityStatus === 'pending') return 1000;
      return false;
    },
  });

  // Mutation to re-check feasibility (for backward compatibility)
  const recheckFeasibility = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/trips/${id}/feasibility/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to re-check feasibility');
      return res.json();
    },
    onSuccess: () => {
      // Refetch trip data to start polling
      refetch();
    },
  });

  // Mutation to start itinerary generation
  const generateItinerary = useMutation({
    mutationFn: async (options?: { riskOverride?: boolean }) => {
      const res = await fetch(`/api/trips/${id}/generate-itinerary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ riskOverride: options?.riskOverride || false }),
      });
      if (!res.ok) throw new Error('Failed to start itinerary generation');
      return res.json();
    },
    onSuccess: () => {
      setIsGenerating(true);
      // Redirect to V1 results page which will show progress
      setLocation(`/trips/${id}/results-v1`);
    },
  });

  // Calculate hard blocker status early for conditional query
  const tripCertaintyScore = trip ? generateCertaintyScore(trip.feasibilityReport) : null;
  const tripVisaDetails = trip?.feasibilityReport?.visaDetails || null;
  const tripClassification = trip ? classifyFeasibility(trip.feasibilityReport, tripVisaDetails, tripCertaintyScore) : null;
  const isHardBlockedForQuery = tripClassification?.class === 'HARD_BLOCKER';

  // Fetch alternatives when trip is hard-blocked
  const { data: alternativesData } = useQuery({
    queryKey: ['alternatives', trip?.passport, trip?.destination],
    queryFn: async () => {
      const params = new URLSearchParams({
        passport: trip!.passport,
        blocked: trip!.destination,
      });
      const res = await fetch(`/api/alternatives?${params}`);
      if (!res.ok) throw new Error('Failed to fetch alternatives');
      return res.json() as Promise<{ alternatives: Alternative[] }>;
    },
    enabled: !!trip && isHardBlockedForQuery,
  });

  const alternatives = alternativesData?.alternatives || [];

  // Track impressions when alternatives are shown (for CTR calculation)
  // IMPORTANT: tripId enables server-side deduplication - only first impression per trip counts
  useEffect(() => {
    if (alternatives.length > 0 && trip && isHardBlockedForQuery) {
      trackAlternativeImpression(
        trip.passport,
        trip.destination,
        alternatives.map(alt => alt.destination),
        trip.id  // Pass tripId for deduplication
      );
    }
  }, [alternatives.length, trip?.passport, trip?.destination, trip?.id, isHardBlockedForQuery]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white/70">Trip not found</p>
          <Button onClick={() => setLocation('/')} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const isPending = trip.feasibilityStatus === 'pending';
  const currencySymbol = getCurrencySymbol(trip.currency);

  // Check for backward compatibility - old trips without visaDetails
  const needsRecheck = !isPending && trip.feasibilityReport && !trip.feasibilityReport?.visaDetails;

  // Generate MVP data
  const certaintyScore = tripCertaintyScore;
  // Use server-provided visa details (single source of truth)
  const visaDetails = tripVisaDetails;
  const actionItems = generateActionItems(visaDetails, currencySymbol, trip.destination);

  // Classify feasibility into tiered gate
  const feasibilityClassification = tripClassification!;
  const isHardBlocked = feasibilityClassification.class === 'HARD_BLOCKER';
  const isSoftBlocked = feasibilityClassification.class === 'SOFT_BLOCKER';
  const isClear = feasibilityClassification.class === 'CLEAR';

  // Handler for "Generate Acknowledging Risks" button on page
  const handleGenerateWithRisks = () => {
    if (riskAcknowledged) {
      // Already acknowledged - proceed directly
      generateItinerary.mutate({ riskOverride: true });
    } else {
      // Not yet acknowledged - show modal first
      setShowRiskModal(true);
    }
  };

  // Handler for modal acknowledgment (just sets state, doesn't generate)
  const handleRiskAcknowledge = () => {
    setRiskAcknowledged(true);
  };

  // Generate edit URL with all trip parameters pre-filled
  const getEditTripUrl = () => {
    const params = new URLSearchParams({
      edit: 'true',
      passport: trip.passport || '',
      origin: trip.origin || '',
      destination: trip.destination || '',
      dates: trip.dates || '',
      currency: trip.currency || 'USD',
      adults: String(trip.adults || 1),
      children: String(trip.children || 0),
      infants: String(trip.infants || 0),
    });
    if (trip.budget) {
      params.set('budget', String(trip.budget));
    }
    if (trip.travelStyle) {
      params.set('travelStyle', trip.travelStyle);
    }
    return `/create?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setLocation(getEditTripUrl())}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Edit Trip</span>
          </button>
          <h1 className="text-lg font-semibold text-white">Feasibility Check</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Trip Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <MapPin className="w-6 h-6 text-primary" />
                {trip.destination}
              </h2>
              <div className="flex flex-wrap gap-4 mt-2 text-white/70 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {trip.dates}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {trip.groupSize} traveler{trip.groupSize > 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Wallet className="w-4 h-4" />
                  {trip.travelStyle === 'custom'
                    ? `${currencySymbol}${trip.budget.toLocaleString()}`
                    : `${trip.travelStyle?.charAt(0).toUpperCase()}${trip.travelStyle?.slice(1)} Style`}
                </span>
                <span className="flex items-center gap-1">
                  <Plane className="w-4 h-4" />
                  {trip.passport} passport
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Data Freshness Notice - for older trips without visa details */}
        {needsRecheck && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium">Visa details not yet available for this trip</p>
                <p className="text-white/60 text-sm">
                  This trip was created before detailed visa analysis was introduced. Re-check feasibility to see verified visa costs, documents, and timing.
                </p>
              </div>
            </div>
            <Button
              onClick={() => recheckFeasibility.mutate()}
              disabled={recheckFeasibility.isPending}
              className="bg-blue-500 hover:bg-blue-600 text-white shrink-0"
            >
              {recheckFeasibility.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Re-check Feasibility
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* Loading State - Animated Certainty Check */}
        <AnimatePresence mode="wait">
          {isPending && (
            <CertaintyCheckAnimation />
          )}

          {/* Results */}
          {!isPending && certaintyScore && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Certainty Score */}
              <CertaintyScoreDisplay certaintyScore={certaintyScore} />

              {/* Why This Matters - Educational tooltip */}
              <div className="flex justify-center">
                <details className="group max-w-md">
                  <summary className="flex items-center gap-2 text-white/60 text-sm cursor-pointer hover:text-white/80 transition-colors list-none">
                    <Info className="w-4 h-4" />
                    <span>Why we check this first</span>
                    <span className="text-xs text-white/40 group-open:hidden">▼</span>
                    <span className="text-xs text-white/40 hidden group-open:inline">▲</span>
                  </summary>
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 p-4 bg-white/5 rounded-lg border border-white/10 text-sm text-white/70"
                  >
                    <p className="mb-2">
                      Many international trips fail due to visa timing, hidden entry costs, or passport restrictions.
                    </p>
                    <p className="mb-3">
                      VoyageAI verifies feasibility <strong className="text-white/90">before</strong> planning so you don't book something that can't happen.
                    </p>
                    <p className="text-xs text-white/50 border-t border-white/10 pt-3">
                      Feasibility is based on the latest publicly available visa and safety rules. Always confirm with official sources before booking.
                    </p>
                  </motion.div>
                </details>
              </div>

              {/* Visa Alert */}
              {visaDetails && (
                <VisaAlert
                  visaDetails={visaDetails}
                  passport={trip.passport}
                  destination={trip.destination}
                  currencySymbol={currencySymbol}
                  totalTravelers={trip.groupSize || 1}
                />
              )}

              {/* Pre-Trip Action Items */}
              {actionItems.length > 0 && (
                <ActionItemsChecklist items={actionItems} />
              )}

              {/* Divider between Action Items and Decision */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
              </div>

              {/* Decision Buttons - Tiered Gate System */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`backdrop-blur-xl rounded-2xl p-6 border ${
                  isHardBlocked
                    ? 'bg-red-500/10 border-red-500/30'
                    : isSoftBlocked
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-white/10 border-white/20'
                }`}
              >
                {/* HARD BLOCKER - No override allowed */}
                {isHardBlocked && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-red-500/20 rounded-full">
                        <Ban className="w-5 h-5 text-red-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">This trip cannot proceed</h3>
                    </div>

                    <p className="text-white/70">
                      This trip cannot be taken on your passport for the selected dates. We can help you find alternatives that work.
                    </p>

                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
                      {feasibilityClassification.hardBlockers.map((blocker, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                          <span className="text-red-200">{blocker}</span>
                        </div>
                      ))}
                    </div>

                    {/* Alternative Destinations */}
                    {alternatives.length > 0 && (
                      <div className="mt-6">
                        <div className="mb-4">
                          <h4 className="text-white font-medium flex items-center gap-2">
                            <Globe className="w-4 h-4 text-emerald-400" />
                            This trip isn't feasible right now
                          </h4>
                          <p className="text-white/60 text-sm mt-1 ml-6">
                            Here are destinations you can travel to with fewer restrictions.
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {alternatives.map((alt, index) => (
                            <motion.div
                              key={alt.destinationCode}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className={`bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors ${
                                alt.isCurated
                                  ? 'border border-emerald-500/30'
                                  : 'border border-white/10'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{alt.flag}</span>
                                <div>
                                  <p className="text-white font-medium">{alt.city}</p>
                                  <p className="text-white/60 text-xs">{alt.destination}</p>
                                </div>
                              </div>

                              {/* Visa Badge */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  alt.visaStatus === 'visa_free'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : alt.visaStatus === 'visa_on_arrival'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {alt.visaLabel}
                                </span>
                                {alt.isCurated && (
                                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3" />
                                    Verified
                                  </span>
                                )}
                              </div>

                              {/* Why this works - expandable for curated alternatives */}
                              {alt.isCurated ? (
                                <details className="group mb-3">
                                  <summary className="text-xs text-emerald-400 cursor-pointer hover:text-emerald-300 list-none flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    <span>Why this works</span>
                                    <span className="text-[10px] text-white/40 ml-1 group-open:hidden">+</span>
                                    <span className="text-[10px] text-white/40 ml-1 hidden group-open:inline">−</span>
                                  </summary>
                                  <ul className="mt-2 space-y-1 text-xs text-white/60 pl-4">
                                    <li className="flex items-start gap-1">
                                      <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                      <span>{alt.visaLabel} ({alt.processingDays === 0 ? 'instant' : `${alt.processingDays} days`})</span>
                                    </li>
                                    <li className="flex items-start gap-1">
                                      <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                      <span>{alt.reason}</span>
                                    </li>
                                    <li className="flex items-start gap-1">
                                      <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                                      <span>No visa appointment required</span>
                                    </li>
                                  </ul>
                                </details>
                              ) : (
                                <p className="text-white/50 text-xs mb-3">{alt.reason}</p>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                className={`w-full ${
                                  alt.isCurated
                                    ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10'
                                    : 'border-white/20 text-white hover:bg-white/10'
                                }`}
                                onClick={() => {
                                  // Track the alternative click for analytics
                                  // tripId enables server-side deduplication - only first click per trip+destination counts
                                  trackAlternativeClick({
                                    tripId: trip.id,
                                    passport: trip.passport,
                                    blockedDestination: trip.destination,
                                    alternativeDestination: alt.destination,
                                    alternativeCity: alt.city,
                                    visaType: alt.visaType,
                                    visaStatus: alt.visaStatus,
                                    confidence: alt.confidence,
                                  });
                                  // Navigate to create trip with this destination pre-filled
                                  setLocation(`/create?destination=${encodeURIComponent(alt.city + ', ' + alt.destination)}`);
                                }}
                              >
                                Check feasibility
                                <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                      <Button
                        size="lg"
                        onClick={() => setLocation(getEditTripUrl())}
                        className="flex-1 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 text-white"
                      >
                        <Edit3 className="w-5 h-5 mr-2" />
                        Adjust Trip
                      </Button>
                    </div>
                  </div>
                )}

                {/* SOFT BLOCKER - Override with confirmation */}
                {isSoftBlocked && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-amber-500/20 rounded-full">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">Proceed with caution</h3>
                    </div>

                    <p className="text-white/70">
                      We've identified some concerns with this trip. You can still proceed, but please review the warnings below.
                    </p>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 space-y-2">
                      {feasibilityClassification.softBlockers.map((blocker, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                          <span className="text-amber-200">{blocker}</span>
                        </div>
                      ))}
                    </div>

                    {/* Risk acknowledgment status */}
                    {riskAcknowledged && (
                      <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Risks acknowledged. You can now generate your itinerary.</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        size="lg"
                        onClick={() => setLocation(getEditTripUrl())}
                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      >
                        <Edit3 className="w-5 h-5 mr-2" />
                        Adjust Trip
                      </Button>
                      <Button
                        size="lg"
                        variant={riskAcknowledged ? "default" : "outline"}
                        onClick={handleGenerateWithRisks}
                        disabled={generateItinerary.isPending}
                        className={riskAcknowledged
                          ? "flex-1 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 text-white"
                          : "flex-1 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                        }
                      >
                        {generateItinerary.isPending ? (
                          <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : riskAcknowledged ? (
                          <>
                            Generate Itinerary
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        ) : (
                          <>
                            Generate Acknowledging Risks
                            <ArrowRight className="w-5 h-5 ml-2" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* CLEAR - Smooth flow */}
                {isClear && (
                  <div className="space-y-4">
                    {/* Confirmation header */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-full">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">Feasibility verified</h3>
                        <p className="text-sm text-white/60">You can proceed to itinerary generation</p>
                      </div>
                    </div>

                    {/* Primary CTA - Generate Itinerary */}
                    <Button
                      size="lg"
                      onClick={() => generateItinerary.mutate({})}
                      disabled={generateItinerary.isPending}
                      className="w-full bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 text-white"
                    >
                      {generateItinerary.isPending ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          Generate Itinerary
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </motion.div>

              {/* Risk Acknowledgment Modal for Soft Blockers */}
              <AnimatePresence>
                {showRiskModal && (
                  <RiskAcknowledgmentModal
                    isOpen={showRiskModal}
                    onClose={() => setShowRiskModal(false)}
                    onAcknowledge={handleRiskAcknowledge}
                    risks={feasibilityClassification.softBlockers}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
