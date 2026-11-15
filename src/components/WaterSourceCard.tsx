import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import type { WaterSource } from '../types';
import { Droplets, AlertCircle } from 'lucide-react';

const WATER_SOURCES: Array<{ id: WaterSource; labelKey: string }> = [
  { id: 'irrigation_canal', labelKey: 'conditions.waterCanal' },
  { id: 'rainfed', labelKey: 'conditions.waterRainfed' },
  { id: 'pump_well', labelKey: 'conditions.waterPumpWell' },
  { id: 'small_pond', labelKey: 'conditions.waterSmallPond' },
];

export const WaterSourceCard: React.FC = () => {
  const { waterSource, setWaterSource, language } = useAppStore();

  return (
    <section
      className="bg-white rounded-2xl p-5 sm:p-6 border border-at-line shadow-sm"
      aria-labelledby="water-source-title"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-at-line/50 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-at-blue" aria-hidden="true" />
            <h3 id="water-source-title" className="font-bold text-at-dk text-base sm:text-lg">
              {getTranslation(language, 'conditions.waterSourceTitle')}
            </h3>
          </div>
          <p className="text-xs text-at-muted mt-1">
            {getTranslation(language, 'conditions.waterSourceSubtitle')}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-at-tint text-at-dk border border-at-line">
          <AlertCircle className="w-3.5 h-3.5 text-at-amber" aria-hidden="true" />
          {getTranslation(language, 'conditions.waterNeedsReview')}
        </span>
      </div>

      <div className="flex flex-wrap gap-2.5 mt-4" data-group="water">
        {WATER_SOURCES.map((source) => {
          const isSelected = waterSource === source.id;
          const label = getTranslation(language, source.labelKey);
          return (
            <button
              key={source.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setWaterSource(source.id)}
              className={`chip px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer border ${
                isSelected
                  ? 'on bg-at-dk text-white border-at-dk shadow-sm ring-2 ring-at-dk/20'
                  : 'bg-at-ow text-at-dk border-at-line hover:bg-at-tint'
              }`}
            >
              {isSelected ? '✓ ' : ''}{label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-at-muted mt-3">
        {getTranslation(language, 'conditions.waterAccessHint')}
      </p>
    </section>
  );
};
