/**
 * Pricing Plans Component
 * Display subscription plans and handle upgrades
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Check,
  X,
  Crown,
  Sparkles,
  Building2,
  Zap,
  Loader2,
  CreditCard,
  Shield,
  ArrowRight,
  Star,
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  popular?: boolean;
}

interface Subscription {
  id: number;
  planId: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

const PLAN_ICONS = {
  free: Sparkles,
  pro: Crown,
  business: Building2,
};

const PLAN_COLORS = {
  free: 'slate',
  pro: 'primary',
  business: 'violet',
};

export function PricingPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const { user, isAuthenticated, setShowAuthModal } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    if (isAuthenticated) {
      fetchCurrentSubscription();
    }
  }, [isAuthenticated]);

  async function fetchPlans() {
    try {
      const res = await fetch('/api/subscriptions/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchCurrentSubscription() {
    try {
      const res = await fetch('/api/subscriptions/current');
      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data.plan?.id || 'free');
        setSubscription(data.subscription);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    }
  }

  async function handleSelectPlan(planId: string) {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (planId === 'free' || planId === currentPlan) {
      return;
    }

    setProcessingPlan(planId);

    try {
      // Create checkout session
      const res = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          successUrl: `${window.location.origin}/account?success=true`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start checkout');
      }

      const data = await res.json();

      // For demo, simulate successful subscription
      await activateSubscription(planId, data.checkoutId);

      toast({
        title: 'Subscription Activated!',
        description: `You now have access to ${planId.charAt(0).toUpperCase() + planId.slice(1)} features.`,
      });

      setCurrentPlan(planId);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to process subscription',
        variant: 'destructive',
      });
    } finally {
      setProcessingPlan(null);
    }
  }

  async function activateSubscription(planId: string, checkoutId: string) {
    const res = await fetch('/api/subscriptions/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, checkoutId }),
    });

    if (!res.ok) {
      throw new Error('Failed to activate subscription');
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.')) {
      return;
    }

    try {
      const res = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to cancel');

      toast({
        title: 'Subscription Cancelled',
        description: 'Your subscription will end at the current billing period.',
      });

      fetchCurrentSubscription();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to cancel subscription',
        variant: 'destructive',
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
            Choose Your Plan
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Start free and upgrade anytime. All plans include our core trip planning features.
          </p>
        </motion.div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan, idx) => {
          const Icon = PLAN_ICONS[plan.id as keyof typeof PLAN_ICONS] || Sparkles;
          const isCurrentPlan = plan.id === currentPlan;
          const isPro = plan.popular;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative rounded-2xl border overflow-hidden ${
                isPro
                  ? 'bg-gradient-to-b from-primary/20 to-slate-800 border-primary'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              {/* Popular Badge */}
              {isPro && (
                <div className="absolute top-0 left-0 right-0 bg-primary py-1.5 text-center">
                  <span className="text-xs font-bold text-white flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 fill-white" />
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className={`p-6 ${isPro ? 'pt-12' : ''}`}>
                {/* Plan Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${
                    isPro ? 'bg-primary/20' : 'bg-slate-700'
                  }`}>
                    <Icon className={`w-5 h-5 ${
                      isPro ? 'text-primary' : 'text-slate-400'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    {isCurrentPlan && (
                      <span className="text-xs text-primary">Current Plan</span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">
                    ${plan.price}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-slate-400">/{plan.interval}</span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, fidx) => (
                    <li key={fidx} className="flex items-start gap-2">
                      <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                        isPro ? 'text-primary' : 'text-emerald-500'
                      }`} />
                      <span className="text-sm text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrentPlan || processingPlan === plan.id}
                  className={`w-full ${
                    isPro
                      ? 'bg-primary hover:bg-primary/90'
                      : isCurrentPlan
                        ? 'bg-slate-700 text-slate-400 cursor-default'
                        : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {processingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isCurrentPlan ? (
                    'Current Plan'
                  ) : plan.price === 0 ? (
                    'Get Started Free'
                  ) : (
                    <>
                      Upgrade to {plan.name}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Subscription Management */}
      {subscription && subscription.planId !== 'free' && (
        <div className="mt-12 max-w-md mx-auto">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h4 className="font-semibold text-white mb-4">Manage Subscription</h4>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className={`font-medium ${
                  subscription.cancelAtPeriodEnd ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {subscription.cancelAtPeriodEnd ? 'Cancelling' : 'Active'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Next billing</span>
                <span className="text-white">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            </div>

            {subscription.cancelAtPeriodEnd ? (
              <Button
                onClick={async () => {
                  const res = await fetch('/api/subscriptions/reactivate', {
                    method: 'POST',
                  });
                  if (res.ok) {
                    toast({ title: 'Subscription reactivated!' });
                    fetchCurrentSubscription();
                  }
                }}
                className="w-full mt-4"
              >
                Reactivate Subscription
              </Button>
            ) : (
              <button
                onClick={handleCancelSubscription}
                className="w-full mt-4 text-sm text-slate-400 hover:text-red-400 transition-colors"
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Trust Badges */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <span>Secure Payment</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          <span>Cancel Anytime</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          <span>Instant Access</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Upgrade Prompt Component
 * Shows when user hits a limit
 */
export function UpgradePrompt({
  feature,
  onClose,
}: {
  feature: string;
  onClose: () => void;
}) {
  const { setShowAuthModal, isAuthenticated } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown className="w-8 h-8 text-primary" />
          </div>

          <h3 className="text-xl font-semibold text-white mb-2">
            Upgrade to Pro
          </h3>

          <p className="text-slate-400 mb-6">
            You've reached the limit for {feature}. Upgrade to Pro for unlimited access and more features.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => {
                if (!isAuthenticated) {
                  setShowAuthModal(true);
                } else {
                  window.location.href = '/pricing';
                }
                onClose();
              }}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>

            <button
              onClick={onClose}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * Plan Badge Component
 */
export function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, string> = {
    free: 'bg-slate-600 text-slate-300',
    pro: 'bg-primary text-white',
    business: 'bg-violet-500 text-white',
  };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[plan] || colors.free}`}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  );
}
