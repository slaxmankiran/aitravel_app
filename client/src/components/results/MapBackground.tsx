/**
 * MapBackground Component
 *
 * Full-screen cinematic map background using Mapbox GL JS with 3D features.
 * Features: Globe projection, 3D terrain, atmosphere (fog/sky), bird's eye flyTo.
 *
 * Falls back to stylized placeholder if Mapbox token unavailable.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Sun, Moon } from 'lucide-react';

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
  /** Offset map center upward on mobile to account for bottom sheet */
  mobileOffset?: boolean;
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

// Map styles for dark/light toggle
const MAP_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  light: 'mapbox://styles/mapbox/streets-v12',
} as const;

type MapTheme = keyof typeof MAP_STYLES;

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

// Mobile camera settings - less aggressive, better for touch
const CAMERA_CONFIG_MOBILE = {
  defaultPitch: 45,        // Less tilt for mobile
  hoverPitch: 50,
  defaultBearing: 0,       // No rotation (easier orientation)
  defaultZoom: 11,         // Zoomed out more to see context
  hoverZoom: 13,
  flyDuration: 1500,       // Faster transitions
  terrainExaggeration: 1,  // Less exaggerated terrain
};

// Low-power mode settings (for prefers-reduced-motion or older devices)
const CAMERA_CONFIG_REDUCED = {
  defaultPitch: 45,        // Less aggressive tilt
  hoverPitch: 45,          // Same as default (no animation)
  defaultBearing: 0,       // No rotation
  defaultZoom: 12,
  hoverZoom: 13,           // Less zoom change
  flyDuration: 500,        // Much faster transitions
  terrainExaggeration: 0,  // Flat map (no 3D terrain)
};

// Detect reduced motion preference
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// COMPONENT
// ============================================================================

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

