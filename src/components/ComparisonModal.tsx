import { resolvePlanningSoil } from '../services/planningSoil';
import { PlanDataEvidence, LocalReviewChecklist } from './RotationCard';
import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { X, ShieldCheck, Sprout, Droplets, Coins, Clock } from 'lucide-react';

export const ComparisonModal: React.FC = () => {
  const {
    useDemoAssumptions,
    isComparisonModalOpen,
    setComparisonModalOpen,
    comparedPlanIds,
    recommendedPlans,
    language,
    climateData,
    soilData,
    soilOverride,
    landSummary
  } = useAppStore();

  useEffect(() => {
    if (!isComparisonModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setComparisonModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isComparisonModalOpen, setComparisonModalOpen]);

  if (!isComparisonModalOpen) return null;

  const context = {
    climate: climateData,
    soil: soilData ? resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions) : null,
    land: landSummary
  };
  const selectedPlans = recommendedPlans.filter((p) => comparedPlanIds.includes(p.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comparison-modal-title"
      className="fixed inset-0 z-50 bg-at-dk/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border-2 border-at-line max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-at-line">
          <div className="flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}images/landing/logo.png`}
              alt="AniTala"
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-contain shrink-0 ring-1 ring-at-line shadow-2xs"
            />
            <div>
              <h3 id="comparison-modal-title" className="text-lg sm:text-xl font-black text-at-dk">
                Side-by-Side Rotation Comparison
              </h3>
              <p className="text-xs text-at-muted">
                AniTala Agronomic Decision Support · Comparing {selectedPlans.length} rotation plan{selectedPlans.length > 1 ? 's' : ''} across agronomic and climate metrics.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={getTranslation(language, 'provenance.closeComparison')}
            onClick={() => setComparisonModalOpen(false)}
            className="p-2 rounded-full hover:bg-at-ow text-at-muted hover:text-at-dk transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Matrix */}
        <div className="overflow-x-auto py-4 flex-1">
          {selectedPlans.length === 0 ? (
            <div className="text-center py-12 text-sm text-at-muted">
              No plans selected for comparison. Click &quot;+ Compare Plan&quot; on any rotation card.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedPlans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-at-line p-4 bg-at-ow/60 flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-at-line">
                      <div>
                        <div className="text-[11px] font-bold text-at-muted uppercase flex items-center gap-1.5">
                          <span>Plan #{idx + 1}</span>
                          {plan.isBaseline && (
                            <span className="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[10px]">
                              {getTranslation(language, 'results.baselineBadge')}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-at-dk leading-snug">
                          {language === 'fil' ? plan.name.local : plan.name.en}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-at-dk font-mono">
                          {plan.scores.overall}
                        </div>
                        <div className="text-[10px] text-at-muted">Score</div>
                      </div>
                    </div>

                    {/* Seasons */}
                    <div className="py-3 space-y-2 border-b border-at-line text-xs">
                      {plan.seasons.map((s, sIdx) => (
                        <div key={s.seasonKey} className="flex justify-between items-center bg-white p-2 rounded-lg border border-at-line/80">
                          <div>
                            <span className="text-[10px] font-bold text-at-muted mr-1">S{sIdx + 1}:</span>
                            <span className="font-bold text-at-dk">
                              {language === 'fil' ? s.crop.name.local : s.crop.name.en}
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-at-ow font-mono text-at-muted">
                            {s.crop.family}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Scores Comparison */}
                    <div className="py-3 space-y-1.5 text-xs border-b border-at-line">
                      <div className="font-bold text-at-dk text-[11px] uppercase mb-1">
                        {getTranslation(language, 'results.pillarBreakdown')}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-at-muted flex items-center gap-1">
                          <Sprout className="w-3 h-3 text-at-axo" /> {getTranslation(language, 'results.pillarSoil')}:
                        </span>
                        <span className="font-mono font-bold text-at-dk">{plan.scores.soilHealth}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-at-muted flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-at-blue" /> {getTranslation(language, 'results.pillarWater')}:
                        </span>
                        <span className="font-mono font-bold text-at-dk">{plan.scores.waterResilience}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-at-muted flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-at-amber" /> {getTranslation(language, 'results.pillarClimate')}:
                        </span>
                        <span className="font-mono font-bold text-at-dk">{plan.scores.climateRisk}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-at-muted flex items-center gap-1">
                          <Coins className="w-3 h-3 text-at-green" /> {getTranslation(language, 'results.pillarEconomics')}:
                        </span>
                        <span className="font-mono font-bold text-at-dk">{plan.scores.economics}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-at-muted flex items-center gap-1">
                          <Clock className="w-3 h-3 text-at-indigo" /> {getTranslation(language, 'results.pillarLabor')}:
                        </span>
                        <span className="font-mono font-bold text-at-dk">{plan.scores.labor}/100</span>
                      </div>
                    </div>

                    <PlanDataEvidence context={context} language={language} />
                    <LocalReviewChecklist plan={plan} context={context} language={language} />

                    {/* Climate Shock Resiliency */}
                    <div className="pt-3 text-xs">
                      <div className="font-bold text-at-dk text-[11px] uppercase mb-1">
                        Stress Scenarios
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <div className="bg-white p-1.5 rounded border border-at-line">
                          Hotter (+1.5°): <strong className="font-mono text-at-dk">{plan.scenarioScores.hotter}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-at-line">
                          Drier (-15%): <strong className="font-mono text-at-dk">{plan.scenarioScores.drier}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-at-line">
                          Compound: <strong className="font-mono text-at-dk">{plan.scenarioScores.hotterAndDrier}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-at-line">
                          Wetter (+15%): <strong className="font-mono text-at-dk">{plan.scenarioScores.wetter}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-at-line flex justify-end">
          <button
            type="button"
            onClick={() => setComparisonModalOpen(false)}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-at-dk text-white hover:bg-at-dk/90 transition-colors shadow-2xs cursor-pointer"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
