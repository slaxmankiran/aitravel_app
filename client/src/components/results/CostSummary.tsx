/**
 * CostSummary.tsx
 *
 * Compact cost breakdown for the side panel.
 * Shows key cost categories with visual breakdown.
 */

import { useMemo } from "react";
import { Plane, Home, Utensils, Bus, Camera, Shield, FileText, MoreHorizontal } from "lucide-react";
import type { CostViewModel } from "@/hooks/useTripViewModel";

interface CostItemProps {
  label: string;
  amount: number;
  icon: React.ReactNode;
  color: string;
  percentage: number;
}

function CostItem({ label, amount, icon, color, percentage }: CostItemProps) {
  if (amount === 0) return null;

  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/80">{label}</span>
          <span className="text-sm text-white font-medium">${amount.toLocaleString()}</span>
        </div>
        <div className="mt-1 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${color.replace('/10', '/50')}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

interface CostSummaryProps {
  costs: CostViewModel;
  groupSize?: number;
}

export function CostSummary({ costs, groupSize = 1 }: CostSummaryProps) {
  const costItems = useMemo(() => {
    const total = costs.grandTotal || 1;
    return [
      {
        label: "Flights",
        amount: costs.flights,
        icon: <Plane className="w-3.5 h-3.5" />,
        color: "bg-blue-500/10 text-blue-400",
        percentage: (costs.flights / total) * 100,
      },
      {
        label: "Accommodation",
        amount: costs.accommodation,
        icon: <Home className="w-3.5 h-3.5" />,
        color: "bg-purple-500/10 text-purple-400",
        percentage: (costs.accommodation / total) * 100,
      },
      {
        label: "Food & Dining",
        amount: costs.food,
        icon: <Utensils className="w-3.5 h-3.5" />,
        color: "bg-orange-500/10 text-orange-400",
        percentage: (costs.food / total) * 100,
      },
      {
        label: "Activities",
        amount: costs.activities,
        icon: <Camera className="w-3.5 h-3.5" />,
        color: "bg-emerald-500/10 text-emerald-400",
        percentage: (costs.activities / total) * 100,
      },
      {
        label: "Local Transport",
        amount: costs.transport,
        icon: <Bus className="w-3.5 h-3.5" />,
        color: "bg-cyan-500/10 text-cyan-400",
        percentage: (costs.transport / total) * 100,
      },
      {
        label: "Visa & Entry",
        amount: costs.visa,
        icon: <FileText className="w-3.5 h-3.5" />,
        color: "bg-amber-500/10 text-amber-400",
        percentage: (costs.visa / total) * 100,
      },
      {
        label: "Insurance",
        amount: costs.insurance,
        icon: <Shield className="w-3.5 h-3.5" />,
        color: "bg-rose-500/10 text-rose-400",
        percentage: (costs.insurance / total) * 100,
      },
      {
        label: "Miscellaneous",
        amount: costs.miscellaneous,
        icon: <MoreHorizontal className="w-3.5 h-3.5" />,
        color: "bg-slate-500/10 text-slate-400",
        percentage: (costs.miscellaneous / total) * 100,
      },
    ].filter(item => item.amount > 0);
  }, [costs]);

  return (
    <div className="space-y-4">
      {/* Cost items */}
      <div className="space-y-3">
        {costItems.map((item) => (
          <CostItem key={item.label} {...item} />
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-white/10 pt-3">
        {/* Per person */}
        {groupSize > 1 && (
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-white/50">Per person ({groupSize} travelers)</span>
            <span className="text-white/70">${costs.perPerson.toLocaleString()}</span>
          </div>
        )}

        {/* Grand total */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Total Trip Cost</span>
          <span className="text-lg font-bold text-emerald-400">
            ${costs.grandTotal.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
