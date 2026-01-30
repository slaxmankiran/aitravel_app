/**
 * WhatsApp AI Concierge Service
 * Handles incoming WhatsApp messages via Twilio, parses intent,
 * routes to appropriate handlers, and formats responses.
 *
 * MVP Scope:
 * - Trip status queries
 * - Change requests (routed to agentChat)
 * - General travel questions
 *
 * Deferred to Phase 2:
 * - Proactive notifications
 * - Rich media (images, cards)
 * - Multi-language support
 */

import OpenAI from 'openai';
import { BoundedMap } from '../utils/boundedMap';

// Twilio client type (loaded dynamically for esModule compatibility)
type TwilioClient = {
  messages: {
    create: (options: {
      from: string;
      to: string;
      body: string;
      mediaUrl?: string[];
    }) => Promise<any>;
  };
};

// ============================================================================
// TYPES
// ============================================================================

export type UserIntent =
  | 'trip_status'      // "What's my trip status?"
  | 'trip_details'     // "Show me my Paris trip"
  | 'change_request'   // "Add a cooking class to day 2"
  | 'visa_question'    // "Do I need a visa for Japan?"
  | 'cost_question'    // "How much will my trip cost?"
  | 'general_question' // "What's the weather like in Tokyo?"
  | 'greeting'         // "Hi", "Hello"
  | 'help'             // "Help", "What can you do?"
  | 'unknown';         // Couldn't parse intent

export interface ParsedMessage {
  intent: UserIntent;
  confidence: 'high' | 'medium' | 'low';
  entities: {
    tripId?: number;
    destination?: string;
    dayNumber?: number;
    activityType?: string;
    passport?: string;
  };
  originalText: string;
}

export interface ConversationContext {
  phoneNumber: string;
  lastTripId?: number;
  lastDestination?: string;
  lastIntent?: UserIntent;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConciergeResponse {
  text: string;
  mediaUrl?: string;
  quickReplies?: string[];
  shouldEndConversation?: boolean;
}

export interface WhatsAppMessage {
  From: string;        // Phone number with whatsapp: prefix
  Body: string;        // Message text
  MessageSid: string;  // Twilio message ID
  AccountSid: string;  // Twilio account ID
  NumMedia?: string;   // Number of media attachments
  MediaUrl0?: string;  // First media URL if present
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// In-memory conversation context (bounded to prevent memory leaks; production would use Redis/DB)
const CONTEXT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const conversationContexts = new BoundedMap<string, ConversationContext>({ maxSize: 500, ttlMs: CONTEXT_TTL_MS });

// ============================================================================
// TWILIO CLIENT
// ============================================================================

let twilioClient: TwilioClient | null = null;

/**
 * Get or create Twilio client
 * Uses dynamic require for CommonJS compatibility
 */
export function getTwilioClient(): TwilioClient | null {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn('[Concierge] Twilio credentials not configured');
    return null;
  }

  if (!twilioClient) {
    try {
      // Dynamic require for CommonJS module compatibility
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Twilio = require('twilio');
      twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    } catch (error) {
      console.error('[Concierge] Failed to initialize Twilio client:', error);
      return null;
    }
  }

