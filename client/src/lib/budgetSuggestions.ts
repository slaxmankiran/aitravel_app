/**
 * budgetSuggestions.ts
 *
 * Data-driven budget suggestion engine.
 * Analyzes cost breakdown to generate tailored suggestions.
 *
 * Rules:
 * - Suggestions based on actual cost distribution
 * - over50: "Fewer days" always first, then top 2 drivers
 * - over20: Top 3 cost drivers get suggestions
 */

import type { CostViewModel, BudgetStatus } from "@/hooks/useTripViewModel";

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetSuggestion {
  label: string;
  icon: string;
  prompt: string;
  category: CostCategory;
  percentOfTotal: number;
}

type CostCategory =
  | 'flights'
  | 'accommodation'
  | 'activities'
  | 'food'
  | 'transport'
  | 'days'; // Special category for reducing trip length

// ============================================================================
// SUGGESTION DEFINITIONS
// ============================================================================

const CATEGORY_SUGGESTIONS: Record<CostCategory, { label: string; icon: string; prompt: string }> = {
  flights: {
    label: 'Skip flights',
    icon: '✈️',
    prompt: 'Remove internal flights and use ground transport (bus, train) instead to save money.',
  },
  accommodation: {
    label: 'Cheaper hotels',
    icon: '🏨',
    prompt: 'Find more affordable hotel options while keeping the same locations and dates.',
  },
  activities: {
    label: 'Fewer activities',
    icon: '🎯',
    prompt: 'Remove some paid activities and suggest free alternatives. Focus on must-see attractions.',
  },
  food: {
    label: 'Local food',
    icon: '🍜',
    prompt: 'Replace expensive restaurants with local street food and casual eateries to reduce food costs.',
  },
  transport: {
    label: 'Use transit',
    icon: '🚇',
    prompt: 'Use public transit instead of taxis and ride-shares to reduce local transport costs.',
  },
  days: {
    label: 'Fewer days',
    icon: '📅',
    prompt: 'Reduce the trip by 1-2 days to lower costs. Keep the best experiences.',
  },
};

// Thresholds for when a category is considered a major cost driver
const MAJOR_DRIVER_THRESHOLD = 0.20; // 20% of total

// ============================================================================
// MAIN LOGIC
// ============================================================================

interface CategoryCost {
  category: CostCategory;
  amount: number;
  percent: number;
}

/**
 * Analyze cost breakdown and return ranked suggestions.
 *
 * @param costs - Cost view model from the trip
 * @param budgetStatus - Current budget status (over20, over50, etc.)
 * @returns Array of 3 suggestions tailored to the trip
 */
export function getBudgetSuggestions(
  costs: CostViewModel | null,
  budgetStatus: BudgetStatus
): BudgetSuggestion[] {
  // Default fallback suggestions
  const defaults: BudgetSuggestion[] = [
    { ...CATEGORY_SUGGESTIONS.accommodation, category: 'accommodation', percentOfTotal: 0 },
    { ...CATEGORY_SUGGESTIONS.activities, category: 'activities', percentOfTotal: 0 },
    { ...CATEGORY_SUGGESTIONS.food, category: 'food', percentOfTotal: 0 },
  ];

  if (!costs || costs.grandTotal === 0) {
    return defaults;
  }

  const total = costs.grandTotal;

  // Build category costs (excluding visa/insurance/misc as they're less controllable)
  const categoryCosts: CategoryCost[] = ([
    { category: 'flights' as const, amount: costs.flights, percent: costs.flights / total },
    { category: 'accommodation' as const, amount: costs.accommodation, percent: costs.accommodation / total },
    { category: 'activities' as const, amount: costs.activities, percent: costs.activities / total },
    { category: 'food' as const, amount: costs.food, percent: costs.food / total },
    { category: 'transport' as const, amount: costs.transport, percent: costs.transport / total },
  ] as CategoryCost[]).filter(c => c.amount > 0); // Only include categories with actual costs

  // Sort by percentage (highest first)
  categoryCosts.sort((a, b) => b.percent - a.percent);

  // Build suggestions
  const suggestions: BudgetSuggestion[] = [];

  // For over50: "Fewer days" is always first
  if (budgetStatus === 'over50') {
    suggestions.push({
      ...CATEGORY_SUGGESTIONS.days,
      category: 'days',
      percentOfTotal: 0, // N/A for this suggestion
    });
  }

  // Add suggestions for top cost drivers
  for (const cc of categoryCosts) {
    if (suggestions.length >= 3) break;

    // Skip if category is not a major driver (unless we need to fill slots)
    const isMajorDriver = cc.percent >= MAJOR_DRIVER_THRESHOLD;
    const needsMoreSuggestions = suggestions.length < 3;

    if (isMajorDriver || needsMoreSuggestions) {
      const def = CATEGORY_SUGGESTIONS[cc.category];
      if (def) {
        suggestions.push({
          ...def,
          category: cc.category,
          percentOfTotal: Math.round(cc.percent * 100),
        });
      }
    }
  }

  // If we still don't have 3, add defaults
  const missingCount = 3 - suggestions.length;
  if (missingCount > 0) {
    const usedCategories = new Set(suggestions.map(s => s.category));
    const fillOrder: CostCategory[] = ['accommodation', 'activities', 'food', 'transport'];

    for (const cat of fillOrder) {
      if (suggestions.length >= 3) break;
      if (usedCategories.has(cat)) continue;

      const def = CATEGORY_SUGGESTIONS[cat];
      if (def) {
        suggestions.push({
          ...def,
          category: cat,
          percentOfTotal: 0,
        });
      }
    }
  }

  return suggestions.slice(0, 3);
}

/**
 * Get the prompt for a suggestion by label.
 * Fallback for backwards compatibility with existing labels.
 */
export function getSuggestionPrompt(label: string): string {
  // Check all category suggestions
  for (const cat of Object.values(CATEGORY_SUGGESTIONS)) {
    if (cat.label === label) {
      return cat.prompt;
    }
  }

  // Legacy fallback
  const legacyPrompts: Record<string, string> = {
    'Budget hotels': 'Switch all accommodations to budget-friendly hotels or hostels. Keep the same itinerary.',
  };

  return legacyPrompts[label] || label;
}
