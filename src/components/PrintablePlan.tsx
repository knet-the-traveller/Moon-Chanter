import { resolvePlanningSoil, hasDemoSoil } from '../services/planningSoil';
import { PlanDataEvidence, LocalReviewChecklist } from './RotationCard';
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { hasProvisionalEvidence } from '../data/provenance';
import { MapPin, Database } from 'lucide-react';

export const PrintablePlan: React.FC = () => {
  const {
    useDemoAssumptions,
    selectedLocation,
    climateData,
    soilData,
    soilOverride,
    recommendedPlans,
    activeSpotlightPlanId,
    advisoryIssuedAt,
    landSummary,
    language,
    waterSource,
    fieldSizeHa,
    plotNotes
  } = useAppStore();

  const activePlan = recommendedPlans.find((p) => p.id === activeSpotlightPlanId) ?? recommendedPlans[0];
  const activeRank = activePlan ? recommendedPlans.findIndex((p) => p.id === activePlan.id) + 1 : 1;

  const resolvedSoil = soilData ? resolvePlanningSoil(soilData, soilOverride, useDemoAssumptions) : null;
  const effectiveSoil = resolvedSoil ?? soilOverride ?? {};
  const context = { climate: climateData, soil: resolvedSoil, land: landSummary };

  if (!activePlan || !climateData || advisoryIssuedAt === null) return null;

  const todayStr = new Date(advisoryIssuedAt).toLocaleDateString(language === 'fil' ? 'fil-PH' : 'en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatWaterSource = (ws: typeof waterSource): string => {
    switch (ws) {
      case 'irrigation_canal':
        return getTranslation(language, 'conditions.waterCanal');
      case 'rainfed':
        return getTranslation(language, 'conditions.waterRainfed');
      case 'pump_well':
        return getTranslation(language, 'conditions.waterPumpWell');
      case 'small_pond':
        return getTranslation(language, 'conditions.waterSmallPond');
      default:
        return ws;
    }
  };

  return (
    <div className="hidden print:block p-8 max-w-4xl mx-auto bg-white text-stone-900 font-sans">
      {/* Print Document Header */}
      <div className="border-b-2 border-emerald-900 pb-4 mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1D3309] text-amber-300 flex items-center justify-center font-bold">
              AT
            </div>
            <h1 className="text-2xl font-black tracking-tight text-emerald-950">
              AniTala · Farm Advisory Sheet
            </h1>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            2026 NASA Space Apps Challenge · Team Moon Chanter · Decision-Support System
          </p>
        </div>
        <div className="text-right text-xs text-stone-500">
          <div>Date: <strong>{todayStr}</strong></div>
          <div>Advisory Ref: <strong className="font-mono">AT-{selectedLocation.lat.toFixed(2)}-{advisoryIssuedAt.toString().slice(-4)}</strong></div>
        </div>
      </div>

      {hasDemoSoil(resolvedSoil) && (
        <p className="mb-4 rounded-lg border border-stone-500 p-3 text-sm font-bold text-stone-950 print:break-inside-avoid">
          {getTranslation(language, 'mvp.printNotice')}
        </p>
      )}

      {/* Farm Location & Baseline Context */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs">
        <div>
          <h2 className="font-bold text-stone-900 uppercase text-[11px] mb-1 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-700" /> Farm Location & Telemetry
          </h2>
          <div className="text-sm font-bold text-stone-900">{selectedLocation.name}</div>
          <div className="text-stone-600">{selectedLocation.province}, {selectedLocation.region}</div>
          <div className="font-mono text-stone-500 text-[11px] mt-0.5">
            Coords: {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E · {landSummary?.elevationM != null
              ? `${getTranslation(language, 'land.elevation')}: ~${landSummary.elevationM} m`
              : getTranslation(language, 'land.unknownElevation')}
          </div>
          <div className="mt-1 space-y-0.5 text-stone-700">
            <div>Water Source: <strong>{formatWaterSource(waterSource)}</strong></div>
            {fieldSizeHa != null && <div>Field Size: <strong>{fieldSizeHa} ha</strong></div>}
            {plotNotes && <div>Plot Notes: <strong>{plotNotes}</strong></div>}
          </div>
        </div>

        <div>
          <h2 className="font-bold text-stone-900 uppercase text-[11px] mb-1 flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-blue-700" /> NASA Agro-Climatic Profile
          </h2>
          <div className="space-y-0.5 text-stone-700">
            <div>Annual Rainfall: <strong>{climateData.meanAnnualPrecipitation} mm/yr</strong> (NASA POWER)</div>
            <div>Mean Temp: <strong>{climateData.meanAnnualTemp}°C</strong> (Peak Dry: {climateData.seasonalStats.dryHot.maxTemp}°C)</div>
            <div>Soil Type: <strong className="capitalize">{effectiveSoil.texture?.replace('_', ' ') ?? getTranslation(language, 'provenance.unavailableValue')}</strong> ({effectiveSoil.drainage ?? getTranslation(language, 'provenance.unavailableValue')} drainage, pH {effectiveSoil.ph ?? getTranslation(language, 'provenance.unavailableValue')})</div>
            <div>Soil Organic Matter: <strong className="capitalize">{effectiveSoil.organicMatter && effectiveSoil.organicMatter !== 'unknown' ? effectiveSoil.organicMatter : getTranslation(language, 'provenance.unavailableValue')}</strong></div>
          </div>
        </div>
      </div>

      {/* Top / Active Rotation Plan */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-base font-black text-emerald-950 uppercase tracking-wide">
              {activeRank === 1
                ? 'Recommended 3-Season Rotation Plan (Rank #1)'
                : `Recommended 3-Season Rotation Plan (Active Plan · Promoted from #${activeRank})`}
            </h2>
            <div className="text-sm font-bold text-stone-800 mt-0.5">
              {language === 'fil' ? activePlan.name.local : activePlan.name.en}
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded">
            Fit Score: {activePlan.scores.overall}/100 ({hasProvisionalEvidence(context)
              ? getTranslation(language, 'dataQuality.provisional') : activePlan.robustness.toUpperCase()})
          </span>
        </div>

        {/* 3 Seasons Table */}
        <table className="w-full border-collapse border border-stone-300 text-xs mb-4">
          <thead>
            <tr className="bg-emerald-950 text-white">
              <th className="border border-emerald-900 p-2 text-left">Season</th>
              <th className="border border-emerald-900 p-2 text-left">Window</th>
              <th className="border border-emerald-900 p-2 text-left">Crop</th>
              <th className="border border-emerald-900 p-2 text-left">Family</th>
              <th className="border border-emerald-900 p-2 text-left">Agronomic Role & Guidance</th>
            </tr>
          </thead>
          <tbody>
            {activePlan.seasons.map((s, idx) => (
              <tr key={s.seasonKey} className={idx % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                <td className="border border-stone-300 p-2 font-bold text-stone-900">
                  Season {idx + 1}
                </td>
                <td className="border border-stone-300 p-2 font-mono text-stone-600">
                  {s.periodMonths}
                </td>
                <td className="border border-stone-300 p-2 font-bold text-emerald-900">
                  {s.crop.name.en} ({s.crop.name.local})
                </td>
                <td className="border border-stone-300 p-2 uppercase text-stone-600">
                  {s.crop.family} {s.crop.nitrogenFixing && '(+N Fixer)'}
                </td>
                <td className="border border-stone-300 p-2 text-stone-700">
                  {s.role}. {s.crop.notes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scientific Rationale */}
      <div className="mb-6 p-4 rounded-xl border border-stone-200 bg-stone-50/60 text-xs">
        <h3 className="font-bold text-stone-900 uppercase text-[11px] mb-2">
          Agronomic Rationale & NASA Telemetry Evidence
        </h3>
        <ul className="list-disc pl-5 space-y-1 text-stone-700">
          {activePlan.reasons.map((r) => (
            <li key={r.id}>
              <strong>[{r.ruleId}]</strong> {language === 'fil' ? r.textFil : r.textEn} <span className="text-stone-500 italic">(Evidence: {r.dataEvidence})</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Operational Risks & Mitigations */}
      {activePlan.risks.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-xs">
          <h3 className="font-bold text-amber-950 uppercase text-[11px] mb-2">
            Identified Risks & Field Mitigations
          </h3>
          <ul className="space-y-1.5 text-stone-800">
            {activePlan.risks.map((risk) => (
              <li key={risk.id}>
                <strong>⚠️ {language === 'fil' ? risk.textFil : risk.textEn}</strong>
                <div className="text-stone-600 pl-4 mt-0.5">↳ Mitigation: {language === 'fil' ? risk.mitigationFil : risk.mitigationEn}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PlanDataEvidence context={context} language={language} forPrint />
      <LocalReviewChecklist plan={activePlan} context={context} language={language} forPrint />

      {/* Extension Worker Sign-off & Notice */}
      <div className="pt-6 border-t border-stone-300 text-[11px] text-stone-600 flex justify-between items-end">
        <div className="max-w-md">
          <p className="font-semibold text-stone-800">Agricultural Extension Notice:</p>
          <p className="mt-0.5">
            This advisory plan was prepared using AniTala, NASA Earth Observations (POWER / GIBS), and ISRIC SoilGrids. Please present this advisory sheet to your local Municipal Agriculture Officer (MAO) or PhilRice extension specialist for localized seed variety selection and field fertilization schedule.
          </p>
        </div>

        <div className="w-56 text-center border-t border-stone-400 pt-2">
          <div className="text-stone-400 mb-6">Signature / Date</div>
          <div className="font-bold text-stone-800">Municipal Agriculturist / Technician</div>
        </div>
      </div>
    </div>
  );
};
