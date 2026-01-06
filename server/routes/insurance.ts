/**
 * Travel Insurance Routes
 * Insurance quotes and affiliate integration
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

const router = Router();

// Insurance provider configurations (affiliate partners)
const INSURANCE_PROVIDERS = [
  {
    id: 'worldnomads',
    name: 'World Nomads',
    logo: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=60&h=60&fit=crop',
    rating: 4.8,
    reviews: 12450,
    coverageTypes: ['medical', 'trip_cancellation', 'baggage', 'adventure'],
    affiliateBaseUrl: 'https://worldnomads.com',
    features: ['24/7 Emergency Assistance', 'Adventure Sports Coverage', 'COVID-19 Coverage'],
  },
  {
    id: 'allianz',
    name: 'Allianz Travel',
    logo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=60&h=60&fit=crop',
    rating: 4.6,
    reviews: 8920,
    coverageTypes: ['medical', 'trip_cancellation', 'baggage', 'rental_car'],
    affiliateBaseUrl: 'https://allianz.com/travel',
    features: ['Cancel for Any Reason', 'Rental Car Coverage', 'Flight Delay Protection'],
  },
  {
    id: 'travelguard',
    name: 'Travel Guard',
    logo: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=60&h=60&fit=crop',
    rating: 4.5,
    reviews: 6780,
    coverageTypes: ['medical', 'trip_cancellation', 'baggage'],
    affiliateBaseUrl: 'https://travelguard.com',
    features: ['Pre-existing Condition Waiver', 'Kids Travel Free', 'Concierge Service'],
  },
  {
    id: 'safetywing',
    name: 'SafetyWing',
    logo: 'https://images.unsplash.com/photo-1586281380117-5a60ae2050cc?w=60&h=60&fit=crop',
    rating: 4.7,
    reviews: 5340,
    coverageTypes: ['medical', 'baggage', 'adventure'],
    affiliateBaseUrl: 'https://safetywing.com',
    features: ['Nomad Insurance', 'Monthly Subscription', 'Remote Work Coverage'],
  },
];

// Validation schema for quote request
const quoteRequestSchema = z.object({
  tripId: z.number().optional(),
  destination: z.string(),
  origin: z.string().default('United States'),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.array(z.object({
    age: z.number().min(0).max(120),
  })).min(1),
  tripCost: z.number().optional(),
  coverageType: z.enum(['basic', 'standard', 'premium']).default('standard'),
});

interface InsuranceQuote {
  providerId: string;
  providerName: string;
  providerLogo: string;
  planName: string;
  price: number;
  currency: string;
  pricePerDay: number;
  coverage: {
    medical: number;
    tripCancellation: number;
    baggage: number;
    travelDelay: number;
    emergencyEvacuation: number;
  };
  features: string[];
  rating: number;
  reviews: number;
  affiliateUrl: string;
  recommended?: boolean;
}

/**
 * POST /api/insurance/quotes
 * Get insurance quotes from multiple providers
 */
router.post('/quotes', async (req: Request, res: Response) => {
  try {
    const data = quoteRequestSchema.parse(req.body);

    console.log(`[Insurance] Getting quotes for trip to ${data.destination}`);

    // Calculate trip duration
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const tripDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Calculate average traveler age for pricing
    const avgAge = data.travelers.reduce((sum, t) => sum + t.age, 0) / data.travelers.length;
    const numTravelers = data.travelers.length;

    // Generate quotes from each provider
    const quotes: InsuranceQuote[] = INSURANCE_PROVIDERS.map((provider, idx) => {
      // Base price calculation (simplified - real implementation would use provider APIs)
      let basePrice = calculateBasePrice(tripDays, avgAge, numTravelers, data.coverageType);

      // Adjust for provider (simulate different pricing)
      const providerMultipliers: Record<string, number> = {
        worldnomads: 1.0,
        allianz: 1.15,
        travelguard: 1.05,
        safetywing: 0.85,
      };
      basePrice *= providerMultipliers[provider.id] || 1.0;

      // Round to nice numbers
      basePrice = Math.round(basePrice);

      // Calculate coverage amounts based on plan type
      const coverage = getCoverageAmounts(data.coverageType, data.tripCost || 0);

      // Generate affiliate URL with tracking
      const affiliateUrl = `${provider.affiliateBaseUrl}?ref=voyageai&dest=${encodeURIComponent(data.destination)}&days=${tripDays}`;

      return {
        providerId: provider.id,
        providerName: provider.name,
        providerLogo: provider.logo,
        planName: getPlanName(data.coverageType, provider.id),
        price: basePrice,
        currency: 'USD',
        pricePerDay: Math.round((basePrice / tripDays) * 100) / 100,
        coverage,
        features: provider.features,
        rating: provider.rating,
        reviews: provider.reviews,
        affiliateUrl,
        recommended: idx === 0, // First provider is recommended
      };
    });

    // Sort by price
    quotes.sort((a, b) => a.price - b.price);

    // Mark best value
    if (quotes.length > 0) {
      const bestValue = quotes.reduce((best, quote) =>
        (quote.coverage.medical / quote.price) > (best.coverage.medical / best.price) ? quote : best
      );
      bestValue.recommended = true;
    }

    // Track quote request for analytics
    trackQuoteRequest(data, quotes);

    res.json({
      success: true,
      quotes,
      tripDays,
      metadata: {
        destination: data.destination,
        travelers: numTravelers,
        coverageType: data.coverageType,
      },
    });
  } catch (err: any) {
    console.error('[Insurance] Quote error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to get insurance quotes' });
  }
});

