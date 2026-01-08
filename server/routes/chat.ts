/**
 * Agentic Chat Routes
 * Intelligent assistant that remembers context and can modify trips
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import {
  processChat,
  getChatHistory,
  clearChatHistory,
  getOrCreateSession,
  getNearbyAttractions,
  applyPendingChanges,
  rejectPendingChanges,
  getPendingChanges,
  getCachedItinerary,
  deduplicateItinerary,
} from '../services/agentChat';

const router = Router();

// Validation schemas
const chatMessageSchema = z.object({
  message: z.string().min(1).max(2000),
});

/**
 * POST /api/trips/:id/chat
 * Send a message to the trip assistant
 * Returns proposed changes for user confirmation (does NOT auto-apply)
 */
router.post('/:id/chat', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const { message } = chatMessageSchema.parse(req.body);

    // Verify trip exists
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    console.log(`[Chat] Processing message for trip ${tripId}: "${message.substring(0, 50)}..."`);

    // Process chat with agentic AI (does NOT auto-apply changes)
    const response = await processChat(tripId, message);

    // Return response with pending changes for user confirmation
    res.json({
      success: true,
      response: {
        message: response.message,
        suggestions: response.suggestions,
        hasProposedChanges: !!response.pendingChanges,
      },
      // Pending changes require user confirmation
      pendingChanges: response.pendingChanges ? {
        id: response.pendingChanges.id,
        preview: response.pendingChanges.preview,
      } : null,
    });
  } catch (err: any) {
    console.error('[Chat] Error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * POST /api/trips/:id/chat/confirm
 * Confirm and apply pending changes
 */
router.post('/:id/chat/confirm', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const { changeId } = req.body;

    if (!changeId) {
      return res.status(400).json({ error: 'changeId is required' });
    }

    // Verify the pending change belongs to this trip
    const pending = getPendingChanges(changeId);
    if (!pending || pending.tripId !== tripId) {
      return res.status(404).json({ error: 'Pending changes not found or expired' });
    }

    console.log(`[Chat] Applying confirmed changes ${changeId} for trip ${tripId}`);

    // Apply the changes
    const result = await applyPendingChanges(changeId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Fetch fresh trip data
    const freshTrip = await storage.getTrip(tripId);

    // Recalculate budget breakdown from updated itinerary
    const budgetBreakdown = calculateBudgetBreakdown(freshTrip);

    // Build updated costBreakdown that merges original estimates with recalculated activity costs
    let updatedItinerary = freshTrip?.itinerary;

    if (freshTrip?.itinerary && budgetBreakdown) {
      const originalCostBreakdown = (freshTrip.itinerary as any).costBreakdown || {};

      // Recalculate grand total: flights + accommodation (from original) + activities/food/transport (from itinerary)
      const flightsTotal = originalCostBreakdown.flights?.total || 0;
      const accommodationTotal = originalCostBreakdown.accommodation?.total || 0;
      const activitiesTotal = budgetBreakdown.breakdown?.activities?.amount || 0;
      const foodTotal = budgetBreakdown.breakdown?.food?.amount || 0;
      const transportTotal = budgetBreakdown.breakdown?.transport?.amount || 0;
      const miscTotal = originalCostBreakdown.misc?.total || 0;

      const newGrandTotal = flightsTotal + accommodationTotal + activitiesTotal + foodTotal + transportTotal + miscTotal;

      updatedItinerary = {
        ...freshTrip.itinerary,
        costBreakdown: {
          ...originalCostBreakdown,
          // Update categories with recalculated amounts
          activities: {
            ...originalCostBreakdown.activities,
            total: activitiesTotal,
          },
          food: {
            ...originalCostBreakdown.food,
            total: foodTotal,
            perDay: Math.round(foodTotal / (freshTrip.itinerary as any).days?.length || 7),
          },
          localTransport: {
            ...originalCostBreakdown.localTransport,
            total: Math.round(transportTotal * 0.3),
          },
          intercityTransport: {
            ...originalCostBreakdown.intercityTransport,
            total: Math.round(transportTotal * 0.7),
          },
          grandTotal: newGrandTotal,
          perPerson: Math.round(newGrandTotal / (freshTrip.groupSize || 1)),
          budgetStatus: newGrandTotal <= freshTrip.budget ? 'within_budget' :
                        newGrandTotal <= freshTrip.budget * 1.1 ? 'tight' : 'over_budget',
        },
      };

      // Save the updated itinerary with new costBreakdown
      await storage.updateTripItinerary(tripId, updatedItinerary);

      console.log(`[Chat] Updated costBreakdown: grandTotal=${newGrandTotal}, activities=${activitiesTotal}, food=${foodTotal}`);
    }

    res.json({
      success: true,
      message: 'Changes applied successfully!',
      updatedData: {
        itinerary: updatedItinerary,
        budgetBreakdown,
        mapMarkers: extractMapMarkers(updatedItinerary),
      },
    });
  } catch (err) {
    console.error('[Chat] Confirm error:', err);
    res.status(500).json({ error: 'Failed to apply changes' });
  }
});

/**
 * POST /api/trips/:id/chat/reject
 * Reject/cancel pending changes
 */
router.post('/:id/chat/reject', async (req: Request, res: Response) => {
  try {
    const { changeId } = req.body;

    if (changeId) {
      rejectPendingChanges(changeId);
    }

    res.json({ success: true, message: 'Changes cancelled' });
  } catch (err) {
    console.error('[Chat] Reject error:', err);
    res.status(500).json({ error: 'Failed to cancel changes' });
  }
});

/**
 * GET /api/trips/:id/chat
 * Get chat history for a trip
 */
router.get('/:id/chat', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);

    // Verify trip exists
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const messages = await getChatHistory(tripId);

    res.json({
      messages,
      tripContext: {
        destination: trip.destination,
        dates: trip.dates,
        budget: trip.budget,
        currency: trip.currency,
        travelers: trip.groupSize,
      },
    });
  } catch (err) {
    console.error('[Chat] Get history error:', err);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

/**
 * DELETE /api/trips/:id/chat
 * Clear chat history for a trip
 */
router.delete('/:id/chat', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);

    clearChatHistory(tripId);

    res.json({ success: true });
  } catch (err) {
    console.error('[Chat] Clear history error:', err);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
});

