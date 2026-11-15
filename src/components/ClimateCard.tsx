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
      <div className="card bg-white rounded-2xl p-6 border border-at-line shadow-sm animate-pulse">
        <div className="h-6 bg-at-ow rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-at-ow rounded w-1/2 mb-6"></div>
        <div className="h-48 bg-at-ow rounded-xl"></div>
      </div>
    );
  }

  if (!climateData) {
    return null;
  }

  const metadata = climateProvenance(climateData);
  const shortSource = getTranslation(
    language,
    metadata.precipitation.isSynthetic || metadata.temperature.isSynthetic
      ? 'conditions.shortIllustrativeClimate'
      : climateData.isSampleData ? 'conditions.shortSampleClimate' : 'conditions.shortNasaPower'
  );
  const conciseSubtitle = [shortSource, climateData.dateRange].filter(Boolean).join(' · ');
  const chartData = climateData.monthly.map((m) => ({
    name: m.month,
    rainfall: m.rainfall,
    temp: m.temp,
    tempMax: m.tempMax
  }));

  return (
    <div className="card bg-white rounded-2xl p-5 sm:p-6 border border-at-line shadow-sm">
      {/* Title & Provenance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-at-line/50 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CloudSun className="w-5 h-5 text-at-amber" />
            <h3 className="font-bold text-at-dk text-base sm:text-lg">
              {getTranslation(language, 'conditions.climateTitle')}
            </h3>
          </div>
          <div className="text-xs text-at-muted mt-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-medium">
              <Database className="w-3.5 h-3.5 text-at-muted" />
              {climateData.source}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-at-muted" />
              {climateData.dateRange}
            </span>
          </div>
        </div>

        {/* Live or Sample Badge */}
        <div>
          {climateData.isSampleData ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-at-tint text-at-dk border border-at-line">
              <AlertTriangle className="w-3.5 h-3.5 text-at-amber" />
              {getTranslation(language, 'conditions.sampleBadge')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-at-tint text-at-dk border border-at-line">
              <span className="w-2 h-2 rounded-full bg-at-green animate-ping"></span>
              {getTranslation(language, `provenance.${metadata.precipitation.tier ?? 'unavailable'}`)}
            </span>
          )}
        </div>
      </div>

      {/* Primary KPI Grid (2x2 .wt matching step2.html) */}
      <div className="wgrid grid grid-cols-2 gap-3 my-4">
        {/* Annual Rainfall */}
        <div className="wt border border-at-line rounded-xl p-3.5 sm:p-4 bg-at-ow">
          <div className="text-xs sm:text-sm font-semibold text-at-dk flex items-center gap-1.5">
            <Droplets className="w-4 h-4 text-at-blue" />
            <span>{getTranslation(language, 'conditions.annualPrecip')}</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-at-dk mt-1">
            {climateData.meanAnnualPrecipitation.toLocaleString()} <span className="text-xs font-normal">mm/yr</span>
          </div>
          <div className="text-[11px] sm:text-xs text-at-muted mt-0.5 truncate" title={conciseSubtitle}>
            {conciseSubtitle}
          </div>
        </div>

        {/* Mean Temp */}
        <div className="wt border border-at-line rounded-xl p-3.5 sm:p-4 bg-at-ow">
          <div className="text-xs sm:text-sm font-semibold text-at-dk flex items-center gap-1.5">
            <ThermometerSun className="w-4 h-4 text-at-amber" />
            <span>{getTranslation(language, 'conditions.annualTemp')}</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-at-dk mt-1">
            {climateData.meanAnnualTemp}°C
          </div>
          <div className="text-[11px] sm:text-xs text-at-muted mt-0.5 truncate" title={conciseSubtitle}>
            {conciseSubtitle}
          </div>
        </div>

        {/* Heat Stress Days */}
        <div className="wt border border-at-line rounded-xl p-3.5 sm:p-4 bg-at-ow">
          <div className="text-xs sm:text-sm font-semibold text-at-dk flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-at-amber" />
            <span>{getTranslation(language, 'conditions.heatStressDays')}</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-at-dk mt-1">
            ~{climateData.heatStressDaysPerYear} <span className="text-xs font-normal">days/yr</span>
          </div>
          <div className="text-[11px] sm:text-xs text-at-muted mt-0.5">
            {getTranslation(language, 'conditions.heatRiskLabel')}: <span className="font-semibold uppercase text-at-dk">{climateData.heatRisk}</span>
          </div>
        </div>

        {/* Decadal Rainfall Trend */}
        <div className="wt border border-at-line rounded-xl p-3.5 sm:p-4 bg-at-ow">
          <div className="text-xs sm:text-sm font-semibold text-at-dk flex items-center gap-1.5">
            {climateData.tenYearRainfallTrend === 'decreasing' ? (
              <TrendingDown className="w-4 h-4 text-rose-600" />
            ) : (
              <TrendingUp className="w-4 h-4 text-at-green" />
            )}
            <span>{getTranslation(language, 'conditions.rainfallTrend')}</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-at-dk mt-1 capitalize">
            {metadata.rainfallTrend.tier === 'unavailable' ? getTranslation(language,'provenance.unavailableValue') : `${climateData.tenYearRainfallTrend} (${climateData.trendDeltaPercent > 0 ? '+' : ''}${climateData.trendDeltaPercent}%)`}
          </div>
          <div className="text-[11px] sm:text-xs text-at-muted mt-0.5">
            {getTranslation(language, 'conditions.drySpellRiskLabel')}: <span className="font-semibold uppercase text-at-dk">{climateData.drySpellRisk}</span>
          </div>
        </div>
      </div>

      {/* Seasonal Breakdown 3-Season Strip */}
      <div className="seasons grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-4 p-3 rounded-xl bg-at-tint/50 border border-at-line text-xs">
        <div className="bg-white/80 rounded-lg p-2.5 border border-at-line/50">
          <div className="font-bold text-at-dk">
            {getTranslation(language, 'conditions.wetSeason').replace('{months}', planningPeriod('wet', language))}
          </div>
          <div className="text-at-muted mt-0.5 font-medium">
            Rain: <span className="font-bold text-at-blue">{climateData.seasonalStats.wet.precip} mm</span> · Max T: {climateData.seasonalStats.wet.maxTemp}°C
          </div>
        </div>
        <div className="bg-white/80 rounded-lg p-2.5 border border-at-line/50">
          <div className="font-bold text-at-dk">
            {getTranslation(language, 'conditions.dryCoolSeason').replace('{months}', planningPeriod('coolDry', language))}
          </div>
          <div className="text-at-muted mt-0.5 font-medium">
            Rain: <span className="font-bold text-at-blue">{climateData.seasonalStats.dryCool.precip} mm</span> · Max T: {climateData.seasonalStats.dryCool.maxTemp}°C
          </div>
        </div>
        <div className="bg-white/80 rounded-lg p-2.5 border border-at-line/50">
          <div className="font-bold text-at-dk">
            {getTranslation(language, 'conditions.dryHotSeason').replace('{months}', planningPeriod('hotDry', language))}
          </div>
          <div className="text-at-muted mt-0.5 font-medium">
            Rain: <span className="font-bold text-at-blue">{climateData.seasonalStats.dryHot.precip} mm</span> · Max T: <span className="font-bold text-at-amber">{climateData.seasonalStats.dryHot.maxTemp}°C</span>
          </div>
        </div>
      </div>

      {/* Monthly Chart (Recharts) */}
      <div className="chart border border-at-line rounded-xl p-3.5 sm:p-4 mt-2">
        <div className="text-xs font-semibold text-at-dk mb-2 flex items-center justify-between">
          <span>{getTranslation(language, 'provenance.chart')}</span>
          <span className="text-[10px] text-at-muted font-normal">{climateData.dateRange}</span>
        </div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D5E0C8" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#56664A' }} />
              <YAxis yAxisId="rain" orientation="left" tick={{ fontSize: 11, fill: '#5C95E0' }} unit="mm" />
              <YAxis yAxisId="temp" orientation="right" domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 11, fill: '#D98A2B' }} unit="°" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#D5E0C8',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
              <Bar yAxisId="rain" dataKey="rainfall" name="Rainfall (mm)" fill="#5C95E0" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Line yAxisId="temp" type="monotone" dataKey="tempMax" name="Max Temp (°C)" stroke="#D98A2B" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-at-line bg-at-ow p-3 text-xs text-at-dk break-words">
        <summary className="cursor-pointer py-1 font-semibold text-at-dk focus-visible:outline-2 focus-visible:outline-at-dk">
          {getTranslation(language, 'provenance.viewCaveats')}
        </summary>
        <ul className="mt-2 space-y-2 break-words text-xs text-at-muted">
          {Object.entries(metadata).map(([key, value]) => <li key={key}>{formatProvenance(language, value)}</li>)}
        </ul>
      </details>

      {/* NASA Variables Citation Footer */}
      <div className="mt-4 pt-3 border-t border-at-line/50 flex flex-wrap items-center justify-between text-[11px] text-at-muted gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-at-muted" />
          <span>Variables: <strong>{climateData.variableList.join(', ')}</strong></span>
        </div>
        <div className="text-[10px] text-at-muted italic">
          {getTranslation(language, 'provenance.derived')}
        </div>
      </div>
    </div>
  );
};
