import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { Sparkles, ShieldCheck } from 'lucide-react';

export const DemoModeNotice: React.FC = () => {
  const { useDemoAssumptions, setDemoAssumptions, language } = useAppStore();

  return (
    <section
      className={`mb-4 rounded-2xl border p-4 text-xs sm:text-sm transition-colors shadow-xs ${
        useDemoAssumptions
          ? 'bg-[#FEF0C7] border-[#D97706] text-[#78350F]'
          : 'bg-[#EBF2D8] border-[#D5E0C8] text-[#1D3309]'
      }`}
      aria-label={getTranslation(language, 'mvp.modeTitle')}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          {useDemoAssumptions ? (
            <Sparkles className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-[#2A7B46] shrink-0 mt-0.5" />
          )}
          <div className="space-y-0.5">
            <p className="font-bold">
              {getTranslation(language, useDemoAssumptions ? 'mvp.modeTitle' : 'mvp.fieldMode')}
            </p>
            <p className="text-xs opacity-90">
              {getTranslation(language, useDemoAssumptions ? 'mvp.modeHelp' : 'mvp.fieldHelp')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDemoAssumptions(!useDemoAssumptions)}
          className={`shrink-0 self-start sm:self-center px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            useDemoAssumptions
              ? 'bg-[#78350F] text-white hover:bg-[#5f2a0c] focus:ring-[#78350F]'
              : 'bg-[#1D3309] text-white hover:bg-[#2c4e0e] focus:ring-[#1D3309]'
          }`}
        >
          {getTranslation(language, useDemoAssumptions ? 'mvp.disable' : 'mvp.enable')}
        </button>
      </div>
    </section>
  );
};
