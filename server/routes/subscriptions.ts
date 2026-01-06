/**
 * Subscriptions Routes
 * Premium subscription management with Stripe integration
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validateSession, getSessionIdFromHeaders } from '../services/auth';

const router = Router();

// Subscription plans
const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'USD',
    interval: 'month',
    features: [
      '3 trips per month',
      'Basic AI itinerary',
      'Email support',
      'Standard templates',
    ],
    limits: {
      tripsPerMonth: 3,
      aiQueriesPerDay: 10,
      collaborators: 1,
      priceAlerts: 2,
      packingLists: 3,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    currency: 'USD',
    interval: 'month',
    stripeProductId: 'prod_pro_monthly',
    stripePriceId: 'price_pro_monthly',
    features: [
      'Unlimited trips',
      'Advanced AI with chat refinement',
      'Priority support',
      'All premium templates',
      'Unlimited collaborators',
      '10 price alerts',
      'Weather integration',
      'Packing lists',
    ],
    limits: {
      tripsPerMonth: -1, // unlimited
      aiQueriesPerDay: 100,
      collaborators: -1,
      priceAlerts: 10,
      packingLists: -1,
    },
    popular: true,
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 29.99,
    currency: 'USD',
    interval: 'month',
    stripeProductId: 'prod_business_monthly',
    stripePriceId: 'price_business_monthly',
    features: [
      'Everything in Pro',
      'Team workspaces',
      'Travel policy compliance',
      'Expense tracking',
      'API access',
      'Dedicated account manager',
      'Custom templates',
      'Priority feature requests',
    ],
    limits: {
      tripsPerMonth: -1,
      aiQueriesPerDay: -1,
      collaborators: -1,
      priceAlerts: -1,
      packingLists: -1,
    },
  },
};

// In-memory subscription storage (use database in production)
interface UserSubscription {
  id: number;
  userId: number;
  planId: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptions = new Map<number, UserSubscription>();
let subscriptionIdCounter = 1;

// Usage tracking
interface UsageRecord {
  userId: number;
  feature: string;
  count: number;
  resetAt: Date;
}

const usageRecords = new Map<string, UsageRecord>();

/**
 * GET /api/subscriptions/plans
 * Get available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = Object.values(SUBSCRIPTION_PLANS).map(plan => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features,
      popular: (plan as any).popular || false,
    }));

    res.json({ plans });
  } catch (err) {
    console.error('[Subscriptions] Get plans error:', err);
    res.status(500).json({ error: 'Failed to get plans' });
  }
});

/**
 * GET /api/subscriptions/current
 * Get current user's subscription
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      // Return free plan for unauthenticated users
      return res.json({
        subscription: null,
        plan: SUBSCRIPTION_PLANS.free,
        limits: SUBSCRIPTION_PLANS.free.limits,
      });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.json({
        subscription: null,
        plan: SUBSCRIPTION_PLANS.free,
        limits: SUBSCRIPTION_PLANS.free.limits,
      });
    }

    // Find user's subscription
    const subscription = Array.from(subscriptions.values())
      .find(s => s.userId === session.user.id && s.status === 'active');

    if (!subscription) {
      return res.json({
        subscription: null,
        plan: SUBSCRIPTION_PLANS.free,
        limits: SUBSCRIPTION_PLANS.free.limits,
      });
    }

    const plan = SUBSCRIPTION_PLANS[subscription.planId as keyof typeof SUBSCRIPTION_PLANS];

    res.json({
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      plan,
      limits: plan.limits,
    });
  } catch (err) {
    console.error('[Subscriptions] Get current error:', err);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

/**
 * POST /api/subscriptions/checkout
 * Create a checkout session for subscription
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { planId, successUrl, cancelUrl } = req.body;

    if (!planId || !SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS]) {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];

    if (plan.price === 0) {
      return res.status(400).json({ error: 'Cannot checkout free plan' });
    }

    // In production, create Stripe checkout session
    // For now, simulate checkout
    const checkoutId = `checkout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[Subscriptions] Checkout initiated for user ${session.user.id}, plan ${planId}`);

    // Simulate successful checkout for demo
    // In production, redirect to Stripe checkout URL
    const checkoutUrl = `/checkout/success?session_id=${checkoutId}&plan=${planId}`;

    res.json({
      checkoutId,
      checkoutUrl,
      // In production: url: stripeSession.url
    });
  } catch (err) {
    console.error('[Subscriptions] Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

/**
 * POST /api/subscriptions/activate
 * Activate subscription after successful payment (webhook or manual)
 */
