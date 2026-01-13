/**
 * Templates Routes
 * Public trip templates management
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { validateSession, getSessionIdFromHeaders } from '../services/auth';

const router = Router();

// Sample template data (in production, load from database)
const SAMPLE_TEMPLATES = [
  {
    id: 101,
    destination: 'Paris, France',
    templateName: 'Romantic Paris Getaway',
    templateDescription: 'Experience the city of love with this carefully curated 5-day romantic itinerary.',
    templateCategory: 'romantic',
    dates: '5 days',
    budget: 2500,
    currency: 'USD',
    groupSize: 2,
    rating: 4.8,
    ratingCount: 124,
    useCount: 856,
    passport: 'United States',
    adults: 2, children: 0, infants: 0,
    itinerary: {
      days: [
        { dayNumber: 1, title: 'Arrival & Eiffel Tower', activities: [] },
        { dayNumber: 2, title: 'Louvre & Seine Cruise', activities: [] },
        { dayNumber: 3, title: 'Montmartre & Sacré-Cœur', activities: [] },
        { dayNumber: 4, title: 'Versailles Day Trip', activities: [] },
        { dayNumber: 5, title: 'Shopping & Departure', activities: [] },
      ],
    },
  },
  {
    id: 102,
    destination: 'Tokyo, Japan',
    templateName: 'Ultimate Tokyo Adventure',
    templateDescription: 'Explore ancient temples, modern tech, and incredible food in 7 action-packed days.',
    templateCategory: 'adventure',
    dates: '7 days',
    budget: 3500,
    currency: 'USD',
    groupSize: 2,
    rating: 4.9,
    ratingCount: 234,
    useCount: 1203,
    passport: 'United States',
    adults: 2, children: 0, infants: 0,
    itinerary: {
      days: [
        { dayNumber: 1, title: 'Shibuya & Harajuku', activities: [] },
        { dayNumber: 2, title: 'Asakusa & Senso-ji', activities: [] },
        { dayNumber: 3, title: 'Day Trip to Mt. Fuji', activities: [] },
        { dayNumber: 4, title: 'Akihabara & Gaming', activities: [] },
        { dayNumber: 5, title: 'TeamLab & Odaiba', activities: [] },
        { dayNumber: 6, title: 'Tsukiji & Ginza', activities: [] },
        { dayNumber: 7, title: 'Last Minute Shopping', activities: [] },
      ],
    },
  },
  {
    id: 103,
    destination: 'Bali, Indonesia',
    templateName: 'Bali Family Fun',
    templateDescription: 'Kid-friendly beaches, temples, and wildlife adventures for the whole family.',
    templateCategory: 'family',
    dates: '6 days',
    budget: 2000,
    currency: 'USD',
    groupSize: 4,
    rating: 4.7,
    ratingCount: 89,
    useCount: 432,
    passport: 'United States',
    adults: 2, children: 2, infants: 0,
    itinerary: {
      days: [
        { dayNumber: 1, title: 'Beach Day in Kuta', activities: [] },
        { dayNumber: 2, title: 'Ubud Monkey Forest', activities: [] },
        { dayNumber: 3, title: 'Rice Terraces & Waterfall', activities: [] },
        { dayNumber: 4, title: 'Water Sports & Snorkeling', activities: [] },
        { dayNumber: 5, title: 'Temple Tour', activities: [] },
        { dayNumber: 6, title: 'Departure', activities: [] },
      ],
    },
  },
  {
    id: 104,
    destination: 'Bangkok, Thailand',
    templateName: 'Budget Bangkok Explorer',
    templateDescription: 'Experience the best of Bangkok without breaking the bank.',
    templateCategory: 'budget',
    dates: '5 days',
    budget: 800,
    currency: 'USD',
    groupSize: 1,
    rating: 4.6,
    ratingCount: 156,
    useCount: 678,
    passport: 'United States',
    adults: 1, children: 0, infants: 0,
    itinerary: {
      days: [
        { dayNumber: 1, title: 'Grand Palace & Wat Pho', activities: [] },
        { dayNumber: 2, title: 'Floating Markets', activities: [] },
        { dayNumber: 3, title: 'Street Food Tour', activities: [] },
        { dayNumber: 4, title: 'Chatuchak Market', activities: [] },
        { dayNumber: 5, title: 'Khao San Road & Departure', activities: [] },
      ],
    },
  },
  {
    id: 105,
    destination: 'Maldives',
    templateName: 'Luxury Maldives Retreat',
    templateDescription: 'Ultimate luxury overwater villa experience with private dinners and spa.',
    templateCategory: 'luxury',
    dates: '5 days',
    budget: 8000,
    currency: 'USD',
    groupSize: 2,
    rating: 5.0,
    ratingCount: 67,
    useCount: 234,
    passport: 'United States',
    adults: 2, children: 0, infants: 0,
    itinerary: {
      days: [
        { dayNumber: 1, title: 'Arrival & Sunset Cruise', activities: [] },
        { dayNumber: 2, title: 'Spa & Snorkeling', activities: [] },
        { dayNumber: 3, title: 'Island Hopping', activities: [] },
        { dayNumber: 4, title: 'Private Beach Dinner', activities: [] },
        { dayNumber: 5, title: 'Breakfast with Dolphins', activities: [] },
      ],
    },
  },
  {
    id: 106,
    destination: 'Rome, Italy',
    templateName: 'Rome History & Food',
    templateDescription: 'Walk through ancient history while enjoying the best Italian cuisine.',
    templateCategory: 'adventure',
    dates: '4 days',
    budget: 1800,
    currency: 'USD',
    groupSize: 2,
    rating: 4.8,
    ratingCount: 198,
    useCount: 945,
    passport: 'United States',
    adults: 2, children: 0, infants: 0,
    itinerary: {
      days: [
        { dayNumber: 1, title: 'Colosseum & Roman Forum', activities: [] },
        { dayNumber: 2, title: 'Vatican & Sistine Chapel', activities: [] },
        { dayNumber: 3, title: 'Trastevere Food Tour', activities: [] },
        { dayNumber: 4, title: 'Trevi Fountain & Spanish Steps', activities: [] },
      ],
    },
  },
];

/**
 * GET /api/templates
 * Get all public templates
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    const search = req.query.search as string;

    let templates = [...SAMPLE_TEMPLATES];

    // Filter by category
    if (category && category !== 'all') {
      templates = templates.filter(t => t.templateCategory === category);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(t =>
        t.destination.toLowerCase().includes(searchLower) ||
        t.templateName.toLowerCase().includes(searchLower)
      );
    }

    // Sort by use count (most popular first)
    templates.sort((a, b) => b.useCount - a.useCount);

    res.json({ templates });
  } catch (err) {
    console.error('[Templates] Get error:', err);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

/**
 * GET /api/templates/:id
 * Get a specific template
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const template = SAMPLE_TEMPLATES.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (err) {
    console.error('[Templates] Get single error:', err);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

/**
 * POST /api/templates/:id/use
 * Create a new trip from a template
 */
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const template = SAMPLE_TEMPLATES.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Increment use count
    (template as any).useCount++;

    // Create new trip from template
    const trip = await storage.createTrip({
      passport: template.passport,
      destination: template.destination,
      dates: template.dates,
      budget: template.budget,
      currency: template.currency,
      groupSize: template.groupSize,
      adults: template.adults,
      children: template.children,
      infants: template.infants,
    });

    // Update with template itinerary and mark as feasible
    await storage.updateTripItinerary(trip.id, template.itinerary);
    await storage.updateTripFeasibility(trip.id, 'yes', {
      overall: 'yes',
      score: 90,
      breakdown: {
        visa: { status: 'ok', reason: 'Template-based trip - verify visa requirements' },
        budget: { status: 'ok', estimatedCost: template.budget, reason: 'Based on template estimates' },
        safety: { status: 'safe', reason: 'Popular destination' },
      },
      summary: 'Trip created from community template. Review and customize as needed.',
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
    });

    console.log(`[Templates] Template ${templateId} used to create trip ${trip.id}`);

    res.json({
      success: true,
      tripId: trip.id,
    });
  } catch (err) {
    console.error('[Templates] Use error:', err);
    res.status(500).json({ error: 'Failed to use template' });
  }
});