/**
 * GET /api/trips/:id/chat/suggestions
 * Get contextual suggestions for quick actions
 */
router.get('/:id/chat/suggestions', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);

    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Generate contextual suggestions
    const suggestions = generateContextualSuggestions(trip);

    res.json({ suggestions });
  } catch (err) {
    console.error('[Chat] Suggestions error:', err);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

/**
 * GET /api/trips/:id/nearby
 * Get nearby attractions for a trip destination
 */
router.get('/:id/nearby', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const category = req.query.category as string | undefined;

    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const attractions = getNearbyAttractions(trip.destination, category);

    // Add currency-adjusted costs
    const currencyMultiplier = getCurrencyMultiplier(trip.currency || 'USD');
    const attractionsWithCurrency = attractions.map(a => ({
      ...a,
      cost: Math.round(a.cost * currencyMultiplier),
      currency: trip.currency || 'USD',
    }));

    res.json({
      destination: trip.destination,
      attractions: attractionsWithCurrency,
    });
  } catch (err) {
    console.error('[Chat] Nearby error:', err);
    res.status(500).json({ error: 'Failed to get nearby attractions' });
  }
});

/**
 * POST /api/trips/:id/chat/quick-action
 * Execute a quick action (add activity, etc.)
 */
router.post('/:id/chat/quick-action', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);
    const { action, data } = req.body;

    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    let updatedItinerary = JSON.parse(JSON.stringify(trip.itinerary || { days: [] }));
    let message = '';

    switch (action) {
      case 'add_activity': {
        const { dayNumber, activity } = data;
        const dayIndex = dayNumber - 1;

        if (!updatedItinerary.days[dayIndex]) {
          return res.status(400).json({ error: 'Invalid day number' });
        }

        if (!updatedItinerary.days[dayIndex].activities) {
          updatedItinerary.days[dayIndex].activities = [];
        }

        activity.id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        updatedItinerary.days[dayIndex].activities.push(activity);
        message = `Added "${activity.name}" to Day ${dayNumber}`;
        break;
      }

      case 'remove_activity': {
        const { dayNumber, activityIndex } = data;
        const dayIndex = dayNumber - 1;

        if (!updatedItinerary.days[dayIndex]?.activities?.[activityIndex]) {
          return res.status(400).json({ error: 'Activity not found' });
        }

        const removed = updatedItinerary.days[dayIndex].activities.splice(activityIndex, 1)[0];
        message = `Removed "${removed.name}" from Day ${dayNumber}`;
        break;
      }

      case 'reorder_activities': {
        const { dayNumber, fromIndex, toIndex } = data;
        const dayIndex = dayNumber - 1;

        if (!updatedItinerary.days[dayIndex]?.activities) {
          return res.status(400).json({ error: 'Day has no activities' });
        }

        const activities = updatedItinerary.days[dayIndex].activities;
        const [removed] = activities.splice(fromIndex, 1);
        activities.splice(toIndex, 0, removed);
        message = `Reordered activities in Day ${dayNumber}`;
        break;
      }

      case 'update_activity': {
        const { dayNumber, activityIndex, updates } = data;
        const dayIndex = dayNumber - 1;

        if (!updatedItinerary.days[dayIndex]?.activities?.[activityIndex]) {
          return res.status(400).json({ error: 'Activity not found' });
        }

        Object.assign(updatedItinerary.days[dayIndex].activities[activityIndex], updates);
        message = `Updated activity in Day ${dayNumber}`;
        break;
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }

    // Save updated itinerary
    await storage.updateTripItinerary(tripId, updatedItinerary);

    // Calculate new budget breakdown
    const budgetBreakdown = calculateBudgetBreakdown({
      ...trip,
      itinerary: updatedItinerary,
    });

    // Extract map markers
    const mapMarkers = extractMapMarkers(updatedItinerary);

    res.json({
      success: true,
      message,
      updatedData: {
        itinerary: updatedItinerary,
        budgetBreakdown,
        mapMarkers,
      },
    });
  } catch (err) {
    console.error('[Chat] Quick action error:', err);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

/**
 * GET /api/trips/:id/budget-breakdown
 * Get detailed budget breakdown
 */
router.get('/:id/budget-breakdown', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);

    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const breakdown = calculateBudgetBreakdown(trip);

    res.json({ breakdown });
  } catch (err) {
    console.error('[Chat] Budget breakdown error:', err);
    res.status(500).json({ error: 'Failed to get budget breakdown' });
  }
});

