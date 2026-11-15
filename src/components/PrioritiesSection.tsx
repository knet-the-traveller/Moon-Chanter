import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import cropsData from '../data/crops.json';
import type { Crop, FarmerPriorities } from '../types';
import {
  Sliders,
  Sparkles,
  AlertTriangle,
  Shield,
  Sprout,
  Droplets,
  Coins,
  HeartHandshake,
  Clock,
  ShieldAlert
} from 'lucide-react';

export interface PrioritiesSectionProps {
  initialPage?: number;
  initialShowAll?: boolean;
}

// 13 verified non-fallow crops
const ALL_CROPS = (cropsData as Crop[]).filter((c) => c.family !== 'fallow');

// Ordered group taxonomy for 13 non-fallow crops
const CROP_GROUPS: {
  key: string;
  nameKey: string;
  cropIds: string[];
}[] = [
  {
    key: 'grains',
    nameKey: 'priorities.groupGrains',
    cropIds: ['rice', 'corn']
  },
  {
    key: 'legumes',
    nameKey: 'priorities.groupLegumes',
    cropIds: ['mungbean', 'peanut', 'cowpea', 'soybean', 'cover_crotalaria']
  },
  {
    key: 'roots',
    nameKey: 'priorities.groupRoots',
    cropIds: ['sweet_potato', 'cassava']
  },
  {
    key: 'vegetables',
    nameKey: 'priorities.groupVegetables',
    cropIds: ['eggplant', 'tomato', 'ampalaya', 'onion']
  }
];

// Ordered list of 13 crops by group
const ORDERED_CROPS: Crop[] = CROP_GROUPS.flatMap((group) =>
  group.cropIds
    .map((id) => ALL_CROPS.find((c) => c.id === id))
    .filter((c): c is Crop => c !== undefined)
);

type TraitKey = 'inc' | 'storm' | 'soil' | 'water' | 'cost' | 'easy';

interface TraitDef {
  cssClass: string;
  nameKey: string;
}

const TRAIT_DEFS: Record<TraitKey, TraitDef> = {
  inc: { cssClass: 'p-income', nameKey: 'priorities.traitIncome' },
  storm: { cssClass: 'p-storm', nameKey: 'priorities.traitStorm' },
  soil: { cssClass: 'p-soil', nameKey: 'priorities.traitSoil' },
  water: { cssClass: 'p-water', nameKey: 'priorities.traitWater' },
  cost: { cssClass: 'p-cost', nameKey: 'priorities.traitCost' },
  easy: { cssClass: 'p-easy', nameKey: 'priorities.traitEasy' }
};

interface CropMeta {
  traits: TraitKey[];
  risk: 'low' | 'med';
}

const CROP_METAS: Record<string, CropMeta> = {
  rice: { traits: ['inc', 'storm'], risk: 'med' },
  corn: { traits: ['inc', 'water'], risk: 'med' },
  mungbean: { traits: ['soil', 'water', 'cost'], risk: 'low' },
  peanut: { traits: ['soil', 'inc'], risk: 'low' },
  cowpea: { traits: ['soil', 'water', 'cost'], risk: 'low' },
  soybean: { traits: ['soil', 'inc'], risk: 'med' },
  cover_crotalaria: { traits: ['soil', 'cost', 'easy'], risk: 'low' },
  sweet_potato: { traits: ['water', 'cost', 'storm'], risk: 'low' },
  cassava: { traits: ['water', 'cost', 'easy'], risk: 'low' },
  eggplant: { traits: ['inc', 'storm'], risk: 'med' },
  tomato: { traits: ['inc', 'cost'], risk: 'med' },
  ampalaya: { traits: ['inc', 'soil'], risk: 'med' },
  onion: { traits: ['inc', 'water'], risk: 'med' }
};

const PAGES: [number, number][] = [
  [0, 5],
  [5, 9],
  [9, 13]
];