/**
 * POST /api/templates/:id/rate
 * Rate a template
 */
router.post('/:id/rate', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    const { rating } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const template = SAMPLE_TEMPLATES.find(t => t.id === templateId) as any;

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Calculate new average rating
    const totalRating = template.rating * template.ratingCount + rating;
    template.ratingCount++;
    template.rating = Math.round((totalRating / template.ratingCount) * 10) / 10;

    res.json({
      success: true,
      newRating: template.rating,
      ratingCount: template.ratingCount,
    });
  } catch (err) {
    console.error('[Templates] Rate error:', err);
    res.status(500).json({ error: 'Failed to rate template' });
  }
});

/**
 * POST /api/templates
 * Create a new template from a trip (requires auth)
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const sessionId = getSessionIdFromHeaders(req.headers as Record<string, string | string[] | undefined>);

    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const session = await validateSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { tripId, templateName, templateDescription, templateCategory } = req.body;

    if (!tripId || !templateName || !templateCategory) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get the trip
    const trip = await storage.getTrip(tripId);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Create template (in production, save to database)
    const newTemplate = {
      id: Date.now(),
      destination: trip.destination,
      templateName,
      templateDescription: templateDescription || '',
      templateCategory,
      dates: trip.dates,
      budget: trip.budget,
      currency: trip.currency || 'USD',
      groupSize: trip.groupSize,
      rating: 0,
      ratingCount: 0,
      useCount: 0,
      passport: trip.passport,
      adults: trip.adults,
      children: trip.children,
      infants: trip.infants,
      itinerary: trip.itinerary,
    };

    SAMPLE_TEMPLATES.push(newTemplate as any);

    console.log(`[Templates] New template created: ${templateName} by user ${session.user.email}`);

    res.json({
      success: true,
      template: newTemplate,
    });
  } catch (err) {
    console.error('[Templates] Create error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

export default router;
