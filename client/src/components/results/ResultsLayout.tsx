/**
 * ResultsLayout.tsx
 *
 * Two-column responsive layout for Trip Results V1.
 * - Left column (2/3): Itinerary
 * - Right column (1/3): Map + Panels (sticky)
 */

import { ReactNode } from "react";

interface ResultsLayoutProps {
  itineraryColumn: ReactNode;
  sideColumn: ReactNode;
  className?: string;
}

export function ResultsLayout({ itineraryColumn, sideColumn, className = '' }: ResultsLayoutProps) {
  return (
    <div className={`max-w-7xl mx-auto px-4 md:px-6 py-6 ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Left Column - Itinerary (scrollable) */}
        <div className="lg:col-span-2 min-w-0">
          {itineraryColumn}
        </div>

        {/* Right Column - Map + Panels (sticky on desktop) */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-[120px] space-y-4">
            {sideColumn}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ItineraryColumn wrapper
 */
interface ItineraryColumnProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function ItineraryColumn({ children, title, subtitle }: ItineraryColumnProps) {
  return (
    <div className="space-y-4">
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
          {subtitle && <p className="text-sm text-white/60 mt-1">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * SideColumn wrapper with sticky behavior
 */
interface SideColumnProps {
  children: ReactNode;
}

export function SideColumn({ children }: SideColumnProps) {
  return (
    <div className="space-y-4">
      {children}
    </div>
  );
}

/**
 * StickyMapContainer - wrapper for the map
 */
interface StickyMapContainerProps {
  children: ReactNode;
  className?: string;
}

export function StickyMapContainer({ children, className = '' }: StickyMapContainerProps) {
  return (
    <div className={`rounded-xl overflow-hidden border border-white/10 ${className}`}>
      {children}
    </div>
  );
}
