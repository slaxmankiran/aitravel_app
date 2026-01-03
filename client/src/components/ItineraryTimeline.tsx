import { motion } from "framer-motion";
import { Calendar, MapPin, Coffee, Utensils, BedDouble, Camera } from "lucide-react";
import { type TripResponse } from "@shared/schema";

interface DayPlan {
  day: number;
  date: string; // ISO string
  title: string;
  activities: {
    time: string;
    description: string;
    type: "activity" | "meal" | "transport" | "lodging";
    location?: string;
  }[];
}

interface Props {
  trip: TripResponse;
}

export function ItineraryTimeline({ trip }: Props) {
  // Safe cast assuming the JSONB structure matches our expectations
  const itinerary = trip.itinerary as unknown as { days: DayPlan[] };

  if (!itinerary || !itinerary.days) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <p className="text-muted-foreground">Itinerary details are not available yet.</p>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "meal": return <Utensils className="w-4 h-4" />;
      case "lodging": return <BedDouble className="w-4 h-4" />;
      case "transport": return <MapPin className="w-4 h-4" />;
      default: return <Camera className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 hidden md:block" />
      
      {itinerary.days.map((day, index) => (
        <motion.div 
          key={day.day}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
          className="relative pl-0 md:pl-12"
        >
          {/* Day Marker */}
          <div className="hidden md:flex absolute left-0 top-0 w-10 h-10 rounded-full bg-white border-4 border-primary items-center justify-center z-10 shadow-sm">
            <span className="text-xs font-bold text-primary">{day.day}</span>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-display font-bold text-slate-900">Day {day.day}: {day.title}</h3>
                <div className="flex items-center text-slate-500 text-sm mt-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {day.activities.map((activity, idx) => (
                <div key={idx} className="flex gap-4 group">
                  <div className="w-16 pt-1 text-right flex-shrink-0">
                    <span className="text-sm font-medium text-slate-500">{activity.time}</span>
                  </div>
                  <div className="relative pb-4 flex-grow border-l border-slate-100 pl-4 last:border-0 last:pb-0">
                    <div className="absolute -left-[5px] top-2 w-2.5 h-2.5 rounded-full bg-slate-300 ring-4 ring-white group-hover:bg-primary transition-colors" />
                    <div className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors">
                      <div className="flex items-start justify-between">
                        <p className="text-slate-800 font-medium">{activity.description}</p>
                        <div className="text-slate-400">
                          {getActivityIcon(activity.type)}
                        </div>
                      </div>
                      {activity.location && (
                        <div className="flex items-center text-xs text-slate-500 mt-2">
                          <MapPin className="w-3 h-3 mr-1" />
                          {activity.location}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
