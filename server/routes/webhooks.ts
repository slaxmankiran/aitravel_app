/**
 * Stripe Webhook Handlers
 * Processes Stripe events for subscription lifecycle management
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { users, subscriptions } from '@shared/schema';
import { eq } from 'drizzle-orm';
import {
  verifyWebhookSignature,
  getPlanIdFromPrice,
  type Stripe,
} from '../services/stripeService';

const router = Router();

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 *
 * IMPORTANT: This endpoint receives raw body (not JSON parsed)
 * Configure in server/index.ts before JSON middleware
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return res.status(400).json({ error: 'Missing signature' });
  }

  // Get raw body for signature verification (set by express.json verify callback)
  const rawBody = (req as any).rawBody as Buffer;

  // In development without webhook secret, parse body as JSON
  let event: Stripe.Event;

  if (process.env.STRIPE_WEBHOOK_SECRET) {
    const verified = verifyWebhookSignature(rawBody, signature);
    if (!verified) {
      console.error('[Webhook] Signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }
    event = verified;
  } else {
    // Development mode - trust the event (NEVER do this in production)
    console.warn('[Webhook] Running without signature verification (dev mode)');
    event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  }

  console.log(`[Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error processing event:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle successful checkout session
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.voyageai_user_id;
  const planId = session.metadata?.plan_id;
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId || !planId || !subscriptionId) {
    console.error('[Webhook] Missing metadata in checkout session', {
      userId,
      planId,
      subscriptionId,
    });
    return;
  }

  console.log(`[Webhook] Checkout complete for user ${userId}, plan ${planId}`);

  // Update user with Stripe customer ID
  await db
    .update(users)
    .set({
      stripeCustomerId: customerId,
      subscriptionTier: planId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, parseInt(userId)));

  // Create or update subscription record
  const existingSub = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, parseInt(userId)));

  if (existingSub.length > 0) {
    await db
      .update(subscriptions)
      .set({
        plan: planId,
        status: 'active',
        stripeSubscriptionId: subscriptionId,
        stripePriceId: session.line_items?.data[0]?.price?.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, parseInt(userId)));
  } else {
    await db.insert(subscriptions).values({
      userId: parseInt(userId),
      plan: planId,
      status: 'active',
      stripeSubscriptionId: subscriptionId,
      stripePriceId: session.line_items?.data[0]?.price?.id,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    });
  }

  console.log(`[Webhook] Subscription activated for user ${userId}`);
}

/**
 * Handle subscription updates (plan change, renewal)
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.voyageai_user_id;

  if (!userId) {
    // Try to find user by customer ID
    const customer = subscription.customer as string;
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customer));

    if (!user) {
      console.error('[Webhook] Cannot find user for subscription', subscription.id);
      return;
    }

    await updateSubscriptionRecord(user.id, subscription);
  } else {
    await updateSubscriptionRecord(parseInt(userId), subscription);
  }
}

/**
 * Update subscription record in database
 */
async function updateSubscriptionRecord(userId: number, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const planId = getPlanIdFromPrice(priceId || '');

  const status = mapStripeStatus(subscription.status);

  // Access period timestamps from subscription object
  // Stripe uses snake_case in API responses, but types may vary by version
  const subAny = subscription as any;
  const periodEnd = subAny.current_period_end || subAny.currentPeriodEnd;
  const periodStart = subAny.current_period_start || subAny.currentPeriodStart;

  // Update user tier
  await db
    .update(users)
    .set({
      subscriptionTier: planId,
      subscriptionExpiresAt: new Date(periodEnd * 1000),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // Update subscription record
  const existingSub = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  const subData = {
    plan: planId,
    status,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: new Date(),
  };

  if (existingSub.length > 0) {
    await db
      .update(subscriptions)
      .set(subData)
      .where(eq(subscriptions.userId, userId));
  } else {
    await db.insert(subscriptions).values({
      userId,
      ...subData,
    });
  }

  console.log(`[Webhook] Updated subscription for user ${userId}: ${planId} (${status})`);
}

/**
 * Handle subscription deletion
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    console.error('[Webhook] Cannot find user for deleted subscription', subscription.id);
    return;
  }

  // Downgrade to free tier
  await db
    .update(users)
    .set({
      subscriptionTier: 'free',
      subscriptionExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Update subscription status
  await db
    .update(subscriptions)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, user.id));

  console.log(`[Webhook] Subscription cancelled for user ${user.id}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  // subscription can be string or object depending on Stripe API version
  const invoiceAny = invoice as any;
  const subscriptionId = (typeof invoiceAny.subscription === 'string'
    ? invoiceAny.subscription
    : invoiceAny.subscription?.id) as string;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    console.error('[Webhook] Cannot find user for failed payment', invoice.id);
    return;
  }

  // Update subscription status to past_due
  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  console.log(`[Webhook] Payment failed for user ${user.id}, subscription ${subscriptionId}`);

  // TODO: Send email notification about failed payment
}

/**
 * Handle successful payment (renewal)
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  // subscription can be string or object depending on Stripe API version
  const invoiceAny = invoice as any;
  const subscriptionId = (typeof invoiceAny.subscription === 'string'
    ? invoiceAny.subscription
    : invoiceAny.subscription?.id) as string;

  if (!subscriptionId) {
    // One-time payment, not subscription
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId));

  if (!user) {
    console.error('[Webhook] Cannot find user for successful payment', invoice.id);
    return;
  }

  // Ensure subscription is active
  await db
    .update(subscriptions)
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));

  console.log(`[Webhook] Payment succeeded for user ${user.id}`);
}

/**
 * Map Stripe subscription status to our status
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'cancelled' | 'past_due' | 'expired' {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'canceled':
      return 'cancelled';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'expired';
    default:
      return 'expired';
  }
}

export default router;
