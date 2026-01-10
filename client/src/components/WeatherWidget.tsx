import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  Calendar
} from "lucide-react";

interface WeatherData {
  temperature: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'stormy' | 'windy';
  humidity: number;
  windSpeed: number;
  description: string;
  forecast: Array<{
    day: string;
    high: number;
    low: number;
    condition: string;
  }>;
}

interface WeatherWidgetProps {
  destination: string;
  className?: string;
  compact?: boolean;
}

// Weather icon mapping
const WEATHER_ICONS = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: CloudSnow,
  stormy: CloudLightning,
  windy: Wind,
};

// Mock weather data based on destination
function getWeatherForDestination(destination: string): WeatherData {
  const dest = destination.toLowerCase();

  // Tropical destinations
  if (['bali', 'maldives', 'bangkok', 'singapore', 'phuket'].some(d => dest.includes(d))) {
    return {
      temperature: 30,
      condition: 'sunny',
      humidity: 75,
      windSpeed: 12,
      description: 'Hot and humid with occasional tropical showers',
      forecast: [
        { day: 'Mon', high: 31, low: 26, condition: 'sunny' },
        { day: 'Tue', high: 30, low: 25, condition: 'cloudy' },
        { day: 'Wed', high: 29, low: 25, condition: 'rainy' },
        { day: 'Thu', high: 31, low: 26, condition: 'sunny' },
        { day: 'Fri', high: 32, low: 27, condition: 'sunny' },
      ]
    };
  }

  // European destinations
  if (['paris', 'london', 'amsterdam', 'barcelona', 'rome', 'venice'].some(d => dest.includes(d))) {
    return {
      temperature: 18,
      condition: 'cloudy',
      humidity: 65,
      windSpeed: 15,
      description: 'Mild with variable clouds, perfect for sightseeing',
      forecast: [
        { day: 'Mon', high: 19, low: 12, condition: 'cloudy' },
        { day: 'Tue', high: 21, low: 13, condition: 'sunny' },
        { day: 'Wed', high: 18, low: 11, condition: 'rainy' },
        { day: 'Thu', high: 17, low: 10, condition: 'cloudy' },
        { day: 'Fri', high: 20, low: 12, condition: 'sunny' },
      ]
    };
  }

  // Asian destinations
  if (['tokyo', 'kyoto', 'seoul', 'shanghai', 'hong kong'].some(d => dest.includes(d))) {
    return {
      temperature: 22,
      condition: 'sunny',
      humidity: 55,
      windSpeed: 10,
      description: 'Pleasant weather with clear skies',
      forecast: [
        { day: 'Mon', high: 23, low: 16, condition: 'sunny' },
        { day: 'Tue', high: 24, low: 17, condition: 'sunny' },
        { day: 'Wed', high: 22, low: 15, condition: 'cloudy' },
        { day: 'Thu', high: 21, low: 14, condition: 'rainy' },
        { day: 'Fri', high: 23, low: 16, condition: 'sunny' },
      ]
    };
  }

  // Middle East
  if (['dubai', 'abu dhabi', 'doha', 'muscat'].some(d => dest.includes(d))) {
    return {
      temperature: 35,
      condition: 'sunny',
      humidity: 40,
      windSpeed: 18,
      description: 'Hot and dry with clear skies',
      forecast: [
        { day: 'Mon', high: 36, low: 28, condition: 'sunny' },
        { day: 'Tue', high: 37, low: 29, condition: 'sunny' },
        { day: 'Wed', high: 35, low: 27, condition: 'sunny' },
        { day: 'Thu', high: 36, low: 28, condition: 'sunny' },
        { day: 'Fri', high: 38, low: 30, condition: 'sunny' },
      ]
    };
  }

  // Greek islands
  if (['santorini', 'mykonos', 'crete', 'athens', 'greece'].some(d => dest.includes(d))) {
    return {
      temperature: 26,
      condition: 'sunny',
      humidity: 50,
      windSpeed: 20,
      description: 'Warm and breezy, ideal for island hopping',
      forecast: [
        { day: 'Mon', high: 27, low: 21, condition: 'sunny' },
        { day: 'Tue', high: 28, low: 22, condition: 'sunny' },
        { day: 'Wed', high: 26, low: 20, condition: 'windy' },
        { day: 'Thu', high: 27, low: 21, condition: 'sunny' },
        { day: 'Fri', high: 29, low: 23, condition: 'sunny' },
      ]
    };
  }

  // Nordic destinations
  if (['iceland', 'reykjavik', 'norway', 'sweden', 'finland', 'tromso'].some(d => dest.includes(d))) {
    return {
      temperature: 5,
      condition: 'snowy',
      humidity: 70,
      windSpeed: 25,
      description: 'Cold with chance of northern lights',
      forecast: [
        { day: 'Mon', high: 3, low: -2, condition: 'snowy' },
        { day: 'Tue', high: 5, low: 0, condition: 'cloudy' },
        { day: 'Wed', high: 4, low: -1, condition: 'snowy' },
        { day: 'Thu', high: 6, low: 1, condition: 'cloudy' },
        { day: 'Fri', high: 7, low: 2, condition: 'sunny' },
      ]
    };
  }

  // Default weather
  return {
    temperature: 20,
    condition: 'sunny',
    humidity: 50,
    windSpeed: 12,
    description: 'Pleasant weather expected',
    forecast: [
      { day: 'Mon', high: 21, low: 14, condition: 'sunny' },
      { day: 'Tue', high: 22, low: 15, condition: 'cloudy' },
      { day: 'Wed', high: 20, low: 13, condition: 'sunny' },
      { day: 'Thu', high: 19, low: 12, condition: 'rainy' },
      { day: 'Fri', high: 21, low: 14, condition: 'sunny' },
    ]
  };
}

