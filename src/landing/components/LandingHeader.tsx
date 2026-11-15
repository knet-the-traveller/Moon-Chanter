import React, { useState } from 'react';
import type { LandingLanguage } from '../types';
import { NAV_ITEMS } from '../config/nav';
import { getLandingTranslation } from '../i18n';

interface LandingHeaderProps {
  language: LandingLanguage;
  onLanguageChange: (lang: LandingLanguage) => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
  language,
  onLanguageChange
}) => {
  const t = getLandingTranslation(language);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault();
      setMobileMenuOpen(false);
      if (href === '#' || href === '#top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#122b1e] border-b border-white/10 text-white select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Tagline */}
        <a
          href="#top"
          onClick={(e) => handleNavClick(e, '#top')}
          className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-[#bbf246] rounded-lg p-1"
          aria-label="AniTala - Home"
        >
          <div className="w-8 h-8 rounded-lg bg-[#bbf246] flex items-center justify-center text-[#122b1e] shadow-sm">
            {/* Sprout Icon */}
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 20h10" />
              <path d="M10 20c0-4.5 1-8 6-9" />
              <path d="M16 11c0-4.5-3.5-7-8-7-1.5 0-2.5.5-3 1 1 2 2 4.5 2 7.5" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight tracking-tight text-white group-hover:text-[#bbf246] transition-colors">
              AniTala
            </span>
            <span className="text-[10px] tracking-wide text-white/70 font-normal">
              Simple Crop &amp; Soil Guide
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav
          className="hidden md:flex items-center gap-6"
          aria-label={t.a11y.headerNav}
        >
          {NAV_ITEMS.map((item) => {
            const label =
              item.id === 'home'
                ? t.nav.home
                : item.id === 'how-it-works'
                ? t.nav.howItWorks
                : item.id === 'crop-guides'
                ? t.nav.cropGuides
                : t.nav.soilData;

            if (!item.enabled) {
              return (
                <span
                  key={item.id}
                  className="text-xs font-medium text-white/40 cursor-not-allowed flex items-center gap-1.5"
                  aria-disabled="true"
                  title={t.nav.comingSoon}
                >
                  {label}
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/50">
                    Soon
                  </span>
                </span>
              );
            }

            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="text-sm font-medium text-white/80 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#bbf246] rounded px-1.5 py-0.5"
              >
                {label}
              </a>
            );
          })}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Language Selector Pill */}
          <div
            className="flex items-center bg-[#0a1a12] border border-white/20 rounded-full p-0.5 text-xs font-medium"
            role="group"
            aria-label={t.a11y.languageSelector}
          >
            <button
              type="button"
              onClick={() => onLanguageChange('en')}
              className={`px-2.5 py-1 rounded-full transition-all ${
                language === 'en'
                  ? 'bg-white text-[#122b1e] font-semibold shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
              aria-pressed={language === 'en'}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onLanguageChange('tl')}
              className={`px-2.5 py-1 rounded-full transition-all ${
                language === 'tl'
                  ? 'bg-white text-[#122b1e] font-semibold shadow-xs'
                  : 'text-white/70 hover:text-white'
              }`}
              aria-pressed={language === 'tl'}
            >
              Tagalog
            </button>
          </div>

          {/* Launch App CTA Button */}
          <a
            href="#/app"
            className="hidden sm:inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#bbf246] text-[#122b1e] text-xs md:text-sm font-semibold hover:bg-[#aee637] active:bg-[#9dd626] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#122b1e] focus:ring-[#bbf246] shadow-xs"
          >
            {t.nav.launchApp}
          </a>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#bbf246]"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle mobile menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0e2419] px-4 pt-3 pb-5 space-y-3">
          <nav className="flex flex-col space-y-2">
            {NAV_ITEMS.map((item) => {
              const label =
                item.id === 'home'
                  ? t.nav.home
                  : item.id === 'how-it-works'
                  ? t.nav.howItWorks
                  : item.id === 'crop-guides'
                  ? t.nav.cropGuides
                  : t.nav.soilData;

              if (!item.enabled) {
                return (
                  <span
                    key={item.id}
                    className="text-sm font-medium text-white/40 py-2 flex items-center justify-between"
                  >
                    <span>{label}</span>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/50">
                      {t.nav.comingSoon}
                    </span>
                  </span>
                );
              }

              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  className="text-sm font-medium text-white/90 hover:text-white py-2"
                >
                  {label}
                </a>
              );
            })}
          </nav>
          <div className="pt-2 border-t border-white/10">
            <a
              href="#/app"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center px-4 py-2 rounded-full bg-[#bbf246] text-[#122b1e] text-sm font-semibold shadow-xs"
            >
              {t.nav.launchApp}
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
