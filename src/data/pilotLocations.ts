import type { PilotLocation } from '../types';

export const PILOT_LOCATIONS: PilotLocation[] = [
  {
    id: 'munoz',
    name: 'Science City of Muñoz',
    province: 'Nueva Ecija',
    region: 'Central Luzon (Region III)',
    lat: 15.71715,
    lon: 120.90643,
    elevationMeters: 58,
    description: {
      en: 'National Rice Granary & PhilRice Hub. High-input lowland paddies with sharp wet/dry seasonal divide.',
      fil: 'Kamalig ng Bigas ng Bansa at Sentro ng PhilRice. Palayan na may matinding pagkakaiba ng tag-ulan at tag-araw.'
    }
  },
  {
    id: 'ilagan',
    name: 'City of Ilagan',
    province: 'Isabela',
    region: 'Cagayan Valley (Region II)',
    lat: 16.975,
    lon: 121.810,
    elevationMeters: 46,
    description: {
      en: 'Corn & Grain Capital of the Philippines. River basin alluvial soils, high suitability for corn-legume rotation.',
      fil: 'Kabisera ng Mais at Butil sa Pilipinas. Matabang lupang alluvial, mainam sa salitang mais at munggo.'
    }
  },
  {
    id: 'pototan',
    name: 'Pototan',
    province: 'Iloilo',
    region: 'Western Visayas (Region VI)',
    lat: 10.952,
    lon: 122.632,
    elevationMeters: 22,
    description: {
      en: 'Panay Agricultural Breadbasket. Mixed rainfed & irrigated paddies prone to severe El Niño dry spells.',
      fil: 'Kamalig ng Panay. Pinaghalong sahod-ulan at may patubig na madalas tamaan ng matinding tagtuyot.'
    }
  },
  {
    id: 'bukidnon',
    name: 'Malaybalay City',
    province: 'Bukidnon',
    region: 'Northern Mindanao (Region X)',
    lat: 8.15558,
    lon: 125.12834,
    elevationMeters: 620,
    description: {
      en: 'Highland agro-ecological plateau with volcanic soils. Suitable for high-value vegetables and root crops.',
      fil: 'Mataas na talampas na may lupang bulkaniko. Mainam sa mga gulay at lamang-lupa.'
    }
  }
];

export const PHILIPPINES_BOUNDS = {
  minLat: 4.5,
  maxLat: 21.5,
  minLon: 116.0,
  maxLon: 127.0,
  defaultCenter: [15.71715, 120.90643] as [number, number],
  defaultZoom: 7
};