  return twilioClient;
}

/**
 * Check if concierge service is configured
 */
export function isConciergeConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

// ============================================================================
// INTENT PARSING
// ============================================================================

const INTENT_SYSTEM_PROMPT = `You are a travel assistant intent parser. Analyze the user's message and extract:
1. The intent (what they want to do)
2. Any entities mentioned (trip ID, destination, day number, etc.)

Respond in JSON format only.

Intent categories:
- trip_status: User wants to know trip status or progress
- trip_details: User wants to see specific trip information
- change_request: User wants to modify their itinerary
- visa_question: User asking about visa requirements
- cost_question: User asking about costs or budget
- general_question: General travel questions
- greeting: Hello, hi, hey, etc.
- help: User asking what the bot can do
- unknown: Cannot determine intent`;

const INTENT_USER_PROMPT = `Parse this WhatsApp message from a travel planning user:

MESSAGE: "{message}"

Previous context (if any):
- Last trip destination: {lastDestination}
- Last trip ID: {lastTripId}

Extract the intent and entities as JSON:
{
  "intent": "trip_status" | "trip_details" | "change_request" | "visa_question" | "cost_question" | "general_question" | "greeting" | "help" | "unknown",
  "confidence": "high" | "medium" | "low",
  "entities": {
    "tripId": number or null,
    "destination": string or null,
    "dayNumber": number or null,
    "activityType": string or null,
    "passport": string or null
  }
}`;

/**
 * Parse user message to extract intent and entities
 */
export async function parseMessage(
  message: string,
  context: ConversationContext | null,
  openai: OpenAI,
  model: string = 'deepseek-chat'
): Promise<ParsedMessage> {
  // Quick pattern matching for common intents
  const lowerMessage = message.toLowerCase().trim();

  // Greetings
  if (/^(hi|hello|hey|hola|good\s*(morning|afternoon|evening))[\s!.]*$/i.test(lowerMessage)) {
    return {
      intent: 'greeting',
      confidence: 'high',
      entities: {},
      originalText: message,
    };
  }

  // Help
  if (/^(help|what can you do|commands|menu|options)[\s?!.]*$/i.test(lowerMessage)) {
    return {
      intent: 'help',
      confidence: 'high',
      entities: {},
      originalText: message,
    };
  }

  // Trip status (simple patterns)
  if (/\b(status|progress|how.*(trip|itinerary).*going)\b/i.test(lowerMessage)) {
    return {
      intent: 'trip_status',
      confidence: 'medium',
      entities: { tripId: context?.lastTripId },
      originalText: message,
    };
  }

  // Visa questions
  if (/\b(visa|entry\s*requirement|need.*passport)\b/i.test(lowerMessage)) {
    const destMatch = message.match(/(?:to|for|visit(?:ing)?)\s+([A-Z][a-zA-Z\s]+?)(?:\?|$|\.|\s+from)/i);
    return {
      intent: 'visa_question',
      confidence: 'medium',
      entities: { destination: destMatch?.[1]?.trim() },
      originalText: message,
    };
  }

  // Cost questions
  if (/\b(cost|price|budget|expensive|cheap|afford)\b/i.test(lowerMessage)) {
    return {
      intent: 'cost_question',
      confidence: 'medium',
      entities: { tripId: context?.lastTripId },
      originalText: message,
    };
  }

  // For complex messages, use AI
  try {
    const prompt = INTENT_USER_PROMPT
      .replace('{message}', message)
      .replace('{lastDestination}', context?.lastDestination || 'None')
      .replace('{lastTripId}', context?.lastTripId?.toString() || 'None');

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const resultText = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(resultText);

    return {
      intent: parsed.intent || 'unknown',
      confidence: parsed.confidence || 'low',
      entities: parsed.entities || {},
      originalText: message,
    };
  } catch (error) {
    console.error('[Concierge] Intent parsing error:', error);
    return {
      intent: 'unknown',
      confidence: 'low',
      entities: {},
      originalText: message,
    };
  }
}

// ============================================================================
// CONVERSATION CONTEXT
// ============================================================================

/**
 * Get or create conversation context for a phone number
 */
export function getConversationContext(phoneNumber: string): ConversationContext {
  // Clean expired contexts
  cleanExpiredContexts();

  let context = conversationContexts.get(phoneNumber);

  if (!context) {
    context = {
      phoneNumber,
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    conversationContexts.set(phoneNumber, context);
  }

  return context;
}

/**
 * Update conversation context
 */
export function updateConversationContext(
  phoneNumber: string,
  updates: Partial<ConversationContext>
): ConversationContext {
  const context = getConversationContext(phoneNumber);

  Object.assign(context, updates, {
    updatedAt: new Date(),
    messageCount: context.messageCount + 1,
  });

  conversationContexts.set(phoneNumber, context);
  return context;
}

/**
 * Clean up expired conversation contexts
 */
function cleanExpiredContexts(): void {
  const now = Date.now();
  const entries = Array.from(conversationContexts.entries());

  for (const [phone, context] of entries) {
    if (now - context.updatedAt.getTime() > CONTEXT_TTL_MS) {
      conversationContexts.delete(phone);
    }
  }
}

// ============================================================================
// RESPONSE GENERATION
// ============================================================================

const RESPONSE_TEMPLATES = {
  greeting: `Hi! 👋 I'm your VoyageAI travel assistant. I can help you with:

• Check your trip status
• Answer visa questions
• Modify your itinerary
• Get cost estimates

What would you like to know?`,

  help: `Here's what I can help you with:

📍 *Trip Status* - "What's the status of my trip?"
✈️ *Visa Info* - "Do I need a visa for Japan?"
💰 *Costs* - "How much will my trip cost?"
📝 *Changes* - "Add a cooking class to day 2"

Just type your question naturally!`,

  no_trips: `I don't see any trips associated with your number yet.

To get started:
1. Visit voyageai.app and create a trip
2. Link your WhatsApp number in settings

Need help? Type "help" for more options.`,

  error: `Sorry, I ran into an issue processing your request. Please try again in a moment.

If the problem persists, visit voyageai.app for support.`,

  unknown: `I'm not sure I understood that. Could you rephrase?

Try asking things like:
• "What's my trip status?"
• "Do I need a visa for France?"
• "How much will it cost?"`,
};

/**
 * Generate response for greeting intent
 */
function handleGreeting(context: ConversationContext): ConciergeResponse {
  return {
    text: RESPONSE_TEMPLATES.greeting,
    quickReplies: ['Check my trip', 'Visa info', 'Help'],
  };
}

/**
 * Generate response for help intent
 */
function handleHelp(): ConciergeResponse {
  return {
    text: RESPONSE_TEMPLATES.help,
    quickReplies: ['Trip status', 'Visa question', 'Cost estimate'],
  };
}

/**
 * Generate response for unknown intent
 */
function handleUnknown(): ConciergeResponse {
  return {
    text: RESPONSE_TEMPLATES.unknown,
    quickReplies: ['Help', 'Trip status'],
  };
}

/**
 * Format trip status response
 */
export function formatTripStatusResponse(trip: any): ConciergeResponse {
  if (!trip) {
    return { text: RESPONSE_TEMPLATES.no_trips };
  }

  const status = trip.feasibilityStatus || 'pending';
  const destination = trip.destination || 'Unknown destination';
  const dates = trip.dates || 'Dates not set';
  const certainty = trip.certaintyScore || 0;

  let statusEmoji = '⏳';
  let statusText = 'In progress';

  if (status === 'complete') {
    statusEmoji = certainty >= 80 ? '✅' : certainty >= 50 ? '🟡' : '🔴';
    statusText = `Ready (${certainty}% certainty)`;
  } else if (status === 'error') {
    statusEmoji = '❌';
    statusText = 'Error - please retry';
  }

  const text = `${statusEmoji} *${destination}*

📅 ${dates}
👥 ${trip.groupSize || 1} traveler(s)
💰 Budget: $${trip.budget || 'Not set'}
📊 Status: ${statusText}

${status === 'complete' ? 'View full details at voyageai.app/trips/' + trip.id : 'Processing... check back soon!'}`;

  return {
    text,
    quickReplies: status === 'complete'
      ? ['See itinerary', 'Check visa', 'Modify trip']
      : ['Check again', 'Help'],
  };
}

/**
 * Format visa info response
 */
export function formatVisaResponse(visaInfo: any, destination: string): ConciergeResponse {
  if (!visaInfo) {
    return {
      text: `I couldn't find visa information for ${destination}. Please check voyageai.app for the most accurate info.`,
    };
  }

  const visaType = visaInfo.visaType || 'unknown';
  let emoji = '📋';
  let summary = '';

  if (visaType === 'visa_free' || visaType === 'VF') {
    emoji = '✅';
    summary = `No visa required for ${destination}!`;
  } else if (visaType === 'visa_on_arrival' || visaType === 'VOA') {
    emoji = '🟡';
    summary = `Visa on arrival available for ${destination}`;
  } else if (visaType === 'e_visa' || visaType === 'EV') {
    emoji = '🟡';
    summary = `E-Visa required for ${destination}`;
  } else {
    emoji = '🔴';
    summary = `Visa required for ${destination}`;
  }

  const text = `${emoji} *Visa for ${destination}*

${summary}

${visaInfo.stayDuration ? `📅 Max stay: ${visaInfo.stayDuration} days` : ''}
${visaInfo.notes ? `📝 ${visaInfo.notes}` : ''}

For detailed requirements, visit voyageai.app`;

  return {
    text,
    quickReplies: ['Plan a trip', 'More visa info', 'Help'],
  };
}

/**
 * Format cost estimate response
 */
export function formatCostResponse(trip: any): ConciergeResponse {
  if (!trip?.trueCostBreakdown) {
    return {
      text: `I don't have cost details for this trip yet. Check back after the itinerary is generated.`,
      quickReplies: ['Trip status', 'Help'],
    };
  }

  const costs = trip.trueCostBreakdown;
  const total = costs.total || 0;
  const currency = costs.currency || 'USD';

  const text = `💰 *Trip Cost Estimate*

*${trip.destination}* (${trip.groupSize || 1} traveler${(trip.groupSize || 1) > 1 ? 's' : ''})

${costs.flights ? `✈️ Flights: ${currency} ${costs.flights.toLocaleString()}` : ''}
${costs.accommodation ? `🏨 Hotels: ${currency} ${costs.accommodation.toLocaleString()}` : ''}
${costs.activities ? `🎯 Activities: ${currency} ${costs.activities.toLocaleString()}` : ''}
${costs.food ? `🍽️ Food: ${currency} ${costs.food.toLocaleString()}` : ''}
${costs.transport ? `🚕 Transport: ${currency} ${costs.transport.toLocaleString()}` : ''}

*Total: ${currency} ${total.toLocaleString()}*

Your budget: ${currency} ${(trip.budget || 0).toLocaleString()}
${total <= trip.budget ? '✅ Within budget!' : '⚠️ Over budget by ' + currency + ' ' + (total - trip.budget).toLocaleString()}`;

  return {
    text,
    quickReplies: ['See breakdown', 'Reduce costs', 'Help'],
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export interface ConciergeHandlerDeps {
  openai: OpenAI;
  model?: string;
  lookupTripByPhone?: (phone: string) => Promise<any>;
  lookupTripById?: (id: number) => Promise<any>;
  lookupVisa?: (passport: string, destination: string) => Promise<any>;
  processChangeRequest?: (tripId: number, request: string) => Promise<any>;
}

/**
 * Main message handler - processes incoming WhatsApp message and returns response
 */
export async function handleIncomingMessage(
  message: WhatsAppMessage,
  deps: ConciergeHandlerDeps
): Promise<ConciergeResponse> {
  const { openai, model = 'deepseek-chat' } = deps;

  // Extract phone number (remove whatsapp: prefix)
  const phoneNumber = message.From.replace('whatsapp:', '');
  const messageText = message.Body?.trim() || '';

  if (!messageText) {
    return { text: RESPONSE_TEMPLATES.unknown };
  }

  console.log(`[Concierge] Message from ${phoneNumber}: ${messageText.substring(0, 100)}`);

  // Get conversation context
  const context = getConversationContext(phoneNumber);

  // Parse intent
  const parsed = await parseMessage(messageText, context, openai, model);
  console.log(`[Concierge] Parsed intent: ${parsed.intent} (${parsed.confidence})`);

  // Update context with intent
  updateConversationContext(phoneNumber, {
    lastIntent: parsed.intent,
    lastDestination: parsed.entities.destination || context.lastDestination,
    lastTripId: parsed.entities.tripId || context.lastTripId,
  });

  // Route to appropriate handler
  try {
    switch (parsed.intent) {
      case 'greeting':
        return handleGreeting(context);

      case 'help':
        return handleHelp();

      case 'trip_status':
      case 'trip_details': {
        if (!deps.lookupTripByPhone && !deps.lookupTripById) {
          return { text: RESPONSE_TEMPLATES.no_trips };
        }

        let trip = null;
        if (parsed.entities.tripId && deps.lookupTripById) {
          trip = await deps.lookupTripById(parsed.entities.tripId);
        } else if (deps.lookupTripByPhone) {
          trip = await deps.lookupTripByPhone(phoneNumber);
        }

        if (trip) {
          updateConversationContext(phoneNumber, {
            lastTripId: trip.id,
            lastDestination: trip.destination,
          });
        }

        return formatTripStatusResponse(trip);
      }

      case 'visa_question': {
        if (!deps.lookupVisa) {
          return {
            text: `For visa information, please visit voyageai.app and create a trip.`,
            quickReplies: ['Help', 'Plan a trip'],
          };
        }

        const destination = parsed.entities.destination || context.lastDestination;
        const passport = parsed.entities.passport || 'USA'; // Default, should be from user profile

        if (!destination) {
          return {
            text: `Which country would you like visa information for?`,
            quickReplies: ['Japan', 'France', 'Thailand', 'Help'],
          };
        }

        const visaInfo = await deps.lookupVisa(passport, destination);
        return formatVisaResponse(visaInfo, destination);
      }

      case 'cost_question': {
        if (!deps.lookupTripById && !deps.lookupTripByPhone) {
          return { text: RESPONSE_TEMPLATES.no_trips };
        }

        let trip = null;
        if (context.lastTripId && deps.lookupTripById) {
          trip = await deps.lookupTripById(context.lastTripId);
        } else if (deps.lookupTripByPhone) {
          trip = await deps.lookupTripByPhone(phoneNumber);
        }

        return formatCostResponse(trip);
      }

      case 'change_request': {
        if (!deps.processChangeRequest || !context.lastTripId) {
          return {
            text: `To modify a trip, I need to know which trip you're referring to. What's your trip destination?`,
            quickReplies: ['My trips', 'Help'],
          };
        }

        // Forward to change request handler (agentChat)
        const result = await deps.processChangeRequest(context.lastTripId, messageText);

        if (result?.success) {
          return {
            text: `✅ Got it! I've noted your request to modify the trip.\n\n${result.summary || 'Check voyageai.app for the updated itinerary.'}`,
            quickReplies: ['See changes', 'More changes', 'Done'],
          };
        } else {
          return {
            text: `I couldn't process that change. Please visit voyageai.app to modify your trip directly.`,
            quickReplies: ['Try again', 'Help'],
          };
        }
      }

      case 'general_question': {
        // For general questions, provide a helpful response and suggest using the app
        return {
          text: `That's a great question! For the most accurate and personalized answer, I recommend creating a trip on voyageai.app where I can analyze all the details for your specific situation.`,
          quickReplies: ['Plan a trip', 'Help'],
        };
      }

      default:
        return handleUnknown();
    }
  } catch (error) {
    console.error('[Concierge] Handler error:', error);
    return { text: RESPONSE_TEMPLATES.error };
  }
}

// ============================================================================
// SEND MESSAGE
// ============================================================================

/**
 * Send WhatsApp message via Twilio
 */
export async function sendWhatsAppMessage(
  to: string,
  response: ConciergeResponse
): Promise<boolean> {
  const client = getTwilioClient();

  if (!client) {
    console.error('[Concierge] Twilio client not available');
    return false;
  }

  try {
    // Ensure phone number has whatsapp: prefix
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

    await client.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: toNumber,
      body: response.text,
      ...(response.mediaUrl && { mediaUrl: [response.mediaUrl] }),
    });

    console.log(`[Concierge] Sent message to ${to}`);
    return true;
  } catch (error) {
    console.error('[Concierge] Failed to send message:', error);
    return false;
  }
}

// ============================================================================
// PROACTIVE NOTIFICATIONS (Placeholder for Phase 2)
// ============================================================================

/**
 * Send trip status update notification
 * Phase 2: Implement proactive notifications
 */
export async function sendTripStatusNotification(
  phoneNumber: string,
  trip: any,
  status: 'ready' | 'updated' | 'reminder'
): Promise<boolean> {
  const messages = {
    ready: `🎉 Great news! Your trip to ${trip.destination} is ready!\n\nCertainty Score: ${trip.certaintyScore}%\n\nView your full itinerary at voyageai.app/trips/${trip.id}`,
    updated: `📝 Your trip to ${trip.destination} has been updated.\n\nCheck the changes at voyageai.app/trips/${trip.id}`,
    reminder: `⏰ Reminder: Your trip to ${trip.destination} is coming up!\n\nMake sure to complete your action items.`,
  };

  return sendWhatsAppMessage(phoneNumber, { text: messages[status] });
}

/**
 * Send visa deadline reminder
 * Phase 2: Implement deadline tracking
 */
export async function sendVisaDeadlineReminder(
  phoneNumber: string,
  destination: string,
  deadlineDate: string
): Promise<boolean> {
  const text = `⚠️ Visa Deadline Reminder\n\nYour visa application for ${destination} should be submitted by ${deadlineDate}.\n\nDon't forget to apply on time!`;

  return sendWhatsAppMessage(phoneNumber, { text });
}
