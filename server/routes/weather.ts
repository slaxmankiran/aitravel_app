/**
 * Weather Routes
 * Weather forecasts and historical data for trip destinations
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

const router = Router();

// Weather data cache (in production, use Redis)
const weatherCache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Validation schemas
const forecastSchema = z.object({
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
});

interface WeatherDay {
  date: string;
  tempHigh: number;
  tempLow: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy';
  humidity: number;
  precipitation: number;
  windSpeed: number;
  uvIndex: number;
  description: string;
}

interface WeatherForecast {
  destination: string;
  timezone: string;
  currentTemp?: number;
  currentCondition?: string;
  days: WeatherDay[];
  packingTips: string[];
  bestTimeToVisit: string;
}

// City climate data for simulation
const CITY_CLIMATES: Record<string, {
  avgTemp: number;
  tempRange: number;
  rainChance: number;
  climate: string;
}> = {
  'paris': { avgTemp: 15, tempRange: 15, rainChance: 0.3, climate: 'temperate' },
  'tokyo': { avgTemp: 16, tempRange: 20, rainChance: 0.35, climate: 'temperate' },
  'bali': { avgTemp: 28, tempRange: 5, rainChance: 0.4, climate: 'tropical' },
  'maldives': { avgTemp: 30, tempRange: 3, rainChance: 0.35, climate: 'tropical' },
  'rome': { avgTemp: 18, tempRange: 18, rainChance: 0.25, climate: 'mediterranean' },
  'new york': { avgTemp: 13, tempRange: 25, rainChance: 0.3, climate: 'continental' },
  'london': { avgTemp: 12, tempRange: 12, rainChance: 0.45, climate: 'oceanic' },
  'bangkok': { avgTemp: 32, tempRange: 5, rainChance: 0.5, climate: 'tropical' },
  'sydney': { avgTemp: 22, tempRange: 12, rainChance: 0.25, climate: 'temperate' },
  'dubai': { avgTemp: 33, tempRange: 15, rainChance: 0.05, climate: 'desert' },
  'iceland': { avgTemp: 5, tempRange: 15, rainChance: 0.4, climate: 'subarctic' },
  'hawaii': { avgTemp: 26, tempRange: 6, rainChance: 0.35, climate: 'tropical' },
  'singapore': { avgTemp: 31, tempRange: 3, rainChance: 0.45, climate: 'tropical' },
  'barcelona': { avgTemp: 19, tempRange: 14, rainChance: 0.2, climate: 'mediterranean' },
  'amsterdam': { avgTemp: 11, tempRange: 14, rainChance: 0.4, climate: 'oceanic' },
};

/**
 * GET /api/weather/forecast
 * Get weather forecast for a destination
 */