function MapBackgroundComponent({
  activities,
  hoveredActivityKey,
  onMarkerClick,
  className = '',
  mobileOffset = true,
}: MapBackgroundProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<Map<string, mapboxgl.Marker>>(new Map());
  // Get Mapbox token from Vite environment variable
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || null;
  const [isLoaded, setIsLoaded] = useState(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const [mapTheme, setMapTheme] = useState<MapTheme>('dark');
  const isMobile = useIsMobile();

  // Toggle map theme between dark and light
  const toggleMapTheme = useCallback(() => {
    const newTheme = mapTheme === 'dark' ? 'light' : 'dark';
    setMapTheme(newTheme);
    setIsStyleLoaded(false); // Reset to trigger marker re-add

    if (map.current) {
      map.current.setStyle(MAP_STYLES[newTheme]);
      console.log(`[MapBackground] Theme switched to ${newTheme}`);

      // Re-add terrain and fog after style loads
      map.current.once('style.load', () => {
        setIsStyleLoaded(true);
        console.log(`[MapBackground] ${newTheme} style loaded`);
      });
    }
  }, [mapTheme]);

  // Check for reduced motion preference (accessibility + low-power mode)
  const prefersReducedMotion = usePrefersReducedMotion();

  // Select camera config: reduced motion > mobile > desktop
  const cameraConfig = prefersReducedMotion
    ? CAMERA_CONFIG_REDUCED
    : isMobile
    ? CAMERA_CONFIG_MOBILE
    : CAMERA_CONFIG;

  // Calculate center from activities
  // On mobile, offset the center upward to account for the bottom sheet
  const center = useMemo(() => {
    if (activities.length === 0) return { lng: 100.5018, lat: 13.7563 }; // Default: Bangkok

    const avgLat = activities.reduce((sum, a) => sum + a.lat, 0) / activities.length;
    const avgLng = activities.reduce((sum, a) => sum + a.lng, 0) / activities.length;

    // On mobile, shift the center northward (higher lat) so content appears in upper half
    // This accounts for the bottom sheet taking ~45% of screen height
    const latOffset = (isMobile && mobileOffset) ? 0.015 : 0; // ~1.5km north offset

    return { lng: avgLng, lat: avgLat + latOffset };
  }, [activities, isMobile, mobileOffset]);

  // Log token and motion status once on mount
  useEffect(() => {
    if (mapboxToken) {
      console.log('[MapBackground] Mapbox token loaded from environment');
    } else {
      console.log('[MapBackground] VITE_MAPBOX_TOKEN not set, using fallback');
    }
    if (prefersReducedMotion) {
      console.log('[MapBackground] Reduced motion mode enabled (low-power/accessibility)');
    }
    console.log('[MapBackground] Activities received:', activities.length, 'Center:', center);
  }, [mapboxToken, prefersReducedMotion, activities.length, center]);

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
      // Use theme-based style (toggleable between dark/light)
      style: MAP_STYLES[mapTheme],
      center: [center.lng, center.lat],
      zoom: cameraConfig.defaultZoom,
      pitch: cameraConfig.defaultPitch,
      bearing: cameraConfig.defaultBearing,
      antialias: !prefersReducedMotion, // Disable antialiasing in low-power mode
      interactive: true,
      // Enable globe projection for immersive 3D earth view (only in full mode)
      projection: prefersReducedMotion ? 'mercator' : 'globe',
    });

    // Disable scroll zoom to prevent conflicts with page scroll
    mapInstance.scrollZoom.disable();

    mapInstance.on('load', () => {
      setIsLoaded(true);
      console.log('[MapBackground] Map loaded');

      // Force resize after a short delay to fix blank canvas issue
      setTimeout(() => {
        mapInstance.resize();
        console.log('[MapBackground] Map resized');
      }, 500);
    });

    // Wait for style to fully load before adding terrain/atmosphere
    mapInstance.on('style.load', () => {
      setIsStyleLoaded(true);
      console.log('[MapBackground] Style loaded');

      // Only add 3D effects if not in reduced motion mode
      if (!prefersReducedMotion) {
        try {
          // Add terrain source first (must exist before setTerrain)
          if (!mapInstance.getSource('mapbox-dem')) {
            mapInstance.addSource('mapbox-dem', {
              type: 'raster-dem',
              url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
              tileSize: 512,
              maxzoom: 14,
            });
          }

          // Wait a tick for source to be ready, then enable terrain
          setTimeout(() => {
            try {
              mapInstance.setTerrain({
                source: 'mapbox-dem',
                exaggeration: cameraConfig.terrainExaggeration,
              });
              console.log('[MapBackground] 3D terrain enabled');
            } catch (terrainError) {
              console.warn('[MapBackground] Terrain setup failed:', terrainError);
            }
          }, 100);

          // Configure atmosphere for cinematic sky effect - subtle version
          mapInstance.setFog({
            color: 'rgb(30, 40, 60)',           // Lighter fog color
            'high-color': 'rgb(50, 60, 90)',    // Lighter upper atmosphere
            'horizon-blend': 0.04,              // Less horizon blend
            'space-color': 'rgb(15, 20, 35)',   // Lighter space color
            'star-intensity': 0.08,             // Very subtle stars
          });

          console.log('[MapBackground] 3D atmosphere configured');
        } catch (error) {
          console.warn('[MapBackground] 3D effects setup failed:', error);
        }
      } else {
        console.log('[MapBackground] Skipped 3D effects (reduced motion mode)');
      }
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
      // Add slight random variation to bearing for cinematic effect (only in full mode)
      const bearingVariation = prefersReducedMotion ? 0 : (Math.random() * 30 - 15);

      map.current.flyTo({
        center: [activity.lng, activity.lat],
        zoom: cameraConfig.hoverZoom,
        pitch: cameraConfig.hoverPitch,
        bearing: cameraConfig.defaultBearing + bearingVariation,
        duration: cameraConfig.flyDuration,
        essential: true,
        curve: prefersReducedMotion ? 1 : 1.5, // Simpler curve in reduced motion
      });
    }
  }, [hoveredActivityKey, activities, isLoaded, cameraConfig, prefersReducedMotion]);

  // Reset camera when hover clears
  useEffect(() => {
    if (!map.current || !isLoaded || hoveredActivityKey) return;

    // Return to overview position
    map.current.flyTo({
      center: [center.lng, center.lat],
      zoom: cameraConfig.defaultZoom,
      pitch: cameraConfig.defaultPitch,
      bearing: cameraConfig.defaultBearing,
      duration: prefersReducedMotion ? 300 : 1500,
      essential: true,
    });
  }, [hoveredActivityKey, center, isLoaded, cameraConfig, prefersReducedMotion]);

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
      className={`fixed inset-0 z-0 h-screen w-screen ${className}`}
    >
      {/* Map container - explicit full dimensions */}
      <div
        ref={mapContainer}
        className="absolute inset-0 h-full w-full"
        style={{ background: '#0f172a', minHeight: '100vh', minWidth: '100vw' }}
      />

      {/* Gradient overlays for UI readability - subtle version */}
      {/* Left fade - for itinerary panel legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, rgba(15, 23, 42, 0.75) 0%, rgba(15, 23, 42, 0.25) 20%, transparent 40%)',
        }}
      />

      {/* Top fade - for header (very subtle) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.4) 0%, transparent 15%)',
        }}
      />

      {/* Vignette effect - subtle */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 150px rgba(0, 0, 0, 0.25)',
        }}
      />

      {/* Theme toggle button - hide on mobile to avoid conflict with bottom sheet */}
      <button
        onClick={toggleMapTheme}
        className="hidden md:block absolute bottom-24 right-4 z-10 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 transition-all duration-200 shadow-lg group"
        title={mapTheme === 'dark' ? 'Switch to light map' : 'Switch to dark map'}
      >
        {mapTheme === 'dark' ? (
          <Sun className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
        ) : (
          <Moon className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
        )}
      </button>
    </motion.div>
  );
}

export const MapBackground = React.memo(MapBackgroundComponent);
