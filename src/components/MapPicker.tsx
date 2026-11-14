import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { MAP_LAYERS } from '../services/gibs';
import { MapPin, Navigation, Layers, CheckCircle2, Info } from 'lucide-react';
import type { LandMetric } from '../types';

const MAX_MAP_ZOOM = 18;

function fieldPopup(name: string, province: string): HTMLElement {
  const popup = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = name;
  popup.append(title, document.createElement('br'), document.createTextNode(province));
  return popup;
}

export const MapPicker: React.FC = () => {
  const {
    selectedLocation,
    selectPilotPreset,
    setCustomCoordinates,
    setCurrentStep,
    language,
    isLoadingTelemetry,
    isLoadingLand,
    landSummary,
    landError,
    telemetryError,
    gpsError,
    isLocatingGps,
    locateWithGps,
    fetchTelemetry
  } = useAppStore();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayerKey, setActiveLayerKey] = useState<string>('osm');

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const { selectedLocation: initialLocation } = useAppStore.getState();

    const map = L.map(mapContainerRef.current, {
      center: [initialLocation.lat, initialLocation.lon],
      zoom: 9,
      minZoom: 5,
      maxZoom: MAX_MAP_ZOOM,
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

    const marker = L.marker([initialLocation.lat, initialLocation.lon], {
      icon: customIcon,
      draggable: true
    }).addTo(map);

    marker.bindPopup(fieldPopup(initialLocation.name, initialLocation.province)).openPopup();
    markerRef.current = marker;

    // Drag marker event
    marker.on('dragend', (e) => {
      const latlng = (e.target as L.Marker).getLatLng().wrap();
      marker.setLatLng([latlng.lat, latlng.lng]);
      void useAppStore.getState().setCustomCoordinates(latlng.lat, latlng.lng);
    });

    // Map click event
    map.on('click', (e) => {
      const { lat, lng } = e.latlng.wrap();
      marker.setLatLng([lat, lng]);
      marker.setPopupContent(fieldPopup(getTranslation(useAppStore.getState().language, 'map.customField'), `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`)).openPopup();
      void useAppStore.getState().setCustomCoordinates(lat, lng);
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
    markerRef.current.setPopupContent(fieldPopup(name, province));
    const currentLatLng = markerRef.current.getLatLng();
    if (currentLatLng.lat !== lat || currentLatLng.lng !== lon) {
      markerRef.current.setLatLng([lat, lon]);
      markerRef.current.openPopup();
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
    mapInstanceRef.current.setMaxZoom(Math.min(MAX_MAP_ZOOM, config.maxZoom));

    const newLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      opacity: config.opacity || 1.0,
      subdomains: config.subdomains || ['a', 'b', 'c']
    }).addTo(mapInstanceRef.current);

    activeTileLayerRef.current = newLayer;
    setActiveLayerKey(layerKey);
  };

  const currentLayer = MAP_LAYERS[activeLayerKey];
  const langKey = language === 'fil' ? 'local' : 'en';

  const t = (key: string) => getTranslation(language, key);
  const months = landSummary?.bareFieldMonths.map((month) =>
    new Intl.DateTimeFormat(language === 'fil' ? 'fil-PH' : 'en-PH', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2000, month - 1, 1)))).join(', ');
  const metrics: Array<{ key: LandMetric; label: string; value: string }> = landSummary ? [
    { key: 'elevationM', label: t('land.elevation'), value: `${landSummary.elevationM} m` },
    { key: 'slopePct', label: t('land.slope'), value: `${landSummary.slopePct}%` },
    { key: 'floodProne', label: t('land.flood'), value: t(landSummary.floodProne ? 'land.flagged' : 'land.unflagged') },
    { key: 'bareFieldMonths', label: t('land.bareMonths'), value: months || t('land.noneDetected') },
    { key: 'rusleErosionRiskTonsHaYr', label: t('land.erosion'), value: `${landSummary.rusleErosionRiskTonsHaYr.toFixed(1)} ${t('land.erosionUnit')}` },
    { key: 'ndvi.seasonalMean', label: t('land.monthlyNdvi'), value: landSummary.ndvi.seasonalMean.map((value) => value.toFixed(2)).join(', ') },
    { key: 'ndvi.trend', label: t('land.ndviTrend'), value: landSummary.ndvi.trendAvailable
      ? `${landSummary.ndvi.trend.toFixed(3)} ${t('land.trendUnit')}` : t('land.insufficientTrendData') }
  ] : [];

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
          onClick={locateWithGps}
          aria-busy={isLocatingGps}
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
                aria-pressed={isSelected}
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
            <span>{getTranslation(language, 'map.overlay')}</span>
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

      <section className="border-t border-stone-200 p-4 sm:p-5" aria-labelledby="land-summary-title" aria-busy={isLoadingLand}>
        <h3 id="land-summary-title" className="text-base font-bold text-stone-900">{t('land.title')}</h3>
        {isLoadingLand && <p role="status" className="mt-2 text-sm text-stone-700">{t('land.loading')}</p>}
        {[gpsError, landError, telemetryError].filter((error): error is string => error !== null).map((error) => (
          <p key={error} role="alert" className="mt-2 text-sm font-semibold text-red-800">{t(error)}</p>
        ))}
        {(landError || telemetryError) && (
          <button type="button" onClick={() => void fetchTelemetry(selectedLocation.lat, selectedLocation.lon)}
            disabled={isLoadingLand || isLoadingTelemetry}
            className="mt-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {t('land.retry')}
          </button>
        )}
        {landSummary && (
          <>
            <p role="status" className="mt-2 text-sm font-bold text-amber-950">
              {t(Object.values(landSummary.provenance).some((entry) => entry.isSynthetic) ? 'land.syntheticNotice' : 'land.sampleNotice')}
            </p>
            <p className="mt-1 text-sm text-stone-800">{t('land.proxy')
              .replace('{hub}', () => landSummary.sampleHub.name)
              .replace('{distance}', () => landSummary.sampleHub.distanceKm.toFixed(1))}</p>
            <p className="mt-1 text-sm text-stone-700">{t('land.limitations')}</p>
            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {metrics.map((metric) => {
                const provenance = landSummary.provenance[metric.key];
                return (
                  <div key={metric.key} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <dt className="text-sm font-semibold text-stone-700">{metric.label}</dt>
                    <dd className="mt-1 break-words text-sm font-bold text-stone-950">{metric.value}</dd>
                    <dd className="mt-2 break-words text-xs text-stone-700">{[
                      provenance.source, provenance.variable,
                      provenance.spatialResolution ?? t('land.unknownResolution'),
                      provenance.dateRange ?? t('land.unknownPeriod')
                    ].join(' | ')}</dd>
                  </div>
                );
              })}
            </dl>
          </>
        )}
      </section>

      <form key={`${selectedLocation.lat},${selectedLocation.lon}`} className="border-t border-stone-200 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          void setCustomCoordinates(Number(values.get('lat')), Number(values.get('lon')));
        }}>
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-stone-900">{t('map.coordinateEntry')}</legend>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm font-semibold text-stone-800">
              {t('map.latitude')}
              <input name="lat" type="number" min="-90" max="90" step="any" required defaultValue={selectedLocation.lat}
                className="mt-1 w-full rounded-lg border border-stone-400 bg-white px-3 py-2 text-stone-950" />
            </label>
            <label className="min-w-0 flex-1 text-sm font-semibold text-stone-800">
              {t('map.longitude')}
              <input name="lon" type="number" min="-180" max="180" step="any" required defaultValue={selectedLocation.lon}
                className="mt-1 w-full rounded-lg border border-stone-400 bg-white px-3 py-2 text-stone-950" />
            </label>
            <button type="submit" className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">
              {t('map.applyCoordinates')}
            </button>
          </div>
        </fieldset>
      </form>

      {/* Footer Details & Confirm Step Action */}
      <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
            <span>{selectedLocation.name}</span>
            <span className="text-xs font-normal text-stone-500">· {selectedLocation.region}</span>
          </div>
          <div className="text-xs text-stone-500 mt-0.5 font-mono">
            {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E · {landSummary ? `${t('land.elevation')}: ~${landSummary.elevationM} m` : t('land.unknownElevation')}
          </div>
        </div>

        <button
          onClick={() => setCurrentStep(2)}
          disabled={isLoadingTelemetry || isLoadingLand}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold bg-[#1e3a2f] hover:bg-emerald-900 text-amber-300 flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span>{getTranslation(language, 'map.confirmLocation')}</span>
        </button>
      </div>
    </div>
  );
};