function scoreCropPriority(c: Crop, p: FarmerPriorities): number {
  let score = 0;
  // Soil health (N-fixers & residue)
  const soilFactor =
    (c.nitrogenFixing ? 1.0 : 0) +
    (c.residueBenefit === 'high' ? 0.6 : c.residueBenefit === 'medium' ? 0.3 : 0);
  score += soilFactor * (p.soilHealth / 100);

  // Water resilience (drought tolerance & low demand)
  const waterFactor =
    (c.droughtTolerance === 'high' ? 0.8 : c.droughtTolerance === 'medium' ? 0.4 : 0) +
    (c.waterDemand === 'low' ? 0.6 : c.waterDemand === 'medium' ? 0.3 : 0);
  score += waterFactor * (p.waterResilience / 100);

  // Climate shock buffer (flood & heat tolerance)
  const climateFactor =
    (c.floodTolerance === 'high' ? 0.8 : 0) +
    (c.heatTolerance === 'high' ? 0.6 : c.heatTolerance === 'medium' ? 0.3 : 0);
  score += climateFactor * (p.climateRisk / 100);

  // Stable income (market tier)
  const incomeFactor =
    c.marketTier === 'high' ? 1.0 : c.marketTier === 'medium' ? 0.5 : 0.2;
  score += incomeFactor * (p.stableIncome / 100);

  // Low input cost
  const costFactor =
    c.inputCost === 'low' ? 1.0 : c.inputCost === 'medium' ? 0.5 : 0.1;
  score += costFactor * (p.lowInputCost / 100);

  // Low labor intensity
  const laborFactor =
    c.laborIntensity === 'low' ? 1.0 : c.laborIntensity === 'medium' ? 0.5 : 0.1;
  score += laborFactor * (p.lowLabor / 100);

  return score;
}

