/**
 * Price Alert Component
 * Allows users to set up price tracking for flights and hotels
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Bell,
  BellOff,
  Plane,
  Hotel,
  TrendingDown,
  Loader2,
  CheckCircle,
  AlertCircle,
  DollarSign,
} from 'lucide-react';

interface PriceAlertProps {
  tripId: number;
  destination: string;
  origin?: string;
  dates: string;
  currentFlightPrice?: number;
  currentHotelPrice?: number;
  currency?: string;
}

interface AlertFormData {
  type: 'flight' | 'hotel';
  targetPrice: number;
  email: string;
}

export function PriceAlertButton({
  tripId,
  destination,
  origin,
  dates,
  currentFlightPrice,
  currentHotelPrice,
  currency = 'USD',
}: PriceAlertProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alertType, setAlertType] = useState<'flight' | 'hotel'>('flight');
  const [targetPrice, setTargetPrice] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();
  const { user, isAuthenticated, setShowAuthModal } = useAuth();

  const currencySymbol = getCurrencySymbol(currency);
  const currentPrice = alertType === 'flight' ? currentFlightPrice : currentHotelPrice;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset form on close
      setIsSuccess(false);
      setTargetPrice('');
      if (!isAuthenticated) {
        setEmail('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailToUse = isAuthenticated ? user?.email : email;

    if (!emailToUse) {
      toast({
        title: 'Email required',
        description: 'Please enter your email to receive alerts.',
        variant: 'destructive',
      });
      return;
    }

    if (!targetPrice || parseFloat(targetPrice) <= 0) {
      toast({
        title: 'Invalid target price',
        description: 'Please enter a valid target price.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tripId,
          type: alertType,
          destination,
          origin: origin || '',
          dates,
          currentPrice: currentPrice || 0,
          targetPrice: parseFloat(targetPrice),
          currency,
          email: emailToUse,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create alert');
      }

      setIsSuccess(true);
      toast({
        title: 'Price alert created!',
        description: `We'll notify you when ${alertType} prices drop below ${currencySymbol}${targetPrice}.`,
      });

      // Close after success
      setTimeout(() => handleOpenChange(false), 2000);
    } catch (err) {
      console.error('Price alert error:', err);
      toast({
        title: 'Error',
        description: 'Failed to create price alert. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        className="bg-white/10 border-white/20 text-white hover:bg-white/20"
      >
        <Bell className="w-4 h-4 mr-2" />
        Set Price Alert
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Price Alert
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Get notified when prices drop for your trip to {destination}
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Alert Created!</h3>
                <p className="text-slate-400">
                  We'll email you when prices drop below {currencySymbol}{targetPrice}
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6 mt-4"
              >
                {/* Alert Type Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAlertType('flight')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      alertType === 'flight'
                        ? 'border-primary bg-primary/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Plane className={`w-6 h-6 mx-auto mb-2 ${
                      alertType === 'flight' ? 'text-primary' : 'text-slate-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      alertType === 'flight' ? 'text-white' : 'text-slate-400'
                    }`}>
                      Flights
                    </span>
                    {currentFlightPrice && (
                      <p className="text-xs text-slate-500 mt-1">
                        Current: {currencySymbol}{currentFlightPrice}
                      </p>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertType('hotel')}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      alertType === 'hotel'
                        ? 'border-primary bg-primary/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <Hotel className={`w-6 h-6 mx-auto mb-2 ${
                      alertType === 'hotel' ? 'text-primary' : 'text-slate-400'
                    }`} />
                    <span className={`text-sm font-medium ${
                      alertType === 'hotel' ? 'text-white' : 'text-slate-400'
                    }`}>
                      Hotels
                    </span>
                    {currentHotelPrice && (
                      <p className="text-xs text-slate-500 mt-1">
                        Current: {currencySymbol}{currentHotelPrice}/night
                      </p>
                    )}
                  </button>
                </div>

                {/* Target Price */}
                <div className="space-y-2">
                  <Label className="text-slate-300">Alert me when price drops below</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type="number"
                      placeholder={currentPrice ? `${Math.round(currentPrice * 0.9)}` : '500'}
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      min="0"
                      step="10"
                    />
                  </div>
                  {currentPrice && (
                    <p className="text-xs text-slate-500">
                      Current price: {currencySymbol}{currentPrice} • Suggested target: {currencySymbol}{Math.round(currentPrice * 0.9)}
                    </p>
                  )}
                </div>

                {/* Email (only if not authenticated) */}
                {!isAuthenticated && (
                  <div className="space-y-2">
                    <Label className="text-slate-300">Email for notifications</Label>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      required
                    />
                    <p className="text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setShowAuthModal(true);
                        }}
                        className="text-primary hover:underline"
                      >
                        Sign in
                      </button>
                      {' '}for faster alerts and trip management
                    </p>
                  </div>
                )}

                {/* Info Box */}
                <div className="flex items-start gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <TrendingDown className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-slate-400">
                    <p className="font-medium text-slate-300 mb-1">How it works</p>
                    <p>We check prices daily and notify you instantly when they drop below your target.</p>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Create Price Alert
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Price Alert Card for displaying existing alerts
 */
export function PriceAlertCard({ alert, onDelete }: {
  alert: {
    id: number;
    type: 'flight' | 'hotel';
    destination: string;
    targetPrice: number;
    currentPrice: number;
    currency: string;
    isActive: boolean;
  };
  onDelete: (id: number) => void;
}) {
  const currencySymbol = getCurrencySymbol(alert.currency);
  const priceDiff = alert.currentPrice - alert.targetPrice;
  const isNearTarget = priceDiff <= alert.targetPrice * 0.1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-xl border ${
        alert.isActive
          ? isNearTarget
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-slate-800 border-slate-700'
          : 'bg-slate-900 border-slate-800 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            alert.type === 'flight' ? 'bg-sky-500/20' : 'bg-amber-500/20'
          }`}>
            {alert.type === 'flight' ? (
              <Plane className="w-5 h-5 text-sky-400" />
            ) : (
              <Hotel className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <h4 className="font-medium text-white">{alert.destination}</h4>
            <p className="text-sm text-slate-400 capitalize">{alert.type}s</p>
          </div>
        </div>

        <button
          onClick={() => onDelete(alert.id)}
          className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <BellOff className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500">Target Price</p>
          <p className="text-lg font-semibold text-green-400">
            {currencySymbol}{alert.targetPrice}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Current Price</p>
          <p className={`text-lg font-semibold ${
            alert.currentPrice <= alert.targetPrice ? 'text-green-400' : 'text-white'
          }`}>
            {currencySymbol}{alert.currentPrice}
          </p>
        </div>
      </div>

      {isNearTarget && alert.isActive && (
        <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Price is close to your target!</span>
        </div>
      )}
    </motion.div>
  );
}

// Currency helper
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', THB: '฿'
  };
  return symbols[currency] || currency;
}
