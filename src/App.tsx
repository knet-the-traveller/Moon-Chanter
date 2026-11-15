import { DemoModeNotice } from './components/DemoModeNotice';
import { resolvePlanningSoil } from './services/planningSoil';
import React, { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { getTranslation } from './i18n';
import { Navbar } from './components/Navbar';
import { StepProgress } from './components/StepProgress';
import { MapPicker } from './components/MapPicker';
import { ClimateCard } from './components/ClimateCard';
import { SoilCard } from './components/SoilCard';
import { PrioritiesSection } from './components/PrioritiesSection';
import { ScenarioBar } from './components/ScenarioBar';
import { RotationCard } from './components/RotationCard';
import { ComparisonModal } from './components/ComparisonModal';
import { MethodologyModal } from './components/MethodologyModal';
import { PrintablePlan } from './components/PrintablePlan';
import { hasRequiredSoilInputs } from './engine/soilInputs';
import {
  ArrowRight,
  ArrowLeft,
  Scale,
  Printer
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    useDemoAssumptions,
    currentStep,
    setCurrentStep,
    selectedLocation,
    recommendedPlans,
    comparedPlanIds,
    setComparisonModalOpen,
    language, soilData, soilOverride, climateData, isLoadingTelemetry, advisoryIssuedAt,
    applyMunicipalBaseline
  } = useAppStore();

  const emptyResultsKey = isLoadingTelemetry ? 'dataQuality.loading'
    : !soilData || !climateData ? 'dataQuality.missingTelemetry'
    : !hasRequiredSoilInputs(resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions)) ? 'dataQuality.missingSoil'
    : 'results.noPlans';

  // Initial load: Fetch telemetry for default pilot region on first render
  useEffect(() => {
    const { climateData, landSummary, isLoadingTelemetry, isLoadingLand, selectedLocation, fetchTelemetry } = useAppStore.getState();
    if ((!climateData || !landSummary) && !isLoadingTelemetry && !isLoadingLand) {
      void fetchTelemetry(selectedLocation.lat, selectedLocation.lon);
    }
  }, []);

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#faf8f5] text-stone-900 flex flex-col font-sans selection:bg-amber-200">
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
                  <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                    {getTranslation(language, 'conditions.climateTitle')}
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                    Field: <strong className="text-stone-900">{selectedLocation.name}</strong> ({selectedLocation.province}) · Coordinates: {selectedLocation.lat.toFixed(3)}°N, {selectedLocation.lon.toFixed(3)}°E
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Location</span>
                  </button>
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1e3a2f] hover:bg-emerald-900 text-amber-300 flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>Configure Priorities</span>
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <ClimateCard />
                <SoilCard />
              </div>
            </div>
          )}

          {/* STEP 3: PRIORITIES & FIELD HISTORY */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                    {getTranslation(language, 'priorities.title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                    Customize the objective weights according to your economic goals and resources.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1.5 transition-colors"
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
                  <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                    {getTranslation(language, 'results.title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 mt-0.5">
                    {getTranslation(language, 'results.subtitle')} (Generated {recommendedPlans.length} candidates)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentStep(3)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Adjust Priorities</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    disabled={recommendedPlans.length === 0 || advisoryIssuedAt === null}
                    title={recommendedPlans.length === 0 ? getTranslation(language, 'dataQuality.noPrintablePlan') : undefined}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-stone-950 flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer className="w-3.5 h-3.5 text-stone-950" />
                    <span>Print Plan Sheet</span>
                  </button>
                </div>
              </div>

              {/* Stress Scenarios Selector Bar */}
              <ScenarioBar />

              {/* Comparison Pill / Banner */}
              {comparedPlanIds.length > 0 && (
                <div className="p-3 bg-emerald-900 text-amber-50 rounded-2xl flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Scale className="w-4 h-4 text-amber-400" />
                    <span>
                      {comparedPlanIds.length} plan{comparedPlanIds.length > 1 ? 's' : ''} queued for side-by-side comparison.
                    </span>
                  </div>
                  <button
                    onClick={() => setComparisonModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-stone-950 transition-colors shadow-sm"
                  >
                    {getTranslation(language, 'results.viewComparison')}
                  </button>
                </div>
              )}

              {/* Ranked Rotation Cards */}
              {recommendedPlans.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-stone-200">
                  <p className="text-sm text-stone-600">
                    {getTranslation(language, emptyResultsKey)}
                  </p>
                  {!isLoadingTelemetry && !!climateData && (!soilData || !hasRequiredSoilInputs(resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions))) && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => { void applyMunicipalBaseline(); }}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-800"
                      >
                        {getTranslation(language, 'dataQuality.useMunicipalBaseline')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="inline-flex items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-emerald-800"
                      >
                        {getTranslation(language, 'nav.conditions')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendedPlans.map((plan, idx) => (
                    <RotationCard key={plan.id} plan={plan} rank={idx + 1} />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* Global Footer */}
        <footer className="mt-auto bg-stone-900 text-stone-400 border-t border-stone-800 text-xs py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="font-bold text-stone-200">FieldShift</span> · Built by{' '}
              <strong className="text-amber-400">Moon Chanter</strong> for the NASA Space Apps Challenge
            </div>
            <div className="text-[11px] text-stone-500">
              NASA POWER API · NASA GIBS (MODIS/VIIRS) · ISRIC SoilGrids · PhilRice & FAO Agronomy
            </div>
          </div>
        </footer>
      </div>

      {/* Modals & Print Artifact */}
      <ComparisonModal />
      <MethodologyModal />
      <PrintablePlan />
    </div>
  );
};

export default App;
