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
import { ArrowLeft, Share2, Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TripResponse } from "@shared/schema";

interface HeaderBarProps {
  trip: TripResponse;
  onShare?: () => void;
  onExport?: () => void;
  isDemo?: boolean;
}

function HeaderBarComponent({ trip, onShare, onExport, isDemo = false }: HeaderBarProps) {
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

          {/* Center: Simple breadcrumb - destination meta is in hero below */}
          <div className="flex-1 flex justify-center px-4 min-w-0">
            <nav className="flex items-center text-sm text-white/40 max-w-[280px] whitespace-nowrap">
              <Link href="/trips" className="shrink-0 hover:text-white/70 transition-colors">Trips</Link>
              <span className="mx-2 text-white/20 shrink-0">/</span>
              <span className="text-white/70 truncate">{trip.destination?.split(',')[0]}</span>
            </nav>
          </div>

          {/* Right: Actions - Edit is prominent (hidden for demo), others are subdued */}
          <div className="flex items-center gap-1">
            {/* Edit Trip - Important escape hatch, kept prominent (hidden for demo) */}
            {!isDemo && (
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
            )}

            {/* Divider - only show if edit button is visible */}
            {!isDemo && <div className="hidden sm:block w-px h-4 bg-white/10 mx-1" />}

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
