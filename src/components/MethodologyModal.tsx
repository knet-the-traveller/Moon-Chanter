import React, { useEffect } from 'react';
import { getTranslation } from '../i18n';
import { useAppStore } from '../store/useAppStore';
import { X, Database, ShieldCheck, Cpu } from 'lucide-react';

export const MethodologyModal: React.FC = () => {
  const { isMethodologyModalOpen, setMethodologyModalOpen, language } = useAppStore();

  useEffect(() => {
    if (!isMethodologyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMethodologyModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMethodologyModalOpen, setMethodologyModalOpen]);

  if (!isMethodologyModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="methodology-modal-title"
      className="fixed inset-0 z-50 bg-at-dk/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl border-2 border-at-line max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
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
              <h3 id="methodology-modal-title" className="text-lg sm:text-xl font-black text-at-dk">
                AniTala Methodology &amp; Data Provenance
              </h3>
              <p className="text-xs text-at-muted">
                2026 NASA Space Apps Challenge · Team Moon Chanter
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={getTranslation(language, 'provenance.closeMethodology')}
            onClick={() => setMethodologyModalOpen(false)}
            className="p-2 rounded-full hover:bg-at-ow text-at-muted hover:text-at-dk transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto py-5 space-y-6 text-xs sm:text-sm text-at-dk leading-relaxed pr-2">
          {/* Section 1: Earth Observation Datasets */}
          <div>
            <h4 className="font-bold text-at-dk flex items-center gap-1.5 text-sm uppercase tracking-wide mb-2">
              <Database className="w-4 h-4 text-at-axo" />
              1. NASA Earth Observation Data Sources
            </h4>
            <div className="space-y-3 bg-at-ow p-4 rounded-2xl border border-at-line">
              <div>
                <strong className="text-at-dk">NASA POWER API (Prediction of Worldwide Energy Resources):</strong>
                <p className="mt-0.5 text-xs text-at-muted">
                  Provides daily and multi-year agro-climatology data at 0.5° × 0.5° resolution. Parameters used include:
                  <code className="text-[11px] bg-at-tint px-1 py-0.5 rounded mx-1 text-at-dk font-mono">T2M</code> (mean temp),
                  <code className="text-[11px] bg-at-tint px-1 py-0.5 rounded mx-1 text-at-dk font-mono">T2M_MAX</code> (daily max temp),
                  <code className="text-[11px] bg-at-tint px-1 py-0.5 rounded mx-1 text-at-dk font-mono">PRECTOTCORR</code> (corrected precipitation),
                  <code className="text-[11px] bg-at-tint px-1 py-0.5 rounded mx-1 text-at-dk font-mono">ALLSKY_SFC_SW_DWN</code> (solar insolation), and
                  <code className="text-[11px] bg-at-tint px-1 py-0.5 rounded mx-1 text-at-dk font-mono">RH2M</code> (relative humidity).
                </p>
              </div>

              <div>
                <strong className="text-at-dk">NASA GIBS (Global Imagery Browse Services):</strong>
                <p className="mt-0.5 text-xs text-at-muted">
                  Provides full-resolution, real-time satellite imagery via WMTS tile layers:
                  MODIS Terra Corrected Reflectance (True Color) and MODIS 8-day Normalized Difference Vegetation Index (NDVI) for assessing field canopy vigor.
                </p>
              </div>

              <div>
                <strong className="text-at-dk">ISRIC SoilGrids 2.0 (Supplementary Global Data):</strong>
                <p className="mt-0.5 text-xs text-at-muted">
                  Automated machine-learning derived global soil properties at 250m spatial resolution. Used to pre-populate topsoil clay, sand, silt fractions, soil organic carbon (SOC), and pH at 0–15 cm root zone depth.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Recommendation Engine */}
          <div>
            <h4 className="font-bold text-at-dk flex items-center gap-1.5 text-sm uppercase tracking-wide mb-2">
              <Cpu className="w-4 h-4 text-at-axo" />
              2. Pure TypeScript Agronomic Engine
            </h4>
            <p className="text-xs text-at-muted mb-2">
              AniTala intentionally operates without black-box ML so that every recommendation is 100% explainable, transparent, and auditable by agronomists.
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-at-muted">
              <li>
                <strong>Botanical Family Alternation:</strong> Strictly bars consecutive crops of the same family (especially Solanaceae $\to$ Solanaceae) to break bacterial wilt (<em>Ralstonia solanacearum</em>) and soil-borne nematode cycles.
              </li>
              <li>
                <strong>Biological Nitrogen Fixation:</strong> Rewards rotations featuring tropical legumes (Mungbean, Peanut, Cowpea, Soybean, Sunn hemp) which fix 35–100 kg N/ha, replenishing soil fertility.
              </li>
              <li>
                <strong>Root Stratification:</strong> Alternates shallow fibrous roots (Rice) with deep taproots (Cassava, Peanut, Pigeonpea) to penetrate subsoil compaction without heavy till equipment.
              </li>
              <li>
                <strong>Water Budget Envelope:</strong> Compares crop water demand against NASA POWER historic rainfall curves for Wet, Cool Dry, and Hot Dry seasons.
              </li>
              <li>
                <strong>[AGRO-RULE-06-WATER-ACCESS] Water Source &amp; Irrigation Proximity:</strong> Adjusts crop water demand feasibility and penalizes high-demand crops during dry seasons when the field relies on rainfed systems, pump wells, or small farm reservoirs without secure canal gate turnouts.
              </li>
            </ul>
          </div>

          {/* Section 3: Scenario Stress Testing */}
          <div>
            <h4 className="font-bold text-at-dk flex items-center gap-1.5 text-sm uppercase tracking-wide mb-2">
              <ShieldCheck className="w-4 h-4 text-at-axo" />
              3. Climate Stress Testing
            </h4>
            <p className="text-xs text-at-muted">
              {getTranslation(language, 'dataQuality.scenarioInterpretation')}
            </p>
          </div>

          {/* Section 4: Ethical Disclaimer */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-950">
            <strong>Disclaimer for Extension Workers &amp; Farmers:</strong> AniTala is a strategic decision-support tool, not an absolute yield guarantee. Satellite data represents regional pixel averages (0.5° grid). Farmers should always validate recommendations with their local Municipal Agriculture Office (MAO / PhilRice / DA-ATI) and perform local soil jar tests before planting.
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-at-line flex justify-end">
          <button
            type="button"
            onClick={() => setMethodologyModalOpen(false)}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-at-dk text-at-lime hover:bg-at-dk/90 transition-colors shadow-2xs cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
