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
  Sparkles
} from 'lucide-react';

interface RotationCardProps {
  plan: RotationPlan;
  rank: number;
}

export const RotationCard: React.FC<RotationCardProps> = ({ plan, rank }) => {
  const { language, activeScenario, comparedPlanIds, togglePlanComparison } = useAppStore();
  const [isWhyExpanded, setIsWhyExpanded] = useState(false);
  const [isRisksExpanded, setIsRisksExpanded] = useState(false);

  const isComparing = comparedPlanIds.includes(plan.id);
  const currentScenarioScore = plan.scenarioScores[activeScenario];
  const baselineScore = plan.scenarioScores.baseline;
  const scoreDelta = currentScenarioScore - baselineScore;

  // Robustness badge style
  const getRobustnessBadge = () => {
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
      className={`bg-white rounded-2xl border transition-all mb-5 overflow-hidden shadow-sm hover:shadow-md ${
        rank === 1
          ? 'border-emerald-600/60 ring-2 ring-emerald-600/10'
          : 'border-stone-200'
      }`}
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 bg-stone-50/80 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Rank Badge */}
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${
              rank === 1
                ? 'bg-amber-500 text-stone-950 font-black ring-2 ring-amber-400/50'
                : 'bg-stone-200 text-stone-700'
            }`}
          >
            #{rank}
          </div>

          <div>
            <h3 className="font-bold text-stone-900 text-sm sm:text-base leading-tight">
              {language === 'fil' ? plan.name.local : plan.name.en}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.class}`}
              >
                <BadgeIcon className="w-3 h-3" />
                <span>{badge.label}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Score Readout & Compare Checkbox */}
        <div className="flex items-center justify-between sm:justify-end gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-stone-500">
              {getTranslation(language, 'results.scoreLabel')}
            </div>
            <div className="flex items-baseline gap-1.5 justify-end">
              <span className="text-2xl font-black text-stone-900 font-mono">
                {currentScenarioScore}
              </span>
              <span className="text-xs text-stone-400">/100</span>

              {activeScenario !== 'baseline' && scoreDelta !== 0 && (
                <span
                  className={`text-xs font-bold font-mono ${
                    scoreDelta > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  ({scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta})
                </span>
              )}
            </div>
          </div>

          {/* Compare Button */}
          <button
            onClick={() => togglePlanComparison(plan.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
              isComparing
                ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
            }`}
          >
            {isComparing
              ? `✓ ${getTranslation(language, 'results.comparing')}`
              : `+ ${getTranslation(language, 'results.compareButton')}`}
          </button>
        </div>
      </div>

      {/* 3-Season Visual Timeline Strip */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative">
          {plan.seasons.map((step) => {
            const crop = step.crop;
            return (
              <div
                key={step.seasonKey}
                className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-stone-500 mb-1.5">
                    <span className="uppercase tracking-wider">
                      {language === 'fil' ? step.seasonName.local : step.seasonName.en}
                    </span>
                    <span className="font-mono text-stone-400 font-medium">{step.periodMonths}</span>
                  </div>

                  {/* Crop Name */}
                  <div className="text-sm sm:text-base font-extrabold text-stone-900">
                    {language === 'fil' ? crop.name.local : crop.name.en}
                  </div>
                  <div className="text-xs text-stone-500 italic mb-2">
                    {language === 'fil' ? crop.name.en : crop.name.local}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-stone-200 text-stone-700 uppercase">
                      {crop.family}
                    </span>
                    {crop.nitrogenFixing && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        +N Fixer
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                      Water: {crop.waterDemand}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800">
                      Root: {crop.rootDepth}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-emerald-800 pt-2 border-t border-stone-200/60">
                  {step.role}
                </div>
              </div>
            );
          })}
        </div>

        {/* Multi-Pillar Score Progress Bars */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-stone-100">
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1">
              <span className="flex items-center gap-1">
                <Sprout className="w-3 h-3 text-emerald-600" /> Soil
              </span>
              <span className="font-mono font-bold">{plan.scores.soilHealth}</span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full"
                style={{ width: `${plan.scores.soilHealth}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1">
              <span className="flex items-center gap-1">
                <Droplets className="w-3 h-3 text-blue-600" /> Water
              </span>
              <span className="font-mono font-bold">{plan.scores.waterResilience}</span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${plan.scores.waterResilience}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-rose-600" /> Climate
              </span>
              <span className="font-mono font-bold">{plan.scores.climateRisk}</span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-600 rounded-full"
                style={{ width: `${plan.scores.climateRisk}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1">
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-600" /> Income
              </span>
              <span className="font-mono font-bold">{plan.scores.economics}</span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 rounded-full"
                style={{ width: `${plan.scores.economics}%` }}
              ></div>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <div className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-600" /> Labor
              </span>
              <span className="font-mono font-bold">{plan.scores.labor}</span>
            </div>
            <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full"
                style={{ width: `${plan.scores.labor}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Expandable Reasons & Risks Accordions */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex flex-col gap-2">
          {/* Why this plan button */}
          <button
            onClick={() => setIsWhyExpanded(!isWhyExpanded)}
            className="flex items-center justify-between w-full py-2 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-800 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              {getTranslation(language, 'results.whyButton')} ({plan.reasons.length} science rules)
            </span>
            {isWhyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {isWhyExpanded && (
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs space-y-2.5">
              {plan.reasons.map((reason) => (
                <div key={reason.id} className="pb-2 border-b border-emerald-100/60 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-800 uppercase">
                    <span>[{reason.ruleId}]</span>
                  </div>
                  <p className="text-stone-800 font-medium mt-0.5 leading-relaxed">
                    {language === 'fil' ? reason.textFil : reason.textEn}
                  </p>
                  <p className="text-[11px] text-emerald-700/90 mt-1 italic">
                    ↳ Evidence: {reason.dataEvidence}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Operational Risks button */}
          {plan.risks.length > 0 && (
            <>
              <button
                onClick={() => setIsRisksExpanded(!isRisksExpanded)}
                className="flex items-center justify-between w-full py-2 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-xs font-bold text-stone-800 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  {getTranslation(language, 'results.risksButton')} ({plan.risks.length})
                </span>
                {isRisksExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {isRisksExpanded && (
                <div className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-100 text-xs space-y-2.5">
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
      </div>
    </div>
  );
};
