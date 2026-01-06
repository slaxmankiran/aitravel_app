/**
 * Packing List Routes
 * AI-powered packing list generation
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

const router = Router();

// Validation schema
const generatePackingListSchema = z.object({
  tripId: z.number().optional(),
  destination: z.string(),
  days: z.number().min(1).max(60),
  climate: z.enum(['tropical', 'cold', 'temperate', 'desert']).optional(),
  activities: z.array(z.string()).optional(),
  travelers: z.number().min(1).default(1),
});

interface PackingItem {
  category: string;
  name: string;
  quantity: number;
  essential: boolean;
}

/**
 * POST /api/packing-list/generate
 * Generate AI-powered packing list
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const data = generatePackingListSchema.parse(req.body);

    console.log(`[Packing List] Generating for ${data.destination}, ${data.days} days, ${data.climate || 'temperate'} climate`);

    // Try AI generation first
    const aiItems = await generateAIPackingList(data);

    if (aiItems && aiItems.length > 0) {
      return res.json({
        success: true,
        items: aiItems,
        source: 'ai',
      });
    }

    // Fallback to rule-based generation
    const items = generateDefaultPackingList(data);

    res.json({
      success: true,
      items,
      source: 'default',
    });
  } catch (err: any) {
    console.error('[Packing List] Generate error:', err);

    if (err.name === 'ZodError') {
      return res.status(400).json({ error: err.errors[0]?.message || 'Invalid input' });
    }

    res.status(500).json({ error: 'Failed to generate packing list' });
  }
});

/**
 * Generate packing list using AI
 * In production, integrate with AI service for smart suggestions
 */
async function generateAIPackingList(data: {
  destination: string;
  days: number;
  climate?: string;
  activities?: string[];
  travelers?: number;
}): Promise<PackingItem[] | null> {
  // AI packing list generation can be integrated here
  // For now, use the smart default generator
  return null;
}

/**
 * Generate default packing list based on trip parameters
 */
