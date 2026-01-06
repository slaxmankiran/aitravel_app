import { useEffect, useState, useRef, useCallback } from "react";
import { type TripResponse } from "@shared/schema";
import { Filter, Calendar, ZoomIn, Maximize2, Map, Satellite, Printer, Navigation, X, ChevronLeft, ChevronRight } from "lucide-react";

interface DayPlan {
  day: number;
  date: string;
  title: string;
  activities: {
    time: string;
    description: string;
    type: "activity" | "meal" | "transport" | "lodging";
    location?: string | { lat: number; lng: number; address?: string };
    coordinates?: { lat: number; lng: number };
    name?: string;
    cost?: number;
  }[];
}

interface Props {
  trip: TripResponse;
  highlightedLocation?: string | number | null;
  onLocationSelect?: (locationId: string) => void;
}

interface LocationData {
  id: string; // Day-based ID like "1-1", "1-2", "2-1"
  position: [number, number];
  name: string;
  description: string;
  time: string;
  day: number;
  activityIndex: number; // Index within the day (0-based)
  type: string;
}

type ActivityType = "activity" | "meal" | "transport" | "lodging";
type MapStyle = "street" | "satellite" | "terrain";

const TYPE_COLORS: Record<ActivityType, string> = {
  activity: "#3b82f6",
  meal: "#f59e0b",
  transport: "#8b5cf6",
  lodging: "#10b981",
};

const TYPE_LABELS: Record<ActivityType, string> = {
  activity: "Activity",
  meal: "Meal",
  transport: "Transport",
  lodging: "Lodging",
};

const MAP_STYLES: Record<MapStyle, { url: string; label: string; icon: typeof Map }> = {
  street: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    label: "Street",
    icon: Map,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    label: "Satellite",
    icon: Satellite,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    label: "Terrain",
    icon: Map,
  },
};

