import React, { useEffect } from 'react';
import type { LandingLanguage } from './types';
import { getLandingTranslation } from './i18n';
import { LandingHeader } from './components/LandingHeader';
import { LandingHero } from './components/LandingHero';
import { SearchPill } from './components/SearchPill';
import { WhySection } from './components/WhySection';
import { StepsSection } from './components/StepsSection';
import { LandingFooter } from './components/LandingFooter';

interface AniTalaLandingProps {
  language: LandingLanguage;
  onLanguageChange: (lang: LandingLanguage) => void;
}

export const AniTalaLanding: React.FC<AniTalaLandingProps> = ({
  language,
  onLanguageChange
}) => {
  const t = getLandingTranslation(language);

  // Set document title and html lang on mount/change
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'AniTala — Simple Crop & Soil Guide';
    document.documentElement.lang = language === 'tl' ? 'fil' : 'en';

    return () => {
      document.title = prevTitle;
    };
  }, [language]);

  return (
    <div className="anitala-landing min-h-screen flex flex-col bg-[#f8faf6] font-sans antialiased text-stone-900 selection:bg-[#bbf246] selection:text-[#1D3309]">
      {/* Accessible Skip to Content Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#bbf246] focus:text-[#1D3309] focus:font-semibold focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#1D3309]"
      >
        {t.a11y.skipToContent}
      </a>

      {/* Header */}
      <LandingHeader language={language} onLanguageChange={onLanguageChange} />

      {/* Main Content Landmarks */}
      <main id="main-content" className="flex-1">
        <LandingHero language={language} />
        <SearchPill language={language} />
        <WhySection language={language} />
        <StepsSection language={language} />
      </main>

      {/* Footer */}
      <LandingFooter language={language} />
    </div>
  );
};