// Get icon for condition
function getWeatherIcon(condition: string) {
  const icons: Record<string, any> = {
    sunny: Sun,
    cloudy: Cloud,
    rainy: CloudRain,
    snowy: CloudSnow,
    stormy: CloudLightning,
    windy: Wind,
  };
  return icons[condition] || Sun;
}

// Get background gradient for condition
function getWeatherGradient(condition: string) {
  const gradients: Record<string, string> = {
    sunny: 'from-amber-400 via-orange-400 to-yellow-300',
    cloudy: 'from-slate-400 via-slate-500 to-slate-600',
    rainy: 'from-blue-400 via-slate-500 to-slate-600',
    snowy: 'from-blue-200 via-slate-300 to-white',
    stormy: 'from-slate-600 via-slate-700 to-slate-800',
    windy: 'from-cyan-400 via-blue-400 to-slate-500',
  };
  return gradients[condition] || gradients.sunny;
}

export function WeatherWidget({ destination, className = '', compact = false }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call delay
    setLoading(true);
    const timer = setTimeout(() => {
      setWeather(getWeatherForDestination(destination));
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [destination]);

  if (loading) {
    return (
      <div className={`animate-pulse bg-slate-200 rounded-2xl ${compact ? 'h-20' : 'h-48'} ${className}`} />
    );
  }

  if (!weather) return null;

  const WeatherIcon = getWeatherIcon(weather.condition);
  const gradient = getWeatherGradient(weather.condition);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-gradient-to-br ${gradient} rounded-xl p-3 text-white ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WeatherIcon className="w-6 h-6" />
            <span className="text-2xl font-bold">{weather.temperature}°C</span>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium">{destination}</p>
            <p className="opacity-80 capitalize">{weather.condition}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl shadow-sm overflow-hidden ${className}`}
    >
      {/* Current Weather */}
      <div className={`bg-gradient-to-br ${gradient} p-6 text-white`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium mb-1">Weather in</p>
            <h3 className="text-xl font-display font-bold mb-4">{destination}</h3>
            <div className="flex items-center gap-3">
              <WeatherIcon className="w-12 h-12" />
              <div>
                <span className="text-5xl font-bold">{weather.temperature}°</span>
                <span className="text-xl">C</span>
              </div>
            </div>
          </div>
          <div className="text-right text-sm space-y-1">
            <div className="flex items-center gap-1 justify-end">
              <Droplets className="w-4 h-4" />
              <span>{weather.humidity}%</span>
            </div>
            <div className="flex items-center gap-1 justify-end">
              <Wind className="w-4 h-4" />
              <span>{weather.windSpeed} km/h</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-white/90 text-sm">{weather.description}</p>
      </div>

      {/* 5-Day Forecast */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">5-Day Forecast</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {weather.forecast.map((day, index) => {
            const DayIcon = getWeatherIcon(day.condition);
            return (
              <div key={index} className="text-center p-2 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-1">{day.day}</p>
                <DayIcon className="w-5 h-5 mx-auto text-slate-600 mb-1" />
                <p className="text-sm font-semibold text-slate-900">{day.high}°</p>
                <p className="text-xs text-slate-400">{day.low}°</p>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// Small inline weather badge
export function WeatherBadge({ destination }: { destination: string }) {
  const weather = getWeatherForDestination(destination);
  const WeatherIcon = getWeatherIcon(weather.condition);

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-full text-sm">
      <WeatherIcon className="w-3.5 h-3.5 text-slate-500" />
      <span className="text-slate-700 font-medium">{weather.temperature}°C</span>
    </div>
  );
}
