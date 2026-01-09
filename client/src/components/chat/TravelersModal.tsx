/**
 * TravelersModal.tsx
 *
 * Clean modal for selecting number of travelers.
 * Counter UI for adults, children, and infants.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Plus, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TravelersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (travelers: TravelersData) => void;
  initialData?: TravelersData;
}

export interface TravelersData {
  adults: number;
  children: number;
  infants: number;
}

export function TravelersModal({
  isOpen,
  onClose,
  onConfirm,
  initialData,
}: TravelersModalProps) {
  const [adults, setAdults] = useState(initialData?.adults || 1);
  const [children, setChildren] = useState(initialData?.children || 0);
  const [infants, setInfants] = useState(initialData?.infants || 0);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && initialData) {
      setAdults(initialData.adults);
      setChildren(initialData.children);
      setInfants(initialData.infants);
    }
  }, [isOpen, initialData]);

  const handleConfirm = () => {
    onConfirm({ adults, children, infants });
    onClose();
  };

  const total = adults + children + infants;

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
          className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900">Travelers</h2>
              <p className="text-sm text-slate-500">
                {total} {total === 1 ? 'traveler' : 'travelers'}
              </p>
            </div>
            <div className="w-7" /> {/* Spacer */}
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Adults */}
            <CounterRow
              label="Adults"
              description="Ages 13 or above"
              value={adults}
              min={1}
              max={10}
              onChange={setAdults}
              icon={<User className="w-5 h-5 text-slate-400" />}
            />

            {/* Children */}
            <CounterRow
              label="Children"
              description="Ages 2-12"
              value={children}
              min={0}
              max={8}
              onChange={setChildren}
              icon={<User className="w-4 h-4 text-slate-400" />}
            />

            {/* Infants */}
            <CounterRow
              label="Infants"
              description="Under 2"
              value={infants}
              min={0}
              max={4}
              onChange={setInfants}
              icon={<User className="w-3 h-3 text-slate-400" />}
            />
          </div>

          {/* Quick presets */}
          <div className="px-6 pb-4">
            <p className="text-xs text-slate-500 mb-2">Quick select</p>
            <div className="flex gap-2">
              <PresetButton
                label="Solo"
                onClick={() => { setAdults(1); setChildren(0); setInfants(0); }}
                active={adults === 1 && children === 0 && infants === 0}
              />
              <PresetButton
                label="Couple"
                onClick={() => { setAdults(2); setChildren(0); setInfants(0); }}
                active={adults === 2 && children === 0 && infants === 0}
              />
              <PresetButton
                label="Family"
                onClick={() => { setAdults(2); setChildren(2); setInfants(0); }}
                active={adults === 2 && children === 2 && infants === 0}
              />
              <PresetButton
                label="Group"
                onClick={() => { setAdults(4); setChildren(0); setInfants(0); }}
                active={adults === 4 && children === 0 && infants === 0}
              />
            </div>
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

interface CounterRowProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  icon: React.ReactNode;
}

function CounterRow({ label, description, value, min, max, onChange, icon }: CounterRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-slate-900">{label}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
            value <= min
              ? 'border-slate-200 text-slate-300 cursor-not-allowed'
              : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-8 text-center text-lg font-semibold text-slate-900">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
            value >= max
              ? 'border-slate-200 text-slate-300 cursor-not-allowed'
              : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface PresetButtonProps {
  label: string;
  onClick: () => void;
  active: boolean;
}

function PresetButton({ label, onClick, active }: PresetButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
