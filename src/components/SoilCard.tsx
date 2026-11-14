import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { SoilTexture, DrainageClass, OrganicMatterLevel } from '../types';
import { Layers, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';

export const SoilCard: React.FC = () => {
  const {
    soilData,
    soilOverride,
    setSoilOverride,
    resetSoilOverride,
    language,
    isLoadingTelemetry
  } = useAppStore();

  if (isLoadingTelemetry) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm animate-pulse">
        <div className="h-6 bg-stone-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-stone-100 rounded w-1/2 mb-6"></div>
        <div className="h-24 bg-stone-100 rounded-xl"></div>
      </div>
    );
  }

  if (!soilData) return null;

  const effectiveTexture = soilOverride?.texture || soilData.texture;
  const effectiveDrainage = soilOverride?.drainage || soilData.drainage;
  const effectiveOrganicMatter = soilOverride?.organicMatter || soilData.organicMatter;
  const isOverridden = !!soilOverride && Object.keys(soilOverride).length > 0;

  const texturePresets: { id: SoilTexture; nameEn: string; nameFil: string; defaultDrainage: DrainageClass }[] = [
    { id: 'clay', nameEn: 'Heavy Clay', nameFil: 'Lagkitan / Pulot', defaultDrainage: 'poor' },
    { id: 'clay_loam', nameEn: 'Clay Loam', nameFil: 'Mabanlik na Lupa', defaultDrainage: 'moderate' },
    { id: 'loam', nameEn: 'Medium Loam', nameFil: 'Matabang Lupang Itim', defaultDrainage: 'well' },
    { id: 'sandy_loam', nameEn: 'Sandy Loam', nameFil: 'Mabuhangin na Lupa', defaultDrainage: 'well' },
    { id: 'sandy', nameEn: 'Sandy', nameFil: 'Buhangin', defaultDrainage: 'well' }
  ];

  const omLevels: { id: OrganicMatterLevel; labelEn: string; labelFil: string }[] = [
    { id: 'low', labelEn: 'Low (<1%)', labelFil: 'Mababa (<1%)' },
    { id: 'medium', labelEn: 'Medium (1–2.5%)', labelFil: 'Katamtaman (1–2.5%)' },
    { id: 'high', labelEn: 'High (>2.5%)', labelFil: 'Mataas (>2.5%)' }
  ];

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-sm">
      {/* Title & Provenance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-800" />
            <h3 className="font-bold text-stone-900 text-base sm:text-lg">
              {getTranslation(language, 'conditions.soilTitle')}
            </h3>
          </div>
          <div className="text-xs text-stone-500 mt-1">
            {soilData.source}
          </div>
        </div>

        {isOverridden ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              Farmer Overridden
            </span>
            <button
              onClick={resetSoilOverride}
              className="text-xs text-stone-600 hover:text-stone-900 underline flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              {getTranslation(language, 'conditions.overrideReset')}
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-300">
            ISRIC Automated Profile
          </span>
        )}
      </div>

      {/* Soil KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Texture */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.soilTexture')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1 capitalize">
            {effectiveTexture.replace('_', ' ')}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Clay: ~{soilData.rawClayPercent ?? 32}% · Sand: ~{soilData.rawSandPercent ?? 30}%
          </div>
        </div>

        {/* Drainage */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.drainage')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1 capitalize">
            {effectiveDrainage}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Water retention capacity
          </div>
        </div>

        {/* pH */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.ph')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1">
            {soilData.ph} pH
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {soilData.ph < 5.5 ? 'Acidic' : soilData.ph > 7.3 ? 'Alkaline' : 'Optimal Neutral'}
          </div>
        </div>

        {/* Organic Matter */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.organicMatter')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1 capitalize">
            {effectiveOrganicMatter}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            SOC: ~{soilData.rawSocDgPerKg ? (soilData.rawSocDgPerKg / 100).toFixed(2) + '%' : '1.4%'}
          </div>
        </div>
      </div>

      {/* Farmer Override Bar */}
      <div className="mt-4 pt-3 border-t border-stone-100">
        <div className="text-xs font-semibold text-stone-700 mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
          <span>{getTranslation(language, 'conditions.overridePrompt')}</span>
        </div>

        {/* Preset Texture Buttons */}
        <div className="flex flex-wrap gap-2">
          {texturePresets.map((preset) => {
            const isSelected = effectiveTexture === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() =>
                  setSoilOverride({
                    texture: preset.id,
                    drainage: preset.defaultDrainage
                  })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-800 text-white shadow-sm ring-2 ring-emerald-600/30 font-semibold'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                <span>{language === 'fil' ? preset.nameFil : preset.nameEn}</span>
              </button>
            );
          })}
        </div>

        {/* OM Override Selection */}
        <div className="flex items-center gap-2 mt-3 text-xs">
          <span className="font-medium text-stone-500">Organic Matter:</span>
          {omLevels.map((lvl) => {
            const isSelected = effectiveOrganicMatter === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => setSoilOverride({ organicMatter: lvl.id })}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-amber-600 text-stone-950 font-bold'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                }`}
              >
                {language === 'fil' ? lvl.labelFil : lvl.labelEn}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
