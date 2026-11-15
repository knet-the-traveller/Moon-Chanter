import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { ScenarioCondition } from '../types';
import { ShieldCheck, Flame, Sun, Droplets, CloudRain } from 'lucide-react';

export const ScenarioBar: React.FC = () => {
  const { activeScenario, setActiveScenario, language } = useAppStore();

  const scenarios: {
    id: ScenarioCondition;
    labelKey: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'baseline',
      labelKey: 'results.baseline',
      sublabel: 'NASA 10-Yr Climatology',
      icon: ShieldCheck,
    },
    {
      id: 'hotter',
      labelKey: 'results.hotter',
      sublabel: '+1.5°C Peak Heat Stress',
      icon: Flame,
    },
    {
      id: 'drier',
      labelKey: 'results.drier',
      sublabel: '-15% Seasonal Rain (El Niño)',
      icon: Sun,
    },
    {
      id: 'hotterAndDrier',
      labelKey: 'results.hotterAndDrier',
      sublabel: 'Compound Thermal & Water Stress',
      icon: Droplets,
    },
    {
      id: 'wetter',
      labelKey: 'results.wetter',
      sublabel: '+15% Heavy Monsoon & Typhoons',
      icon: CloudRain,
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-at-line/60 gap-2 mb-3">
        <h4 className="text-xs sm:text-sm font-bold text-at-dk uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-at-green" />
          <span>{getTranslation(language, 'results.scenarioToggleTitle')}</span>
        </h4>
        <span className="text-[11px] text-at-muted">
          {language === 'fil'
            ? 'Subukin kung mananatiling matatag ang mga plano sa ilalim ng matinding init o tagtuyot.'
            : 'Test how rankings and fit scores respond under climatic extremes.'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {scenarios.map((sc) => {
          const Icon = sc.icon;
          const isActive = activeScenario === sc.id;

          return (
            <button
              type="button"
              key={sc.id}
              onClick={() => setActiveScenario(sc.id)}
              className={`p-2.5 rounded-xl text-left transition-all border cursor-pointer ${
                isActive
                  ? 'bg-at-dk text-white ring-2 ring-at-green shadow-xs border-transparent'
                  : 'bg-at-ow hover:bg-at-tint/60 border-at-line text-at-dk'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-at-lime' : 'text-at-muted'}`} />
                <span className="text-xs font-bold leading-tight">
                  {getTranslation(language, sc.labelKey)}
                </span>
              </div>
              <div
                className={`text-[10px] leading-tight ${
                  isActive ? 'text-white/80' : 'text-at-muted'
                }`}
              >
                {sc.sublabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
