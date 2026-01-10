/**
 * HeaderBar.tsx
 *
 * Top navigation bar for Trip Results V1.
 * Shows: Logo, destination, meta pills, actions (Edit, Share, Export)
 *
 * Performance: Memoized to prevent page-wide cascades.
 */

import React from "react";
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

function HeaderBarComponent({ trip, onShare, onExport }: HeaderBarProps) {
  const currencySymbol = getCurrencySymbol(trip.currency ?? undefined);

  // Build travel style label
  const travelStyleLabel = trip.travelStyle === 'budget' ? 'Budget' :
                           trip.travelStyle === 'standard' ? 'Comfort' :
                           trip.travelStyle === 'luxury' ? 'Luxury' :
                           trip.travelStyle === 'custom' ? `${currencySymbol}${trip.budget?.toLocaleString()}` :
                           'Standard';

  // Build edit trip URL - use editTripId for proper edit mode, include returnTo for flow continuity
  const returnTo = encodeURIComponent(`/trips/${trip.id}/results-v1`);
  const editUrl = `/create?editTripId=${trip.id}&returnTo=${returnTo}`;

  const handleShare = async () => {
    if (onShare) {
      onShare();
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
      } catch (err) {
        // Clipboard API can fail in insecure contexts or without permission
        console.warn('Failed to copy to clipboard:', err);
      }
    }
  };

  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      // Open print-friendly export page in new tab
      window.open(`/trips/${trip.id}/export`, '_blank');
    }
  };

  return (
    <header data-section="header-bar" className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-white/10">
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

          {/* Right: Actions - Edit is prominent, others are subdued */}
          <div className="flex items-center gap-1">
            {/* Edit Trip - Important escape hatch, kept prominent */}
            <Link href={editUrl}>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/10"
                title="Opens the form for accurate edits"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Edit trip details</span>
              </Button>
            </Link>

            {/* Divider */}
            <div className="hidden sm:block w-px h-4 bg-white/10 mx-1" />

            {/* Secondary actions - more subdued */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-white/40 hover:text-white/70 hover:bg-white/5"
              title="Share trip"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline ml-1 text-xs">Share</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="text-white/40 hover:text-white/70 hover:bg-white/5"
              title="Export as PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden lg:inline ml-1 text-xs">PDF</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

// Memoize to prevent page-wide rerenders
export const HeaderBar = React.memo(HeaderBarComponent);
