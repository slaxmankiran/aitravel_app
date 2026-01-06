/**
 * Email Routes
 * Handles newsletter subscriptions and email preferences
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  subscribeEmail,
  unsubscribeEmail,
  getSubscriberCount,
  getEmailStats,
  isSubscribed,
} from '../services/email';

const router = Router();

// Validation schemas
const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().optional(),
  preferences: z.object({
    newsletter: z.boolean().optional(),
    priceAlerts: z.boolean().optional(),
    tripReminders: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
});

const unsubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  type: z.enum(['newsletter', 'priceAlerts', 'tripReminders', 'marketing']).optional(),
});

/**
 * POST /api/email/subscribe
 * Subscribe to newsletter/notifications
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const data = subscribeSchema.parse(req.body);

    subscribeEmail(data.email, data.source, data.preferences);

    res.json({
      success: true,
      message: 'Successfully subscribed! Check your inbox for a welcome email.',
    });
  } catch (err: any) {
    console.error('[Email] Subscribe error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

/**
 * POST /api/email/unsubscribe
 * Unsubscribe from notifications
 */
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const data = unsubscribeSchema.parse(req.body);

    unsubscribeEmail(data.email, data.type);

    res.json({
      success: true,
      message: data.type
        ? `Unsubscribed from ${data.type}`
        : 'Successfully unsubscribed from all emails',
    });
  } catch (err: any) {
    console.error('[Email] Unsubscribe error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

/**
 * GET /api/email/stats
 * Get email statistics (admin only in production)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = getEmailStats();
    const subscriberCount = getSubscriberCount();

    res.json({
      subscribers: subscriberCount,
      emails: stats,
    });
  } catch (err) {
    console.error('[Email] Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * GET /api/email/check
 * Check subscription status
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    res.json({
      newsletter: isSubscribed(email, 'newsletter'),
      priceAlerts: isSubscribed(email, 'priceAlerts'),
      tripReminders: isSubscribed(email, 'tripReminders'),
      marketing: isSubscribed(email, 'marketing'),
    });
  } catch (err) {
    console.error('[Email] Check error:', err);
    res.status(500).json({ error: 'Failed to check subscription' });
  }
});

export default router;