// Calculate distance between two coordinates in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate walking time (5 km/h average)
function getWalkingTime(distanceKm: number): string {
  const minutes = Math.round((distanceKm / 5) * 60);
  if (minutes < 60) return `${minutes} min walk`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m walk`;
}

export function ItineraryMap({ trip, highlightedLocation, onLocationSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<globalThis.Map<string, any>>(new globalThis.Map());
  const polylineRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  // Filter states
  const [activeTypes, setActiveTypes] = useState<Set<ActivityType>>(
    new Set<ActivityType>(["activity", "meal", "transport", "lodging"])
  );
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>("street");
  const [showDistances, setShowDistances] = useState(true);
  const [currentLocationIndex, setCurrentLocationIndex] = useState(0);

  const itinerary = trip.itinerary as unknown as { days: DayPlan[] };

  // Collect all locations with coordinates using day-based IDs
  const allLocations: LocationData[] = [];
  const dayNumbers: number[] = [];

  if (itinerary && itinerary.days) {
    itinerary.days.forEach((day) => {
      if (!dayNumbers.includes(day.day)) {
        dayNumbers.push(day.day);
      }
      let activityIndexInDay = 0;
      day.activities.forEach((activity) => {
        activityIndexInDay++; // Always increment for each activity in the day

        // Get coordinates from either coordinates field or location object
        let lat: number | undefined;
        let lng: number | undefined;

        if (activity.coordinates?.lat && activity.coordinates?.lng) {
          lat = activity.coordinates.lat;
          lng = activity.coordinates.lng;
        } else if (typeof activity.location === 'object' && activity.location?.lat && activity.location?.lng) {
          lat = activity.location.lat;
          lng = activity.location.lng;
        }

        if (lat && lng) {
          // Get location name string
          const locationName = typeof activity.location === 'string'
            ? activity.location
            : (typeof activity.location === 'object' && activity.location?.address)
              ? activity.location.address
              : (activity as any).name || activity.description || "Unknown";

          allLocations.push({
            id: `${day.day}-${activityIndexInDay}`, // Day-based ID like "1-1", "1-2", "2-1"
            position: [lat, lng],
            name: locationName,
            description: (activity as any).name || activity.description,
            time: activity.time,
            day: day.day,
            activityIndex: activityIndexInDay,
            type: activity.type,
          });
        }
      });
    });
  }

  // Filter locations based on active filters
  const filteredLocations = allLocations.filter((loc) => {
    const typeMatch = activeTypes.has(loc.type as ActivityType);
    const dayMatch = selectedDay === null || loc.day === selectedDay;
    return typeMatch && dayMatch;
  });

  // Toggle type filter
  const toggleType = (type: ActivityType) => {
    setActiveTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        if (newSet.size > 1) {
          newSet.delete(type);
        }
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // Generate Google Maps directions URL
  const getDirectionsUrl = (from: LocationData, to: LocationData): string => {
    return `https://www.google.com/maps/dir/${from.position[0]},${from.position[1]}/${to.position[0]},${to.position[1]}`;
  };

  // Update markers when filters change
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !leafletRef.current) return;

    const L = leafletRef.current;
    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach((marker) => map.removeLayer(marker));
    markersRef.current.clear();
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
    }

    // Add filtered markers
    const positions: [number, number][] = [];
    filteredLocations.forEach((loc, index) => {
      const color = TYPE_COLORS[loc.type as ActivityType] || "#3b82f6";
      const isHighlighted = String(highlightedLocation) === loc.id;
      const nextLoc = filteredLocations[index + 1];

      // Calculate distance to next location
      let distanceInfo = "";
      if (nextLoc && showDistances) {
        const dist = getDistance(loc.position[0], loc.position[1], nextLoc.position[0], nextLoc.position[1]);
        distanceInfo = `
          <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
            <div style="font-size: 12px; color: #64748b;">
              <strong>Next stop:</strong> ${nextLoc.name}<br/>
              <span style="color: #8b5cf6;">${dist.toFixed(1)} km • ${getWalkingTime(dist)}</span>
            </div>
            <a href="${getDirectionsUrl(loc, nextLoc)}" target="_blank" rel="noopener noreferrer"
               style="display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 4px 10px; background: #3b82f6; color: white; border-radius: 6px; font-size: 12px; text-decoration: none;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 11l19-9-9 19-2-8-8-2z"/>
              </svg>
              Get Directions
            </a>
          </div>
        `;
      }

      const icon = L.divIcon({
        className: "custom-marker",
        html: `
          <div style="
            background: ${color};
            color: white;
            min-width: ${isHighlighted ? '40px' : '32px'};
            height: ${isHighlighted ? '28px' : '22px'};
            padding: 0 6px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: ${isHighlighted ? '12px' : '10px'};
            border: ${isHighlighted ? '3px' : '2px'} solid white;
            box-shadow: ${isHighlighted ? '0 0 0 3px ' + color + ', 0 4px 12px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.3)'};
            transition: all 0.2s;
            transform: ${isHighlighted ? 'scale(1.1)' : 'scale(1)'};
            z-index: ${isHighlighted ? '1000' : '1'};
            white-space: nowrap;
          ">${loc.id}</div>
        `,
        iconSize: [isHighlighted ? 40 : 32, isHighlighted ? 28 : 22],
        iconAnchor: [isHighlighted ? 20 : 16, isHighlighted ? 14 : 11],
        popupAnchor: [0, isHighlighted ? -14 : -11],
      });

      const marker = L.marker(loc.position, { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width: 240px; max-width: 300px;">
            <div style="font-weight: bold; color: #1e293b; font-size: 15px;">
              <span style="background: ${color}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-right: 6px;">${loc.id}</span>${loc.name}
            </div>
            <div style="font-size: 14px; color: #475569; margin-top: 6px;">${loc.description}</div>
            <div style="font-size: 12px; color: #64748b; margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
              <span style="background: ${color}20; color: ${color}; padding: 3px 10px; border-radius: 12px; font-weight: 500;">
                ${TYPE_LABELS[loc.type as ActivityType]}
              </span>
              <span style="background: #f1f5f9; padding: 3px 10px; border-radius: 12px;">Day ${loc.day}</span>
              <span style="background: #f1f5f9; padding: 3px 10px; border-radius: 12px;">${loc.time}</span>
            </div>
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name)}"
               target="_blank" rel="noopener noreferrer"
               style="display: inline-block; margin-top: 10px; color: #3b82f6; font-size: 12px; text-decoration: none;">
              View on Google Maps →
            </a>
            ${distanceInfo}
          </div>
        `);

      marker.on('click', () => {
        if (onLocationSelect) {
          onLocationSelect(loc.id);
        }
        setCurrentLocationIndex(index);
      });

      markersRef.current.set(loc.id, marker);
      positions.push(loc.position);
    });

    // Draw polyline with gradient effect
    if (positions.length > 1) {
      polylineRef.current = L.polyline(positions, {
        color: "#6366f1",
        weight: 3,
        opacity: 0.7,
        dashArray: "8, 8",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
    }

    // Fit bounds if we have positions
    if (positions.length > 0 && !highlightedLocation) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [filteredLocations, highlightedLocation, showDistances, onLocationSelect]);

  // Highlight specific location when prop changes
  useEffect(() => {
    const locationId = String(highlightedLocation);
    if (highlightedLocation && mapInstanceRef.current && markersRef.current.has(locationId)) {
      const marker = markersRef.current.get(locationId);
      const loc = allLocations.find(l => l.id === locationId);
      if (loc) {
        mapInstanceRef.current.setView(loc.position, 15, { animate: true });
        marker.openPopup();
      }
    }
  }, [highlightedLocation, allLocations]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || allLocations.length === 0) return;

    const initMap = async () => {
      if (mapInstanceRef.current) return;

      const L = (await import("leaflet")).default;
      leafletRef.current = L;

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      // Calculate center
      const centerLat = allLocations.reduce((sum, loc) => sum + loc.position[0], 0) / allLocations.length;
      const centerLng = allLocations.reduce((sum, loc) => sum + loc.position[1], 0) / allLocations.length;

      // Create map
      const map = L.map(mapRef.current!, {
        zoomControl: false,
      }).setView([centerLat, centerLng], 12);
      mapInstanceRef.current = map;

      // Add zoom control to top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Add tile layer
      tileLayerRef.current = L.tileLayer(MAP_STYLES[mapStyle].url, {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: 'anonymous',
      }).addTo(map);

      // Force map to recalculate size (fixes tiles not loading in hidden containers)
      setTimeout(() => {
        map.invalidateSize();
      }, 100);

      // Initial marker update
      updateMarkers();
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        leafletRef.current = null;
      }
    };
  }, [allLocations.length]);

  // Update markers when filters change
  useEffect(() => {
    if (mapInstanceRef.current && leafletRef.current) {
      updateMarkers();
    }
  }, [activeTypes, selectedDay, updateMarkers]);

  // Change map style
  useEffect(() => {
    if (mapInstanceRef.current && leafletRef.current && tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = leafletRef.current.tileLayer(MAP_STYLES[mapStyle].url, {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current);
    }
  }, [mapStyle]);

  // Zoom to specific day
  const zoomToDay = (day: number) => {
    if (!mapInstanceRef.current || !leafletRef.current) return;

    const dayLocations = allLocations.filter((loc) => loc.day === day);
    if (dayLocations.length === 0) return;

    const L = leafletRef.current;
    const positions = dayLocations.map((loc) => loc.position);
    const bounds = L.latLngBounds(positions);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  };

  // Navigate between locations
  const navigateLocation = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'next'
      ? Math.min(currentLocationIndex + 1, filteredLocations.length - 1)
      : Math.max(currentLocationIndex - 1, 0);

    setCurrentLocationIndex(newIndex);
    const loc = filteredLocations[newIndex];
    if (loc && onLocationSelect) {
      onLocationSelect(loc.id);
    }
    if (loc && mapInstanceRef.current) {
      mapInstanceRef.current.setView(loc.position, 15, { animate: true });
      const marker = markersRef.current.get(loc.id);
      if (marker) marker.openPopup();
    }
  };

  // Print map
  const handlePrint = () => {
    window.print();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (!itinerary || !itinerary.days || allLocations.length === 0) {
    return (
      <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
        <p className="text-muted-foreground">Map coordinates not available for this itinerary.</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl overflow-hidden border border-slate-200 shadow-sm print:shadow-none ${
        isFullscreen ? 'fixed inset-4 z-50 bg-white' : ''
      }`}
    >
      {/* Fullscreen close button */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-6 right-6 z-[1000] p-2 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      )}

      {/* Filter Controls */}
      <div className="bg-white p-4 border-b border-slate-200 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 hidden sm:inline">Filter:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TYPE_COLORS) as ActivityType[]).map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  activeTypes.has(type)
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                <span className="hidden sm:inline">{TYPE_LABELS[type]}</span>
                <span className="sm:hidden">{TYPE_LABELS[type].charAt(0)}</span>
                <span className="opacity-70">
                  ({allLocations.filter((l) => l.type === type && (selectedDay === null || l.day === selectedDay)).length})
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Day Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" />
              <select
                value={selectedDay ?? ""}
                onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">All Days</option>
                {dayNumbers.map((day) => (
                  <option key={day} value={day}>
                    Day {day}
                  </option>
                ))}
              </select>
            </div>

            {/* Map Style */}
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              {(Object.keys(MAP_STYLES) as MapStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => setMapStyle(style)}
                  className={`px-2 py-1.5 text-xs font-medium transition-colors ${
                    mapStyle === style
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                  title={MAP_STYLES[style].label}
                >
                  {MAP_STYLES[style].label}
                </button>
              ))}
            </div>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors hidden sm:block"
              title="Print map"
            >
              <Printer className="w-4 h-4 text-slate-600" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <Maximize2 className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Quick Day Navigation */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <ZoomIn className="w-4 h-4 text-slate-500" />
          <span className="text-xs text-slate-600">Jump to:</span>
          <div className="flex gap-1 flex-wrap">
            {dayNumbers.map((day) => (
              <button
                key={day}
                onClick={() => {
                  setSelectedDay(day);
                  zoomToDay(day);
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedDay === day
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Day {day}
              </button>
            ))}
            {selectedDay !== null && (
              <button
                onClick={() => setSelectedDay(null)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors"
              >
                Show All
              </button>
            )}
          </div>

          {/* Distance toggle */}
          <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={showDistances}
              onChange={(e) => setShowDistances(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20"
            />
            <span className="text-xs text-slate-600">Show distances</span>
          </label>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div
          ref={mapRef}
          style={{ height: isFullscreen ? "calc(100vh - 280px)" : "450px", width: "100%" }}
          className="bg-slate-100"
        />

        {/* Location Navigator */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-[1000] flex items-center gap-2 bg-white/95 backdrop-blur rounded-full shadow-lg px-2 py-1.5 print:hidden">
          <button
            onClick={() => navigateLocation('prev')}
            disabled={currentLocationIndex === 0}
            className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="text-xs font-medium text-slate-700 min-w-[100px] text-center">
            {filteredLocations[currentLocationIndex]?.name || "Select location"}
          </div>
          <button
            onClick={() => navigateLocation('next')}
            disabled={currentLocationIndex === filteredLocations.length - 1}
            className="p-1.5 rounded-full hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Legend & Stats */}
      <div className="bg-white p-3 border-t border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3 text-xs">
            {(Object.keys(TYPE_COLORS) as ActivityType[]).map((type) => (
              <div key={type} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[type] }}
                />
                <span className="text-slate-600">{TYPE_LABELS[type]}</span>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{filteredLocations.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{allLocations.length}</span> locations
            {selectedDay && ` • Day ${selectedDay}`}
          </div>
        </div>
      </div>
    </div>
  );
}
