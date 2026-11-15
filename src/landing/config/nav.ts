import type { NavItemConfig } from '../types';

export const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'home',
    labelKey: 'nav.home',
    href: '#',
    enabled: true
  },
  {
    id: 'how-it-works',
    labelKey: 'nav.howItWorks',
    href: '#planning-steps',
    enabled: true
  },
  {
    id: 'crop-guides',
    labelKey: 'nav.cropGuides',
    href: '#crop-guides',
    enabled: false
  },
  {
    id: 'soil-data',
    labelKey: 'nav.soilData',
    href: '#soil-data',
    enabled: false
  }
];
