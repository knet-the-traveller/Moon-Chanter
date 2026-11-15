import { en } from './en';
import { tl } from './tl';
import type { LandingLanguage } from '../types';
import type { Language } from '../../types';

export const landingTranslations = {
  en,
  tl
};

export function getLandingTranslation(lang: LandingLanguage) {
  return landingTranslations[lang] || landingTranslations.en;
}

export function toStoreLanguage(lang: LandingLanguage): Language {
  return lang === 'tl' ? 'fil' : 'en';
}

export function fromStoreLanguage(lang: Language): LandingLanguage {
  return lang === 'fil' ? 'tl' : 'en';
}
