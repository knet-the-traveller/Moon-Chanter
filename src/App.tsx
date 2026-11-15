import { DemoModeNotice } from './components/DemoModeNotice';
import { resolvePlanningSoil } from './services/planningSoil';
import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { getTranslation } from './i18n';
import { Navbar } from './components/Navbar';
import { StepProgress } from './components/StepProgress';
import { MapPicker } from './components/MapPicker';
import { ClimateCard } from './components/ClimateCard';
import { SoilCard } from './components/SoilCard';
import { WaterSourceCard } from './components/WaterSourceCard';
import { FieldNotesCard } from './components/FieldNotesCard';
import { PrioritiesSection } from './components/PrioritiesSection';
import { ScenarioBar } from './components/ScenarioBar';
import { RotationCard } from './components/RotationCard';
import { ComparisonModal } from './components/ComparisonModal';
import { MethodologyModal } from './components/MethodologyModal';
import { SavedPlansModal } from './components/SavedPlansModal';
import { PrintablePlan } from './components/PrintablePlan';
import { hasRequiredSoilInputs } from './engine/soilInputs';
import {
  ArrowRight,
  ArrowLeft,
  Scale,
  Printer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bookmark
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    useDemoAssumptions,
    currentStep,
    setCurrentStep,
    selectedLocation,
    recommendedPlans,
    activeSpotlightPlanId,
    promotePlan,
    savePlan,
    savedPlans,
    setSavedPlansOpen,
    activeScenario,
    comparedPlanIds,
    togglePlanComparison,
    setComparisonModalOpen,
    language,
    soilData,
    soilOverride,
    climateData,
    isLoadingTelemetry,
    advisoryIssuedAt,
    applyMunicipalBaseline
  } = useAppStore();

  const [showAllOtherPlans, setShowAllOtherPlans] = useState(false);
  const [expandedPlanIds, setExpandedPlanIds] = useState<string[]>([]);
  const togglePlanDrawer = (planId: string) => {
    setExpandedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const emptyResultsKey = isLoadingTelemetry
    ? 'dataQuality.loading'
    : !soilData || !climateData
    ? 'dataQuality.missingTelemetry'
    : !hasRequiredSoilInputs(resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions))
    ? 'dataQuality.missingSoil'
    : 'results.noPlans';

  // Initial load: Fetch telemetry for default pilot region on first render
  useEffect(() => {
    const { climateData, landSummary, isLoadingTelemetry, isLoadingLand, selectedLocation, fetchTelemetry } =
      useAppStore.getState();
    if ((!climateData || !landSummary) && !isLoadingTelemetry && !isLoadingLand) {
      void fetchTelemetry(selectedLocation.lat, selectedLocation.lon);
    }
  }, []);

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#F7F9F4] text-[#1D3309] flex flex-col font-sans selection:bg-[#C7DA91]">
      {/* Screen View */}
      <div className="no-print min-w-0 w-full flex-1 flex flex-col">
        <Navbar />
        <StepProgress />

        <main className="min-w-0 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <DemoModeNotice />
          {/* STEP 1: LOCATE FARM */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <MapPicker />
            </div>
          )}

          {/* STEP 2: FIELD CONDITIONS */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-at-dk tracking-tight">
                    {getTranslation(language, 'nav.conditions')}
                  </h2>
                  <p className="text-xs sm:text-sm text-at-muted mt-0.5">
                    Field: <strong className="text-at-dk">{selectedLocation.name}</strong> ({selectedLocation.province}) · Coordinates: {selectedLocation.lat.toFixed(3)}°N, {selectedLocation.lon.toFixed(3)}°E
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-at-line hover:border-at-dk text-at-dk flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Location</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-at-dk hover:bg-at-dk/90 text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>{getTranslation(language, 'nav.priorities')}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-at-lime" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <SoilCard />
                </div>
                <div className="lg:col-span-7 space-y-4">
                  <WaterSourceCard />
                  <ClimateCard />
                  <FieldNotesCard />
                  <div className="action bg-white rounded-2xl p-4 sm:p-5 border border-at-line shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-at-dk">
                        {getTranslation(language, 'priorities.title')}
                      </h3>
                      <p className="text-xs text-at-muted mt-0.5">
                        {getTranslation(language, 'priorities.subtitle')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-sm font-bold bg-at-dk hover:bg-at-dk/90 text-at-lime flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <span>{getTranslation(language, 'nav.priorities')}</span>
                      <ArrowRight className="w-4 h-4 text-at-lime" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PRIORITIES & FIELD HISTORY */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-at-dk tracking-tight">
                    {getTranslation(language, 'priorities.title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-at-muted mt-0.5">
                    {getTranslation(language, 'priorities.subtitle')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-at-line hover:border-at-dk text-at-dk flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Conditions</span>
                  </button>
                </div>
              </div>

              <PrioritiesSection />
            </div>
          )}

          {/* STEP 4: RECOMMENDATIONS & SCENARIO TESTING */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-at-dk tracking-tight">
                    {getTranslation(language, 'results.title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-at-muted mt-0.5">
                    {getTranslation(language, 'results.subtitle')} (Generated {recommendedPlans.length} candidates)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-at-line hover:border-at-dk text-at-dk flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Adjust Priorities</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSavedPlansOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-at-line hover:border-at-dk text-at-dk flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-at-axo" />
                    <span>{getTranslation(language, 'results.savedPlansButton').replace('{count}', String(savedPlans.length))}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={recommendedPlans.length === 0 || advisoryIssuedAt === null}
                    title={recommendedPlans.length === 0 ? getTranslation(language, 'dataQuality.noPrintablePlan') : undefined}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-at-green hover:bg-at-lime-bright text-at-dk flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-at-dk" />
                    <span>{getTranslation(language, 'results.printPlanSheet')}</span>
                  </button>
                </div>
              </div>

              {/* Stress Scenarios Selector Bar */}
              <ScenarioBar />

              {/* Comparison Pill / Banner */}
              {comparedPlanIds.length > 0 && (
                <div className="p-3 bg-at-dk text-white rounded-2xl flex items-center justify-between shadow-xs border border-white/10">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Scale className="w-4 h-4 text-at-lime" />
                    <span>
                      {getTranslation(
                        language,
                        comparedPlanIds.length === 1 ? 'results.comparedQueuedSingular' : 'results.comparedQueuedPlural'
                      ).replace('{count}', String(comparedPlanIds.length))}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComparisonModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-at-green hover:bg-at-lime-bright text-at-dk transition-colors shadow-xs cursor-pointer"
                  >
                    {getTranslation(language, 'results.viewComparison')}
                  </button>
                </div>
              )}

              {/* Ranked Rotation Cards */}
              {recommendedPlans.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-at-line shadow-xs">
                  <p className="text-sm text-at-muted">
                    {getTranslation(language, emptyResultsKey)}
                  </p>
                  {!isLoadingTelemetry && !!climateData && (!soilData || !hasRequiredSoilInputs(resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions))) && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => { void applyMunicipalBaseline(); }}
                        className="inline-flex items-center justify-center rounded-xl bg-at-dk px-4 py-2.5 text-sm font-semibold text-white hover:bg-at-dk/90 focus-visible:outline-2 focus-visible:outline-at-dk cursor-pointer"
                      >
                        {getTranslation(language, 'dataQuality.useMunicipalBaseline')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="inline-flex items-center justify-center rounded-xl border border-at-line bg-white px-4 py-2.5 text-sm font-semibold text-at-dk hover:bg-at-ow focus-visible:outline-2 focus-visible:outline-at-dk cursor-pointer"
                      >
                        {getTranslation(language, 'nav.conditions')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                (() => {
                  const spotlightPlan = recommendedPlans.find((p) => p.id === activeSpotlightPlanId) ?? recommendedPlans[0];
                  const spotlightRank = recommendedPlans.findIndex((p) => p.id === spotlightPlan.id) + 1;
                  const otherPlans = recommendedPlans.filter((p) => p.id !== spotlightPlan.id);
                  const nonBaselinePlans = otherPlans.filter((p) => !p.isBaseline);
                  const baselinePlansInOther = otherPlans.filter((p) => p.isBaseline);
                  const defaultVisiblePlans = [
                    ...nonBaselinePlans.slice(0, 2),
                    ...baselinePlansInOther
                  ];
                  const visibleOtherPlans = showAllOtherPlans
                    ? otherPlans
                    : otherPlans.filter((p) => defaultVisiblePlans.some((dv) => dv.id === p.id));
                  const hasMorePlans = otherPlans.length > defaultVisiblePlans.length;

                  return (
                    <div className="space-y-6">
                      {/* Spotlight Rotation Plan */}
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-at-muted mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-at-green" />
                          <span>{getTranslation(language, 'results.activeSpotlight')}</span>
                        </div>
                        <RotationCard plan={spotlightPlan} rank={spotlightRank} />
                      </div>

                      {/* Other Good Crop Plans */}
                      {otherPlans.length > 0 && (
                        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-at-line shadow-xs space-y-4">
                          <div>
                            <h3 className="text-base sm:text-lg font-black text-at-dk">
                              {getTranslation(language, 'results.otherGoodPlans')}
                            </h3>
                            <p className="text-xs text-at-muted mt-0.5">
                              {getTranslation(language, 'results.otherGoodPlansSub')}
                            </p>
                          </div>

                          <div className="space-y-3">
                            {visibleOtherPlans.map((plan) => {
                              const originalRank = recommendedPlans.findIndex((p) => p.id === plan.id) + 1;
                              const isExpanded = expandedPlanIds.includes(plan.id);
                              const isComparing = comparedPlanIds.includes(plan.id);
                              const isSaved = savedPlans.some((sp) => sp.plan.id === plan.id);
                              const planScenarioScore = plan.scenarioScores[activeScenario];

                              return (
                                <div
                                  key={plan.id}
                                  className="bg-at-ow/60 rounded-2xl border border-at-line shadow-2xs overflow-hidden transition-all"
                                >
                                  {/* Row summary */}
                                  <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-at-tint border border-at-line text-at-dk font-mono font-bold flex items-center justify-center text-xs shrink-0">
                                        #{originalRank}
                                      </div>

                                      <div>
                                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                          <h4 className="text-sm font-bold text-at-dk">
                                            {language === 'fil' ? plan.name.local : plan.name.en}
                                          </h4>
                                          {plan.isBaseline && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-300">
                                              {getTranslation(language, 'results.baselineBadge')}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-at-muted">
                                          {plan.seasons.map((s) => language === 'fil' ? s.crop.name.local : s.crop.name.en).join(' → ')}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                      <div className="text-right">
                                        <div className="text-[10px] font-bold uppercase text-at-muted">
                                          {getTranslation(language, 'results.scoreLabel')}
                                        </div>
                                        <div className="text-base font-black text-at-dk font-mono">
                                          {planScenarioScore}{' '}
                                          <span className="text-[11px] font-normal text-at-muted">/100</span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => togglePlanDrawer(plan.id)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-at-tint/60 text-at-dk border border-at-line flex items-center gap-1 transition-colors cursor-pointer"
                                        aria-expanded={isExpanded}
                                      >
                                        <span>
                                          {isExpanded
                                            ? getTranslation(language, 'results.hidePlanDrawer')
                                            : getTranslation(language, 'results.viewPlanDrawer')}
                                        </span>
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  </div>

                                  {/* Expandable Drawer Content */}
                                  {isExpanded && (
                                    <div className="p-4 sm:p-5 bg-white border-t border-at-line space-y-4">
                                      {/* 3 mini-season summary */}
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {plan.seasons.map((step, idx) => (
                                          <div
                                            key={step.seasonKey}
                                            className="p-3 bg-at-ow rounded-xl border border-at-line text-xs"
                                          >
                                            <div className="flex justify-between items-center text-[10px] font-bold text-at-muted uppercase mb-1">
                                              <span>
                                                S{idx + 1}:{' '}
                                                {language === 'fil'
                                                  ? step.seasonName.local
                                                  : step.seasonName.en}
                                              </span>
                                              <span className="font-mono">{step.periodMonths}</span>
                                            </div>
                                            <div className="font-bold text-at-dk text-sm mb-1">
                                              {language === 'fil' ? step.crop.name.local : step.crop.name.en}
                                            </div>
                                            <div className="flex flex-wrap gap-1 mb-2">
                                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-at-line uppercase text-at-dk font-semibold">
                                                {step.crop.family}
                                              </span>
                                              {step.crop.nitrogenFixing && (
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-at-tint text-at-dk border border-at-green/40">
                                                  +N Fixer
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-[11px] text-at-muted">{step.role}</div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-at-line/60">
                                        <button
                                          type="button"
                                          onClick={() => promotePlan(plan.id)}
                                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-at-dk hover:bg-at-dk/90 text-at-lime flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                                        >
                                          <Sparkles className="w-3.5 h-3.5 text-at-lime" />
                                          <span>{getTranslation(language, 'results.promotePlan')}</span>
                                        </button>

                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => savePlan(plan, originalRank)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                                              isSaved
                                                ? 'bg-at-dk text-at-lime border-at-dk'
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

                                          <button
                                            type="button"
                                            onClick={() => togglePlanComparison(plan.id)}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                                              isComparing
                                                ? 'bg-at-dk text-white border-at-dk'
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
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {hasMorePlans && (
                            <div className="text-center pt-2">
                              <button
                                type="button"
                                onClick={() => setShowAllOtherPlans((prev) => !prev)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-at-ow border border-at-line text-at-dk transition-colors shadow-2xs cursor-pointer"
                              >
                                {showAllOtherPlans
                                  ? getTranslation(language, 'results.showFewerPlans')
                                  : getTranslation(language, 'results.showMorePlans')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </main>

        {/* Global Footer */}
        <footer className="mt-auto bg-[#1D3309] text-white/80 border-t border-white/10 text-xs py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <img
                src={`${import.meta.env.BASE_URL}images/landing/logo.png`}
                alt="AniTala"
                width={20}
                height={20}
                className="w-5 h-5 object-contain rounded-full shrink-0 shadow-xs ring-1 ring-white/20"
              />
              <span className="font-bold text-white tracking-tight">AniTala</span>
              <span className="text-[#a2bda7]">· Built by <strong className="text-[#bbf246]">Moon Chanter</strong> for the NASA Space Apps Challenge</span>
            </div>
            <div className="text-[11px] text-[#8ca391]">
              NASA POWER API · NASA GIBS (MODIS/VIIRS) · ISRIC SoilGrids · PhilRice & FAO Agronomy
            </div>
          </div>
        </footer>
      </div>

      {/* Modals & Print Artifact */}
      <ComparisonModal />
      <MethodologyModal />
      <SavedPlansModal />
      <PrintablePlan />
    </div>
  );
};

export default App;
