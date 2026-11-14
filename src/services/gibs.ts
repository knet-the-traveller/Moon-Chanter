export interface MapLayerConfig {
  id: string;
  name: { en: string; local: string };
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
  subdomains?: string[];
  opacity?: number;
  isGibs: boolean;
  observationDate?: string;
  legendDescription?: { en: string; local: string };
}

// Clean, unlabeled NASA background prevents street-map text bleeding through NDVI gaps.
export const GIBS_SATELLITE_BASE = {
  url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
  attribution: 'Background courtesy of NASA GIBS / Blue Marble',
  maxNativeZoom: 8,
  maxZoom: 13
};

export const MAP_LAYERS: Record<string, MapLayerConfig> = {
  osm: {
    id: 'osm',
    name: {
      en: 'Standard Agro-Map',
      local: 'Karaniwang Mapa'
    },
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    isGibs: false
  },
  gibsTrueColor: {
    id: 'gibsTrueColor',
    name: {
      en: 'NASA GIBS: True Color Satellite (NOAA-20 / VIIRS)',
      local: 'NASA GIBS: Tunay na Kulay (NOAA-20 / VIIRS)'
    },
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    attribution: 'Imagery courtesy of NASA EOSDIS GIBS (NOAA-20 / VIIRS)',
    maxZoom: 13,
    maxNativeZoom: 9,
    isGibs: true,
    observationDate: 'default',
    opacity: 1,
    legendDescription: {
      en: 'Real optical satellite reflectance showing field vegetation and topography.',
      local: 'Retrato mula sa kalawakan na nagpapakita ng halaman at lupain.'
    }
  },
  gibsNdvi: {
    id: 'gibsNdvi',
    name: {
      en: 'NASA GIBS: Vegetation Greenness (NDVI)',
      local: 'NASA GIBS: Luntiang Halaman (NDVI)'
    },
    // NASA's published default-time alias follows this rolling product's available imagery.
    // See https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    attribution: 'Vegetation Index (NDVI) courtesy of NASA GIBS / Terra',
    maxZoom: 13,
    maxNativeZoom: 9,
    isGibs: true,
    observationDate: 'default',
    opacity: 1,
    legendDescription: {
      en: 'Normalized Difference Vegetation Index: Dark green = vigorous vegetation; yellow/brown = fallow or dry soil.',
      local: 'Antas ng luntiang pananim: Madilim na berde = malusog; dilaw/kayumanggi = tuyot o walang pananim.'
    }
  }
};

// Use the completed UTC day rather than the provider's potentially incomplete current day.
// Called from layer-selection events; never read the clock during render.
export function resolveMapLayer(key: string, now: number): MapLayerConfig | undefined {
  if (!Object.hasOwn(MAP_LAYERS, key)) return undefined;
  const layer = MAP_LAYERS[key];
  if (!layer || key !== 'gibsTrueColor') return layer;
  const date = new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { ...layer, observationDate: date, url: layer.url.replace('/default/default/', `/default/${date}/`) };
}