/**
 * GET /api/insurance/providers
 * Get list of insurance providers
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = INSURANCE_PROVIDERS.map(p => ({
      id: p.id,
      name: p.name,
      logo: p.logo,
      rating: p.rating,
      reviews: p.reviews,
      coverageTypes: p.coverageTypes,
      features: p.features,
    }));

    res.json({ providers });
  } catch (err) {
    console.error('[Insurance] Providers error:', err);
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

/**
 * POST /api/insurance/click
 * Track affiliate link clicks
 */
router.post('/click', async (req: Request, res: Response) => {
  try {
    const { providerId, tripId, quotePrice } = req.body;

    console.log(`[Insurance] Click tracked: ${providerId}, trip ${tripId}, price ${quotePrice}`);

    // In production, save to database for analytics
    // Also useful for commission tracking

    res.json({ success: true });
  } catch (err) {
    console.error('[Insurance] Click tracking error:', err);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

/**
 * GET /api/insurance/coverage-info
 * Get information about coverage types
 */
router.get('/coverage-info', async (req: Request, res: Response) => {
  try {
    const coverageInfo = {
      basic: {
        name: 'Basic',
        description: 'Essential coverage for medical emergencies',
        idealFor: 'Short domestic trips',
        includes: ['Emergency medical', 'Medical evacuation', 'Basic baggage protection'],
      },
      standard: {
        name: 'Standard',
        description: 'Comprehensive protection for most travelers',
        idealFor: 'International vacations',
        includes: ['Everything in Basic', 'Trip cancellation', 'Travel delay', 'Lost baggage'],
      },
      premium: {
        name: 'Premium',
        description: 'Maximum protection with Cancel for Any Reason',
        idealFor: 'Expensive trips, uncertain situations',
        includes: ['Everything in Standard', 'Cancel for Any Reason (75%)', 'Adventure sports', 'Pre-existing conditions'],
      },
    };

    res.json({ coverageInfo });
  } catch (err) {
    console.error('[Insurance] Coverage info error:', err);
    res.status(500).json({ error: 'Failed to get coverage info' });
  }
});

// Helper functions

function calculateBasePrice(
  days: number,
  avgAge: number,
  numTravelers: number,
  coverageType: string
): number {
  // Base daily rate varies by age
  let dailyRate = 4;
  if (avgAge >= 65) dailyRate = 12;
  else if (avgAge >= 55) dailyRate = 8;
  else if (avgAge >= 40) dailyRate = 6;
  else if (avgAge < 18) dailyRate = 3;

  // Coverage type multiplier
  const coverageMultipliers: Record<string, number> = {
    basic: 0.7,
    standard: 1.0,
    premium: 1.5,
  };

  const multiplier = coverageMultipliers[coverageType] || 1.0;

  // Calculate total
  let total = dailyRate * days * numTravelers * multiplier;

  // Minimum price
  total = Math.max(total, 25);

  return total;
}

function getCoverageAmounts(coverageType: string, tripCost: number): InsuranceQuote['coverage'] {
  const baseCoverage = {
    basic: {
      medical: 50000,
      tripCancellation: Math.min(tripCost * 0.5, 2500),
      baggage: 500,
      travelDelay: 200,
      emergencyEvacuation: 100000,
    },
    standard: {
      medical: 100000,
      tripCancellation: Math.min(tripCost, 10000),
      baggage: 1500,
      travelDelay: 500,
      emergencyEvacuation: 250000,
    },
    premium: {
      medical: 250000,
      tripCancellation: Math.min(tripCost * 1.5, 25000),
      baggage: 3000,
      travelDelay: 1000,
      emergencyEvacuation: 500000,
    },
  };

  return baseCoverage[coverageType as keyof typeof baseCoverage] || baseCoverage.standard;
}

function getPlanName(coverageType: string, providerId: string): string {
  const planNames: Record<string, Record<string, string>> = {
    worldnomads: {
      basic: 'Explorer Basic',
      standard: 'Explorer Standard',
      premium: 'Explorer Premium',
    },
    allianz: {
      basic: 'OneTrip Basic',
      standard: 'OneTrip Prime',
      premium: 'OneTrip Premier',
    },
    travelguard: {
      basic: 'Preferred Lite',
      standard: 'Preferred',
      premium: 'Deluxe',
    },
    safetywing: {
      basic: 'Nomad Basic',
      standard: 'Nomad Insurance',
      premium: 'Nomad Complete',
    },
  };

  return planNames[providerId]?.[coverageType] || `${coverageType.charAt(0).toUpperCase() + coverageType.slice(1)} Plan`;
}

function trackQuoteRequest(data: any, quotes: InsuranceQuote[]): void {
  // In production, save to analytics database
  console.log(`[Insurance Analytics] Quote request: ${data.destination}, ${data.travelers.length} travelers, ${quotes.length} quotes generated`);
}

export default router;
