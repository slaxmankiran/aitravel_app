/**
 * PanelAccordion.tsx
 *
 * Collapsible panel component for side column items.
 * Used for: True Cost, Action Items, Chat
 */

import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface PanelAccordionProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  collapsedSummary?: ReactNode; // NEW: shown when closed
  defaultOpen?: boolean;
  /** When set to true, forces the panel open. Use to programmatically open. */
  forceOpen?: boolean;
  children: ReactNode;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

export function PanelAccordion({
  title,
  icon,
  badge,
  collapsedSummary,
  defaultOpen = false,
  forceOpen,
  children,
  className = "",
  onToggle,
}: PanelAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Handle forceOpen prop changes
  useEffect(() => {
    if (forceOpen === true && !isOpen) {
      setIsOpen(true);
      onToggle?.(true);
    }
  }, [forceOpen]);

  const handleToggle = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <div
      className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] ${className}`}
      data-state={isOpen ? "open" : "closed"}
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.04] transition-colors"
      >
        <div className="min-w-0 flex items-center gap-2.5">
          {icon && <span className="text-white/60 shrink-0">{icon}</span>}
          <span className="font-medium text-white text-sm truncate">{title}</span>
          {badge && <span className="ml-1 shrink-0">{badge}</span>}
        </div>

        <div className="flex items-center gap-2">
          {!isOpen && collapsedSummary ? (
            <span className="text-xs text-white/50 hidden sm:inline-block max-w-[180px] truncate">
              {collapsedSummary}
            </span>
          ) : null}

          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.18 }}
          >
            <ChevronDown className="w-4 h-4 text-white/40" />
          </motion.div>
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div className="px-4 pb-4 border-t border-white/10">
              <div className="pt-3">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Simple panel without accordion (always open)
 */
interface SimplePanelProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SimplePanel({ title, icon, children, className = "" }: SimplePanelProps) {
  return (
    <div
      className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-[0_10px_30px_-18px_rgba(0,0,0,0.8)] ${className}`}
    >
      {title && (
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
          {icon && <span className="text-white/60">{icon}</span>}
          <span className="font-medium text-white text-sm">{title}</span>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
