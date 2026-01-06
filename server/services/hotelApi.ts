/**
 * Hotel/Accommodation API Integration
 * Uses SerpAPI Google Hotels or falls back to estimates
 */

export interface HotelSearchParams {
  destination: string;
  checkIn: string;       // YYYY-MM-DD
  checkOut: string;      // YYYY-MM-DD
  guests: number;
  rooms?: number;
  budget?: number;       // Max budget for accommodation
  currency?: string;
}

export interface HotelResult {
  totalPrice: number;
  pricePerNight: number;
  nights: number;
  hotelName: string;
  rating: number;
  amenities: string[];
  bookingUrl?: string;
  source: 'api' | 'estimate';
  type: string;          // "Luxury", "Mid-range", "Budget"
}

// Destination to search query mapping (for better results)
const DESTINATION_QUERIES: Record<string, string> = {
  'tokyo': 'Tokyo, Japan',
  'paris': 'Paris, France',
  'london': 'London, UK',
  'new york': 'New York City, NY',
  'dubai': 'Dubai, UAE',
  'singapore': 'Singapore',
  'rome': 'Rome, Italy',
  'barcelona': 'Barcelona, Spain',
  'sydney': 'Sydney, Australia',
  'bali': 'Bali, Indonesia',
  'bangkok': 'Bangkok, Thailand',
  'amsterdam': 'Amsterdam, Netherlands',
};

function getSearchQuery(destination: string): string {
  const destLower = destination.toLowerCase();
  for (const [key, query] of Object.entries(DESTINATION_QUERIES)) {
    if (destLower.includes(key)) return query;
  }
  return destination;
}

function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Estimated hotel prices based on destination (fallback)
function getEstimatedHotelPrice(destination: string, nights: number, guests: number, budget?: number): HotelResult {
  const destLower = destination.toLowerCase();

  // Base nightly rates by destination type
  const expensiveDestinations = ['tokyo', 'paris', 'london', 'new york', 'sydney', 'zurich', 'singapore', 'hong kong', 'dubai'];
  const midRangeDestinations = ['rome', 'barcelona', 'amsterdam', 'berlin', 'prague', 'vienna', 'seoul', 'taipei'];
  const budgetDestinations = ['bangkok', 'bali', 'vietnam', 'india', 'mexico', 'portugal', 'turkey', 'morocco', 'egypt'];

  let baseRate = 120; // Default mid-range
  let hotelType = 'Mid-range hotel';

  if (expensiveDestinations.some(d => destLower.includes(d))) {
    baseRate = 180;
    hotelType = 'Mid-range hotel';
  } else if (budgetDestinations.some(d => destLower.includes(d))) {
    baseRate = 60;
    hotelType = 'Budget hotel';
  }

  // Adjust for group size (assume sharing)
  const roomsNeeded = Math.ceil(guests / 2);
  let pricePerNight = baseRate * roomsNeeded;

  // If budget is provided, try to fit within it
  if (budget) {
    const maxPerNight = Math.floor(budget / nights);
    if (pricePerNight > maxPerNight) {
      pricePerNight = maxPerNight;
      hotelType = pricePerNight < 80 ? 'Budget hostel/hotel' : 'Budget hotel';
    } else if (pricePerNight < maxPerNight * 0.5) {
      // Can afford better
      pricePerNight = Math.min(pricePerNight * 1.5, maxPerNight * 0.7);
      hotelType = pricePerNight > 150 ? 'Upscale hotel' : 'Mid-range hotel';
    }
  }

  return {
    totalPrice: Math.round(pricePerNight * nights),
    pricePerNight: Math.round(pricePerNight),
    nights,
    hotelName: `${hotelType} in ${destination}`,
    rating: baseRate > 150 ? 4.5 : baseRate > 80 ? 4.0 : 3.5,
    amenities: ['WiFi', 'Air Conditioning', 'Daily Housekeeping'],
    source: 'estimate',
    type: hotelType,
  };
}