router.post('/activate', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { planId, checkoutId } = req.body;

    // Verify checkout session (in production, verify with Stripe)
    if (!planId) {
      return res.status(400).json({ error: 'Invalid checkout' });
    }

    // Check for existing subscription
    const existing = Array.from(subscriptions.values())
      .find(s => s.userId === session.user.id);

    if (existing) {
      // Update existing
      existing.planId = planId;
      existing.status = 'active';
      existing.currentPeriodStart = new Date();
      existing.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      existing.cancelAtPeriodEnd = false;
      existing.updatedAt = new Date();

      return res.json({
        success: true,
        subscription: existing,
      });
    }

    // Create new subscription
    const subscription: UserSubscription = {
      id: subscriptionIdCounter++,
      userId: session.user.id,
      planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    subscriptions.set(subscription.id, subscription);

    console.log(`[Subscriptions] Activated ${planId} for user ${session.user.id}`);

    res.json({
      success: true,
      subscription,
    });
  } catch (err) {
    console.error('[Subscriptions] Activate error:', err);
    res.status(500).json({ error: 'Failed to activate subscription' });
  }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel subscription
 */
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const subscription = Array.from(subscriptions.values())
      .find(s => s.userId === session.user.id && s.status === 'active');

    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel at period end (don't immediately revoke access)
    subscription.cancelAtPeriodEnd = true;
    subscription.updatedAt = new Date();

    console.log(`[Subscriptions] Cancelled subscription for user ${session.user.id}`);

    res.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period',
      endsAt: subscription.currentPeriodEnd,
    });
  } catch (err) {
    console.error('[Subscriptions] Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * POST /api/subscriptions/reactivate
 * Reactivate a cancelled subscription
 */
router.post('/reactivate', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const subscription = Array.from(subscriptions.values())
      .find(s => s.userId === session.user.id && s.cancelAtPeriodEnd);

    if (!subscription) {
      return res.status(404).json({ error: 'No cancelled subscription found' });
    }

    subscription.cancelAtPeriodEnd = false;
    subscription.updatedAt = new Date();

    console.log(`[Subscriptions] Reactivated subscription for user ${session.user.id}`);

    res.json({
      success: true,
      message: 'Subscription reactivated',
    });
  } catch (err) {
    console.error('[Subscriptions] Reactivate error:', err);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

/**
 * GET /api/subscriptions/usage
 * Get current usage for a feature
 */
router.get('/usage', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    const feature = req.query.feature as string;

    if (!feature) {
      return res.status(400).json({ error: 'Feature is required' });
    }

    let userId = 0;
    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session) {
        userId = session.user.id;
      }
    }

    // Get user's plan limits
    const subscription = userId ? Array.from(subscriptions.values())
      .find(s => s.userId === userId && s.status === 'active') : null;

    const planId = subscription?.planId || 'free';
    const plan = SUBSCRIPTION_PLANS[planId as keyof typeof SUBSCRIPTION_PLANS];
    const limit = (plan.limits as any)[feature] || 0;

    // Get usage record
    const usageKey = `${userId}-${feature}`;
    let usage = usageRecords.get(usageKey);

    // Reset usage if period expired
    if (usage && usage.resetAt < new Date()) {
      usage.count = 0;
      usage.resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Reset daily
    }

    const currentUsage = usage?.count || 0;
    const isUnlimited = limit === -1;
    const remaining = isUnlimited ? -1 : Math.max(0, limit - currentUsage);

    res.json({
      feature,
      used: currentUsage,
      limit: isUnlimited ? 'unlimited' : limit,
      remaining: isUnlimited ? 'unlimited' : remaining,
      canUse: isUnlimited || remaining > 0,
    });
  } catch (err) {
    console.error('[Subscriptions] Usage error:', err);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

/**
 * POST /api/subscriptions/usage/increment
 * Increment usage for a feature
 */
router.post('/usage/increment', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    const { feature } = req.body;

    if (!feature) {
      return res.status(400).json({ error: 'Feature is required' });
    }

    let userId = 0;
    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session) {
        userId = session.user.id;
      }
    }

    const usageKey = `${userId}-${feature}`;
    let usage = usageRecords.get(usageKey);

    if (!usage) {
      usage = {
        userId,
        feature,
        count: 0,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      usageRecords.set(usageKey, usage);
    }

    // Reset if expired
    if (usage.resetAt < new Date()) {
      usage.count = 0;
      usage.resetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    usage.count++;

    res.json({
      success: true,
      used: usage.count,
    });
  } catch (err) {
    console.error('[Subscriptions] Increment usage error:', err);
    res.status(500).json({ error: 'Failed to increment usage' });
  }
});

/**
 * POST /api/subscriptions/portal
 * Create customer portal session for managing subscription
 */
router.post('/portal', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // In production, create Stripe customer portal session
    const portalUrl = '/account/billing';

    res.json({
      portalUrl,
    });
  } catch (err) {
    console.error('[Subscriptions] Portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/**
 * POST /api/subscriptions/webhook
 * Handle Stripe webhooks
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // In production, verify Stripe signature
    const event = req.body;

    console.log(`[Subscriptions] Webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        // Handle successful checkout
        break;
      case 'customer.subscription.updated':
        // Handle subscription update
        break;
      case 'customer.subscription.deleted':
        // Handle subscription deletion
        break;
      case 'invoice.payment_failed':
        // Handle failed payment
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Subscriptions] Webhook error:', err);
    res.status(500).json({ error: 'Webhook failed' });
  }
});

export default router;
