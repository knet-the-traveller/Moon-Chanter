import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { X, ShieldCheck, Sprout, Droplets, Coins, Clock } from 'lucide-react';

export const ComparisonModal: React.FC = () => {
  const {
    isComparisonModalOpen,
    setComparisonModalOpen,
    comparedPlanIds,
    recommendedPlans,
    language
  } = useAppStore();

  if (!isComparisonModalOpen) return null;

  const selectedPlans = recommendedPlans.filter((p) => comparedPlanIds.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-stone-900">
              Side-by-Side Rotation Comparison
            </h3>
            <p className="text-xs text-stone-500">
              Comparing {selectedPlans.length} rotation plan{selectedPlans.length > 1 ? 's' : ''} across agronomic and climate metrics.
            </p>
          </div>
          <button
            onClick={() => setComparisonModalOpen(false)}
            className="p-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Matrix */}
        <div className="overflow-x-auto py-4 flex-1">
          {selectedPlans.length === 0 ? (
            <div className="text-center py-12 text-sm text-stone-500">
              No plans selected for comparison. Click &quot;+ Compare Plan&quot; on any rotation card.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-[600px]">
              {selectedPlans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border border-stone-200 p-4 bg-stone-50/60 flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                      <div>
                        <div className="text-[11px] font-bold text-stone-500 uppercase">
                          Plan #{idx + 1}
                        </div>
                        <div className="text-sm font-bold text-stone-900 leading-snug">
                          {language === 'fil' ? plan.name.local : plan.name.en}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-stone-900 font-mono">
                          {plan.scores.overall}
                        </div>
                        <div className="text-[10px] text-stone-400">Score</div>
                      </div>
                    </div>

                    {/* Seasons */}
                    <div className="py-3 space-y-2 border-b border-stone-200 text-xs">
                      {plan.seasons.map((s, sIdx) => (
                        <div key={s.seasonKey} className="flex justify-between items-center bg-white p-2 rounded-lg border border-stone-200/70">
                          <div>
                            <span className="text-[10px] font-bold text-stone-400 mr-1">S{sIdx + 1}:</span>
                            <span className="font-bold text-stone-800">
                              {language === 'fil' ? s.crop.name.local : s.crop.name.en}
                            </span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 font-mono text-stone-600">
                            {s.crop.family}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Scores Comparison */}
                    <div className="py-3 space-y-1.5 text-xs border-b border-stone-200">
                      <div className="font-bold text-stone-700 text-[11px] uppercase mb-1">Pillar Breakdown</div>
                      <div className="flex justify-between">
                        <span className="text-stone-600 flex items-center gap-1">
                          <Sprout className="w-3 h-3 text-emerald-600" /> Soil Health:
                        </span>
                        <span className="font-mono font-bold">{plan.scores.soilHealth}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600 flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-blue-600" /> Water Resilience:
                        </span>
                        <span className="font-mono font-bold">{plan.scores.waterResilience}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-rose-600" /> Climate Risk:
                        </span>
                        <span className="font-mono font-bold">{plan.scores.climateRisk}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600 flex items-center gap-1">
                          <Coins className="w-3 h-3 text-amber-600" /> Economics:
                        </span>
                        <span className="font-mono font-bold">{plan.scores.economics}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-600" /> Labor:
                        </span>
                        <span className="font-mono font-bold">{plan.scores.labor}/100</span>
                      </div>
                    </div>

                    {/* Climate Shock Resiliency */}
                    <div className="pt-3 text-xs">
                      <div className="font-bold text-stone-700 text-[11px] uppercase mb-1">
                        Stress Scenarios
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <div className="bg-white p-1.5 rounded border border-stone-200">
                          Hotter (+1.5°): <strong className="font-mono">{plan.scenarioScores.hotter}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-stone-200">
                          Drier (-15%): <strong className="font-mono">{plan.scenarioScores.drier}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-stone-200">
                          Compound: <strong className="font-mono">{plan.scenarioScores.hotterAndDrier}</strong>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-stone-200">
                          Wetter (+15%): <strong className="font-mono">{plan.scenarioScores.wetter}</strong>
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
        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            onClick={() => setComparisonModalOpen(false)}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-stone-900 text-white hover:bg-stone-800 transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
