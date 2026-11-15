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
import { SavedPlansModal } from './components/SavedPlansModal';
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
    language,
    soilData,
    soilOverride,
    climateData,
    isLoadingTelemetry,
    advisoryIssuedAt,
    applyMunicipalBaseline
  } = useAppStore();

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
                  <h2 className="text-xl sm:text-2xl font-black text-[#1D3309] tracking-tight">
                    {getTranslation(language, 'conditions.climateTitle')}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#56664A] mt-0.5">
                    Field: <strong className="text-[#1D3309]">{selectedLocation.name}</strong> ({selectedLocation.province}) · Coordinates: {selectedLocation.lat.toFixed(3)}°N, {selectedLocation.lon.toFixed(3)}°E
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#D5E0C8] hover:border-[#1D3309] text-[#1D3309] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Location</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1D3309] hover:bg-[#2e4d11] text-white flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Configure Priorities</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#C7DA91]" />
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
                  <h2 className="text-xl sm:text-2xl font-black text-[#1D3309] tracking-tight">
                    {getTranslation(language, 'priorities.title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#56664A] mt-0.5">
                    Customize the objective weights according to your economic goals and resources.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#D5E0C8] hover:border-[#1D3309] text-[#1D3309] flex items-center gap-1.5 transition-colors cursor-pointer"
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
                  <h2 className="text-xl sm:text-2xl font-black text-[#1D3309] tracking-tight">
                    {getTranslation(language, 'results.title')}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#56664A] mt-0.5">
                    {getTranslation(language, 'results.subtitle')} (Generated {recommendedPlans.length} candidates)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#D5E0C8] hover:border-[#1D3309] text-[#1D3309] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Adjust Priorities</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    disabled={recommendedPlans.length === 0 || advisoryIssuedAt === null}
                    title={recommendedPlans.length === 0 ? getTranslation(language, 'dataQuality.noPrintablePlan') : undefined}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-[#A7BD40] hover:bg-[#bbf246] text-[#1D3309] flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#1D3309]" />
                    <span>Print Plan Sheet</span>
                  </button>
                </div>
              </div>

              {/* Stress Scenarios Selector Bar */}
              <ScenarioBar />

              {/* Comparison Pill / Banner */}
              {comparedPlanIds.length > 0 && (
                <div className="p-3 bg-[#1D3309] text-white rounded-2xl flex items-center justify-between shadow-xs border border-white/10">
                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <Scale className="w-4 h-4 text-[#C7DA91]" />
                    <span>
                      {comparedPlanIds.length} plan{comparedPlanIds.length > 1 ? 's' : ''} queued for side-by-side comparison.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComparisonModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#A7BD40] hover:bg-[#bbf246] text-[#1D3309] transition-colors shadow-xs cursor-pointer"
                  >
                    {getTranslation(language, 'results.viewComparison')}
                  </button>
                </div>
              )}

              {/* Ranked Rotation Cards */}
              {recommendedPlans.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 text-center border border-[#D5E0C8] shadow-xs">
                  <p className="text-sm text-[#56664A]">
                    {getTranslation(language, emptyResultsKey)}
                  </p>
                  {!isLoadingTelemetry && !!climateData && (!soilData || !hasRequiredSoilInputs(resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions))) && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => { void applyMunicipalBaseline(); }}
                        className="inline-flex items-center justify-center rounded-xl bg-[#1D3309] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2e4d11] focus-visible:outline-2 focus-visible:outline-[#1D3309] cursor-pointer"
                      >
                        {getTranslation(language, 'dataQuality.useMunicipalBaseline')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="inline-flex items-center justify-center rounded-xl border border-[#D5E0C8] bg-white px-4 py-2.5 text-sm font-semibold text-[#1D3309] hover:bg-[#F7F9F4] focus-visible:outline-2 focus-visible:outline-[#1D3309] cursor-pointer"
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
