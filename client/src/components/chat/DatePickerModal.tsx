/**
 * DatePickerModal.tsx
 *
 * Mindtrip-style date picker with Dates/Flexible toggle.
 * - Dates mode: Dual-month calendar for range selection
 * - Flexible mode: Day counter + month selector
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: DateSelection) => void;
  initialData?: DateSelection;
}

export interface DateSelection {
  type: 'specific' | 'flexible';
  // Specific dates
  startDate?: Date;
  endDate?: Date;
  // Flexible dates
  numDays?: number;
  preferredMonth?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function DatePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialData,
}: DatePickerModalProps) {
  const [mode, setMode] = useState<'specific' | 'flexible'>(initialData?.type || 'flexible');
  const [numDays, setNumDays] = useState(initialData?.numDays || 5);
  const [selectedMonth, setSelectedMonth] = useState<string | undefined>(initialData?.preferredMonth);
  const [startDate, setStartDate] = useState<Date | undefined>(initialData?.startDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialData?.endDate);
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Reset when modal opens
  useEffect(() => {
    if (isOpen && initialData) {
      setMode(initialData.type);
      setNumDays(initialData.numDays || 5);
      setSelectedMonth(initialData.preferredMonth);
      setStartDate(initialData.startDate);
      setEndDate(initialData.endDate);
    }
  }, [isOpen, initialData]);

  const handleConfirm = () => {
    onConfirm({
      type: mode,
      startDate: mode === 'specific' ? startDate : undefined,
      endDate: mode === 'specific' ? endDate : undefined,
      numDays: mode === 'flexible' ? numDays : undefined,
      preferredMonth: mode === 'flexible' ? selectedMonth : undefined,
    });
    onClose();
  };

  const getMonthsToShow = () => {
    const now = new Date();
    const months: { month: string; year: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        month: MONTHS[date.getMonth()],
        year: date.getFullYear(),
      });
    }
    return months;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handleDateClick = (date: Date) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(undefined);
    } else {
      if (date < startDate) {
        setStartDate(date);
      } else {
        setEndDate(date);
      }
    }
  };

  const isDateInRange = (date: Date) => {
    if (!startDate || !endDate) return false;
    return date >= startDate && date <= endDate;
  };

  const isDateSelected = (date: Date) => {
    if (startDate && date.toDateString() === startDate.toDateString()) return true;
    if (endDate && date.toDateString() === endDate.toDateString()) return true;
    return false;
  };

  const renderCalendarMonth = (year: number, month: number) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: (number | null)[] = [];

    // Add empty cells for days before the first day
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
      <div className="flex-1">
        <div className="text-center font-medium text-slate-900 mb-3">
          {MONTHS[month]} {year}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="py-1">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="h-8" />;
            }

            const date = new Date(year, month, day);
            const isPast = date < today;
            const isSelected = isDateSelected(date);
            const inRange = isDateInRange(date);

            return (
              <button
                key={idx}
                disabled={isPast}
                onClick={() => handleDateClick(date)}
                className={`
                  h-8 w-8 rounded-full text-sm font-medium transition-all
                  ${isPast ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-slate-100'}
                  ${isSelected ? 'bg-slate-900 text-white' : ''}
                  ${inRange && !isSelected ? 'bg-slate-100' : ''}
                `}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
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
          className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-900">When</h2>
              <p className="text-sm text-slate-500">
                {mode === 'flexible'
                  ? `${numDays} days${selectedMonth ? ` in ${selectedMonth}` : ''}`
                  : startDate && endDate
                    ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                    : 'Select dates'
                }
              </p>
            </div>
            <div className="w-7" /> {/* Spacer for alignment */}
          </div>

          {/* Mode Toggle - framed as intent, not mechanism */}
          <div className="flex items-center justify-center gap-2 p-4">
            <button
              onClick={() => setMode('specific')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                mode === 'specific'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              I know my dates
            </button>
            <button
              onClick={() => setMode('flexible')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                mode === 'flexible'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              I'm flexible
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {mode === 'flexible' ? (
              // Flexible mode
              <div className="space-y-6">
                {/* Day counter */}
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700 mb-3">How many days?</p>
                  <div className="inline-flex items-center gap-4 bg-slate-50 rounded-xl px-4 py-2">
                    <button
                      onClick={() => setNumDays(Math.max(1, numDays - 1))}
                      className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                    >
                      <Minus className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="text-2xl font-semibold text-slate-900 w-12 text-center">
                      {numDays}
                    </span>
                    <button
                      onClick={() => setNumDays(Math.min(30, numDays + 1))}
                      className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors"
                    >
                      <Plus className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>

                {/* Month selector */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3 text-center">Preferred month (optional)</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
                    {getMonthsToShow().map(({ month, year }) => (
                      <button
                        key={`${month}-${year}`}
                        onClick={() => setSelectedMonth(selectedMonth === month ? undefined : month)}
                        className={`
                          flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all
                          ${selectedMonth === month
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                          }
                        `}
                      >
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">{month}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Specific dates mode - Calendar
              <div className="space-y-4">
                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      const newMonth = viewMonth.month - 1;
                      if (newMonth < 0) {
                        setViewMonth({ year: viewMonth.year - 1, month: 11 });
                      } else {
                        setViewMonth({ ...viewMonth, month: newMonth });
                      }
                    }}
                    className="p-2 hover:bg-slate-100 rounded-full"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <button
                    onClick={() => {
                      const newMonth = viewMonth.month + 1;
                      if (newMonth > 11) {
                        setViewMonth({ year: viewMonth.year + 1, month: 0 });
                      } else {
                        setViewMonth({ ...viewMonth, month: newMonth });
                      }
                    }}
                    className="p-2 hover:bg-slate-100 rounded-full"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>

                {/* Dual calendar */}
                <div className="flex gap-8">
                  {renderCalendarMonth(viewMonth.year, viewMonth.month)}
                  {renderCalendarMonth(
                    viewMonth.month === 11 ? viewMonth.year + 1 : viewMonth.year,
                    viewMonth.month === 11 ? 0 : viewMonth.month + 1
                  )}
                </div>
              </div>
            )}
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
