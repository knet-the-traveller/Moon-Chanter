import type {ClimateData, MonthlyClimatePoint} from '../types';
import {PLANNING_MONTHS} from '../config/planningCalendar';

/** Reaggregate a labeled monthly reference when daily observations are absent.
 * Temperature is a mean of monthly means, not a daily-weighted observation. */
export function aggregatePlanningClimatology(monthly: readonly MonthlyClimatePoint[]): ClimateData['seasonalStats'] {
  const season = (months: readonly number[]) => {
    const rows = months.map(month => monthly.filter(row => row.monthNum === month));
    if (rows.some(matches => matches.length !== 1)) throw new Error('Planning climatology requires one row per month');
    const points = rows.map(([row]) => row);
    const round = (value: number) => Number(value.toFixed(1));
    return {
      precip: round(points.reduce((sum, row) => sum + row.rainfall, 0)),
      avgTemp: round(points.reduce((sum, row) => sum + row.temp, 0) / points.length),
      maxTemp: Math.max(...points.map(row => row.tempMax))
    };
  };
  return {wet: season(PLANNING_MONTHS.wet), dryCool: season(PLANNING_MONTHS.coolDry), dryHot: season(PLANNING_MONTHS.hotDry)};
}
