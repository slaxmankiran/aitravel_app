/**
 * RightDrawer.tsx
 *
 * Premium slide-over drawer for progressive disclosure.
 * Feels like peeling layers, not a modal popup.
 *
 * Design:
 * - Darker glass than cards
 * - Enhanced backdrop blur
 * - Soft gradient anchor at top
 * - Rounded inner edge
 */

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { glassDrawer, typography } from '@/lib/glassDesign';

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  md: 'max-w-[400px]',
  lg: 'max-w-[500px]',
  xl: 'max-w-[600px]',
};

export function RightDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  className,
  size = 'lg',
}: RightDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus drawer when open
  useEffect(() => {
    if (isOpen && drawerRef.current) {
      drawerRef.current.focus();
    }
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop - simple dim, NO blur (blur is distracting) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              opacity: { duration: 0.2 },
            }}
            className={cn(
              'fixed right-0 top-0 h-full w-full z-50',
              // Glass material
              glassDrawer.bg,
              glassDrawer.backdrop,
              glassDrawer.border,
              glassDrawer.shadow,
              // Shape - rounded inner edge
              'rounded-l-2xl',
              'flex flex-col',
              'focus:outline-none',
              sizeClasses[size],
              className
            )}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Gradient anchor at top */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none rounded-tl-2xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <div>
                <h2 id="drawer-title" className={cn('text-lg font-semibold', typography.primary)}>
                  {title}
                </h2>
                {subtitle && (
                  <p className={cn('text-sm mt-0.5', typography.tertiary)}>
                    {subtitle}
                  </p>
                )}
              </div>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'p-2.5 -mr-2 rounded-xl',
                  'bg-white/[0.04] hover:bg-white/[0.08]',
                  typography.tertiary,
                  'hover:text-white/70 transition-colors'
                )}
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="relative flex-1 overflow-y-auto">
              {/* Subtle inner shadow for depth */}
              <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * DrawerSection - Consistent section styling inside drawers
 */
interface DrawerSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function DrawerSection({ title, children, className }: DrawerSectionProps) {
  return (
    <div className={cn('px-6 py-5 border-b border-white/[0.04] last:border-0', className)}>
      {title && (
        <h3 className={cn('text-xs font-medium uppercase tracking-wider mb-4', typography.muted)}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
