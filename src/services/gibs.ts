export interface MapLayerConfig {
  id: string;
  name: { en: string; local: string };
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
  opacity?: number;
  isGibs: boolean;
  legendDescription?: { en: string; local: string };
}

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
      en: 'NASA GIBS: True Color Satellite (MODIS)',
      local: 'NASA GIBS: Tunay na Kulay mula sa Satelayt'
    },
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2024-04-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    attribution: 'Imagery courtesy of NASA EOSDIS GIBS (Terra / MODIS)',
    maxZoom: 9,
    isGibs: true,
    opacity: 0.95,
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
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/2024-04-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    attribution: 'Vegetation Index (NDVI) courtesy of NASA GIBS / Terra',
    maxZoom: 9,
    isGibs: true,
    opacity: 0.75,
    legendDescription: {
      en: 'Normalized Difference Vegetation Index: Dark green = vigorous vegetation; yellow/brown = fallow or dry soil.',
      local: 'Antas ng luntiang pananim: Madilim na berde = malusog; dilaw/kayumanggi = tuyot o walang pananim.'
    }
  }
};
