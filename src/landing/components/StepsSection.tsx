import React from 'react';
import type { LandingLanguage } from '../types';
import { getLandingTranslation } from '../i18n';
import { LandingImage } from './LandingImage';

interface StepsSectionProps {
  language: LandingLanguage;
}

export const StepsSection: React.FC<StepsSectionProps> = ({ language }) => {
  const t = getLandingTranslation(language);

  return (
    <section id="planning-steps" className="bg-[#cfdfb5] py-16 sm:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="text-xs font-bold tracking-widest text-[#23461f] uppercase mb-2">
            {t.steps.eyebrow}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#173516]">
            {t.steps.title}
          </h2>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1 */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#b8cb9d] flex flex-col justify-between space-y-5 transition-transform hover:-translate-y-1">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-stone-100">
                <LandingImage
                  slot="step1"
                  alt={t.steps.step1.imageAlt}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[#173516]">
                  {t.steps.step1.number}
                </h3>
                <p className="text-xs sm:text-sm text-[#41563f] leading-relaxed">
                  {t.steps.step1.description}
                </p>
              </div>
            </div>
            <div>
              <a
                href="#/app"
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-full bg-[#546b45] hover:bg-[#435737] active:bg-[#34442b] text-white text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#546b45]"
              >
                {t.steps.step1.cta}
              </a>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#b8cb9d] flex flex-col justify-between space-y-5 transition-transform hover:-translate-y-1">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-stone-100">
                <LandingImage
                  slot="step2"
                  alt={t.steps.step2.imageAlt}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[#173516]">
                  {t.steps.step2.number}
                </h3>
                <p className="text-xs sm:text-sm text-[#41563f] leading-relaxed">
                  {t.steps.step2.description}
                </p>
              </div>
            </div>
            <div>
              <a
                href="#/app"
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-full bg-[#546b45] hover:bg-[#435737] active:bg-[#34442b] text-white text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#546b45]"
              >
                {t.steps.step2.cta}
              </a>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#b8cb9d] flex flex-col justify-between space-y-5 transition-transform hover:-translate-y-1">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-stone-100">
                <LandingImage
                  slot="step3"
                  alt={t.steps.step3.imageAlt}
                  className="rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[#173516]">
                  {t.steps.step3.number}
                </h3>
                <p className="text-xs sm:text-sm text-[#41563f] leading-relaxed">
                  {t.steps.step3.description}
                </p>
              </div>
            </div>
            <div>
              <a
                href="#/app"
                className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-full bg-[#546b45] hover:bg-[#435737] active:bg-[#34442b] text-white text-xs sm:text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#546b45]"
              >
                {t.steps.step3.cta}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
