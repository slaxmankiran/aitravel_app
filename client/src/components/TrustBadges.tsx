import { motion } from "framer-motion";
import {
  CheckCircle,
  Clock,
  Shield,
  Star,
  ExternalLink,
  AlertTriangle,
  Info,
  Verified,
  TrendingUp,
  Users,
  Calendar
} from "lucide-react";

// Verified Source Badge - Shows where the information comes from
interface VerifiedBadgeProps {
  source: string;
  lastUpdated?: string;
  confidence?: 'high' | 'medium' | 'low';
  className?: string;
}

export function VerifiedBadge({ source, lastUpdated, confidence = 'high', className = '' }: VerifiedBadgeProps) {
  const confidenceColors = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const confidenceIcons = {
    high: <CheckCircle className="w-3.5 h-3.5" />,
    medium: <Info className="w-3.5 h-3.5" />,
    low: <AlertTriangle className="w-3.5 h-3.5" />,
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${confidenceColors[confidence]}`}>
        {confidenceIcons[confidence]}
        <span>Verified</span>
      </span>
      {source && (
        <span className="text-xs text-slate-500">
          via {source}
        </span>
      )}
      {lastUpdated && (
        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          {lastUpdated}
        </span>
      )}
    </div>
  );
}

// Last Updated Indicator
interface FreshnessIndicatorProps {
  date: string;
  className?: string;
}

export function FreshnessIndicator({ date, className = '' }: FreshnessIndicatorProps) {
  const now = new Date();
  const updated = new Date(date);
  const daysDiff = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));

  let status: 'fresh' | 'recent' | 'stale' = 'fresh';
  let label = 'Updated today';

  if (daysDiff === 0) {
    status = 'fresh';
    label = 'Updated today';
  } else if (daysDiff <= 7) {
    status = 'fresh';
    label = `Updated ${daysDiff} day${daysDiff > 1 ? 's' : ''} ago`;
  } else if (daysDiff <= 30) {
    status = 'recent';
    label = `Updated ${Math.floor(daysDiff / 7)} week${daysDiff >= 14 ? 's' : ''} ago`;
  } else {
    status = 'stale';
    label = `Updated ${Math.floor(daysDiff / 30)} month${daysDiff >= 60 ? 's' : ''} ago`;
  }

  const colors = {
    fresh: 'text-green-600 bg-green-50',
    recent: 'text-amber-600 bg-amber-50',
    stale: 'text-slate-500 bg-slate-50',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colors[status]} ${className}`}>
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

// Trust Score Display - VoyageAI's unique trust scoring
interface TrustScoreProps {
  score: number; // 0-100
  factors: {
    dataFreshness: number;
    sourcesVerified: number;
    userReviews: number;
    localValidation: number;
  };
  className?: string;
}

export function TrustScore({ score, factors, className = '' }: TrustScoreProps) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return 'Excellent';
    if (s >= 80) return 'Very Good';
    if (s >= 70) return 'Good';
    if (s >= 60) return 'Fair';
    return 'Needs Review';
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-slate-900">Trust Score</span>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}</span>
          <span className="text-slate-400">/100</span>
          <p className={`text-xs ${getScoreColor(score)}`}>{getScoreLabel(score)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <TrustFactor label="Data Freshness" value={factors.dataFreshness} icon={<Clock className="w-3.5 h-3.5" />} />
        <TrustFactor label="Sources Verified" value={factors.sourcesVerified} icon={<Verified className="w-3.5 h-3.5" />} />
        <TrustFactor label="User Reviews" value={factors.userReviews} icon={<Star className="w-3.5 h-3.5" />} />
        <TrustFactor label="Local Validation" value={factors.localValidation} icon={<Users className="w-3.5 h-3.5" />} />
      </div>

      <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">
        Our Trust Score helps you make informed decisions with verified, up-to-date information.
      </p>
    </div>
  );
}

function TrustFactor({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs text-slate-600 flex-1">{label}</span>
      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{value}%</span>
    </div>
  );
}

// Traveler Stats Badge
interface TravelerStatsBadgeProps {
  tripsTaken: number;
  satisfaction: number;
  className?: string;
}

export function TravelerStatsBadge({ tripsTaken, satisfaction, className = '' }: TravelerStatsBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl ${className}`}>
      <div className="flex items-center gap-1">
        <Users className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{tripsTaken.toLocaleString()}</span>
        <span className="text-xs text-slate-500">trips</span>
      </div>
      <div className="w-px h-4 bg-slate-200" />
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
        <span className="text-sm font-medium text-slate-700">{satisfaction}%</span>
        <span className="text-xs text-slate-500">satisfied</span>
      </div>
    </div>
  );
}

// Price Alert Badge
interface PriceAlertProps {
  type: 'deal' | 'price_drop' | 'selling_fast';
  message: string;
  className?: string;
}

export function PriceAlert({ type, message, className = '' }: PriceAlertProps) {
  const configs = {
    deal: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      icon: <TrendingUp className="w-4 h-4" />,
    },
    price_drop: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      icon: <TrendingUp className="w-4 h-4 rotate-180" />,
    },
    selling_fast: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
  };

  const config = configs[type];

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.text} ${className}`}
    >
      {config.icon}
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
}

// Source Citation Component
interface SourceCitationProps {
  sources: Array<{
    name: string;
    url?: string;
    type: 'official' | 'review' | 'blog' | 'local';
  }>;
  className?: string;
}

export function SourceCitation({ sources, className = '' }: SourceCitationProps) {
  const typeIcons = {
    official: <Shield className="w-3 h-3" />,
    review: <Star className="w-3 h-3" />,
    blog: <ExternalLink className="w-3 h-3" />,
    local: <Users className="w-3 h-3" />,
  };

  return (
    <div className={`text-xs text-slate-500 ${className}`}>
      <span className="font-medium">Sources: </span>
      {sources.map((source, i) => (
        <span key={i}>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-700 hover:underline"
            >
              {typeIcons[source.type]}
              {source.name}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1">
              {typeIcons[source.type]}
              {source.name}
            </span>
          )}
          {i < sources.length - 1 && ', '}
        </span>
      ))}
    </div>
  );
}
