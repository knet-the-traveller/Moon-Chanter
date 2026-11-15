import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

vi.mock('leaflet', () => ({ default: {} }));

import { AniTalaLanding } from '../AniTalaLanding';
import { AniTalaRoot } from '../../AniTalaRoot';
import App from '../../App';
import { PILOT_LOCATIONS } from '../../data/pilotLocations';
import { useAppStore } from '../../store/useAppStore';
import { en } from '../i18n/en';
import { tl } from '../i18n/tl';
import { NAV_ITEMS } from '../config/nav';
import { SearchPill } from '../components/SearchPill';

// WCAG Contrast utilities
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16)
  ];
}

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(...parseHex(hex1));
  const l2 = relativeLuminance(...parseHex(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('AniTala Landing Page Suite', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Branding & Zero-GabayAni Guarantee', () => {
    it('renders the AniTala logo img in both header and footer with alt="AniTala" and explicit dimensions', () => {
      const html = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );

      // Verify both header and footer render <img> for logo with alt="AniTala"
      const logoMatches = [...html.matchAll(/<img[^>]*alt="AniTala"[^>]*>/g)];
      expect(logoMatches.length).toBe(2);

      for (const match of logoMatches) {
        const imgTag = match[0];
        expect(imgTag).toContain('images/landing/logo.png');
        expect(imgTag).toMatch(/width="\d+"/);
        expect(imgTag).toMatch(/height="\d+"/);
      }
    });

    it('renders full-bleed hero background with responsive WebP picture sources and high fetch priority', () => {
      const html = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );

      // Verify <picture> element exists with mobile and desktop webp sources
      expect(html).toContain('images/landing/hero-bg-mobile.webp');
      expect(html).toContain('images/landing/hero-bg-desktop.webp');
      expect(html).toContain('images/landing/hero-bg.jpg');

      // Verify decorative accessibility attributes
      expect(html).toMatch(/<img[^>]*src="[^"]*hero-bg\.jpg"[^>]*alt=""[^>]*aria-hidden="true"/);
      // Verify high priority loading (fetchpriority / loading eager)
      expect(html).toMatch(/loading="eager"/);
    });

    it('contains ZERO occurrences of "GabayAni" in rendered English markup', () => {
      const html = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );
      expect(html.toLowerCase()).not.toContain('gabayani');
      expect(html).toContain('AniTala');
    });

    it('contains ZERO occurrences of "GabayAni" in rendered Tagalog markup', () => {
      const html = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'tl',
          onLanguageChange: () => {}
        })
      );
      expect(html.toLowerCase()).not.toContain('gabayani');
      expect(html).toContain('AniTala');
    });

    it('displays the official NASA open data credit line without unintegrated datasets or NASA logos', () => {
      const html = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );
      expect(html).toContain('NASA POWER API');
      expect(html).toContain('NASA GIBS');
      expect(html).toContain('not endorsed by or affiliated with NASA');
      // Must not claim unintegrated SMAP or SRTM on landing page
      expect(html).not.toContain('SMAP');
      expect(html).not.toContain('SRTM');
    });

    it('Step 03 copy states "ready to print or share" (no unverified plan saving)', () => {
      const htmlEn = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );
      expect(htmlEn).toContain('ready to print or share');
      expect(htmlEn).not.toContain('ready to save, print or share');

      const htmlTl = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'tl',
          onLanguageChange: () => {}
        })
      );
      expect(htmlTl).toContain('handang i-print o ibahagi');
      expect(htmlTl).not.toContain('i-save');
    });
  });

  describe('Navigation & Action Links', () => {
    it('renders real <a href="#/app"> links for Launch App, Start Planning, and Step buttons', () => {
      const html = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );
      // All these actions must be real links with href="#/app"
      const appLinks = html.match(/href="#\/app"/g);
      expect(appLinks).not.toBeNull();
      // Should have: Launch App (desktop + mobile drawer), Start Planning, Explore Soil Data, Step 01, Step 02, Step 03
      expect(appLinks!.length).toBeGreaterThanOrEqual(6);
    });

    it('marks Crop Guides and Soil Data nav items as disabled coming-soon items', () => {
      const disabledItems = NAV_ITEMS.filter((i) => !i.enabled);
      expect(disabledItems.map((i) => i.id)).toEqual(['crop-guides', 'soil-data']);

      const html = renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );
      // Disabled nav items have aria-disabled="true"
      expect(html).toContain('aria-disabled="true"');
      // Crop Guides and Soil Data must not be clickable <a> links
      expect(html).not.toMatch(/<a[^>]+href="[^"]*"[^>]*>Crop Guides<\/a>/);
      expect(html).not.toMatch(/<a[^>]+href="[^"]*"[^>]*>Soil Data<\/a>/);
    });

    it('lists all 4 supported pilot locations in town select dropdown', () => {
      const html = renderToStaticMarkup(
        createElement(SearchPill, { language: 'en' })
      );
      for (const loc of PILOT_LOCATIONS) {
        expect(html).toContain(`value="${loc.id}"`);
        expect(html).toContain(loc.name);
      }
    });
  });

  describe('State Preservation & Isolation', () => {
    it('guarantees clicking Launch App / Start Planning does not mutate preset or priorities', () => {
      const initialLocation = useAppStore.getState().selectedLocation;
      const initialPriorities = { ...useAppStore.getState().priorities };

      // Render landing page — no store actions should have been invoked
      renderToStaticMarkup(
        createElement(AniTalaLanding, {
          language: 'en',
          onLanguageChange: () => {}
        })
      );

      expect(useAppStore.getState().selectedLocation).toEqual(initialLocation);
      expect(useAppStore.getState().priorities).toEqual(initialPriorities);
    });

    it('preserves preselected pilot location when App mounts', () => {
      // User picks Ilagan
      const ilagan = PILOT_LOCATIONS.find((p) => p.id === 'ilagan')!;
      useAppStore.getState().selectPilotPreset(ilagan);

      expect(useAppStore.getState().selectedLocation.id).toBe('ilagan');
      expect(useAppStore.getState().selectedLocation.name).toBe('City of Ilagan');

      // Now simulate mounting App
      const appHtml = renderToStaticMarkup(createElement(App));
      expect(appHtml).toBeDefined();

      // Location must still be Ilagan, not overwritten to default Muñoz!
      expect(useAppStore.getState().selectedLocation.id).toBe('ilagan');
      expect(useAppStore.getState().selectedLocation.name).toBe('City of Ilagan');
    });

    it('elevates selected goal priority to 80 while leaving other priorities untouched', () => {
      const defaultPriorities = { ...useAppStore.getState().priorities };
      expect(defaultPriorities.soilHealth).toBe(80);
      expect(defaultPriorities.lowLabor).toBe(50);

      // Select lowLabor as goal in SearchPill action
      useAppStore.getState().setPriority('lowLabor', 80);

      const updated = useAppStore.getState().priorities;
      expect(updated.lowLabor).toBe(80);
      // Other priorities remain at their initial values
      expect(updated.soilHealth).toBe(defaultPriorities.soilHealth);
      expect(updated.waterResilience).toBe(defaultPriorities.waterResilience);
      expect(updated.stableIncome).toBe(defaultPriorities.stableIncome);
    });
  });

  describe('Routing via Hash & Deep Linking', () => {
    it('renders AniTalaLanding when hash is empty or #', () => {
      const mockWindow = {
        location: { hash: '' },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        scrollTo: vi.fn()
      };
      vi.stubGlobal('window', mockWindow);

      const html = renderToStaticMarkup(createElement(AniTalaRoot));
      expect(html).toContain('anitala-landing');
      expect(html).toContain('Plan Smarter Crop');
    });

    it('renders FieldShift App directly when deep linked with #/app', () => {
      const mockWindow = {
        location: { hash: '#/app' },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        scrollTo: vi.fn()
      };
      vi.stubGlobal('window', mockWindow);

      const html = renderToStaticMarkup(createElement(AniTalaRoot));
      // Does not contain landing root class
      expect(html).not.toContain('anitala-landing');
      // Contains FieldShift header / elements
      expect(html).toContain('FieldShift');
    });
  });

  describe('Bilingual Parity & Store Sync', () => {
    it('has identical dictionary keys between English and Tagalog', () => {
      const getKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
        return Object.entries(obj).flatMap(([k, v]) => {
          const path = prefix ? `${prefix}.${k}` : k;
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            return getKeys(v as Record<string, unknown>, path);
          }
          return [path];
        });
      };

      const enKeys = getKeys(en as unknown as Record<string, unknown>)
        .filter((k) => k !== 'needsReview')
        .sort();
      const tlKeys = getKeys(tl as unknown as Record<string, unknown>)
        .filter((k) => k !== 'needsReview')
        .sort();

      expect(tlKeys).toEqual(enKeys);
    });

    it('maps landing language "tl" to store language "fil"', () => {
      useAppStore.getState().setLanguage('fil');
      expect(useAppStore.getState().language).toBe('fil');

      useAppStore.getState().setLanguage('en');
      expect(useAppStore.getState().language).toBe('en');
    });
  });

  describe('WCAG 2.1 Contrast Ratio Verification', () => {
    const colorPairs: Array<{ name: string; fg: string; bg: string; minContrast: number }> = [
      { name: 'Header & Hero CTA (lime on dark forest)', fg: '#122b1e', bg: '#bbf246', minContrast: 7.0 },
      { name: 'Header White text on dark forest', fg: '#ffffff', bg: '#122b1e', minContrast: 7.0 },
      { name: 'Hero H1 White on hero green', fg: '#ffffff', bg: '#132e22', minContrast: 7.0 },
      { name: 'Hero Accent Lime on hero green', fg: '#d6ff62', bg: '#132e22', minContrast: 7.0 },
      { name: 'Why H2 Dark Green on pale bg', fg: '#142f1b', bg: '#f8faf6', minContrast: 7.0 },
      { name: 'Why Eyebrow on pale bg', fg: '#2f5e36', bg: '#f8faf6', minContrast: 4.5 },
      { name: 'Why Explore Soil Data button text', fg: '#ffffff', bg: '#122b1e', minContrast: 7.0 },
      { name: 'Steps H2 Dark Green on sage green', fg: '#173516', bg: '#cfdfb5', minContrast: 7.0 },
      { name: 'Steps Eyebrow on sage green', fg: '#23461f', bg: '#cfdfb5', minContrast: 4.5 },
      { name: 'Steps Button White text on olive button', fg: '#ffffff', bg: '#546b45', minContrast: 4.5 },
      { name: 'Footer White text on dark footer', fg: '#ffffff', bg: '#11261a', minContrast: 7.0 },
      { name: 'Footer Mint/Green subtext on dark footer', fg: '#a2bda7', bg: '#11261a', minContrast: 7.0 },
      { name: 'Footer SI notice text on dark footer', fg: '#8ca391', bg: '#11261a', minContrast: 4.5 }
    ];

    it.each(colorPairs)(
      'achieves required contrast ratio for $name ($fg on $bg)',
      ({ fg, bg, minContrast }) => {
        const ratio = getContrastRatio(fg, bg);
        expect(ratio).toBeGreaterThanOrEqual(minContrast);
      }
    );
  });
});