router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const destination = req.query.destination as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    // Check cache
    const cacheKey = `${destination}-${startDate}-${endDate || ''}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return res.json({ forecast: cached.data, cached: true });
    }

    // Generate forecast
    const forecast = generateForecast(destination, startDate, endDate);

    // Cache result
    weatherCache.set(cacheKey, {
      data: forecast,
      expires: Date.now() + CACHE_TTL,
    });

    console.log(`[Weather] Generated forecast for ${destination}`);

    res.json({
      forecast,
      cached: false,
    });
  } catch (err: any) {
    console.error('[Weather] Forecast error:', err);
    res.status(500).json({ error: 'Failed to get weather forecast' });
  }
});

/**
 * GET /api/weather/current
 * Get current weather for a destination
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const destination = req.query.destination as string;

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    // Get city climate data
    const cityKey = findCityKey(destination);
    const climate = CITY_CLIMATES[cityKey] || {
      avgTemp: 20,
      tempRange: 15,
      rainChance: 0.3,
      climate: 'temperate',
    };

    // Simulate current weather
    const now = new Date();
    const seasonalOffset = getSeasonalOffset(now.getMonth());
    const temp = Math.round(climate.avgTemp + (Math.random() - 0.5) * 10 + seasonalOffset);
    const condition = Math.random() < climate.rainChance ? 'rainy' : 'sunny';

    res.json({
      destination,
      current: {
        temp,
        feelsLike: temp + Math.round((Math.random() - 0.5) * 4),
        condition,
        humidity: Math.round(40 + Math.random() * 40),
        windSpeed: Math.round(5 + Math.random() * 15),
        uvIndex: Math.round(3 + Math.random() * 7),
        updatedAt: now.toISOString(),
      },
    });
  } catch (err) {
    console.error('[Weather] Current weather error:', err);
    res.status(500).json({ error: 'Failed to get current weather' });
  }
});

/**
 * GET /api/weather/historical
 * Get historical weather data for planning
 */
router.get('/historical', async (req: Request, res: Response) => {
  try {
    const destination = req.query.destination as string;
    const month = parseInt(req.query.month as string);

    if (!destination || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Valid destination and month (1-12) required' });
    }

    // Get city climate data
    const cityKey = findCityKey(destination);
    const climate = CITY_CLIMATES[cityKey] || {
      avgTemp: 20,
      tempRange: 15,
      rainChance: 0.3,
      climate: 'temperate',
    };

    // Generate historical averages
    const seasonalOffset = getSeasonalOffset(month - 1);
    const avgHigh = Math.round(climate.avgTemp + climate.tempRange / 2 + seasonalOffset);
    const avgLow = Math.round(climate.avgTemp - climate.tempRange / 2 + seasonalOffset);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    res.json({
      destination,
      month: monthNames[month - 1],
      historical: {
        avgHigh,
        avgLow,
        avgRainDays: Math.round(climate.rainChance * 30),
        avgHumidity: Math.round(50 + climate.rainChance * 30),
        sunriseTime: '6:30 AM',
        sunsetTime: '7:30 PM',
        climate: climate.climate,
      },
      recommendation: getMonthRecommendation(month, climate.climate),
    });
  } catch (err) {
    console.error('[Weather] Historical error:', err);
    res.status(500).json({ error: 'Failed to get historical weather' });
  }
});

/**
 * GET /api/weather/alerts
 * Get any weather alerts for a destination
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const destination = req.query.destination as string;

    if (!destination) {
      return res.status(400).json({ error: 'Destination is required' });
    }

    // Simulate weather alerts (in production, fetch from weather API)
    const alerts: any[] = [];

    // Random chance of an alert
    if (Math.random() < 0.2) {
      const alertTypes = [
        { type: 'heat', title: 'Heat Advisory', description: 'High temperatures expected' },
        { type: 'rain', title: 'Heavy Rain Warning', description: 'Possible flooding in low areas' },
        { type: 'wind', title: 'High Wind Warning', description: 'Strong gusts expected' },
      ];

      const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
      alerts.push({
        ...alert,
        severity: 'moderate',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    res.json({
      destination,
      alerts,
      hasAlerts: alerts.length > 0,
    });
  } catch (err) {
    console.error('[Weather] Alerts error:', err);
    res.status(500).json({ error: 'Failed to get weather alerts' });
  }
});

// Helper functions

function findCityKey(destination: string): string {
  const lower = destination.toLowerCase();
  for (const city of Object.keys(CITY_CLIMATES)) {
    if (lower.includes(city)) return city;
  }
  return 'default';
}

function getSeasonalOffset(month: number): number {
  // Simple seasonal adjustment (Northern Hemisphere bias)
  const offsets = [-10, -8, -3, 3, 8, 12, 14, 13, 8, 3, -3, -8];
  return offsets[month] || 0;
}

function generateForecast(
  destination: string,
  startDate?: string,
  endDate?: string
): WeatherForecast {
  const cityKey = findCityKey(destination);
  const climate = CITY_CLIMATES[cityKey] || {
    avgTemp: 20,
    tempRange: 15,
    rainChance: 0.3,
    climate: 'temperate',
  };

  const start = startDate ? new Date(startDate) : new Date();
  const end = endDate ? new Date(endDate) : new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const days: WeatherDay[] = [];

  let current = new Date(start);
  while (current <= end) {
    const seasonalOffset = getSeasonalOffset(current.getMonth());
    const dailyVariation = (Math.random() - 0.5) * 8;
    const tempHigh = Math.round(climate.avgTemp + climate.tempRange / 2 + seasonalOffset + dailyVariation);
    const tempLow = Math.round(climate.avgTemp - climate.tempRange / 2 + seasonalOffset + dailyVariation);

    const isRainy = Math.random() < climate.rainChance;
    const condition = determineCondition(isRainy, tempHigh);

    days.push({
      date: current.toISOString().split('T')[0],
      tempHigh,
      tempLow,
      condition,
      humidity: Math.round(40 + climate.rainChance * 40 + Math.random() * 20),
      precipitation: isRainy ? Math.round(Math.random() * 30) : 0,
      windSpeed: Math.round(5 + Math.random() * 20),
      uvIndex: Math.round(3 + Math.random() * 7),
      description: getConditionDescription(condition, tempHigh),
    });

    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }

  return {
    destination,
    timezone: 'Local Time',
    currentTemp: days[0]?.tempHigh,
    currentCondition: days[0]?.condition,
    days,
    packingTips: getPackingTips(climate.climate, days),
    bestTimeToVisit: getBestTimeToVisit(climate.climate),
  };
}

function determineCondition(
  isRainy: boolean,
  temp: number
): WeatherDay['condition'] {
  if (isRainy) {
    if (temp < 2) return 'snowy';
    if (Math.random() < 0.2) return 'stormy';
    return 'rainy';
  }
  if (Math.random() < 0.3) return 'cloudy';
  if (Math.random() < 0.1) return 'foggy';
  return 'sunny';
}

function getConditionDescription(condition: string, temp: number): string {
  const descriptions: Record<string, string[]> = {
    sunny: ['Clear skies', 'Bright and sunny', 'Perfect weather', 'Beautiful day'],
    cloudy: ['Partly cloudy', 'Overcast', 'Cloud cover expected', 'Mostly cloudy'],
    rainy: ['Showers likely', 'Rain expected', 'Bring an umbrella', 'Wet conditions'],
    stormy: ['Thunderstorms possible', 'Severe weather alert', 'Stay indoors if possible'],
    snowy: ['Snow expected', 'Winter conditions', 'Bundle up', 'Possible snow accumulation'],
    foggy: ['Morning fog', 'Low visibility', 'Foggy conditions', 'Mist expected'],
  };

  const options = descriptions[condition] || ['Variable conditions'];
  return options[Math.floor(Math.random() * options.length)];
}

function getPackingTips(climate: string, days: WeatherDay[]): string[] {
  const tips: string[] = [];

  const hasRain = days.some(d => d.condition === 'rainy' || d.condition === 'stormy');
  const hasCold = days.some(d => d.tempLow < 10);
  const hasHot = days.some(d => d.tempHigh > 30);
  const hasSnow = days.some(d => d.condition === 'snowy');

  if (hasRain) tips.push('Pack a waterproof jacket and umbrella');
  if (hasCold) tips.push('Bring warm layers and a jacket');
  if (hasHot) tips.push('Pack light, breathable clothing');
  if (hasSnow) tips.push('Bring warm boots and winter gear');

  if (climate === 'tropical') {
    tips.push('Pack sunscreen SPF 50+');
    tips.push('Bring insect repellent');
  } else if (climate === 'desert') {
    tips.push('Stay hydrated - bring a water bottle');
    tips.push('Pack a hat and sunglasses');
  }

  if (tips.length === 0) {
    tips.push('Pack versatile, layerable clothing');
  }

  return tips.slice(0, 4);
}

function getBestTimeToVisit(climate: string): string {
  const recommendations: Record<string, string> = {
    tropical: 'December to April (dry season)',
    temperate: 'May to September (warm months)',
    mediterranean: 'April to October (warm and dry)',
    continental: 'May to September (summer)',
    oceanic: 'June to August (warmest)',
    desert: 'October to April (cooler months)',
    subarctic: 'June to August (midnight sun)',
  };

  return recommendations[climate] || 'Spring and Fall for mild weather';
}

function getMonthRecommendation(month: number, climate: string): string {
  const monthIdx = month - 1;
  const peakMonths: Record<string, number[]> = {
    tropical: [11, 0, 1, 2, 3],
    temperate: [4, 5, 6, 7, 8],
    mediterranean: [3, 4, 5, 6, 7, 8, 9],
    continental: [4, 5, 6, 7, 8],
    oceanic: [5, 6, 7],
    desert: [9, 10, 11, 0, 1, 2, 3],
    subarctic: [5, 6, 7],
  };

  const peaks = peakMonths[climate] || [4, 5, 6, 7, 8];
  if (peaks.includes(monthIdx)) {
    return 'Great time to visit! Expect favorable weather conditions.';
  } else {
    return 'Off-peak season. Consider checking weather forecasts closer to your trip.';
  }
}

export default router;
