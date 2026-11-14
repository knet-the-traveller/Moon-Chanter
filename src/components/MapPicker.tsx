import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { MAP_LAYERS } from '../services/gibs';
import { MapPin, Navigation, Layers, CheckCircle2, Info } from 'lucide-react';

export const MapPicker: React.FC = () => {
  const {
    selectedLocation,
    selectPilotPreset,
    setCustomCoordinates,
    setCurrentStep,
    language,
    isLoadingTelemetry
  } = useAppStore();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayerKey, setActiveLayerKey] = useState<string>('osm');
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [selectedLocation.lat, selectedLocation.lon],
      zoom: 9,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer (OSM)
    const initialLayerConfig = MAP_LAYERS.osm;
    const tileLayer = L.tileLayer(initialLayerConfig.url, {
      attribution: initialLayerConfig.attribution,
      maxZoom: initialLayerConfig.maxZoom,
      subdomains: initialLayerConfig.subdomains || ['a', 'b', 'c']
    }).addTo(map);

    activeTileLayerRef.current = tileLayer;

    // Custom Map Marker using inline SVG DivIcon
    const customIcon = L.divIcon({
      className: 'custom-field-marker',
      html: `
        <div style="
          background-color: #1e3a2f;
          border: 3px solid #f59e0b;
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 10px;
            height: 10px;
            background-color: #fef3c7;
            border-radius: 50%;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const marker = L.marker([selectedLocation.lat, selectedLocation.lon], {
      icon: customIcon,
      draggable: true
    }).addTo(map);

    marker.bindPopup(`<b>${selectedLocation.name}</b><br/>${selectedLocation.province}`).openPopup();
    markerRef.current = marker;

    // Drag marker event
    marker.on('dragend', (e) => {
      const latlng = (e.target as L.Marker).getLatLng();
      setCustomCoordinates(latlng.lat, latlng.lng);
    });

    // Map click event
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      marker.setPopupContent(`<b>Custom Field Marker</b><br/>${lat.toFixed(4)}°, ${lng.toFixed(4)}°`).openPopup();
      setCustomCoordinates(lat, lng);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update map center and marker when selectedLocation changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    const { lat, lon, name, province } = selectedLocation;
    const currentLatLng = markerRef.current.getLatLng();
    if (Math.abs(currentLatLng.lat - lat) > 0.0001 || Math.abs(currentLatLng.lng - lon) > 0.0001) {
      markerRef.current.setLatLng([lat, lon]);
      markerRef.current.setPopupContent(`<b>${name}</b><br/>${province}`).openPopup();
      mapInstanceRef.current.panTo([lat, lon], { animate: true });
    }
  }, [selectedLocation]);

  // Switch Tile Layer (GIBS True Color, NDVI, OSM)
  const handleLayerSwitch = (layerKey: string) => {
    if (!mapInstanceRef.current) return;
    const config = MAP_LAYERS[layerKey];
    if (!config) return;

    if (activeTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(activeTileLayerRef.current);
    }

    const newLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      opacity: config.opacity || 1.0,
      subdomains: config.subdomains || ['a', 'b', 'c']
    }).addTo(mapInstanceRef.current);

    activeTileLayerRef.current = newLayer;
    setActiveLayerKey(layerKey);
  };

  // GPS Geolocation Handler
  const handleGpsLocate = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setIsLocatingGps(false);
        setCustomCoordinates(latitude, longitude, 'My GPS Field');
      },
      (err) => {
        setIsLocatingGps(false);
        alert(`GPS location error: ${err.message}. Using default pilot location.`);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const currentLayer = MAP_LAYERS[activeLayerKey];
  const langKey = language === 'fil' ? 'local' : 'en';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-stone-100 bg-stone-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-700" />
            {getTranslation(language, 'map.title')}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            {getTranslation(language, 'map.subtitle')}
          </p>
        </div>

        {/* GPS Button */}
        <button
          onClick={handleGpsLocate}
          disabled={isLocatingGps}
          className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-800 hover:bg-emerald-700 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <Navigation className={`w-4 h-4 ${isLocatingGps ? 'animate-spin' : ''}`} />
          <span>
            {isLocatingGps
              ? getTranslation(language, 'map.gpsLocating')
              : getTranslation(language, 'map.gpsButton')}
          </span>
        </button>
      </div>

      {/* Preset Hubs Selector */}
      <div className="px-4 py-3 bg-stone-100/70 border-b border-stone-200/60">
        <div className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-600" />
          <span>{getTranslation(language, 'map.presets')}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PILOT_LOCATIONS.map((pilot) => {
            const isSelected = selectedLocation.id === pilot.id;
            return (
              <button
                key={pilot.id}
                onClick={() => selectPilotPreset(pilot)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#1e3a2f] text-white shadow-sm ring-2 ring-emerald-600/40'
                    : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
                }`}
              >
                <span>{pilot.name}</span>
                <span className="text-[10px] opacity-75">({pilot.province})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Canvas and Floating Controls */}
      <div className="relative h-[380px] sm:h-[450px] w-full">
        <div ref={mapContainerRef} className="h-full w-full" />

        {/* Floating Layer Switcher */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-stone-200/80 text-xs flex flex-col gap-1">
          <div className="px-2 py-1 font-semibold text-stone-500 text-[10px] uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-700" />
            <span>Satellite Overlay</span>
          </div>
          <button
            onClick={() => handleLayerSwitch('osm')}
            className={`px-2.5 py-1 rounded text-left font-medium transition-colors cursor-pointer ${
              activeLayerKey === 'osm'
                ? 'bg-emerald-800 text-white font-semibold'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {getTranslation(language, 'map.layerOsm')}
          </button>
          <button
            onClick={() => handleLayerSwitch('gibsTrueColor')}
            className={`px-2.5 py-1 rounded text-left font-medium transition-colors cursor-pointer ${
              activeLayerKey === 'gibsTrueColor'
                ? 'bg-emerald-800 text-white font-semibold'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {getTranslation(language, 'map.layerGibsTrueColor')}
          </button>
          <button
            onClick={() => handleLayerSwitch('gibsNdvi')}
            className={`px-2.5 py-1 rounded text-left font-medium transition-colors cursor-pointer ${
              activeLayerKey === 'gibsNdvi'
                ? 'bg-emerald-800 text-white font-semibold'
                : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {getTranslation(language, 'map.layerGibsNdvi')}
          </button>
        </div>

        {/* Legend Notice when GIBS layer active */}
        {currentLayer?.isGibs && (
          <div className="absolute bottom-3 left-3 z-[1000] max-w-xs bg-stone-900/90 text-amber-50 text-[11px] p-2.5 rounded-xl backdrop-blur-md shadow-md border border-stone-700">
            <div className="font-semibold text-amber-300">
              {currentLayer.name[langKey]}
            </div>
            <div className="text-stone-300 mt-0.5">
              {currentLayer.legendDescription?.[langKey]}
            </div>
          </div>
        )}
      </div>

      {/* Footer Details & Confirm Step Action */}
      <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <span>{selectedLocation.name}</span>
            <span className="text-xs font-normal text-stone-500">· {selectedLocation.region}</span>
          </div>
          <div className="text-xs text-stone-500 mt-0.5 font-mono">
            {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E · Elev: ~{selectedLocation.elevationMeters}m
          </div>
        </div>

        <button
          onClick={() => setCurrentStep(2)}
          disabled={isLoadingTelemetry}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold bg-[#1e3a2f] hover:bg-emerald-900 text-amber-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{getTranslation(language, 'map.confirmLocation')}</span>
        </button>
      </div>
    </div>
  );
};
