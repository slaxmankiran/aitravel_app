/**
 * Email Service
 * Handles email notifications, verification emails, and marketing communications
 * Uses an in-memory queue for development (integrate with SendGrid/SES in production)
 */

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

function getWelcomeEmail(name: string): EmailTemplate {
  const userName = name || 'Traveler';
  return {
    subject: 'Welcome to VoyageAI - Your AI Travel Companion',
    text: `Welcome to VoyageAI, ${userName}!\n\nYour account has been created successfully. Start planning your next adventure with our AI-powered travel planner.\n\nBest,\nThe VoyageAI Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #10b981 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to VoyageAI</h1>
        </div>
        <div style="padding: 40px 20px; background: #f8fafc;">
          <h2 style="color: #1e293b; margin-top: 0;">Hello ${userName}!</h2>
          <p style="color: #475569; line-height: 1.6;">Your account has been created successfully. You're now ready to plan your next adventure with our AI-powered travel planner.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://voyageai.app/create" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Start Planning</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">Happy travels,<br>The VoyageAI Team</p>
        </div>
      </div>
    `,
  };
}

function getVerificationEmail(token: string): EmailTemplate {
  return {
    subject: 'Verify Your VoyageAI Email',
    text: `Please verify your email by clicking this link: https://voyageai.app/verify?token=${token}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #10b981 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
        </div>
        <div style="padding: 40px 20px; background: #f8fafc;">
          <p style="color: #475569; line-height: 1.6;">Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://voyageai.app/verify?token=${token}" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Verify Email</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">If you didn't create an account, you can ignore this email.</p>
        </div>
      </div>
    `,
  };
}

function getPasswordResetEmail(token: string): EmailTemplate {
  return {
    subject: 'Reset Your VoyageAI Password',
    text: `Reset your password by clicking this link: https://voyageai.app/reset-password?token=${token}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #10b981 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
        </div>
        <div style="padding: 40px 20px; background: #f8fafc;">
          <p style="color: #475569; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://voyageai.app/reset-password?token=${token}" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 14px;">This link expires in 24 hours. If you didn't request a password reset, you can ignore this email.</p>
        </div>
      </div>
    `,
  };
}

function getPriceAlertEmail(data: {
  destination: string;
  type: 'flight' | 'hotel';
  originalPrice: number;
  currentPrice: number;
  currency: string;
  percentDrop: number;
}): EmailTemplate {
  const { destination, type, originalPrice, currentPrice, currency, percentDrop } = data;
  const symbol = getCurrencySymbol(currency);

  return {
    subject: `Price Drop Alert: ${destination} ${type}s down ${percentDrop}%!`,
    text: `Good news! ${type.charAt(0).toUpperCase() + type.slice(1)} prices to ${destination} have dropped by ${percentDrop}%!\n\nOriginal: ${symbol}${originalPrice}\nNow: ${symbol}${currentPrice}\n\nBook now at https://voyageai.app`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Price Drop Alert!</h1>
        </div>
        <div style="padding: 40px 20px; background: #f8fafc;">
          <h2 style="color: #1e293b; margin-top: 0;">${type.charAt(0).toUpperCase() + type.slice(1)} to ${destination}</h2>
          <div style="background: white; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
            <p style="color: #64748b; margin: 0; text-decoration: line-through;">${symbol}${originalPrice}</p>
            <p style="color: #10b981; font-size: 32px; font-weight: bold; margin: 10px 0;">${symbol}${currentPrice}</p>
            <p style="color: #10b981; margin: 0;">Save ${percentDrop}%!</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://voyageai.app" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">Book Now</a>
          </div>
        </div>
      </div>
    `,
  };
}

function getTripReminderEmail(data: {
  destination: string;
  daysUntilTrip: number;
  tripId: number;
}): EmailTemplate {
  const { destination, daysUntilTrip, tripId } = data;

  return {
    subject: `${daysUntilTrip} days until your trip to ${destination}!`,
    text: `Your trip to ${destination} is coming up in ${daysUntilTrip} days! Make sure you've completed your pre-trip checklist.\n\nView your trip: https://voyageai.app/trips/${tripId}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #10b981 100%); padding: 40px 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">${daysUntilTrip} Days to Go!</h1>
        </div>
        <div style="padding: 40px 20px; background: #f8fafc;">
          <h2 style="color: #1e293b; margin-top: 0;">Your trip to ${destination} is coming up!</h2>
          <p style="color: #475569; line-height: 1.6;">Make sure you've:</p>
          <ul style="color: #475569; line-height: 1.8;">
            <li>Checked visa requirements</li>
            <li>Booked all accommodations</li>
            <li>Packed everything you need</li>
            <li>Downloaded offline maps</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://voyageai.app/trips/${tripId}" style="background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View Trip Details</a>
          </div>
        </div>
      </div>
    `,
  };
}

// Helper to get currency symbol
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', THB: '฿'
  };
  return symbols[currency] || currency;
}

// ============================================================================
// EMAIL QUEUE (In-memory for development)
// ============================================================================

interface QueuedEmail {
  id: number;
  to: string;
  subject: string;
  text: string;
  html: string;
  type: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
  sentAt?: Date;
  error?: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

const emailQueue: QueuedEmail[] = [];
let emailIdCounter = 1;

// ============================================================================
// QUEUE OPERATIONS
// ============================================================================

/**
 * Add email to queue
 */
export function queueEmail(params: {
  to: string;
  type: string;
  template: EmailTemplate;
  metadata?: Record<string, any>;
}): number {
  const email: QueuedEmail = {
    id: emailIdCounter++,
    to: params.to,
    subject: params.template.subject,
    text: params.template.text,
    html: params.template.html,
    type: params.type,
    status: 'pending',
    createdAt: new Date(),
    retryCount: 0,
    metadata: params.metadata,
  };

  emailQueue.push(email);
  console.log(`[Email] Queued: ${email.type} to ${email.to}`);

  // In development, simulate sending
  setTimeout(() => processEmail(email.id), 100);

  return email.id;
}

/**
 * Process a single email (simulate sending in development)
 */
async function processEmail(emailId: number): Promise<void> {
  const email = emailQueue.find(e => e.id === emailId);
  if (!email || email.status !== 'pending') return;

  try {
    // In production, integrate with SendGrid, AWS SES, etc.
    // For now, just log and mark as sent
    console.log(`[Email] Sending: "${email.subject}" to ${email.to}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    email.status = 'sent';
    email.sentAt = new Date();
    console.log(`[Email] Sent successfully: ${email.id}`);
  } catch (err: any) {
    email.status = 'failed';
    email.error = err.message;
    email.retryCount++;
    console.error(`[Email] Failed to send: ${email.id}`, err);
  }
}

