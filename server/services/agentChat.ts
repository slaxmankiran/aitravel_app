/**
 * Agentic Chat Service
 * Intelligent assistant that remembers context and can update trips
 */

import OpenAI from 'openai';
import { storage } from '../storage';

// Initialize AI client
const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseURL: 'https://api.deepseek.com/v1',
});

// Chat session memory - stores conversation context per trip
interface ChatSession {
visaStatus: any;
  tripId: number;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  tripContext: TripContext;
  lastUpdated: Date;
}

interface TripContext {
  destination: string;
  origin?: string;
  dates: string;
  budget: number;
  currency: string;
  travelers: {
    adults: number;
    children: number;
    infants: number;
    total: number;
  };
  passport: string;
  itinerary: any;
  feasibilityReport: any;
  flights?: any[];
  hotels?: any[];
}

interface ChatAction {
  type: 'none' | 'add_activity' | 'remove_activity' | 'update_activity' | 'change_dates' | 'update_budget' | 'add_day' | 'remove_day' | 'reorder_days';
  data?: any;
}

interface ChatResponse {
  message: string;
  actions: ChatAction[];
  suggestions?: string[];
  updatedTrip?: any;
  pendingChanges?: PendingChanges;
}

interface PendingChanges {
  id: string;
  tripId: number;
  actions: ChatAction[];
  preview: {
    description: string;
    items: string[];
    estimatedCostChange: number;
  };
  createdAt: Date;
}

// Safe JSON parser for AI responses that may be malformed
function safeParseActionJson(text: string): any | null {
  if (!text || text.trim() === '') return null;

  try {
    return JSON.parse(text);
  } catch {
    // Try to repair common JSON issues from AI responses
    let repaired = text.trim();

    // Remove trailing comma before closing brackets
    repaired = repaired.replace(/,\s*\}/g, '}');
    repaired = repaired.replace(/,\s*\]/g, ']');

    // Fix missing quotes around property names
    repaired = repaired.replace(/(\{|,)\s*(\w+)\s*:/g, '$1"$2":');

    // Fix single quotes to double quotes
    repaired = repaired.replace(/'/g, '"');

    // Remove trailing incomplete content
    repaired = repaired.replace(/,\s*"[^"]*$/, ''); // incomplete property
    repaired = repaired.replace(/:\s*"[^"]*$/, ': ""'); // incomplete string value
    repaired = repaired.replace(/:\s*-?\d+\.?\d*$/, ': 0'); // incomplete number

    // Balance brackets
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/\]/g) || []).length;

    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';

    try {
      return JSON.parse(repaired);
    } catch {
      // Last resort: try to extract just the essential fields
      try {
        // For activity actions, try to extract key fields
        const dayMatch = text.match(/"dayNumber"\s*:\s*(\d+)/);
        const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
        const timeMatch = text.match(/"time"\s*:\s*"([^"]+)"/);
        const costMatch = text.match(/"cost"\s*:\s*(\d+)/);

        if (dayMatch && nameMatch) {
          return {
            dayNumber: parseInt(dayMatch[1]),
            activity: {
              name: nameMatch[1],
              time: timeMatch ? timeMatch[1] : "12:00",
              cost: costMatch ? parseInt(costMatch[1]) : 0,
              type: "activity",
              description: nameMatch[1]
            }
          };
        }
      } catch {}

      console.error('[AgentChat] JSON repair failed for:', text.substring(0, 200));
      return null;
    }
  }
}

// In-memory session storage (use Redis in production)
const chatSessions = new Map<number, ChatSession>();

// Pending changes cache - stores proposed changes awaiting user confirmation
const pendingChangesCache = new Map<string, PendingChanges>();

// Cached itinerary for fast updates
const itineraryCache = new Map<number, { itinerary: any; cachedAt: Date }>();

/**
 * Cache the current itinerary for a trip
 */
export function cacheItinerary(tripId: number, itinerary: any): void {
  itineraryCache.set(tripId, { itinerary: JSON.parse(JSON.stringify(itinerary)), cachedAt: new Date() });
}

/**
 * Get cached itinerary
 */
export function getCachedItinerary(tripId: number): any | null {
  const cached = itineraryCache.get(tripId);
  return cached?.itinerary || null;
}

/**
 * Get or create chat session for a trip
 */
