import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, Calendar, DollarSign, FileText, X, ExternalLink, CheckCircle, AlertCircle, ShieldCheck, Info } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { VisaDetails, VisaTiming } from "@shared/schema";

interface Props {
  visaDetails: VisaDetails;
  passport: string;
  destination: string;
  currencySymbol: string;
  totalTravelers: number;
}

export function VisaAlert({ visaDetails, passport, destination, currencySymbol, totalTravelers }: Props) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (!visaDetails.required || isDismissed) {
    return null;
  }

  const timing = visaDetails.timing;
  const totalVisaCost = (visaDetails.cost.government + (visaDetails.cost.service || 0)) * totalTravelers;

  // Color based on VISA TYPE (action required), not timing
  // Embassy visa = red (most action needed)
  // E-visa = amber (some action needed)
  // Visa on arrival = yellow-green (minimal action)
  const getVisaTypeColor = () => {
    switch (visaDetails.type) {
      case 'visa_on_arrival':
        return 'border-amber-300 bg-amber-50';
      case 'e_visa':
        return 'border-orange-300 bg-orange-50';
      case 'embassy_visa':
      default:
        return 'border-red-300 bg-red-50';
    }
  };

  const getVisaTypeIcon = () => {
    switch (visaDetails.type) {
      case 'visa_on_arrival':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'e_visa':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'embassy_visa':
      default:
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getUrgencyLabel = () => {
    if (!timing) return 'CHECK TIMING';
    switch (timing.urgency) {
      case 'ok': return 'PLENTY OF TIME';
      case 'tight': return 'TIME IS TIGHT';
      case 'risky': return 'VERY RISKY';
      case 'impossible': return 'NOT ENOUGH TIME';
      default: return 'CHECK TIMING';
    }
  };

  const getUrgencyTextColor = () => {
    if (!timing) return 'text-amber-700';
    switch (timing.urgency) {
      case 'ok': return 'text-emerald-700';
      case 'tight': return 'text-amber-700';
      case 'risky': return 'text-orange-700';
      case 'impossible': return 'text-red-700';
      default: return 'text-amber-700';
    }
  };

  const getVisaTypeLabel = () => {
    switch (visaDetails.type) {
      case 'e_visa': return 'E-Visa';
      case 'embassy_visa': return 'Embassy Visa';
      case 'visa_on_arrival': return 'Visa on Arrival';
      default: return 'Visa';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={`border-2 ${getVisaTypeColor()} shadow-md overflow-hidden`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {getVisaTypeIcon()}
                <div>
                  <h3 className="font-semibold text-lg">Visa Required</h3>
                  <p className="text-sm text-slate-600">
                    {visaDetails.name || `${getVisaTypeLabel()} for ${destination}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDismissed(true)}
                className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Key Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Processing Time */}
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500 uppercase">Processing</p>
                  <p className="font-medium">
                    {visaDetails.type === 'visa_on_arrival' ||
                     (visaDetails.processingDays.minimum === 0 && visaDetails.processingDays.maximum === 0)
                      ? 'On Arrival'
                      : `${visaDetails.processingDays.minimum}-${visaDetails.processingDays.maximum} days`
                    }
                  </p>
                </div>
              </div>

              {/* Days Until Trip */}
              {timing && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Trip In</p>
                    <p className="font-medium">{timing.daysUntilTrip} days</p>
                  </div>
                </div>
              )}

              {/* Cost */}
              <div className="flex items-start gap-2">
                <DollarSign className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 uppercase">
                      {visaDetails.cost.accuracy === 'curated' ? 'Visa Fees' : 'Est. Visa Fees'}
                    </p>
                    {visaDetails.cost.accuracy === 'curated' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                        <Info className="w-3 h-3" />
                        Estimate
                      </span>
                    )}
                  </div>
                  <p className="font-medium">
                    {visaDetails.cost.currency !== 'USD' && visaDetails.cost.currency}
                    {visaDetails.cost.currency === 'USD' ? currencySymbol : ' '}
                    {(visaDetails.cost.totalPerPerson || (visaDetails.cost.government + (visaDetails.cost.service || 0))).toLocaleString()}
                    /person
                  </p>
                  {totalTravelers > 1 && (
                    <p className="text-xs text-slate-400">
                      Total: {currencySymbol}{totalVisaCost.toLocaleString()} ({totalTravelers} travelers)
                    </p>
                  )}
                  <p className="text-xs text-slate-400 italic">
                    {visaDetails.cost.breakdownLabel || "Gov't fee + service charge"}
                  </p>
                </div>
              </div>
            </div>

            {/* Urgency Status */}
            {timing && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                timing.urgency === 'ok' ? 'bg-emerald-100' :
                timing.urgency === 'tight' ? 'bg-amber-100' :
                timing.urgency === 'risky' ? 'bg-orange-100' :
                'bg-red-100'
              }`}>
                <Clock className={`w-5 h-5 ${getUrgencyTextColor()}`} />
                <div>
                  <span className={`font-bold text-sm ${getUrgencyTextColor()}`}>
                    {getUrgencyLabel()}
                  </span>
                  <span className="text-sm text-slate-600 ml-2">
                    {timing.recommendation}
                  </span>
                </div>
              </div>
            )}

            {/* Documents Required */}
            {visaDetails.documentsRequired && visaDetails.documentsRequired.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">Documents Needed</span>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {visaDetails.documentsRequired.slice(0, 6).map((doc, i) => (
                    <li key={i} className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                      {doc}
                    </li>
                  ))}
                  {visaDetails.documentsRequired.length > 6 && (
                    <li className="text-sm text-slate-400 italic">
                      +{visaDetails.documentsRequired.length - 6} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              {visaDetails.affiliateLink && (
                <Button
                  asChild
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700"
                >
                  <a href={visaDetails.affiliateLink} target="_blank" rel="noopener noreferrer">
                    Apply with iVisa
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              )}

              {visaDetails.applicationUrl && (
                <Button variant="outline" asChild>
                  <a href={visaDetails.applicationUrl} target="_blank" rel="noopener noreferrer">
                    Official Site
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              )}
            </div>

            {/* Passport Reminder + Source Freshness */}
            <div className="pt-2 border-t space-y-1">
              <p className="text-xs text-slate-400">
                For {passport} passport holders traveling to {destination}
              </p>
              {visaDetails.cost.accuracy === 'curated' ? (
                <div className="text-xs text-slate-400 space-y-0.5">
                  <p className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      Visa rules verified: {visaDetails.lastVerified
                        ? new Date(visaDetails.lastVerified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Recently'}
                    </span>
                  </p>
                  {visaDetails.sources && visaDetails.sources.length > 0 && (
                    <p className="flex items-center gap-1">
                      <span>Source: </span>
                      {visaDetails.sources[0].url ? (
                        <a
                          href={visaDetails.sources[0].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-500 hover:underline"
                        >
                          {visaDetails.sources[0].title}
                        </a>
                      ) : (
                        <span>{visaDetails.sources[0].title}</span>
                      )}
                    </p>
                  )}
                  {/* VFS fee variation note for embassy visas */}
                  {(visaDetails.type === 'embassy_visa' || visaDetails.applicationMethod === 'vfs') && (
                    <p className="text-slate-500 mt-1">
                      <Info className="w-3 h-3 inline mr-1" />
                      VFS/service center fees may vary by location.
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                  <p className="flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    <span>Costs vary by embassy and service center. Verify on official site before applying.</span>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
