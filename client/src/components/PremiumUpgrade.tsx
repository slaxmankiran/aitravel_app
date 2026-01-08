import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Crown,
  Check,
  X,
  Zap,
  Shield,
  Clock,
  Users,
  Download,
  Bell,
  Map,
  Sparkles,
  Star,
  ArrowRight,
  Gift
} from "lucide-react";

// Premium Feature Lock - Shows when user tries to access premium feature
interface PremiumLockProps {
  feature: string;
  description: string;
  onUpgrade: () => void;
}

export function PremiumLock({ feature, description, onUpgrade }: PremiumLockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 text-center"
    >
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
        <Crown className="w-7 h-7 text-white" />
      </div>
      <h3 className="font-display font-bold text-lg text-slate-900 mb-2">
        {feature}
      </h3>
      <p className="text-slate-600 mb-6">
        {description}
      </p>
      <Button
        onClick={onUpgrade}
        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        Upgrade to Premium
      </Button>
      <p className="text-xs text-slate-500 mt-3">
        Starting at $9.99/month
      </p>
    </motion.div>
  );
}

// Pricing Plans
const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for casual travelers',
    features: [
      { text: '3 AI trip plans per month', included: true },
      { text: 'Basic itinerary generation', included: true },
      { text: 'Feasibility scores', included: true },
      { text: 'Price comparisons', included: true },
      { text: 'Offline access', included: false },
      { text: 'Priority AI responses', included: false },
      { text: 'Collaborative planning', included: false },
      { text: 'PDF exports', included: false },
      { text: 'Real-time price alerts', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 9.99,
    period: 'month',
    description: 'For serious travelers',
    features: [
      { text: 'Unlimited AI trip plans', included: true },
      { text: 'Advanced itinerary customization', included: true },
      { text: 'Feasibility scores', included: true },
      { text: 'Real-time price comparisons', included: true },
      { text: 'Offline access', included: true },
      { text: 'Priority AI responses', included: true },
      { text: 'Collaborative planning (up to 5)', included: true },
      { text: 'PDF & calendar exports', included: true },
      { text: 'Real-time price alerts', included: false },
    ],
    cta: 'Start Free Trial',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19.99,
    period: 'month',
    description: 'For travel enthusiasts & groups',
    features: [
      { text: 'Everything in Premium', included: true },
      { text: 'Unlimited collaborators', included: true },
      { text: 'Real-time price alerts', included: true },
      { text: 'API access', included: true },
      { text: 'White-label exports', included: true },
      { text: 'Priority support', included: true },
      { text: 'Custom AI training', included: true },
      { text: 'Travel agent dashboard', included: true },
      { text: 'Bulk trip planning', included: true },
    ],
    cta: 'Start Free Trial',
    popular: false,
  },
];

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (planId: string) => void;
}

export function PricingModal({ isOpen, onClose, onSelectPlan }: PricingModalProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  const getPrice = (plan: typeof PLANS[0]) => {
    if (plan.price === 0) return 'Free';
    const price = billingPeriod === 'annual' ? plan.price * 0.8 : plan.price;
    return `$${price.toFixed(2)}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-8"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-8 text-center">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
              <Crown className="w-12 h-12 mx-auto mb-4 text-white" />
              <h2 className="text-3xl font-display font-bold text-white mb-2">
                Upgrade to Premium
              </h2>
              <p className="text-white/80">
                Unlock the full power of AI travel planning
              </p>

              {/* Billing Toggle */}
              <div className="mt-6 inline-flex items-center gap-3 bg-white/20 rounded-full p-1">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    billingPeriod === 'monthly'
                      ? 'bg-white text-slate-900'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingPeriod('annual')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                    billingPeriod === 'annual'
                      ? 'bg-white text-slate-900'
                      : 'text-white hover:bg-white/10'
                  }`}
                >
                  Annual
                  <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs rounded">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plans */}
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PLANS.map((plan) => (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl p-6 ${
                      plan.popular
                        ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 shadow-lg'
                        : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <h3 className="font-display font-bold text-xl text-slate-900 mb-1">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-slate-900">
                          {getPrice(plan)}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-slate-500">/{plan.period}</span>
                        )}
                      </div>
                      {billingPeriod === 'annual' && plan.price > 0 && (
                        <p className="text-sm text-green-600 mt-1">
                          ${(plan.price * 12 * 0.8).toFixed(0)}/year
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2 text-sm ${
                            feature.included ? 'text-slate-700' : 'text-slate-400'
                          }`}
                        >
                          {feature.included ? (
                            <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-slate-300 mt-0.5 flex-shrink-0" />
                          )}
                          {feature.text}
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => onSelectPlan(plan.id)}
                      disabled={plan.id === 'free'}
                      className={`w-full rounded-xl ${
                        plan.popular
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                          : plan.id === 'free'
                          ? 'bg-slate-200 text-slate-500 cursor-default'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {plan.cta}
                      {plan.id !== 'free' && <ArrowRight className="w-4 h-4 ml-2" />}
                    </Button>
                  </div>
                ))}
              </div>

              {/* Trust Badges */}
              <div className="mt-8 pt-8 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-500" />
                    Secure payments
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Cancel anytime
                  </span>
                  <span className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-rose-500" />
                    14-day free trial
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Premium Banner - Shows in-app to encourage upgrades
interface PremiumBannerProps {
  variant?: 'compact' | 'full';
  onUpgrade: () => void;
}

export function PremiumBanner({ variant = 'compact', onUpgrade }: PremiumBannerProps) {
  if (variant === 'compact') {
    return (
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Upgrade to Premium</p>
            <p className="text-sm text-slate-500">Unlock unlimited trip planning</p>
          </div>
        </div>
        <Button
          onClick={onUpgrade}
          size="sm"
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg"
        >
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-center overflow-hidden relative">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />

      <div className="relative z-10">
        <Crown className="w-16 h-16 mx-auto mb-4 text-amber-400" />
        <h2 className="text-2xl font-display font-bold text-white mb-2">
          Unlock Premium Features
        </h2>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Get unlimited AI trip plans, real-time price alerts, collaborative planning, and more.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          <span className="flex items-center gap-2 text-slate-300 text-sm">
            <Zap className="w-4 h-4 text-amber-400" />
            Unlimited plans
          </span>
          <span className="flex items-center gap-2 text-slate-300 text-sm">
            <Users className="w-4 h-4 text-amber-400" />
            Collaboration
          </span>
          <span className="flex items-center gap-2 text-slate-300 text-sm">
            <Bell className="w-4 h-4 text-amber-400" />
            Price alerts
          </span>
          <span className="flex items-center gap-2 text-slate-300 text-sm">
            <Download className="w-4 h-4 text-amber-400" />
            PDF exports
          </span>
        </div>

        <Button
          onClick={onUpgrade}
          size="lg"
          className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl px-8"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Start 14-Day Free Trial
        </Button>

        <p className="text-xs text-slate-500 mt-4">
          No credit card required. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
