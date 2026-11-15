import React from 'react';
import type { LandingLanguage } from '../types';
import { getLandingTranslation } from '../i18n';

interface LandingFooterProps {
  language: LandingLanguage;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ language }) => {
  const t = getLandingTranslation(language);

  return (
    <footer className="bg-[#1D3309] text-white/80 py-8 border-t border-white/10 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-5">
        {/* Top Row: Brand & Feature Highlights */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand & Tagline */}
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}images/landing/logo.png`}
              alt="AniTala"
              width={28}
              height={28}
              className="w-7 h-7 object-contain rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
            />
            <div className="space-y-0.5">
              <span className="font-bold text-sm sm:text-base text-white tracking-tight leading-none block">
                {t.footer.brandName}
              </span>
              <p className="text-[#a2bda7] text-xs">
                {t.footer.tagline}
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="flex flex-wrap items-center gap-6 sm:gap-8 text-xs text-[#a2bda7]">
            {t.footer.features.split(' · ').map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>
        </div>

        {/* Thin Divider */}
        <div className="border-t border-white/10" />

        {/* Bottom Row: S.I. Transparency Notice & Unified Copyright */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-[#8ca391]">
          <p className="text-[11px] sm:text-xs text-[#8ca391] leading-relaxed max-w-2xl flex items-start gap-1.5">
            <svg
              className="w-3.5 h-3.5 shrink-0 text-[#8ca391] mt-0.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
            </svg>
            <span>{t.footer.siNotice}</span>
          </p>

          <span className="text-[11px] sm:text-xs text-[#8ca391] shrink-0 whitespace-nowrap">
            {t.footer.copyright}
          </span>
        </div>

        {/* Screen Reader Provenance & NASA Open Data Disclosure */}
        <p className="sr-only">
          {t.footer.dataCredit}
        </p>
      </div>
    </footer>
  );
};