function generateDefaultPackingList(data: {
  destination: string;
  days: number;
  climate?: string;
  activities?: string[];
  travelers?: number;
}): PackingItem[] {
  const items: PackingItem[] = [];
  const days = data.days;
  const climate = data.climate || 'temperate';
  const travelers = data.travelers || 1;

  // Documents (always essential)
  items.push(
    { category: 'Documents', name: 'Passport', quantity: travelers, essential: true },
    { category: 'Documents', name: 'Travel insurance documents', quantity: 1, essential: true },
    { category: 'Documents', name: 'Boarding passes/tickets', quantity: travelers, essential: true },
    { category: 'Documents', name: 'Hotel confirmations', quantity: 1, essential: false },
    { category: 'Documents', name: 'Copies of important documents', quantity: 1, essential: true },
  );

  // Electronics
  items.push(
    { category: 'Electronics', name: 'Phone charger', quantity: travelers, essential: true },
    { category: 'Electronics', name: 'Universal power adapter', quantity: 1, essential: true },
    { category: 'Electronics', name: 'Portable battery pack', quantity: 1, essential: false },
    { category: 'Electronics', name: 'Camera', quantity: 1, essential: false },
    { category: 'Electronics', name: 'Headphones', quantity: travelers, essential: false },
  );

  // Toiletries
  items.push(
    { category: 'Toiletries', name: 'Toothbrush & toothpaste', quantity: travelers, essential: true },
    { category: 'Toiletries', name: 'Deodorant', quantity: travelers, essential: true },
    { category: 'Toiletries', name: 'Shampoo (travel size)', quantity: 1, essential: false },
    { category: 'Toiletries', name: 'Sunscreen SPF 30+', quantity: 1, essential: true },
    { category: 'Toiletries', name: 'Lip balm with SPF', quantity: travelers, essential: false },
  );

  // Medications
  items.push(
    { category: 'Medications', name: 'Personal prescriptions', quantity: 1, essential: true },
    { category: 'Medications', name: 'Pain relievers (ibuprofen/paracetamol)', quantity: 1, essential: false },
    { category: 'Medications', name: 'Anti-diarrhea medication', quantity: 1, essential: false },
    { category: 'Medications', name: 'Band-aids/first aid kit', quantity: 1, essential: false },
  );

  // Base clothing (adjusted for trip length)
  const tshirtCount = Math.min(Math.ceil(days * 0.8), 7) * travelers;
  const underwearCount = Math.min(days + 1, 8) * travelers;
  const socksCount = Math.min(days, 7) * travelers;
  const pantsCount = Math.ceil(days / 3) * travelers;

  items.push(
    { category: 'Clothing', name: 'T-shirts/tops', quantity: tshirtCount, essential: true },
    { category: 'Clothing', name: 'Underwear', quantity: underwearCount, essential: true },
    { category: 'Clothing', name: 'Socks', quantity: socksCount, essential: true },
    { category: 'Clothing', name: 'Pants/shorts', quantity: pantsCount, essential: true },
    { category: 'Clothing', name: 'Comfortable walking shoes', quantity: travelers, essential: true },
    { category: 'Clothing', name: 'Sleepwear', quantity: travelers, essential: false },
  );

  // Climate-specific items
  if (climate === 'tropical') {
    items.push(
      { category: 'Clothing', name: 'Swimsuit', quantity: 2 * travelers, essential: true },
      { category: 'Clothing', name: 'Flip flops/sandals', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Light cotton shirts', quantity: Math.ceil(days / 2) * travelers, essential: false },
      { category: 'Clothing', name: 'Sun hat', quantity: travelers, essential: true },
      { category: 'Misc', name: 'Insect repellent', quantity: 1, essential: true },
      { category: 'Misc', name: 'Aloe vera gel', quantity: 1, essential: false },
      { category: 'Misc', name: 'Waterproof phone pouch', quantity: travelers, essential: false },
    );
  } else if (climate === 'cold') {
    items.push(
      { category: 'Clothing', name: 'Warm jacket/coat', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Sweaters/fleece', quantity: 2 * travelers, essential: true },
      { category: 'Clothing', name: 'Thermal underwear', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Warm hat/beanie', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Gloves', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Scarf', quantity: travelers, essential: false },
      { category: 'Clothing', name: 'Waterproof boots', quantity: travelers, essential: true },
      { category: 'Toiletries', name: 'Moisturizer', quantity: 1, essential: false },
    );
  } else if (climate === 'desert') {
    items.push(
      { category: 'Clothing', name: 'Light, loose clothing', quantity: Math.ceil(days * 0.7) * travelers, essential: true },
      { category: 'Clothing', name: 'Wide-brimmed hat', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Sunglasses', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Light jacket (for cold nights)', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Closed-toe shoes', quantity: travelers, essential: true },
      { category: 'Misc', name: 'Reusable water bottle', quantity: travelers, essential: true },
      { category: 'Toiletries', name: 'High SPF sunscreen', quantity: 2, essential: true },
    );
  } else {
    // Temperate - versatile packing
    items.push(
      { category: 'Clothing', name: 'Light jacket', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Rain jacket/umbrella', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Layering pieces', quantity: 2 * travelers, essential: false },
      { category: 'Clothing', name: 'Dress shoes/nice outfit', quantity: travelers, essential: false },
    );
  }

  // Misc items
  items.push(
    { category: 'Misc', name: 'Reusable water bottle', quantity: travelers, essential: false },
    { category: 'Misc', name: 'Travel pillow', quantity: travelers, essential: false },
    { category: 'Misc', name: 'Eye mask & earplugs', quantity: travelers, essential: false },
    { category: 'Misc', name: 'Packing cubes', quantity: travelers, essential: false },
    { category: 'Misc', name: 'Day bag/backpack', quantity: 1, essential: true },
    { category: 'Misc', name: 'Snacks for travel', quantity: 1, essential: false },
  );

  // Activity-specific items
  const activities = data.activities || [];
  if (activities.includes('beach') || activities.includes('swimming')) {
    if (!items.find(i => i.name.toLowerCase().includes('swimsuit'))) {
      items.push({ category: 'Clothing', name: 'Swimsuit', quantity: 2 * travelers, essential: true });
    }
    items.push({ category: 'Misc', name: 'Beach towel', quantity: travelers, essential: false });
  }

  if (activities.includes('hiking') || activities.includes('trekking')) {
    items.push(
      { category: 'Clothing', name: 'Hiking boots', quantity: travelers, essential: true },
      { category: 'Clothing', name: 'Moisture-wicking shirts', quantity: 2 * travelers, essential: true },
      { category: 'Misc', name: 'Hiking backpack', quantity: 1, essential: true },
    );
  }

  if (activities.includes('business') || activities.includes('formal')) {
    items.push(
      { category: 'Clothing', name: 'Business attire', quantity: 2 * travelers, essential: true },
      { category: 'Clothing', name: 'Dress shoes', quantity: travelers, essential: true },
    );
  }

  return items;
}

export default router;
