/**
 * changePlannerTools.ts
 *
 * Tool definitions and executors for the Agentic Change Planner.
 * These tools allow the AI to gather real data when recomputing trip modules.
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { TripResponse, UserTripInput } from "@shared/schema";
import { searchFlights, type FlightSearchParams } from "./flightApi";
import { searchHotels, type HotelSearchParams } from "./hotelApi";

// ============================================================================
// TOOL DEFINITIONS (OpenAI Function Calling Format)
// ============================================================================

export const CHANGE_PLANNER_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_visa_requirements",
      description:
        "Get visa requirements for a passport holder traveling to a destination. Returns visa type, processing time, costs, and required documents.",
      parameters: {
        type: "object",
        properties: {
          passport_country: {
            type: "string",
            description: "The country that issued the passport (e.g., 'India', 'United States')",
          },
          destination_country: {
            type: "string",
            description: "The destination country to visit (e.g., 'Thailand', 'Japan')",
          },
          trip_duration_days: {
            type: "number",
            description: "How many days the traveler plans to stay",
          },
        },
        required: ["passport_country", "destination_country"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_flights",
      description:
        "Search for flight prices and options between two cities. Returns price estimates, airlines, and duration.",
      parameters: {
        type: "object",
        properties: {
          origin: {
            type: "string",
            description: "Departure city or airport code (e.g., 'New York' or 'JFK')",
          },
          destination: {
            type: "string",
            description: "Arrival city or airport code (e.g., 'Bangkok' or 'BKK')",
          },
          departure_date: {
            type: "string",
            description: "Departure date in YYYY-MM-DD format",
          },
          return_date: {
            type: "string",
            description: "Return date in YYYY-MM-DD format",
          },
          passengers: {
            type: "number",
            description: "Number of passengers",
          },
        },
        required: ["origin", "destination", "departure_date", "return_date", "passengers"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_hotels",
      description:
        "Search for hotel prices and options in a destination. Returns price per night, total cost, and hotel type.",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description: "The destination city (e.g., 'Bangkok, Thailand')",
          },
          check_in: {
            type: "string",
            description: "Check-in date in YYYY-MM-DD format",
          },
          check_out: {
            type: "string",
            description: "Check-out date in YYYY-MM-DD format",
          },
          guests: {
            type: "number",
            description: "Number of guests",
          },
          budget_per_night: {
            type: "number",
            description: "Optional maximum budget per night in USD",
          },
        },
        required: ["destination", "check_in", "check_out", "guests"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_daily_costs",
      description:
        "Estimate daily costs for a destination including food, transport, and activities based on travel style.",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description: "The destination city or country",
          },
          travel_style: {
            type: "string",
            enum: ["budget", "moderate", "luxury"],
            description: "The travel style affecting cost estimates",
          },
          num_days: {
            type: "number",
            description: "Number of days to estimate costs for",
          },
          travelers: {
            type: "number",
            description: "Number of travelers",
          },
        },
        required: ["destination", "travel_style", "num_days", "travelers"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assess_safety",
      description:
        "Get safety assessment for a destination including travel advisories and current conditions.",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description: "The destination country or city",
          },
          travel_dates: {
            type: "string",
            description: "The planned travel dates (e.g., 'Feb 15-22, 2025')",
          },
        },
        required: ["destination"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_certainty_score",
      description:
        "Calculate the certainty score based on visa status, budget adequacy, safety, and accessibility factors.",
      parameters: {
        type: "object",
        properties: {
          visa_status: {
            type: "string",
            enum: ["visa_free", "visa_on_arrival", "e_visa", "embassy_visa", "restricted"],
            description: "The visa requirement status",
          },
          budget_adequacy: {
            type: "string",
            enum: ["comfortable", "adequate", "tight", "insufficient"],
            description: "How well the budget covers expected costs",
          },
          safety_level: {
            type: "string",
            enum: ["safe", "moderate_caution", "high_caution", "avoid"],
            description: "Safety assessment level",
          },
          days_until_trip: {
            type: "number",
            description: "Days until the trip starts (for visa processing time consideration)",
          },
        },
        required: ["visa_status", "budget_adequacy", "safety_level"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "regenerate_itinerary_days",
      description:
        "Regenerate specific days of the itinerary based on changes. Use when dates or preferences change significantly.",
      parameters: {
        type: "object",
        properties: {
          destination: {
            type: "string",
            description: "The trip destination",
          },
          start_date: {
            type: "string",
            description: "Trip start date in YYYY-MM-DD format",
          },
          num_days: {
            type: "number",
            description: "Total number of days for the trip",
          },
          travel_style: {
            type: "string",
            enum: ["budget", "moderate", "luxury", "adventure", "cultural", "relaxation"],
            description: "The preferred travel style",
          },
          days_to_regenerate: {
            type: "array",
            items: { type: "number" },
            description: "Which day numbers to regenerate (1-indexed). Empty array means all days.",
          },
          preferences: {
            type: "string",
            description: "Any specific preferences or constraints for the itinerary",
          },
        },
        required: ["destination", "start_date", "num_days", "travel_style"],
      },
    },
  },
];

// ============================================================================
// TOOL EXECUTORS
// ============================================================================

export interface ToolExecutionContext {
  currentTrip: TripResponse;
  nextInput: UserTripInput;
}

/**
 * Execute a tool call and return the result as a string (for the AI to process)
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<string> {
  console.log(`[ChangePlannerTools] Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case "get_visa_requirements":
        return await executeGetVisaRequirements(args as any);

      case "search_flights":
        return await executeSearchFlights(args as any);

      case "search_hotels":
        return await executeSearchHotels(args as any);

      case "estimate_daily_costs":
        return executeEstimateDailyCosts(args as any);

      case "assess_safety":
        return executeAssessSafety(args as any);

      case "calculate_certainty_score":
        return executeCalculateCertaintyScore(args as any);

      case "regenerate_itinerary_days":
        return await executeRegenerateItinerary(args as any, context);

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (error: any) {
    console.error(`[ChangePlannerTools] Tool ${toolName} failed:`, error.message);
    return JSON.stringify({
      error: error.message || "Tool execution failed",
      tool: toolName,
    });
  }
}

// ============================================================================
// INDIVIDUAL TOOL IMPLEMENTATIONS
// ============================================================================

/**
 * Visa requirements lookup - uses knowledge base + heuristics
 */
