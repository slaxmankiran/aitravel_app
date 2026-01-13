/**
 * MapBackground Component
 *
 * Full-screen cinematic map background using Mapbox GL JS with 3D features.
 * Features: Globe projection, 3D terrain, atmosphere (fog/sky), bird's eye flyTo.
 *
 * Falls back to stylized placeholder if Mapbox token unavailable.
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// ============================================================================
// TYPES
// ============================================================================

interface ActivityCoordinate {
  id: string;
  lat: number;
  lng: number;
  name: string;
  day: number;
  time: string;
  type: 'activity' | 'meal' | 'transport' | 'lodging';
}

interface MapBackgroundProps {
  activities: ActivityCoordinate[];
  hoveredActivityKey?: string | null;
  onMarkerClick?: (id: string) => void;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_COLORS: Record<string, string> = {
  activity: '#3b82f6',
  meal: '#f59e0b',
  transport: '#8b5cf6',
  lodging: '#10b981',
};

// Cinematic camera settings for bird's eye view
const CAMERA_CONFIG = {
  defaultPitch: 60,        // 3D tilt angle (bird's eye)
  hoverPitch: 65,          // Slightly more tilted on hover
  defaultBearing: -17.6,   // Rotation angle
  defaultZoom: 12,
  hoverZoom: 14.5,
  flyDuration: 2500,       // Fly animation duration (ms)
  terrainExaggeration: 1.5, // 3D terrain height multiplier
};

// ============================================================================
// COMPONENT
// ============================================================================

function MapBackgroundComponent({
  activities,
  hoveredActivityKey,
  onMarkerClick,
  className = '',
}: MapBackgroundProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  // Get Mapbox token from Vite environment variable
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || null;
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);

  // Log token status once on mount
  useEffect(() => {
    if (mapboxToken) {
      console.log('[MapBackground] Mapbox token loaded from environment');
    } else {
      console.log('[MapBackground] VITE_MAPBOX_TOKEN not set, using fallback');
    }
  }, []);

  // Calculate center from activities
  const center = useMemo(() => {
    if (activities.length === 0) return { lng: 100.5018, lat: 13.7563 }; // Default: Bangkok

    const avgLat = activities.reduce((sum, a) => sum + a.lat, 0) / activities.length;
    const avgLng = activities.reduce((sum, a) => sum + a.lng, 0) / activities.length;

    return { lng: avgLng, lat: avgLat };
  }, [activities]);

  // Initialize Mapbox GL map with 3D features
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Clean up existing map
    if (map.current) {
      map.current.remove();
      map.current = null;
      setIsStyleLoaded(false);
    }

    mapboxgl.accessToken = mapboxToken;

    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      // Use the new Mapbox Standard style for 3D buildings and terrain
      style: 'mapbox://styles/mapbox/standard',
      center: [center.lng, center.lat],
      zoom: CAMERA_CONFIG.defaultZoom,
      pitch: CAMERA_CONFIG.defaultPitch,
      bearing: CAMERA_CONFIG.defaultBearing,
      antialias: true,
      interactive: true,
      // Enable globe projection for immersive 3D earth view
      projection: 'globe',
    });

    // Disable scroll zoom to prevent conflicts with page scroll
    mapInstance.scrollZoom.disable();

    mapInstance.on('load', () => {
      setIsLoaded(true);
      console.log('[MapBackground] Map loaded');
    });

    // Wait for style to fully load before adding terrain/atmosphere
    mapInstance.on('style.load', () => {
      setIsStyleLoaded(true);
      console.log('[MapBackground] Style loaded, adding 3D features');

      // Enable 3D terrain with exaggeration
      mapInstance.setTerrain({
        source: 'mapbox-dem',
        exaggeration: CAMERA_CONFIG.terrainExaggeration,
      });

      // Add terrain source if not present
      if (!mapInstance.getSource('mapbox-dem')) {
        mapInstance.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
      }

      // Configure atmosphere for cinematic sky effect
      mapInstance.setFog({
        color: 'rgb(20, 30, 50)',           // Foggy blue-slate color
        'high-color': 'rgb(40, 50, 80)',    // Upper atmosphere
        'horizon-blend': 0.08,              // Horizon blend amount
        'space-color': 'rgb(10, 15, 30)',   // Space/starry sky color
        'star-intensity': 0.15,             // Subtle star visibility
      });

      console.log('[MapBackground] 3D terrain and atmosphere configured');
    });

    map.current = mapInstance;

    return () => {
      mapInstance.remove();
    };
  }, [mapboxToken, center.lng, center.lat]);

  // Add markers when map and style are loaded
  useEffect(() => {
    if (!map.current || !isLoaded || !isStyleLoaded || activities.length === 0) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current.clear();

    // Add markers for each activity
    activities.forEach(activity => {
      const color = TYPE_COLORS[activity.type] || '#3b82f6';
      const isHighlighted = activity.id === hoveredActivityKey;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'map-marker-3d';
      el.innerHTML = `
        <div style="
          background: ${color};
          color: white;
          min-width: ${isHighlighted ? '40px' : '32px'};
          height: ${isHighlighted ? '28px' : '24px'};
          padding: 0 8px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: ${isHighlighted ? '12px' : '11px'};
          border: 2px solid white;
          box-shadow: ${isHighlighted
            ? '0 0 0 4px ' + color + '50, 0 8px 24px rgba(0,0,0,0.5)'
            : '0 4px 12px rgba(0,0,0,0.4)'
          };
          transform: scale(${isHighlighted ? '1.2' : '1'}) translateY(${isHighlighted ? '-4px' : '0'});
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        ">${activity.id}</div>
      `;

      el.addEventListener('click', () => {
        onMarkerClick?.(activity.id);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([activity.lng, activity.lat])
        .addTo(map.current!);

      markers.current.set(activity.id, marker);
    });

    // Add route line between activities (if more than 1)
    if (activities.length > 1 && map.current.getSource('route')) {
      // Update existing source
      (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: activities.map(a => [a.lng, a.lat]),
        },
      });
    } else if (activities.length > 1) {
      // Add new source and layer
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: activities.map(a => [a.lng, a.lat]),
          },
        },
      });

      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#818cf8',
          'line-width': 4,
          'line-opacity': 0.8,
          'line-blur': 1,
        },
      });

      // Add glow effect layer
      map.current.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#6366f1',
          'line-width': 8,
          'line-opacity': 0.3,
          'line-blur': 4,
        },
      }, 'route-line');
    }
  }, [activities, isLoaded, isStyleLoaded, hoveredActivityKey, onMarkerClick]);

  // Fly to highlighted activity with cinematic camera movement
  useEffect(() => {
    if (!map.current || !isLoaded || !hoveredActivityKey) return;

    const activity = activities.find(a => a.id === hoveredActivityKey);
    if (activity) {
      // Add slight random variation to bearing for cinematic effect
      const bearingVariation = Math.random() * 30 - 15;

      map.current.flyTo({
        center: [activity.lng, activity.lat],
        zoom: CAMERA_CONFIG.hoverZoom,
        pitch: CAMERA_CONFIG.hoverPitch,
        bearing: CAMERA_CONFIG.defaultBearing + bearingVariation,
        duration: CAMERA_CONFIG.flyDuration,
        essential: true,
        curve: 1.5, // Smooth ease curve
      });
    }
  }, [hoveredActivityKey, activities, isLoaded]);

  // Reset camera when hover clears
  useEffect(() => {
    if (!map.current || !isLoaded || hoveredActivityKey) return;

    // Return to overview position
    map.current.flyTo({
      center: [center.lng, center.lat],
      zoom: CAMERA_CONFIG.defaultZoom,
      pitch: CAMERA_CONFIG.defaultPitch,
      bearing: CAMERA_CONFIG.defaultBearing,
      duration: 1500,
      essential: true,
    });
  }, [hoveredActivityKey, center, isLoaded]);

  // ============================================================================
  // FALLBACK: No Mapbox token - show stylized placeholder
  // ============================================================================
  if (!mapboxToken) {
    return (
      <div className={`fixed inset-0 z-0 ${className}`}>
        {/* Gradient background mimicking map aesthetic */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950" />

        {/* Animated grid pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="w-full h-full animate-pulse"
            style={{
              backgroundImage: `
                linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
          />
        </div>

        {/* Simulated terrain contours */}
        <svg className="absolute inset-0 w-full h-full opacity-5" preserveAspectRatio="none">
          <defs>
            <pattern id="contours" patternUnits="userSpaceOnUse" width="200" height="200">
              <path
                d="M0,100 Q50,50 100,100 T200,100"
                stroke="white"
                strokeWidth="0.5"
                fill="none"
              />
              <path
                d="M0,150 Q50,100 100,150 T200,150"
                stroke="white"
                strokeWidth="0.5"
                fill="none"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#contours)" />
        </svg>

        {/* Activity dots (simple representation) */}
        {activities.map((activity, i) => {
          // Normalize coordinates to viewport (rough approximation)
          const isHighlighted = activity.id === hoveredActivityKey;
          return (
            <motion.div
              key={activity.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className={`absolute w-3 h-3 rounded-full ${
                isHighlighted ? 'bg-indigo-400 ring-4 ring-indigo-400/30' : 'bg-white/40'
              }`}
              style={{
                // Simple pseudo-random placement based on coords
                left: `${30 + ((activity.lng * 100) % 40)}%`,
                top: `${20 + ((activity.lat * 100) % 60)}%`,
                transition: 'all 0.3s ease',
              }}
            />
          );
        })}

        {/* Fallback message */}
        <div className="absolute bottom-8 right-8 text-white/30 text-xs">
          Map loading...
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER: Mapbox 3D Map
  // ============================================================================
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className={`fixed inset-0 z-0 ${className}`}
    >
      {/* Map container */}
      <div
        ref={mapContainer}
        className="absolute inset-0"
        style={{ background: '#0f172a' }}
      />

      {/* Gradient overlays for UI readability */}
      {/* Left fade - strong for itinerary panel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.6) 30%, transparent 55%)',
        }}
      />

      {/* Top fade - for header */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.75) 0%, transparent 25%)',
        }}
      />

      {/* Bottom fade - subtle */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(15, 23, 42, 0.5) 0%, transparent 20%)',
        }}
      />

      {/* Vignette effect for cinematic depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 250px rgba(0, 0, 0, 0.4)',
        }}
      />
    </motion.div>
  );
}

export const MapBackground = React.memo(MapBackgroundComponent);
