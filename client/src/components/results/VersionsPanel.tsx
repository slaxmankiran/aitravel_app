/**
 * VersionsPanel.tsx
 *
 * Panel showing trip version history (Item 18).
 * Displays: timestamp, change chips, certainty score, total cost, source.
 * Actions: Restore, Export PDF, Copy share link.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  RotateCcw,
  FileDown,
  Link2,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
  Sparkles,
  Wrench,
  Save,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelAccordion } from "./PanelAccordion";
import { useTripVersions, type TripVersionResponse, type VersionSource } from "@/hooks/useTripVersions";
import { trackTripEvent } from "@/lib/analytics";

interface VersionsPanelProps {
  tripId: number;
  onRestore?: (version: TripVersionResponse) => void;
  onExport?: (versionId: number) => void;
  /** When true, renders without PanelAccordion wrapper (for drawer use) */
  compact?: boolean;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Source icon and label
function getSourceInfo(source: VersionSource): { icon: React.ReactNode; label: string } {
  switch (source) {
    case "change_plan":
      return { icon: <Sparkles className="w-3 h-3" />, label: "AI Change" };
    case "next_fix":
      return { icon: <Wrench className="w-3 h-3" />, label: "Quick Fix" };
    case "manual_save":
      return { icon: <Save className="w-3 h-3" />, label: "Saved" };
    case "restore":
      return { icon: <RotateCcw className="w-3 h-3" />, label: "Restored" };
    case "system":
    default:
      return { icon: <RefreshCcw className="w-3 h-3" />, label: "Auto" };
  }
}

// Single version row
interface VersionRowProps {
  version: TripVersionResponse;
  isLatest: boolean;
  onRestore: () => void;
  onExport: () => void;
  onCopyLink: () => void;
  isRestoring: boolean;
}