/**
 * Get pending emails count
 */
export function getPendingEmailsCount(): number {
  return emailQueue.filter(e => e.status === 'pending').length;
}

/**
 * Get email statistics
 */
export function getEmailStats(): {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};

  for (const email of emailQueue) {
    byType[email.type] = (byType[email.type] || 0) + 1;
  }

  return {
    total: emailQueue.length,
    pending: emailQueue.filter(e => e.status === 'pending').length,
    sent: emailQueue.filter(e => e.status === 'sent').length,
    failed: emailQueue.filter(e => e.status === 'failed').length,
    byType,
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Send welcome email to new user
 */
export function sendWelcomeEmail(to: string, name?: string): number {
  return queueEmail({
    to,
    type: 'welcome',
    template: getWelcomeEmail(name || ''),
  });
}

/**
 * Send email verification
 */
export function sendVerificationEmail(to: string, token: string): number {
  return queueEmail({
    to,
    type: 'verification',
    template: getVerificationEmail(token),
  });
}

/**
 * Send password reset email
 */
export function sendPasswordResetEmail(to: string, token: string): number {
  return queueEmail({
    to,
    type: 'password_reset',
    template: getPasswordResetEmail(token),
  });
}

/**
 * Send price alert email
 */
export function sendPriceAlertEmail(
  to: string,
  data: {
    destination: string;
    type: 'flight' | 'hotel';
    originalPrice: number;
    currentPrice: number;
    currency: string;
    percentDrop: number;
  }
): number {
  return queueEmail({
    to,
    type: 'price_alert',
    template: getPriceAlertEmail(data),
    metadata: data,
  });
}

/**
 * Send trip reminder email
 */
export function sendTripReminderEmail(
  to: string,
  data: {
    destination: string;
    daysUntilTrip: number;
    tripId: number;
  }
): number {
  return queueEmail({
    to,
    type: 'trip_reminder',
    template: getTripReminderEmail(data),
    metadata: data,
  });
}

// ============================================================================
// EMAIL SUBSCRIBER MANAGEMENT (For newsletter/marketing)
// ============================================================================

interface EmailSubscriber {
  email: string;
  subscribedAt: Date;
  source: string;
  preferences: {
    newsletter: boolean;
    priceAlerts: boolean;
    tripReminders: boolean;
    marketing: boolean;
  };
}

const subscribers = new Map<string, EmailSubscriber>();

/**
 * Subscribe email to notifications
 */
export function subscribeEmail(
  email: string,
  source: string = 'website',
  preferences?: Partial<EmailSubscriber['preferences']>
): void {
  const existing = subscribers.get(email);

  if (existing) {
    // Update preferences
    if (preferences) {
      existing.preferences = { ...existing.preferences, ...preferences };
    }
    console.log(`[Email] Updated subscriber: ${email}`);
  } else {
    subscribers.set(email, {
      email,
      subscribedAt: new Date(),
      source,
      preferences: {
        newsletter: true,
        priceAlerts: true,
        tripReminders: true,
        marketing: false,
        ...preferences,
      },
    });
    console.log(`[Email] New subscriber: ${email} from ${source}`);
  }
}

/**
 * Unsubscribe email
 */
export function unsubscribeEmail(email: string, type?: keyof EmailSubscriber['preferences']): void {
  const subscriber = subscribers.get(email);

  if (!subscriber) return;

  if (type) {
    subscriber.preferences[type] = false;
    console.log(`[Email] Unsubscribed ${email} from ${type}`);
  } else {
    subscribers.delete(email);
    console.log(`[Email] Fully unsubscribed: ${email}`);
  }
}

/**
 * Get subscriber count
 */
export function getSubscriberCount(): number {
  return subscribers.size;
}

/**
 * Check if email is subscribed to a type
 */
export function isSubscribed(email: string, type: keyof EmailSubscriber['preferences']): boolean {
  const subscriber = subscribers.get(email);
  return subscriber?.preferences[type] ?? false;
}
