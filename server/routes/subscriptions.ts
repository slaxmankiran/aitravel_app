/**
 * Subscriptions Routes
 * Premium subscription management with Stripe integration
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validateSession, getSessionIdFromHeaders } from '../services/auth';
import { db } from '../db';
import { users, subscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  isStripeConfigured,
  getOrCreateCustomer,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
  reactivateSubscription,
  getPriceIdForPlan,
  SUBSCRIPTION_PRODUCTS,
  type SubscriptionPlan,
} from '../services/stripeService';

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

// Usage tracking (in-memory for now, can be moved to Redis later)
interface UsageRecord {
  userId: number;
  feature: string;
  count: number;
  resetAt: Date;
}

const usageRecords = new Map<string, UsageRecord>();

// Helper to get user with subscription from database
async function getUserWithSubscription(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  return { user, subscription };
}

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
        stripeConfigured: isStripeConfigured(),
      });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.json({
        subscription: null,
        plan: SUBSCRIPTION_PLANS.free,
        limits: SUBSCRIPTION_PLANS.free.limits,
        stripeConfigured: isStripeConfigured(),
      });
    }

    // Get user with subscription from database
    const data = await getUserWithSubscription(session.user.id);
    if (!data) {
      return res.json({
        subscription: null,
        plan: SUBSCRIPTION_PLANS.free,
        limits: SUBSCRIPTION_PLANS.free.limits,
        stripeConfigured: isStripeConfigured(),
      });
    }

    const { user, subscription } = data;

    // Check if subscription is active
    const isActive = subscription?.status === 'active' &&
      subscription.currentPeriodEnd &&
      new Date(subscription.currentPeriodEnd) > new Date();

    if (!subscription || !isActive) {
      return res.json({
        subscription: null,
        plan: SUBSCRIPTION_PLANS.free,
        limits: SUBSCRIPTION_PLANS.free.limits,
        stripeConfigured: isStripeConfigured(),
      });
    }

    const planId = subscription.plan as keyof typeof SUBSCRIPTION_PLANS;
    const plan = SUBSCRIPTION_PLANS[planId] || SUBSCRIPTION_PLANS.free;

    res.json({
      subscription: {
        id: subscription.id,
        planId: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      plan,
      limits: plan.limits,
      stripeConfigured: isStripeConfigured(),
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

    // Get or create Stripe customer
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customerId = await getOrCreateCustomer(
      user.email,
      user.id,
      user.stripeCustomerId
    );

    if (!customerId) {
      return res.status(500).json({ error: 'Failed to create customer' });
    }

    // Update user with Stripe customer ID if new
    if (!user.stripeCustomerId) {
      await db
        .update(users)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    // Get price ID for the plan
    const priceId = getPriceIdForPlan(planId as SubscriptionPlan);
    if (!priceId) {
      return res.status(400).json({ error: 'No price configured for this plan' });
    }

    // Build success/cancel URLs
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const finalSuccessUrl = successUrl || `${baseUrl}/account/billing?success=1`;
    const finalCancelUrl = cancelUrl || `${baseUrl}/account/billing?cancelled=1`;

    // Create Stripe checkout session
    const checkoutSession = await createCheckoutSession({
      customerId,
      priceId,
      successUrl: finalSuccessUrl,
      cancelUrl: finalCancelUrl,
      userId: user.id,
      planId: planId as SubscriptionPlan,
    });

    if (!checkoutSession) {
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }

    console.log(`[Subscriptions] Checkout initiated for user ${session.user.id}, plan ${planId}`);

    res.json({
      checkoutId: checkoutSession.sessionId,
      checkoutUrl: checkoutSession.url,
      url: checkoutSession.url, // Alias for frontend compatibility
    });
  } catch (err) {
    console.error('[Subscriptions] Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout' });
  }
});

/**
 * POST /api/subscriptions/activate
 * Activate subscription after successful payment (webhook or manual)
 * Note: This is mainly used for legacy/fallback. Primary activation happens via webhook.
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

    const userId = session.user.id;
    const now = new Date();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Check for existing subscription
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    if (existing) {
      // Update existing
      await db
        .update(subscriptions)
        .set({
          plan: planId,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .where(eq(subscriptions.userId, userId));

      // Update user tier
      await db
        .update(users)
        .set({
          subscriptionTier: planId,
          subscriptionExpiresAt: periodEnd,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      const [updated] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId));

      return res.json({
        success: true,
        subscription: updated,
      });
    }

    // Create new subscription
    const [inserted] = await db
      .insert(subscriptions)
      .values({
        userId,
        plan: planId,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .returning();

    // Update user tier
    await db
      .update(users)
      .set({
        subscriptionTier: planId,
        subscriptionExpiresAt: periodEnd,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    console.log(`[Subscriptions] Activated ${planId} for user ${userId}`);

    res.json({
      success: true,
      subscription: inserted,
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

    // Get subscription from database
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id));

    if (!subscription || subscription.status !== 'active') {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    // Cancel in Stripe if we have a subscription ID
    if (subscription.stripeSubscriptionId) {
      const { immediately } = req.body;
      const success = await cancelSubscription(
        subscription.stripeSubscriptionId,
        immediately === true
      );

      if (!success) {
        return res.status(500).json({ error: 'Failed to cancel subscription in Stripe' });
      }
    }

    // Update local database (webhook will also do this, but update immediately for UX)
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, session.user.id));

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

    // Get subscription from database
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id));

    if (!subscription || !subscription.cancelAtPeriodEnd) {
      return res.status(404).json({ error: 'No cancelled subscription found' });
    }

    // Reactivate in Stripe if we have a subscription ID
    if (subscription.stripeSubscriptionId) {
      const success = await reactivateSubscription(subscription.stripeSubscriptionId);

      if (!success) {
        return res.status(500).json({ error: 'Failed to reactivate subscription in Stripe' });
      }
    }

    // Update local database
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, session.user.id));

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

    // Get user's plan from database
    let planId: string = 'free';
    if (userId) {
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId));

      if (subscription && subscription.status === 'active') {
        planId = subscription.plan;
      }
    }

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

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Need Stripe customer ID to create portal session
    if (!user.stripeCustomerId) {
      return res.status(400).json({
        error: 'No billing account found',
        portalUrl: '/account/billing', // Fallback
      });
    }

    // Build return URL
    const { returnUrl } = req.body;
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const finalReturnUrl = returnUrl || `${baseUrl}/account/billing`;

    // Create Stripe customer portal session
    const portalUrl = await createPortalSession(user.stripeCustomerId, finalReturnUrl);

    if (!portalUrl) {
      return res.status(500).json({ error: 'Failed to create portal session' });
    }

    res.json({
      portalUrl,
      url: portalUrl, // Alias for frontend compatibility
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