function VersionRow({
  version,
  isLatest,
  onRestore,
  onExport,
  onCopyLink,
  isRestoring,
}: VersionRowProps) {
  const [showActions, setShowActions] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const sourceInfo = getSourceInfo(version.source);

  const handleCopyLink = () => {
    onCopyLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Certainty delta display
  const certaintyScore = version.summary?.certaintyAfter;
  const totalCost = version.summary?.totalAfter;

  return (
    <motion.div
      className="group relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={`
          flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer
          ${isLatest ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-white/5"}
        `}
      >
        {/* Timeline dot */}
        <div className="flex flex-col items-center pt-1">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isLatest ? "bg-emerald-500" : "bg-white/30"
            }`}
          />
          {!isLatest && (
            <div className="w-px h-full bg-white/10 mt-1" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: time + source */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-white/60">
              {formatRelativeTime(version.createdAt)}
            </span>
            <div className="flex items-center gap-1 text-white/40">
              {sourceInfo.icon}
              <span className="text-[10px] uppercase tracking-wide">
                {sourceInfo.label}
              </span>
            </div>
            {isLatest && (
              <span className="text-[10px] uppercase tracking-wide text-emerald-400 font-medium">
                Current
              </span>
            )}
          </div>

          {/* Label or chips */}
          {version.label ? (
            <p className="text-sm text-white/90 font-medium mb-1.5 truncate">
              {version.label}
            </p>
          ) : null}

          {/* Change chips */}
          {version.summary?.chips && version.summary.chips.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {version.summary.chips.slice(0, 3).map((chip, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70"
                >
                  {chip}
                </span>
              ))}
              {version.summary.chips.length > 3 && (
                <span className="text-[10px] text-white/40">
                  +{version.summary.chips.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Stats: certainty + cost */}
          <div className="flex items-center gap-3 text-xs">
            {certaintyScore != null && (
              <span className="text-white/50">
                <span className="text-white/70 font-medium">{certaintyScore}%</span> certainty
              </span>
            )}
            {totalCost != null && (
              <span className="text-white/50">
                <span className="text-white/70 font-medium">
                  ${totalCost.toLocaleString()}
                </span> total
              </span>
            )}
          </div>
        </div>

        {/* Actions (show on hover) */}
        <AnimatePresence>
          {showActions && !isLatest && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                disabled={isRestoring}
                className="h-7 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                title="Restore this version"
              >
                {isRestoring ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport();
                }}
                className="h-7 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                title="Export as PDF"
              >
                <FileDown className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink();
                }}
                className="h-7 px-2 text-xs text-white/70 hover:text-white hover:bg-white/10"
                title="Copy share link"
              >
                {linkCopied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Link2 className="w-3 h-3" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chevron (mobile) */}
        {!isLatest && (
          <ChevronRight className="w-4 h-4 text-white/20 sm:hidden" />
        )}
      </div>
    </motion.div>
  );
}

// Main panel component
function VersionsPanelComponent({ tripId, onRestore, onExport, compact = false }: VersionsPanelProps) {
  const {
    versions,
    isLoading,
    error,
    restoreVersion,
    isRestoring,
    refetch,
  } = useTripVersions(tripId);

  const handleRestore = async (version: TripVersionResponse) => {
    try {
      const result = await restoreVersion(version.id);
      trackTripEvent(tripId, "version_restored", {
        versionId: version.id,
        source: version.source,
      });
      onRestore?.(version);
    } catch (err) {
      console.error("Failed to restore version:", err);
    }
  };

  const handleExport = (versionId: number) => {
    trackTripEvent(tripId, "version_exported", { versionId });
    if (onExport) {
      onExport(versionId);
    } else {
      // Default: open export page in new tab with version parameter
      window.open(`/trips/${tripId}/export?version=${versionId}`, "_blank");
    }
  };

  const handleCopyLink = (versionId: number) => {
    const url = `${window.location.origin}/trips/${tripId}/results-v1?version=${versionId}`;
    navigator.clipboard.writeText(url);
    trackTripEvent(tripId, "version_link_copied", { versionId });
  };

  // Count for badge
  const versionCount = versions.length;

  // Content to render
  const content = (
    <div className={compact ? "space-y-1" : "space-y-1 -mx-1"}>
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400/60 mb-2" />
          <p className="text-sm text-white/60 mb-3">Failed to load versions</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-xs text-white/70 hover:text-white"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && versions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <History className="w-10 h-10 text-white/20 mb-3" />
          <p className="text-sm text-white/60 mb-1">No versions saved yet</p>
          <p className="text-xs text-white/40">
            Versions are created when you make changes via AI chat
          </p>
        </div>
      )}

      {/* Versions list */}
      {!isLoading && !error && versions.length > 0 && (
        <div className={compact ? "space-y-0.5" : "max-h-[350px] overflow-y-auto pr-1 -mr-1 space-y-0.5"}>
          {versions.map((version, index) => (
            <VersionRow
              key={version.id}
              version={version}
              isLatest={index === 0}
              onRestore={() => handleRestore(version)}
              onExport={() => handleExport(version.id)}
              onCopyLink={() => handleCopyLink(version.id)}
              isRestoring={isRestoring}
            />
          ))}
        </div>
      )}
    </div>
  );

  // In compact mode, return content directly (for drawer use)
  if (compact) {
    return content;
  }

  // Normal mode: wrap in PanelAccordion
  return (
    <PanelAccordion
      title="Version History"
      icon={<History className="w-4 h-4" />}
      badge={
        versionCount > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-white/10 text-[10px] font-medium text-white/60">
            {versionCount}
          </span>
        ) : null
      }
      defaultOpen={false}
      collapsedSummary={
        versionCount > 0
          ? `${versionCount} saved version${versionCount !== 1 ? "s" : ""}`
          : "No versions yet"
      }
    >
      {content}
    </PanelAccordion>
  );
}

export const VersionsPanel = React.memo(VersionsPanelComponent);
