import { resolvePlanningSoil, hasDemoSoil } from '../services/planningSoil';
import { contextProvenance, formatProvenance, formatLocalReview, hasProvisionalEvidence } from '../data/provenance';
import { generateLocalReviewChecklist } from '../engine/explainer';
import type { PlanDataContext } from '../data/provenance';
import type { Language } from '../types';
import React, { useState } from 'react';
import type { RotationPlan } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import {
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Sprout,
  Droplets,
  Coins,
  Clock,
  Sparkles,
  Printer,
  Bookmark
} from 'lucide-react';

export const PlanDataEvidence: React.FC<{ context: PlanDataContext; language: Language; forPrint?: boolean }> = ({ context, language, forPrint }) => (
  <>
    {hasProvisionalEvidence(context) && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950 print:break-inside-avoid">
      {getTranslation(language, hasDemoSoil(context.soil)?'mvp.printNotice':'dataQuality.provisionalDetail')}
    </p>}
    <details open={forPrint || undefined} className="mt-4 rounded-xl border border-stone-300 bg-stone-50 p-3 text-xs text-stone-800 break-words print:break-inside-auto">
      <summary className="cursor-pointer font-bold text-emerald-950 focus-visible:outline-2 focus-visible:outline-emerald-800">
        {getTranslation(language, 'provenance.title')}
      </summary>
      <ul className="mt-2 space-y-2">
        {contextProvenance(context).map(({ key, metadata }) => <li key={key} className="print:break-inside-avoid">{formatProvenance(language, metadata)}</li>)}
      </ul>
      {context.land && !context.land.ndvi.trendAvailable && <p className="mt-2 font-semibold">{getTranslation(language, 'land.insufficientTrendData')}</p>}
      <p className="mt-2 font-semibold">{getTranslation(language, 'provenance.derived')}</p>
    </details>
  </>
);

interface RotationCardProps {
  plan: RotationPlan;
  rank: number;
}

export const LocalReviewChecklist: React.FC<{ plan: RotationPlan; context: PlanDataContext; language: Language; forPrint?: boolean }> = ({ plan, context, language, forPrint }) => {
  const Heading = forPrint ? 'h3' : 'h4';
  return (
    <section className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-stone-900 print:break-inside-auto">
      <Heading className="font-bold text-amber-950">{getTranslation(language, 'localReview.title')}</Heading>
      <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
        {generateLocalReviewChecklist(plan, context).map(item => {
          const descriptor = item.id === 'buyerPrices' ? { ...item, params: { ...item.params,
            crops: [...new Set(plan.seasons.filter(season => season.crop.family !== 'fallow')
              .map(season => language === 'fil' ? season.crop.name.local : season.crop.name.en))].join(', ') } } : item;
          return <li key={item.id} className="print:break-inside-avoid">{formatLocalReview(language, descriptor)}</li>;
        })}
      </ul>
    </section>
  );
};

