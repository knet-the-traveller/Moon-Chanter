import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import cropsData from '../data/crops.json';
import type { Crop, FarmerPriorities } from '../types';
import {
  Sliders,
  Sprout,
  ShieldAlert,
  Coins,
  HeartHandshake,
  Droplets,
  Clock,
  Sparkles,
  Ban
} from 'lucide-react';

const crops = (cropsData as Crop[]).filter((c) => c.family !== 'fallow');

export const PrioritiesSection: React.FC = () => {
  const {
    priorities,
    setPriority,
    recentCropId,
    setRecentCropId,
    excludedCropIds,
    toggleCropExclusion,
    setCurrentStep,
    language
  } = useAppStore();

  const sliderConfigs: {
    key: keyof FarmerPriorities;
    titleKey: string;
    descKey: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }[] = [
    {
      key: 'soilHealth',
      titleKey: 'priorities.soilHealth',
      descKey: 'priorities.soilHealthDesc',
      icon: Sprout,
      accentColor: 'accent-emerald-700'
    },
    {
      key: 'waterResilience',
      titleKey: 'priorities.waterResilience',
      descKey: 'priorities.waterResilienceDesc',
      icon: Droplets,
      accentColor: 'accent-blue-600'
    },
    {
      key: 'stableIncome',
      titleKey: 'priorities.stableIncome',
      descKey: 'priorities.stableIncomeDesc',
      icon: Coins,
      accentColor: 'accent-amber-600'
    },
    {
      key: 'lowInputCost',
      titleKey: 'priorities.lowInputCost',
      descKey: 'priorities.lowInputCostDesc',
      icon: HeartHandshake,
      accentColor: 'accent-teal-600'
    },
    {
      key: 'lowLabor',
      titleKey: 'priorities.lowLabor',
      descKey: 'priorities.lowLaborDesc',
      icon: Clock,
      accentColor: 'accent-indigo-600'
    },
    {
      key: 'climateRisk',
      titleKey: 'priorities.climateRisk',
      descKey: 'priorities.climateRiskDesc',
      icon: ShieldAlert,
      accentColor: 'accent-rose-600'
    }
  ];

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-sm">
      {/* Title */}
      <div className="pb-4 border-b border-stone-100">
        <h3 className="font-bold text-stone-900 text-base sm:text-lg flex items-center gap-2">
          <Sliders className="w-5 h-5 text-amber-600" />
          {getTranslation(language, 'priorities.title')}
        </h3>
        <p className="text-xs sm:text-sm text-stone-600 mt-1">
          {getTranslation(language, 'priorities.subtitle')}
        </p>
      </div>

      {/* Field History Dropdown */}
      <div className="my-5 p-4 rounded-xl bg-stone-50 border border-stone-200">
        <label className="block text-xs font-bold text-stone-800 mb-2">
          {getTranslation(language, 'priorities.recentCrop')}
        </label>
        <select
          value={recentCropId || ''}
          onChange={(e) => setRecentCropId(e.target.value || null)}
          className="w-full sm:w-80 px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-medium focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
        >
          <option value="">{getTranslation(language, 'priorities.noneOrUnknown')}</option>
          {crops.map((c) => (
            <option key={c.id} value={c.id}>
              {language === 'fil' ? c.name.local : c.name.en} ({c.family})
            </option>
          ))}
        </select>
        <p className="text-[11px] text-stone-500 mt-1.5">
          {language === 'fil'
            ? 'Tumutulong sa sistema upang maiwasan ang sakit sa lupa at magrekomenda ng tamang pananim na kasunod.'
            : 'Helps the engine prevent disease cycles and select the optimal biological rotation break.'}
        </p>
      </div>

      {/* Crop Exclusions Chip Selector */}
      <div className="mb-6">
        <div className="text-xs font-bold text-stone-800 mb-2 flex items-center gap-1.5">
          <Ban className="w-3.5 h-3.5 text-stone-400" />
          <span>{getTranslation(language, 'priorities.excludeCrops')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {crops.map((c) => {
            const isExcluded = excludedCropIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCropExclusion(c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  isExcluded
                    ? 'bg-rose-100 text-rose-900 line-through border border-rose-300'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                }`}
              >
                <span>{language === 'fil' ? c.name.local : c.name.en}</span>
                {isExcluded && <span className="text-[10px] font-bold">✕</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="pt-2">
        <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-4">
          {getTranslation(language, 'priorities.slidersTitle')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sliderConfigs.map((slider) => {
            const Icon = slider.icon;
            const value = priorities[slider.key];

            return (
              <div
                key={slider.key}
                className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50/50 hover:bg-white transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-stone-200/60 text-stone-700">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-stone-900">
                      {getTranslation(language, slider.titleKey)}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-900">
                    {value}%
                  </span>
                </div>

                <p className="text-[11px] text-stone-500 mb-2 leading-relaxed">
                  {getTranslation(language, slider.descKey)}
                </p>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={value}
                  onChange={(e) => setPriority(slider.key, Number(e.target.value))}
                  className={`w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer ${slider.accentColor}`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Action to proceed to results */}
      <div className="mt-6 pt-4 border-t border-stone-100 flex justify-end">
        <button
          onClick={() => setCurrentStep(4)}
          className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold bg-[#1e3a2f] hover:bg-emerald-900 text-amber-300 shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{getTranslation(language, 'priorities.generateButton')}</span>
        </button>
      </div>
    </div>
  );
};
