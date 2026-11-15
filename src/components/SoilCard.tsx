import { SoilModelDetails } from './SoilModelDetails';
import { soilProvenance, formatProvenance } from '../data/provenance';
import { applyFarmerSoilOverride, parseFarmerSoilOverride } from '../services/soilGrids';
import { hasRequiredSoilInputs } from '../engine/soilInputs';
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { SoilTexture, DrainageClass, OrganicMatterLevel, Language } from '../types';
import { Layers, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';

const SoilPhInput: React.FC<{ ph: number | null; language: Language; onApply: (ph: number) => void }> = ({ ph, language, onApply }) => {
  const id = React.useId();
  return (
    <form className="mt-4 space-y-2" onSubmit={event => {
      event.preventDefault();
      const input = event.currentTarget.elements.namedItem('fieldPh');
      if (!(input instanceof HTMLInputElement)) return;
      const validated = parseFarmerSoilOverride({ ph: input.valueAsNumber });
      if (!validated || typeof validated.ph !== 'number') {
        input.setCustomValidity(getTranslation(language, 'dataQuality.invalidPh'));
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      onApply(validated.ph);
    }}>
      <label htmlFor={id} className="block text-xs font-semibold text-stone-800">{getTranslation(language, 'dataQuality.fieldPh')}</label>
      <div className="flex flex-wrap gap-2">
        <input id={id} name="fieldPh" type="number" min="0" max="14" step="any" required
          placeholder={ph === null ? undefined : String(ph)} aria-describedby={`${id}-help`}
          onInvalid={event => event.currentTarget.setCustomValidity(getTranslation(language, 'dataQuality.invalidPh'))}
          onChange={event => event.currentTarget.setCustomValidity('')}
          className="min-w-0 w-32 rounded-lg border border-stone-400 bg-white px-3 py-2 text-base text-stone-950 focus-visible:outline-2 focus-visible:outline-emerald-800" />
        <button type="submit" className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-800">
          {getTranslation(language, 'dataQuality.applyPh')}
        </button>
      </div>
      <p id={`${id}-help`} className="text-xs text-stone-700">{getTranslation(language, 'dataQuality.phHint')}</p>
    </form>
  );
};

export const SoilCard: React.FC = () => {
  const {
    soilData,
    soilOverride,
    setSoilOverride,
    resetSoilOverride,
    language,
    isLoadingTelemetry,
    selectedLocation
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

  const effectiveSoil = applyFarmerSoilOverride(soilData, soilOverride);
  const metadata = soilProvenance(effectiveSoil);
  const source = (key: keyof typeof metadata) => formatProvenance(language, metadata[key]);
  const unknown = getTranslation(language, 'provenance.unavailableValue');
  const effectiveTexture = effectiveSoil.texture;
  const effectiveDrainage = effectiveSoil.drainage;
  const effectiveOrganicMatter = effectiveSoil.organicMatter;
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
              {getTranslation(language, 'provenance.farmer')}
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
            {getTranslation(language, 'provenance.soilAutomated')}
          </span>
        )}
      </div>

      {!hasRequiredSoilInputs(effectiveSoil) && <p role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
        {getTranslation(language, 'dataQuality.missingSoil')}
      </p>}

      {soilData.modelEvidence && <SoilModelDetails evidence={soilData.modelEvidence} language={language} />}

      {/* Soil KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Texture */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.soilTexture')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1 capitalize">
            {effectiveTexture?.replace('_', ' ') ?? unknown}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {getTranslation(language, 'provenance.baseFractions')}: {effectiveSoil.rawClayPercent !== undefined ? `${effectiveSoil.rawClayPercent}%` : unknown} / {effectiveSoil.rawSandPercent !== undefined ? `${effectiveSoil.rawSandPercent}%` : unknown}
          </div>
        </div>

        {/* Drainage */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.drainage')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1 capitalize">
            {effectiveDrainage ?? unknown}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {source('drainage')}
          </div>
        </div>

        {/* pH */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.ph')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1">
            {effectiveSoil.ph === null ? unknown : `${effectiveSoil.ph} pH`}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            {getTranslation(language, 'provenance.phReview')}
          </div>
        </div>

        {/* Organic Matter */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.organicMatter')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1 capitalize">
            {effectiveOrganicMatter === 'unknown' ? unknown : effectiveOrganicMatter}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            SOC: {effectiveSoil.rawSocDgPerKg !== undefined ? (effectiveSoil.rawSocDgPerKg / 100).toFixed(2) + '%' : unknown}
          </div>
        </div>
      </div>

      <ul className="text-xs text-stone-700 space-y-2 break-words" aria-label={getTranslation(language, 'provenance.title')}>
        {Object.entries(metadata).map(([key, value]) => <li key={key}>{formatProvenance(language, value)}</li>)}
      </ul>
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
                type="button" aria-pressed={isSelected}
                onClick={() =>
                  setSoilOverride({
                    texture: preset.id,
                    ...(soilData.modelEvidence ? {} : { drainage: preset.defaultDrainage })
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

        {soilData.modelEvidence && <fieldset className="mt-3">
          <legend className="mb-2 text-xs font-semibold text-stone-800">{getTranslation(language, 'soilModel.drainagePrompt')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['poor', 'moderate', 'well'] as const).map(drainage => <button key={drainage} type="button"
              aria-pressed={effectiveDrainage === drainage} onClick={() => setSoilOverride({ drainage })}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-emerald-800 ${effectiveDrainage === drainage ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-stone-400 bg-white text-stone-900'}`}>
              {getTranslation(language, `soilModel.${drainage}`)}
            </button>)}
          </div>
        </fieldset>}
        {/* OM Override Selection */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span className="font-medium text-stone-700">{getTranslation(language, 'soilModel.organicMatterPrompt')}:</span>
          {omLevels.map((lvl) => {
            const isSelected = effectiveOrganicMatter === lvl.id;
            return (
              <button
                key={lvl.id}
                type="button" aria-pressed={isSelected}
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
        <SoilPhInput key={`${selectedLocation.lat}:${selectedLocation.lon}:${effectiveSoil.ph}`}
          ph={effectiveSoil.ph} language={language} onApply={ph => setSoilOverride({ ph })} />
      </div>
    </div>
  );
};
