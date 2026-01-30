/**
 * B2B API v1 - Visa Routes
 * Visa requirement lookups
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../../middleware/apiAuth';
import { fetchVisaRequirements, getCountryCode } from '../../../services/visaApiService';
import { lookupVisa } from '../../../services/passportIndexService';

const router = Router();

// Validation schema for visa lookup
const visaLookupSchema = z.object({
  passport: z.string().min(1, 'Passport country is required'),
  destination: z.string().min(1, 'Destination is required'),
});

/**
 * GET /api/v1/visa/lookup
 * Get visa requirements for a passport/destination combination
 */
router.get('/lookup', requirePermission('read'), async (req: Request, res: Response) => {
  try {
    const validation = visaLookupSchema.safeParse({
      passport: req.query.passport,
      destination: req.query.destination,
    });

    if (!validation.success) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: validation.error.errors,
        usage: 'GET /api/v1/visa/lookup?passport=<country>&destination=<country>',
      });
    }

    const { passport, destination } = validation.data;

    // Get visa info from our services
    const visaInfo = await fetchVisaRequirements(passport, destination);

    // Also try Passport Index for more data
    const passportCode = getCountryCode(passport);
    const destCode = getCountryCode(destination);
    const passportIndexInfo = passportCode && destCode
      ? lookupVisa(passportCode, destCode)
      : null;

    if (!visaInfo && !passportIndexInfo) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Visa information not found for this corridor',
        passport,
        destination,
      });
    }

    // Merge data from both sources
    const visaType = visaInfo?.visaType || passportIndexInfo?.status || 'unknown';
    const response: any = {
      passport: {
        country: passport,
        code: passportCode,
      },
      destination: {
        country: destination,
        code: destCode,
      },
      visa: {
        type: visaType,
        required: visaType !== 'visa_free' && visaType !== 'visa_on_arrival',
      },
    };

    // Add details from visaInfo if available
    if (visaInfo) {
      response.visa.details = {
        visaName: visaInfo.visaName,
        duration: visaInfo.duration,
        passportValidity: visaInfo.passportValidity,
        embassyUrl: visaInfo.embassyUrl,
        applyLink: visaInfo.applyLink,
      };
    }

    // Add passport index data if available
    if (passportIndexInfo) {
      response.passportIndex = {
        status: passportIndexInfo.status,
        statusLabel: passportIndexInfo.statusLabel,
        stayDuration: passportIndexInfo.days,
      };
    }

    // Add guidance based on visa type
    if (response.visa.required) {
      response.guidance = {
        recommendation: 'Visa required - apply well in advance of travel',
        applyEarly: 'We recommend starting the application at least 30 days before departure',
      };
    } else {
      response.guidance = {
        recommendation: visaType === 'visa_on_arrival'
          ? 'Visa can be obtained on arrival - ensure you have all required documents'
          : 'No visa required - ensure passport is valid for at least 6 months',
      };
    }

    res.json(response);
  } catch (error) {
    console.error('[API v1] Visa lookup error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to lookup visa requirements',
    });
  }
});

/**
 * GET /api/v1/visa/countries
 * List available countries for visa lookups
 */
router.get('/countries', requirePermission('read'), async (req: Request, res: Response) => {
  // Common passport countries
  const passportCountries = [
    { name: 'United States', code: 'US' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'India', code: 'IN' },
    { name: 'China', code: 'CN' },
    { name: 'Canada', code: 'CA' },
    { name: 'Australia', code: 'AU' },
    { name: 'Germany', code: 'DE' },
    { name: 'France', code: 'FR' },
    { name: 'Japan', code: 'JP' },
    { name: 'South Korea', code: 'KR' },
    { name: 'Brazil', code: 'BR' },
    { name: 'Mexico', code: 'MX' },
    { name: 'Singapore', code: 'SG' },
    { name: 'United Arab Emirates', code: 'AE' },
    { name: 'Saudi Arabia', code: 'SA' },
    { name: 'South Africa', code: 'ZA' },
    { name: 'Nigeria', code: 'NG' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'Philippines', code: 'PH' },
    { name: 'Thailand', code: 'TH' },
  ];

  // Popular destinations
  const popularDestinations = [
    { name: 'Thailand', code: 'TH' },
    { name: 'Japan', code: 'JP' },
    { name: 'France', code: 'FR' },
    { name: 'Italy', code: 'IT' },
    { name: 'Spain', code: 'ES' },
    { name: 'United Kingdom', code: 'GB' },
    { name: 'United States', code: 'US' },
    { name: 'Australia', code: 'AU' },
    { name: 'Singapore', code: 'SG' },
    { name: 'Malaysia', code: 'MY' },
    { name: 'Vietnam', code: 'VN' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'UAE', code: 'AE' },
    { name: 'Turkey', code: 'TR' },
    { name: 'Egypt', code: 'EG' },
    { name: 'Morocco', code: 'MA' },
    { name: 'South Africa', code: 'ZA' },
    { name: 'Mexico', code: 'MX' },
    { name: 'Brazil', code: 'BR' },
    { name: 'Peru', code: 'PE' },
  ];

  res.json({
    passportCountries,
    popularDestinations,
    _note: 'This is not an exhaustive list. Most countries are supported.',
  });
});

export default router;
