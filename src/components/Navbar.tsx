import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { Printer, BookOpen, Share2, Bookmark } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    language,
    setLanguage,
    setMethodologyModalOpen,
    recommendedPlans,
    advisoryIssuedAt,
    savedPlans,
    setSavedPlansOpen
  } = useAppStore();

  const canPrint = recommendedPlans.length > 0 && advisoryIssuedAt !== null;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'AniTala - Guided by the stars, growing toward a better harvest',
        text: 'Explore science-backed crop rotation strategies for soil health and climate resilience.',
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(language === 'fil' ? 'Nakopya ang link sa clipboard!' : 'Shareable link copied to clipboard!');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#1D3309] border-b border-white/10 text-white select-none no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        {/* Brand & Home Link */}
        <div className="flex items-center gap-3 min-w-0">
          <a
            href="#/"
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-[#bbf246] rounded-lg p-1"
            aria-label="AniTala - Home"
          >
            <img
              src={`${import.meta.env.BASE_URL}images/landing/logo.png`}
              alt="AniTala"
              width={36}
              height={36}
              className="w-9 h-9 object-contain rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
            />
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight tracking-tight text-white group-hover:text-[#bbf246] transition-colors">
                AniTala
              </span>
              <span className="text-[10px] tracking-wide text-white/70 font-normal hidden sm:block truncate">
                Guided by the stars, growing toward a better harvest.
              </span>
            </div>
          </a>

          <div className="h-5 w-px bg-white/15 hidden md:block" />

          {/* Home Link */}
          <a
            href="#/"
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white/90 text-xs font-semibold border border-white/15 transition-colors focus:outline-none focus:ring-2 focus:ring-[#bbf246]"
            aria-label="Back to Home"
          >
            <span>←</span>
            <span>{getTranslation(language, 'nav.home')}</span>
          </a>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Saved Plans Toggle Button */}
          <button
            type="button"
            onClick={() => setSavedPlansOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/15 focus:outline-none focus:ring-2 focus:ring-[#bbf246]"
            title={getTranslation(language, 'results.savedPlansTitle')}
          >
            <Bookmark className="w-3.5 h-3.5 text-[#C7DA91]" />
            <span className="hidden sm:inline">{getTranslation(language, 'nav.savedPlans')}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#A7BD40] text-[#1D3309] text-[10px] font-bold">
              {savedPlans.length}
            </span>
          </button>

          {/* Methodology modal button */}
          <button
            type="button"
            onClick={() => setMethodologyModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/15 focus:outline-none focus:ring-2 focus:ring-[#bbf246]"
            title={getTranslation(language, 'nav.methodology')}
          >
            <BookOpen className="w-3.5 h-3.5 text-[#C7DA91]" />
            <span className="hidden lg:inline">{getTranslation(language, 'nav.methodology')}</span>
          </button>

          {/* Share button */}
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/15 focus:outline-none focus:ring-2 focus:ring-[#bbf246]"
            title={getTranslation(language, 'nav.share')}
          >
            <Share2 className="w-3.5 h-3.5 text-[#C7DA91]" />
            <span className="hidden md:inline">{getTranslation(language, 'nav.share')}</span>
          </button>

          {/* Print button */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={!canPrint}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#A7BD40] hover:bg-[#bbf246] text-[#1D3309] transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#bbf246]"
            title={getTranslation(language, canPrint ? 'nav.printPlan' : 'dataQuality.noPrintablePlan')}
          >
            <Printer className="w-3.5 h-3.5 text-[#1D3309]" />
            <span className="hidden sm:inline">{getTranslation(language, 'nav.printPlan')}</span>
          </button>

          {/* Language Switcher */}
          <div
            className="flex items-center bg-transparent border border-[#607646] rounded-full p-0.5 text-xs font-medium ml-1"
            role="group"
            aria-label={getTranslation(language, 'nav.language')}
          >
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 sm:px-2.5 py-0.5 rounded-full transition-all text-xs ${
                language === 'en'
                  ? 'bg-[#C7DA91] text-[#1D3309] font-bold shadow-xs'
                  : 'text-white hover:text-white/80 font-medium'
              }`}
              aria-pressed={language === 'en'}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('fil')}
              className={`px-2 sm:px-2.5 py-0.5 rounded-full transition-all text-xs ${
                language === 'fil'
                  ? 'bg-[#C7DA91] text-[#1D3309] font-bold shadow-xs'
                  : 'text-white hover:text-white/80 font-medium'
              }`}
              aria-pressed={language === 'fil'}
            >
              FIL
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
