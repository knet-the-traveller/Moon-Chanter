import { exampleProfile } from '../services/demoVegetation';
import { formatProvenance } from '../data/provenance';
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { PILOT_LOCATIONS } from '../data/pilotLocations';
import { GIBS_SATELLITE_BASE, MAP_LAYERS, resolveMapLayer } from '../services/gibs';
import { addPlaceLabels } from './mapPlaceLabels';
import { hideEmptyTrueColorTile } from './imageryTiles';
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
    useDemoAssumptions,
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
    fetchTelemetry,
    isMapExpanded,
    setMapExpanded
  } = useAppStore();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const activeTileLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteBaseRef = useRef<L.TileLayer | null>(null);
  const standardBaseRef = useRef<L.TileLayer | null>(null);
  const referenceLabelsRef = useRef<ReturnType<typeof addPlaceLabels> | null>(null);

  const [currentLayer, setCurrentLayer] = useState(MAP_LAYERS.osm);
  const activeLayerKey = currentLayer.id;
  const [imageryError, setImageryError] = useState(false);
  const [labelsError, setLabelsError] = useState(false);

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
    // The pane's CSS places labels above imagery and below markers/popups.
    map.createPane('satellite-labels');

    // Keep OSM underneath satellite overlays for missing or failed imagery tiles.
    const initialLayerConfig = MAP_LAYERS.osm;
    standardBaseRef.current = L.tileLayer(initialLayerConfig.url, {
      attribution: initialLayerConfig.attribution,
      maxZoom: initialLayerConfig.maxZoom,
      subdomains: initialLayerConfig.subdomains || ['a', 'b', 'c']
    }).addTo(map);

    // Custom Map Marker using inline SVG DivIcon
    const customIcon = L.divIcon({
      className: 'custom-field-marker',
      html: `
        <div style="
          background-color: #1D3309;
          border: 3px solid #C7DA91;
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
            background-color: #F7F9F4;
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
      activeTileLayerRef.current = null;
      satelliteBaseRef.current = null;
      standardBaseRef.current = null;
      referenceLabelsRef.current?.remove();
      referenceLabelsRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
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
    const config = resolveMapLayer(layerKey, Date.now());
    if (!config) return;

    if (activeTileLayerRef.current) {
      const previousLayer = activeTileLayerRef.current;
      activeTileLayerRef.current = null;
      mapInstanceRef.current.removeLayer(previousLayer);
    }
    referenceLabelsRef.current?.remove();
    referenceLabelsRef.current = null;
    if (satelliteBaseRef.current) mapInstanceRef.current.removeLayer(satelliteBaseRef.current);
    satelliteBaseRef.current = null;
    setImageryError(false);
    setLabelsError(false);
    setCurrentLayer(config);
    mapInstanceRef.current.setMaxZoom(Math.min(MAX_MAP_ZOOM, config.maxZoom));

    standardBaseRef.current?.setOpacity(config.isGibs ? 0 : 1);
    if (!config.isGibs) return;

    const satelliteBase = L.tileLayer(GIBS_SATELLITE_BASE.url, {
      attribution: GIBS_SATELLITE_BASE.attribution,
      maxZoom: config.maxZoom, maxNativeZoom: GIBS_SATELLITE_BASE.maxNativeZoom
    });
    satelliteBase.on('tileerror', () => {
      if (satelliteBaseRef.current !== satelliteBase) return;
      standardBaseRef.current?.setOpacity(1);
      setImageryError(true);
    });
    satelliteBaseRef.current = satelliteBase;
    satelliteBase.addTo(mapInstanceRef.current);

    const newLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: config.maxZoom,
      maxNativeZoom: config.maxNativeZoom,
      crossOrigin: config.id === 'gibsTrueColor' ? 'anonymous' : false,
      opacity: config.opacity ?? 1.0,
      subdomains: config.subdomains || ['a', 'b', 'c']
    });

    newLayer.on('tileerror', () => {
      if (activeTileLayerRef.current === newLayer) setImageryError(true);
    });
    if (config.id === 'gibsTrueColor') {
      newLayer.on('tileload', (event: L.TileEvent) => {
        if (activeTileLayerRef.current === newLayer && hideEmptyTrueColorTile(event.tile as HTMLImageElement)) {
          setImageryError(true);
        }
      });
    }

    activeTileLayerRef.current = newLayer;
    newLayer.addTo(mapInstanceRef.current);

    const labels = addPlaceLabels(mapInstanceRef.current);
    referenceLabelsRef.current = labels;
    setLabelsError(!labels.available);
  };

  const langKey = language === 'fil' ? 'local' : 'en';

  const t = (key: string) => getTranslation(language, key);
  const months = landSummary?.bareFieldMonths.map((month) =>
    new Intl.DateTimeFormat(language === 'fil' ? 'fil-PH' : 'en-PH', { month: 'short', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2000, month - 1, 1)))).join(', ');
  const unavailable = t('provenance.unavailableValue');
  const metrics: Array<{ key: LandMetric; label: string; value: string }> = landSummary ? [
    { key: 'elevationM', label: t('land.elevation'), value: landSummary.elevationM === null ? unavailable : `${landSummary.elevationM} m` },
    { key: 'slopePct', label: t('land.slope'), value: landSummary.slopePct === null ? unavailable : `${landSummary.slopePct}%` },
    { key: 'floodProne', label: t('land.flood'), value: landSummary.floodProne === null ? unavailable : t(landSummary.floodProne ? 'mvp.lowlandFlag' : 'mvp.lowlandOutside') },
    { key: 'bareFieldMonths', label: t('land.bareMonths'), value: landSummary.provenance.bareFieldMonths.tier === 'unavailable' ? t('mvp.noLandNdvi') : months || t('mvp.noLowGreenness') },
    { key: 'rusleErosionRiskTonsHaYr', label: t(landSummary.screening ? 'mvp.erosionTitle' : 'land.erosion'), value: landSummary.screening?.erosionConcern ? t(`mvp.erosion.${landSummary.screening.erosionConcern}`) : landSummary.rusleErosionRiskTonsHaYr === null ? unavailable : `${landSummary.rusleErosionRiskTonsHaYr.toFixed(1)} ${t('land.erosionUnit')}` },
    { key: 'ndvi.seasonalMean', label: t('land.monthlyNdvi'), value: landSummary.ndvi.seasonalMean.every(v=>v===null) ? t('mvp.noLandNdvi') : landSummary.ndvi.seasonalMean.map((value) => value === null ? t('mvp.gap') : value.toFixed(2)).join(', ') },
    { key: 'ndvi.trend', label: t('land.ndviTrend'), value: landSummary.ndvi.trendAvailable
      ? `${landSummary.ndvi.trend.toFixed(3)} ${t('land.trendUnit')}` : t('land.insufficientTrendData') }
  ] : [];

  const metricProvenance = (key: LandMetric) => key === 'rusleErosionRiskTonsHaYr' && landSummary?.screening
    ? { ...landSummary.provenance.slopePct, variable: 'SRTM slope → qualitative erosion concern', unit: 'class', methodKey: 'mvp.erosionMethod' }
    : landSummary!.provenance[key];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Presets + Location Confirmed + Coordinates + LandSummary */}
        <div className="lg:col-span-5 space-y-4">
          {/* Quick-Pick a Farming Town */}
          <section className="bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs">
            <h2 className="text-sm sm:text-base font-bold text-at-dk flex items-center gap-2">
              <Info className="w-4 h-4 text-at-amber" />
              <span>{getTranslation(language, 'map.presets')}</span>
            </h2>
            <p className="text-xs text-at-muted mt-1 mb-3">
              {getTranslation(language, 'map.subtitle')}
            </p>
            <div className="flex flex-wrap gap-2" id="towns">
              {PILOT_LOCATIONS.map((pilot) => {
                const isSelected = selectedLocation.id === pilot.id;
                return (
                  <button
                    key={pilot.id}
                    type="button"
                    onClick={() => selectPilotPreset(pilot)}
                    aria-pressed={isSelected}
                    className={`chip px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isSelected
                        ? 'on bg-at-dk text-white border-at-dk shadow-xs ring-2 ring-at-dk/20 font-semibold'
                        : 'bg-at-ow text-at-dk border-at-line hover:bg-at-tint'
                    }`}
                  >
                    <span>{isSelected ? '✓ ' : ''}{pilot.name}</span>
                    <span className="text-[10px] opacity-75">({pilot.province})</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Location Confirmed card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs flex items-start gap-3">
            <MapPin className="w-5 h-5 text-at-green shrink-0 mt-0.5" />
            <div>
              <span className="ok inline-flex items-center gap-1 bg-at-tint text-at-dk rounded-full px-2.5 py-0.5 text-xs font-bold border border-at-line">
                ✓ {t('map.selectedCoords')}
              </span>
              <b className="block text-sm font-bold text-at-dk mt-1.5">
                {selectedLocation.name}
              </b>
              <small className="block text-xs text-at-muted mt-0.5">
                {selectedLocation.province} · {selectedLocation.lat.toFixed(4)}° N, {selectedLocation.lon.toFixed(4)}° E
              </small>
            </div>
          </div>

          {/* Coordinate Entry Form */}
          <form
            key={`${selectedLocation.lat},${selectedLocation.lon}`}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              void setCustomCoordinates(Number(values.get('lat')), Number(values.get('lon')));
            }}
          >
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-at-dk">{t('map.coordinateEntry')}</legend>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-at-dk">
                  {t('map.latitude')}
                  <input
                    name="lat"
                    type="number"
                    min="-90"
                    max="90"
                    step="any"
                    required
                    defaultValue={selectedLocation.lat}
                    className="mt-1 w-full rounded-xl border border-at-line bg-at-ow px-3 py-2 text-sm text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk"
                  />
                </label>
                <label className="min-w-0 flex-1 text-xs sm:text-sm font-semibold text-at-dk">
                  {t('map.longitude')}
                  <input
                    name="lon"
                    type="number"
                    min="-180"
                    max="180"
                    step="any"
                    required
                    defaultValue={selectedLocation.lon}
                    className="mt-1 w-full rounded-xl border border-at-line bg-at-ow px-3 py-2 text-sm text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-xl bg-at-dk px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-at-dk/90 focus-visible:outline-2 focus-visible:outline-at-dk cursor-pointer shadow-xs"
                >
                  {t('map.applyCoordinates')}
                </button>
              </div>
            </fieldset>
          </form>

          {/* Land Summary */}
          <section
            className="bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs"
            aria-labelledby="land-summary-title"
            aria-busy={isLoadingLand}
          >
            <h3 id="land-summary-title" className="text-base font-bold text-at-dk">{t('land.title')}</h3>
            {isLoadingLand && <p role="status" className="mt-2 text-sm text-at-muted">{t('land.loading')}</p>}
            {[gpsError, landError, telemetryError].filter((error): error is string => error !== null).map((error) => (
              <p key={error} role="alert" className="mt-2 text-sm font-semibold text-red-800">{t(error)}</p>
            ))}
            {(landError || telemetryError) && (
              <button
                type="button"
                onClick={() => void fetchTelemetry(selectedLocation.lat, selectedLocation.lon)}
                disabled={isLoadingLand || isLoadingTelemetry}
                className="mt-2 rounded-xl bg-at-dk px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
              >
                {t('land.retry')}
              </button>
            )}
            {landSummary && (
              <>
                <p role="status" className="mt-2 text-sm font-bold text-at-amber">
                  {t(!landSummary.isSample ? 'land.realNotice' : Object.values(landSummary.provenance).some((entry) => entry.isSynthetic) ? 'land.syntheticNotice' : 'land.sampleNotice')}
                </p>
                <p className="mt-1 text-sm text-at-dk">
                  {t(landSummary.isSample ? 'land.proxy' : 'land.gridReference')
                    .replace('{hub}', () => landSummary.sampleHub.name)
                    .replace('{distance}', () => landSummary.sampleHub.distanceKm.toFixed(1))}
                </p>
                <p className="mt-1 text-sm text-at-muted">
                  {t(landSummary.isSample ? 'land.limitations' : 'land.realLimitations')}
                </p>
                {landSummary.ndvi.evidence && (
                  <p className="mt-2 text-sm text-at-muted">
                    {t('land.ndviCoverage').replace('{accepted}', String(landSummary.ndvi.evidence.accepted)).replace('{total}', String(landSummary.ndvi.evidence.total))}
                  </p>
                )}
                <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metrics.filter(metric => metric.key !== 'ndvi.trend').map((metric) => {
                    const provenance = metricProvenance(metric.key);
                    return (
                      <div key={metric.key} className="min-w-0 rounded-xl border border-at-line bg-at-tint/40 p-3">
                        <dt className="text-xs font-semibold text-at-muted">{metric.label}</dt>
                        <dd className="mt-1 break-words text-sm font-bold text-at-dk">{metric.value}</dd>
                        <dd className="mt-2 break-words text-[11px] text-at-muted">
                          {[provenance.source, provenance.dateRange ?? provenance.spatialResolution, t('provenance.reviewShort')]
                            .filter(Boolean)
                            .join(' · ')}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {useDemoAssumptions && landSummary.ndvi.seasonalMean.every(v => v === null) && (
                  <details className="mt-3 rounded-xl border border-at-warn-border/30 bg-at-warn-bg p-3 text-sm text-at-warn-text">
                    <summary className="cursor-pointer font-semibold">{t('mvp.exampleNdvi')}</summary>
                    <p className="mt-2">{t('mvp.exampleNdviHelp')}</p>
                    <p className="mt-1">{exampleProfile(landSummary.sampleHub.id).join(', ')}</p>
                  </details>
                )}
                {landSummary.screening && <p className="mt-3 text-sm text-at-muted">{t('mvp.screenLimit')}</p>}
                <details className="mt-4 rounded-xl border border-at-line bg-at-ow p-3 text-xs text-at-dk break-words">
                  <summary className="cursor-pointer py-1 font-semibold text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk">{t('mvp.landDetails')}</summary>
                  <p className="mt-2 font-semibold">{t('land.ndviTrend')}: {landSummary.ndvi.trendAvailable ? landSummary.ndvi.trend : t('land.insufficientTrendData')}</p>
                  <ul className="mt-2 space-y-2 break-words text-xs text-at-muted">
                    {metrics.map(metric => (
                      <li key={metric.key}>
                        {formatProvenance(language, { ...metricProvenance(metric.key), sampleLocation: metricProvenance(metric.key).sampleLocation ?? { name: landSummary.sampleHub.name } })}
                      </li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </section>
        </div>

        {/* Right Column: Map Card & Confirm CTA */}
        <div className="lg:col-span-7 space-y-4">
          <div className={isMapExpanded ? 'fixed inset-0 z-50 bg-at-ow flex flex-col p-3 sm:p-5' : 'bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs'}>
            {isMapExpanded ? (
              <div className="flex items-center justify-between pb-3 border-b border-at-line/60 gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-black text-at-dk tracking-tight text-lg">AniTala</span>
                  <span className="text-xs text-at-muted">· {selectedLocation.name} ({selectedLocation.province})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMapExpanded(false)}
                  className="min inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-at-dk text-at-dk hover:bg-at-tint transition-colors cursor-pointer"
                >
                  ✕ <span>{getTranslation(language, 'map.minimizeMap')}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between pb-3 border-b border-at-line/50 gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-at-dk flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-at-green" />
                    {t('map.title')}
                  </h2>
                  <p className="text-xs text-at-muted mt-0.5">{t('map.subtitle')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMapExpanded(true)}
                  className="chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-at-ow hover:bg-at-tint text-at-dk border border-at-line transition-colors cursor-pointer"
                >
                  <span>⛶ {getTranslation(language, 'map.expandMap')}</span>
                </button>
              </div>
            )}

            {/* Map Canvas & Controls */}
            <div className={`relative w-full rounded-xl overflow-hidden border border-at-line my-3 ${isMapExpanded ? 'flex-1 min-h-[300px]' : 'h-[380px] sm:h-[460px]'}`}>
              <div ref={mapContainerRef} className="h-full w-full" />

              {/* GPS Button */}
              <button
                type="button"
                onClick={locateWithGps}
                aria-busy={isLocatingGps}
                disabled={isLocatingGps}
                className="absolute top-3 left-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-at-dk border border-at-line hover:bg-at-tint shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Navigation className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin' : ''}`} />
                <span>
                  {isLocatingGps
                    ? getTranslation(language, 'map.gpsLocating')
                    : getTranslation(language, 'map.gpsButton')}
                </span>
              </button>

              {/* Floating Layer Switcher */}
              <div data-map-layer-switcher className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-at-line text-xs flex flex-col gap-1">
                <div className="px-2 py-1 font-semibold text-at-muted text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <Layers className="w-3 h-3 text-at-dk" />
                  <span>{getTranslation(language, 'map.overlay')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleLayerSwitch('osm')}
                  className={`px-2.5 py-1 rounded-md text-left font-medium transition-colors cursor-pointer ${
                    activeLayerKey === 'osm'
                      ? 'bg-at-dk text-white font-semibold'
                      : 'text-at-dk hover:bg-at-tint'
                  }`}
                >
                  {getTranslation(language, 'map.layerOsm')}
                </button>
                <button
                  type="button"
                  onClick={() => handleLayerSwitch('gibsTrueColor')}
                  className={`px-2.5 py-1 rounded-md text-left font-medium transition-colors cursor-pointer ${
                    activeLayerKey === 'gibsTrueColor'
                      ? 'bg-at-dk text-white font-semibold'
                      : 'text-at-dk hover:bg-at-tint'
                  }`}
                >
                  {getTranslation(language, 'map.layerGibsTrueColor')}
                </button>
                <button
                  type="button"
                  onClick={() => handleLayerSwitch('gibsNdvi')}
                  className={`px-2.5 py-1 rounded-md text-left font-medium transition-colors cursor-pointer ${
                    activeLayerKey === 'gibsNdvi'
                      ? 'bg-at-dk text-white font-semibold'
                      : 'text-at-dk hover:bg-at-tint'
                  }`}
                >
                  {getTranslation(language, 'map.layerGibsNdvi')}
                </button>
              </div>
            </div>

            {/* NDVI Legend Strip */}
            {currentLayer?.id === 'gibsNdvi' && (
              <div className="flex flex-wrap items-center gap-3 bg-at-tint/50 border border-at-line rounded-xl px-3 py-1.5 text-xs text-at-dk mb-2">
                <span className="font-bold">NDVI:</span>
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[#EAB308] inline-block" />
                  Low / Fallow
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[#A7BD40] inline-block" />
                  Moderate
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="w-2.5 h-2.5 rounded-full bg-[#1D6F42] inline-block" />
                  High Vigor
                </span>
              </div>
            )}

            {/* Satellite Legend details */}
            {currentLayer?.isGibs && (
              <div className="bg-white text-at-dk text-xs leading-relaxed p-3.5 border border-at-line rounded-xl mt-1">
                <div className="text-sm font-bold text-at-dk">
                  {currentLayer.name[langKey]}
                </div>
                <div className="text-at-muted mt-1">
                  {currentLayer.legendDescription?.[langKey]}
                </div>
                <p className="mt-1 text-at-muted">{t('map.satelliteDetail')}</p>
                <p className="mt-1 text-at-muted">{t('map.satelliteBackground')}</p>
                <p className="mt-1 text-at-muted">{t('map.placeNamesSource')}</p>
                {currentLayer.observationDate && (
                  <p className="mt-2 border-t border-at-line pt-2 font-medium text-at-dk">
                    {t('map.imageryDate')}: {currentLayer.observationDate === 'default'
                      ? t('map.latestNdvi') : `${currentLayer.observationDate} UTC`}
                  </p>
                )}
              </div>
            )}

            {currentLayer?.isGibs && (imageryError || labelsError) && (
              <div className="border border-at-warn-border/30 bg-at-warn-bg p-3.5 rounded-xl text-xs text-at-warn-text mt-2">
                {imageryError && <p role="alert">{t('map.imageryUnavailable')}</p>}
                {labelsError && <p role="alert">{t('map.labelsUnavailable')}</p>}
                <button
                  type="button"
                  onClick={() => handleLayerSwitch(activeLayerKey)}
                  className="mt-2 rounded-lg bg-at-warn-border px-3 py-1.5 font-semibold text-white hover:bg-amber-700 cursor-pointer"
                >
                  {t('map.retryImagery')}
                </button>
              </div>
            )}

            {isMapExpanded && (
              /* Bottom drawer in full-screen mode */
              <div className="confirm bg-white rounded-2xl border border-at-line shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-auto">
                <div>
                  <small className="text-[10px] font-bold tracking-wider text-at-muted uppercase">⌖ {t('map.selectedCoords')}</small>
                  <b className="block text-sm font-bold text-at-dk mt-0.5">{selectedLocation.name}, {selectedLocation.province}</b>
                  <p className="text-xs text-at-muted font-mono">{selectedLocation.lat.toFixed(4)}° N, {selectedLocation.lon.toFixed(4)}° E</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setMapExpanded(false); setCurrentStep(2); }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold bg-at-dk text-at-lime flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  ✓ <span>{t('map.confirmLocation')}</span>
                </button>
              </div>
            )}
          </div>

          {!isMapExpanded && (
            <div className="action bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-at-dk flex items-center gap-1.5">
                  <span>{selectedLocation.name}</span>
                  <span className="text-xs font-normal text-at-muted">· {selectedLocation.region}</span>
                </div>
                <div className="text-xs text-at-muted mt-0.5 font-mono">
                  {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E · {landSummary?.elevationM != null ? `${t('land.elevation')}: ~${landSummary.elevationM} m` : t('land.unknownElevation')}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={isLoadingTelemetry || isLoadingLand}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold bg-at-dk hover:bg-at-dk/90 text-at-lime flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-at-lime-bright" />
                <span>{getTranslation(language, 'map.confirmLocation')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
