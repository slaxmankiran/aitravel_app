import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, ShieldCheck, Wallet, FileCheck, MapPin, Plane } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { type TripResponse, type FeasibilityReport } from "@shared/schema";

// Currency symbol mapping - supports all 28 currencies
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
  CHF: 'CHF', KRW: '₩', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  MXN: '$', BRL: 'R$', AED: 'د.إ', SAR: '﷼', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
  ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
};

function getCurrencySymbol(currency?: string): string {
  return CURRENCY_SYMBOLS[currency || 'USD'] || currency || '$';
}

interface Props {
  trip: TripResponse;
}

export function FeasibilityReportView({ trip }: Props) {
  const report = trip.feasibilityReport as unknown as FeasibilityReport;
  const currencySymbol = getCurrencySymbol(trip.currency ?? undefined);

  if (!report) return null;

  const getStatusColor = (status: string) => {
    switch(status) {
      case "yes": case "ok": case "safe": case "accessible": return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "warning": case "tight": case "caution": case "restricted": return "text-amber-600 bg-amber-50 border-amber-200";
      case "no": case "issue": case "impossible": case "danger": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "yes": case "ok": case "safe": case "accessible": return <CheckCircle className="w-6 h-6" />;
      case "warning": case "tight": case "caution": case "restricted": return <AlertTriangle className="w-6 h-6" />;
      case "no": case "issue": case "impossible": case "danger": return <XCircle className="w-6 h-6" />;
      default: return <AlertTriangle className="w-6 h-6" />;
    }
  };

  // Convert visa status to user-friendly display
  // Also check reason text for "require" as fallback when AI returns wrong status
  const getVisaDisplayText = (status: string, reason?: string) => {
    // Check if reason mentions "require" or "visa" needed - override status if so
    const reasonLower = (reason || '').toLowerCase();
    const visaRequired = reasonLower.includes('require') || reasonLower.includes('must obtain') ||
                         reasonLower.includes('need a visa') || reasonLower.includes('visa needed');

    if (visaRequired && (status === "ok" || status === "yes" || status === "safe")) {
      return "Required"; // Override incorrect status
    }

    switch(status) {
      case "ok": case "yes": case "safe": return "Not Required";
      case "warning": case "caution": return "Visa on Arrival";
      case "issue": case "no": case "danger": return "Required";
      default: return "Check Required";
    }
  };

  const getVisaStatusColor = (status: string, reason?: string) => {
    // Check if reason mentions visa requirement - override status if so
    const reasonLower = (reason || '').toLowerCase();
    const visaRequired = reasonLower.includes('require') || reasonLower.includes('must obtain') ||
                         reasonLower.includes('need a visa') || reasonLower.includes('visa needed');

    if (visaRequired && (status === "ok" || status === "yes" || status === "safe")) {
      return "text-amber-600 bg-amber-50 border border-amber-200"; // Show as warning
    }

    switch(status) {
      case "ok": case "yes": case "safe": return "text-emerald-600 bg-emerald-50 border border-emerald-200";
      case "warning": case "caution": return "text-amber-600 bg-amber-50 border border-amber-200";
      case "issue": case "no": case "danger": return "text-amber-600 bg-amber-50 border border-amber-200"; // Changed from red to amber - visa required is a warning, not a blocker
      default: return "text-slate-600 bg-slate-50 border border-slate-200";
    }
  };

  // Separate icon logic for visa - "Required" should show warning, not X
  const getVisaIcon = (status: string, reason?: string) => {
    const reasonLower = (reason || '').toLowerCase();
    const visaRequired = reasonLower.includes('require') || reasonLower.includes('must obtain') ||
                         reasonLower.includes('need a visa') || reasonLower.includes('visa needed');

    // Visa required = warning (action needed), not X (blocked)
    if (visaRequired || status === "issue") {
      return <AlertTriangle className="w-6 h-6" />; // ⚠️ Warning - action needed
    }

    switch(status) {
      case "ok": case "yes": case "safe": return <CheckCircle className="w-6 h-6" />; // ✓ No visa needed
      case "warning": case "caution": return <AlertTriangle className="w-6 h-6" />; // ⚠️ VOA available
      case "no": case "danger": return <XCircle className="w-6 h-6" />; // ❌ Visa not available
      default: return <AlertTriangle className="w-6 h-6" />;
    }
  };

  // Check if accessibility data exists in the report
  const hasAccessibility = report.breakdown && 'accessibility' in report.breakdown;
  const accessibility = hasAccessibility ? (report.breakdown as any).accessibility : null;

  const budgetData = [
    { name: 'Estimated Cost', value: report.breakdown.budget.estimatedCost },
    { name: 'Remaining Budget', value: Math.max(0, trip.budget - report.breakdown.budget.estimatedCost) },
  ];
  
  const budgetColors = ['#6366f1', '#e2e8f0'];

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className={`border-l-8 overflow-hidden shadow-lg ${
          report.overall === 'yes' ? 'border-l-emerald-500' : 
          report.overall === 'warning' ? 'border-l-amber-500' : 'border-l-red-500'
        }`}>
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <h1 className="text-9xl font-bold font-display">{report.score}</h1>
          </div>
          
          <CardHeader className="relative pb-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Overall Feasibility</p>
                <CardTitle className="text-3xl">
                  {report.overall === 'yes' ? 'Good to Go!' : 
                   report.overall === 'warning' ? 'Proceed with Caution' : 'Not Recommended'}
                </CardTitle>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-bold ${getStatusColor(report.overall)}`}>
                {getStatusIcon(report.overall)}
                <span>Score: {report.score}/100</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <p className="text-lg text-slate-700 leading-relaxed max-w-2xl">{report.summary}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown Grid - 4 columns when accessibility present, otherwise 3 */}
      <div className={`grid grid-cols-1 gap-6 ${hasAccessibility ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>

        {/* Accessibility Status - FIRST and MOST IMPORTANT when present */}
        {hasAccessibility && accessibility && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.5 }}
          >
            <Card className={`h-full shadow-md hover:shadow-xl transition-all duration-300 ${
              accessibility.status === 'impossible' ? 'border-2 border-red-300 bg-red-50/30' : ''
            }`}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${
                    accessibility.status === 'accessible' ? 'bg-emerald-100 text-emerald-600' :
                    accessibility.status === 'restricted' ? 'bg-amber-100 text-amber-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    <Plane className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-lg">Accessibility</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-4 ${getStatusColor(accessibility.status)}`}>
                  {getStatusIcon(accessibility.status)}
                  <span className="capitalize">{accessibility.status.replace('-', ' ')}</span>
                </div>
                <p className="text-slate-600 text-sm">{accessibility.reason}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Visa Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          <Card className="h-full shadow-md hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">Visa Status</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-4 ${getVisaStatusColor(report.breakdown.visa.status, report.breakdown.visa.reason)}`}>
                {getVisaIcon(report.breakdown.visa.status, report.breakdown.visa.reason)}
                <span>{getVisaDisplayText(report.breakdown.visa.status, report.breakdown.visa.reason)}</span>
              </div>
              <p className="text-slate-600 text-sm">{report.breakdown.visa.reason}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Budget Analysis - Different display for custom vs travel style selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <Card className="h-full shadow-md hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">
                  {trip.travelStyle === 'custom' ? 'Budget Check' : 'Travel Style'}
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              {trip.travelStyle === 'custom' ? (
                // Custom budget - show budget comparison
                <>
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Estimated</p>
                      <p className="text-xl font-bold font-mono">{currencySymbol}{report.breakdown.budget.estimatedCost.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase">Your Budget</p>
                      <p className="text-lg font-mono text-slate-500">{currencySymbol}{trip.budget.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${report.breakdown.budget.estimatedCost > trip.budget ? 'bg-red-500' : 'bg-indigo-500'}`}
                      style={{ width: `${Math.min(100, (report.breakdown.budget.estimatedCost / trip.budget) * 100)}%` }}
                    />
                  </div>
                  <p className="text-slate-600 text-sm mt-3">{report.breakdown.budget.reason}</p>
                </>
              ) : (
                // Travel style selected - show style info instead of budget
                <>
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-4 ${
                    trip.travelStyle === 'luxury' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                    trip.travelStyle === 'budget' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                    'text-blue-600 bg-blue-50 border-blue-200'
                  }`}>
                    <CheckCircle className="w-4 h-4" />
                    <span className="capitalize">
                      {trip.travelStyle === 'budget' ? 'Budget Travel' :
                       trip.travelStyle === 'standard' ? 'Comfort Travel' :
                       trip.travelStyle === 'luxury' ? 'Luxury Travel' : trip.travelStyle}
                    </span>
                  </div>
                  <p className="text-slate-600 text-sm">
                    {trip.travelStyle === 'budget' && 'Hostels, street food, public transport - best value for money'}
                    {trip.travelStyle === 'standard' && '3-4 star hotels, local restaurants, mix of transport options'}
                    {trip.travelStyle === 'luxury' && '5-star resorts, fine dining, private transfers - premium experience'}
                  </p>
                  <p className="text-slate-500 text-xs mt-3 italic">
                    AI will calculate realistic costs based on your travel style
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Safety Assessment */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="h-full shadow-md hover:shadow-xl transition-all duration-300">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg">Safety Risk</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold mb-4 ${getStatusColor(report.breakdown.safety.status)}`}>
                {getStatusIcon(report.breakdown.safety.status)}
                <span className="capitalize">{report.breakdown.safety.status}</span>
              </div>
              <p className="text-slate-600 text-sm">{report.breakdown.safety.reason}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
