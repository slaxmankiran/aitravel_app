/**
 * StyleModal.tsx
 *
 * Clean modal for selecting travel style.
 * Three options: Budget, Comfort, Luxury with visual cards.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tent, Sofa, Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (style: TravelStyle) => void;
  initialStyle?: TravelStyle;
}

export type TravelStyle = 'budget' | 'comfort' | 'luxury';

const STYLE_OPTIONS: Array<{
  value: TravelStyle;
  label: string;
  description: string;
  icon: React.ReactNode;
  examples: string[];
}> = [
  {
    value: 'budget',
    label: 'Budget',
    description: 'Maximize experiences, minimize costs',
    icon: <Tent className="w-6 h-6" />,
    examples: ['Hostels & guesthouses', 'Street food', 'Public transport'],
  },
  {
    value: 'comfort',
    label: 'Comfort',
    description: 'Balance of quality and value',
    icon: <Sofa className="w-6 h-6" />,
    examples: ['3-4 star hotels', 'Mix of restaurants', 'Private transfers'],
  },
  {
    value: 'luxury',
    label: 'Luxury',
    description: 'Premium experiences throughout',
    icon: <Crown className="w-6 h-6" />,
    examples: ['5-star resorts', 'Fine dining', 'Private guides'],
  },
];

export function StyleModal({
  isOpen,
  onClose,
  onConfirm,
  initialStyle,
}: StyleModalProps) {
  const [selected, setSelected] = useState<TravelStyle>(initialStyle || 'comfort');

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && initialStyle) {
      setSelected(initialStyle);
    }
  }, [isOpen, initialStyle]);

  const handleConfirm = () => {
    onConfirm(selected);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900">Travel Style</h2>
              <p className="text-sm text-slate-500">How do you like to travel?</p>
            </div>
            <div className="w-7" /> {/* Spacer */}
          </div>

          {/* Content */}
          <div className="p-6 space-y-3">
            {STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelected(option.value)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  selected === option.value
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    selected === option.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {option.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">{option.label}</h3>
                      {selected === option.value && (
                        <Check className="w-5 h-5 text-slate-900" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{option.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {option.examples.map((example) => (
                        <span
                          key={example}
                          className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              onClick={handleConfirm}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 rounded-xl text-base font-medium"
            >
              Update
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
