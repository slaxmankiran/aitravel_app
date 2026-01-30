/**
 * B2B API v1 - Feasibility Routes
 * Quick feasibility checks without creating a trip
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/apiAuth';
import { fetchVisaRequirements } from '../../../services/visaApiService';
import { getSmartTransportRecommendations } from '../../../services/transportService';

const router = Router();

// Validation schema for quick feasibility check
const feasibilityCheckSchema = z.object({
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  passport: z.string().min(1, 'Passport/nationality is required'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  budget: z.number().positive('Budget must be positive'),
  currency: z.string().length(3).default('USD'),
  travelers: z.number().int().min(1).default(1),
  travelStyle: z.enum(['budget', 'standard', 'luxury']).default('standard'),
});

/**
 * POST /api/v1/feasibility/check
 * Quick feasibility check without creating a persistent trip
 */
router.post('/check', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const validation = feasibilityCheckSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid request body',
        details: validation.error.errors,
      });
    }

    const data = validation.data;

    // Calculate trip duration
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (durationDays <= 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'End date must be after start date',
      });
    }

    // Get visa requirements
    const visaInfo = await fetchVisaRequirements(data.passport, data.destination);

    // Get transport recommendations
    const transportInfo = await getSmartTransportRecommendations(
      data.origin,
      data.destination,
      data.budget,
      data.currency,
      data.travelers,
      data.travelStyle
    );

    // Calculate days until travel
    const today = new Date();
    const daysUntilTravel = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Check visa timing
    let visaRisk: 'low' | 'medium' | 'high' = 'low';
    let visaBlocked = false;
    const visaType = visaInfo?.visaType || 'unknown';

    if (visaInfo && visaType !== 'visa_free' && visaType !== 'visa_on_arrival') {
      // Standard visa processing assumptions
      const minProcessingDays = 14;
      const maxProcessingDays = 30;

      if (daysUntilTravel < minProcessingDays) {
        visaBlocked = true;
        visaRisk = 'high';
      } else if (daysUntilTravel < maxProcessingDays) {
        visaRisk = 'high';
      } else if (daysUntilTravel < maxProcessingDays + 7) {
        visaRisk = 'medium';
      }
    }

    // Calculate budget per day per person
    const budgetPerDayPerPerson = data.budget / (durationDays * data.travelers);
    let budgetStatus: 'comfortable' | 'tight' | 'insufficient' = 'comfortable';

    // Simple budget heuristics (these would be more sophisticated in production)
    if (budgetPerDayPerPerson < 50) {
      budgetStatus = 'insufficient';
    } else if (budgetPerDayPerPerson < 100) {
      budgetStatus = 'tight';
    }

    // Calculate certainty score (simplified)
    let certaintyScore = 100;

    // Visa impact
    if (visaBlocked) {
      certaintyScore -= 50;
    } else if (visaRisk === 'high') {
      certaintyScore -= 30;
    } else if (visaRisk === 'medium') {
      certaintyScore -= 15;
    }

    // Budget impact
    if (budgetStatus === 'insufficient') {
      certaintyScore -= 25;
    } else if (budgetStatus === 'tight') {
      certaintyScore -= 10;
    }

    // Transport availability check
    const hasTransportOptions = transportInfo?.allOptions && transportInfo.allOptions.length > 0;
    if (!hasTransportOptions) {
      certaintyScore -= 5;
    }

    certaintyScore = Math.max(0, certaintyScore);

    // Determine verdict
    let verdict: 'go' | 'possible' | 'difficult' = 'go';
    if (certaintyScore < 50) {
      verdict = 'difficult';
    } else if (certaintyScore < 80) {
      verdict = 'possible';
    }

    // Build blockers list
    const blockers: string[] = [];
    if (visaBlocked) {
      blockers.push('Insufficient time for visa processing');
    }
    if (budgetStatus === 'insufficient') {
      blockers.push('Budget may be too low for this destination');
    }

    // Build warnings list
    const warnings: string[] = [];
    if (visaRisk === 'high' && !visaBlocked) {
      warnings.push('Visa processing time is tight - apply immediately');
    }
    if (visaRisk === 'medium') {
      warnings.push('Consider applying for visa soon');
    }
    if (budgetStatus === 'tight') {
      warnings.push('Budget is tight - consider budget accommodations');
    }

    res.json({
      verdict,
      certaintyScore,
      summary: verdict === 'go'
        ? 'This trip is feasible with current parameters.'
        : verdict === 'possible'
        ? 'This trip is possible but has some concerns.'
        : 'This trip has significant challenges that need to be addressed.',

      details: {
        tripDuration: `${durationDays} days`,
        daysUntilTravel,
        budgetPerDayPerPerson: Math.round(budgetPerDayPerPerson),
        currency: data.currency,
      },

      visa: {
        type: visaType,
        visaName: visaInfo?.visaName,
        risk: visaRisk,
        blocked: visaBlocked,
        duration: visaInfo?.duration,
        passportValidity: visaInfo?.passportValidity,
      },

      budget: {
        status: budgetStatus,
        total: data.budget,
        perDayPerPerson: Math.round(budgetPerDayPerPerson),
      },

      transport: {
        hasConnections: hasTransportOptions,
        primaryMode: transportInfo?.primaryMode,
        optionsCount: transportInfo?.allOptions?.length || 0,
        recommendation: transportInfo?.recommendation,
        quickSummary: transportInfo?.quickSummary,
      },

      blockers,
      warnings,

      _note: 'This is a quick check. Create a trip for detailed analysis and itinerary generation.',
    });
  } catch (error) {
    console.error('[API v1] Feasibility check error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to check feasibility',
    });
  }
});

export default router;
