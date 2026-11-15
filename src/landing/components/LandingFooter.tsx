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
            <div className="flex items-center gap-2.5">
              <img
                src={`${import.meta.env.BASE_URL}images/landing/logo.png`}
                alt="AniTala"
                width={28}
                height={28}
                className="w-7 h-7 object-contain rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
              />
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
            <p className="text-[11px] sm:text-xs text-[#8ca391] leading-relaxed max-w-3xl flex items-start gap-1.5">
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