export const RotationCard: React.FC<RotationCardProps> = ({ plan, rank }) => {
  const {
    useDemoAssumptions,
    language,
    activeScenario,
    comparedPlanIds,
    togglePlanComparison,
    climateData,
    soilData,
    soilOverride,
    landSummary,
    activeSpotlightPlanId,
    promotePlan,
    savePlan,
    savedPlans,
    recommendedPlans
  } = useAppStore();

  const [isWhyExpanded, setIsWhyExpanded] = useState(false);
  const [isRisksExpanded, setIsRisksExpanded] = useState(false);

  const context: PlanDataContext = {
    climate: climateData,
    soil: soilData ? resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions) : null,
    land: landSummary
  };

  const isComparing = comparedPlanIds.includes(plan.id);
  const isSaved = savedPlans.some((sp) => sp.plan.id === plan.id);
  const isPromoted = activeSpotlightPlanId === plan.id && rank > 1;
  const currentScenarioScore = plan.scenarioScores[activeScenario];
  const baselineScore = plan.scenarioScores.baseline;
  const scoreDelta = currentScenarioScore - baselineScore;

  // Robustness badge style
  const getRobustnessBadge = () => {
    if (hasProvisionalEvidence(context)) return {
      label: getTranslation(language, 'dataQuality.provisional'),
      class: 'bg-amber-100 text-amber-950 border-amber-300',
      icon: AlertTriangle
    };
    switch (plan.robustness) {
      case 'robust':
        return {
          label: getTranslation(language, 'results.robustBadge'),
          class: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          icon: ShieldCheck
        };
      case 'moderate':
        return {
          label: getTranslation(language, 'results.moderateBadge'),
          class: 'bg-amber-100 text-amber-900 border-amber-300',
          icon: AlertTriangle
        };
      case 'vulnerable':
        return {
          label: getTranslation(language, 'results.vulnerableBadge'),
          class: 'bg-rose-100 text-rose-900 border-rose-300',
          icon: Flame
        };
    }
  };

  const badge = getRobustnessBadge();
  const BadgeIcon = badge.icon;

  return (
    <div
      className={`bg-white rounded-3xl border-2 transition-all mb-6 overflow-hidden shadow-xs hover:shadow-md ${
        rank === 1 || activeSpotlightPlanId === plan.id
          ? 'border-at-dk ring-2 ring-at-green/30'
          : 'border-at-line'
      }`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
        {/* Left Column: Fit Breakdown, Tips, Provenance, Local Review */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* 5-Pillar Score Progress Bars */}
          <div className="bg-at-ow/80 rounded-2xl p-4 border border-at-line">
            <h4 className="text-xs font-bold text-at-dk uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>{getTranslation(language, 'results.pillarBreakdown')}</span>
              <span className="text-[11px] font-mono text-at-muted">{currentScenarioScore}/100</span>
            </h4>

            <div className="space-y-3">
              {/* Soil Health */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-at-dk mb-1">
                  <span className="flex items-center gap-1.5">
                    <Sprout className="w-3.5 h-3.5 text-at-axo" />
                    <span>{getTranslation(language, 'results.pillarSoil')}</span>
                  </span>
                  <span className="font-mono font-bold">{plan.scores.soilHealth}</span>
                </div>
                <div className="h-2 w-full bg-at-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-at-dk rounded-full transition-all duration-300"
                    style={{ width: `${plan.scores.soilHealth}%` }}
                  />
                </div>
              </div>

              {/* Water Resilience */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-at-dk mb-1">
                  <span className="flex items-center gap-1.5">
                    <Droplets className="w-3.5 h-3.5 text-at-blue" />
                    <span>{getTranslation(language, 'results.pillarWater')}</span>
                  </span>
                  <span className="font-mono font-bold">{plan.scores.waterResilience}</span>
                </div>
                <div className="h-2 w-full bg-at-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-at-blue rounded-full transition-all duration-300"
                    style={{ width: `${plan.scores.waterResilience}%` }}
                  />
                </div>
              </div>

              {/* Climate Shock Buffer */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-at-dk mb-1">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-at-amber" />
                    <span>{getTranslation(language, 'results.pillarClimate')}</span>
                  </span>
                  <span className="font-mono font-bold">{plan.scores.climateRisk}</span>
                </div>
                <div className="h-2 w-full bg-at-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-at-amber rounded-full transition-all duration-300"
                    style={{ width: `${plan.scores.climateRisk}%` }}
                  />
                </div>
              </div>

              {/* Economics */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-at-dk mb-1">
                  <span className="flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-at-green" />
                    <span>{getTranslation(language, 'results.pillarEconomics')}</span>
                  </span>
                  <span className="font-mono font-bold">{plan.scores.economics}</span>
                </div>
                <div className="h-2 w-full bg-at-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-at-green rounded-full transition-all duration-300"
                    style={{ width: `${plan.scores.economics}%` }}
                  />
                </div>
              </div>

              {/* Labor */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-at-dk mb-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-at-indigo" />
                    <span>{getTranslation(language, 'results.pillarLabor')}</span>
                  </span>
                  <span className="font-mono font-bold">{plan.scores.labor}</span>
                </div>
                <div className="h-2 w-full bg-at-track rounded-full overflow-hidden">
                  <div
                    className="h-full bg-at-indigo rounded-full transition-all duration-300"
                    style={{ width: `${plan.scores.labor}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Expandable Reasons & Risks Accordions */}
          <div className="flex flex-col gap-2">
            {/* Why this plan button */}
            <button
              type="button"
              onClick={() => setIsWhyExpanded(!isWhyExpanded)}
              className="flex items-center justify-between w-full py-2.5 px-3.5 rounded-xl bg-at-ow hover:bg-at-tint/60 text-xs font-bold text-at-dk border border-at-line transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-at-amber" />
                {getTranslation(language, 'results.whyButton')} ({plan.reasons.length} science rules)
              </span>
              {isWhyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isWhyExpanded && (
              <div className="p-3.5 rounded-xl bg-at-tint/50 border border-at-line text-xs space-y-2.5">
                {plan.reasons.map((reason) => (
                  <div key={reason.id} className="pb-2 border-b border-at-line/60 last:border-0 last:pb-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-at-dk uppercase">
                      <span>[{reason.ruleId}]</span>
                    </div>
                    <p className="text-at-dk font-medium mt-0.5 leading-relaxed">
                      {language === 'fil' ? reason.textFil : reason.textEn}
                    </p>
                    <p className="text-[11px] text-at-muted mt-1 italic">
                      ↳ Evidence: {reason.dataEvidence}<br />{getTranslation(language, 'provenance.evidence')}: {getTranslation(language, 'provenance.title')}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Operational Risks button */}
            {plan.risks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRisksExpanded(!isRisksExpanded)}
                  className="flex items-center justify-between w-full py-2.5 px-3.5 rounded-xl bg-at-ow hover:bg-at-tint/60 text-xs font-bold text-at-dk border border-at-line transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    {getTranslation(language, 'results.risksButton')} ({plan.risks.length})
                  </span>
                  {isRisksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isRisksExpanded && (
                  <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 text-xs space-y-2.5">
                    {plan.risks.map((risk) => (
                      <div key={risk.id} className="pb-2 border-b border-rose-100/60 last:border-0 last:pb-0">
                        <div className="text-rose-950 font-medium">
                          ⚠️ {language === 'fil' ? risk.textFil : risk.textEn}
                        </div>
                        <div className="text-[11px] text-stone-700 mt-1 pl-4 border-l-2 border-amber-400">
                          <strong className="text-stone-900">Mitigation:</strong>{' '}
                          {language === 'fil' ? risk.mitigationFil : risk.mitigationEn}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <PlanDataEvidence context={context} language={language} />
          <LocalReviewChecklist plan={plan} context={context} language={language} />
        </div>

        {/* Right Column: Spotlight Header, Biological Break, 3 Season Cards, Action Bar */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-5">
          <div>
            {/* Top Header / Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-at-line">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-xs font-mono shrink-0 ${
                    rank === 1
                      ? 'bg-at-dk text-at-lime ring-2 ring-at-green/40'
                      : 'bg-at-tint text-at-dk font-bold border border-at-line'
                  }`}
                >
                  #{rank}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {isPromoted && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-at-green text-at-dk border border-at-dk/20 shadow-2xs">
                        <Sparkles className="w-3 h-3 text-at-dk" />
                        <span>{getTranslation(language, 'results.promotedBadge').replace('{rank}', String(rank))}</span>
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.class}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    {plan.isBaseline && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-stone-100 text-stone-700 border-stone-300">
                        {getTranslation(language, 'results.baselineBadge')}
                      </span>
                    )}

                    {isPromoted && recommendedPlans.length > 0 && (
                      <button
                        type="button"
                        onClick={() => promotePlan(recommendedPlans[0].id)}
                        className="text-[11px] font-bold text-at-muted hover:text-at-dk underline transition-colors cursor-pointer"
                      >
                        {getTranslation(language, 'results.resetToTopPlan')}
                      </button>
                    )}
                  </div>

                  <h3 className="font-black text-at-dk text-base sm:text-lg leading-tight">
                    {language === 'fil' ? plan.name.local : plan.name.en}
                  </h3>
                </div>
              </div>

              {/* Overall Score Readout */}
              <div className="text-left sm:text-right shrink-0">
                <div className="text-[10px] uppercase font-bold text-at-muted">
                  {getTranslation(language, 'results.scoreLabel')}
                </div>
                <div className="flex items-baseline gap-1 sm:justify-end">
                  <span className="text-2xl sm:text-3xl font-black text-at-dk font-mono">
                    {currentScenarioScore}
                  </span>
                  <span className="text-xs text-at-muted">/100</span>

                  {activeScenario !== 'baseline' && scoreDelta !== 0 && (
                    <span
                      className={`text-xs font-bold font-mono ml-1 ${
                        scoreDelta > 0 ? 'text-at-axo' : 'text-rose-600'
                      }`}
                    >
                      ({scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Biological Break Banner */}
            <div className="mt-4 p-3 bg-at-tint/70 border border-at-line rounded-xl text-xs text-at-dk flex items-center gap-2">
              <Sprout className="w-4 h-4 text-at-dk shrink-0" />
              <span>{getTranslation(language, 'priorities.diseaseBreakRationale')}</span>
            </div>

            {/* 3-Season Visual Timeline Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {plan.seasons.map((step, idx) => {
                const crop = step.crop;
                return (
                  <div
                    key={step.seasonKey}
                    className="p-3.5 rounded-2xl bg-at-ow border border-at-line flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-at-muted mb-1.5">
                        <span className="uppercase tracking-wider">
                          S{idx + 1}: {language === 'fil' ? step.seasonName.local : step.seasonName.en}
                        </span>
                        <span className="font-mono text-at-muted font-medium">{step.periodMonths}</span>
                      </div>

                      {/* Crop Name */}
                      <div className="text-sm font-black text-at-dk">
                        {language === 'fil' ? crop.name.local : crop.name.en}
                      </div>
                      <div className="text-xs text-at-muted italic mb-2">
                        {language === 'fil' ? crop.name.en : crop.name.local}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-at-line text-at-dk uppercase">
                          {crop.family}
                        </span>
                        {crop.nitrogenFixing && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-at-tint text-at-dk border border-at-green/40">
                            +N Fixer
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200/50">
                          Water: {crop.waterDemand}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200/50">
                          Root: {crop.rootDepth}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-semibold text-at-dk pt-2 border-t border-at-line/60">
                      {step.role}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="pt-4 border-t border-at-line flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Save Plan */}
              <button
                type="button"
                onClick={() => savePlan(plan, rank)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isSaved
                    ? 'bg-at-dk text-at-lime border-at-dk shadow-xs'
                    : 'bg-white hover:bg-at-ow text-at-dk border-at-line'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>
                  {isSaved
                    ? getTranslation(language, 'results.planSaved')
                    : getTranslation(language, 'results.savePlan')}
                </span>
              </button>

              {/* Compare Button */}
              <button
                type="button"
                onClick={() => togglePlanComparison(plan.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                  isComparing
                    ? 'bg-at-dk text-white border-at-dk shadow-xs'
                    : 'bg-white hover:bg-at-ow text-at-dk border-at-line'
                }`}
              >
                <span>
                  {isComparing
                    ? `✓ ${getTranslation(language, 'results.comparing')}`
                    : `+ ${getTranslation(language, 'results.compareButton')}`}
                </span>
              </button>
            </div>

            {/* Print / Share Button */}
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-at-green hover:bg-at-lime-bright text-at-dk flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-at-dk" />
              <span>Print / Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
