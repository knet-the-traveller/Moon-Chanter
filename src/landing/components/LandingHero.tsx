import React from 'react';
import type { LandingLanguage } from '../types';
import { getLandingTranslation } from '../i18n';

interface LandingHeroProps {
  language: LandingLanguage;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ language }) => {
  const t = getLandingTranslation(language);

  const scrollToSteps = () => {
    const target = document.getElementById('planning-steps');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-[#122b1e] text-white pt-10 pb-20 lg:pt-14 lg:pb-24">
      {/* Full-bleed hero background picture with responsive WebP and LCP priority */}
      <picture className="absolute inset-0 w-full h-full pointer-events-none select-none z-0">
        <source
          media="(max-width: 768px)"
          srcSet={`${import.meta.env.BASE_URL}images/landing/hero-bg-mobile.webp`}
          type="image/webp"
          width={900}
          height={365}
        />
        <source
          media="(min-width: 769px)"
          srcSet={`${import.meta.env.BASE_URL}images/landing/hero-bg-desktop.webp`}
          type="image/webp"
          width={2400}
          height={975}
        />
        <img
          src={`${import.meta.env.BASE_URL}images/landing/hero-bg.jpg`}
          alt=""
          aria-hidden="true"
          width={2400}
          height={975}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover object-[75%_20%] md:object-[80%_25%]"
        />
      </picture>

      {/* Dark overlay gradient: strong on mobile/left for text legibility, easing toward the pale sun on right */}
      <div
        className="absolute inset-0 pointer-events-none z-0 bg-gradient-to-b from-[#0b1f15]/95 via-[#0d2318]/90 to-[#0e271b]/95 md:bg-gradient-to-r md:from-[#0b1f15]/95 md:via-[#0d2318]/85 md:to-[#0e271b]/25"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-2xl lg:max-w-3xl flex flex-col items-start space-y-5 py-2 lg:py-6">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[#d6ff62] text-xs font-semibold tracking-wider uppercase">
            <svg
              className="w-3.5 h-3.5 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
            </svg>
            <span>{t.hero.badge}</span>
          </div>

          {/* H1 Heading */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-white leading-[1.15]">
            {t.hero.titleLine1} <br />
            {t.hero.titleLine2} <br />
            <span className="text-[#d6ff62]">{t.hero.titleLine3}</span>
          </h1>

          {/* Subtitle Description */}
          <p className="text-sm sm:text-base md:text-lg text-white/80 max-w-xl leading-relaxed">
            {t.hero.description}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href="#/app"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#bbf246] hover:bg-[#aee637] active:bg-[#9dd626] text-[#122b1e] text-sm md:text-base font-semibold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#132e22] focus:ring-[#bbf246]"
            >
              {t.hero.startPlanning}
            </a>
            <button
              type="button"
              onClick={scrollToSteps}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-sm md:text-base font-medium border border-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#132e22] focus:ring-white"
            >
              <svg
                className="w-4 h-4 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>{t.hero.seeHowItWorks}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