async function executeGetVisaRequirements(args: {
  passport_country: string;
  destination_country: string;
  trip_duration_days?: number;
}): Promise<string> {
  const { passport_country, destination_country, trip_duration_days = 14 } = args;

  // Common visa-free combinations (simplified knowledge base)
  const VISA_FREE_MATRIX: Record<string, string[]> = {
    "united states": [
      "canada", "mexico", "uk", "france", "germany", "italy", "spain", "japan",
      "south korea", "singapore", "thailand", "indonesia", "malaysia", "philippines",
    ],
    "india": [
      "thailand", "indonesia", "maldives", "mauritius", "fiji", "jamaica",
      "serbia", "tunisia", "ecuador", "dominica",
    ],
    "uk": [
      "usa", "canada", "eu", "japan", "south korea", "singapore", "thailand",
      "malaysia", "indonesia", "australia", "new zealand",
    ],
  };

  const VOA_DESTINATIONS: Record<string, string[]> = {
    "india": ["thailand", "indonesia", "cambodia", "laos", "myanmar", "nepal"],
    "united states": ["egypt", "turkey", "cambodia", "laos"],
  };

  const passportLower = passport_country.toLowerCase();
  const destLower = destination_country.toLowerCase();

  // Check visa-free
  const visaFreeList = VISA_FREE_MATRIX[passportLower] || [];
  if (visaFreeList.some((d) => destLower.includes(d))) {
    return JSON.stringify({
      type: "visa_free",
      required: false,
      maxStay: 30,
      processingDays: { minimum: 0, maximum: 0 },
      cost: 0,
      documentsRequired: ["Valid passport (6+ months validity)", "Return ticket", "Proof of accommodation"],
      notes: `${passport_country} passport holders can visit ${destination_country} visa-free for up to 30 days.`,
    });
  }

  // Check VOA
  const voaList = VOA_DESTINATIONS[passportLower] || [];
  if (voaList.some((d) => destLower.includes(d))) {
    return JSON.stringify({
      type: "visa_on_arrival",
      required: true,
      maxStay: 30,
      processingDays: { minimum: 0, maximum: 0 },
      cost: 35,
      documentsRequired: [
        "Valid passport (6+ months validity)",
        "Passport photo",
        "Return ticket",
        "Proof of funds ($500+ recommended)",
      ],
      notes: `Visa on arrival available for ${passport_country} passport holders. Fee payable at airport.`,
    });
  }

  // Default: Embassy visa required
  return JSON.stringify({
    type: "embassy_visa",
    required: true,
    maxStay: 60,
    processingDays: { minimum: 5, maximum: 15 },
    cost: 80,
    documentsRequired: [
      "Valid passport (6+ months validity)",
      "Completed visa application form",
      "Passport photos (2)",
      "Bank statements (3 months)",
      "Flight itinerary",
      "Hotel bookings",
      "Travel insurance",
    ],
    notes: `${passport_country} passport holders require an embassy visa for ${destination_country}. Apply at least 2-3 weeks before travel.`,
  });
}

