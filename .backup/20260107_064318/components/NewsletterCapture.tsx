/**
 * Newsletter Capture Component
 * Email subscription form with various display modes
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Mail,
  Loader2,
  CheckCircle,
  Sparkles,
  Bell,
  Plane,
  ArrowRight,
} from 'lucide-react';

interface NewsletterCaptureProps {
  variant?: 'inline' | 'card' | 'banner' | 'modal';
  source?: string;
  onSuccess?: () => void;
  className?: string;
}

export function NewsletterCapture({
  variant = 'inline',
  source = 'website',
  onSuccess,
  className = '',
}: NewsletterCaptureProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/email/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source,
          preferences: {
            newsletter: true,
            priceAlerts: true,
            tripReminders: true,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to subscribe');
      }

      setIsSuccess(true);
      toast({
        title: 'Subscribed!',
        description: "You'll receive travel deals and tips in your inbox.",
      });

      onSuccess?.();
    } catch (err) {
      console.error('Newsletter subscribe error:', err);
      toast({
        title: 'Subscription failed',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === 'inline') {
    return (
      <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSuccess}
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={isSubmitting || isSuccess}>
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isSuccess ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            'Subscribe'
          )}
        </Button>
      </form>
    );
  }

  if (variant === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-gradient-to-br from-primary/10 via-slate-900 to-emerald-500/10 rounded-2xl p-6 border border-white/10 ${className}`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Get Travel Alerts</h3>
            <p className="text-sm text-slate-400">Price drops, deals & tips</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-4"
            >
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-white font-medium">You're subscribed!</p>
              <p className="text-sm text-slate-400">Check your inbox soon</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-3"
            >
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
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
                    Subscribe
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500 text-center">
                No spam, unsubscribe anytime
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-primary/90 to-emerald-600/90 ${className}`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-white">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Get exclusive travel deals and tips!</span>
            </div>

            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-white"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Subscribed!</span>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="flex gap-2 w-full sm:w-auto"
                >
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/20 border-white/30 text-white placeholder:text-white/70 w-full sm:w-64"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={isSubmitting}
                    className="whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Subscribe'
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  // Modal variant (for popups)
  return (
    <div className={`bg-white rounded-2xl p-8 max-w-md mx-auto shadow-2xl ${className}`}>
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Plane className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Never Miss a Deal
        </h2>
        <p className="text-slate-600">
          Get personalized travel deals, price alerts, and insider tips.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-6"
          >
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              You're on the list!
            </h3>
            <p className="text-slate-600">
              Check your inbox for a welcome email.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-12 h-12 text-lg"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="w-full bg-primary hover:bg-primary/90 h-12"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Get Travel Deals
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
            <p className="text-xs text-slate-500 text-center">
              By subscribing, you agree to our Terms & Privacy Policy.
              Unsubscribe anytime.
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Floating newsletter popup trigger
 */
export function NewsletterFloatingTrigger() {
  const [isOpen, setIsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('newsletter_dismissed') === 'true';
  });

  // Show popup after 30 seconds if not dismissed
  // useEffect(() => {
  //   if (dismissed) return;
  //   const timer = setTimeout(() => setIsOpen(true), 30000);
  //   return () => clearTimeout(timer);
  // }, [dismissed]);

  const handleDismiss = () => {
    setIsOpen(false);
    setDismissed(true);
    sessionStorage.setItem('newsletter_dismissed', 'true');
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
          >
            <button
              onClick={handleDismiss}
              className="absolute -top-2 -right-2 w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-300"
            >
              ×
            </button>
            <NewsletterCapture
              variant="modal"
              source="popup"
              onSuccess={handleDismiss}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