export async function getOrCreateSession(tripId: number): Promise<ChatSession> {
  let session = chatSessions.get(tripId);

  if (!session) {
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      throw new Error('Trip not found');
    }

    session = {
      tripId,
      messages: [],
      tripContext: extractTripContext(trip),
      lastUpdated: new Date(),
      visaStatus: (trip.feasibilityReport as any)?.breakdown?.visa,
    };

    chatSessions.set(tripId, session);
  }

  return session;
}

/**
 * Extract context from trip for AI
 */
function extractTripContext(trip: any): TripContext {
  return {
    destination: trip.destination,
    origin: trip.origin,
    dates: trip.dates,
    budget: trip.budget,
    currency: trip.currency || 'USD',
    travelers: {
      adults: trip.adults || 1,
      children: trip.children || 0,
      infants: trip.infants || 0,
      total: trip.groupSize || 1,
    },
    passport: trip.passport,
    itinerary: trip.itinerary,
    feasibilityReport: trip.feasibilityReport,
    flights: trip.flights,
    hotels: trip.hotels,
  };
}

/**
 * Build system prompt with full trip context
 */
function buildSystemPrompt(context: TripContext): string {
  const currencySymbol = getCurrencySymbol(context.currency);

  // Calculate current itinerary costs for accurate budget tracking
  let totalItineraryCost = 0;
  let activitiesCount = 0;

  const itinerarySummary = context.itinerary?.days?.map((day: any, idx: number) => {
    const activities = day.activities?.map((a: any) => {
      const cost = a.cost || a.estimatedCost || 0;
      totalItineraryCost += cost;
      activitiesCount++;
      return `  - ${a.name} (${currencySymbol}${cost})`;
    }).join('\n') || '  (no activities)';
    return `Day ${idx + 1}: ${day.title}\n${activities}`;
  }).join('\n\n') || 'No itinerary yet';

  const budgetBreakdown = context.feasibilityReport?.breakdown?.budget;
  const costBreakdown = context.itinerary?.costBreakdown;

  // Use most accurate budget data available
  const estimatedTotal = costBreakdown?.grandTotal || budgetBreakdown?.estimatedCost || totalItineraryCost;
  const remainingBudget = context.budget - estimatedTotal;
  const budgetPercentUsed = Math.round((estimatedTotal / context.budget) * 100);

  return `You are VoyageAI, an intelligent travel planning assistant. You help users plan and modify their trips.

## CURRENT TRIP CONTEXT
- **Destination**: ${context.destination}
- **Origin**: ${context.origin || 'Not specified'}
- **Dates**: ${context.dates}
- **Total Budget**: ${currencySymbol}${context.budget.toLocaleString()} ${context.currency}
- **Travelers**: ${context.travelers.adults} adults${context.travelers.children > 0 ? `, ${context.travelers.children} children` : ''}${context.travelers.infants > 0 ? `, ${context.travelers.infants} infants` : ''} (${context.travelers.total} total)
- **Passport**: ${context.passport}

## CURRENT ITINERARY (${activitiesCount} activities)
${itinerarySummary}

## BUDGET BREAKDOWN (IMPORTANT - Track this carefully!)
- **Total Budget**: ${currencySymbol}${context.budget.toLocaleString()}
- **Current Estimated Spend**: ${currencySymbol}${estimatedTotal.toLocaleString()} (${budgetPercentUsed}% used)
- **Remaining Budget**: ${currencySymbol}${remainingBudget.toLocaleString()}
- **Status**: ${remainingBudget < 0 ? '⚠️ OVER BUDGET' : remainingBudget < context.budget * 0.1 ? '⚠️ Budget is tight' : '✅ Within budget'}
${costBreakdown ? `
Cost Categories:
- Activities: ${currencySymbol}${costBreakdown.activities?.total || 0}
- Accommodation: ${currencySymbol}${costBreakdown.accommodation?.total || 0}
- Flights/Transport: ${currencySymbol}${costBreakdown.flights?.total || 0}
- Food (estimated): ${currencySymbol}${costBreakdown.food?.total || 0}` : ''}

## YOUR CAPABILITIES
You can help users with:
1. **Suggest attractions** - Recommend nearby places, restaurants, activities
2. **Update itinerary** - Add, remove, or modify activities (ALWAYS include cost!)
3. **Adjust schedule** - Change activity order, swap days
4. **Budget advice** - Suggest cost-effective alternatives, show budget breakdown
5. **Local tips** - Provide insider knowledge about the destination
6. **Answer questions** - About visa, weather, culture, transportation

## CRITICAL: COST TRACKING
When adding ANY activity, you MUST include a realistic cost estimate:
- Free attractions: cost: 0
- Museum/attraction entries: ${currencySymbol}10-50 per person
- Tours/experiences: ${currencySymbol}30-150 per person
- Restaurant meals: ${currencySymbol}15-80 per person
- Transportation: ${currencySymbol}5-50

If user asks to "update budget breakdown" or check their spending, summarize the current costs and how changes will affect the budget.

## RESPONSE FORMAT
When the user asks you to make changes, respond with:
1. A friendly confirmation of what you'll do
2. The cost impact (e.g., "This will add ${currencySymbol}XX to your trip")
3. The specific changes in a structured format

When suggesting changes, use this format:
[ACTION: action_type]
{json_data}
[/ACTION]

Action types:
- ADD_ACTIVITY: {"dayNumber": 1, "activity": {"name": "...", "time": "10:00", "duration": "2 hours", "cost": 50, "type": "activity", "description": "...", "location": {"lat": 0, "lng": 0, "address": "..."}}}
- REMOVE_ACTIVITY: {"dayNumber": 1, "activityIndex": 0}
- UPDATE_ACTIVITY: {"dayNumber": 1, "activityIndex": 0, "updates": {...}}
- REORDER_ACTIVITIES: {"dayNumber": 1, "newOrder": [2, 0, 1]}
- UPDATE_DAY_TITLE: {"dayNumber": 1, "title": "New Title"}

IMPORTANT RULES:
1. ALL activities MUST have a "cost" field with a realistic ${context.currency} amount
2. Include "type": "activity" for attractions, "type": "meal" for food, "type": "transport" for travel
3. Always mention how changes affect the total budget
4. Currency is ${context.currency} (${currencySymbol}) - do not use other currencies

Be conversational and helpful while being precise about changes and costs.`;
}

