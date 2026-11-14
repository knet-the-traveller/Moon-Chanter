import en from './en.json';
import fil from './fil.json';
import type { Language } from '../types';

export const translations = {
  en,
  fil
};

export type TranslationKey = string;

export function getTranslation(lang: Language, path: string): string {
  const dict = translations[lang] || translations.en;
  const parts = path.split('.');
  let current: unknown = dict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      // Fall back to English
      let fallback: unknown = translations.en;
      for (const p of parts) {
        if (fallback && typeof fallback === 'object' && p in fallback) {
          fallback = (fallback as Record<string, unknown>)[p];
        } else {
          return path;
        }
      }
      return typeof fallback === 'string' ? fallback : path;
    }
  }

  return typeof current === 'string' ? current : path;
}
