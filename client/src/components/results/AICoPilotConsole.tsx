/**
 * AICoPilotConsole.tsx
 *
 * Premium AI Co-Pilot interface with natural language input,
 * smart suggestion chips, and processing state with step-by-step reasoning.
 *
 * States:
 * - Input: Natural language textarea + suggestion chips
 * - Processing: Animated reasoning steps
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  Loader2,
  DollarSign,
  Gauge,
  Utensils,
  Zap,
  Clock,
  TrendingUp,
  Brain,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface SuggestionChip {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

interface ProcessingStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'active' | 'complete';
}

interface AICoPilotConsoleProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// SUGGESTION CHIPS
// ============================================================================

const SUGGESTION_CHIPS: SuggestionChip[] = [
  {
    id: 'reduce-cost',
    label: 'Reduce cost',
    icon: <DollarSign className="w-3.5 h-3.5" />,
    prompt: 'Find cheaper alternatives for accommodations and activities',
  },
  {
    id: 'simplify',
    label: 'Simplify',
    icon: <Gauge className="w-3.5 h-3.5" />,
    prompt: 'Reduce activities for a more relaxed pace',
  },
  {
    id: 'local-food',
    label: 'More local food',
    icon: <Utensils className="w-3.5 h-3.5" />,
    prompt: 'Add authentic local food experiences',
  },
  {
    id: 'faster',
    label: 'Faster pace',
    icon: <Zap className="w-3.5 h-3.5" />,
    prompt: 'Pack more activities into fewer days',
  },
  {
    id: 'relaxed',
    label: 'Relaxed pace',
    icon: <Clock className="w-3.5 h-3.5" />,
    prompt: 'Spread activities for a relaxed trip',
  },
  {
    id: 'certainty',
    label: 'Improve certainty',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    prompt: 'Suggest changes to improve trip certainty',
  },
];

// ============================================================================
// PROCESSING STEPS
// ============================================================================

const PROCESSING_STEPS: Omit<ProcessingStep, 'status'>[] = [
  { id: 'analyzing', label: 'Analyzing itinerary...', icon: <Brain className="w-4 h-4" /> },
  { id: 'searching', label: 'Finding alternatives...', icon: <Search className="w-4 h-4" /> },
  { id: 'updating', label: 'Updating plan...', icon: <Sparkles className="w-4 h-4" /> },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function AICoPilotConsole({
  onSubmit,
  disabled = false,
  className,
}: AICoPilotConsoleProps) {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle submit
  const handleSubmit = async (prompt: string) => {
    if (!prompt.trim() || disabled || isProcessing) return;

    setInput('');
    setIsProcessing(true);

    // Initialize processing steps
    const steps: ProcessingStep[] = PROCESSING_STEPS.map((step, idx) => ({
      ...step,
      status: idx === 0 ? 'active' : 'pending',
    }));
    setProcessingSteps(steps);

    // Animate through steps
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      setProcessingSteps(prev =>
        prev.map((step, idx) => ({
          ...step,
          status: idx < i ? 'complete' : idx === i ? 'active' : 'pending',
        }))
      );
    }

    // Mark all complete
    await new Promise(resolve => setTimeout(resolve, 500));
    setProcessingSteps(prev =>
      prev.map(step => ({ ...step, status: 'complete' as const }))
    );

    // Trigger actual submit
    onSubmit(prompt);

    // Reset after short delay
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsProcessing(false);
  };

  // Handle chip click
  const handleChipClick = (prompt: string) => {
    if (disabled || isProcessing) return;
    handleSubmit(prompt);
  };

  // Handle textarea submit
  const handleTextareaSubmit = () => {
    if (input.trim()) {
      handleSubmit(input);
    }
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <AnimatePresence mode="wait">
        {/* Input State */}
        {!isProcessing && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI Co-Pilot</h3>
                <p className="text-[11px] text-white/50">Ask Voyage to adjust your trip</p>
              </div>
            </div>

            {/* Natural Language Input */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTextareaSubmit();
                  }
                }}
                placeholder="e.g., Make day 3 more relaxing..."
                disabled={disabled}
                className={cn(
                  'w-full min-h-[80px] px-4 py-3 rounded-xl resize-none',
                  'bg-white/[0.03] border border-white/[0.08]',
                  'text-sm text-white placeholder:text-white/30',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/30',
                  'transition-all',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              />
              {/* Send button */}
              <button
                onClick={handleTextareaSubmit}
                disabled={disabled || !input.trim()}
                className={cn(
                  'absolute bottom-3 right-3 p-2 rounded-lg',
                  'bg-emerald-500/20 hover:bg-emerald-500/30',
                  'border border-emerald-500/30',
                  'transition-all',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4 text-emerald-400" />
              </button>
            </div>

            {/* Suggestion Chips - Horizontal Scroll */}
            <div>
              <p className="text-[11px] text-white/40 mb-2">Quick suggestions</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {SUGGESTION_CHIPS.map((chip, index) => (
                  <motion.button
                    key={chip.id}
                    onClick={() => handleChipClick(chip.prompt)}
                    disabled={disabled}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    whileHover={disabled ? {} : { scale: 1.05 }}
                    whileTap={disabled ? {} : { scale: 0.95 }}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap',
                      'text-xs font-medium transition-all shrink-0',
                      disabled
                        ? 'bg-white/[0.03] text-white/25 cursor-not-allowed'
                        : cn(
                            'bg-white/[0.05] border border-white/[0.08]',
                            'text-white/70',
                            'hover:bg-emerald-500/15 hover:text-emerald-300',
                            'hover:border-emerald-500/30',
                            'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                          )
                    )}
                  >
                    <span className={disabled ? 'text-white/20' : 'text-white/50'}>
                      {chip.icon}
                    </span>
                    {chip.label}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="py-6"
          >
            {/* Processing Card */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 rounded-xl p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Processing Request</h3>
                  <p className="text-xs text-white/50">AI is analyzing your trip...</p>
                </div>
              </div>

              {/* Processing Steps */}
              <div className="space-y-3">
                {processingSteps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.15 }}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-all',
                      step.status === 'active' && 'bg-white/[0.08] ring-1 ring-emerald-500/30',
                      step.status === 'complete' && 'bg-white/[0.04]',
                      step.status === 'pending' && 'bg-white/[0.02] opacity-50'
                    )}
                  >
                    {/* Step icon */}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                        step.status === 'active' &&
                          'bg-emerald-500/20 text-emerald-400',
                        step.status === 'complete' &&
                          'bg-green-500/20 text-green-400',
                        step.status === 'pending' &&
                          'bg-white/[0.05] text-white/30'
                      )}
                    >
                      {step.status === 'complete' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : step.status === 'active' ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                          {step.icon}
                        </motion.div>
                      ) : (
                        step.icon
                      )}
                    </div>

                    {/* Step label */}
                    <span
                      className={cn(
                        'text-sm font-medium transition-all',
                        step.status === 'active' && 'text-white',
                        step.status === 'complete' && 'text-white/70',
                        step.status === 'pending' && 'text-white/40'
                      )}
                    >
                      {step.label}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