/**
 * POST /api/trips/:id/cleanup-duplicates
 * Remove duplicate activities from the trip itinerary
 */
router.post('/:id/cleanup-duplicates', async (req: Request, res: Response) => {
  try {
    const tripId = parseInt(req.params.id);

    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (!trip.itinerary) {
      return res.json({ success: true, removedCount: 0, message: 'No itinerary to clean' });
    }

    // Deduplicate the itinerary
    const { itinerary: cleanedItinerary, removedCount } = deduplicateItinerary(trip.itinerary);

    if (removedCount > 0) {
      // Save the cleaned itinerary
      await storage.updateTripItinerary(tripId, cleanedItinerary);
      console.log(`[Chat] Cleaned up ${removedCount} duplicate(s) from trip ${tripId}`);
    }

    res.json({
      success: true,
      removedCount,
      message: removedCount > 0
        ? `Removed ${removedCount} duplicate activit${removedCount === 1 ? 'y' : 'ies'}`
        : 'No duplicates found',
      updatedItinerary: cleanedItinerary,
    });
  } catch (err) {
    console.error('[Chat] Cleanup duplicates error:', err);
    res.status(500).json({ error: 'Failed to cleanup duplicates' });
  }
});

// Helper functions

function generateContextualSuggestions(trip: any): string[] {
  const suggestions: string[] = [];
  const destination = trip.destination?.toLowerCase() || '';
  const hasItinerary = trip.itinerary?.days?.length > 0;
  const dayCount = trip.itinerary?.days?.length || 0;

  if (!hasItinerary) {
    suggestions.push('Generate an itinerary for me');
    suggestions.push(`What are must-see places in ${trip.destination}?`);
  } else {
    // Check for empty days
    const emptyDays = trip.itinerary.days.filter((d: any) => !d.activities?.length);
    if (emptyDays.length > 0) {
      suggestions.push(`Add activities to Day ${emptyDays[0].dayNumber || 1}`);
    }

    suggestions.push('Show me nearby restaurants');
    suggestions.push('Add a cultural experience');
    suggestions.push('Find free activities');
  }

  suggestions.push(`What's the weather like in ${trip.destination}?`);
  suggestions.push('Update my budget breakdown');

  return suggestions.slice(0, 5);
}