/**
 * Search for hotels using SerpAPI Google Hotels
 */
export async function searchHotels(params: HotelSearchParams): Promise<HotelResult> {
  const { destination, checkIn, checkOut, guests, rooms = 1, budget, currency = 'USD' } = params;

  const nights = calculateNights(checkIn, checkOut);
  const serpApiKey = process.env.SERPAPI_KEY;

  if (!serpApiKey) {
    console.log('SerpAPI key not configured, using hotel estimates');
    return getEstimatedHotelPrice(destination, nights, guests, budget);
  }

  try {
    const searchQuery = getSearchQuery(destination);

    // Google Hotels API limits to 6 travelers max
    // If more guests, we'll search for a smaller group and scale prices
    const searchGuests = Math.min(guests, 6);
    const guestMultiplier = Math.ceil(guests / searchGuests); // Number of rooms/searches needed

    const searchParams = new URLSearchParams({
      api_key: serpApiKey,
      engine: 'google_hotels',
      q: searchQuery,
      check_in_date: checkIn,
      check_out_date: checkOut,
      adults: searchGuests.toString(),
      currency: currency,
      hl: 'en',
      gl: 'us',
    });

    // Add price filter if budget is provided
    if (budget) {
      const maxPerNight = Math.floor(budget / nights);
      searchParams.append('max_price', maxPerNight.toString());
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

    const response = await fetch(`https://serpapi.com/search?${searchParams}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('SerpAPI hotel search failed:', response.status);
      return getEstimatedHotelPrice(destination, nights, guests, budget);
    }

    const data = await response.json();

    // Parse hotel results
    const properties = data.properties || data.hotels || [];
    if (properties.length > 0) {
      // Helper to extract price from various formats
      const getPrice = (hotel: any): number => {
        // Try different price field formats
        const totalRate = hotel.total_rate?.lowest || hotel.total_rate?.extracted_lowest || 0;
        const perNightRate = hotel.rate_per_night?.lowest || hotel.rate_per_night?.extracted_lowest || 0;
        const price = hotel.price || 0;

        // Parse string prices like "$150"
        const parsePrice = (val: any): number => {
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          return 0;
        };

        if (totalRate) return parsePrice(totalRate);
        if (perNightRate) return parsePrice(perNightRate) * nights;
        if (price) return parsePrice(price);
        return 0;
      };

      // Filter hotels with valid prices
      const hotelsWithPrices = properties.filter((h: any) => getPrice(h) > 0);

      if (hotelsWithPrices.length > 0) {
        // Sort by price
        const sortedHotels = hotelsWithPrices.sort((a: any, b: any) => getPrice(a) - getPrice(b));

        // Pick a hotel from the lower-middle range for budget-conscious travelers
        const index = Math.min(Math.floor(sortedHotels.length * 0.3), sortedHotels.length - 1);
        const hotel = sortedHotels[index] || sortedHotels[0];

        const apiPrice = getPrice(hotel);
        // Scale price for actual guest count if we searched with fewer (need more rooms)
        const totalPrice = Math.round(apiPrice * guestMultiplier);
        const perNight = hotel.rate_per_night?.lowest || hotel.rate_per_night?.extracted_lowest || Math.round(apiPrice / nights);

        // Determine hotel type based on price
        let hotelType = 'Mid-range hotel';
        const perNightNum = typeof perNight === 'number' ? perNight : parseFloat(String(perNight).replace(/[^0-9.]/g, '')) || 0;
        if (perNightNum > 200) hotelType = 'Upscale hotel';
        else if (perNightNum > 100) hotelType = 'Mid-range hotel';
        else hotelType = 'Budget hotel';

        return {
          totalPrice,
          pricePerNight: Math.round(perNightNum * guestMultiplier || totalPrice / nights),
          nights,
          hotelName: hotel.name || hotel.title || 'Hotel',
          rating: hotel.overall_rating || hotel.rating || 4.0,
          amenities: hotel.amenities?.slice(0, 5) || ['WiFi', 'Air Conditioning'],
          bookingUrl: hotel.link || hotel.serpapi_link,
          source: 'api',
          type: hotelType + (guestMultiplier > 1 ? ` (${guestMultiplier} rooms)` : ''),
        };
      }
    }

    console.log('No hotels found in API response, using estimates');
    return getEstimatedHotelPrice(destination, nights, guests, budget);

  } catch (error) {
    console.error('Hotel API error:', error);
    return getEstimatedHotelPrice(destination, nights, guests, budget);
  }
}

/**
 * Get multiple hotel options at different price points
 */
export async function getHotelOptions(params: HotelSearchParams): Promise<{
  budget: HotelResult;
  midRange: HotelResult;
  luxury: HotelResult;
}> {
  const { destination, checkIn, checkOut, guests, currency = 'USD' } = params;
  const nights = calculateNights(checkIn, checkOut);
  const serpApiKey = process.env.SERPAPI_KEY;

  // Default estimates
  const destLower = destination.toLowerCase();
  const isExpensive = ['tokyo', 'paris', 'london', 'new york', 'sydney', 'dubai'].some(d => destLower.includes(d));
  const isBudget = ['bangkok', 'bali', 'vietnam', 'india', 'mexico'].some(d => destLower.includes(d));

  const baseMultiplier = isExpensive ? 1.5 : isBudget ? 0.6 : 1.0;
  const roomsNeeded = Math.ceil(guests / 2);

  const defaultOptions = {
    budget: {
      totalPrice: Math.round(60 * baseMultiplier * roomsNeeded * nights),
      pricePerNight: Math.round(60 * baseMultiplier * roomsNeeded),
      nights,
      hotelName: `Budget Hotel in ${destination}`,
      rating: 3.5,
      amenities: ['WiFi', 'Air Conditioning'],
      source: 'estimate' as const,
      type: 'Budget hotel',
    },
    midRange: {
      totalPrice: Math.round(120 * baseMultiplier * roomsNeeded * nights),
      pricePerNight: Math.round(120 * baseMultiplier * roomsNeeded),
      nights,
      hotelName: `Mid-range Hotel in ${destination}`,
      rating: 4.0,
      amenities: ['WiFi', 'Pool', 'Breakfast', 'Gym'],
      source: 'estimate' as const,
      type: 'Mid-range hotel',
    },
    luxury: {
      totalPrice: Math.round(250 * baseMultiplier * roomsNeeded * nights),
      pricePerNight: Math.round(250 * baseMultiplier * roomsNeeded),
      nights,
      hotelName: `Luxury Hotel in ${destination}`,
      rating: 4.8,
      amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Concierge'],
      source: 'estimate' as const,
      type: 'Luxury hotel',
    },
  };

  if (!serpApiKey) {
    return defaultOptions;
  }

  // If API is available, try to get real prices
  try {
    const result = await searchHotels(params);
    if (result.source === 'api') {
      // Scale the result to create budget/mid/luxury options
      return {
        budget: {
          ...result,
          totalPrice: Math.round(result.totalPrice * 0.6),
          pricePerNight: Math.round(result.pricePerNight * 0.6),
          type: 'Budget hotel',
          hotelName: `Budget option near ${result.hotelName}`,
        },
        midRange: result,
        luxury: {
          ...result,
          totalPrice: Math.round(result.totalPrice * 1.8),
          pricePerNight: Math.round(result.pricePerNight * 1.8),
          type: 'Luxury hotel',
          hotelName: `Luxury option near ${result.hotelName}`,
          rating: Math.min(result.rating + 0.5, 5.0),
        },
      };
    }
  } catch (error) {
    console.error('Error getting hotel options:', error);
  }

  return defaultOptions;
}
