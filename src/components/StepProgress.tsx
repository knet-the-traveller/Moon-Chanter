import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { MapPin, CloudSun, Sliders, Sparkles } from 'lucide-react';

export const StepProgress: React.FC = () => {
  const { currentStep, setCurrentStep, language } = useAppStore();

  const steps = [
    { num: 1 as const, key: 'nav.locate', icon: MapPin },
    { num: 2 as const, key: 'nav.conditions', icon: CloudSun },
    { num: 3 as const, key: 'nav.priorities', icon: Sliders },
    { num: 4 as const, key: 'nav.rotations', icon: Sparkles }
  ];

  return (
    <div className="bg-[#F7F9F4] border-b border-[#D5E0C8] relative sm:sticky sm:top-16 z-30 min-w-0 max-w-full no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav
          className="flex items-center justify-between py-2 sm:py-2.5 overflow-x-auto no-scrollbar gap-1.5 sm:gap-3"
          aria-label="Workflow Steps"
        >
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;

            return (
              <button
                key={step.num}
                type="button"
                onClick={() => setCurrentStep(step.num)}
                aria-current={isActive ? 'step' : undefined}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#A7BD40] ${
                  isActive
                    ? 'bg-[#1D3309] text-white shadow-xs'
                    : isCompleted
                    ? 'bg-white text-[#1D3309] border border-[#D5E0C8] hover:border-[#1D3309]'
                    : 'text-[#56664A] hover:bg-white/80'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#A7BD40] text-[#1D3309]'
                      : isCompleted
                      ? 'bg-[#A7BD40] text-[#1D3309]'
                      : 'bg-[#E3EAD8] text-[#56664A]'
                  }`}
                >
                  {isCompleted ? '✓' : step.num}
                </div>
                <Icon
                  className={`w-3.5 h-3.5 ${
                    isActive ? 'text-[#C7DA91]' : isCompleted ? 'text-[#1D3309]' : 'text-[#56664A]'
                  }`}
                />
                <span>{getTranslation(language, step.key)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
