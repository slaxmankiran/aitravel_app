/**
 * StyleModal.tsx
 *
 * Clean modal for selecting travel style and currency.
 * Four options: Budget, Comfort, Luxury, Custom with visual cards.
 * Includes currency selector for cost estimates.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tent, Sofa, Crown, Settings2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CURRENCIES, type Currency } from "@/lib/currencies";

interface StyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: StyleData) => void;
  initialStyle?: TravelStyle;
  initialCurrency?: string;
  initialCustomBudget?: number;
}

export type TravelStyle = 'budget' | 'comfort' | 'luxury' | 'custom';

export interface StyleData {
  style: TravelStyle;
  currency: string;
  customBudget?: number;
}

const STYLE_OPTIONS: Array<{
  value: TravelStyle;
  label: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  examples: string[];
}> = [
  {
    value: 'budget',
    label: 'Budget',
    tagline: 'Smart & Savvy',
    description: 'Maximize experiences, minimize costs',
    icon: <Tent className="w-5 h-5" />,
    examples: ['Hostels & budget hotels', 'Street food & local eats', 'Public transport'],
  },
  {
    value: 'comfort',
    label: 'Comfort',
    tagline: 'Best of Both',
    description: 'Balance of quality and value',
    icon: <Sofa className="w-5 h-5" />,
    examples: ['3-4 star hotels', 'Local restaurants', 'Mix of transport'],
  },
  {
    value: 'luxury',
    label: 'Luxury',
    tagline: 'Premium Experience',
    description: 'Premium experiences throughout',
    icon: <Crown className="w-5 h-5" />,
    examples: ['5-star resorts', 'Fine dining', 'Private transfers'],
  },
  {
    value: 'custom',
    label: 'Custom',
    tagline: 'Set Your Own',
    description: 'Enter your exact budget',
    icon: <Settings2 className="w-5 h-5" />,
    examples: ['Enter your exact budget', 'Full control', 'Any travel style'],
  },
];

export function StyleModal({
  isOpen,
  onClose,
  onConfirm,
  initialStyle,
  initialCurrency,
  initialCustomBudget,
}: StyleModalProps) {
  const [selected, setSelected] = useState<TravelStyle>(initialStyle || 'comfort');
  const [currency, setCurrency] = useState(initialCurrency || 'USD');
  const [customBudget, setCustomBudget] = useState<number | undefined>(initialCustomBudget);
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false);

  const selectedCurrency = CURRENCIES.find(c => c.code === currency);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected(initialStyle || 'comfort');
      setCurrency(initialCurrency || 'USD');
      setCustomBudget(initialCustomBudget);
    }
  }, [isOpen, initialStyle, initialCurrency, initialCustomBudget]);

  const handleConfirm = () => {
    onConfirm({
      style: selected,
      currency,
      customBudget: selected === 'custom' ? customBudget : undefined,
    });
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
          className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900">Travel Style & Budget</h2>
              <p className="text-sm text-slate-500">How do you like to travel?</p>
            </div>
            <div className="w-7" /> {/* Spacer */}
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Currency Selector */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-700">Currency</span>
              <div className="relative">
                <button
                  onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <span className="text-base">{selectedCurrency?.flag}</span>
                  <span className="text-sm font-medium">{currency}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${currencyDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {currencyDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => {
                          setCurrency(c.code);
                          setCurrencyDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2 ${
                          currency === c.code ? 'bg-slate-50 font-medium' : ''
                        }`}
                      >
                        <span className="text-base">{c.flag}</span>
                        <span className="font-medium w-10">{c.code}</span>
                        <span className="text-slate-500 truncate flex-1">{c.name}</span>
                        {currency === c.code && <Check className="w-4 h-4 flex-shrink-0 text-slate-900" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Style Options - 2x2 Grid */}
            <div className="grid grid-cols-2 gap-3">
              {STYLE_OPTIONS.map((option) => {
                const isSelected = selected === option.value;

                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelected(option.value)}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-sm"
                      >
                        <Check className="w-3 h-3" />
                      </motion.div>
                    )}

                    <div className="flex items-start gap-2.5">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {option.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-semibold text-sm ${isSelected ? 'text-slate-900' : 'text-slate-800'}`}>
                            {option.label}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                            isSelected ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {option.tagline}
                          </span>
                        </div>
                        <ul className="mt-1.5 space-y-0.5">
                          {option.examples.slice(0, 3).map((example, idx) => (
                            <li key={idx} className="text-[11px] text-slate-500 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0"></span>
                              <span className="truncate">{example}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Custom Budget Input */}
            <AnimatePresence>
              {selected === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <label className="text-sm font-medium text-slate-700">
                      Enter Your Total Budget
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                        {selectedCurrency?.symbol || '$'}
                      </span>
                      <Input
                        type="number"
                        placeholder="Enter budget"
                        value={customBudget || ''}
                        onChange={(e) => setCustomBudget(e.target.value ? Number(e.target.value) : undefined)}
                        className="pl-8 h-12 text-lg font-semibold bg-white"
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      AI will create a realistic itinerary that fits your budget.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              onClick={handleConfirm}
              disabled={selected === 'custom' && !customBudget}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 rounded-xl text-base font-medium disabled:opacity-50"
            >
              Update
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
