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
    <div className="bg-white/80 backdrop-blur-sm border-b border-stone-200/80 relative sm:sticky sm:top-16 z-30 min-w-0 max-w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between py-2.5 overflow-x-auto no-scrollbar gap-2 sm:gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;

            return (
              <button
                key={step.num}
                onClick={() => setCurrentStep(step.num)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1e3a2f] text-white shadow-sm ring-2 ring-emerald-700/30'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100/80 border border-emerald-200/60'
                    : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isActive
                      ? 'bg-amber-400 text-stone-950'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {isCompleted ? '✓' : step.num}
                </div>
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300' : 'text-stone-500'}`} />
                <span>{getTranslation(language, step.key)}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
