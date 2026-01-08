/**
 * HeaderBar.tsx
 *
 * Top navigation bar for Trip Results V1.
 * Shows: Logo, destination, meta pills, actions (Edit, Share, Export)
 */

import { Link } from "wouter";
import { ArrowLeft, Share2, Download, Pencil, Users, Wallet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TripResponse } from "@shared/schema";

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

interface HeaderBarProps {
  trip: TripResponse;
  onShare?: () => void;
  onExport?: () => void;
}

export function HeaderBar({ trip, onShare, onExport }: HeaderBarProps) {
  const currencySymbol = getCurrencySymbol(trip.currency ?? undefined);

  // Build travel style label
  const travelStyleLabel = trip.travelStyle === 'budget' ? 'Budget' :
                           trip.travelStyle === 'standard' ? 'Comfort' :
                           trip.travelStyle === 'luxury' ? 'Luxury' :
                           trip.travelStyle === 'custom' ? `${currencySymbol}${trip.budget?.toLocaleString()}` :
                           'Standard';

  // Build edit trip URL with all params preserved
  const editUrl = `/create?edit=${trip.id}&passport=${encodeURIComponent(trip.passport || '')}&origin=${encodeURIComponent(trip.origin || '')}&destination=${encodeURIComponent(trip.destination || '')}&dates=${encodeURIComponent(trip.dates || '')}&budget=${trip.budget || ''}&currency=${trip.currency || 'USD'}&adults=${trip.adults || 1}&children=${trip.children || 0}&infants=${trip.infants || 0}`;

  const handleShare = () => {
    if (onShare) {
      onShare();
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      window.print();
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Back */}
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10 -ml-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Home</span>
              </Button>
            </Link>

            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer group">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white font-bold text-sm">
                  V
                </div>
                <span className="font-semibold text-white/90 hidden md:block">VoyageAI</span>
              </div>
            </Link>
          </div>

          {/* Center: Destination + Meta */}
          <div className="flex-1 text-center px-4 min-w-0">
            <h1 className="text-lg md:text-xl font-semibold text-white truncate">
              {trip.destination}
            </h1>
            {/* Meta pills - hidden on small screens */}
            <div className="hidden sm:flex items-center justify-center gap-2 mt-1 text-xs text-white/60">
              <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full">
                <Calendar className="w-3 h-3" />
                {trip.dates}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full">
                <Users className="w-3 h-3" />
                {trip.groupSize} {trip.groupSize === 1 ? 'traveler' : 'travelers'}
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-full">
                <Wallet className="w-3 h-3" />
                {travelStyleLabel}
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 md:gap-2">
            {/* Edit Trip - Important escape hatch */}
            <Link href={editUrl}>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Edit</span>
              </Button>
            </Link>

            {/* Share */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden md:inline ml-1">Share</span>
            </Button>

            {/* Export PDF */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline ml-1">PDF</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