/**
 * Parse AI response for actions
 */
function parseActions(response: string): { cleanMessage: string; actions: ChatAction[] } {
  const actions: ChatAction[] = [];
  let cleanMessage = response;

  // Track which parts of the response have been processed to avoid duplicates
  const processedRanges: Array<{ start: number; end: number }> = [];

  // Helper to check if a range overlaps with already processed ranges
  const isOverlapping = (start: number, end: number): boolean => {
    return processedRanges.some(range =>
      (start >= range.start && start < range.end) ||
      (end > range.start && end <= range.end) ||
      (start <= range.start && end >= range.end)
    );
  };

  // Helper to map action type string to ChatAction type
  const mapActionType = (actionType: string): ChatAction['type'] => {
    switch (actionType.toLowerCase()) {
      case 'add_activity': return 'add_activity';
      case 'remove_activity': return 'remove_activity';
      case 'update_activity': return 'update_activity';
      case 'reorder_activities': return 'reorder_days';
      case 'update_day_title': return 'update_activity';
      default: return 'none';
    }
  };

  // Helper to generate a unique key for an action to detect duplicates
  const getActionKey = (type: string, data: any): string => {
    if (type === 'add_activity' && data?.activity?.name) {
      return `add_${data.dayNumber}_${data.activity.name.toLowerCase().trim()}`;
    }
    if (type === 'remove_activity') {
      return `remove_${data?.dayNumber}_${data?.activityIndex}`;
    }
    return `${type}_${JSON.stringify(data)}`;
  };

  const seenActionKeys = new Set<string>();

  let match;

  // First try with closing tags: [ACTION: type]...[/ACTION]
  const actionRegexWithClose = /\[ACTION:\s*(\w+)\]\s*([\s\S]*?)\s*\[\/ACTION\]/gi;

  while ((match = actionRegexWithClose.exec(response)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    // Skip if this range was already processed
    if (isOverlapping(matchStart, matchEnd)) continue;

    const actionType = match[1];
    const actionDataStr = match[2].trim();

    const actionData = safeParseActionJson(actionDataStr);
    if (actionData) {
      const mappedType = mapActionType(actionType);
      if (mappedType !== 'none') {
        const actionKey = getActionKey(mappedType, actionData);

        // Skip if we've already seen this exact action
        if (!seenActionKeys.has(actionKey)) {
          seenActionKeys.add(actionKey);
          actions.push({ type: mappedType, data: actionData });
          processedRanges.push({ start: matchStart, end: matchEnd });
          cleanMessage = cleanMessage.replace(match[0], '');
          console.log(`[AgentChat] Parsed action (with close): ${actionType}`);
        } else {
          console.log(`[AgentChat] Skipping duplicate action: ${actionKey}`);
        }
      }
    } else {
      console.warn('[AgentChat] Could not parse action JSON (with close tag), skipping');
    }
  }

  // Also try without closing tags: [ACTION: TYPE]\n{json}
  const actionRegexNoClose = /\[ACTION:\s*(\w+)\]\s*\n\s*(\{[\s\S]*?\})/gi;

  while ((match = actionRegexNoClose.exec(response)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    // Skip if this range was already processed by the first regex
    if (isOverlapping(matchStart, matchEnd)) continue;

    const actionType = match[1];
    const actionDataStr = match[2].trim();

    const actionData = safeParseActionJson(actionDataStr);
    if (actionData) {
      const mappedType = mapActionType(actionType);
      if (mappedType !== 'none') {
        const actionKey = getActionKey(mappedType, actionData);

        // Skip if we've already seen this exact action
        if (!seenActionKeys.has(actionKey)) {
          seenActionKeys.add(actionKey);
          actions.push({ type: mappedType, data: actionData });
          processedRanges.push({ start: matchStart, end: matchEnd });
          cleanMessage = cleanMessage.replace(match[0], '').trim();
          console.log(`[AgentChat] Parsed action (no close): ${actionType}`);
        } else {
          console.log(`[AgentChat] Skipping duplicate action: ${actionKey}`);
        }
      }
    } else {
      console.warn('[AgentChat] Could not parse action data, skipping');
    }
  }

  console.log(`[AgentChat] Parsed ${actions.length} unique actions from response`);

  return { cleanMessage, actions };
}

/**
 * Deduplicate activities within an itinerary
 * Removes duplicate activities based on name similarity
 * Exported for use in cleanup endpoints
 */
export function deduplicateItinerary(itinerary: any): { itinerary: any; removedCount: number } {
  if (!itinerary?.days) return { itinerary, removedCount: 0 };

  let totalRemoved = 0;

  for (const day of itinerary.days) {
    if (!day.activities || !Array.isArray(day.activities)) continue;

    const seen = new Map<string, number>(); // name -> index of first occurrence
    const toKeep: number[] = [];

    day.activities.forEach((activity: any, index: number) => {
      const name = (activity.name || activity.description || '').toLowerCase().trim();

      // Skip if empty name
      if (!name) {
        toKeep.push(index);
        return;
      }

      // Check for exact match
      if (seen.has(name)) {
        console.log(`[AgentChat] Removing duplicate activity "${activity.name}" from Day ${day.day}`);
        totalRemoved++;
        return; // Skip this duplicate
      }

      // Check for similar names (one contains the other)
      let isDuplicate = false;
      for (const [existingName] of Array.from(seen.entries())) {
        if (existingName.includes(name) || name.includes(existingName)) {
          // Additional check: if times are similar, it's likely a duplicate
          const existingIdx = seen.get(existingName)!;
          const existingTime = day.activities[existingIdx]?.time || '';
          const currentTime = activity.time || '';

          if (existingTime === currentTime || !currentTime || !existingTime) {
            console.log(`[AgentChat] Removing similar duplicate "${activity.name}" (similar to existing) from Day ${day.day}`);
            totalRemoved++;
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        seen.set(name, index);
        toKeep.push(index);
      }
    });

    // Keep only non-duplicate activities
    day.activities = toKeep.map(idx => day.activities[idx]);
  }

  return { itinerary, removedCount: totalRemoved };
}

/**
 * Apply actions to update the trip
 */
async function applyActions(tripId: number, actions: ChatAction[], context: TripContext): Promise<any> {
  if (actions.length === 0) return null;

  let itinerary = JSON.parse(JSON.stringify(context.itinerary || { days: [] }));
  let totalCostChange = 0;

  // First, deduplicate any existing duplicates in the itinerary
  const { itinerary: cleanedItinerary, removedCount } = deduplicateItinerary(itinerary);
  itinerary = cleanedItinerary;
  if (removedCount > 0) {
    console.log(`[AgentChat] Cleaned up ${removedCount} existing duplicate(s) before applying new actions`);
  }

  for (const action of actions) {
    switch (action.type) {
      case 'add_activity': {
        const { dayNumber, activity } = action.data;
        const dayIndex = dayNumber - 1;

        if (itinerary.days[dayIndex]) {
          if (!itinerary.days[dayIndex].activities) {
            itinerary.days[dayIndex].activities = [];
          }

          // Check for duplicate activity - compare by name (case-insensitive) and time
          const activityName = (activity.name || activity.description || '').toLowerCase().trim();
          const activityTime = activity.time || '';

          const isDuplicate = itinerary.days[dayIndex].activities.some((existing: any) => {
            const existingName = (existing.name || existing.description || '').toLowerCase().trim();
            const existingTime = existing.time || '';

            // Consider duplicate if same name OR (same name prefix and same time)
            if (existingName === activityName) return true;
            if (activityTime && existingTime === activityTime &&
                (existingName.includes(activityName) || activityName.includes(existingName))) {
              return true;
            }
            return false;
          });

          if (isDuplicate) {
            console.log(`[AgentChat] Skipping duplicate activity "${activity.name}" in Day ${dayNumber}`);
          } else {
            // Generate unique ID for activity
            activity.id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            itinerary.days[dayIndex].activities.push(activity);
            totalCostChange += activity.cost || 0;

            console.log(`[AgentChat] Added activity "${activity.name}" to Day ${dayNumber}`);
          }
        }
        break;
      }

      case 'remove_activity': {
        const { dayNumber, activityIndex } = action.data;
        const dayIndex = dayNumber - 1;

        if (itinerary.days[dayIndex]?.activities?.[activityIndex]) {
          const removed = itinerary.days[dayIndex].activities.splice(activityIndex, 1)[0];
          totalCostChange -= removed.cost || 0;

          console.log(`[AgentChat] Removed activity from Day ${dayNumber}`);
        }
        break;
      }

      case 'update_activity': {
        const { dayNumber, activityIndex, updates, title } = action.data;
        const dayIndex = dayNumber - 1;

        // Update day title
        if (title && itinerary.days[dayIndex]) {
          itinerary.days[dayIndex].title = title;
          console.log(`[AgentChat] Updated Day ${dayNumber} title to "${title}"`);
        }

        // Update specific activity
        if (activityIndex !== undefined && itinerary.days[dayIndex]?.activities?.[activityIndex]) {
          const oldCost = itinerary.days[dayIndex].activities[activityIndex].cost || 0;
          Object.assign(itinerary.days[dayIndex].activities[activityIndex], updates);
          const newCost = itinerary.days[dayIndex].activities[activityIndex].cost || 0;
          totalCostChange += (newCost - oldCost);

          console.log(`[AgentChat] Updated activity in Day ${dayNumber}`);
        }
        break;
      }

      case 'reorder_days': {
        const { dayNumber, newOrder } = action.data;
        const dayIndex = dayNumber - 1;

        if (itinerary.days[dayIndex]?.activities && newOrder) {
          const activities = itinerary.days[dayIndex].activities;
          const reordered = newOrder.map((idx: number) => activities[idx]).filter(Boolean);
          itinerary.days[dayIndex].activities = reordered;

          console.log(`[AgentChat] Reordered activities in Day ${dayNumber}`);
        }
        break;
      }
    }
  }

  // Save updated itinerary
  await storage.updateTripItinerary(tripId, itinerary);

  // Recalculate total costs
  const totalItineraryCost = calculateItineraryCost(itinerary);

  return {
    itinerary,
    costChange: totalCostChange,
    totalItineraryCost,
  };
}

/**
 * Calculate total itinerary cost
 */
function calculateItineraryCost(itinerary: any): number {
  if (!itinerary?.days) return 0;

  return itinerary.days.reduce((total: number, day: any) => {
    const dayCost = day.activities?.reduce((dayTotal: number, activity: any) => {
      return dayTotal + (activity.cost || 0);
    }, 0) || 0;
    return total + dayCost;
  }, 0);
}

/**
 * Main chat function - process user message
 * Does NOT auto-apply changes - proposes them for user confirmation
 */
export async function processChat(
  tripId: number,
  userMessage: string
): Promise<ChatResponse> {
  try {
    // Get session with context
    const session = await getOrCreateSession(tripId);

    // Refresh trip context and cache itinerary
    const trip = await storage.getTrip(tripId);
    if (trip) {
      session.tripContext = extractTripContext(trip);
      cacheItinerary(tripId, trip.itinerary);
    }

    // Build messages for AI
    const systemPrompt = buildSystemPrompt(session.tripContext);

    // Keep more message history for better context retention (20 messages = ~10 exchanges)
    // The system prompt already contains full trip context, so we don't need unlimited history
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...session.messages.slice(-20), // Keep last 20 messages for better context
      { role: 'user', content: userMessage },
    ];

    // Call AI
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const aiResponse = completion.choices[0]?.message?.content || '';

    // Parse response for actions
    const { cleanMessage, actions } = parseActions(aiResponse);

    // DON'T auto-apply - create pending changes for user confirmation
    let pendingChanges: PendingChanges | undefined;
    if (actions.length > 0) {
      const changeId = `change_${tripId}_${Date.now()}`;
      const preview = generateChangePreview(actions, session.tripContext);

      pendingChanges = {
        id: changeId,
        tripId,
        actions,
        preview,
        createdAt: new Date(),
      };

      // Store pending changes
      pendingChangesCache.set(changeId, pendingChanges);

      console.log(`[AgentChat] Created pending changes ${changeId} with ${actions.length} action(s)`);
    }

    // Save to conversation history
    session.messages.push({ role: 'user', content: userMessage });
    session.messages.push({ role: 'assistant', content: cleanMessage });
    session.lastUpdated = new Date();

    // Generate quick suggestions based on context
    const suggestions = generateSuggestions(session.tripContext, userMessage);

    return {
      message: cleanMessage,
      actions,
      suggestions,
      pendingChanges,
    };
  } catch (error) {
    console.error('[AgentChat] Error:', error);

    // Return fallback response
    return generateFallbackResponse(tripId, userMessage);
  }
}

/**
 * Generate human-readable preview of proposed changes
 */
function generateChangePreview(actions: ChatAction[], context: TripContext): PendingChanges['preview'] {
  const items: string[] = [];
  let costChange = 0;
  const currencySymbol = getCurrencySymbol(context.currency);

  for (const action of actions) {
    switch (action.type) {
      case 'add_activity':
        const activity = action.data?.activity;
        if (activity) {
          items.push(`Add "${activity.name}" to Day ${action.data.dayNumber} at ${activity.time || 'TBD'}`);
          costChange += activity.cost || 0;
        }
        break;
      case 'remove_activity':
        items.push(`Remove activity from Day ${action.data?.dayNumber}`);
        break;
      case 'update_activity':
        items.push(`Update activity in Day ${action.data?.dayNumber}`);
        break;
      case 'reorder_days':
        items.push(`Reorder activities in Day ${action.data?.dayNumber}`);
        break;
    }
  }

  return {
    description: items.length === 1 ? items[0] : `${items.length} changes to your itinerary`,
    items,
    estimatedCostChange: costChange,
  };
}

/**
 * Apply pending changes after user confirmation
 */
export async function applyPendingChanges(changeId: string): Promise<{ success: boolean; updatedTrip?: any; error?: string }> {
  const pending = pendingChangesCache.get(changeId);

  if (!pending) {
    return { success: false, error: 'Changes expired or not found. Please try again.' };
  }

  try {
    const session = await getOrCreateSession(pending.tripId);
    const updatedTrip = await applyActions(pending.tripId, pending.actions, session.tripContext);

    // Update session context with new itinerary
    if (updatedTrip?.itinerary) {
      session.tripContext.itinerary = updatedTrip.itinerary;
      cacheItinerary(pending.tripId, updatedTrip.itinerary);
    }

    // Remove from pending cache
    pendingChangesCache.delete(changeId);

    console.log(`[AgentChat] Applied pending changes ${changeId}`);

    return { success: true, updatedTrip };
  } catch (error) {
    console.error('[AgentChat] Error applying changes:', error);
    return { success: false, error: 'Failed to apply changes' };
  }
}

/**
 * Reject/cancel pending changes
 */
export function rejectPendingChanges(changeId: string): void {
  pendingChangesCache.delete(changeId);
  console.log(`[AgentChat] Rejected pending changes ${changeId}`);
}

/**
 * Get pending changes by ID
 */
export function getPendingChanges(changeId: string): PendingChanges | undefined {
  return pendingChangesCache.get(changeId);
}

/**
 * Generate contextual quick suggestions
 */
function generateSuggestions(context: TripContext, lastMessage: string): string[] {
  const suggestions: string[] = [];
  const destination = context.destination.toLowerCase();

  // Check what user might want next
  if (lastMessage.toLowerCase().includes('restaurant') || lastMessage.toLowerCase().includes('food')) {
    suggestions.push('Show me breakfast spots');
    suggestions.push('Find a romantic dinner place');
    suggestions.push('Local street food recommendations');
  } else if (lastMessage.toLowerCase().includes('activity') || lastMessage.toLowerCase().includes('attraction')) {
    suggestions.push('What are free activities nearby?');
    suggestions.push('Family-friendly attractions');
    suggestions.push('Hidden gems locals love');
  } else {
    // Default suggestions based on destination
    suggestions.push(`Best restaurants in ${context.destination}`);
    suggestions.push('Add a museum visit');
    suggestions.push('What should I pack?');
    suggestions.push('Update my budget breakdown');
  }

  return suggestions.slice(0, 4);
}

/**
 * Fallback response when AI fails
 */
async function generateFallbackResponse(tripId: number, userMessage: string): Promise<ChatResponse> {
  const session = await getOrCreateSession(tripId);
  const context = session.tripContext;
  const currencySymbol = getCurrencySymbol(context.currency);
  const lowerMessage = userMessage.toLowerCase();

  let message = '';
  const actions: ChatAction[] = [];
  const suggestions: string[] = [];

  // Intent detection
  if (lowerMessage.includes('restaurant') || lowerMessage.includes('food') || lowerMessage.includes('eat')) {
    message = `I'd recommend checking out local restaurants in ${context.destination}! Based on your budget of ${currencySymbol}${context.budget} for ${context.travelers.total} travelers, here are some options:\n\n`;
    message += `1. **Local Street Food** - Budget-friendly, authentic experience (~${currencySymbol}15-25/person)\n`;
    message += `2. **Mid-range Restaurant** - Good atmosphere (~${currencySymbol}40-60/person)\n`;
    message += `3. **Fine Dining** - Special occasion (~${currencySymbol}100+/person)\n\n`;
    message += `Would you like me to add any of these to your itinerary?`;

    suggestions.push('Add a street food tour to Day 1');
    suggestions.push('Find restaurants near my hotel');
    suggestions.push('Vegetarian options');
  } else if (lowerMessage.includes('attraction') || lowerMessage.includes('visit') || lowerMessage.includes('see')) {
    message = `${context.destination} has amazing attractions! Here are some must-sees:\n\n`;
    message += `Based on your ${context.dates} trip, I recommend:\n`;
    message += `• Morning activities (museums, temples, markets)\n`;
    message += `• Afternoon experiences (tours, neighborhoods)\n`;
    message += `• Evening entertainment (shows, night markets)\n\n`;
    message += `Want me to add any specific attractions to your itinerary?`;

    suggestions.push('Add popular tourist spots');
    suggestions.push('Off-the-beaten-path attractions');
    suggestions.push('What\'s free to visit?');
  } else if (lowerMessage.includes('budget') || lowerMessage.includes('cost') || lowerMessage.includes('money')) {
    const itineraryCost = calculateItineraryCost(context.itinerary);
    message = `💰 **Budget Overview for ${context.destination}**\n\n`;
    message += `• Total Budget: ${currencySymbol}${context.budget}\n`;
    message += `• Itinerary Activities: ${currencySymbol}${itineraryCost}\n`;
    message += `• Travelers: ${context.travelers.total}\n`;
    message += `• Per Person: ${currencySymbol}${Math.round(context.budget / context.travelers.total)}\n\n`;
    message += `Would you like suggestions for saving money or upgrading experiences?`;

    suggestions.push('Find cheaper alternatives');
    suggestions.push('Where can I splurge?');
    suggestions.push('Show daily cost breakdown');
  } else if (lowerMessage.includes('weather') || lowerMessage.includes('pack')) {
    message = `For ${context.destination} during your ${context.dates} trip:\n\n`;
    message += `I recommend packing:\n`;
    message += `• Comfortable walking shoes\n`;
    message += `• Weather-appropriate layers\n`;
    message += `• Travel documents\n`;
    message += `• Universal power adapter\n\n`;
    message += `Would you like a complete packing list?`;

    suggestions.push('Generate full packing list');
    suggestions.push('What\'s the weather forecast?');
  } else if (lowerMessage.includes('change') || lowerMessage.includes('update') || lowerMessage.includes('modify')) {
    message = `I can help you modify your trip! Just tell me what you'd like to change:\n\n`;
    message += `• "Add [activity] to Day X"\n`;
    message += `• "Remove [activity] from Day X"\n`;
    message += `• "Change Day X title to [new title]"\n`;
    message += `• "Swap Day 2 and Day 3 activities"\n\n`;
    message += `What would you like to update?`;

    suggestions.push('Add more activities');
    suggestions.push('Reorganize my schedule');
    suggestions.push('Extend my trip by a day');
  } else {
    message = `I'm here to help plan your ${context.dates} trip to ${context.destination}! 🌍\n\n`;
    message += `Quick info:\n`;
    message += `• Budget: ${currencySymbol}${context.budget}\n`;
    message += `• Travelers: ${context.travelers.total}\n`;
    message += `• Days planned: ${context.itinerary?.days?.length || 0}\n\n`;
    message += `What would you like help with?`;

    suggestions.push(`Top things to do in ${context.destination}`);
    suggestions.push('Restaurant recommendations');
    suggestions.push('Update my itinerary');
    suggestions.push('Budget breakdown');
  }

  return {
    message,
    actions,
    suggestions,
  };
}

/**
 * Get chat history for a trip
 */
export async function getChatHistory(tripId: number): Promise<Array<{ role: string; content: string; timestamp?: Date }>> {
  const session = chatSessions.get(tripId);
  if (!session) {
    return [];
  }

  return session.messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Clear chat history for a trip
 */
export function clearChatHistory(tripId: number): void {
  chatSessions.delete(tripId);
}

/**
 * Get currency symbol - supports all 28 currencies
 */
function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', AUD: 'A$', CAD: 'C$',
    CHF: 'CHF', KRW: '₩', SGD: 'S$', HKD: 'HK$', NZD: 'NZ$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
    MXN: '$', BRL: 'R$', AED: 'د.إ', SAR: '﷼', THB: '฿', MYR: 'RM', IDR: 'Rp', PHP: '₱',
    ZAR: 'R', TRY: '₺', RUB: '₽', PLN: 'zł', CZK: 'Kč', HUF: 'Ft'
  };
  return symbols[currency] || currency + ' ';
}

/**
 * Get nearby attractions for a location
 */
export function getNearbyAttractions(destination: string, category?: string): any[] {
  // This would connect to a real API in production
  // For now, return curated suggestions based on destination
  const attractions: Record<string, any[]> = {
    'tokyo': [
      { name: 'Senso-ji Temple', category: 'temple', cost: 0, lat: 35.7148, lng: 139.7967 },
      { name: 'teamLab Borderless', category: 'museum', cost: 30, lat: 35.6264, lng: 139.7839 },
      { name: 'Tsukiji Outer Market', category: 'food', cost: 20, lat: 35.6654, lng: 139.7707 },
      { name: 'Shibuya Crossing', category: 'landmark', cost: 0, lat: 35.6595, lng: 139.7004 },
    ],
    'paris': [
      { name: 'Eiffel Tower', category: 'landmark', cost: 25, lat: 48.8584, lng: 2.2945 },
      { name: 'Louvre Museum', category: 'museum', cost: 17, lat: 48.8606, lng: 2.3376 },
      { name: 'Montmartre', category: 'neighborhood', cost: 0, lat: 48.8867, lng: 2.3431 },
      { name: 'Seine River Cruise', category: 'tour', cost: 15, lat: 48.8566, lng: 2.3522 },
    ],
    'bali': [
      { name: 'Tegallalang Rice Terraces', category: 'nature', cost: 5, lat: -8.4312, lng: 115.2792 },
      { name: 'Uluwatu Temple', category: 'temple', cost: 10, lat: -8.8291, lng: 115.0849 },
      { name: 'Ubud Monkey Forest', category: 'nature', cost: 8, lat: -8.5185, lng: 115.2588 },
      { name: 'Seminyak Beach', category: 'beach', cost: 0, lat: -8.6913, lng: 115.1576 },
    ],
  };

  const destKey = destination.toLowerCase().split(',')[0].trim();
  let results = attractions[destKey] || [];

  if (category) {
    results = results.filter(a => a.category === category);
  }

  return results;
}