export const PrioritiesSection: React.FC<PrioritiesSectionProps> = ({
  initialPage = 0,
  initialShowAll = false
}) => {
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

  const [page, setPage] = useState<number>(initialPage);
  const [showAll, setShowAll] = useState<boolean>(initialShowAll);

  const sliderConfigs: {
    key: keyof FarmerPriorities;
    titleKey: string;
    descKey: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }[] = [
    {
      key: 'soilHealth',
      titleKey: 'priorities.soilHealth',
      descKey: 'priorities.soilHealthDesc',
      icon: Sprout,
      color: '#6A804F'
    },
    {
      key: 'waterResilience',
      titleKey: 'priorities.waterResilience',
      descKey: 'priorities.waterResilienceDesc',
      icon: Droplets,
      color: '#5C95E0'
    },
    {
      key: 'stableIncome',
      titleKey: 'priorities.stableIncome',
      descKey: 'priorities.stableIncomeDesc',
      icon: Coins,
      color: '#A7BD40'
    },
    {
      key: 'lowInputCost',
      titleKey: 'priorities.lowInputCost',
      descKey: 'priorities.lowInputCostDesc',
      icon: HeartHandshake,
      color: '#D98A2B'
    },
    {
      key: 'lowLabor',
      titleKey: 'priorities.lowLabor',
      descKey: 'priorities.lowLaborDesc',
      icon: Clock,
      color: '#7C6EE6'
    },
    {
      key: 'climateRisk',
      titleKey: 'priorities.climateRisk',
      descKey: 'priorities.climateRiskDesc',
      icon: ShieldAlert,
      color: '#2E8B75'
    }
  ];

  // Deterministic crop match tags from current priorities
  const matchTagMap = useMemo(() => {
    const scored = ORDERED_CROPS.map((c) => ({
      id: c.id,
      score: scoreCropPriority(c, priorities)
    })).sort((a, b) => b.score - a.score);

    const tags: Record<string, string> = {};
    scored.slice(0, 3).forEach((item) => {
      tags[item.id] = getTranslation(language, 'priorities.topMatch');
    });
    scored.slice(3, 5).forEach((item) => {
      tags[item.id] = getTranslation(language, 'priorities.goodMatch');
    });
    return tags;
  }, [priorities, language]);

  const enabledCropCount = ORDERED_CROPS.length - excludedCropIds.length;
  const isLowCropCount = enabledCropCount < 2;

  // Pagination slice
  const [sliceStart, sliceEnd] = showAll ? [0, ORDERED_CROPS.length] : PAGES[page];
  const visibleCrops = ORDERED_CROPS.slice(sliceStart, sliceEnd);

  const getLevelLabel = (val: number) => {
    if (val >= 75) return getTranslation(language, 'priorities.levelHigh');
    if (val >= 40) return getTranslation(language, 'priorities.levelMedium');
    return getTranslation(language, 'priorities.levelLow');
  };

  const getCropGroup = (cropId: string) => {
    return CROP_GROUPS.find((g) => g.cropIds.includes(cropId));
  };

  return (
    <div className="space-y-6">
      {/* 2-Column Split: Sliders on Left, Crop Selector on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 6 Color-Coded Priority Sliders (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-white border-[1.5px] border-at-line rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sliders className="w-5 h-5 text-at-dk" />
              <h2 className="text-base sm:text-lg font-bold text-at-dk">
                {getTranslation(language, 'priorities.slidersTitle')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-at-muted mb-4">
              {getTranslation(language, 'priorities.subtitle')}
            </p>

            <div className="space-y-3.5">
              {sliderConfigs.map((slider) => {
                const value = priorities[slider.key];
                const levelStr = getLevelLabel(value);

                return (
                  <div
                    key={slider.key}
                    className="p-3 rounded-xl border border-at-line/80 bg-at-ow/50 hover:bg-white transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-xs"
                          style={{ backgroundColor: slider.color }}
                        />
                        <span className="text-xs sm:text-sm font-bold text-at-dk">
                          {getTranslation(language, slider.titleKey)}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-at-dk text-white shrink-0">
                        {value}% · {levelStr}
                      </span>
                    </div>

                    <p className="text-[11px] text-at-muted mb-2 leading-relaxed">
                      {getTranslation(language, slider.descKey)}
                    </p>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={value}
                      aria-label={getTranslation(language, slider.titleKey)}
                      onChange={(e) => setPriority(slider.key, Number(e.target.value))}
                      className="at-slider cursor-pointer"
                      style={
                        {
                          '--c': slider.color,
                          '--p': `${value}%`
                        } as React.CSSProperties
                      }
                    />

                    <div className="flex justify-between text-[10px] text-at-muted mt-1 font-medium">
                      <span>{getTranslation(language, 'priorities.scaleLow')}</span>
                      <span>{getTranslation(language, 'priorities.scaleMedium')}</span>
                      <span>{getTranslation(language, 'priorities.scaleHigh')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Match Status Strip */}
          <div className="mt-5 pt-3 border-t border-at-line/60">
            <div className="p-2.5 rounded-xl bg-at-ow border border-at-line text-xs font-semibold text-at-dk flex items-center gap-1.5">
              <span className="text-at-axo">✦</span>
              <span>
                {getTranslation(language, 'priorities.showingCropsCount')
                  .replace('{visible}', String(ORDERED_CROPS.length))
                  .replace('{total}', String(ORDERED_CROPS.length))
                  .replace('{enabled}', String(enabledCropCount))}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Field History & Paginated 13-Crop Selector (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-white border-[1.5px] border-at-line rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="text-base sm:text-lg font-bold text-at-dk">
                {getTranslation(language, 'priorities.suggestedCrops')}
              </h2>
              <span className="bg-at-lime text-at-dk rounded-full px-2.5 py-0.5 text-xs font-bold shrink-0">
                {getTranslation(language, 'priorities.bestMatchesBadge')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-at-muted mb-4">
              {getTranslation(language, 'priorities.suggestedCropsDesc')}
            </p>

            {/* Field History Dropdown */}
            <div className="p-3.5 rounded-xl bg-at-ow border-[1.5px] border-at-line mb-4">
              <label
                htmlFor="recent-crop-select"
                className="block text-xs font-bold text-at-dk mb-1.5"
              >
                {getTranslation(language, 'priorities.recentCrop')}
              </label>
              <select
                id="recent-crop-select"
                value={recentCropId || ''}
                onChange={(e) => setRecentCropId(e.target.value || null)}
                className="w-full sm:w-auto min-w-[260px] px-3.5 py-2 rounded-xl border border-at-axo bg-white text-at-dk text-xs font-bold focus:ring-2 focus:ring-at-dk focus:border-at-dk cursor-pointer"
              >
                <option value="">{getTranslation(language, 'priorities.noneOrUnknown')}</option>
                {ORDERED_CROPS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {language === 'fil' ? c.name.local : c.name.en} ({c.family})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-at-muted mt-2 leading-relaxed">
                {getTranslation(language, 'priorities.diseaseBreakRationale')}
              </p>
            </div>

            {/* Accessible Inline Low Crop Count Warning Banner (Review Focus #3) */}
            {isLowCropCount && (
              <div
                role="alert"
                className="mb-4 p-3.5 rounded-xl border border-at-warn-border bg-at-warn-bg text-at-warn-text flex items-center gap-2 text-xs font-semibold"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-at-warn-border" />
                <span>{getTranslation(language, 'priorities.lowCropWarning')}</span>
              </div>
            )}

            {/* Paginated 13-Crop Cards */}
            <div className="space-y-2">
              {visibleCrops.map((crop, idx) => {
                const group = getCropGroup(crop.id);
                const prevCrop = idx > 0 ? visibleCrops[idx - 1] : null;
                const prevGroup = prevCrop ? getCropGroup(prevCrop.id) : null;
                const isFirstOfGroup = !prevGroup || prevGroup.key !== group?.key;

                const isSelected = !excludedCropIds.includes(crop.id);
                const meta = CROP_METAS[crop.id] || { traits: [], risk: 'med' };
                const matchBadge = matchTagMap[crop.id];

                return (
                  <React.Fragment key={crop.id}>
                    {isFirstOfGroup && group && (
                      <div className="text-[11px] font-bold tracking-wider text-at-dk uppercase pt-2 pb-1">
                        {getTranslation(language, group.nameKey)}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCropExclusion(crop.id)}
                      aria-pressed={isSelected}
                      className={`w-full text-left p-3 rounded-xl border-[1.5px] transition-all flex flex-col justify-between min-h-[96px] cursor-pointer ${
                        isSelected
                          ? 'border-at-dk bg-at-tint/60 text-at-dk shadow-xs'
                          : 'border-at-line bg-white/60 opacity-60 text-stone-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="font-bold text-sm truncate">
                            {language === 'fil' ? crop.name.local : crop.name.en}
                          </span>
                          <span className="text-xs text-at-muted truncate">
                            · {language === 'fil' ? crop.name.en : crop.name.local}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {matchBadge && (
                            <span className="bg-at-lime text-at-dk rounded-full px-2 py-0.5 text-[10px] font-bold">
                              ✦ {matchBadge}
                            </span>
                          )}
                          <span
                            className={`w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center text-xs font-bold transition-colors ${
                              isSelected
                                ? 'border-at-dk bg-at-dk text-white'
                                : 'border-stone-300 bg-white text-transparent'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-end justify-between gap-2 mt-2 pt-1">
                        <div className="flex flex-wrap gap-1.5">
                          {meta.traits.map((traitKey) => {
                            const def = TRAIT_DEFS[traitKey];
                            return (
                              <span key={traitKey} className={`pill ${def.cssClass}`}>
                                {getTranslation(language, def.nameKey)}
                              </span>
                            );
                          })}
                        </div>

                        <span className={`pill ${meta.risk === 'low' ? 'p-low' : 'p-med'} shrink-0`}>
                          <Shield className="w-2.5 h-2.5 stroke-[2.5]" />
                          <span>
                            {meta.risk === 'low'
                              ? getTranslation(language, 'priorities.riskLow')
                              : getTranslation(language, 'priorities.riskMed')}
                          </span>
                        </span>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Pagination Controls Footer */}
          <div className="mt-5 pt-3 border-t border-at-line flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs font-medium text-at-muted">
              {getTranslation(language, 'priorities.showingPage')
                .replace('{start}', String(sliceStart + 1))
                .replace('{end}', String(sliceEnd))
                .replace('{total}', String(ORDERED_CROPS.length))}
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || showAll}
                className="px-2.5 py-1 rounded-lg border border-at-line text-xs font-semibold text-at-dk bg-white hover:bg-at-ow disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                ‹ {getTranslation(language, 'priorities.prevPage')}
              </button>

              {PAGES.map((_, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setPage(idx);
                    setShowAll(false);
                  }}
                  disabled={showAll}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    page === idx && !showAll
                      ? 'bg-at-dk text-white border border-at-dk'
                      : 'border border-at-line bg-white hover:bg-at-ow text-at-dk disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(PAGES.length - 1, p + 1))}
                disabled={page === PAGES.length - 1 || showAll}
                className="px-2.5 py-1 rounded-lg border border-at-line text-xs font-semibold text-at-dk bg-white hover:bg-at-ow disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                {getTranslation(language, 'priorities.nextPage')} ›
              </button>

              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="ml-1 px-3 py-1 rounded-lg border border-at-dk text-xs font-bold bg-at-tint hover:bg-at-lime/40 text-at-dk transition-colors cursor-pointer"
              >
                {showAll
                  ? getTranslation(language, 'priorities.paginateCrops')
                  : getTranslation(language, 'priorities.showAllWithCount').replace(
                      '{count}',
                      String(ORDERED_CROPS.length)
                    )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Box: Generate & Rank Rotation Plans */}
      <div className="p-4 sm:p-5 rounded-2xl bg-at-tint border border-at-line text-center flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => setCurrentStep(4)}
          className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm sm:text-base font-bold bg-at-green hover:bg-at-lime-bright border border-at-dk text-at-dk shadow-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-at-dk" />
          <span>{getTranslation(language, 'priorities.generateButton')}</span>
        </button>
        <p className="text-xs text-at-muted max-w-xl mx-auto leading-relaxed">
          {getTranslation(language, 'priorities.generateRationale')}
        </p>
      </div>
    </div>
  );
};