function calculateBudgetBreakdown(trip: any): any {
  if (!trip) return null;

  const currency = trip.currency || 'USD';
  const symbol = getCurrencySymbol(currency);

  let activitiesCost = 0;
  let accommodationCost = 0;
  let transportCost = 0;
  let foodCost = 0;

  // Calculate from itinerary activities
  if (trip.itinerary?.days) {
    for (const day of trip.itinerary.days) {
      for (const activity of day.activities || []) {
        // Use cost OR estimatedCost (activities may have either)
        const cost = activity.cost ?? activity.estimatedCost ?? 0;
        const category = (activity.category || activity.type || '').toLowerCase();

        // Match activity types: meal, lodging, transport, activity
        if (category === 'meal' || category.includes('food') || category.includes('restaurant') || category.includes('dining')) {
          foodCost += cost;
        } else if (category === 'lodging' || category.includes('hotel') || category.includes('accommodation') || category.includes('stay')) {
          accommodationCost += cost;
        } else if (category === 'transport' || category.includes('flight') || category.includes('taxi') || category.includes('transfer')) {
          transportCost += cost;
        } else {
          // Default to activities (includes 'activity' type)
          activitiesCost += cost;
        }
      }
    }
  }

  // Add hotel costs if available
  if (trip.hotels?.length > 0) {
    accommodationCost += trip.hotels.reduce((sum: number, h: any) => sum + (h.totalPrice || 0), 0);
  }

  // Add flight costs if available
  if (trip.flights?.length > 0) {
    transportCost += trip.flights.reduce((sum: number, f: any) => sum + (f.price || 0), 0);
  }

  // Estimate food if not in itinerary
  const days = trip.itinerary?.days?.length || 7;
  const travelers = trip.groupSize || 1;
  if (foodCost === 0) {
    // Estimate based on destination cost of living
    const dailyFoodEstimate = estimateDailyFoodCost(trip.destination, currency);
    foodCost = days * travelers * dailyFoodEstimate;
  }

  const totalSpent = activitiesCost + accommodationCost + transportCost + foodCost;
  const remaining = trip.budget - totalSpent;

  return {
    currency,
    symbol,
    currencySymbol: symbol, // Alias for frontend compatibility
    budget: trip.budget,
    breakdown: {
      activities: { amount: Math.round(activitiesCost), label: 'Activities & Attractions', icon: 'ticket' },
      accommodation: { amount: Math.round(accommodationCost), label: 'Accommodation', icon: 'hotel' },
      transport: { amount: Math.round(transportCost), label: 'Transportation', icon: 'plane' },
      food: { amount: Math.round(foodCost), label: 'Food & Dining', icon: 'utensils' },
    },
    totalSpent: Math.round(totalSpent),
    grandTotal: Math.round(totalSpent), // Alias for frontend compatibility
    remaining: Math.round(remaining),
    percentUsed: Math.min(100, Math.round((totalSpent / trip.budget) * 100)),
    perPerson: Math.round(totalSpent / travelers),
    perDay: Math.round(totalSpent / Math.max(days, 1)),
    isOverBudget: remaining < 0,
    budgetStatus: remaining < 0 ? 'over_budget' : remaining < trip.budget * 0.1 ? 'tight' : 'within_budget',
  };
}

function extractMapMarkers(itinerary: any): any[] {
  const markers: any[] = [];

  if (!itinerary?.days) return markers;

  let markerIndex = 0;
  for (const day of itinerary.days) {
    for (const activity of day.activities || []) {
      let lat, lng;

      if (activity.location?.lat && activity.location?.lng) {
        lat = activity.location.lat;
        lng = activity.location.lng;
      } else if (activity.coordinates?.lat && activity.coordinates?.lng) {
        lat = activity.coordinates.lat;
        lng = activity.coordinates.lng;
      } else if (activity.lat && activity.lng) {
        lat = activity.lat;
        lng = activity.lng;
      }

      if (lat && lng) {
        markers.push({
          id: activity.id || `marker_${markerIndex}`,
          name: activity.name || activity.title,
          lat,
          lng,
          day: day.dayNumber,
          time: activity.time,
          category: activity.category || activity.type,
          cost: activity.cost,
          description: activity.description,
          index: markerIndex++,
        });
      }
    }
  }

  return markers;
}

function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹',
    AUD: 'A$', CAD: 'C$', SGD: 'S$', AED: 'د.إ', THB: '฿',
    MYR: 'RM', KRW: '₩', CNY: '¥', HKD: 'HK$', NZD: 'NZ$',
  };
  return symbols[currency] || currency + ' ';
}

function getCurrencyMultiplier(currency: string): number {
  const rates: Record<string, number> = {
    USD: 1, EUR: 0.92, GBP: 0.79, JPY: 149, INR: 83,
    AUD: 1.53, CAD: 1.36, SGD: 1.34, AED: 3.67, THB: 35,
    MYR: 4.47, KRW: 1300, CNY: 7.2, HKD: 7.8, NZD: 1.62,
  };
  return rates[currency] || 1;
}

function estimateDailyFoodCost(destination: string, currency: string): number {
  // Base cost in USD per person per day
  const baseCosts: Record<string, number> = {
    'tokyo': 50, 'japan': 50,
    'paris': 60, 'france': 55,
    'london': 55, 'uk': 50,
    'new york': 60, 'usa': 50,
    'bali': 25, 'indonesia': 25,
    'bangkok': 20, 'thailand': 20,
    'singapore': 40,
    'dubai': 45, 'uae': 45,
    'rome': 45, 'italy': 45,
    'barcelona': 40, 'spain': 40,
  };

  const destLower = destination.toLowerCase();
  let baseCost = 40; // Default

  for (const [key, cost] of Object.entries(baseCosts)) {
    if (destLower.includes(key)) {
      baseCost = cost;
      break;
    }
  }

  // Convert to target currency
  const multiplier = getCurrencyMultiplier(currency);
  return Math.round(baseCost * multiplier);
}

export default router;
