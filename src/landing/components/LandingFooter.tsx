import React from 'react';
import type { LandingLanguage } from '../types';
import { getLandingTranslation } from '../i18n';

interface LandingFooterProps {
  language: LandingLanguage;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ language }) => {
  const t = getLandingTranslation(language);

  return (
    <footer className="bg-[#11261a] text-white/80 pt-12 pb-10 border-t border-white/10 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Row: Brand & Feature Highlights */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Brand & Tagline */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#bbf246] flex items-center justify-center text-[#11261a] shadow-xs">
                <svg
                  className="w-4 h-4"
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
              <span className="font-bold text-base text-white tracking-tight">
                {t.footer.brandName}
              </span>
            </div>
            <p className="text-[#a2bda7] text-xs">
              {t.footer.tagline}
            </p>
          </div>

          {/* Features */}
          <div className="text-xs text-[#a2bda7] md:text-right">
            {t.footer.features}
          </div>
        </div>

        {/* Copyright Line */}
        <div className="text-xs text-[#8ca391]">
          {t.footer.copyright}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 pt-6 space-y-4">
          {/* S.I. Transparency Notice & Version Pill */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-[11px] sm:text-xs text-[#8ca391] leading-relaxed max-w-3xl">
              {t.footer.siNotice}
            </p>
            <span className="shrink-0 text-[10px] text-[#c2dfc8] bg-white/10 px-2.5 py-1 rounded-full font-mono border border-white/10">
              {t.footer.siVersion}
            </span>
          </div>

          {/* NASA Open Data Credit Line */}
          <p className="text-[11px] sm:text-xs text-[#7d9482] leading-relaxed">
            {t.footer.dataCredit}
          </p>
        </div>
      </div>
    </footer>
  );
};
