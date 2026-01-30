/**
 * Stripe Service
 * Handles all Stripe payment operations for VoyageAI subscriptions
 */

import Stripe from 'stripe';

// Initialize Stripe with API key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey && process.env.NODE_ENV === 'production') {
  console.error('[Stripe] STRIPE_SECRET_KEY is not set in production');
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  : null;

// Price IDs from environment (set these in Stripe Dashboard)
const STRIPE_PRICES = {
  pro: process.env.STRIPE_PRICE_ID_PRO || 'price_pro_monthly',
  business: process.env.STRIPE_PRICE_ID_BUSINESS || 'price_business_monthly',
} as const;

// Product metadata
export const SUBSCRIPTION_PRODUCTS = {
  pro: {
    name: 'VoyageAI Pro',
    description: 'Unlimited trips, advanced AI, priority support',
    price: 999, // $9.99 in cents
    priceId: STRIPE_PRICES.pro,
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
  },
  business: {
    name: 'VoyageAI Business',
    description: 'Everything in Pro plus team features and API access',
    price: 2999, // $29.99 in cents
    priceId: STRIPE_PRICES.business,
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
  },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PRODUCTS | 'free';

/**
 * Check if Stripe is configured
 */
export function isStripeConfigured(): boolean {
  return stripe !== null;
}

/**
 * Create or retrieve a Stripe customer
 */
export async function getOrCreateCustomer(
  email: string,
  userId: number,
  existingCustomerId?: string | null
): Promise<string | null> {
  if (!stripe) {
    console.warn('[Stripe] Not configured, skipping customer creation');
    return null;
  }

  try {
    // Return existing customer if we have one
    if (existingCustomerId) {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) {
        return existingCustomerId;
      }
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        voyageai_user_id: userId.toString(),
      },
    });

    console.log(`[Stripe] Created customer ${customer.id} for user ${userId}`);
    return customer.id;
  } catch (error) {
    console.error('[Stripe] Failed to create customer:', error);
    return null;
  }
}

/**
 * Create a checkout session for subscription
 */
export async function createCheckoutSession(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: number;
  planId: SubscriptionPlan;
}): Promise<{ sessionId: string; url: string } | null> {
  if (!stripe) {
    console.warn('[Stripe] Not configured, returning mock checkout');
    return {
      sessionId: `mock_session_${Date.now()}`,
      url: `${params.successUrl}?session_id=mock_session_${Date.now()}`,
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: params.customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        voyageai_user_id: params.userId.toString(),
        plan_id: params.planId,
      },
      subscription_data: {
        metadata: {
          voyageai_user_id: params.userId.toString(),
          plan_id: params.planId,
        },
      },
      allow_promotion_codes: true,
    });

    console.log(`[Stripe] Created checkout session ${session.id} for user ${params.userId}`);
    return {
      sessionId: session.id,
      url: session.url!,
    };
  } catch (error) {
    console.error('[Stripe] Failed to create checkout session:', error);
    return null;
  }
}

/**
 * Create a customer portal session for managing subscription
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string | null> {
  if (!stripe) {
    console.warn('[Stripe] Not configured, returning mock portal URL');
    return returnUrl;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (error) {
    console.error('[Stripe] Failed to create portal session:', error);
    return null;
  }
}

/**
 * Cancel a subscription at period end
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<boolean> {
  if (!stripe) {
    console.warn('[Stripe] Not configured, mock cancellation');
    return true;
  }

  try {
    if (immediately) {
      await stripe.subscriptions.cancel(subscriptionId);
    } else {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }

    console.log(`[Stripe] Cancelled subscription ${subscriptionId} (immediately: ${immediately})`);
    return true;
  } catch (error) {
    console.error('[Stripe] Failed to cancel subscription:', error);
    return false;
  }
}

/**
 * Reactivate a cancelled subscription
 */
export async function reactivateSubscription(subscriptionId: string): Promise<boolean> {
  if (!stripe) {
    console.warn('[Stripe] Not configured, mock reactivation');
    return true;
  }

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });

    console.log(`[Stripe] Reactivated subscription ${subscriptionId}`);
    return true;
  } catch (error) {
    console.error('[Stripe] Failed to reactivate subscription:', error);
    return false;
  }
}

/**
 * Get subscription details
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) {
    return null;
  }

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('[Stripe] Failed to get subscription:', error);
    return null;
  }
}

/**
 * Update subscription to a different plan
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string
): Promise<boolean> {
  if (!stripe) {
    console.warn('[Stripe] Not configured, mock update');
    return true;
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    console.log(`[Stripe] Updated subscription ${subscriptionId} to price ${newPriceId}`);
    return true;
  } catch (error) {
    console.error('[Stripe] Failed to update subscription:', error);
    return false;
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  if (!stripe) {
    return null;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Stripe] STRIPE_WEBHOOK_SECRET is not set');
    return null;
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error('[Stripe] Webhook signature verification failed:', error);
    return null;
  }
}

/**
 * Get price ID for a plan
 */
export function getPriceIdForPlan(planId: SubscriptionPlan): string | null {
  if (planId === 'free') return null;
  return SUBSCRIPTION_PRODUCTS[planId]?.priceId || null;
}

/**
 * Get plan ID from price ID
 */
export function getPlanIdFromPrice(priceId: string): SubscriptionPlan {
  if (priceId === STRIPE_PRICES.pro) return 'pro';
  if (priceId === STRIPE_PRICES.business) return 'business';
  return 'free';
}

export { stripe, Stripe };
