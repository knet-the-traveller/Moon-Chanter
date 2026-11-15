import { resolvePlanningSoil, hasDemoSoil, DEMO_SOIL_SOURCE } from '../services/planningSoil';
import { SoilModelDetails, SoilRelocationNotice } from './SoilModelDetails';
import { soilProvenance, formatProvenance } from '../data/provenance';
import { parseFarmerSoilOverride } from '../services/soilGrids';
import { hasRequiredSoilInputs } from '../engine/soilInputs';
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { SoilData, SoilTexture, OrganicMatterLevel, Language } from '../types';
import { Layers, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';

function resolveSoilOriginBadgeKey(
  soilData: SoilData,
  isMunicipalBaselineActive: boolean,
  isOverridden: boolean,
): string {
  if (isOverridden) return 'provenance.soilOriginOverride';
  if (isMunicipalBaselineActive || soilData.isEstimate) {
    return 'provenance.soilOriginMunicipal';
  }
  const nativeEntries = [
    soilData.provenance?.ph,
    soilData.provenance?.texture,
    soilData.provenance?.rawClayPercent,
    soilData.provenance?.rawSandPercent,
    soilData.provenance?.rawSocDgPerKg,
    soilData.provenance?.bulkDensityGcm3,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (nativeEntries.some((entry) => entry.tier === 'sample')) {
    return 'provenance.soilOriginMunicipal';
  }
  if (nativeEntries.some((entry) => entry.tier === 'cached-live' || (entry.tier === 'live' && entry.cached))) {
    return 'provenance.soilOriginCached';
  }
  if (nativeEntries.some((entry) => entry.tier === 'live')) {
    return 'provenance.soilOriginLive';
  }
  if (!hasRequiredSoilInputs(soilData) && nativeEntries.every((entry) => entry.tier === 'unavailable')) {
    return 'provenance.soilOriginUnavailable';
  }
  if (nativeEntries.some((entry) => entry.tier === 'bundled-model') || soilData.modelEvidence) {
    return 'provenance.soilOriginBundled';
  }
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
      <label htmlFor={id} className="block text-xs font-semibold text-at-dk">{getTranslation(language, 'dataQuality.fieldPh')}</label>
      <div className="flex flex-wrap gap-2">
        <input id={id} name="fieldPh" type="number" min="0" max="14" step="any" required
          placeholder={ph === null ? undefined : String(ph)} aria-describedby={`${id}-help`}
          onInvalid={event => event.currentTarget.setCustomValidity(getTranslation(language, 'dataQuality.invalidPh'))}
          onChange={event => event.currentTarget.setCustomValidity('')}
          className="min-w-0 w-32 rounded-xl border border-at-line bg-white px-3 py-2 text-base text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk" />
        <button type="submit" className="rounded-xl bg-at-dk px-3 py-2 text-sm font-semibold text-white hover:bg-at-dk/90 focus-visible:outline-2 focus-visible:outline-at-dk cursor-pointer shadow-xs">
          {getTranslation(language, 'dataQuality.applyPh')}
        </button>
      </div>
      <p id={`${id}-help`} className="text-xs text-at-muted">{getTranslation(language, 'dataQuality.phHint')}</p>
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
      <div className="bg-white rounded-2xl p-6 border border-at-line shadow-sm animate-pulse">
        <div className="h-6 bg-at-ow rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-at-ow rounded w-1/2 mb-6"></div>
        <div className="h-24 bg-at-ow rounded-xl"></div>
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
    <div className="card bg-white rounded-2xl p-5 sm:p-6 border border-at-line shadow-sm">
      {/* Title & Provenance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-at-line/50 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-at-dk" />
            <h3 className="font-bold text-at-dk text-base sm:text-lg">
              {getTranslation(language, 'conditions.soilTitle')}
            </h3>
          </div>
          <div className="text-xs text-at-muted mt-1">
            {soilData.source}
          </div>
        </div>

        {isOverridden ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-at-tint text-at-dk border border-at-line">
              <Sparkles className="w-3.5 h-3.5 text-at-amber" />
              {getTranslation(language, 'provenance.soilOriginOverride')} · {getTranslation(language, 'provenance.farmer')}
            </span>
            <button
              type="button"
              onClick={resetSoilOverride}
              className="text-xs text-at-muted hover:text-at-dk underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              {getTranslation(language, 'conditions.overrideReset')}
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-at-ow text-at-dk border border-at-line">
            {getTranslation(language, resolveSoilOriginBadgeKey(soilData, isMunicipalBaselineActive, false))}
          </span>
        )}
      </div>

      {!hasRequiredSoilInputs(effectiveSoil) && (
        <p role="status" className="mt-4 rounded-xl border border-at-warn-border/30 bg-at-warn-bg p-3 text-sm font-semibold text-at-warn-text">
          {getTranslation(language, 'dataQuality.missingSoil')}
        </p>
      )}

      {hasDemoSoil(effectiveSoil) && (
        <p role="status" className="mt-3 rounded-xl bg-at-warn-bg p-3 text-sm text-at-warn-text">
          {getTranslation(language, 'mvp.soilNotice')}
        </p>
      )}

      {(isMunicipalBaselineActive || Boolean(soilData.modelEvidence) || !hasRequiredSoilInputs(effectiveSoil) || soilData.provenance?.ph?.tier === 'unavailable') && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-at-line bg-at-ow p-3 text-xs text-at-dk">
          {isMunicipalBaselineActive ? (
            <>
              <span className="font-semibold text-at-dk">
                {getTranslation(language, 'dataQuality.usingMunicipalBaseline')}
              </span>
              {telemetrySoilData && (
                <button
                  type="button"
                  onClick={restoreSoilTelemetry}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-at-line bg-white px-3 py-2 text-xs font-semibold text-at-dk hover:bg-at-tint focus-visible:outline-2 focus-visible:outline-at-dk cursor-pointer"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-at-dk bg-at-dk px-3 py-2 text-xs font-semibold text-white hover:bg-at-dk/90 focus-visible:outline-2 focus-visible:outline-at-dk cursor-pointer"
            >
              {getTranslation(language, 'dataQuality.useMunicipalBaseline')}
            </button>
          )}
        </div>
      )}

      {soilData.modelEvidence && (
        <SoilRelocationNotice
          evidence={soilData.modelEvidence}
          language={language}
          className="mt-3 rounded-xl border border-at-warn-border/30 bg-at-warn-bg p-3 text-sm text-at-warn-text"
        />
      )}

      {/* Soil KPI Grid */}
      <div className="tiles grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        {/* Texture */}
        <div className="tile p-3.5 rounded-xl bg-at-tint/50 border border-at-line">
          <div className="text-xs font-semibold text-at-muted">
            {getTranslation(language, 'conditions.soilTexture')}
          </div>
          <div className="text-base font-bold text-at-dk mt-1 capitalize">
            {effectiveTexture?.replace('_', ' ') ?? unknown}
            {metadata.texture.source === DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-at-warn-text">{getTranslation(language,'mvp.assumptionTag')}</span>}
          </div>
          <div className="text-[11px] text-at-muted mt-0.5">
            {getTranslation(language, 'provenance.baseFractions')}: {effectiveSoil.rawClayPercent !== undefined ? `${effectiveSoil.rawClayPercent}%` : unknown} / {effectiveSoil.rawSandPercent !== undefined ? `${effectiveSoil.rawSandPercent}%` : unknown}
          </div>
        </div>

        {/* Drainage */}
        <div className="tile p-3.5 rounded-xl bg-at-tint/50 border border-at-line">
          <div className="text-xs font-semibold text-at-muted">
            {getTranslation(language, 'conditions.drainage')}
          </div>
          <div className="text-base font-bold text-at-dk mt-1 capitalize">
            {effectiveDrainage ?? unknown}
          </div>
          <div className="text-[11px] text-at-muted mt-0.5">
            {getTranslation(language, metadata.drainage.source === DEMO_SOIL_SOURCE ? 'mvp.assumptionTag' : metadata.drainage.tier==='farmer'?'provenance.farmer':metadata.drainage.tier==='unavailable'?'provenance.unavailableValue':'provenance.derived')}
          </div>
        </div>

        {/* pH */}
        <div className="tile p-3.5 rounded-xl bg-at-tint/50 border border-at-line">
          <div className="text-xs font-semibold text-at-muted">
            {getTranslation(language, 'conditions.ph')}
          </div>
          <div className="text-base font-bold text-at-dk mt-1">
            {effectiveSoil.ph === null ? unknown : `${effectiveSoil.ph} pH`}
            {metadata.ph.source === DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-at-warn-text">{getTranslation(language,'mvp.assumptionTag')}</span>}
          </div>
          <div className="text-[11px] text-at-muted mt-0.5">
            {getTranslation(language, 'provenance.phReview')}
          </div>
        </div>

        {/* Organic Matter */}
        <div className="tile p-3.5 rounded-xl bg-at-tint/50 border border-at-line">
          <div className="text-xs font-semibold text-at-muted">
            {getTranslation(language, 'conditions.organicMatter')}
          </div>
          <div className="text-base font-bold text-at-dk mt-1 capitalize">
            {effectiveOrganicMatter === 'unknown' ? unknown : effectiveOrganicMatter}
            {metadata.organicMatter.source === DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-at-warn-text">{getTranslation(language,'mvp.assumptionTag')}</span>}
            {metadata.organicMatter.isSynthetic && metadata.organicMatter.source !== DEMO_SOIL_SOURCE && <span className="mt-1 block text-xs font-semibold text-at-warn-text">{getTranslation(language,'provenance.derived')}</span>}
          </div>
          <div className="text-[11px] text-at-muted mt-0.5">
            SOC: {effectiveSoil.rawSocDgPerKg !== undefined ? (effectiveSoil.rawSocDgPerKg / 100).toFixed(2) + '%' : unknown}
          </div>
        </div>
      </div>

      {/* Farmer Override Bar */}
      <div className="mt-4 pt-3 border-t border-at-line/50">
        <div className="text-xs font-semibold text-at-dk mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-at-amber" />
          <span>{getTranslation(language, 'conditions.overridePrompt')}</span>
        </div>

        {/* Preset Texture Buttons */}
        <div className="tex flex flex-wrap gap-2" data-group="tex">
          {texturePresets.map((preset) => {
            const isSelected = effectiveTexture === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSoilOverride({ texture: preset.id })}
                className={`chip px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? 'on bg-at-dk text-white border-at-dk shadow-xs ring-2 ring-at-dk/20 font-semibold'
                    : 'bg-at-ow hover:bg-at-tint text-at-dk border-at-line'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 text-at-lime-bright" />}
                <span>{language === 'fil' ? preset.nameFil : preset.nameEn}</span>
              </button>
            );
          })}
        </div>

        {/* Drainage Override Buttons */}
        <fieldset className="mt-3">
          <legend className="mb-2 text-xs font-semibold text-at-dk">{getTranslation(language, 'soilModel.drainagePrompt')}</legend>
          <div className="flex flex-wrap gap-2">
            {(['poor', 'moderate', 'well'] as const).map(drainage => {
              const isSelected = effectiveDrainage === drainage;
              return (
                <button
                  key={drainage}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSoilOverride({ drainage })}
                  className={`chip rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-at-dk ${
                    isSelected
                      ? 'on border-at-dk bg-at-dk text-white shadow-xs'
                      : 'border-at-line bg-at-ow text-at-dk hover:bg-at-tint'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-at-lime-bright" />}
                  <span>{getTranslation(language, `soilModel.${drainage}`)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* OM Override Selection */}
        <div className="om flex flex-wrap items-center gap-2 mt-3 text-xs" data-group="om">
          <span className="font-medium text-at-dk">{getTranslation(language, 'soilModel.organicMatterPrompt')}:</span>
          {omLevels.map((lvl) => {
            const isSelected = effectiveOrganicMatter === lvl.id;
            return (
              <button
                key={lvl.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSoilOverride({ organicMatter: lvl.id })}
                className={`chip px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                  isSelected
                    ? 'on bg-at-dk text-white font-bold border-at-dk'
                    : 'bg-at-ow hover:bg-at-tint text-at-muted border-at-line'
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-at-lime-bright" />}
                <span>{language === 'fil' ? lvl.labelFil : lvl.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* pH Input */}
        <SoilPhInput
          key={`${selectedLocation.lat}:${selectedLocation.lon}:${effectiveSoil.ph}`}
          ph={effectiveSoil.ph}
          language={language}
          onApply={ph => setSoilOverride({ ph })}
        />
      </div>

      {/* Caveats Accordion */}
      <details className="mt-4 rounded-xl border border-at-line bg-at-ow p-3 text-xs text-at-dk break-words">
        <summary className="cursor-pointer py-1 font-semibold text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk">
          {getTranslation(language, 'provenance.viewCaveats')}
        </summary>
        <div className="mt-2 space-y-3">
          <ul className="text-xs text-at-muted space-y-2 break-words" aria-label={getTranslation(language, 'provenance.title')}>
            {Object.entries(metadata).map(([key, value]) => <li key={key}>{formatProvenance(language, value)}</li>)}
          </ul>
          {soilData.modelEvidence && <SoilModelDetails evidence={soilData.modelEvidence} language={language} hideRelocationNotice />}
        </div>
      </details>
    </div>
  );
};
