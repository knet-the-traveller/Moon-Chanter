import { resolvePlanningSoil, hasDemoSoil, DEMO_SOIL_SOURCE } from '../services/planningSoil';
import { SoilModelDetails } from './SoilModelDetails';
import { soilProvenance, formatProvenance } from '../data/provenance';
import { parseFarmerSoilOverride } from '../services/soilGrids';
import { hasRequiredSoilInputs } from '../engine/soilInputs';
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { SoilData, SoilTexture, OrganicMatterLevel, Language } from '../types';
import { Layers, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';

export function resolveSoilOriginBadgeKey(
  soilData: SoilData,
  isMunicipalBaselineActive: boolean,
  isOverridden: boolean,
): string {
  if (isOverridden) return 'provenance.soilOriginOverride';
  if (isMunicipalBaselineActive) return 'provenance.soilOriginMunicipal';
  const phMeta = soilData.provenance?.ph;
  const tier = phMeta?.tier;
  if (phMeta?.cached || tier === 'cached-live' || (tier as string) === 'cached') {
    return 'provenance.soilOriginCached';
  }
  if (tier === 'live') return 'provenance.soilOriginLive';
  if (tier === 'bundled-model' || soilData.modelEvidence) return 'provenance.soilOriginBundled';
  if (tier === 'sample' || soilData.isEstimate) return 'provenance.soilOriginMunicipal';
  return 'provenance.soilAutomated';
}

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
    useDemoAssumptions,
    soilData,
    telemetrySoilData,
    isMunicipalBaselineActive,
    applyMunicipalBaseline,
    restoreSoilTelemetry,
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

  const effectiveSoil = resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions);
  const metadata = soilProvenance(effectiveSoil);
  const unknown = getTranslation(language, 'provenance.unavailableValue');
  const effectiveTexture = effectiveSoil.texture;
  const effectiveDrainage = effectiveSoil.drainage;
  const effectiveOrganicMatter = effectiveSoil.organicMatter;
  const isOverridden = !!soilOverride && Object.keys(soilOverride).length > 0;

  const texturePresets: { id: SoilTexture; nameEn: string; nameFil: string }[] = [
    { id: 'clay', nameEn: 'Heavy Clay', nameFil: 'Lagkitan / Pulot' },
    { id: 'clay_loam', nameEn: 'Clay Loam', nameFil: 'Mabanlik na Lupa' },
    { id: 'loam', nameEn: 'Medium Loam', nameFil: 'Matabang Lupang Itim' },
    { id: 'sandy_loam', nameEn: 'Sandy Loam', nameFil: 'Mabuhangin na Lupa' },
    { id: 'sandy', nameEn: 'Sandy', nameFil: 'Buhangin' }
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
              {getTranslation(language, 'provenance.soilOriginOverride')} · {getTranslation(language, 'provenance.farmer')}
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
            {getTranslation(language, resolveSoilOriginBadgeKey(soilData, isMunicipalBaselineActive, false))}
          </span>
        )}
      </div>

      {!hasRequiredSoilInputs(effectiveSoil) && <p role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
        {getTranslation(language, 'dataQuality.missingSoil')}
      </p>}

      {hasDemoSoil(effectiveSoil) && <p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{getTranslation(language,'mvp.soilNotice')}</p>}
      {(isMunicipalBaselineActive || Boolean(soilData.modelEvidence) || !hasRequiredSoilInputs(effectiveSoil) || soilData.provenance?.ph?.tier === 'unavailable') && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-300 bg-stone-50 p-3 text-xs text-stone-900">
          {isMunicipalBaselineActive ? (
            <>
              <span className="font-semibold text-amber-900">
                {getTranslation(language, 'dataQuality.usingMunicipalBaseline')}
              </span>
              {telemetrySoilData && (
                <button
                  type="button"
                  onClick={restoreSoilTelemetry}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-400 bg-white px-3 py-2 text-xs font-semibold text-stone-900 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-emerald-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  {getTranslation(language, 'dataQuality.restoreSoilTelemetry')}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => { void applyMunicipalBaseline(); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800 bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-800"
            >
              {getTranslation(language, 'dataQuality.useMunicipalBaseline')}
            </button>
          )}
        </div>
      )}

      {soilData.modelEvidence && (soilData.modelEvidence.requestedCellIndex ?? soilData.modelEvidence.relocatedFrom?.cellIndex) !== undefined && (
        <div role="status" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-bold">{getTranslation(language, 'soilModel.locationAdvisory')}</p>
          <p>
            {getTranslation(language, 'soilModel.nearestValidCell')
              .replace('{requestedCell}', String((soilData.modelEvidence.requestedCellIndex ?? soilData.modelEvidence.relocatedFrom!.cellIndex) + 1))
              .replace('{usedCell}', String(soilData.modelEvidence.cellIndex + 1))
              .replace(
                '{meters}',
                String(
                  soilData.modelEvidence.offsetDistanceMeters ??
                    (soilData.modelEvidence.relocatedFrom
                      ? Math.round(soilData.modelEvidence.relocatedFrom.distanceKm * 1000)
                      : 250)
                )
              )}
          </p>
        </div>
      )}

      {/* Soil KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Texture */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.soilTexture')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1 capitalize">
            {effectiveTexture?.replace('_', ' ') ?? unknown}
            {metadata.texture.source === DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-amber-900">{getTranslation(language,'mvp.assumptionTag')}</span>}
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
            {getTranslation(language, metadata.drainage.source === DEMO_SOIL_SOURCE ? 'mvp.assumptionTag' : metadata.drainage.tier==='farmer'?'provenance.farmer':metadata.drainage.tier==='unavailable'?'provenance.unavailableValue':'provenance.derived')}
          </div>
        </div>

        {/* pH */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-600">
            {getTranslation(language, 'conditions.ph')}
          </div>
          <div className="text-base font-bold text-stone-900 mt-1">
            {effectiveSoil.ph === null ? unknown : `${effectiveSoil.ph} pH`}
            {metadata.ph.source === DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-amber-900">{getTranslation(language,'mvp.assumptionTag')}</span>}
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
            {metadata.organicMatter.source === DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-amber-900">{getTranslation(language,'mvp.assumptionTag')}</span>}
            {metadata.organicMatter.isSynthetic && metadata.organicMatter.source !== DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-amber-900">{getTranslation(language,'provenance.derived')}</span>}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            SOC: {effectiveSoil.rawSocDgPerKg !== undefined ? (effectiveSoil.rawSocDgPerKg / 100).toFixed(2) + '%' : unknown}
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
                type="button" aria-pressed={isSelected}
                onClick={() => setSoilOverride({ texture: preset.id })}
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
        <fieldset className="mt-3">
          <legend className="mb-2 text-xs font-semibold text-stone-800">{getTranslation(language, 'soilModel.drainagePrompt')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['poor', 'moderate', 'well'] as const).map(drainage => <button key={drainage} type="button"
              aria-pressed={effectiveDrainage === drainage} onClick={() => setSoilOverride({ drainage })}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-emerald-800 ${effectiveDrainage === drainage ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-stone-400 bg-white text-stone-900'}`}>
              {getTranslation(language, `soilModel.${drainage}`)}
            </button>)}
          </div>
        </fieldset>
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

      <details className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-800">
        <summary className="cursor-pointer font-semibold text-stone-800 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-emerald-800">
          {getTranslation(language, 'provenance.viewCaveats')}
        </summary>
        <div className="mt-2 space-y-3">
          <ul className="text-xs text-stone-700 space-y-2 break-words" aria-label={getTranslation(language, 'provenance.title')}>
            {Object.entries(metadata).map(([key, value]) => <li key={key}>{formatProvenance(language, value)}</li>)}
          </ul>
          {soilData.modelEvidence && <SoilModelDetails evidence={soilData.modelEvidence} language={language} hideRelocationNotice />}
        </div>
      </details>
    </div>
  );
};
