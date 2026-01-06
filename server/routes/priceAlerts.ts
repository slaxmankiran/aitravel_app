/**
 * Price Alerts Routes
 * Manage price tracking alerts for flights and hotels
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validateSession, getSessionIdFromHeaders } from '../services/auth';
import { sendPriceAlertEmail } from '../services/email';

const router = Router();

// In-memory storage for price alerts (use database in production)
interface PriceAlert {
  id: number;
  tripId: number;
  userId?: number;
  email: string;
  type: 'flight' | 'hotel';
  destination: string;
  origin: string;
  dates: string;
  initialPrice: number;
  currentPrice: number;
  targetPrice: number;
  currency: string;
  isActive: boolean;
  lastChecked: Date;
  lastAlertSent?: Date;
  createdAt: Date;
  priceHistory: Array<{ price: number; timestamp: Date }>;
}

const priceAlerts = new Map<number, PriceAlert>();
let alertIdCounter = 1;

// Validation schema
const createAlertSchema = z.object({
  tripId: z.number(),
  type: z.enum(['flight', 'hotel']),
  destination: z.string(),
  origin: z.string().optional(),
  dates: z.string(),
  currentPrice: z.number(),
  targetPrice: z.number().min(1),
  currency: z.string().default('USD'),
  email: z.string().email(),
});

/**
 * POST /api/price-alerts
 * Create a new price alert
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createAlertSchema.parse(req.body);

    // Check if user is authenticated
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    let userId: number | undefined;

    if (sessionId) {
      const session = await validateSession(sessionId);
      userId = session?.user.id;
    }

    // Check for existing alert with same params
    const existing = Array.from(priceAlerts.values()).find(
      a => a.email === data.email &&
           a.tripId === data.tripId &&
           a.type === data.type &&
           a.isActive
    );

    if (existing) {
      // Update existing alert
      existing.targetPrice = data.targetPrice;
      existing.lastChecked = new Date();

      return res.json({
        success: true,
        alert: sanitizeAlert(existing),
        message: 'Price alert updated',
      });
    }

    // Create new alert
    const alert: PriceAlert = {
      id: alertIdCounter++,
      tripId: data.tripId,
      userId,
      email: data.email,
      type: data.type,
      destination: data.destination,
      origin: data.origin || '',
      dates: data.dates,
      initialPrice: data.currentPrice,
      currentPrice: data.currentPrice,
      targetPrice: data.targetPrice,
      currency: data.currency,
      isActive: true,
      lastChecked: new Date(),
      createdAt: new Date(),
      priceHistory: [{ price: data.currentPrice, timestamp: new Date() }],
    };

    priceAlerts.set(alert.id, alert);

    console.log(`[Price Alerts] Created alert #${alert.id} for ${data.email}: ${data.type} to ${data.destination} at ${data.currency}${data.targetPrice}`);

    res.json({
      success: true,
      alert: sanitizeAlert(alert),
      message: 'Price alert created successfully',
    });
  } catch (err: any) {
    console.error('[Price Alerts] Create error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to create price alert' });
  }
});

/**
 * GET /api/price-alerts
 * Get all alerts for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    const email = req.query.email as string;

    let alerts: PriceAlert[] = [];

    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session) {
        alerts = Array.from(priceAlerts.values())
          .filter(a => a.userId === session.user.id || a.email === session.user.email);
      }
    } else if (email) {
      alerts = Array.from(priceAlerts.values())
        .filter(a => a.email === email);
    }

    res.json({
      alerts: alerts.map(sanitizeAlert),
    });
  } catch (err) {
    console.error('[Price Alerts] Get error:', err);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * GET /api/price-alerts/:id
 * Get a specific alert
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.id);
    const alert = priceAlerts.get(alertId);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json({ alert: sanitizeAlert(alert) });
  } catch (err) {
    console.error('[Price Alerts] Get single error:', err);
    res.status(500).json({ error: 'Failed to get alert' });
  }
});

/**
 * DELETE /api/price-alerts/:id
 * Delete/deactivate an alert
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.id);
    const alert = priceAlerts.get(alertId);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Verify ownership
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);
    if (sessionId) {
      const session = await validateSession(sessionId);
      if (session && alert.userId !== session.user.id && alert.email !== session.user.email) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Soft delete - just deactivate
    alert.isActive = false;

    console.log(`[Price Alerts] Deactivated alert #${alertId}`);

    res.json({ success: true });
  } catch (err) {
    console.error('[Price Alerts] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

/**
 * POST /api/price-alerts/check
 * Trigger price check for all active alerts (called by cron job)
 */
router.post('/check', async (req: Request, res: Response) => {
  try {
    const activeAlerts = Array.from(priceAlerts.values()).filter(a => a.isActive);

    console.log(`[Price Alerts] Checking ${activeAlerts.length} active alerts...`);

    let updatedCount = 0;
    let alertsSent = 0;

    for (const alert of activeAlerts) {
      // In production, fetch actual prices from flight/hotel APIs
      // For now, simulate price changes
      const priceChange = (Math.random() - 0.5) * 0.1; // -5% to +5%
      const newPrice = Math.round(alert.currentPrice * (1 + priceChange));

      if (newPrice !== alert.currentPrice) {
        alert.currentPrice = newPrice;
        alert.priceHistory.push({ price: newPrice, timestamp: new Date() });
        alert.lastChecked = new Date();
        updatedCount++;

        // Check if price dropped below target
        if (newPrice <= alert.targetPrice) {
          const percentDrop = Math.round(((alert.initialPrice - newPrice) / alert.initialPrice) * 100);

          // Don't spam - only send if we haven't sent in last 24 hours
          const lastSent = alert.lastAlertSent?.getTime() || 0;
          const hoursSinceLastAlert = (Date.now() - lastSent) / (1000 * 60 * 60);

          if (hoursSinceLastAlert >= 24) {
            sendPriceAlertEmail(alert.email, {
              destination: alert.destination,
              type: alert.type,
              originalPrice: alert.initialPrice,
              currentPrice: newPrice,
              currency: alert.currency,
              percentDrop,
            });

            alert.lastAlertSent = new Date();
            alertsSent++;
            console.log(`[Price Alerts] Alert sent to ${alert.email}: ${alert.type} to ${alert.destination} dropped to ${alert.currency}${newPrice}`);
          }
        }
      }
    }

    res.json({
      success: true,
      checked: activeAlerts.length,
      updated: updatedCount,
      alertsSent,
    });
  } catch (err) {
    console.error('[Price Alerts] Check error:', err);
    res.status(500).json({ error: 'Failed to check prices' });
  }
});

/**
 * Get alert stats
 */
router.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const allAlerts = Array.from(priceAlerts.values());

    res.json({
      total: allAlerts.length,
      active: allAlerts.filter(a => a.isActive).length,
      byType: {
        flight: allAlerts.filter(a => a.type === 'flight').length,
        hotel: allAlerts.filter(a => a.type === 'hotel').length,
      },
    });
  } catch (err) {
    console.error('[Price Alerts] Stats error:', err);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Helper to remove sensitive data
function sanitizeAlert(alert: PriceAlert): Omit<PriceAlert, 'email' | 'priceHistory'> & { email?: string } {
  const { priceHistory, ...rest } = alert;
  return rest;
}

export default router;
