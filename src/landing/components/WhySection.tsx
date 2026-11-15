import React from 'react';
import type { LandingLanguage } from '../types';
import { getLandingTranslation } from '../i18n';
import { LandingImage } from './LandingImage';

interface WhySectionProps {
  language: LandingLanguage;
}

export const WhySection: React.FC<WhySectionProps> = ({ language }) => {
  const t = getLandingTranslation(language);

  const scrollToSteps = () => {
    const target = document.getElementById('planning-steps');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="bg-[#f8faf6] py-16 sm:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Farm Photo Card with Circular Badges */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-md sm:max-w-lg">
              {/* Image Card */}
              <div className="overflow-hidden rounded-3xl shadow-md border border-[#c4d6b0]">
                <LandingImage
                  slot="why"
                  alt={t.why.imageAlt}
                  className="rounded-3xl"
                />
              </div>

              {/* Bottom-Left Circular Badge: "10-Year NASA Climate Record" */}
              <div className="absolute -bottom-6 -left-4 sm:-bottom-7 sm:-left-6 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#1b3d26] text-white flex flex-col items-center justify-center p-2 text-center shadow-xl border-4 border-white z-10 select-none">
                <span className="text-base sm:text-lg font-bold leading-tight text-[#d6ff62]">
                  {t.why.climateBadgeValue}
                </span>
                <span className="text-[9px] sm:text-[10px] font-medium leading-tight text-white/90 mt-0.5">
                  {t.why.climateBadgeLabel}
                </span>
              </div>

              {/* Bottom-Right Circular Badge: Blue Rain/Cloud Weather Icon */}
              <div
                className="absolute -bottom-4 -right-3 sm:-bottom-5 sm:-right-4 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#3b82f6] text-white flex items-center justify-center shadow-lg border-4 border-white z-10"
                aria-hidden="true"
              >
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 15a4 4 0 004 4h11a3.5 3.5 0 00.5-6.965A5.5 5.5 0 007.5 8a5.53 5.53 0 00-3.328 1.11A4 4 0 003 15z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 19v2M13 19v2M17 19v2"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Right Column: Copy & Actions */}
          <div className="lg:col-span-6 flex flex-col items-start space-y-5">
            <div className="inline-block text-xs font-bold tracking-widest text-[#2f5e36] uppercase">
              {t.why.eyebrow}
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#142f1b] leading-tight">
              {t.why.title}
            </h2>

            <p className="text-sm sm:text-base text-[#344b36] leading-relaxed">
              {t.why.description}
            </p>

            <div className="flex items-center gap-4 pt-3">
              <a
                href="#/app"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-[#1D3309] hover:bg-[#0c1f15] active:bg-[#06110b] text-white text-sm font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1D3309]"
              >
                {t.why.exploreSoilData}
              </a>
              <button
                type="button"
                onClick={scrollToSteps}
                className="text-sm font-semibold text-[#142f1b] hover:text-[#2f5e36] transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-[#142f1b] rounded px-2 py-1"
              >
                <span>{t.why.learnMore}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
