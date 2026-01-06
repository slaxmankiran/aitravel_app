/**
 * Weather Forecast Component
 * Display weather information for trip destinations
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Droplets,
  Wind,
  Thermometer,
  Umbrella,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Shirt,
  Calendar,
} from 'lucide-react';

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

interface WeatherForecastProps {
  destination: string;
  startDate: string;
  endDate?: string;
  compact?: boolean;
}

const CONDITION_ICONS = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  stormy: CloudLightning,
  snowy: CloudSnow,
  foggy: CloudFog,
};

const CONDITION_COLORS = {
  sunny: 'text-amber-400',
  cloudy: 'text-slate-400',
  rainy: 'text-blue-400',
  stormy: 'text-purple-400',
  snowy: 'text-cyan-300',
  foggy: 'text-slate-500',
};

const CONDITION_BG = {
  sunny: 'from-amber-500/20 to-orange-500/10',
  cloudy: 'from-slate-500/20 to-slate-600/10',
  rainy: 'from-blue-500/20 to-cyan-500/10',
  stormy: 'from-purple-500/20 to-indigo-500/10',
  snowy: 'from-cyan-300/20 to-blue-300/10',
  foggy: 'from-slate-400/20 to-slate-500/10',
};

export function WeatherForecast({
  destination,
  startDate,
  endDate,
  compact = false,
}: WeatherForecastProps) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchForecast();
  }, [destination, startDate, endDate]);

  async function fetchForecast() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        destination,
        startDate,
        ...(endDate && { endDate }),
      });

      const res = await fetch(`/api/weather/forecast?${params}`);
      if (!res.ok) throw new Error('Failed to get forecast');

      const data = await res.json();
      setForecast(data.forecast);
    } catch (err) {
      console.error('Weather fetch error:', err);
      toast({
        title: 'Weather Unavailable',
        description: 'Unable to load weather forecast',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="text-center py-8 text-slate-400">
        Weather forecast unavailable
      </div>
    );
  }

  const displayDays = showAll ? forecast.days : forecast.days.slice(0, compact ? 3 : 5);
  const selectedDayData = forecast.days[selectedDay];
  const ConditionIcon = selectedDayData ? CONDITION_ICONS[selectedDayData.condition] : Sun;

  if (compact) {
    return <CompactWeather forecast={forecast} />;
  }

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header with Current Weather */}
      <div className={`p-6 bg-gradient-to-br ${selectedDayData ? CONDITION_BG[selectedDayData.condition] : CONDITION_BG.sunny}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Weather Forecast
            </h3>
            <p className="text-sm text-slate-300">{destination}</p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <ConditionIcon className={`w-10 h-10 ${selectedDayData ? CONDITION_COLORS[selectedDayData.condition] : CONDITION_COLORS.sunny}`} />
              <span className="text-4xl font-bold text-white">
                {selectedDayData?.tempHigh || '--'}°
              </span>
            </div>
            <p className="text-sm text-slate-300 capitalize">
              {selectedDayData?.condition || 'Loading...'}
            </p>
          </div>
        </div>

        {/* Selected Day Details */}
        {selectedDayData && (
          <motion.div
            key={selectedDay}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 grid grid-cols-4 gap-4"
          >
            <WeatherStat
              icon={Thermometer}
              label="Low"
              value={`${selectedDayData.tempLow}°`}
            />
            <WeatherStat
              icon={Droplets}
              label="Humidity"
              value={`${selectedDayData.humidity}%`}
            />
            <WeatherStat
              icon={Wind}
              label="Wind"
              value={`${selectedDayData.windSpeed} km/h`}
            />
            <WeatherStat
              icon={Umbrella}
              label="Rain"
              value={`${selectedDayData.precipitation}%`}
            />
          </motion.div>
        )}
      </div>

      {/* Day Selector */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">
            {forecast.days.length}-Day Forecast
          </span>
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-primary hover:underline"
          >
            {showAll ? 'Show Less' : 'Show All'}
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {displayDays.map((day, idx) => {
            const Icon = CONDITION_ICONS[day.condition];
            const isSelected = idx === selectedDay;
            const date = new Date(day.date);

            return (
              <button
                key={day.date}
                onClick={() => setSelectedDay(idx)}
                className={`flex-shrink-0 p-3 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <p className="text-xs font-medium mb-1">
                  {idx === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                </p>
                <Icon className={`w-6 h-6 mx-auto my-1 ${
                  isSelected ? 'text-white' : CONDITION_COLORS[day.condition]
                }`} />
                <p className="text-sm font-semibold">
                  {day.tempHigh}°
                </p>
                <p className={`text-xs ${isSelected ? 'text-white/70' : 'text-slate-500'}`}>
                  {day.tempLow}°
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Packing Tips */}
      {forecast.packingTips.length > 0 && (
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shirt className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-white">Packing Tips</span>
          </div>
          <div className="space-y-2">
            {forecast.packingTips.map((tip, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-sm text-slate-300"
              >
                <span className="text-primary">•</span>
                {tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Time to Visit */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-xs text-slate-400">Best time to visit</p>
            <p className="text-sm text-white">{forecast.bestTimeToVisit}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function WeatherStat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <Icon className="w-4 h-4 mx-auto text-white/60 mb-1" />
      <p className="text-xs text-white/60">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}

/**
 * Compact Weather Widget for Trip Cards
 */
function CompactWeather({ forecast }: { forecast: WeatherForecast }) {
  const firstDay = forecast.days[0];
  if (!firstDay) return null;

  const Icon = CONDITION_ICONS[firstDay.condition];

  return (
    <div className={`p-3 rounded-xl bg-gradient-to-br ${CONDITION_BG[firstDay.condition]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-6 h-6 ${CONDITION_COLORS[firstDay.condition]}`} />
          <div>
            <p className="text-sm font-semibold text-white">
              {firstDay.tempHigh}° / {firstDay.tempLow}°
            </p>
            <p className="text-xs text-slate-300 capitalize">{firstDay.condition}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Droplets className="w-3 h-3" />
            {firstDay.humidity}%
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Weather Badge for inline display
 */
export function WeatherBadge({
  destination,
  date,
}: {
  destination: string;
  date: string;
}) {
  const [weather, setWeather] = useState<WeatherDay | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const res = await fetch(
          `/api/weather/forecast?destination=${encodeURIComponent(destination)}&startDate=${date}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.forecast?.days?.[0]) {
            setWeather(data.forecast.days[0]);
          }
        }
      } catch (err) {
        console.error('Weather badge error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchWeather();
  }, [destination, date]);

  if (isLoading || !weather) {
    return null;
  }

  const Icon = CONDITION_ICONS[weather.condition];

  return (
    <div className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded-full text-xs">
      <Icon className={`w-3 h-3 ${CONDITION_COLORS[weather.condition]}`} />
      <span className="text-white">{weather.tempHigh}°</span>
    </div>
  );
}

/**
 * Weather Alerts Component
 */
export function WeatherAlerts({ destination }: { destination: string }) {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const res = await fetch(`/api/weather/alerts?destination=${encodeURIComponent(destination)}`);
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts || []);
        }
      } catch (err) {
        console.error('Weather alerts error:', err);
      }
    }
    fetchAlerts();
  }, [destination]);

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
        >
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">{alert.title}</p>
            <p className="text-xs text-slate-400">{alert.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
