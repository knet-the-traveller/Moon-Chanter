import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { Sprout, Globe, Printer, BookOpen, Share2 } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { language, setLanguage, setMethodologyModalOpen, recommendedPlans, advisoryIssuedAt } = useAppStore();
  const canPrint = recommendedPlans.length > 0 && advisoryIssuedAt !== null;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'FieldShift - Adapting Farms with NASA Data',
        text: 'Explore science-backed crop rotation strategies for soil health and climate resilience.',
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(language === 'fil' ? 'Nakopya ang link sa clipboard!' : 'Shareable link copied to clipboard!');
    }
  };

  return (
    <header className="relative sm:sticky sm:top-0 z-40 bg-[#172d24] text-amber-50 shadow-md border-b border-emerald-950/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">FieldShift</span>
              <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-800 text-emerald-200 border border-emerald-700/60">
                NASA Space Apps
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 hidden sm:block">
              {getTranslation(language, 'app.subtitle')} · <span className="text-amber-300 font-medium">Moon Chanter</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Methodology modal button */}
          <button
            onClick={() => setMethodologyModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 transition-colors border border-emerald-700/50"
            title={getTranslation(language, 'nav.methodology')}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">{getTranslation(language, 'nav.methodology')}</span>
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-900/60 hover:bg-emerald-800 text-emerald-100 transition-colors border border-emerald-700/50"
            title={getTranslation(language, 'nav.share')}
          >
            <Share2 className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">{getTranslation(language, 'nav.share')}</span>
          </button>

          {/* Print button */}
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title={getTranslation(language, canPrint ? 'nav.printPlan' : 'dataQuality.noPrintablePlan')}
          >
            <Printer className="w-4 h-4 text-stone-950" />
            <span className="hidden sm:inline">{getTranslation(language, 'nav.printPlan')}</span>
          </button>

          {/* Language Switcher */}
          <div className="flex items-center rounded-lg bg-emerald-950/80 p-0.5 border border-emerald-800">
            <Globe className="w-3.5 h-3.5 ml-2 text-emerald-400" />
            <button
              onClick={() => setLanguage('en')}
              className={`px-2 py-1 text-xs font-semibold rounded ${
                language === 'en'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('fil')}
              className={`px-2 py-1 text-xs font-semibold rounded ${
                language === 'fil'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              FIL
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
