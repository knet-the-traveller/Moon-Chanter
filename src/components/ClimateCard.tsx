import { climateProvenance, formatProvenance } from '../data/provenance';
import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { getTranslation } from '../i18n';
import { planningPeriod } from '../config/planningCalendar';
import {
  CloudSun,
  Droplets,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Database,
  Calendar,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';

export const ClimateCard: React.FC = () => {
  const { climateData, language, isLoadingTelemetry } = useAppStore();

  if (isLoadingTelemetry) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm animate-pulse">
        <div className="h-6 bg-stone-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-stone-100 rounded w-1/2 mb-6"></div>
        <div className="h-48 bg-stone-100 rounded-xl"></div>
      </div>
    );
  }

  if (!climateData) {
    return null;
  }

  const metadata = climateProvenance(climateData);
  const chartData = climateData.monthly.map((m) => ({
    name: m.month,
    rainfall: m.rainfall,
    temp: m.temp,
    tempMax: m.tempMax
  }));

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-stone-200 shadow-sm">
      {/* Title & Provenance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CloudSun className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-stone-900 text-base sm:text-lg">
              {getTranslation(language, 'conditions.climateTitle')}
            </h3>
          </div>
          <div className="text-xs text-stone-500 mt-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-medium">
              <Database className="w-3.5 h-3.5 text-stone-400" />
              {climateData.source}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-stone-400" />
              {climateData.dateRange}
            </span>
          </div>
        </div>

        {/* Live or Sample Badge */}
        <div>
          {climateData.isSampleData ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              {getTranslation(language, 'conditions.sampleBadge')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
              {getTranslation(language, `provenance.${metadata.precipitation.tier ?? 'unavailable'}`)}
            </span>
          )}
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        {/* Annual Rainfall */}
        <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100">
          <div className="text-xs font-semibold text-blue-900 flex items-center gap-1">
            <Droplets className="w-3.5 h-3.5 text-blue-600" />
            <span>{getTranslation(language, 'conditions.annualPrecip')}</span>
          </div>
          <div className="text-xl font-black text-blue-950 mt-1">
            {climateData.meanAnnualPrecipitation.toLocaleString()} <span className="text-xs font-normal">mm/yr</span>
          </div>
        </div>

        {/* Mean Temp */}
        <div className="p-3.5 rounded-xl bg-orange-50/60 border border-orange-100">
          <div className="text-xs font-semibold text-orange-900 flex items-center gap-1">
            <ThermometerSun className="w-3.5 h-3.5 text-orange-600" />
            <span>{getTranslation(language, 'conditions.annualTemp')}</span>
          </div>
          <div className="text-xl font-black text-orange-950 mt-1">
            {climateData.meanAnnualTemp}°C
          </div>
        </div>

        {/* Heat Stress Days */}
        <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-100">
          <div className="text-xs font-semibold text-amber-900 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>{getTranslation(language, 'conditions.heatStressDays')}</span>
          </div>
          <div className="text-xl font-black text-amber-950 mt-1">
            ~{climateData.heatStressDaysPerYear} <span className="text-xs font-normal">days/yr</span>
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            Risk: <span className="font-semibold uppercase">{climateData.heatRisk}</span>
          </div>
        </div>

        {/* Decadal Rainfall Trend */}
        <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
          <div className="text-xs font-semibold text-stone-800 flex items-center gap-1">
            {climateData.tenYearRainfallTrend === 'decreasing' ? (
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{getTranslation(language, 'conditions.rainfallTrend')}</span>
          </div>
          <div className="text-sm font-bold text-stone-900 mt-1 capitalize">
            {metadata.rainfallTrend.tier === 'unavailable' ? getTranslation(language,'provenance.unavailableValue') : `${climateData.tenYearRainfallTrend} (${climateData.trendDeltaPercent > 0 ? '+' : ''}${climateData.trendDeltaPercent}%)`}
          </div>
          <div className="text-[11px] text-stone-500 mt-0.5">
            Dry Spell Risk: <span className="font-semibold uppercase text-stone-700">{climateData.drySpellRisk}</span>
          </div>
        </div>
      </div>
      {/* Seasonal Breakdown Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5 p-3 rounded-xl bg-stone-50/80 border border-stone-200/70 text-xs">
        <div>
          <div className="font-bold text-stone-900">{getTranslation(language, 'conditions.wetSeason').replace('{months}', planningPeriod('wet', language))}</div>
          <div className="text-stone-600 mt-0.5 font-medium">
            Rain: <span className="font-bold text-blue-700">{climateData.seasonalStats.wet.precip} mm</span> · Max T: {climateData.seasonalStats.wet.maxTemp}°C
          </div>
        </div>
        <div>
          <div className="font-bold text-stone-900">{getTranslation(language, 'conditions.dryCoolSeason').replace('{months}', planningPeriod('coolDry', language))}</div>
          <div className="text-stone-600 mt-0.5 font-medium">
            Rain: <span className="font-bold text-blue-700">{climateData.seasonalStats.dryCool.precip} mm</span> · Max T: {climateData.seasonalStats.dryCool.maxTemp}°C
          </div>
        </div>
        <div>
          <div className="font-bold text-stone-900">{getTranslation(language, 'conditions.dryHotSeason').replace('{months}', planningPeriod('hotDry', language))}</div>
          <div className="text-stone-600 mt-0.5 font-medium">
            Rain: <span className="font-bold text-blue-700">{climateData.seasonalStats.dryHot.precip} mm</span> · Max T: <span className="font-bold text-rose-600">{climateData.seasonalStats.dryHot.maxTemp}°C</span>
          </div>
        </div>
      </div>
      {/* Monthly Chart (Recharts) */}
      <div className="mt-2">
        <div className="text-xs font-semibold text-stone-700 mb-2 flex items-center justify-between">
          <span>{getTranslation(language, 'provenance.chart')}</span>
          <span className="text-[10px] text-stone-400 font-normal">{climateData.dateRange}</span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4b5563' }} />
              <YAxis yAxisId="rain" orientation="left" tick={{ fontSize: 11, fill: '#2563eb' }} unit="mm" />
              <YAxis yAxisId="temp" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 11, fill: '#d97706' }} unit="°" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Bar yAxisId="rain" dataKey="rainfall" name="Rainfall (mm)" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Line yAxisId="temp" type="monotone" dataKey="tempMax" name="Max Temp (°C)" stroke="#d97706" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <details className="mt-4 text-sm text-stone-800">
        <summary className="cursor-pointer font-semibold">{getTranslation(language,'mvp.sourceDetails')}</summary>
        <ul className="mt-2 space-y-2 break-words text-xs">{Object.entries(metadata).map(([key,value])=><li key={key}>{formatProvenance(language,value)}</li>)}</ul>
      </details>
      {/* NASA Variables Citation Footer */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between text-[11px] text-stone-500 gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-stone-400" />
          <span>Variables: <strong>{climateData.variableList.join(', ')}</strong></span>
        </div>
        <div className="text-[10px] text-stone-400 italic">
          {getTranslation(language, 'provenance.derived')}
        </div>
      </div>
    </div>
  );
};
