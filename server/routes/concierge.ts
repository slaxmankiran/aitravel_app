/**
 * Concierge Routes - WhatsApp webhook endpoints for Twilio
 *
 * Endpoints:
 * - POST /api/concierge/webhook - Receive incoming WhatsApp messages
 * - POST /api/concierge/status - Receive message status callbacks
 * - GET /api/concierge/status - Check service availability
 */

import { Router, Request, Response } from 'express';
import { getAIClient, isAIConfigured } from '../services/aiClientFactory';
import {
  handleIncomingMessage,
  isConciergeConfigured,
  type WhatsAppMessage,
  type ConciergeHandlerDeps,
} from '../services/conciergeService';
import { lookupVisa } from '../services/passportIndexService';

const router = Router();

// AI client initialized lazily from factory
function getAI() {
  return getAIClient('auxiliary');
}

// ============================================================================
// SERVICE STATUS
// ============================================================================

/**
 * GET /api/concierge/status
 * Check if the concierge service is available
 */
router.get('/status', (req: Request, res: Response) => {
  const configured = isConciergeConfigured();
  const aiConfigured = isAIConfigured();

  res.json({
    available: configured && aiConfigured,
    whatsapp: configured,
    ai: aiConfigured,
    features: configured ? [
      'Trip status queries',
      'Visa information',
      'Cost estimates',
      'Change requests (routed to web app)',
    ] : [],
    comingSoon: [
      'Proactive notifications',
      'Rich media responses',
      'Multi-language support',
    ],
  });
});

// ============================================================================
// WEBHOOK - INCOMING MESSAGES
// ============================================================================

/**
 * POST /api/concierge/webhook
 * Twilio webhook for incoming WhatsApp messages
 *
 * Twilio sends form-urlencoded data with fields:
 * - From: whatsapp:+1234567890
 * - Body: message text
 * - MessageSid: unique message ID
 * - AccountSid: your Twilio account ID
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Validate request has required fields
    const message: WhatsAppMessage = {
      From: req.body.From || '',
      Body: req.body.Body || '',
      MessageSid: req.body.MessageSid || '',
      AccountSid: req.body.AccountSid || '',
      NumMedia: req.body.NumMedia,
      MediaUrl0: req.body.MediaUrl0,
    };

    if (!message.From || !message.Body) {
      console.warn('[Concierge] Invalid webhook request - missing From or Body');
      // Return 200 to prevent Twilio retries
      return res.status(200).send('OK');
    }

    // Validate AccountSid matches configured account (security)
    const expectedAccountSid = process.env.TWILIO_ACCOUNT_SID;
    if (expectedAccountSid && message.AccountSid !== expectedAccountSid) {
      console.warn('[Concierge] AccountSid mismatch - potential spoofed request');
      return res.status(200).send('OK');
    }

    console.log(`[Concierge] Received message from ${message.From}: ${message.Body.substring(0, 50)}...`);

    // Set up handler dependencies
    // Note: In production, these would connect to actual storage/services
    const { openai, model } = getAI();
    const deps: ConciergeHandlerDeps = {
      openai,
      model,

      // Lookup trip by phone number (placeholder - needs user phone mapping)
      lookupTripByPhone: async (phone: string) => {
        // TODO: Implement phone-to-user mapping
        // For now, return null to indicate no trips found
        console.log(`[Concierge] Trip lookup for phone ${phone} - not implemented yet`);
        return null;
      },

      // Lookup trip by ID
      lookupTripById: async (id: number) => {
        // Import storage dynamically to avoid circular dependencies
        const { storage } = await import('../storage');
        return storage.getTrip(id);
      },

      // Lookup visa requirements
      lookupVisa: async (passport: string, destination: string) => {
        return lookupVisa(passport, destination);
      },

      // Process change request (forward to chat endpoint)
      processChangeRequest: async (tripId: number, request: string) => {
        // TODO: Integrate with agentChat service
        console.log(`[Concierge] Change request for trip ${tripId}: ${request}`);
        return {
          success: false,
          summary: 'Change requests via WhatsApp are coming soon. Please use the web app.',
        };
      },
    };

    // Process message and get response
    const response = await handleIncomingMessage(message, deps);

    // Respond with TwiML
    // Twilio expects a TwiML response to send the reply
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(response.text)}</Message>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.status(200).send(twiml);

  } catch (error) {
    console.error('[Concierge] Webhook error:', error);

    // Return a friendly error message via TwiML
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, I ran into an issue. Please try again later or visit voyageai.app for support.</Message>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.status(200).send(errorTwiml);
  }
});

// ============================================================================
// WEBHOOK - MESSAGE STATUS
// ============================================================================

/**
 * POST /api/concierge/status-callback
 * Twilio callback for message delivery status
 *
 * Status values: queued, sent, delivered, read, failed, undelivered
 */
router.post('/status-callback', (req: Request, res: Response) => {
  const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = req.body;

  if (MessageStatus === 'failed' || MessageStatus === 'undelivered') {
    console.error(`[Concierge] Message ${MessageSid} to ${To} failed:`, {
      status: MessageStatus,
      errorCode: ErrorCode,
      errorMessage: ErrorMessage,
    });
  } else {
    console.log(`[Concierge] Message ${MessageSid} status: ${MessageStatus}`);
  }

  // Always return 200 to acknowledge receipt
  res.status(200).send('OK');
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape XML special characters for TwiML
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================================================
// MANUAL SEND ENDPOINT (For Testing)
// ============================================================================

/**
 * POST /api/concierge/send
 * Manually send a WhatsApp message (admin/testing only)
 *
 * Body:
 * - to: phone number (with or without whatsapp: prefix)
 * - message: text to send
 */
router.post('/send', async (req: Request, res: Response) => {
  // Only allow in development or with admin token
  if (process.env.NODE_ENV === 'production') {
    const adminToken = req.headers['x-admin-token'];
    if (!adminToken || adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'to and message are required' });
  }

  try {
    const { sendWhatsAppMessage } = await import('../services/conciergeService');
    const success = await sendWhatsAppMessage(to, { text: message });

    if (success) {
      res.json({ success: true, message: 'Message sent' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }
  } catch (error) {
    console.error('[Concierge] Manual send error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// ============================================================================
// SIMULATION ENDPOINT (For Testing)
// ============================================================================

/**
 * POST /api/concierge/simulate
 * Simulate an incoming message (for testing without Twilio)
 *
 * Body:
 * - from: phone number
 * - body: message text
 */
router.post('/simulate', async (req: Request, res: Response) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Simulation only available in development' });
  }

  const { from, body } = req.body;

  if (!from || !body) {
    return res.status(400).json({ error: 'from and body are required' });
  }

  try {
    const message: WhatsAppMessage = {
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      Body: body,
      MessageSid: `SIM_${Date.now()}`,
      AccountSid: 'SIMULATION',
    };

    const { openai, model } = getAI();
    const deps: ConciergeHandlerDeps = {
      openai,
      model,
      lookupTripByPhone: async () => null,
      lookupTripById: async (id: number) => {
        const { storage } = await import('../storage');
        return storage.getTrip(id);
      },
      lookupVisa: async (passport: string, destination: string) => {
        return lookupVisa(passport, destination);
      },
      processChangeRequest: async () => ({
        success: false,
        summary: 'Simulation mode - changes not applied',
      }),
    };

    const response = await handleIncomingMessage(message, deps);

    res.json({
      simulation: true,
      input: { from, body },
      response,
    });
  } catch (error) {
    console.error('[Concierge] Simulation error:', error);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

export default router;