/**
 * Flight search - uses existing flightApi service
 */
async function executeSearchFlights(args: {
  origin: string;
  destination: string;
  departure_date: string;
  return_date: string;
  passengers: number;
}): Promise<string> {
  const params: FlightSearchParams = {
    origin: args.origin,
    destination: args.destination,
    departureDate: args.departure_date,
    returnDate: args.return_date,
    passengers: args.passengers,
    currency: "USD",
  };

  const result = await searchFlights(params);

  if (!result || !result.price) {
    return JSON.stringify({
      found: false,
      message: "No flights found for this route and dates",
      estimate: {
        price: args.passengers * 800,
        note: "Rough estimate based on typical routes",
      },
    });
  }

  return JSON.stringify({
    found: true,
    flight: {
      price: result.price,
      pricePerPerson: result.pricePerPerson,
      airline: result.airline,
      duration: result.duration,
      stops: result.stops,
      source: result.source,
    },
    currency: "USD",
  });
}

/**
 * Hotel search - uses existing hotelApi service
 */
async function executeSearchHotels(args: {
  destination: string;
  check_in: string;
  check_out: string;
  guests: number;
  budget_per_night?: number;
}): Promise<string> {
  const params: HotelSearchParams = {
    destination: args.destination,
    checkIn: args.check_in,
    checkOut: args.check_out,
    guests: args.guests,
    budget: args.budget_per_night,
    currency: "USD",
  };

  const result = await searchHotels(params);

  if (!result || !result.totalPrice) {
    // Calculate nights
    const nights = Math.ceil(
      (new Date(args.check_out).getTime() - new Date(args.check_in).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    return JSON.stringify({
      found: false,
      message: "No hotels found, using estimates",
      estimate: {
        totalPrice: nights * 100 * Math.ceil(args.guests / 2),
        pricePerNight: 100,
        nights,
        type: "Mid-range hotel",
      },
    });
  }

  return JSON.stringify({
    found: true,
    hotel: {
      totalPrice: result.totalPrice,
      pricePerNight: result.pricePerNight,
      nights: result.nights,
      hotelName: result.hotelName,
      type: result.type,
      source: result.source,
    },
    currency: "USD",
  });
}

/**
 * Daily cost estimation based on destination and travel style
 */
function executeEstimateDailyCosts(args: {
  destination: string;
  travel_style: string;
  num_days: number;
  travelers: number;
}): string {
  const { destination, travel_style, num_days, travelers } = args;
  const destLower = destination.toLowerCase();

  // Cost indices by region (multiplier relative to US baseline)
  const COST_INDEX: Record<string, number> = {
    "thailand": 0.35,
    "vietnam": 0.30,
    "indonesia": 0.35,
    "india": 0.25,
    "mexico": 0.45,
    "japan": 1.1,
    "singapore": 0.9,
    "uk": 1.2,
    "france": 1.1,
    "italy": 0.95,
    "spain": 0.85,
    "germany": 1.0,
    "usa": 1.0,
    "australia": 1.1,
  };

  // Find matching cost index
  let costIndex = 0.7; // Default moderate
  for (const [region, index] of Object.entries(COST_INDEX)) {
    if (destLower.includes(region)) {
      costIndex = index;
      break;
    }
  }

  // Base daily costs in USD (per person)
  const BASE_DAILY: Record<string, { food: number; transport: number; activities: number }> = {
    budget: { food: 25, transport: 15, activities: 20 },
    moderate: { food: 50, transport: 30, activities: 50 },
    luxury: { food: 100, transport: 60, activities: 120 },
  };

  const style = travel_style.toLowerCase() as keyof typeof BASE_DAILY;
  const base = BASE_DAILY[style] || BASE_DAILY.moderate;

  const dailyPerPerson = {
    food: Math.round(base.food * costIndex),
    transport: Math.round(base.transport * costIndex),
    activities: Math.round(base.activities * costIndex),
    total: Math.round((base.food + base.transport + base.activities) * costIndex),
  };

  const totalTrip = {
    food: dailyPerPerson.food * num_days * travelers,
    transport: dailyPerPerson.transport * num_days * travelers,
    activities: dailyPerPerson.activities * num_days * travelers,
    total: dailyPerPerson.total * num_days * travelers,
  };

  return JSON.stringify({
    destination,
    travelStyle: travel_style,
    numDays: num_days,
    travelers,
    costIndex,
    dailyPerPerson,
    totalTrip,
    currency: "USD",
    note: `Estimates based on ${travel_style} travel style in ${destination}`,
  });
}

/**
 * Safety assessment (simplified - would use real travel advisory APIs in production)
 */
function executeAssessSafety(args: { destination: string; travel_dates?: string }): string {
  const destLower = args.destination.toLowerCase();

  // Simplified safety database
  const SAFETY_LEVELS: Record<string, { level: string; score: number; notes: string[] }> = {
    japan: {
      level: "safe",
      score: 95,
      notes: ["Very low crime", "Excellent healthcare", "Natural disaster preparedness"],
    },
    singapore: {
      level: "safe",
      score: 95,
      notes: ["Very low crime", "Strict laws", "Excellent infrastructure"],
    },
    thailand: {
      level: "moderate_caution",
      score: 75,
      notes: [
        "Generally safe for tourists",
        "Watch for petty theft in tourist areas",
        "Exercise caution in southern provinces",
      ],
    },
    indonesia: {
      level: "moderate_caution",
      score: 70,
      notes: [
        "Bali very safe for tourists",
        "Natural disaster risk (earthquakes, volcanoes)",
        "Traffic can be challenging",
      ],
    },
    india: {
      level: "moderate_caution",
      score: 65,
      notes: [
        "Varies by region",
        "Tourist scams common",
        "Women should take extra precautions",
        "Great healthcare in major cities",
      ],
    },
    mexico: {
      level: "moderate_caution",
      score: 60,
      notes: [
        "Tourist areas generally safe",
        "Avoid certain regions",
        "Use authorized transportation",
      ],
    },
  };

  // Find matching safety info
  let safetyInfo = {
    level: "moderate_caution",
    score: 70,
    notes: ["Standard travel precautions recommended", "Check local conditions before travel"],
  };

  for (const [region, info] of Object.entries(SAFETY_LEVELS)) {
    if (destLower.includes(region)) {
      safetyInfo = info;
      break;
    }
  }

  return JSON.stringify({
    destination: args.destination,
    travelDates: args.travel_dates || "Not specified",
    safetyLevel: safetyInfo.level,
    safetyScore: safetyInfo.score,
    advisories: safetyInfo.notes,
    recommendation:
      safetyInfo.level === "safe"
        ? "Safe to travel with normal precautions"
        : safetyInfo.level === "moderate_caution"
          ? "Safe for most travelers with standard precautions"
          : "Exercise increased caution, research specific areas",
  });
}

/**
 * Calculate certainty score based on multiple factors
 */
function executeCalculateCertaintyScore(args: {
  visa_status: string;
  budget_adequacy: string;
  safety_level: string;
  days_until_trip?: number;
}): string {
  const { visa_status, budget_adequacy, safety_level, days_until_trip } = args;

  // Visa score (0-30 points)
  const VISA_SCORES: Record<string, number> = {
    visa_free: 30,
    visa_on_arrival: 25,
    e_visa: 20,
    embassy_visa: 10,
    restricted: 0,
  };
  const visaScore = VISA_SCORES[visa_status] ?? 15;

  // Budget score (0-20 points)
  const BUDGET_SCORES: Record<string, number> = {
    comfortable: 20,
    adequate: 15,
    tight: 8,
    insufficient: 0,
  };
  const budgetScore = BUDGET_SCORES[budget_adequacy] ?? 10;

  // Safety score (0-25 points)
  const SAFETY_SCORES: Record<string, number> = {
    safe: 25,
    moderate_caution: 18,
    high_caution: 8,
    avoid: 0,
  };
  const safetyScore = SAFETY_SCORES[safety_level] ?? 15;

  // Accessibility/timing score (0-25 points)
  let accessibilityScore = 20; // Default
  if (days_until_trip !== undefined) {
    if (days_until_trip < 7 && visa_status === "embassy_visa") {
      accessibilityScore = 5; // Very risky - not enough time for visa
    } else if (days_until_trip < 14 && visa_status === "embassy_visa") {
      accessibilityScore = 12; // Tight timeline
    } else if (days_until_trip >= 30) {
      accessibilityScore = 25; // Plenty of time
    }
  }

  const totalScore = visaScore + budgetScore + safetyScore + accessibilityScore;

  // Determine verdict
  let verdict = "GO";
  let visaRisk: "low" | "medium" | "high" = "low";

  if (totalScore < 50) {
    verdict = "NO";
    visaRisk = "high";
  } else if (totalScore < 70) {
    verdict = "POSSIBLE";
    visaRisk = "medium";
  }

  if (visa_status === "embassy_visa" || visa_status === "restricted") {
    visaRisk = visa_status === "restricted" ? "high" : "medium";
  }

  return JSON.stringify({
    score: totalScore,
    breakdown: {
      visa: { score: visaScore, max: 30 },
      budget: { score: budgetScore, max: 20 },
      safety: { score: safetyScore, max: 25 },
      accessibility: { score: accessibilityScore, max: 25 },
    },
    verdict,
    visaRisk,
    explanation: `Score ${totalScore}/100: Visa (${visaScore}/30), Budget (${budgetScore}/20), Safety (${safetyScore}/25), Timing (${accessibilityScore}/25)`,
  });
}

/**
 * Regenerate itinerary days (placeholder - calls AI in actual implementation)
 */
async function executeRegenerateItinerary(
  args: {
    destination: string;
    start_date: string;
    num_days: number;
    travel_style: string;
    days_to_regenerate?: number[];
    preferences?: string;
  },
  context: ToolExecutionContext
): Promise<string> {
  // For now, return existing itinerary with note about regeneration
  // In full implementation, this would call the AI to regenerate days
  const existingItinerary = context.currentTrip.itinerary as any;
  const existingDays = existingItinerary?.days || [];

  return JSON.stringify({
    status: "using_existing",
    message: `Itinerary maintained for ${args.num_days} days in ${args.destination}`,
    daysCount: existingDays.length,
    note: "Full regeneration would be triggered for major destination/date changes",
    travelStyle: args.travel_style,
    preferences: args.preferences || "None specified",
  });
}
