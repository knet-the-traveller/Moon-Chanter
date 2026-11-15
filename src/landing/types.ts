import type { FarmerPriorities } from '../types';

export type LandingLanguage = 'en' | 'tl';

export interface NavItemConfig {
  id: string;
  labelKey: string;
  href: string;
  enabled: boolean;
}

export interface ImageSlotConfig {
  id: 'hero' | 'why' | 'step1' | 'step2' | 'step3';
  devLabel: string;
  defaultGradient: string;
  width: number;
  height: number;
  defaultSrc?: string;
}

export interface GoalOption {
  key: keyof FarmerPriorities;
  label: {
    en: string;
    tl: string;
  };
}
